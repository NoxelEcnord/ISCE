const { bwmxmd } = require("../core/commandHandler");
const moment = require("moment-timezone");
const s = require(__dirname + "/../config");
const XMD = require("../core/xmd");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const readMore = String.fromCharCode(8206).repeat(4000);

const PREFIX = s.PREFIX || ".";
const BOT_NAME = s.BOT || "ISCE-BOT";
const MEDIA_URLS = s.BOT_URL || [];
const MENU_TOP_LEFT = s.MENU_TOP_LEFT || "╔═════════════════════════════╗";
const MENU_BOT_NAME_LINE = s.MENU_BOT_NAME_LINE || "║       ";
const MENU_BOTTOM_LEFT = s.MENU_BOTTOM_LEFT || "╚═════════════════════════════╝";
const MENU_GREETING_LINE = s.MENU_GREETING_LINE || " ┌──『 ";
const MENU_DIVIDER = s.MENU_DIVIDER || " │  ";
const MENU_USER_LINE = s.MENU_USER_LINE || " ├👤 ᴜsᴇʀ: ";
const MENU_DATE_LINE = s.MENU_DATE_LINE || " ├📅 ᴅᴀᴛᴇ: ";
const MENU_TIME_LINE = s.MENU_TIME_LINE || " ├⏰ ᴛɪᴍᴇ: ";
const MENU_STATS_LINE = s.MENU_STATS_LINE || " ├⭐ sᴛᴀᴛs: ";
const MENU_BOTTOM_DIVIDER = s.MENU_BOTTOM_DIVIDER || " └────────────────────────────┈❖";
const WEB = XMD.WEB;
const GURL = XMD.CHANNEL_URL;
const getGlobalContextInfo = () => XMD.getContextInfo();
const getContactMsg = (contactName, sender) =>
    XMD.getContactMsg(contactName, sender);

const randomMedia = () => {
    // Priority: Local ISCE.png
    const localPath = path.join(__dirname, "../core/public/isce.png");
    if (fs.existsSync(localPath)) return localPath;

    // Fallback: URLs
    const combinedUrls = [...(MEDIA_URLS || []), ...(XMD.CAMPAIGN_IMAGES || [])];
    const validUrls = combinedUrls.filter(url => typeof url === "string" && url.trim().startsWith("http"));
    if (validUrls.length === 0) return XMD.BOT_LOGO;

    return validUrls[Math.floor(Math.random() * validUrls.length)];
};

const getRandomAudio = async () => {
    try {
        const response = await axios.get(XMD.NCS_RANDOM, { timeout: 10000 });
        if (response.data.status === "success" && response.data.data && response.data.data.length > 0) {
            return response.data.data[0].links?.Bwm_stream_link || response.data.data[0].links?.stream || null;
        }
        if (response.data.result) {
            return response.data.result;
        }
        return null;
    } catch (error) {
        console.error("Error fetching random audio:", error.message);
        return null;
    }
};

const convertToOpus = (inputPath, outputPath) => {
    return new Promise((resolve, reject) => {
        exec(
            `ffmpeg -y -i "${inputPath}" -c:a libopus -b:a 64k -vbr on -compression_level 10 -frame_duration 60 -application voip "${outputPath}"`,
            (error) => {
                if (error) reject(error);
                else resolve(outputPath);
            },
        );
    });
};

