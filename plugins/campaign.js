const { bwmxmd } = require("../core/commandHandler");
const {
    addCampaignGroup,
    removeCampaignGroup,
    getCampaignGroups,
    getCampaignState,
    updateCampaignState,
    setParticipant,
    getParticipant,
    getActivity,
    getActiveGroups,
    updateActivity,
    loadTemplate,
    saveTemplate,
    listTemplates
} = require("../core/database/campaign");
const XMD = require("../core/xmd");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { Sticker, StickerTypes } = require('wa-sticker-formatter');

// Cache for generated campaign stickers to improve performance
const stickerCache = new Map();

async function getCampaignSticker(url) {
    if (stickerCache.has(url)) return stickerCache.get(url);
    try {
        const res = await axios.get(url, { responseType: 'arraybuffer' });
        const sticker = new Sticker(res.data, {
            pack: "CORAZONE 002",
            author: "ISCE BOT",
            type: StickerTypes.FULL,
            categories: ["🦅", "🎉"],
            id: "campaign-sticker",
            quality: 60,  // Same as .sticker command
            background: "transparent"  // Add transparency like .sticker
        });
        const buffer = await sticker.toBuffer();
        stickerCache.set(url, buffer);
        return buffer;
    } catch (e) {
        console.error("Failed to generate campaign sticker:", e.message);
        return null;
    }
}

// Helper to check if sender is sudo/owner
const isOwner = (conText) => conText.isSuperUser || XMD.isDev(conText.sender);

// Group Management Commands
bwmxmd({
    pattern: "addgroup",
    description: "Add current group to campaign scope",
    category: "campaign",
    filename: __filename
}, async (from, client, conText) => {
    const { reply, sender, isGroup } = conText;
    if (!isGroup) return reply("❌ This command can only be used in groups.");
    if (!isOwner(conText)) return reply("❌ Only owner can add groups to campaign scope.");

    const success = await addCampaignGroup(from, sender);
    if (success) {
        reply("✅ Group added to campaign scope. ISCE is watching! 🦅");
    } else {
        reply("❌ Failed to add group.");
    }
});

bwmxmd({
    pattern: "delgroup",
    description: "Remove current group from campaign scope",
    category: "campaign",
    filename: __filename
}, async (from, client, conText) => {
    const { reply, isGroup } = conText;
    if (!isGroup) return reply("❌ This command can only be used in groups.");
    if (!isOwner(conText)) return reply("❌ Only owner can manage campaign scope.");

    const success = await removeCampaignGroup(from);
    if (success) {
        reply("🗑️ Group removed from campaign scope.");
    } else {
        reply("❌ Failed to remove group.");
    }
});

// Foe / Pal Management
bwmxmd({
    pattern: "foe",
    description: "Mark a user as an opponent",
    category: "campaign",
    filename: __filename
}, async (from, client, conText) => {
    const { reply, sender, isGroup, mek, quotedMsg } = conText;
    if (!isOwner(conText)) return reply("❌ Unauthorized.");

    let target = null;
    if (mek.message.extendedTextMessage?.contextInfo?.participant) {
        target = mek.message.extendedTextMessage.contextInfo.participant;
    } else if (conText.args[0]) {
        target = conText.args[0].replace(/[^0-9]/g, '') + "@s.whatsapp.net";
    }

    if (!target) return reply("❌ Reply to someone or provide a number to mark as foe.");

    const success = await setParticipant(target, 'foe', sender);
    if (success) {
        reply(`🏁 Target @${target.split('@')[0]} is now marked as a *FOE*. Prepare for total demolition! 🔥`, { mentions: [target] });
    } else {
        reply("❌ Failed to update records.");
    }
});

