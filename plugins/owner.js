
const { bwmxmd } = require('../core/commandHandler');
const { S_WHATSAPP_NET } = require('@whiskeysockets/baileys');
const Jimp = require('jimp');
const moment = require('moment-timezone');
const fs = require('fs/promises');
const { exec } = require("child_process");
const axios = require('axios');
const XMD = require('../core/xmd');

const getContactMsg = (contactName, sender) => XMD.getContactMsg(contactName, sender);

//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
/*const fs = require("fs");
const { bwmxmd } = require('../core/commandHandler');

bwmxmd({
  pattern: "toviewonce",
  aliases: ["tovo", "tovv"],
  description: "Send quoted media (image/video/audio) as view-once message",
  category: "Utility",
  filename: __filename
}, async (from, client, conText) => {
  const { mek, quoted, quotedMsg, reply } = conText;

  if (!quotedMsg) {
    return reply("❌ Reply to an image, video, or audio message to make it view-once.");
  }

  try {
    if (quoted?.imageMessage) {
      const caption = quoted.imageMessage.caption || "";
      const filePath = await client.downloadAndSaveMediaMessage(quoted.imageMessage);
      await client.sendMessage(
        from,
        { image: { url: filePath }, caption, viewOnce: true },
        { quoted: mek }
      );
      try { fs.unlinkSync(filePath); } catch {}
    }

    if (quoted?.videoMessage) {
      const caption = quoted.videoMessage.caption || "";
      const filePath = await client.downloadAndSaveMediaMessage(quoted.videoMessage);
      await client.sendMessage(
        from,
        { video: { url: filePath }, caption, viewOnce: true },
        { quoted: mek }
      );
      try { fs.unlinkSync(filePath); } catch {}
    }

    if (quoted?.audioMessage) {
      const filePath = await client.downloadAndSaveMediaMessage(quoted.audioMessage);
      await client.sendMessage(
        from,
        {
          audio: { url: filePath },
          mimetype: "audio/mpeg",
          ptt: true,
          viewOnce: true   // flag added here
        },
        { quoted: mek }
      );
      try { fs.unlinkSync(filePath); } catch {}
    }
  } catch (err) {
    console.error("toviewonce command error:", err);
    reply("❌ Couldn't send the media. Try again.");
  }
});*/
//=====================================my===================================================================================

//========================================================================================================================


bwmxmd({
  pattern: "fetch",
  aliases: ["get", "curl"],
  description: "Fetch and display content from a URL",
  category: "Owner",
  filename: __filename
}, async (from, client, conText) => {
  const { q, reply, mek } = conText;
  if (!q) return reply("❌ Provide a valid URL to fetch.");

  try {
    const response = await axios.get(q, { responseType: 'arraybuffer' });
    const contentType = response.headers['content-type'];

    if (!contentType) return reply("❌ Server did not return a content-type.");
    console.log("Content-Type:", contentType);

    const buffer = Buffer.from(response.data);
    const filename = q.split('/').pop() || "file";

    if (contentType.includes('application/json')) {
      const json = JSON.parse(buffer.toString());
      return reply("```json\n" + JSON.stringify(json, null, 2).slice(0, 4000) + "\n```");
    }

    if (contentType.includes('text/html')) {
      const html = buffer.toString();
      return reply(html.slice(0, 4000));
    }

    if (contentType.includes('image')) {
      return client.sendMessage(from, { image: buffer, caption: q }, { quoted: mek });
    }

    if (contentType.includes('video')) {
      return client.sendMessage(from, { video: buffer, caption: q }, { quoted: mek });
    }

    if (contentType.includes('audio')) {
      return client.sendMessage(from, {
        audio: buffer,
        mimetype: "audio/mpeg",
        fileName: filename
      }, { quoted: mek });
    }

    if (contentType.includes('application/pdf')) {
      return client.sendMessage(from, {
        document: buffer,
        mimetype: "application/pdf",
        fileName: filename
      }, { quoted: mek });
    }

    if (contentType.includes('application')) {
      return client.sendMessage(from, {
        document: buffer,
        mimetype: contentType,
        fileName: filename
      }, { quoted: mek });
    }

    if (contentType.includes('text/')) {
      return reply(buffer.toString().slice(0, 4000));
    }

    return reply("❌ Unsupported or unknown content type.");
  } catch (err) {
    console.error("fetch error:", err);
    return reply("❌ Failed to fetch the URL.");
  }
});
//========================================================================================================================

