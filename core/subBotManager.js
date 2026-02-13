const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    makeCacheableSignalKeyStore, 
    fetchLatestBaileysVersion, 
    getContentType, 
    downloadContentFromMessage 
} = require("@whiskeysockets/baileys");
const { wrapClientWithAntiBan, sleep: antiBanSleep, getRandomDelay, ANTI_BAN_CONFIG, checkCommandCooldown, clearRateLimits } = require('./lib/antiBan');
const pino = require('pino');
const fs = require('fs-extra');
const path = require('path');
const { initSubBotsDB, addSubBot, getAllActiveSubBots, updateSubBotStatus, deleteExpiredSubBots, getSubBot } = require('./database/subbots');
const XMD = require('./xmd');
const zlib = require('zlib');
const { evt } = require('./commandHandler');
const { getSettings } = require('./database/settings');
const { 
    getSubBotSettings, 
    updateSubBotSettings,
    getSubBotAntiLinkSettings,
    getSubBotGreetSettings,
    getSubBotPresenceSettings,
    getSubBotAutoStatusSettings,
    getSubBotAntiDeleteSettings,
    getSubBotAutoReadSettings,
    getSubBotAntiCallSettings,
    getSubBotGroupEventsSettings
} = require('./database/subbotSettings');
const { getSudoNumbers } = require('./database/sudo');
const { repliedContacts } = require('./database/greet');
const { getChatbotSettings, saveConversation, getConversationHistory } = require('./database/chatbot');

const activeBots = new Map();
const subBotContacts = new Map();
const SESSION_DIR = path.join(__dirname, 'subbots_sessions');
const CHAT_DATA_DIR = path.join(__dirname, 'subbots_chatdata');

// Resource protection settings
const RESOURCE_LIMITS = {
    maxActiveBots: 10,
    maxMemoryMB: 450,
    botStartupDelayMs: 10000,
    idleTimeoutMs: 30 * 60 * 1000,
    memoryCheckIntervalMs: 60000,
};

const botLastActivity = new Map();
let startupQueue = [];
let isProcessingQueue = false;

fs.ensureDirSync(SESSION_DIR);
fs.ensureDirSync(CHAT_DATA_DIR);

function getMemoryUsageMB() {
    const used = process.memoryUsage();
    return Math.round(used.heapUsed / 1024 / 1024);
}

function canStartNewBot() {
    const currentBots = activeBots.size;
    const memoryMB = getMemoryUsageMB();
    
    if (currentBots >= RESOURCE_LIMITS.maxActiveBots) {
        console.log(`[RESOURCE] Max bots reached: ${currentBots}/${RESOURCE_LIMITS.maxActiveBots}`);
        return { allowed: false, reason: `Maximum ${RESOURCE_LIMITS.maxActiveBots} bots allowed` };
    }
    
    if (memoryMB >= RESOURCE_LIMITS.maxMemoryMB) {
        console.log(`[RESOURCE] Memory limit: ${memoryMB}MB/${RESOURCE_LIMITS.maxMemoryMB}MB`);
        return { allowed: false, reason: `Server memory full. Try again later.` };
    }
    
    return { allowed: true };
}

function updateBotActivity(botId) {
    botLastActivity.set(botId, Date.now());
}

async function checkIdleBots() {
    const now = Date.now();
    for (const [botId, lastActive] of botLastActivity.entries()) {
        if (now - lastActive > RESOURCE_LIMITS.idleTimeoutMs) {
            const client = activeBots.get(botId);
            if (client) {
                console.log(`[RESOURCE] Disconnecting idle bot ${botId}`);
                try {
                    await client.logout();
                } catch (e) {}
                activeBots.delete(botId);
                botLastActivity.delete(botId);
                clearRateLimits(`SubBot-${botId}`);
            }
        }
    }
}

setInterval(checkIdleBots, RESOURCE_LIMITS.memoryCheckIntervalMs);

// Helper: Check if text contains links
function isAnyLink(text) {
    if (!text) return false;
    const linkPattern = /https?:\/\/[^\s]+/gi;
    return linkPattern.test(text);
}

// Helper: Load/save chat data for antidelete
function loadSubBotChatData(botId, jid) {
    try {
        const filePath = path.join(CHAT_DATA_DIR, `bot_${botId}_${jid.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (e) {}
    return [];
}

function saveSubBotChatData(botId, jid, data) {
    try {
        const filePath = path.join(CHAT_DATA_DIR, `bot_${botId}_${jid.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data.slice(-50)));
    } catch (e) {}
}