bwmxmd({
    pattern: "pal",
    description: "Mark a user as a supporter/friend",
    category: "campaign",
    filename: __filename
}, async (from, client, conText) => {
    const { reply, sender, isGroup, mek } = conText;
    if (!isOwner(conText)) return reply("❌ Unauthorized.");

    let target = null;
    if (mek.message.extendedTextMessage?.contextInfo?.participant) {
        target = mek.message.extendedTextMessage.contextInfo.participant;
    } else if (conText.args[0]) {
        target = conText.args[0].replace(/[^0-9]/g, '') + "@s.whatsapp.net";
    }

    if (!target) return reply("❌ Reply to someone or provide a number to mark as pal.");

    const success = await setParticipant(target, 'pal', sender);
    if (success) {
        reply(`🤝 @${target.split('@')[0]} is now marked as a *PAL*. We've got their back! 🦅`, { mentions: [target] });
    } else {
        reply("❌ Failed to update records.");
    }
});

// Sticker/Text Flooding Logic
let floodInterval = null;

bwmxmd({
    pattern: "campaignstart",
    aliases: ["campaigninit"],
    description: "Start campaign bursts to scoped groups",
    category: "campaign",
    use: "<ispeed (msgs/mins)> [count]",
    filename: __filename
}, async (from, client, conText) => {
    const { reply, args, isGroup } = conText;

    if (!isOwner(conText)) return reply("❌ Unauthorized.");

    const ispeed = args[0] || "3/5"; // Default 3 msgs per 5 mins
    const count = parseInt(args[1]) || 0; // Default 0 (infinite)

    const [msgs, mins] = ispeed.split('/').map(n => parseInt(n));
    if (isNaN(msgs) || isNaN(mins) || mins <= 0) {
        return reply("❌ Invalid speed format. Use <msgs>/<mins>, e.g., 3/4");
    }

    // Calculate interval in ms: (mins * 60 * 1000) / msgs
    const interval = Math.floor((mins * 60000) / msgs);

    await updateCampaignState({
        is_flooding: true,
        sticker_count: count,
        interval_ms: interval,
        ispeed: ispeed
    });

    reply(`🚀 *Campaign Engine Engaged!*\n\n🎯 *Target:* Scoped Groups\n⚡ *Speed:* ${msgs} msgs every ${mins} mins (${interval}ms interval)\n🔢 *Bursts:* ${count === 0 ? 'Infinite' : count}\n\n_Distributing messages evenly to avoid spam flags._`);

    startFlooding(client);
    startPromoLoop(client);
});

bwmxmd({
    pattern: "campaignstop",
    description: "Stop campaign bursts",
    category: "campaign",
    filename: __filename
}, async (from, client, conText) => {
    const { reply } = conText;
    if (!isOwner(conText)) return reply("❌ Unauthorized.");

    await updateCampaignState({ is_flooding: false });
    if (floodInterval) {
        clearInterval(floodInterval);
        floodInterval = null;
    }
    if (promoInterval) {
        clearInterval(promoInterval);
        promoInterval = null;
    }
    reply("🛑 Campaign bursts stopped.");
});