const getWelcomeAudio = async (text) => {
    try {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=en&client=tw-ob`;
        const response = await axios({
            method: "GET",
            url: url,
            responseType: "arraybuffer",
            timeout: 10000,
        });
        const tempMp3 = path.join("/tmp", `welcome_${Date.now()}.mp3`);
        const tempOgg = path.join("/tmp", `welcome_${Date.now()}.ogg`);
        fs.writeFileSync(tempMp3, Buffer.from(response.data));
        await convertToOpus(tempMp3, tempOgg);
        const audioBuffer = fs.readFileSync(tempOgg);
        try { fs.unlinkSync(tempMp3); } catch (e) { }
        try { fs.unlinkSync(tempOgg); } catch (e) { }
        return audioBuffer;
    } catch (error) {
        console.error("Error generating welcome audio:", error.message);
        return null;
    }
};

const fetchGitHubStats = async () => {
    try {
        const response = await axios.get(XMD.GITHUB_REPO_API, {
            headers: { "User-Agent": "ISCE-BOT-BOT" },
            timeout: 5000,
        });
        const forks = response.data.forks_count || 0;
        const stars = response.data.stargazers_count || 0;
        return forks * 2 + stars * 2;
    } catch (error) {
        return Math.floor(Math.random() * 1000) + 500;
    }
};

const getpluginsCommands = () => {
    const commands = require("../core/commandHandler").commands;
    const pluginCmds = {};

    commands.forEach((cmd) => {
        if (cmd.filename && cmd.filename.includes("plugins")) {
            const category = (cmd.category || "General").toLowerCase();
            if (!pluginCmds[category]) pluginCmds[category] = [];
            pluginCmds[category].push(cmd.pattern);
        }
    });

    return pluginCmds;
};

const categories = {
    "1. 🤖 AI MENU": ["ai", "gpt"],
    "2. 🎨 EPHOTO MENU": ["ephoto", "photofunia"],
    "3. 📥 DOWNLOAD MENU": ["downloader", "search"],
    "4. 👨‍👨‍👦‍👦 GROUP MENU": ["group"],
    "5. ⚙️ SETTINGS MENU": ["settings", "owner"],
    "6. 😂 FUN MENU": ["fun"],
    "7. 🌍 GENERAL MENU": ["general", "utility", "tools"],
    "8. ⚽ SPORTS MENU": ["sports"],
    "9. 🔍 STALKER MENU": ["stalker"],
    "10. 🖼️ STICKER MENU": ["sticker"],
    "11. 🔧 SYSTEM MENU": ["system"],
    "12. 📚 EDUCATION MENU": ["education"],
    "13. 🔗 SHORTENER MENU": ["shortener"],
    "14. ⚔️ CAMPAIGN MENU": ["campaign"],
};

bwmxmd(
    {
        pattern: "menu",
        category: "general",
        description: "Interactive category-based menu",
    },
    async (from, client, conText) => {
        const { mek, pushName, reply, sender, deviceMode } = conText;

        try {
            const pluginCommands = getpluginsCommands();

            moment.tz.setDefault(s.TZ || "Africa/Nairobi");
            const date = moment().format("DD/MM/YYYY");
            const time = moment().format("HH:mm:ss");
            const contactName = pushName || "User";

            let contactMessage;
            try {
                contactMessage = getContactMsg(contactName, sender?.split("@")[0] || "0");
            } catch (e) {
                contactMessage = mek;
            }

            let githubStats = 500;
            try {
                githubStats = await fetchGitHubStats();
            } catch (e) {
                console.log("GitHub stats fetch failed, using default");
            }

            const hour = moment().hour();
            let greeting = "🌙 Good Night 😴";
            if (hour >= 5 && hour < 12) greeting = "🌅 Good Morning 🤗";
            else if (hour >= 12 && hour < 18) greeting = "☀️ Good Afternoon 😊";
            else if (hour >= 18 && hour < 22) greeting = "🌆 Good Evening 🤠";

            const menuOptions = `╭───『 🌟 𝐈𝐒𝐂𝐄 𝐌𝐄𝐍𝐔 』───╮
│
│ 𝟏. 🌐 ᴏᴜʀ ᴡᴇʙ ᴀᴘᴘ
│ 𝟐. 🎵 ʀᴀɴᴅᴏᴍ sᴏɴɢ
│ 𝟑. 📢 ᴜᴘᴅᴀᴛᴇs ᴄʜᴀɴɴᴇʟ
│ 𝟒. 🤖 ᴀɪ ᴛᴏᴏʟs
│ 𝟓. 🎨 ᴇᴘʜᴏᴛᴏ ᴍᴀɢɪᴄ
│ 𝟔. 📥 ᴅᴏᴡɴʟᴏᴀᴅᴇʀ
│ 𝟕. 👨‍👨‍👦‍👦 ɢʀᴏᴜᴘ ᴍᴀɴᴀɢᴇʀ
│ 𝟖. ⚙️ ʙᴏᴛ sᴇᴛᴛɪɴɢs
│ 𝟗. 😂 ғᴜɴ & ɢᴀᴍᴇs
│ 𝟏𝟎. 🌍 ɢᴇɴᴇʀᴀʟ ᴜᴛɪʟ
│ 𝟏𝟏. ⚽ sᴘᴏʀᴛ sᴛᴀᴛs
│ 𝟏𝟐. 🔍 sᴛᴀʟᴋᴇʀ ᴛᴏᴏʟs
│ 𝟏𝟑. 🖼️ sᴛɪᴄᴋᴇʀ ʜᴜʙ
│ 𝟏𝟒. 🔧 sʏsᴛᴇᴍ ᴛᴏᴏʟs
│ 𝟏𝟓. 📚 ᴇᴅᴜᴄᴀᴛɪᴏɴ
│ 𝟏𝟔. 🔗 ᴜʀʟ sʜᴏʀᴛᴇɴᴇʀ
│ 𝟏𝟕. ⚔️ 𝐂𝐀𝐌𝐏𝐀𝐈𝐆𝐍 𝐇𝐐
│
╰─────────────────────╯
💡 𝐑𝐞𝐩𝐥𝐲 𝐰𝐢𝐭𝐡 𝐚 𝐧𝐮𝐦𝐛𝐞𝐫 (𝟏-𝟏𝟕)`;

            const menuHeader = `╭───────────────╮
│ 🤖 𝐁𝐨𝐭: 𝐈𝐒𝐂𝐄 𝐕𝟐
│ 👤 𝐎𝐰𝐧𝐞𝐫: 𝐄𝐂𝐍𝐎𝐑𝐃
│ 📅 𝐃𝐚𝐭𝐞: ${date}
│ ⌚ 𝐓𝐢𝐦𝐞: ${time} (${s.TZ})
│ 📊 𝐔𝐬𝐞𝐫𝐬: ${githubStats.users || 1000}
│ 🚀 𝐌𝐨𝐝𝐞: ${deviceMode === 'iPhone' ? '🍎 iOS' : '🤖 Android'}
╰───────────────╯
${greeting}, *${pushName}*! 👋`;

            const fullMenuText = `${menuHeader}\n\n${readMore}\n${menuOptions}`;

            const selectedMedia = randomMedia();
            let mainMenuMsg;

            if (deviceMode === 'iPhone') {
                // iPhone mode: Send image with caption (NO contextInfo at all)
                if (selectedMedia) {
                    try {
                        if (selectedMedia.match(/\.(mp4|gif)$/i)) {
                            mainMenuMsg = await client.sendMessage(
                                from,
                                {
                                    video: { url: selectedMedia },
                                    gifPlayback: true,
                                    caption: fullMenuText,
                                },
                                { quoted: mek },
                            );
                        } else {
                            mainMenuMsg = await client.sendMessage(
                                from,
                                {
                                    image: { url: selectedMedia },
                                    caption: fullMenuText,
                                },
                                { quoted: mek },
                            );
                        }
                    } catch (mediaErr) {
                        console.error("iPhone menu media error:", mediaErr.message);
                        mainMenuMsg = await client.sendMessage(from, { text: fullMenuText }, { quoted: mek });
                    }
                } else {
                    mainMenuMsg = await client.sendMessage(from, { text: fullMenuText }, { quoted: mek });
                }
            } else if (selectedMedia) {
                try {
                    const mediaContent = selectedMedia.startsWith("http") ? { url: selectedMedia } : fs.readFileSync(selectedMedia);

                    if (selectedMedia.match(/\.(mp4|gif)$/i)) {
                        mainMenuMsg = await client.sendMessage(
                            from,
                            {
                                video: mediaContent,
                                gifPlayback: true,
                                caption: fullMenuText,
                                contextInfo: getGlobalContextInfo(),
                            },
                            { quoted: contactMessage },
                        );
                    } else {
                        mainMenuMsg = await client.sendMessage(
                            from,
                            {
                                image: mediaContent,
                                caption: fullMenuText,
                                contextInfo: getGlobalContextInfo(),
                            },
                            { quoted: contactMessage },
                        );
                    }
                } catch (mediaErr) {
                    console.error("Menu media error:", mediaErr.message);
                    mainMenuMsg = await client.sendMessage(
                        from,
                        {
                            text: fullMenuText,
                            contextInfo: getGlobalContextInfo(),
                        },
                        { quoted: contactMessage },
                    );
                }
            } else {
                mainMenuMsg = await client.sendMessage(
                    from,
                    { text: fullMenuText, contextInfo: getGlobalContextInfo() },
                    { quoted: contactMessage },
                );
            }

            // Send Theme Song (Corazon)
            try {
                const songUrl = await axios.get(XMD.API.DOWNLOAD.AUDIO(XMD.THEME_SONG_URL), { timeout: 30000 })
                    .then(res => res.data?.result)
                    .catch(() => null);

                if (songUrl) {
                    await client.sendMessage(from, {
                        audio: { url: songUrl },
                        mimetype: 'audio/mpeg',
                        ptt: true,
                        contextInfo: getGlobalContextInfo()
                    }, { quoted: mainMenuMsg || contactMessage });
                }
            } catch (e) {
                console.error("Theme song send failed:", e.message);
            }

            const cleanup = () => {
                client.ev.off("messages.upsert", handleReply);
            };

            const sendMainMenu = async (destChat) => {
                const selectedMedia = randomMedia();
                if (selectedMedia) {
                    const mediaContent = selectedMedia.startsWith("http") ? { url: selectedMedia } : fs.readFileSync(selectedMedia);
                    try {
                        if (selectedMedia.match(/\.(mp4|gif)$/i)) {
                            await client.sendMessage(
                                destChat,
                                {
                                    video: mediaContent,
                                    gifPlayback: true,
                                    caption: fullMenuText,
                                    contextInfo: getGlobalContextInfo(),
                                },
                                { quoted: contactMessage },
                            );
                        } else {
                            await client.sendMessage(
                                destChat,
                                {
                                    image: mediaContent,
                                    caption: fullMenuText,
                                    contextInfo: getGlobalContextInfo(),
                                },
                                { quoted: contactMessage },
                            );
                        }
                    } catch (e) {
                        await client.sendMessage(
                            destChat,
                            {
                                text: fullMenuText,
                                contextInfo: getGlobalContextInfo(),
                            },
                            { quoted: contactMessage },
                        );
                    }
                } else {
                    await client.sendMessage(
                        destChat,
                        {
                            text: fullMenuText,
                            contextInfo: getGlobalContextInfo(),
                        },
                        { quoted: contactMessage },
                    );
                }
            };

            const handleReply = async (update) => {
                const message = update.messages[0];
                if (!message?.message) return;

                const quotedStanzaId =
                    message.message.extendedTextMessage?.contextInfo?.stanzaId;
                if (!quotedStanzaId) return;

                if (quotedStanzaId !== mainMenuMsg.key.id) return;

                const responseText =
                    message.message.extendedTextMessage?.text?.trim() ||
                    message.message.conversation?.trim();

                if (!responseText) return;

                const selectedIndex = parseInt(responseText);
                if (isNaN(selectedIndex)) return;

                const destChat = message.key.remoteJid;

                const menuReactions = {
                    0: '🔄', 1: '🌐', 2: '🎵', 3: '📢',
                    4: '🤖', 5: '🎨', 6: '📥', 7: '👨‍👨‍👦‍👦',
                    8: '⚙️', 9: '😂', 10: '🌍', 11: '⚽',
                    12: '🔍', 13: '🖼️', 14: '🔧', 15: '📚',
                    16: '🔗', 17: '⚔️'
                };

                try {
                    const reactEmoji = menuReactions[selectedIndex] || '📋';
                    await client.sendMessage(destChat, { react: { text: reactEmoji, key: message.key } });
                } catch (e) { }

                try {
                    if (selectedIndex === 0) {
                        await sendMainMenu(destChat);
                        return;
                    }

                    switch (selectedIndex) {
                        case 1:
                            await client.sendMessage(
                                destChat,
                                {
                                    text: `🌐 *${BOT_NAME} WEB APP*\n\nVisit our official website here:\n${WEB}\n\n_Reply *0* to go back to main menu_\n\n▬▬▬▬▬▬▬▬▬▬\n *Visit for more*\n> bwmxmd.co.ke \n\n*Deploy your bot now*\n> pro.bwmxmd.co.ke \n▬▬▬▬▬▬▬▬▬▬`,
                                    contextInfo: getGlobalContextInfo(),
                                },
                                { quoted: contactMessage },
                            );
                            break;


                        case 2:
                            // Corazon song logic via API
                            try {
                                const audioUrl = await axios.get(XMD.API.DOWNLOAD.AUDIO(XMD.THEME_SONG_URL), { timeout: 30000 }).then(res => res.data?.result);

                                if (audioUrl) {
                                    await client.sendMessage(destChat, {
                                        audio: { url: audioUrl },
                                        mimetype: 'audio/mpeg',
                                        ptt: true,
                                        contextInfo: getGlobalContextInfo()
                                    }, { quoted: contactMessage });
                                } else {
                                    await client.sendMessage(destChat, { react: { text: "❌", key: contactMessage.key } });
                                }
                            } catch (error) {
                                console.error("Menu song error:", error);
                                await client.sendMessage(destChat, { react: { text: "❌", key: contactMessage.key } });
                            }
                            break;

                        case 3:
                            await client.sendMessage(
                                destChat,
                                {
                                    text: `📢 *${BOT_NAME} UPDATES CHANNEL*\n\nJoin our official updates channel:\nhttps://${GURL}\n\n_Reply *0* to go back to main menu_\n\n▬▬▬▬▬▬▬▬▬▬\n *Visit for more*\n> bwmxmd.co.ke \n\n*Deploy your bot now*\n> pro.bwmxmd.co.ke \n▬▬▬▬▬▬▬▬▬▬`,
                                    contextInfo: getGlobalContextInfo(),
                                },
                                { quoted: contactMessage },
                            );
                            break;

                        case 4:
                        case 5:
                        case 6:
                        case 7:
                        case 8:
                        case 9:
                        case 10:
                        case 11:
                        case 12:
                        case 13:
                        case 14:
                        case 15:
                        case 16:
                        case 17:
                            const catIndex = selectedIndex - 4;
                            const categoryNames = Object.keys(categories);
                            const categoryName = categoryNames[catIndex];

                            if (categoryName) {
                                const catKeys = categories[categoryName] || [];
                                let cmds = [];
                                catKeys.forEach((key) => {
                                    if (pluginCommands[key]) {
                                        cmds = cmds.concat(
                                            pluginCommands[key].map(
                                                (c) => `• ${PREFIX}${c}`,
                                            ),
                                        );
                                    }
                                });

                                if (cmds.length > 0) {
                                    await client.sendMessage(
                                        destChat,
                                        {
                                            text: `📋 *${categoryName}*\n\n${cmds.join("\n")}\n\n_Reply *0* to go back to main menu_\n\n▬▬▬▬▬▬▬▬▬▬\n *Visit for more*\n> bwmxmd.co.ke \n\n*Deploy your bot now*\n> pro.bwmxmd.co.ke \n▬▬▬▬▬▬▬▬▬▬`,
                                            contextInfo: getGlobalContextInfo(),
                                        },
                                        { quoted: contactMessage },
                                    );
                                } else {
                                    await client.sendMessage(
                                        destChat,
                                        {
                                            text: `📋 *${categoryName}*\n\nNo commands available in this category\n\n_Reply *0* to go back to main menu_\n\n▬▬▬▬▬▬▬▬▬▬\n *Visit for more*\n> bwmxmd.co.ke \n\n*Deploy your bot now*\n> pro.bwmxmd.co.ke \n▬▬▬▬▬▬▬▬▬▬`,
                                            contextInfo: getGlobalContextInfo(),
                                        },
                                        { quoted: contactMessage },
                                    );
                                }
                            }
                            break;

                        default:
                            await client.sendMessage(
                                destChat,
                                {
                                    text: `*❌ Invalid number. Please select between 1-17.*\n\n_Reply *0* to go back to main menu_\n\n▬▬▬▬▬▬▬▬▬▬\n *Visit for more*\n> bwmxmd.co.ke \n\n*Deploy your bot now*\n> pro.bwmxmd.co.ke \n▬▬▬▬▬▬▬▬▬▬`,
                                    contextInfo: getGlobalContextInfo(),
                                },
                                { quoted: contactMessage },
                            );
                            break;
                    }
                } catch (error) {
                    console.error("Menu reply error:", error);
                }
            };

            client.ev.on("messages.upsert", handleReply);
            setTimeout(cleanup, 300000);
        } catch (err) {
            console.error("Menu error:", err);
            // Send a simple text menu as fallback
            try {
                const simpleMenu = `*📋 ${BOT_NAME} MENU*

*1.* 🌐 OUR WEB
*2.* 🎵 RANDOM SONG  
*3.* 📢 UPDATES
*4.* 🤖 AI MENU
*5.* 🎨 EPHOTO MENU
*6.* 📥 DOWNLOAD MENU
*7.* 👨‍👨‍👦‍👦 GROUP MENU
*8.* ⚙️ SETTINGS MENU
*9.* 😂 FUN MENU
*10.* 🌍 GENERAL MENU
*11.* ⚽ SPORTS MENU
*12.* 🔍 STALKER MENU
*13.* 🖼️ STICKER MENU

_Reply with a number (1-13)_`;
                await client.sendMessage(from, { text: simpleMenu }, { quoted: mek });
            } catch (fallbackErr) {
                reply("Menu is temporarily unavailable. Try .help instead.");
            }
        }
    },
);