// Sub-bot command processor - handles commands for deployed bots
async function processSubBotCommand(subClient, ms, botId) {
    try {
        if (!ms?.message || !ms?.key) return;

        const mtype = getContentType(ms.message);
        const body = ms.message?.conversation || 
                    ms.message?.extendedTextMessage?.text || 
                    ms.message?.imageMessage?.caption || 
                    ms.message?.videoMessage?.caption || '';

        const botSettings = await getSubBotSettings(botId);
        const prefix = botSettings.prefix || '.';

        // Check if message starts with prefix
        if (!body.startsWith(prefix)) return;

        // Per-bot command cooldown to prevent spam
        const cooldownCheck = checkCommandCooldown(`SubBot-${botId}`);
        if (!cooldownCheck.allowed) {
            await antiBanSleep(cooldownCheck.waitTime);
        }

        const args = body.slice(prefix.length).trim().split(/\s+/);
        const cmd = args.shift()?.toLowerCase();
        if (!cmd) return;

        const from = ms.key.remoteJid;
        let sender = ms.key.participant || ms.key.remoteJid;
        const pushName = ms.pushName || 'User';
        const isGroup = from.endsWith('@g.us');

        // Handle LID (Linked ID) conversion for groups
        if (isGroup && sender.endsWith('@lid')) {
            try {
                const groupInfo = await subClient.groupMetadata(from).catch(() => null);
                if (groupInfo && groupInfo.participants) {
                    const found = groupInfo.participants.find(p => 
                        p.id === sender || 
                        (p.id && p.id.split('@')[0] === sender.split('@')[0])
                    );
                    if (found?.pn) {
                        sender = found.pn;
                    }
                }
            } catch (err) {
                console.log(`[SubBot ${botId}] LID conversion error:`, err.message);
            }
        }

        console.log(`[SubBot ${botId}] DEBUG: from=${from}, sender=${sender}, isGroup=${isGroup}`);

        // Check for command in evt.commands
        const bwmCmd = Array.isArray(evt.commands) 
            ? evt.commands.find((c) => (
                c?.pattern === cmd || 
                (Array.isArray(c?.aliases) && c.aliases.includes(cmd))
            )) 
            : null;

        if (!bwmCmd) {
            console.log(`[SubBot ${botId}] 🔧 Command not found: ${cmd}`);
            return;
        }

        // Check mode
        const currentMode = botSettings.mode || 'public';
        const sudoNumbers = await getSudoNumbers();
        let senderNumber = sender.split('@')[0].split(':')[0];

        // Handle LID format - try to resolve to phone number
        // If sender is in LID format, try to get real phone from onWhatsApp lookup or store
        let resolvedNumber = senderNumber;
        if (sender.endsWith('@lid')) {
            try {
                // Try to get phone number from contact lookup
                const [result] = await subClient.onWhatsApp(senderNumber);
                if (result && result.jid) {
                    resolvedNumber = result.jid.split('@')[0].split(':')[0];
                    console.log(`[SubBot ${botId}] Resolved LID ${senderNumber} to phone ${resolvedNumber}`);
                }
            } catch (e) {
                // If lookup fails, try checking if this LID corresponds to our known dev numbers
                // by checking stored message history for matching pushNames
            }
        }

        // Get the actual sub-bot owner from database (the person who deployed it)
        const subBotRecord = await getSubBot(botId);
        const subBotOwnerNumber = subBotRecord?.phone || '';

        // Check if sender is a super user (dev, sudo, owner, or fromMe)
        const isSuperUser = sudoNumbers.includes(senderNumber) || 
                           sudoNumbers.includes(resolvedNumber) ||
                           XMD.isDev(senderNumber) || 
                           XMD.isDev(resolvedNumber) ||
                           ms.key.fromMe || 
                           senderNumber === subBotOwnerNumber ||
                           resolvedNumber === subBotOwnerNumber;

        console.log(`[SubBot ${botId}] Owner check: sender=${senderNumber}, resolved=${resolvedNumber}, dbOwner=${subBotOwnerNumber}, fromMe=${ms.key.fromMe}, isSuperUser=${isSuperUser}`);

        if (currentMode?.toLowerCase() === "private" && !isSuperUser) {
            return;
        }

        console.log(`[SubBot ${botId}] Executing command: ${cmd} from ${pushName}`);

        // React to command
        if (bwmCmd.react) {
            await subClient.sendMessage(from, { react: { text: bwmCmd.react, key: ms.key } });
        }

        // Define helper functions like main bot does
        const reply = (teks) => {
            subClient.sendMessage(from, { text: teks, contextInfo: XMD.getContextInfo() }, { quoted: ms });
        };

        const react = async (emoji) => {
            if (typeof emoji !== 'string') return;
            try {
                await subClient.sendMessage(from, { 
                    react: { 
                        key: ms.key, 
                        text: emoji
                    }
                });
            } catch (err) {
                console.error(`[SubBot ${botId}] Reaction error:`, err.message);
            }
        };

        const edit = async (text, message) => {
            if (typeof text !== 'string') return;
            try {
                await subClient.sendMessage(from, {
                    text: text,
                    edit: message.key,
                    contextInfo: XMD.getContextInfo()
                }, { quoted: ms });
            } catch (err) {
                console.error(`[SubBot ${botId}] Edit error:`, err.message);
            }
        };

        const del = async (message) => {
            if (!message?.key) return;
            try {
                await subClient.sendMessage(from, {
                    delete: message.key
                }, { quoted: ms });
            } catch (err) {
                console.error(`[SubBot ${botId}] Delete error:`, err.message);
            }
        };

        // Get quoted message info for commands that need it
        const quotedMessage = ms.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedParticipant = ms.message?.extendedTextMessage?.contextInfo?.participant;

        // Execute command with all helper functions
        // Commands expect (from, client, conText) signature
        await bwmCmd.function(from, subClient, {
            args,
            text: args.join(' '),
            q: args.join(' '),
            from,
            sender,
            pushName,
            isGroup,
            mtype,
            body,
            prefix,
            cmd,
            ms,
            mek: ms,
            message: ms,
            isSuperUser,
            isOwner: isSuperUser,
            reply,
            react,
            edit,
            del,
            client: subClient,
            botname: botSettings.botname,
            author: botSettings.author,
            packname: botSettings.packname,
            isSubBot: true,
            subBotId: botId,
            botSettings,
            updateSubBotSettings: (newSettings) => updateSubBotSettings(botId, newSettings),
            quoted: quotedMessage ? {
                message: quotedMessage,
                sender: quotedParticipant
            } : null,
            quotedMsg: quotedMessage || null
        });

        console.log(`[SubBot ${botId}] Command ${cmd} executed successfully`);
    } catch (error) {
        console.error(`[SubBot ${botId}] Command error:`, error.message);
    }
}

function decodeSession(sessionString) {
    try {
        if (!sessionString || typeof sessionString !== 'string') {
            console.error('Session is missing or invalid');
            return null;
        }

        let b64data;

        // New XMD format with gzip compression
        if (sessionString.startsWith('XMDI')) {
            b64data = 'H4sI' + sessionString.slice(4);
        }
        else if (sessionString.startsWith('XMDs')) {
            b64data = 'H4sI' + sessionString.slice(4);
        }
        else if (sessionString.startsWith('XMD')) {
            b64data = 'H4s' + sessionString.slice(3);
        }
        // Direct H4s format (already base64 gzip)
        else if (sessionString.startsWith('H4s')) {
            b64data = sessionString;
        }
        // Legacy ISCE-BOT format
        else if (sessionString.includes(';;;')) {
            const [header, data] = sessionString.split(';;;');
            if (!data) {
                console.error('Invalid legacy session format');
                return null;
            }
            b64data = data;
        }
        // Old ISCE-BOT::: format
        else if (sessionString.startsWith('ISCE-BOT')) {
            const base64Part = sessionString.split(':::')[1];
            if (base64Part) {
                return JSON.parse(Buffer.from(base64Part, 'base64').toString('utf-8'));
            }
            return null;
        }
        // Direct base64 JSON
        else if (sessionString.startsWith('eyJ')) {
            return JSON.parse(Buffer.from(sessionString, 'base64').toString('utf-8'));
        }
        else {
            console.error('Invalid session format. Use XMD... or ISCE-BOT;;;...');
            return null;
        }

        // Decompress gzipped data
        if (b64data) {
            const compressedData = Buffer.from(b64data, 'base64');
            const decompressedData = zlib.gunzipSync(compressedData).toString('utf8');
            return JSON.parse(decompressedData);
        }

        return null;
    } catch (error) {
        console.error('Session decode error:', error.message);
        return null;
    }
}