async function startFlooding(client) {
    if (floodInterval) clearInterval(floodInterval);

    let sentCountTotal = 0;

    const runFlood = async () => {
        const state = await getCampaignState();
        if (!state.is_flooding) {
            clearInterval(floodInterval);
            floodInterval = null;
            return;
        }

        if (state.sticker_count !== 0 && sentCountTotal >= state.sticker_count) {
            await updateCampaignState({ is_flooding: false });
            clearInterval(floodInterval);
            floodInterval = null;
            return;
        }

        const groups = await getCampaignGroups();
        if (groups.length === 0) return;

        // Smart flooding: only target active groups
        const activeGroups = await getActiveGroups(30); // Active in last 30 mins

        await Promise.allSettled(groups.map(async (jid) => {
            try {
                // Check if group is active
                const activity = await getActivity(jid);

                // Skip if:
                // 1. No activity in last 30 mins
                // 2. Bot already has last message
                if (!activeGroups.includes(jid)) {
                    console.log(`[FLOOD] Skipping inactive group: ${jid}`);
                    return;
                }

                if (activity?.is_bot_last) {
                    console.log(`[FLOOD] Bot already has last message in: ${jid}`);
                    return;
                }

                const rand = Math.random();
                let msg = "";

                if (rand < 0.05) {
                    // 5% chance: Share theme song
                    await client.sendMessage(jid, {
                        text: `🎵 *CAMPAIGN ANTHEM* 🎵\n\n${XMD.THEME_SONG_TITLE}\n\n${XMD.THEME_SONG_URL}\n\n_Tuko Zone na Corazone! 🦅_\n\n#WekaMawe #TukoZoneNaCorazone`
                    });
                } else if (rand < 0.3) {
                    msg = XMD.MANIFESTO_PARTS[Math.floor(Math.random() * XMD.MANIFESTO_PARTS.length)];
                } else if (rand < 0.5) {
                    msg = XMD.CAMPAIGN_VARIANTS.SLOGANS[Math.floor(Math.random() * XMD.CAMPAIGN_VARIANTS.SLOGANS.length)];
                } else if (rand < 0.8) {
                    const stickerUrl = XMD.CAMPAIGN_IMAGES[Math.floor(Math.random() * XMD.CAMPAIGN_IMAGES.length)];
                    const stickerBuffer = await getCampaignSticker(stickerUrl);
                    if (stickerBuffer) {
                        await client.sendMessage(jid, { sticker: stickerBuffer });
                        await updateActivity(jid, client.user.id, true);
                        return;
                    }
                } else {
                    const caption = XMD.CAMPAIGN_VARIANTS.CAPTIONS[Math.floor(Math.random() * XMD.CAMPAIGN_VARIANTS.CAPTIONS.length)];
                    const hashtag = XMD.CAMPAIGN_VARIANTS.HASHTAGS[Math.floor(Math.random() * XMD.CAMPAIGN_VARIANTS.HASHTAGS.length)];
                    msg = `✨ *CORAZONE 002* ✨\n\n${caption}\n\n${hashtag}`;
                }

                if (msg) {
                    await client.sendMessage(jid, {
                        text: `${msg}\n\n_Action Over Talks!!_`,
                        contextInfo: {
                            externalAdReply: {
                                title: "CORAZONE CHEPKOECH BOR 🦅",
                                body: "Delegate 002 | #BorTosha",
                                mediaType: 1,
                                thumbnailUrl: XMD.CAMPAIGN_IMAGES[Math.floor(Math.random() * XMD.CAMPAIGN_IMAGES.length)]
                            }
                        }
                    });
                }

                // Update activity to mark bot as last sender
                await updateActivity(jid, client.user.id, true);
            } catch (e) {
                console.error(`Error sending burst to ${jid}:`, e.message);
            }
        }));
        sentCountTotal++;
    };

    const state = await getCampaignState();
    floodInterval = setInterval(runFlood, state.interval_ms || 10000);
}

// Promotional Messages Loop (Manifesto + Image)
let promoInterval = null;

async function startPromoLoop(client) {
    if (promoInterval) clearInterval(promoInterval);

    promoInterval = setInterval(async () => {
        const state = await getCampaignState();
        if (!state.is_flooding) {
            clearInterval(promoInterval);
            promoInterval = null;
            return;
        }

        const groups = await getCampaignGroups();
        if (groups.length === 0) return;

        await Promise.allSettled(groups.map(async (jid) => {
            try {
                const randomImg = XMD.CAMPAIGN_IMAGES[Math.floor(Math.random() * XMD.CAMPAIGN_IMAGES.length)];
                const randomManifesto = XMD.MANIFESTO_PARTS[Math.floor(Math.random() * XMD.MANIFESTO_PARTS.length)];

                await client.sendMessage(jid, {
                    image: { url: randomImg },
                    caption: `📜 *OFFICIAL MANIFESTO*\n\n${randomManifesto}\n\n*Vote Corazone Chepkoech Bor for Delegate 002!*`,
                    contextInfo: {
                        externalAdReply: {
                            title: "CORAZONE CHEPKOECH BOR",
                            body: "The Reliable Bridge",
                            mediaType: 1,
                            thumbnailUrl: randomImg
                        }
                    }
                });
            } catch (e) {
                console.error(`Failed to send promo to ${jid}:`, e.message);
            }
        }));
    }, 15 * 60000); // Send an image/manifesto every 15 minutes as requested (low frequency)
}