bwmxmd({
  pattern: "clearsession",
  aliases: ["fixsession", "resetsession"],
  description: "Clear session for a user to fix message delivery issues",
  category: "Owner",
  filename: __filename
}, async (from, client, conText) => {
  const { q, reply, mek, quoted, sender, isSuperUser } = conText;
  
  if (!isSuperUser) return reply("❌ Owner only command");
  
  let targetJid = null;
  let phoneNumber = null;
  
  // Priority: phone number provided > quoted message
  if (q) {
    let num = q.replace(/[^0-9]/g, '');
    if (num.length >= 10) {
      phoneNumber = num;
      targetJid = num + '@s.whatsapp.net';
    }
  }
  
  if (!targetJid && quoted) {
    targetJid = quoted.participant || quoted.sender || mek.message?.extendedTextMessage?.contextInfo?.participant;
  }
  
  if (!targetJid) {
    return reply("❌ Provide a phone number.\n\nUsage:\n.clearsession 2547XXXXXXXX");
  }
  
  try {
    const recipientId = targetJid.split('@')[0];
    let cleared = [];
    
    if (client.authState?.keys?.set) {
      const idsToClean = [];
      
      // Always add the phone number if provided
      if (phoneNumber) {
        idsToClean.push(phoneNumber);
      }
      
      // Add the recipientId (might be LID format)
      if (!idsToClean.includes(recipientId)) {
        idsToClean.push(recipientId);
      }
      
      // If LID format, also add the base number
      if (recipientId.includes(':')) {
        const baseId = recipientId.split(':')[0];
        if (!idsToClean.includes(baseId)) {
          idsToClean.push(baseId);
        }
      }
      
      for (const id of idsToClean) {
        try {
          await client.authState.keys.set({ 
            'session': { [id]: null },
            'sender-key': { [id]: null },
            'pre-key': { [id]: null },
            'sender-key-memory': { [id]: null }
          });
          cleared.push(id);
          console.log(`[MAIN] 🔄 Session cleared for ${id}`);
        } catch (e) {}
      }
      
      return reply(`✅ Sessions cleared for:\n${cleared.map(id => `• ${id}`).join('\n')}\n\nTell them to send a message first, then try commands.`);
    } else {
      return reply("❌ Cannot access session store");
    }
  } catch (err) {
    console.error("clearsession error:", err);
    return reply("❌ Failed to clear session: " + err.message);
  }
});

//========================================================================================================================

bwmxmd({
  pattern: "shell",
  aliases: ["sh", "exec"],
  description: "Execute shell commands",
  category: "Owner",
  filename: __filename
}, async (from, client, conText) => {
  const { q, reply, isSuperUser } = conText;
  if (!isSuperUser) return reply("❌ Superuser only command.");
  if (!q) return reply("❌ No command provided. Please provide a valid shell command.");

  try {
    exec(q, (err, stdout, stderr) => {
      if (err) return reply(`❌ Error: ${err.message}`);
      if (stderr) return reply(`⚠️ stderr: ${stderr}`);
      if (stdout) return reply(stdout);
    });
  } catch (error) {
    await reply("❌ An error occurred while running the shell command:\n" + error);
  }
});
//========================================================================================================================
//const { bwmxmd } = require('../core/commandHandler');