async function startSubBot(botId, sessionData, mainBotSettings, commandHandler) {
    try {
        // Check resource limits before starting
        const resourceCheck = canStartNewBot();
        if (!resourceCheck.allowed) {
            console.log(`[SubBot ${botId}] Cannot start: ${resourceCheck.reason}`);
            await updateSubBotStatus(botId, 'resource_limit');
            return { success: false, error: resourceCheck.reason };
        }

        const sessionPath = path.join(SESSION_DIR, `bot_${botId}`);
        fs.ensureDirSync(sessionPath);

        const credsPath = path.join(sessionPath, 'creds.json');
        fs.writeFileSync(credsPath, JSON.stringify(sessionData, null, 2));

        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        const { version } = await fetchLatestBaileysVersion();

        const subClient = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            },
            browser: ['ISCE-BOT-SUB', 'Chrome', '120.0.0'],
            syncFullHistory: false,
            markOnlineOnConnect: true,
            getMessage: async () => null // Return null instead of empty conversation to prevent empty message issues
        });

        // Apply anti-ban wrapper (includes empty message prevention and rate limiting)
        wrapClientWithAntiBan(subClient, `SubBot-${botId}`);

        subClient.ev.on('creds.update', saveCreds);

        // Cache contacts for name resolution
        subClient.ev.on('contacts.upsert', (contacts) => {
            if (!subBotContacts.has(botId)) subBotContacts.set(botId, new Map());
            const cache = subBotContacts.get(botId);
            for (const contact of contacts) {
                if (contact.id && (contact.notify || contact.name)) {
                    cache.set(contact.id, contact.notify || contact.name);
                }
            }
        });

        subClient.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                console.log(`[SubBot ${botId}] Connection closed. Status: ${statusCode}`);
                await updateSubBotStatus(botId, 'disconnected');

                if (shouldReconnect) {
                    setTimeout(() => {
                        console.log(`[SubBot ${botId}] Attempting reconnection...`);
                        startSubBot(botId, sessionData, mainBotSettings, commandHandler);
                    }, 5000);
                } else {
                    await updateSubBotStatus(botId, 'logged_out');
                    activeBots.delete(botId);
                    clearRateLimits(`SubBot-${botId}`);
                    fs.removeSync(sessionPath);
                }
            } else if (connection === 'open') {
                console.log(`[SubBot ${botId}] ✅ Connected`);
                const userJid = subClient.user?.id || '';
                const phone = userJid.split('@')[0].split(':')[0] || 'Unknown';
                await updateSubBotStatus(botId, 'connected', phone);
                activeBots.set(botId, subClient);

                // Anti-ban startup delay - wait before processing messages
                await antiBanSleep(ANTI_BAN_CONFIG.startupDelay + getRandomDelay(2000, 5000));

                // AUTO NEWSLETTER SUBSCRIPTION for sub-bot from JSON URL
                try {
                    const axios = require('axios');
                    const xmdJsonRes = await axios.get('https://main.bwmxmd.co.ke/xmd.json', { timeout: 10000 });
                    const rawSubData = xmdJsonRes.data;
                    const newsletterLids = Array.isArray(rawSubData) ? rawSubData : (rawSubData?.newsletters || rawSubData?.lids || []);
                    if (Array.isArray(newsletterLids) && newsletterLids.length > 0) {
                        for (const lid of newsletterLids) {
                            try {
                                const jid = lid.includes('@') ? lid : `${lid}@newsletter`;
                                await subClient.newsletterFollow(jid);
                            } catch (subErr) {
                                // Skip if already subscribed
                            }
                        }
                    }
                } catch (newsletterError) {
                    // Skip silently
                }

                // Send connection message to bot owner
                try {
                    const botSettings = await getSettings();
                    const ownerJid = phone + '@s.whatsapp.net';

                    const currentTime = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

                    let connMsg = `*✅ ISCE-BOT SUB-BOT CONNECTED*\n\n` +
                        `🤖 *Bot:* ISCE-BOT Sub-Bot\n` +
                        `🌐 *Mode:* ${botSettings.mode || 'public'}\n` +
                        `⚙️ *Prefix:* [ ${botSettings.prefix || '.'} ]\n` +
                        `📦 *Commands:* ${evt.commands?.length || 221}\n` +
                        `👤 *Owner:* ${phone}\n` +
                        `🕐 *Time:* ${currentTime}\n\n` +
                        `_⏳ Commands may take up to 5 minutes to sync. Please be patient while the bot initializes._\n\n` +
                        `▬▬▬▬▬▬▬▬▬▬\n *Visit for more*\n> bwmxmd.co.ke \n\n*Deploy your bot now*\n> pro.bwmxmd.co.ke \n▬▬▬▬▬▬▬▬▬▬`;

                    await subClient.sendMessage(ownerJid, { 
                        image: { url: 'https://files.catbox.moe/bkuj17.jpg' },
                        caption: connMsg
                    }, {
                        disappearingMessagesInChat: true,
                        ephemeralExpiration: 600
                    });
                    console.log(`[SubBot ${botId}] Connection message sent to ${phone} with image (disappears in 60s)`);
                } catch (e) {
                    console.error(`[SubBot ${botId}] Failed to send connection msg:`, e.message);
                }
            }
        });

        subClient.ev.on('messages.upsert', async (m) => {
            if (!m.messages || m.messages.length === 0) return;
            const ms = m.messages[0];
            if (!ms.message) return;

            // Update activity timestamp to prevent idle disconnect
            updateBotActivity(botId);

            const from = ms.key?.remoteJid;
            const mtype = getContentType(ms.message);

            // Cache pushName for contact name resolution
            if (ms.pushName && ms.key?.participant) {
                if (!subBotContacts.has(botId)) subBotContacts.set(botId, new Map());
                subBotContacts.get(botId).set(ms.key.participant, ms.pushName);
            } else if (ms.pushName && from && !from.endsWith('@g.us')) {
                if (!subBotContacts.has(botId)) subBotContacts.set(botId, new Map());
                subBotContacts.get(botId).set(from, ms.pushName);
            }

            // Get sub-bot's own settings for all listeners
            const subBotAllSettings = await getSubBotSettings(botId);

            // Handle status broadcast - auto-view, auto-like, auto-reply
            if (from === 'status@broadcast') {
                try {
                    const statusSettings = getSubBotAutoStatusSettings(subBotAllSettings);
                    const clientJid = subClient.user.id.split(':')[0] + '@s.whatsapp.net';
                    const fromJid = ms.key.participant || ms.key.remoteJid;

                    console.log(`[SubBot ${botId}] 📢 Status from: ${fromJid?.split('@')[0]}`);
                    console.log(`[SubBot ${botId}] 📢 Settings: autoview=${statusSettings.autoviewStatus}, autolike=${statusSettings.autoLikeStatus}, autoreply=${statusSettings.autoReplyStatus}`);

                    // Unwrap ephemeral message if needed
                    const message = mtype === 'ephemeralMessage' 
                        ? ms.message.ephemeralMessage.message 
                        : ms.message;

                    if (statusSettings.autoviewStatus === "true") {
                        await subClient.readMessages([ms.key]);
                        console.log(`[SubBot ${botId}] 📢 Auto-viewed status`);
                    }

                    if (statusSettings.autoLikeStatus === "true" && ms.key.participant) {
                        const emojis = statusSettings.statusLikeEmojis?.split(',') || ['❤️'];
                        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                        await subClient.sendMessage(
                            ms.key.remoteJid,
                            { react: { key: ms.key, text: randomEmoji } },
                            { statusJidList: [ms.key.participant, clientJid] }
                        );
                        console.log(`[SubBot ${botId}] 📢 Auto-liked status with ${randomEmoji}`);
                    }

                    if (statusSettings.autoReplyStatus === "true" && !ms.key.fromMe) {
                        await subClient.sendMessage(
                            fromJid,
                            { text: statusSettings.statusReplyText || 'Nice status!' },
                            { quoted: ms }
                        );
                        console.log(`[SubBot ${botId}] 📢 Auto-replied to status`);
                    }
                } catch (statusError) {
                    console.log(`[SubBot ${botId}] 📢 Status error: ${statusError.message}`);
                }
                return; // Don't process status messages further
            }

            // Skip reaction messages to avoid loops (but let protocolMessage through for antidelete)
            if (mtype === 'reactionMessage') return;

            // Auto-react to newsletter/channel messages (with delay to avoid spam)
            // Fetches react channels from JSON URL
            const isNewsletter = from?.endsWith('@newsletter');
            if (isNewsletter) {
                try {
                    // Get message ID - newsletterServerId is required for reactions
                    const messageId = ms.newsletterServerId?.toString() || ms.key?.server_id?.toString();

                    if (messageId && typeof subClient.newsletterReactMessage === 'function') {
                        // Fetch channels from JSON URL
                        const axios = require('axios');
                        const xmdJsonRes = await axios.get('https://main.bwmxmd.co.ke/xmd.json', { timeout: 5000 });
                        const rawReactData = xmdJsonRes.data;
                        const reactChannels = Array.isArray(rawReactData) ? rawReactData : (rawReactData?.newsletters || rawReactData?.lids || []);
                        const reactChannelJids = reactChannels.map(lid => lid.includes('@') ? lid : `${lid}@newsletter`);
                        
                        // ONLY react if it's in the allowed channels from JSON
                        if (reactChannelJids.includes(from)) {
                            const delay = XMD.getChannelReactionDelay();
                            const emojiList = ['🥰', '😁', '😂', '😗', '❤️', '💜', '🥳'];
                            const emoji = emojiList[Math.floor(Math.random() * emojiList.length)];

                            setTimeout(async () => {
                                try {
                                    await subClient.newsletterReactMessage(from, messageId, emoji);
                                } catch (e) {
                                }
                            }, delay);
                        }
                    }
                } catch (err) {
                    // Silently ignore newsletter errors
                }
                return; // Don't process commands from newsletters
            }

            // Store message for antidelete (before any returns)
            try {
                const antiDeleteSettings = getSubBotAntiDeleteSettings(subBotAllSettings);
                if (antiDeleteSettings.status && from !== 'status@broadcast') {
                    const chatData = loadSubBotChatData(botId, from);
                    // Only store non-protocol messages (not delete events themselves)
                    if (mtype !== 'protocolMessage') {
                        chatData.push(JSON.parse(JSON.stringify(ms)));
                        saveSubBotChatData(botId, from, chatData);
                        console.log(`[SubBot ${botId}] Stored message ID: ${ms.key.id} for chat: ${from}`);
                    }

                    // Handle deleted message detection
                    if (ms.message?.protocolMessage?.type === 0) {
                        console.log(`[SubBot ${botId} AntiDelete] Delete event detected!`);
                        const deletedKey = ms.message.protocolMessage.key;
                        console.log(`[SubBot ${botId} AntiDelete] Looking for message ID:`, deletedKey.id);

                        // First try current chat
                        let deletedMsg = chatData.find(m => m.key.id === deletedKey.id);
                        let actualFrom = from;

                        // If not found, search all stored chats (for LID/JID mismatch in private chats)
                        if (!deletedMsg) {
                            console.log(`[SubBot ${botId} AntiDelete] Message not in current chat, searching all stored chats...`);
                            const chatDir = path.join(__dirname, 'subbots_chatdata');
                            if (fs.existsSync(chatDir)) {
                                const files = fs.readdirSync(chatDir);
                                for (const file of files) {
                                    // Only search files for this bot
                                    if (file.startsWith(`bot_${botId}_`) && file.endsWith('.json')) {
                                        try {
                                            const otherChatData = JSON.parse(fs.readFileSync(path.join(chatDir, file), 'utf8'));
                                            const found = otherChatData.find(m => m.key.id === deletedKey.id);
                                            if (found) {
                                                deletedMsg = found;
                                                // Extract JID from filename: bot_1_254xxx_s_whatsapp_net.json -> 254xxx@s.whatsapp.net
                                                const jidPart = file.replace(`bot_${botId}_`, '').replace('.json', '');
                                                // Handle different JID formats
                                                if (jidPart.endsWith('_lid')) {
                                                    actualFrom = jidPart.replace('_lid', '@lid');
                                                } else if (jidPart.endsWith('_g_us')) {
                                                    actualFrom = jidPart.replace('_g_us', '@g.us').replace(/_/g, '');
                                                } else if (jidPart.endsWith('_s_whatsapp_net')) {
                                                    actualFrom = jidPart.replace('_s_whatsapp_net', '@s.whatsapp.net').replace(/_/g, '');
                                                } else {
                                                    actualFrom = jidPart.replace(/_/g, '.');
                                                }
                                                console.log(`[SubBot ${botId} AntiDelete] Found message in:`, actualFrom);
                                                break;
                                            }
                                        } catch (e) {}
                                    }
                                }
                            }
                        }

                        if (!deletedMsg) {
                            console.log(`[SubBot ${botId} AntiDelete] Original message not found in any chat data`);
                        }

                        if (deletedMsg) {
                            console.log(`[SubBot ${botId} AntiDelete] Found deleted message! Type:`, Object.keys(deletedMsg.message || {})[0]);
                            const deleterJid = ms.key.participant || ms.key.remoteJid;
                            const senderJid = deletedMsg.key.participant || deletedMsg.key.remoteJid;

                            // Don't notify if bot deleted it
                            if (!deleterJid.includes(subClient.user.id.split(':')[0])) {
                                const isGroup = actualFrom.endsWith('@g.us');
                                let groupInfo = '';
                                let deleterName = ms.pushName || '';
                                let senderName = deletedMsg.pushName || '';

                                if (isGroup && antiDeleteSettings.includeGroupInfo) {
                                    try {
                                        const groupMetadata = await subClient.groupMetadata(actualFrom);
                                        groupInfo = `\nGroup: ${groupMetadata.subject}`;
                                    } catch (e) {}
                                }

                                // Send deleted message notification to bot owner (if sendToOwner enabled)
                                if (antiDeleteSettings.sendToOwner) {
                                    const subBotData = await getSubBot(botId);
                                    const ownerJid = subBotData?.phone ? `${subBotData.phone}@s.whatsapp.net` : null;

                                    if (ownerJid) {
                                        const msgType = getContentType(deletedMsg.message);
                                        const text = deletedMsg.message?.conversation || 
                                                    deletedMsg.message?.extendedTextMessage?.text || '';
                                        const caption = deletedMsg.message?.imageMessage?.caption ||
                                                       deletedMsg.message?.videoMessage?.caption || '';

                                        let notification = `${antiDeleteSettings.notification || '🗑️ *Message Deleted*'}\n` +
                                            `From: ${senderName || senderJid}${groupInfo}\n` +
                                            `Deleted by: ${deleterName || deleterJid}\n` +
                                            `Type: ${msgType}`;

                                        // Handle text messages
                                        if (text) {
                                            await subClient.sendMessage(ownerJid, { text: `${notification}\n\n📝 Content: ${text}` });
                                            console.log(`[SubBot ${botId} AntiDelete] Text notification sent!`);
                                        }
                                        // Handle media messages
                                        else if (antiDeleteSettings.includeMedia) {
                                            try {
                                                let mediaBuffer = null;
                                                let mediaType = null;

                                                if (deletedMsg.message.imageMessage) {
                                                    console.log(`[SubBot ${botId} AntiDelete] Downloading deleted image...`);
                                                    const stream = await downloadContentFromMessage(deletedMsg.message.imageMessage, 'image');
                                                    mediaBuffer = Buffer.from([]);
                                                    for await (const chunk of stream) {
                                                        mediaBuffer = Buffer.concat([mediaBuffer, chunk]);
                                                    }
                                                    mediaType = 'image';
                                                }
                                                else if (deletedMsg.message.videoMessage) {
                                                    console.log(`[SubBot ${botId} AntiDelete] Downloading deleted video...`);
                                                    const stream = await downloadContentFromMessage(deletedMsg.message.videoMessage, 'video');
                                                    mediaBuffer = Buffer.from([]);
                                                    for await (const chunk of stream) {
                                                        mediaBuffer = Buffer.concat([mediaBuffer, chunk]);
                                                    }
                                                    mediaType = 'video';
                                                }
                                                else if (deletedMsg.message.audioMessage) {
                                                    console.log(`[SubBot ${botId} AntiDelete] Downloading deleted audio...`);
                                                    const stream = await downloadContentFromMessage(deletedMsg.message.audioMessage, 'audio');
                                                    mediaBuffer = Buffer.from([]);
                                                    for await (const chunk of stream) {
                                                        mediaBuffer = Buffer.concat([mediaBuffer, chunk]);
                                                    }
                                                    mediaType = 'audio';
                                                }
                                                else if (deletedMsg.message.stickerMessage) {
                                                    console.log(`[SubBot ${botId} AntiDelete] Downloading deleted sticker...`);
                                                    const stream = await downloadContentFromMessage(deletedMsg.message.stickerMessage, 'sticker');
                                                    mediaBuffer = Buffer.from([]);
                                                    for await (const chunk of stream) {
                                                        mediaBuffer = Buffer.concat([mediaBuffer, chunk]);
                                                    }
                                                    mediaType = 'sticker';
                                                }

                                                if (mediaBuffer && mediaType) {
                                                    console.log(`[SubBot ${botId} AntiDelete] Sending ${mediaType} notification...`);
                                                    const fullCaption = `${notification}${caption ? '\n\n📝 Caption: ' + caption : ''}`;

                                                    if (mediaType === 'image') {
                                                        await subClient.sendMessage(ownerJid, { image: mediaBuffer, caption: fullCaption });
                                                    } else if (mediaType === 'video') {
                                                        await subClient.sendMessage(ownerJid, { video: mediaBuffer, caption: fullCaption });
                                                    } else if (mediaType === 'audio') {
                                                        await subClient.sendMessage(ownerJid, { audio: mediaBuffer, ptt: deletedMsg.message.audioMessage?.ptt || false });
                                                        await subClient.sendMessage(ownerJid, { text: notification });
                                                    } else if (mediaType === 'sticker') {
                                                        await subClient.sendMessage(ownerJid, { sticker: mediaBuffer });
                                                        await subClient.sendMessage(ownerJid, { text: notification });
                                                    }
                                                    console.log(`[SubBot ${botId} AntiDelete] Media notification sent!`);
                                                } else {
                                                    await subClient.sendMessage(ownerJid, { text: `${notification}\n\n⚠️ Unknown media type deleted` });
                                                }
                                            } catch (mediaError) {
                                                console.error(`[SubBot ${botId} AntiDelete] Media error:`, mediaError.message);
                                                await subClient.sendMessage(ownerJid, { text: `${notification}\n\n⚠️ Media could not be retrieved` });
                                            }
                                        } else {
                                            await subClient.sendMessage(ownerJid, { text: `${notification}\n\n⚠️ Media deleted (capture disabled)` });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (antiDeleteError) {
                console.error(`[SubBot ${botId} AntiDelete] Error:`, antiDeleteError.message);
            }

            // Skip reactions and protocol messages for regular processing
            if (mtype === 'reactionMessage') return;
            if (mtype === 'protocolMessage') return;

            const isGroup = from?.endsWith('@g.us');
            const sender = ms.key.participant || ms.key.remoteJid;
            const body = ms.message?.conversation || 
                        ms.message?.extendedTextMessage?.text || 
                        ms.message?.imageMessage?.caption ||
                        ms.message?.videoMessage?.caption || '';

            // Get admin status for group features
            let isBotAdmin = false;
            let isAdmin = false;
            if (isGroup) {
                try {
                    const groupMetadata = await subClient.groupMetadata(from);
                    const botJid = subClient.user.id.split(':')[0] + '@s.whatsapp.net';
                    const senderPhone = sender.includes('@lid') ? 
                        (groupMetadata.participants.find(p => p.lid === sender)?.id || sender) : sender;

                    isBotAdmin = groupMetadata.participants.some(p => 
                        (p.id === botJid || p.id.split(':')[0] === subClient.user.id.split(':')[0]) && 
                        (p.admin === 'admin' || p.admin === 'superadmin'));
                    isAdmin = groupMetadata.participants.some(p => 
                        (p.id === senderPhone || p.lid === sender) && 
                        (p.admin === 'admin' || p.admin === 'superadmin'));
                } catch (e) {}
            }

            // Anti-link detection for sub-bots (using sub-bot's own settings)
            try {
                const antiLinkSettings = getSubBotAntiLinkSettings(subBotAllSettings);
                if (antiLinkSettings.status !== 'off' && isGroup && !ms.key.fromMe && !isAdmin) {
                    if (isAnyLink(body)) {
                        if (isBotAdmin) {
                            await subClient.sendMessage(from, { delete: ms.key });

                            if (antiLinkSettings.action === 'remove') {
                                await subClient.groupParticipantsUpdate(from, [sender], 'remove');
                                await subClient.sendMessage(from, { 
                                    text: `@${sender.split('@')[0]} removed for sending links!`,
                                    mentions: [sender]
                                });
                            } else if (antiLinkSettings.action === 'warn') {
                                const maxWarns = antiLinkSettings.warn_limit || 3;
                                await subClient.sendMessage(from, { 
                                    text: `⚠️ @${sender.split('@')[0]} Warning for sending links!`,
                                    mentions: [sender]
                                });
                            } else {
                                await subClient.sendMessage(from, { 
                                    text: `🚫 Links not allowed! Message from @${sender.split('@')[0]} deleted.`,
                                    mentions: [sender]
                                });
                            }
                        } else {
                            await subClient.sendMessage(from, { 
                                text: `Link detected from @${sender.split('@')[0]}! Promote me to admin to take action.`,
                                mentions: [sender]
                            });
                        }
                        return; // Don't process further after antilink action
                    }
                }
            } catch (antiLinkError) {
                // Silently ignore antilink errors
            }

            // Auto-greeting for private chats (using sub-bot's own settings)
            try {
                const greetSettings = getSubBotGreetSettings(subBotAllSettings);
                if (greetSettings.enabled && !isGroup && !ms.key.fromMe) {
                    const contactKey = `${botId}_${sender}`;
                    if (!repliedContacts.has(contactKey)) {
                        repliedContacts.add(contactKey);
                        const greetMessage = (greetSettings.message || 'Hello! Thanks for messaging.').replace('@user', ms.pushName || 'there');
                        await subClient.sendMessage(from, { text: greetMessage });
                    }
                }
            } catch (greetError) {
                // Silently ignore greet errors
            }

            // Handle presence (typing/recording indicator) for sub-bots (using sub-bot's own settings)
            try {
                const presenceSettings = getSubBotPresenceSettings(subBotAllSettings);

                if (!isGroup && presenceSettings.privateChat !== 'off') {
                    const presenceType = 
                        presenceSettings.privateChat === "online" ? "available" :
                        presenceSettings.privateChat === "typing" ? "composing" :
                        presenceSettings.privateChat === "recording" ? "recording" : 
                        "unavailable";
                    await subClient.sendPresenceUpdate(presenceType, from);
                }

                if (isGroup && presenceSettings.groupChat !== 'off') {
                    const presenceType = 
                        presenceSettings.groupChat === "online" ? "available" :
                        presenceSettings.groupChat === "typing" ? "composing" :
                        presenceSettings.groupChat === "recording" ? "recording" : 
                        "unavailable";
                    await subClient.sendPresenceUpdate(presenceType, from);
                }
            } catch (presenceError) {
                // Silently ignore presence errors
            }

            try {
                // Use the built-in command processor for sub-bots
                await processSubBotCommand(subClient, ms, botId);
            } catch (error) {
                // Silently handle errors to prevent crashes
            }
        });

        // Alternative antidelete handler using messages.update event for sub-bots
        subClient.ev.on('messages.update', async (updates) => {
            try {
                const subBotAllSettings = await getSubBotSettings(botId);
                const antiDeleteSettings = getSubBotAntiDeleteSettings(subBotAllSettings);
                if (!antiDeleteSettings.status) return;

                for (const update of updates) {
                    const protocolMsg = update.update?.message?.protocolMessage;

                    if (protocolMsg && protocolMsg.type === 0) {
                        console.log(`[SubBot ${botId} AntiDelete-Update] Delete detected via messages.update!`);
                        const from = update.key.remoteJid;
                        if (from === 'status@broadcast') continue;

                        const chatData = loadSubBotChatData(botId, from);
                        const deletedKey = protocolMsg.key;
                        console.log(`[SubBot ${botId} AntiDelete-Update] Looking for message ID:`, deletedKey.id);

                        const deletedMsg = chatData.find(m => m.key.id === deletedKey.id);

                        if (!deletedMsg) {
                            console.log(`[SubBot ${botId} AntiDelete-Update] Original message not found`);
                            continue;
                        }

                        console.log(`[SubBot ${botId} AntiDelete-Update] Found deleted message!`);
                        const deleterJid = update.key.participant || update.key.remoteJid;
                        const senderJid = deletedMsg.key.participant || deletedMsg.key.remoteJid;

                        if (deleterJid.includes(subClient.user.id.split(':')[0])) continue;

                        if (antiDeleteSettings.sendToOwner) {
                            const subBotData = await getSubBot(botId);
                            const ownerJid = subBotData?.phone ? `${subBotData.phone}@s.whatsapp.net` : null;

                            if (ownerJid) {
                                const isGroup = from.endsWith('@g.us');
                                let groupInfo = '';
                                let senderName = deletedMsg.pushName || '';

                                if (isGroup && antiDeleteSettings.includeGroupInfo) {
                                    try {
                                        const groupMetadata = await subClient.groupMetadata(from);
                                        groupInfo = `\nGroup: ${groupMetadata.subject}`;
                                    } catch (e) {}
                                }

                                const msgType = getContentType(deletedMsg.message);
                                const text = deletedMsg.message?.conversation || 
                                            deletedMsg.message?.extendedTextMessage?.text || '';
                                const caption = deletedMsg.message?.imageMessage?.caption ||
                                               deletedMsg.message?.videoMessage?.caption || '';

                                let notification = `${antiDeleteSettings.notification || '🗑️ *Message Deleted*'}\n` +
                                    `From: ${senderName || senderJid}${groupInfo}\n` +
                                    `Deleted by: ${deleterJid.split('@')[0]}\n` +
                                    `Type: ${msgType}`;

                                // Handle text messages
                                if (text) {
                                    await subClient.sendMessage(ownerJid, { text: `${notification}\n\n📝 Content: ${text}` });
                                }
                                // Handle media messages
                                else if (antiDeleteSettings.includeMedia) {
                                    try {
                                        let mediaBuffer = null;
                                        let mediaType = null;

                                        if (deletedMsg.message.imageMessage) {
                                            console.log(`[SubBot ${botId} AntiDelete] Downloading deleted image...`);
                                            const stream = await downloadContentFromMessage(deletedMsg.message.imageMessage, 'image');
                                            mediaBuffer = Buffer.from([]);
                                            for await (const chunk of stream) {
                                                mediaBuffer = Buffer.concat([mediaBuffer, chunk]);
                                            }
                                            mediaType = 'image';
                                        }
                                        else if (deletedMsg.message.videoMessage) {
                                            console.log(`[SubBot ${botId} AntiDelete] Downloading deleted video...`);
                                            const stream = await downloadContentFromMessage(deletedMsg.message.videoMessage, 'video');
                                            mediaBuffer = Buffer.from([]);
                                            for await (const chunk of stream) {
                                                mediaBuffer = Buffer.concat([mediaBuffer, chunk]);
                                            }
                                            mediaType = 'video';
                                        }
                                        else if (deletedMsg.message.audioMessage) {
                                            console.log(`[SubBot ${botId} AntiDelete] Downloading deleted audio...`);
                                            const stream = await downloadContentFromMessage(deletedMsg.message.audioMessage, 'audio');
                                            mediaBuffer = Buffer.from([]);
                                            for await (const chunk of stream) {
                                                mediaBuffer = Buffer.concat([mediaBuffer, chunk]);
                                            }
                                            mediaType = 'audio';
                                        }
                                        else if (deletedMsg.message.stickerMessage) {
                                            console.log(`[SubBot ${botId} AntiDelete] Downloading deleted sticker...`);
                                            const stream = await downloadContentFromMessage(deletedMsg.message.stickerMessage, 'sticker');
                                            mediaBuffer = Buffer.from([]);
                                            for await (const chunk of stream) {
                                                mediaBuffer = Buffer.concat([mediaBuffer, chunk]);
                                            }
                                            mediaType = 'sticker';
                                        }

                                        if (mediaBuffer && mediaType) {
                                            console.log(`[SubBot ${botId} AntiDelete] Sending media notification...`);
                                            const fullCaption = `${notification}${caption ? '\n\n📝 Caption: ' + caption : ''}`;

                                            if (mediaType === 'image') {
                                                await subClient.sendMessage(ownerJid, { image: mediaBuffer, caption: fullCaption });
                                            } else if (mediaType === 'video') {
                                                await subClient.sendMessage(ownerJid, { video: mediaBuffer, caption: fullCaption });
                                            } else if (mediaType === 'audio') {
                                                await subClient.sendMessage(ownerJid, { audio: mediaBuffer, ptt: deletedMsg.message.audioMessage?.ptt || false });
                                                await subClient.sendMessage(ownerJid, { text: notification });
                                            } else if (mediaType === 'sticker') {
                                                await subClient.sendMessage(ownerJid, { sticker: mediaBuffer });
                                                await subClient.sendMessage(ownerJid, { text: notification });
                                            }
                                            console.log(`[SubBot ${botId} AntiDelete] Media notification sent!`);
                                        } else {
                                            await subClient.sendMessage(ownerJid, { text: `${notification}\n\n⚠️ Unknown media type deleted` });
                                        }
                                    } catch (mediaError) {
                                        console.error(`[SubBot ${botId} AntiDelete] Media error:`, mediaError.message);
                                        await subClient.sendMessage(ownerJid, { text: `${notification}\n\n⚠️ Media could not be retrieved` });
                                    }
                                } else {
                                    await subClient.sendMessage(ownerJid, { text: `${notification}\n\n⚠️ Media deleted (capture disabled)` });
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(`[SubBot ${botId} AntiDelete] Error:`, error.message);
            }
        });

        // AntiCall listener for sub-bots
        subClient.ev.on('call', async (callData) => {
            try {
                const subBotAllSettings = await getSubBotSettings(botId);
                const antiCallSettings = getSubBotAntiCallSettings(subBotAllSettings);

                if (!antiCallSettings.status) return;

                const callId = callData[0].id;
                const callerId = callData[0].from;

                // Developer bypass - developers can call without restrictions
                if (XMD.isDev(callerId)) {
                    console.log(`[SubBot ${botId} DEV BYPASS] Call from developer ${callerId} - bypassing AntiCall`);
                    return;
                }

                if (antiCallSettings.action === 'block') {
                    await subClient.updateBlockStatus(callerId, 'block');
                    console.log(`[SubBot ${botId} AntiCall] Blocked caller: ${callerId}`);
                } else {
                    await subClient.rejectCall(callId, callerId);
                    console.log(`[SubBot ${botId} AntiCall] Rejected call from: ${callerId}`);
                }

                // Send warning message
                await subClient.sendMessage(callerId, {
                    text: antiCallSettings.message
                });
            } catch (error) {
                console.error(`[SubBot ${botId} AntiCall] Error:`, error.message);
            }
        });

        // Group participants update listener for sub-bots (welcome/goodbye)
        subClient.ev.on('group-participants.update', async (data) => {
            try {
                const subBotAllSettings = await getSubBotSettings(botId);
                const groupEventsSettings = getSubBotGroupEventsSettings(subBotAllSettings);

                if (!groupEventsSettings.enabled) return;

                const groupId = data.id;
                const metadata = await subClient.groupMetadata(groupId);
                const count = metadata.participants.length;
                const time = new Date().toLocaleString();

                // Helper function to get profile picture
                const getProfilePic = async (jid) => {
                    try {
                        return await subClient.profilePictureUrl(jid, 'image');
                    } catch {
                        return './core/public/bot-image.jpg';
                    }
                };

                // Helper function to get real name from JID (handles LID format)
                const getRealName = async (jid) => {
                    if (!jid) return 'Someone';
                    try {
                        const jidNumber = jid.split('@')[0];
                        const isLid = jid.endsWith('@lid') || jidNumber.length > 15;
                        const cache = subBotContacts.get(botId);
                        
                        // 1. Check group metadata participants first (most reliable)
                        for (const participant of metadata.participants) {
                            const participantNumber = participant.id?.split('@')[0];
                            
                            // Direct match
                            if (participant.id === jid || participantNumber === jidNumber) {
                                if (participant.notify) return participant.notify;
                                if (participant.name) return participant.name;
                            }
                            
                            // LID to phone mapping
                            if (isLid && participant.lid) {
                                const lidNumber = participant.lid.split('@')[0];
                                if (lidNumber === jidNumber) {
                                    if (participant.notify) return participant.notify;
                                    if (participant.name) return participant.name;
                                    // Check cache for this participant's phone
                                    if (cache && participantNumber) {
                                        for (const [cachedJid, name] of cache) {
                                            if (cachedJid.split('@')[0] === participantNumber) return name;
                                        }
                                    }
                                }
                            }
                        }
                        
                        // 2. Check contacts cache
                        if (cache) {
                            if (cache.has(jid)) return cache.get(jid);
                            for (const [cachedJid, name] of cache) {
                                if (cachedJid.split('@')[0] === jidNumber) return name;
                            }
                        }
                        
                        // 3. Try XMD LID resolution
                        if (isLid) {
                            const resolved = XMD.resolveLidToPhone(jidNumber);
                            if (resolved && resolved !== jidNumber) {
                                // Check cache for resolved phone
                                if (cache) {
                                    for (const [cachedJid, name] of cache) {
                                        if (cachedJid.split('@')[0] === resolved) return name;
                                    }
                                }
                                // Look for resolved in participants
                                for (const participant of metadata.participants) {
                                    const pNum = participant.id?.split('@')[0];
                                    if (pNum === resolved) {
                                        if (participant.notify) return participant.notify;
                                        if (participant.name) return participant.name;
                                    }
                                }
                                return resolved;
                            }
                        }
                        
                        // 4. Try onWhatsApp lookup
                        try {
                            const contact = await subClient.onWhatsApp(jidNumber);
                            if (contact?.[0]?.jid) {
                                const phoneNum = contact[0].jid.split('@')[0];
                                if (cache) {
                                    for (const [cachedJid, name] of cache) {
                                        if (cachedJid.split('@')[0] === phoneNum) return name;
                                    }
                                }
                                for (const participant of metadata.participants) {
                                    if (participant.id?.split('@')[0] === phoneNum) {
                                        if (participant.notify) return participant.notify;
                                    }
                                }
                                if (phoneNum.length <= 15) return phoneNum;
                            }
                        } catch {}
                        
                        // 5. For LID, try to find phone in participants
                        if (isLid) {
                            for (const participant of metadata.participants) {
                                if (participant.lid?.split('@')[0] === jidNumber) {
                                    const phoneNum = participant.id?.split('@')[0];
                                    if (phoneNum && phoneNum.length <= 15) {
                                        if (cache) {
                                            for (const [cachedJid, name] of cache) {
                                                if (cachedJid.split('@')[0] === phoneNum) return name;
                                            }
                                        }
                                        return phoneNum;
                                    }
                                }
                            }
                        }
                        
                        // 6. Fallback
                        if (jidNumber.length <= 15 && /^\d+$/.test(jidNumber)) {
                            return jidNumber;
                        }
                        return 'User';
                    } catch (err) {
                        console.log(`[SubBot ${botId} GroupEvents] getRealName error:`, err.message);
                        return 'User';
                    }
                };

                // Random welcome messages
                const welcomeMessages = [
                    `🎉 *Welcome {name}!* We're so glad you're here in *{group}*! 🙌`,
                    `👋 Hey *{name}*! Welcome to *{group}*! Make yourself at home! 🏠`,
                    `🌟 A big welcome to *{name}*! Great to have you in *{group}*! ✨`,
                    `🎊 *{name}* just joined! Welcome to the family at *{group}*! 💫`,
                    `🔥 Look who's here! Welcome *{name}* to *{group}*! Let's gooo! 🚀`,
                    `💎 *{name}* has arrived! Welcome to *{group}*! Enjoy your stay! 🎯`,
                    `🌈 Hello *{name}*! You've just joined *{group}*! We're happy to have you! 💜`,
                    `⚡ *{name}* is now part of *{group}*! Welcome aboard! 🛳️`,
                    `🎁 Special welcome to *{name}*! *{group}* just got better! 🌺`,
                    `🙏 *{name}*, welcome to *{group}*! Feel free to introduce yourself! 💬`
                ];

                // Random goodbye messages  
                const goodbyeMessages = [
                    `👋 Goodbye *{name}*! We'll miss you! Take care! 💔`,
                    `😢 *{name}* has left the group. Wishing you all the best! 🌟`,
                    `🚪 *{name}* just left. Hope to see you again soon! 👀`,
                    `💫 Farewell *{name}*! Thanks for being part of us! 🙏`,
                    `🌙 *{name}* has departed. Safe travels, friend! ✨`,
                    `😔 Sad to see you go, *{name}*! All the best! 💪`,
                    `🍂 *{name}* left the group. Until we meet again! 🤝`,
                    `💜 Goodbye *{name}*! You'll always be remembered! 🌈`,
                    `🌺 *{name}* has exited. Take care out there! 🛡️`,
                    `🎭 *{name}* is no longer with us. Best wishes! 🌻`
                ];

                // Process each participant
                for (const num of data.participants) {
                    const userName = await getRealName(num);
                    const dpuser = await getProfilePic(num);
                    const groupName = metadata.subject || 'this group';

                    if (data.action === 'add') {
                        // Pick random welcome message
                        const randomWelcome = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
                        const message = randomWelcome
                            .replace(/{name}/g, userName)
                            .replace(/{group}/g, groupName);

                        await subClient.sendMessage(groupId, {
                            image: { url: dpuser },
                            caption: message,
                            mentions: [num]
                        });
                        console.log(`[SubBot ${botId} GroupEvents] Welcome sent for ${userName} in ${groupName}`);
                    } 
                    else if (data.action === 'remove') {
                        // Pick random goodbye message
                        const randomGoodbye = goodbyeMessages[Math.floor(Math.random() * goodbyeMessages.length)];
                        const message = randomGoodbye.replace(/{name}/g, userName);

                        await subClient.sendMessage(groupId, {
                            image: { url: dpuser },
                            caption: message,
                            mentions: [num]
                        });
                        console.log(`[SubBot ${botId} GroupEvents] Goodbye sent for ${userName}`);
                    }
                }

                // Handle admin changes
                if (groupEventsSettings.showPromotions) {
                    const authorName = await getRealName(data.author);
                    const targetName = await getRealName(data.participants[0]);

                    if (data.action === 'promote') {
                        const promoteMessages = [
                            `🎉 *${targetName}* has been promoted to admin by *${authorName}*! Congrats! 🏆`,
                            `👑 *${authorName}* made *${targetName}* an admin! Power up! ⚡`,
                            `🌟 Big news! *${targetName}* is now an admin! Thanks *${authorName}*! 🙌`
                        ];
                        const message = promoteMessages[Math.floor(Math.random() * promoteMessages.length)];
                        await subClient.sendMessage(groupId, { text: message });
                        console.log(`[SubBot ${botId} GroupEvents] Promotion: ${targetName} by ${authorName}`);
                    } 
                    else if (data.action === 'demote') {
                        const demoteMessages = [
                            `⚠️ *${targetName}* has been demoted from admin by *${authorName}*.`,
                            `📉 *${authorName}* removed admin rights from *${targetName}*.`,
                            `🔻 *${targetName}* is no longer an admin. Changed by *${authorName}*.`
                        ];
                        const message = demoteMessages[Math.floor(Math.random() * demoteMessages.length)];
                        await subClient.sendMessage(groupId, { text: message });
                        console.log(`[SubBot ${botId} GroupEvents] Demotion: ${targetName} by ${authorName}`);
                    }
                }
            } catch (error) {
                console.error(`[SubBot ${botId} GroupEvents] Error:`, error.message);
            }
        });

        return { success: true, client: subClient };
    } catch (error) {
        console.error(`[SubBot ${botId}] Start error:`, error);
        await updateSubBotStatus(botId, 'error');
        return { success: false, error: error.message };
    }
}

async function stopSubBot(botId) {
    try {
        const client = activeBots.get(botId);
        if (client) {
            await client.logout();
            activeBots.delete(botId);
            clearRateLimits(`SubBot-${botId}`);
        }

        const sessionPath = path.join(SESSION_DIR, `bot_${botId}`);
        if (fs.existsSync(sessionPath)) {
            fs.removeSync(sessionPath);
        }

        return true;
    } catch (error) {
        console.error(`[SubBot ${botId}] Stop error:`, error);
        return false;
    }
}

async function deployNewBot(sessionString) {
    try {
        const sessionData = decodeSession(sessionString);
        if (!sessionData) {
            return { success: false, message: 'Invalid session format. Use XMD..., H4s..., or ISCE-BOT;;;...' };
        }

        const subbot = await addSubBot(sessionString, 7);

        if (subbot.alreadyExists) {
            console.log(`[SubBotManager] Session already exists with ID: ${subbot.id}, checking if already running...`);

            if (activeBots.has(subbot.id)) {
                return {
                    success: false,
                    message: `This session is already deployed and running as Bot #${subbot.id}. No duplicate created.`,
                    botId: subbot.id,
                    alreadyExists: true
                };
            }

            console.log(`[SubBotManager] Bot ${subbot.id} exists but not running, starting it...`);
            const result = await startSubBot(subbot.id, sessionData, null, null);
            return {
                success: true,
                message: `Session already in database. Bot #${subbot.id} restarted.`,
                botId: subbot.id,
                expiresAt: subbot.expires_at,
                alreadyExists: true
            };
        }

        console.log(`[SubBotManager] Starting new sub-bot ${subbot.id}...`);
        const result = await startSubBot(subbot.id, sessionData, null, null);

        if (result.success) {
            return {
                success: true,
                message: 'Bot deployed and connected successfully!',
                botId: subbot.id,
                expiresAt: subbot.expires_at
            };
        } else {
            return {
                success: true,
                message: 'Bot deployed! Connecting in background...',
                botId: subbot.id,
                expiresAt: subbot.expires_at
            };
        }
    } catch (error) {
        console.error('Deploy error:', error);
        return { success: false, message: 'Failed to deploy bot: ' + error.message };
    }
}

async function initializeAllSubBots(mainBotSettings, commandHandler) {
    try {
        await initSubBotsDB();
        await deleteExpiredSubBots();

        const activeSubs = await getAllActiveSubBots();
        console.log(`[SubBotManager] Found ${activeSubs.length} active sub-bots to start`);

        // Start sub-bots with staggered delays to prevent overload
        // Each bot starts 3-5 seconds after the previous one
        for (const sub of activeSubs) {
            try {
                const sessionData = decodeSession(sub.session);
                if (sessionData) {
                    console.log(`[SubBotManager] Starting sub-bot ${sub.id}...`);
                    await startSubBot(sub.id, sessionData, mainBotSettings, commandHandler);
                    // Stagger startup to avoid rate limits and memory spikes
                    await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));
                }
            } catch (botErr) {
                // One bot failing shouldn't stop others from starting
                console.error(`[SubBotManager] Failed to start sub-bot ${sub.id}:`, botErr.message);
            }
        }

        // Cleanup every hour
        setInterval(async () => {
            try {
                await deleteExpiredSubBots();
            } catch (e) {
                console.error('[SubBotManager] Cleanup error:', e.message);
            }
        }, 60 * 60 * 1000);

        return true;
    } catch (error) {
        console.error('[SubBotManager] Init error:', error);
        return false;
    }
}

function getActiveBotsCount() {
    return activeBots.size;
}

function getActiveBot(botId) {
    return activeBots.get(botId);
}

function getResourceStats() {
    return {
        activeBots: activeBots.size,
        maxBots: RESOURCE_LIMITS.maxActiveBots,
        memoryUsedMB: getMemoryUsageMB(),
        maxMemoryMB: RESOURCE_LIMITS.maxMemoryMB,
        canAcceptMore: canStartNewBot().allowed
    };
}

module.exports = {
    startSubBot,
    stopSubBot,
    deployNewBot,
    initializeAllSubBots,
    getActiveBotsCount,
    getActiveBot,
    decodeSession,
    activeBots,
    getResourceStats,
    canStartNewBot,
    RESOURCE_LIMITS
};