bwmxmd({
    pattern: "campaignhelp",
    description: "Display comprehensive campaign management guide",
    category: "campaign",
    filename: __filename
}, async (from, client, conText) => {
    const { reply } = conText;

    // Message 1: Overview
    await reply(`🦅 *ISCE CAMPAIGN ENGINE v2.0* 🦅
_Smart Activity-Based Campaign System_

*CORAZONE 002 - Action Over Talks!*

This is a comprehensive guide to the campaign bot. You'll receive multiple messages covering all features.

⏳ _Sending detailed guides..._`);

    await new Promise(resolve => setTimeout(resolve, 1500));

    // Message 2: Group Management
    await reply(`📋 *1/7: GROUP MANAGEMENT*

*Add Groups to Campaign:*
• \`.addgroup\` - Add current group
• \`.autoscan\` - Auto-add groups with keywords (moi, chs, delegate)

*Remove Groups:*
• \`.delgroup\` - Remove current group
• \`.clear\` - Clear ALL groups (Owner only, requires confirmation)

*View Groups:*
• \`.jid\` - Get current group's JID for manual config

*Example:*
\`\`\`
.addgroup
✅ Group added to campaign scope
\`\`\``);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Message 3: Targeting System
    await reply(`🎯 *2/7: FOE/PAL TARGETING*

*Mark Opponents (Foes):*
• \`.foe @user\` - Tag someone
• \`.foe\` (reply to message) - Mark sender

*Mark Supporters (Pals):*
• \`.pal @user\` - Tag someone  
• \`.pal\` (reply to message) - Mark sender

*How It Works:*
• Foes get aggressive AI banter (level 1-5)
• Foes trigger Counter Mode attacks
• Pals get friendly supportive messages
• Neutral users (Gerry, Lamech) are ignored

*Example:*
\`\`\`
.foe @254712345678
✅ Marked as FOE for AI targeting
\`\`\``);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Message 4: Campaign Engine
    await reply(`⚙️ *3/7: CAMPAIGN ENGINE*

*Start Campaign:*
\`.campaigninit <msgs/mins> [count]\`

• \`msgs/mins\` - Speed (e.g., "3/5" = 3 messages every 5 minutes)
• \`count\` - Total messages (0 = infinite)

*Examples:*
\`\`\`
.campaigninit 3/5 0
→ 3 messages every 5 mins, forever

.campaigninit 5/3 100  
→ 5 messages every 3 mins, stop after 100
\`\`\`

*Stop Campaign:*
• \`.campaignstop\` - Stop all flooding

*Smart Features:*
✅ Only targets ACTIVE groups (30 min window)
✅ Skips groups where bot has last message
✅ Prevents spam flags with distributed timing`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Message 5: AI & Counter Mode
    await reply(`🤖 *4/7: AI BANTER & COUNTER MODE*

*AI Banter Control:*
\`.banter <on/off> [level]\`

*Levels (1-5):*
1️⃣ Polite, firm, informative
2️⃣ Confident and persuasive  
3️⃣ Sharp, witty (default)
4️⃣ Aggressive, savage
5️⃣ **TOTAL DEMOLITION** - Ruthless

*Counter Mode:*
\`.counter <on/off>\`

*What It Does:*
• Foe sends sticker → Bot sends 2 stickers
• Foe sends image → Bot sends 2 images
• Foe reacts → Bot counter-reacts
• Foe sends text → 40% chance aggressive reply

*Example:*
\`\`\`
.banter on 5
.counter on
→ Maximum aggression activated!
\`\`\``);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Message 6: Templates
    await reply(`📦 *5/7: CAMPAIGN TEMPLATES*

*Quick Start Presets:*

\`.loadtemplate <name>\`

*Available Templates:*

🔥 **aggressive**
• Banter: Level 5
• Counter: ON
• Speed: 5/3 (fast)
• Use: Maximum engagement

⚖️ **moderate**  
• Banter: Level 3
• Counter: OFF
• Speed: 3/5 (normal)
• Use: Balanced approach

🤫 **stealth**
• Banter: Level 1
• Counter: OFF  
• Speed: 1/10 (slow)
• Use: Low profile

🛡️ **defensive**
• Banter: OFF
• Counter: ON
• Speed: No flooding
• Use: Counter-attacks only

*Custom Templates:*
• \`.savetemplate myconfig\` - Save current setup
• \`.listtemplates\` - View all templates`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Message 7: Message Types
    await reply(`📨 *6/7: MESSAGE TYPES*

*Campaign sends varied content:*

🎵 **5%** - Theme Song
_GIMS - Corazon ft. Lil Wayne_

📜 **25%** - Manifesto Parts
_Official campaign statements_

💬 **20%** - Slogans
_"WEKA MAWE! Tuko Zone na Corazone!"_

🎨 **30%** - Stickers
_Campaign images as stickers_

#️⃣ **20%** - Captions + Hashtags
_#WekaMawe #TukoZoneNaCorazone_

*Trending Tags:*
#WekaMawe, #CorazonHorizon, #NewHorizon, #ActionOverTalks, #TukoReady`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Message 8: Tips & Best Practices
    await reply(`💡 *7/7: TIPS & BEST PRACTICES*

*Recommended Workflow:*

1️⃣ Add groups: \`.addgroup\` or \`.autoscan\`
2️⃣ Mark foes: \`.foe @opponent\`
3️⃣ Mark pals: \`.pal @supporter\`
4️⃣ Load template: \`.loadtemplate aggressive\`
5️⃣ Start campaign: \`.campaigninit 3/5 0\`

*Pro Tips:*
✅ Use \`stealth\` template during exams
✅ Use \`aggressive\` during peak campaign
✅ Use \`defensive\` to only counter opponents
✅ Bot auto-skips inactive groups (saves resources)
✅ Bot won't spam if it already has last message

*Safety Features:*
🛡️ Smart activity detection
🛡️ Distributed message timing
🛡️ Auto-pause on inactivity
🛡️ Spam prevention built-in

*Need More Help?*
• \`.jid\` - Get group ID
• \`.listtemplates\` - View presets
• \`.campaignstop\` - Emergency stop

🦅 *Tuko Zone na Corazone!*
_Action Over Talks!!_`);
});

bwmxmd({
    pattern: "counter",
    description: "Toggle Counter Mode (2:1 media response to foes)",
    category: "campaign",
    filename: __filename
}, async (from, client, conText) => {
    const { reply, args } = conText;
    if (!conText.isSuperUser) return reply("❌ Unauthorized.");

    const action = args[0]?.toLowerCase();
    if (action === 'on' || !action) {
        await updateCampaignState({ counter_mode: true });
        reply("⚔️ *Counter Mode: ENGAGED!*\n🛡️ *Strategy:* Rapid response (2:1) to opponent media.\n\n_I am now monitoring foes for media attacks._");
    } else if (action === 'off') {
        await updateCampaignState({ counter_mode: false });
        reply("🛡️ *Counter Mode: DISENGAGED.*");
    }
});

module.exports = { startFlooding, startPromoLoop, getCampaignSticker };