bwmxmd({
  pattern: "chunk",
  aliases: ["details", "det", "ret"],
  description: "Displays raw quoted message in JSON format",
  category: "Owner",
  filename: __filename
}, async (from, client, conText) => {
  const { reply, react, quotedMsg, isSuperUser, mek } = conText;

  if (!isSuperUser) return reply("❌ Superuser only command.");
  if (!quotedMsg) return reply("❌ Please reply to a message to inspect it.");

  try {
    const json = JSON.stringify(quotedMsg, null, 2);
    const chunks = json.match(/[\s\S]{1,100000}/g) || [];

    for (const chunk of chunks) {
      const formatted = "```json\n" + chunk + "\n```";
      await client.sendMessage(from, { text: formatted }, { quoted: mek });
      //await react("✅");
    }
  } catch (err) {
    console.error("Error dumping message:", err);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "save",
  aliases: ["savestatus", "statussave"],
  description: "Retrieve quoted media (image, video, audio)",
  category: "Owner",
  filename: __filename
}, async (from, client, conText) => {
  const { mek, quoted, quotedMsg, reply } = conText;

  if (!quotedMsg) return reply("📌 Reply to a status message to save.");

  try {
    if (quoted?.imageMessage) {
      const caption = quoted.imageMessage.caption || "";
      const filePath = await client.downloadAndSaveMediaMessage(quoted.imageMessage);
      await client.sendMessage(from, { image: { url: filePath }, caption }, { quoted: mek });
    }

    if (quoted?.videoMessage) {
      const caption = quoted.videoMessage.caption || "";
      const filePath = await client.downloadAndSaveMediaMessage(quoted.videoMessage);
      await client.sendMessage(from, { video: { url: filePath }, caption }, { quoted: mek });
    }

    if (quoted?.audioMessage) {
      const filePath = await client.downloadAndSaveMediaMessage(quoted.audioMessage);
      await client.sendMessage(from, { audio: { url: filePath }, mimetype: 'audio/mpeg' }, { quoted: mek });
    }

  } catch (err) {
    console.error("vv command error:", err);
    reply("❌ Failed to retrieve media. Try again.");
  }
});
//========================================================================================================================

bwmxmd({
  pattern: "vv2",
  aliases: ["amazing", "lovely"],
  description: "Retrieve quoted media and send privately to sender",
  category: "Owner",
  filename: __filename
}, async (from, client, conText) => {
  const { mek, quoted, quotedMsg, reply, sender } = conText;

  if (!quotedMsg) return reply("📌 Reply to a media message to retrieve it.");

  try {
    if (quoted?.imageMessage) {
      const caption = quoted.imageMessage.caption || "";
      const filePath = await client.downloadAndSaveMediaMessage(quoted.imageMessage);
      await client.sendMessage(sender, { image: { url: filePath }, caption }, { quoted: mek });
    }

    if (quoted?.videoMessage) {
      const caption = quoted.videoMessage.caption || "";
      const filePath = await client.downloadAndSaveMediaMessage(quoted.videoMessage);
      await client.sendMessage(sender, { video: { url: filePath }, caption }, { quoted: mek });
    }

    if (quoted?.audioMessage) {
      const filePath = await client.downloadAndSaveMediaMessage(quoted.audioMessage);
      await client.sendMessage(sender, { audio: { url: filePath }, mimetype: 'audio/mpeg' }, { quoted: mek });
    }

  } catch (err) {
    console.error("vv2 command error:", err);
    reply("❌ Failed to retrieve media. Try again.");
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "vv",
  aliases: ["wow", "retrieve"],
  description: "Retrieve quoted media (image, video, audio)",
  category: "Owner",
  filename: __filename
}, async (from, client, conText) => {
  const { mek, quoted, quotedMsg, reply, deviceMode } = conText;

  if (!quotedMsg) return reply("📌 Reply to a media message to retrieve it.");

  try {
    const isViewOnce = quoted?.viewOnceMessage || quoted?.viewOnceMessageV2 || quoted?.viewOnceMessageV2Extension;
    const actualQuoted = isViewOnce 
      ? (quoted.viewOnceMessage?.message || quoted.viewOnceMessageV2?.message || quoted.viewOnceMessageV2Extension?.message || quoted)
      : quoted;
    
    const sendOptions = deviceMode === 'iPhone' ? {} : { quoted: mek };
    
    if (actualQuoted?.imageMessage) {
      const caption = actualQuoted.imageMessage.caption || "";
      const filePath = await client.downloadAndSaveMediaMessage(actualQuoted.imageMessage);
      await client.sendMessage(from, { image: { url: filePath }, caption }, sendOptions);
      return reply(isViewOnce ? "✅ ViewOnce image retrieved!" : "✅ Image retrieved!");
    }

    if (actualQuoted?.videoMessage) {
      const caption = actualQuoted.videoMessage.caption || "";
      const filePath = await client.downloadAndSaveMediaMessage(actualQuoted.videoMessage);
      await client.sendMessage(from, { video: { url: filePath }, caption }, sendOptions);
      return reply(isViewOnce ? "✅ ViewOnce video retrieved!" : "✅ Video retrieved!");
    }

    if (actualQuoted?.audioMessage) {
      const filePath = await client.downloadAndSaveMediaMessage(actualQuoted.audioMessage);
      await client.sendMessage(from, { audio: { url: filePath }, mimetype: 'audio/mpeg' }, sendOptions);
      return reply(isViewOnce ? "✅ ViewOnce audio retrieved!" : "✅ Audio retrieved!");
    }
    
    return reply("❌ No media found in quoted message.");

  } catch (err) {
    console.error("vv command error:", err);
    reply("❌ Failed to retrieve media. Error: " + err.message);
  }
});
//========================================================================================================================


bwmxmd({
  pattern: "profile",
  aliases: ["getpp"],
  category: "Owner",
  description: "Get someone's full profile info"
},
async (from, client, conText) => {
  const { reply, quoted, quotedUser, isGroup, timeZone, mek, isSuperUser } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");
  if (!quotedUser) return reply("📛 Quote a user to fetch their profile.");

  let target = quotedUser;
  let statusText = "Not Found";
  let setAt = "Not Available";

  try {
    if (isGroup && !target.endsWith('@s.whatsapp.net')) {
      try {
        const jid = await client.getJidFromLid(target);
        if (jid) target = jid;
      } catch {}
    }

    let ppUrl;
    try {
      ppUrl = await client.profilePictureUrl(target, 'image');
    } catch {
      ppUrl = XMD.OWNER_PP;
    }

    try {
      const status = await client.fetchStatus(target);
      if (status?.length && status[0]?.status) {
        statusText = status[0].status.status || "Not Found";
        setAt = status[0].status.setAt || "Not Available";
      }
    } catch {}

    let formatted = "Not Available";
    if (setAt !== "Not Available") {
      try {
        formatted = moment(setAt).tz(timeZone).format('dddd, MMMM Do YYYY, h:mm A z');
      } catch {}
    }

    const number = target.replace(/@s\.whatsapp\.net$/, "");

    await client.sendMessage(from, {
      image: { url: ppUrl },
      caption: `*👤 User Profile*\n\n` +
               `*• Name:* @${number}\n` +
               `*• Number:* ${number}\n` +
               `*• About:* ${statusText}\n` +
               `*• Last Updated:* ${formatted}`,
      mentions: [target]
    }, { quoted: mek });

  } catch (err) {
    console.error("whois error:", err);
    reply(`❌ Failed to fetch profile info.\nError: ${err.message}`);
  }
});
//========================================================================================================================


bwmxmd({
  pattern: "fullpp",
  aliases: ["setfullpp"],
  category: "Owner",
  description: "Set full profile picture without cropping"
},
async (from, client, conText) => {
  const { reply, quoted, isSuperUser } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");

  let tempFilePath;

  try {
    const quotedImg = quoted?.imageMessage || quoted?.message?.imageMessage;
    if (!quotedImg) return reply("📸 Quote an image to set as profile picture.");

    tempFilePath = await client.downloadAndSaveMediaMessage(quotedImg, 'temp_media');

    const image = await Jimp.read(tempFilePath);
    const resized = await image.scaleToFit(720, 720);
    const buffer = await resized.getBufferAsync(Jimp.MIME_JPEG);

    const iqNode = {
      tag: "iq",
      attrs: { to: S_WHATSAPP_NET, type: "set", xmlns: "w:profile:picture" },
      content: [{ tag: "picture", attrs: { type: "image" }, content: buffer }]
    };

    await client.query(iqNode);
    await fs.unlink(tempFilePath);
    reply("✅ Profile picture updated successfully (full image).");

  } catch (err) {
    console.error("fullpp error:", err);
    if (tempFilePath) await fs.unlink(tempFilePath).catch(() => {});
    reply(`❌ Failed to update profile picture.\nError: ${err.message}`);
  }
});
//========================================================================================================================


bwmxmd({
  pattern: "block",
  aliases: ["ban", "blacklist"],
  category: "Owner",
  description: "Block a user by tag, mention, or quoted message"
},
async (from, client, conText) => {
  const { reply, q, quotedUser, isSuperUser, mentionedJid } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");

  let target;

  if (quotedUser) {
    target = quotedUser;
  } else if (mentionedJid?.length) {
    target = mentionedJid[0];
  } else if (q && /^\d+$/.test(q)) {
    target = q + "@s.whatsapp.net";
  }

  if (!target) return reply("⚠️ Tag, mention, or quote a user to block.");

  const number = target.split('@')[0];
  
  // Developer bypass - developers cannot be blocked
  if (XMD.isDev(number)) {
    return reply(`Sorry i can never harm my boss 😒`, { mentions: [target] });
  }
  
  await client.updateBlockStatus(target, 'block');
  reply(`🚫 ${number} has been blocked.`);
});
//========================================================================================================================

bwmxmd({
  pattern: "jid",
  category: "Owner",
  description: "Get User/Group JID"
},
async (from, client, conText) => {
  const { q, mek, reply, isGroup, quotedUser } = conText;

  try {
    let result;

    if (quotedUser) {
      if (quotedUser.startsWith('@') && quotedUser.includes('@lid')) {
        result = quotedUser.replace('@', '') + '@lid';
      } else {
        result = quotedUser;
      }
    } else if (isGroup) {
      result = from;
    } else {
      result = from || mek.key.remoteJid;
    }

    let finalResult = result;
    if (result && result.includes('@lid')) {
      finalResult = await client.getJidFromLid(result);
    }

    reply(`${finalResult}`);

  } catch (error) {
    console.error("jid error:", error);
    reply(`❌ Error: ${error.message}`);
  }
});
//========================================================================================================================


bwmxmd({
  pattern: "mygroups",
  aliases: ["groups", "botgroups", "glist"],
  category: "Owner",
  description: "List all groups the bot is in"
},
async (from, client, conText) => {
  const { reply, isSuperUser } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");

  try {
    const allGroups = await client.groupFetchAllParticipating();
    const groupList = Object.values(allGroups);
    const groupIds = groupList.map(g => g.id);

    reply(`📦 Bot is in ${groupIds.length} groups. Fetching details...`);

    let output = `*📋 My Groups*\n\n`;

    for (const id of groupIds) {
      try {
        const meta = await client.groupMetadata(id);
        output += `📛 *Subject:* ${meta.subject}\n`;
        output += `👥 *Members:* ${meta.participants.length}\n`;
        output += `🆔 *JID:* ${id}\n\n`;
      } catch {
        output += `⚠️ Failed to fetch metadata for ${id}\n\n`;
      }
    }

    reply(output);

  } catch (err) {
    reply("❌ Error while accessing bot groups.\n\n" + err);
  }
});
//
//========================================================================================================================
bwmxmd({
  pattern: "setsudo",
  aliases: ['setsudo'],
 // react: "👑",
  category: "Owner",
  description: "Sets User as Sudo",
}, async (from, client, conText) => {
  const { mek, reply, react, isSuperUser, quotedUser, setSudo } = conText;

  if (!isSuperUser) {
    await react("❌");
    return reply("❌ Owner Only Command!");
  }

  if (!quotedUser) {
    await react("❌");
    return reply("❌ Please reply to/quote a user!");
  }

  try {
    let result;
    
    if (quotedUser) {
      if (quotedUser.startsWith('@') && quotedUser.includes('@lid')) {
        result = quotedUser.replace('@', '') + '@lid';
      } else {
        result = quotedUser;
      }
    }

    let finalResult = result;
    if (result && result.includes('@lid')) {
      finalResult = await client.getJidFromLid(result);
    }
    const userNumber = finalResult.split("@")[0];
    const added = await setSudo(userNumber);
    const msg = added
      ? `✅ Added @${userNumber} to sudo list.`
      : `⚠️ @${userNumber} is already in sudo list.`;

    await client.sendMessage(from, {
      text: msg,
      mentions: [quotedUser]
    }, { quoted: mek });
    await react("✅");

  } catch (error) {
    console.error("setsudo error:", error);
    await react("❌");
    await reply(`❌ Error: ${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "delsudo",
  aliases: ['removesudo'],
 // react: "👑",
  category: "Owner",
  description: "Deletes User as Sudo",
}, async (from, client, conText) => {
  const { mek, reply, react, isSuperUser, quotedUser, delSudo } = conText;

  if (!isSuperUser) {
    await react("❌");
    return reply("❌ Owner Only Command!");
  }

  try {
    let result;
    
    if (quotedUser) {
      if (quotedUser.startsWith('@') && quotedUser.includes('@lid')) {
        result = quotedUser.replace('@', '') + '@lid';
      } else {
        result = quotedUser;
      }
    }

    let finalResult = result;
    if (result && result.includes('@lid')) {
      finalResult = await client.getJidFromLid(result);
    }
    const userNumber = finalResult.split("@")[0];
    const removed = await delSudo(userNumber);
    const msg = removed
      ? `❌ Removed @${userNumber} from sudo list.`
      : `⚠️ @${userNumber} is not in the sudo list.`;

    await client.sendMessage(from, {
      text: msg,
      mentions: [quotedUser]
    }, { quoted: mek });
    await react("✅");

  } catch (error) {
    console.error("delsudo error:", error);
    await react("❌");
    await reply(`❌ Error: ${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "issudo",
  aliases: ['checksudo'],
 // react: "👑",
  category: "Owner",
  description: "Check if user is sudo",
}, async (from, client, conText) => {
  const { mek, reply, react, isSuperUser, quotedUser, isSudo } = conText;

  if (!isSuperUser) {
    await react("❌");
    return reply("❌ Owner Only Command!");
  }

  if (!quotedUser) {
    await react("❌");
    return reply("❌ Please reply to/quote a user!");
  }

  try {
    let result;
    
    if (quotedUser) {
      if (quotedUser.startsWith('@') && quotedUser.includes('@lid')) {
        result = quotedUser.replace('@', '') + '@lid';
      } else {
        result = quotedUser;
      }
    }

    let finalResult = result;
    if (result && result.includes('@lid')) {
      finalResult = await client.getJidFromLid(result);
    }
    const userNumber = finalResult.split("@")[0];
    const isUserSudo = await isSudo(userNumber);
    const msg = isUserSudo
      ? `✅ @${userNumber} is a sudo user.`
      : `❌ @${userNumber} is not a sudo user.`;

    await client.sendMessage(from, {
      text: msg,
      mentions: [quotedUser]
    }, { quoted: mek });
    await react("✅");

  } catch (error) {
    console.error("issudo error:", error);
    await react("❌");
    await reply(`❌ Error: ${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "getsudo",
  aliases: ['getsudos', 'listsudo', 'listsudos'],
  //react: "👑",
  category: "Owner",
  description: "Get All Sudo Users",
}, async (from, client, conText) => {
  const { mek, reply, react, isSuperUser, getSudoNumbers, dev, devNumbers } = conText;

  try {
    if (!isSuperUser) {
      await react("❌");
      return reply("❌ Owner Only Command!");
    }

    // Get sudo numbers from database
    const sudoFromDB = await getSudoNumbers() || [];
    
    // Current dev from settings
    const currentDev = dev ? [dev.replace(/\D/g, '')] : [];

    // Combine all sudo users
    const allSudos = [...new Set([...sudoFromDB, ...devNumbers, ...currentDev])];

    if (!allSudos.length) {
      return reply("⚠️ No sudo users found.");
    }

    let msg = "*👑 ALL SUDO USERS*\n\n";
    
    // Database sudo users
    if (sudoFromDB.length > 0) {
      msg += `*Database Sudo Users (${sudoFromDB.length}):*\n`;
      sudoFromDB.forEach((num, i) => {
        msg += `${i + 1}. wa.me/${num}\n`;
      });
      msg += '\n';
    }

    // Hardcoded dev numbers from context
    if (devNumbers && devNumbers.length > 0) {
      msg += `*Hardcoded Dev Numbers (${devNumbers.length}):*\n`;
      devNumbers.forEach((num, i) => {
        msg += `${i + 1}. wa.me/${num}\n`;
      });
      msg += '\n';
    }

    // Current dev from settings
    if (currentDev.length > 0) {
      msg += `*Current Dev (${currentDev.length}):*\n`;
      currentDev.forEach((num, i) => {
        msg += `${i + 1}. wa.me/${num}\n`;
      });
      msg += '\n';
    }

    msg += `*Total Sudo Users: ${allSudos.length}*`;
    
    await reply(msg);
    await react("✅");

  } catch (error) {
    console.error("getsudo error:", error);
    await react("❌");
    await reply(`❌ Error: ${error.message}`);
  }
});

//========================================================================================================================
// DEPLOY SUB-BOT COMMAND - Reply to a session string to deploy it
//========================================================================================================================
const { deployNewBot, getActiveBotsCount } = require('../core/subBotManager');

bwmxmd({
  pattern: "deploy",
  aliases: ["addbot", "deploybot", "newbot"],
  react: "🚀",
  description: "Deploy a sub-bot by replying to a session string",
  category: "Owner"
}, async (from, client, conText) => {
  const { reply, react, isSuperUser, quotedMsg, text } = conText;

  if (!isSuperUser) {
    return reply("❌ Owner Only Command!");
  }

  try {
    let sessionString = '';
    
    if (quotedMsg) {
      const quotedText = quotedMsg.conversation || 
                        quotedMsg.extendedTextMessage?.text || 
                        quotedMsg.text || '';
      sessionString = quotedText.trim();
    } else if (text && text.trim()) {
      sessionString = text.trim();
    }
    
    if (!sessionString) {
      return reply(`*🚀 Deploy Your Test Bot*

Reply to a message containing the session string or provide it directly.

*Usage:*
▸ Reply to session message and type: .deploy
▸ Or: .deploy <session_string>

*Session Formats Supported:*
▸ XMD;;;base64data
▸ XMD-base64data
▸ XMDI-base64data  
▸ XMDs-base64data
▸ H4sbase64data (direct)
▸ ISCE-BOT;;;base64data

⚠️ *Important Notice:*
This deployment is temporary and meant for testing purposes only. Your sub-bot will remain active until the main bot restarts. This gives you and others a chance to experience the power of ISCE-BOT before deploying your own permanent bot!

*Active Test Bots:* ${getActiveBotsCount()}

▬▬▬▬▬▬▬▬▬▬
 *Visit for more*
> bwmxmd.co.ke 

*Deploy your bot now*
> pro.bwmxmd.co.ke 
▬▬▬▬▬▬▬▬▬▬`);
    }

    await react("⏳");
    await reply("🔄 Deploying sub-bot... Please wait.");

    const result = await deployNewBot(sessionString);

    if (result.success) {
      await react("✅");
      if (result.alreadyExists) {
        await reply(`⚠️ *Session Already Exists*

🆔 Bot ID: ${result.botId}
📱 Status: Restarted
🔢 Active Test Bots: ${getActiveBotsCount()}

This session was already registered. Your test bot has been restarted and is ready to rock!

⚡ *Remember:* This is a temporary deployment for testing. Once the main bot restarts, this sub-bot will go offline. Enjoy exploring ISCE-BOT features!

▬▬▬▬▬▬▬▬▬▬
 *Visit for more*
> bwmxmd.co.ke 

*Deploy your bot now*
> pro.bwmxmd.co.ke 
▬▬▬▬▬▬▬▬▬▬`);
      } else {
        await reply(`✅ *Test Bot Deployed Successfully!*

🆔 Bot ID: ${result.botId}
📱 Phone: ${result.phoneNumber || 'Connected'}
🔢 Active Test Bots: ${getActiveBotsCount()}

🎉 Awesome! Your bot is now live and ready to flex!

⚠️ *Heads Up:* This deployment is NOT permanent. It's designed for testing so you can experience the magic of ISCE-BOT before setting up your own real bot. Your sub-bot will stay active until the main bot restarts.

💡 Enjoy testing all the cool features and when you're ready, deploy your own permanent ISCE-BOT bot!

▬▬▬▬▬▬▬▬▬▬
 *Visit for more*
> bwmxmd.co.ke 

*Deploy your bot now*
> pro.bwmxmd.co.ke 
▬▬▬▬▬▬▬▬▬▬`);
      }
    } else {
      await react("❌");
      if (result.alreadyExists) {
        await reply(`⚠️ *Session Already Running*

🆔 Bot ID: ${result.botId}
📱 Status: Already Active
🔢 Active Test Bots: ${getActiveBotsCount()}

No worries! This session is already deployed and vibing. No duplicate was created.

⚡ *Reminder:* This is a temporary test deployment. Feel free to explore all the features before deploying your own permanent bot!

▬▬▬▬▬▬▬▬▬▬
 *Visit for more*
> bwmxmd.co.ke 

*Deploy your bot now*
> pro.bwmxmd.co.ke 
▬▬▬▬▬▬▬▬▬▬`);
      } else {
        await reply(`❌ *Deployment Failed*

${result.message || 'Unknown error occurred'}

Please double-check your session string and give it another shot!

▬▬▬▬▬▬▬▬▬▬
 *Visit for more*
> bwmxmd.co.ke 

*Deploy your bot now*
> pro.bwmxmd.co.ke 
▬▬▬▬▬▬▬▬▬▬`);
      }
    }

  } catch (error) {
    console.error("Deploy error:", error);
    await react("❌");
    await reply(`❌ Error: ${error.message}`);
  }
});

bwmxmd({
  pattern: "subbots",
  aliases: ["mybots", "listbots", "activebots"],
  react: "🤖",
  description: "List all active sub-bots",
  category: "Owner"
}, async (from, client, conText) => {
  const { reply, react, isSuperUser, isSubBot } = conText;

  if (isSubBot) {
    return reply("❌ This command can only be used on the main bot!");
  }

  if (!isSuperUser) {
    return reply("❌ Owner Only Command!");
  }

  try {
    const { getActiveBotsCount, activeBots } = require('../core/subBotManager');
    
    let bots = [];
    let usingDatabase = false;
    
    try {
      const { getAllSubBots } = require('../core/database/subbots');
      bots = await getAllSubBots();
      usingDatabase = true;
    } catch (dbError) {
      console.log("Database not available, using activeBots map");
    }

    if ((!bots || bots.length === 0) && activeBots.size === 0) {
      return reply("*🤖 No Sub-Bots Deployed*\n\nUse .deploy to add a new bot!");
    }

    if (!usingDatabase || bots.length === 0) {
      bots = [];
      for (const [botId, botClient] of activeBots.entries()) {
        const phone = botClient.user?.id?.split('@')[0]?.split(':')[0] || 'Unknown';
        bots.push({ id: botId, phone, status: 'connected', expires_at: null });
      }
    }

    if (bots.length === 0) {
      return reply("*🤖 No Sub-Bots Deployed*\n\nUse .deploy to add a new bot!");
    }

    let msg = `*🤖 Sub-Bots (${bots.length})*\n━━━━━━━━━━━━━━━\n\n`;

    for (const bot of bots) {
      const isRunning = activeBots.has(bot.id);
      const status = isRunning ? '🟢 Running' : (bot.status === 'connected' ? '🟡 Connected' : '🔴 ' + (bot.status || 'Offline'));
      const expiry = bot.expires_at ? new Date(bot.expires_at).toLocaleDateString() : 'N/A';
      const phone = bot.phone || 'Unknown';
      msg += `*Bot #${bot.id}*\n`;
      msg += `   📱 Phone: ${phone}\n`;
      msg += `   📊 Status: ${status}\n`;
      msg += `   ⏰ Expires: ${expiry}\n\n`;
    }

    msg += `━━━━━━━━━━━━━━━\n`;
    msg += `*Active Connections:* ${getActiveBotsCount()}\n\n`;
    msg += `_To stop a bot, use:_ *.stopbot <id>*\n_Example: .stopbot 1_`;
    
    await reply(msg);

  } catch (error) {
    console.error("subbots error:", error);
    await react("❌");
    await reply(`❌ Error: ${error.message}`);
  }
});

bwmxmd({
  pattern: "stopbot",
  aliases: ["logoutbot", "disconnectbot", "removebot"],
  react: "🛑",
  description: "Stop/logout a specific sub-bot by ID",
  category: "Owner"
}, async (from, client, conText) => {
  const { reply, react, isSuperUser, q, isSubBot } = conText;

  if (isSubBot) {
    return reply("❌ This command can only be used on the main bot!");
  }

  if (!isSuperUser) {
    return reply("❌ Owner Only Command!");
  }

  if (!q || isNaN(parseInt(q))) {
    return reply("❌ Please provide a valid bot ID.\n\nUsage: .stopbot <id>\nExample: .stopbot 1\n\nUse .subbots to see all bots and their IDs.");
  }

  const botId = parseInt(q);

  try {
    const { stopSubBot, activeBots } = require('../core/subBotManager');
    
    let botRecord = null;
    try {
      const { getSubBot } = require('../core/database/subbots');
      botRecord = await getSubBot(botId);
    } catch (dbError) {
      console.log("Database not available for stopbot");
    }

    const isRunning = activeBots.has(botId);
    
    if (!isRunning && !botRecord) {
      return reply(`❌ Bot #${botId} not found.`);
    }
    
    if (isRunning) {
      const runningClient = activeBots.get(botId);
      const phone = runningClient?.user?.id?.split('@')[0]?.split(':')[0] || botRecord?.phone || 'Unknown';
      await stopSubBot(botId);
      await react("✅");
      return reply(`✅ *Bot #${botId} Stopped Successfully*\n\n📱 Phone: ${phone}\n🔌 Status: Logged out\n\n_The bot has been disconnected and will no longer respond to messages._`);
    } else {
      if (botRecord) {
        try {
          const { updateSubBotStatus } = require('../core/database/subbots');
          await updateSubBotStatus(botId, 'stopped');
        } catch (e) {}
      }
      await react("⚠️");
      return reply(`⚠️ *Bot #${botId} Updated*\n\n📱 Phone: ${botRecord?.phone || 'Unknown'}\n📊 Status: Was not running (marked as stopped)\n\n_The bot was not actively running but has been marked as stopped._`);
    }

  } catch (error) {
    console.error("stopbot error:", error);
    await react("❌");
    await reply(`❌ Error stopping bot: ${error.message}`);
  }
});

bwmxmd({
  pattern: "test2",
  description: "Send plain text to current channel",
  category: "Owner",
  filename: __filename
}, async (from, client, conText) => {
  try {
    console.log(`[TEST2] Sending plain text to: ${from}`);
    const result = await client.sendMessage(from, { text: 'hello box' });
    console.log(`[TEST2] Result:`, JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`[TEST2] Error:`, error.message);
  }
});
