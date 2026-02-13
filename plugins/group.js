const { bwmxmd } = require('../core/commandHandler');
const { getBinaryNodeChild, getBinaryNodeChildren, S_WHATSAPP_NET } = require('@whiskeysockets/baileys');
const axios = require('axios');
const fs = require('fs');
const XMD = require('../core/xmd');

const getContactMsg = (contactName, sender) => XMD.getContactMsg(contactName, sender);

async function resolveParticipantName(participant, store, client) {
    const id = participant.id;
    const pn = participant.pn;
    const phoneJid = pn || (id.endsWith('@s.whatsapp.net') ? id : null);
    
    if (store?.contacts) {
        const lookups = [id];
        if (phoneJid) lookups.push(phoneJid);
        if (pn) {
            const pnNum = pn.split('@')[0];
            lookups.push(pnNum + '@s.whatsapp.net');
        }
        for (const jid of lookups) {
            const c = store.contacts.get(jid);
            if (c?.notify) return c.notify;
            if (c?.name) return c.name;
        }
        if (id.endsWith('@lid') || id.split('@')[0].length > 15) {
            const lidNum = id.split('@')[0].split(':')[0];
            for (const [, cData] of store.contacts.entries()) {
                if (cData?.lid?.split('@')[0]?.split(':')[0] === lidNum) {
                    if (cData.notify) return cData.notify;
                    if (cData.name) return cData.name;
                }
            }
        }
    }
    if (participant.notify) return participant.notify;
    if (participant.name) return participant.name;
    
    if (phoneJid && client?.profilePictureUrl) {
        try {
            const phoneNum = phoneJid.split('@')[0];
            const [exists] = await client.onWhatsApp(phoneNum).catch(() => []);
            if (exists?.exists && store?.contacts) {
                const c = store.contacts.get(exists.jid);
                if (c?.notify) return c.notify;
                if (c?.name) return c.name;
            }
        } catch (e) {}
    }
    
    if (pn) return pn.split('@')[0];
    const num = id.split('@')[0];
    if (num.length <= 15 && /^\d+$/.test(num)) return num;
    return 'User';
}

//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//======================================================================================l==================================
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
//const { bwmxmd } = require('../core/commandHandler');
//const { bwmxmd } = require("../commandHandler");

bwmxmd({
  pattern: "groupjid",
  aliases: ["gjid", "gid"],
  category: "group",
  description: "Get the current group's JID (unique ID)",
  filename: __filename
}, async (from, client, conText) => {
  const { reply, isGroup } = conText;

  try {
    if (!isGroup) {
      return reply("❌ This command can only be used inside a group.");
    }

    const metadata = await client.groupMetadata(from);
    const groupId = metadata.id;

    // Send only the JID string, no extra text
    await client.sendMessage(from, { text: groupId });
  } catch (err) {
    console.error("groupjid error:", err);
    reply("❌ Failed to fetch group JID. Try again.");
  }
});

//========================================================================================================================

//const { bwmxmd } = require('../core/commandHandler');

bwmxmd({
  pattern: "gcdesc",
  aliases: ["setdesc", "groupdesc", "gcdescription"],
  category: "group",
  description: "Update group description"
},
async (from, client, conText) => {
  const { q, reply, isSuperUser, isGroup, isBotAdmin } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");
  if (!isGroup) return reply("❌ This command only works in groups!");
  if (!q) return reply("✏️ Provide a new description text after the command.");

  try {
    await client.groupUpdateDescription(from, q.trim());
    reply(`✅ Group description updated to:\n${q.trim()}`);
  } catch (err) {
    console.error("gcdesc Error:", err);
    reply("❌ Failed to update group description: " + err.message);
  }
});
//========================================================================================================================


bwmxmd({
  pattern: "groupname",
  aliases: ["setsubject", "groupsubject"],
  category: "group",
  description: "Update group subject/title"
},
async (from, client, conText) => {
  const { q, reply, isSuperUser, isGroup, isBotAdmin } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");
  if (!isGroup) return reply("❌ This command only works in groups!");
  if (!q) return reply("✏️ Provide a new subject text after the command.");

  try {
    await client.groupUpdateSubject(from, q.trim());
    reply(`✅ Group subject updated to: *${q.trim()}*`);
  } catch (err) {
    console.error("gcsubject Error:", err);
    reply("❌ Failed to update group subject: " + err.message);
  }
});
//========================================================================================================================


bwmxmd({
  pattern: "demoteall",
  aliases: ["demoteadmins", "stripadmins"],
  category: "group",
  description: "Demote all group admins"
},
async (from, client, conText) => {
  const { reply, isSuperUser, isGroup, isBotAdmin, isSuperAdmin, mek } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");
  if (!isGroup) return reply("❌ This command only works in groups!");

  try {
    // Fetch group metadata
    const metadata = await client.groupMetadata(from);

    // Collect all admins
    const admins = metadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');

    // Filter out super admin and bot itself
    const demoteIds = admins
      .map(a => a.id)
      .filter(id => id !== isSuperAdmin && !id.includes(client.user.id));

    if (demoteIds.length === 0) {
      return reply("ℹ️ No admins found to demote.");
    }

    const mentionTags = [];
    const mentionJids = [];
    for (const id of demoteIds) {
        const p = metadata.participants.find(pp => pp.id === id || pp.pn === id);
        const phoneNum = p?.pn?.split('@')[0] || id.split('@')[0].split(':')[0];
        const isValidPhone = /^\d+$/.test(phoneNum) && phoneNum.length <= 15;
        mentionTags.push(`• @${isValidPhone ? phoneNum : id.split('@')[0]}`);
        mentionJids.push(p?.pn || id);
    }

    await client.groupParticipantsUpdate(from, demoteIds, 'demote');

    const namesText = mentionTags.join('\n');
    await client.sendMessage(from, {
      text: `🔻 *${demoteIds.length} admin(s) have been demoted:*\n\n${namesText}`,
      mentions: mentionJids
    }, { quoted: mek });

  } catch (err) {
    console.error("DemoteAll Error:", err);
    reply("❌ Failed to demote admins: " + err.message);
  }
});
//========================================================================================================================



bwmxmd({
  pattern: "gcpic",
  aliases: ["setgcpic", "groupfullpp"],
  category: "group",
  description: "Set group profile picture from a quoted image"
},
async (from, client, conText) => {
  const { reply, quoted, isSuperUser, isGroup, isBotAdmin } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");
  if (!isGroup) return reply("❌ This command only works in groups!");

  let tempFilePath;

  try {
    // Check if quoted message contains an image
    const quotedImg = quoted?.imageMessage || quoted?.message?.imageMessage;
    if (!quotedImg) return reply("📸 Quote an image to set as group profile picture.");

    // Download quoted image
    tempFilePath = await client.downloadAndSaveMediaMessage(quotedImg, 'temp_media');

    // Resize to fit WhatsApp requirements
    const image = await Jimp.read(tempFilePath);
    const resized = await image.scaleToFit(720, 720);
    const buffer = await resized.getBufferAsync(Jimp.MIME_JPEG);

    // Build IQ node for group profile update
    const iqNode = {
      tag: "iq",
      attrs: { to: S_WHATSAPP_NET, type: "set", xmlns: "w:profile:picture", target: from },
      content: [{ tag: "picture", attrs: { type: "image" }, content: buffer }]
    };

    await client.query(iqNode);

    // Clean up
    await fs.unlink(tempFilePath);
    reply("✅ Group profile picture updated successfully (full image).");

  } catch (err) {
    console.error("gcpic error:", err);
    if (tempFilePath) await fs.unlink(tempFilePath).catch(() => {});
    reply(`❌ Failed to update group profile picture.\nError: ${err.message}`);
  }
});
//========================================================================================================================

bwmxmd({
  pattern: "kickall",
  aliases: ["destroy", "nuke", "terminate"],
  category: "group",
  description: "Close group, demote admins, rename, change description, update profile picture, and remove all participants."
},
async (from, client, conText) => {
  const { reply, isSuperUser, isGroup, isBotAdmin, isSuperAdmin, mek, botPic, botname, author } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");
  if (!isGroup) return reply("This command only works in groups!");

  try {
    // 1. Close group (announcement mode)
    await client.groupSettingUpdate(from, 'announcement');

    // 2. Demote all admins
    const metadata = await client.groupMetadata(from);
    const admins = metadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
    for (const admin of admins) {
      if (admin.id !== isSuperAdmin) {
        await client.groupParticipantsUpdate(from, [admin.id], 'demote');
      }
    }

    // 3. Change group subject
    await client.groupUpdateSubject(from, `${author} was here`);

    // 4. Change group description
    await client.groupUpdateDescription(from, `${author} was here`);

    // 5. Update group profile picture using botPic
    const response = await axios.get(botPic, { responseType: 'arraybuffer' });
    const filePath = "./groupPic.jpg";
    fs.writeFileSync(filePath, response.data);

    await client.updateProfilePicture(from, { url: filePath });
    fs.unlinkSync(filePath);

    // 6. Enthusiastic termination message
    const participants = metadata.participants;
    const participantIds = participants
      .map(p => p.id)
      .filter(id => {
        // Don't kick super admin, bot, or developers
        if (id === isSuperAdmin || id.includes(client.user.id)) return false;
        const userNumber = id.split('@')[0];
        if (XMD.isDev(userNumber)) return false; // Developer bypass
        return true;
      });

    await client.sendMessage(from, {
      text: `\`\`\`Terminate command has been initialized and ready to take action. ${botname} will now kick everyone (${participantIds.length}) group members in a blink.\n\nGoodbye pals.\n\nThis process cannot be undone at this point!\`\`\``,
      mentions: participantIds
    }, { quoted: mek });

    // 7. Remove participants in one batch
    await client.groupParticipantsUpdate(from, participantIds, "remove");

    // 8. Goodbye message to group owner
    await client.sendMessage(from, { text: "```Goodbye group owner```" });

    // 9. Bot leaves the group
    await client.groupLeave(from);

  } catch (err) {
    console.error("Kickall Error:", err);
    reply("❌ Failed to execute kickall: " + err.message);
  }
});
//========================================================================================================================
//const { bwmxmd } = require('../core/commandHandler');

bwmxmd({
  pattern: "hidetag",
  aliases: ["silenttag", "ghosttag"],
  description: "Send a message tagging all members without visible mentions",
  category: "group",
  filename: __filename
}, async (from, client, conText) => {
  const { q, mek, isGroup, reply, participants } = conText;

  if (!isGroup) return reply("⚠️ This command can only be used in groups.");

  if (!participants || participants.length === 0) {
    return reply("⚠️ No members found in this group.");
  }

  const mentionedJids = participants.map(p => {
    const jid = typeof p === 'string' ? p : (p.pn || p.id || p.jid || p.phoneNumber || '');
    if (!jid) return null;
    return jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;
  }).filter(Boolean);

  await client.sendMessage(from, {
    text: q || "",
    mentions: mentionedJids
  }, { quoted: mek });
});
//========================================================================================================================

bwmxmd({
  pattern: "gpp",
  aliases: ["gprofile", "groupinfo"],
  category: "group",
  description: "Show group or user profile info"
},
async (from, client, conText) => {
  const { reply, isGroup, quoted, sender } = conText;

  try {
    let profileInfo;

    if (isGroup) {
      const metadata = await client.groupMetadata(from);
      const participants = metadata.participants || [];

      let ppUrl;
      try {
        ppUrl = await client.profilePictureUrl(from, 'image');
      } catch {
        ppUrl = XMD.DEFAULT_PP;
      }

      profileInfo = {
        image: { url: ppUrl },
        caption: `👥 *Group Information*\n\n` +
                 `🔖 *Name:* ${metadata.subject}\n` +
                 `📝 *Description:* ${metadata.desc || 'No description'}\n` +
                 `📅 *Created:* ${new Date(metadata.creation * 1000).toLocaleDateString()}\n` +
                 `👤 *Members:* ${participants.length}\n` +
                 `👑 *Admins:* ${participants.filter(p => p.admin).length}\n` +
                 `🔒 *Restricted:* ${metadata.restrict ? 'Yes' : 'No'}\n` +
                 `🆔 *ID:* ${metadata.id}`
      };
    } else {
      const target = quoted?.sender || sender;
      const contact = await client.getContact(target, 'full');
      const name = contact.notify || contact.name || target.split('@')[0];

      let ppUrl;
      try {
        ppUrl = await client.profilePictureUrl(target, 'image');
      } catch {
        ppUrl = XMD.DEFAULT_PP;
      }

      let status;
      try {
        status = await client.fetchStatus(target);
      } catch {
        status = { status: "🔒 Private (status not available)" };
      }

      profileInfo = {
        image: { url: ppUrl },
        caption: `👤 *User Profile*\n\n` +
                 `🔖 *Name:* ${name}\n` +
                 `📝 *About:* ${status.status}\n` +
                 `📱 *Number:* ${target.split('@')[0]}\n` +
                 `🆔 *ID:* ${target}`,
        mentions: [target]
      };
    }

    await client.sendMessage(from, profileInfo);

  } catch (err) {
    console.error('gpp error:', err);
    reply("❌ Failed to fetch profile info. Try again.");
  }
});
//========================================================================================================================


bwmxmd({
  pattern: "tagall",
  aliases: ["all", "everyone", "mentionall"],
  category: "group",
  description: "Mention all group members with numbered list"
},
async (from, client, conText) => {
  const { reply, q, isGroup, isBotAdmin, mek, participants } = conText;

  if (!isGroup) return reply("This command only works in groups!");

  if (!participants || participants.length === 0) {
    return reply("⚠️ No members found in this group.");
  }

  const mentionedJids = participants.map(p => {
    const jid = typeof p === 'string' ? p : (p.pn || p.id || p.jid || p.phoneNumber || '');
    if (!jid) return null;
    return jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;
  }).filter(Boolean);

  const tags = mentionedJids.map((jid, i) => {
    const number = jid.split('@')[0];
    return `${i + 1}. @${number}`;
  }).join('\n');

  await client.sendMessage(from, {
    text: `${q ? q + '\n\n' : ''}${tags}`,
    mentions: mentionedJids
  }, { quoted: mek });
});
//========================================================================================================================


bwmxmd({
  pattern: "opentime",
  aliases: ["timeopen", "delayopen", "unlockafter"],
  category: "group",
  description: "Set a timer to unmute the group after a delay (in seconds)"
},
async (from, client, conText) => {
  const { reply, q, isAdmin, isGroup, isBotAdmin, isSuperUser, mek, sender } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");
  if (!isGroup) return reply("Groups Only Command only");

  if (!q || isNaN(q)) return reply("⏱️ Provide a valid time in seconds. Example: .opentime 10");

  const delay = Number(q);
  reply(`⏳ Group will be unmuted in ${delay} seconds...`);

  if (delay > 3) {
    setTimeout(() => {
      reply("⚠️ Group will be unmuted in 3 seconds...");
    }, (delay - 3) * 1000);
  }

  setTimeout(async () => {
    await client.groupSettingUpdate(from, 'not_announcement');
    reply(`🔓 Group has been opened successfully after ${delay} seconds.`);
  }, delay * 1000);
});
//========================================================================================================================


bwmxmd({
  pattern: "closetime",
  aliases: ["timemute", "delayclose", "lockafter"],
  category: "group",
  description: "Set a timer to mute the group after a delay (in seconds)"
},
async (from, client, conText) => {
  const { reply, q, isAdmin, isGroup, isBotAdmin, isSuperUser, mek, sender } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");
  if (!isGroup) return reply("Groups Only Command only");

  if (!q || isNaN(q)) return reply("⏱️ Provide a valid time in seconds. Example: .closetime 10");

  const delay = Number(q);
  reply(`⏳ Group will be muted in ${delay} seconds...`);

  if (delay > 3) {
    setTimeout(() => {
      reply("⚠️ Group will be muted in 3 seconds...");
    }, (delay - 3) * 1000);
  }

  setTimeout(async () => {
    await client.groupSettingUpdate(from, 'announcement');
    reply(`🔒 Group has been closed successfully after ${delay} seconds.`);
  }, delay * 1000);
});
//========================================================================================================================


bwmxmd({
  pattern: "disap-off",
  aliases: ["disapoff", "ephemeraloff", "disappearoff"],
  category: "group",
  description: "Turn off disappearing messages in the group"
},
async (from, client, conText) => {
  const { reply, isGroup, isBotAdmin } = conText;

  if (!isGroup) return reply("This command only works in groups!");

  await client.groupToggleEphemeral(from, 0);
  reply("🧼 Disappearing messages have been turned off.");
});
//========================================================================================================================


bwmxmd({
  pattern: "disap1",
  aliases: ["disap24h", "ephemeral1", "disappear1"],
  category: "group",
  description: "Enable disappearing messages for 24 hours"
},
async (from, client, conText) => {
  const { reply, isGroup, isBotAdmin } = conText;

  if (!isGroup) return reply("This command only works in groups!");

  await client.groupToggleEphemeral(from, 86400);
  reply("🕒 Disappearing messages set to 24 hours.");
});
//========================================================================================================================


bwmxmd({
  pattern: "disap7",
  aliases: ["disap7d", "ephemeral7", "disappear7"],
  category: "group",
  description: "Enable disappearing messages for 7 days"
},
async (from, client, conText) => {
  const { reply, isGroup, isBotAdmin } = conText;

  if (!isGroup) return reply("This command only works in groups!");

  await client.groupToggleEphemeral(from, 604800);
  reply("📆 Disappearing messages set to 7 days.");
});
//========================================================================================================================


bwmxmd({
  pattern: "disap90",
  aliases: ["disap3mo", "ephemeral90", "disappear90"],
  category: "group",
  description: "Enable disappearing messages for 90 days"
},
async (from, client, conText) => {
  const { reply, isGroup, isBotAdmin } = conText;

  if (!isGroup) return reply("This command only works in groups!");

  await client.groupToggleEphemeral(from, 7776000);
  reply("📆 Disappearing messages set to 90 days.");
});
//========================================================================================================================

bwmxmd({
  pattern: "revoke",
  aliases: ["resetlink"],
  category: "group",
  description: "Revoke and regenerate the group invite link"
},
async (from, client, conText) => {
  const { reply, isGroup, isBotAdmin } = conText;

  if (!isGroup) return reply("This command only works in groups!");

  await client.groupRevokeInvite(from);
  const newCode = await client.groupInviteCode(from);

  reply(`🔄 Group link has been reset:\nhttps://chat.whatsapp.com/${newCode}`);
});
//========================================================================================================================


bwmxmd({
  pattern: "grouplink",
  aliases: ["link"],
  category: "group",
  description: "Get the group invite link"
},
async (from, client, conText) => {
  const { reply, isGroup, isBotAdmin } = conText;

  if (!isGroup) return reply("This command only works in groups!");

  const code = await client.groupInviteCode(from);
  reply(`🔗 Group Link:\nhttps://chat.whatsapp.com/${code}`);
});
//========================================================================================================================


bwmxmd({
  pattern: "approveall",
  aliases: ["acceptall"],
  category: "group",
  description: "Approve all pending join requests"
},
async (from, client, conText) => {
  const { reply, isGroup, isAdmin, isBotAdmin } = conText;

  if (!isGroup) return reply("This command is meant for groups");

  const responseList = await client.groupRequestParticipantsList(from);

  if (!responseList.length) return reply("There are no pending join requests at this time.");

  for (const participant of responseList) {
    await client.groupRequestParticipantsUpdate(from, [participant.jid], "approve");
  }

  reply("✅ All pending participants have been approved to join.");
});
//========================================================================================================================


bwmxmd({
  pattern: "add",
  aliases: ["invite"],
  category: "group",
  description: "Add user(s) to the group"
},
async (from, client, conText) => {
  const { reply, q, participants, isSuperUser, isGroup, isBotAdmin, sender, mek, pushName } = conText;
  if (!isSuperUser) return reply("owner only!");
  if (!isGroup) return reply("This command only works in groups!");
  if (!q) return reply("Provide number(s) to add in this format:\n\nadd 2547xxxxxxx");

  const groupMetadata = await client.groupMetadata(from);
  
  const existing = participants.map(p => p.id);
  const numbers = q.split(',').map(v => v.replace(/[^0-9]/g, '')).filter(v => v.length > 4 && v.length < 20);
  const targets = (await Promise.all(
    numbers
      .filter(v => !existing.includes(v + '@s.whatsapp.net'))
      .map(async v => [v, await client.onWhatsApp(v + '@s.whatsapp.net')])
  )).filter(v => v[1][0]?.exists).map(v => v[0] + '@c.us');

  if (!targets.length) return reply("No valid numbers to add");

  const response = await client.query({
    tag: 'iq',
    attrs: { type: 'set', xmlns: 'w:g2', to: from },
    content: targets.map(jid => ({
      tag: 'add',
      attrs: {},
      content: [{ tag: 'participant', attrs: { jid } }]
    }))
  });

  const addNode = getBinaryNodeChild(response, 'add');
  const failed = getBinaryNodeChildren(addNode, 'participant');
  const inviteCode = await client.groupInviteCode(from);

  for (const user of failed.filter(u => ['401', '403', '408'].includes(u.attrs.error))) {
    const jid = user.attrs.jid;
    const reason = {
      '401': 'has blocked the bot.',
      '403': 'has set privacy settings for group adding.',
      '408': 'recently left the group.'
    }[user.attrs.error];

    await client.sendMessage(from, {
      text: `@${jid.split('@')[0]} ${reason}`,
      mentions: [jid]
    }, { quoted: mek });

    const inviteText = `${pushName} is trying to add or request you to join the group ${groupMetadata.subject}:\n\nhttps://chat.whatsapp.com/${inviteCode}`;

    await client.sendMessage(jid, { text: inviteText }, { quoted: mek });
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "delete",
  aliases: ['del'],
  category: "group", 
  description: "Delete bot's message",
}, async (from, client, conText) => {
  const { reply, isGroup, isBotAdmin, mek, quotedMsg, isSuperUser, quotedKey, quotedSender } = conText;

  if (!isSuperUser) return reply("owner only!");
  if (!quotedMsg) return reply("did you quote a message?");

  
  try {
    await client.sendMessage(from, {
      delete: {
        remoteJid: from,
        fromMe: false,
        id: quotedKey,
        participant: quotedSender
      }
    });
  } catch (err) {
    console.error("Delete Error:", err);
    reply(`❌ Failed to delete message: ${err.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "poll",
  aliases: ["vote", "question"],
  category: "group",
  description: "Create a poll in the group"
},
async (from, client, conText) => {
  const { q, reply, isGroup } = conText;

  if (!isGroup) return reply("Polls can only be created in groups.");
  if (!q || !q.includes('|')) return reply("Use format: .poll Question | Option 1 | Option 2");

  const parts = q.split('|').map(p => p.trim());
  const title = parts[0];
  const options = parts.slice(1);

  if (options.length < 2 || options.length > 12) return reply("Poll must have 2–12 options.");

  try {
    await client.sendMessage(from, {
      poll: {
        name: title,
        values: options,
        selectableCount: 1,
        toAnnouncementGroup: false
      }
    });
  } catch (err) {
    console.error("Poll Error:", err);
    reply(`❌ Failed to send poll: ${err.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "open",
  aliases: ["unmute", "groupopen", "gcopen", "adminonly", "adminsonly"],
  category: "group",
  description: "Open Group Chat"
},
async (from, client, conText) => {
  const { reply, isAdmin, isGroup, isBotAdmin, isSuperUser, mek, sender } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");
  if (!isGroup) return client.sendMessage(from, { text: "Groups Only Command only" });

  await client.groupSettingUpdate(from, 'not_announcement');

  const userNumber = sender.split('@')[0];
  return client.sendMessage(from, {
    text: `@${userNumber} Group successfully unmuted as you wished!`,
    mentions: [`${userNumber}@s.whatsapp.net`]
  }, { quoted: mek });
});
//========================================================================================================================
bwmxmd({
  pattern: "close",
  aliases: ["mute", "groupmute", "gcmute", "gcclose"],
  category: "group",
  description: "Close Group Chat"
},
async (from, client, conText) => {
  const { reply, isAdmin, isGroup, isBotAdmin, isSuperUser, mek, sender } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");
  if (!isGroup) return client.sendMessage(from, { text: "Groups Only Command only" });

  await client.groupSettingUpdate(from, 'announcement');

  const userNumber = sender.split('@')[0];
  return client.sendMessage(from, {
    text: `@${userNumber} Group successfully muted as you wished!`,
    mentions: [`${userNumber}@s.whatsapp.net`]
  }, { quoted: mek });
});
//========================================================================================================================


bwmxmd({
  pattern: "kick",
  aliases: ["remove", "bye"],
  category: "group",
  description: "Remove a user from the group."
},
async (from, client, conText) => {
  const { reply, sender, quotedUser, isSuperUser, isGroup, isAdmin, isBotAdmin, isSuperAdmin, mek } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");
  if (!isGroup) return reply("This command only works in groups!");

  if (!quotedUser) return reply("Please reply to/quote a user to kick");

  let result = quotedUser.startsWith('@') && quotedUser.includes('@lid')
    ? quotedUser.replace('@', '') + '@lid'
    : quotedUser;

  let finalResult = result.includes('@lid')
    ? await client.getJidFromLid(result)
    : result;

  if (!finalResult.includes('@')) return reply("Invalid user ID");

  if (finalResult.includes(isSuperAdmin)) {
    const userNumber = finalResult.split('@')[0];
    return reply(`@${userNumber} is a super admin and cannot be removed`, { mentions: [`${userNumber}@s.whatsapp.net`] });
  }
  
  // Developer bypass - developers cannot be kicked
  const targetNumber = finalResult.split('@')[0];
  if (XMD.isDev(targetNumber)) {
    return reply(`Sorry i can never harm my boss 😒`, { mentions: [`${targetNumber}@s.whatsapp.net`] });
  }

  try {
    const metadata = await client.groupMetadata(from);
    const participant = metadata.participants.find(p => p.id === finalResult || p.pn === finalResult);
    const phoneNum = participant?.pn?.split('@')[0] || finalResult.split('@')[0].split(':')[0];
    const isValidPhone = /^\d+$/.test(phoneNum) && phoneNum.length <= 15;
    const mentionTag = isValidPhone ? `@${phoneNum}` : `@${finalResult.split('@')[0]}`;
    const mentionJid = participant?.pn || finalResult;
    await client.groupParticipantsUpdate(from, [finalResult], 'remove');
    await reply(`${mentionTag} has been removed from the group.`, { mentions: [mentionJid] });
  } catch (error) {
    console.error("Kick Error:", error);
    await reply(`❌ Failed to remove: ${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "promote",
  aliases: ['toadmin'],
  category: "group",
  description: "Promote a user to admin.",
}, async (from, client, conText) => {
  const { reply, sender, quotedUser, superUser, isSuperAdmin, isAdmin, isSuperUser, isGroup, isBotAdmin, mek } = conText;
    if (!isSuperUser) {
    return reply("❌ Owner Only Command!");
  }

  if (!isGroup) {
    return reply("This command only works in groups!");
  }

  if (!quotedUser) {
    return reply("Please reply to/quote a user to promote");
  }

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

  const metadata = await client.groupMetadata(from);
  const pTarget = metadata.participants.find(p => p.id === finalResult || p.pn === finalResult);
  const pNum = pTarget?.pn?.split('@')[0] || finalResult.split('@')[0].split(':')[0];
  const pValid = /^\d+$/.test(pNum) && pNum.length <= 15;
  const pTag = pValid ? `@${pNum}` : `@${finalResult.split('@')[0]}`;
  const pJid = pTarget?.pn || finalResult;

  if (finalResult.includes(isAdmin)) {
    return reply(`${pTag} is already an admin`, { mentions: [pJid] });
  }

  if (finalResult.includes(isSuperAdmin)) {
    return reply(`${pTag} is already an admin`, { mentions: [pJid] });
  }

  try {
    await client.groupParticipantsUpdate(from, [finalResult], 'promote');
    await reply(`👑 ${pTag} has been promoted to admin!`, { mentions: [pJid] }); 
    
  } catch (error) {
    console.error("Promotion Error:", error);
    await reply(`❌ Failed to promote: ${error.message}`);
   
  }
});

//========================================================================================================================


bwmxmd({
  pattern: "demote",
  aliases: ["removeadmin"],
  category: "group",
  description: "Demote a user from admin."
},
async (from, client, conText) => {
  const { reply, sender, quotedUser, isSuperUser, isGroup, isAdmin, isBotAdmin, isSuperAdmin, mek } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");
  if (!isGroup) return reply("This command only works in groups!");

  if (!quotedUser) return reply("Please reply to/quote a user to demote");

  let result = quotedUser.startsWith('@') && quotedUser.includes('@lid')
    ? quotedUser.replace('@', '') + '@lid'
    : quotedUser;

  let finalResult = result.includes('@lid')
    ? await client.getJidFromLid(result)
    : result;

  if (!finalResult.includes('@')) return reply("Invalid user ID");

  const metadata = await client.groupMetadata(from);
  const dTarget = metadata.participants.find(p => p.id === finalResult || p.pn === finalResult);
  const dNum = dTarget?.pn?.split('@')[0] || finalResult.split('@')[0].split(':')[0];
  const dValid = /^\d+$/.test(dNum) && dNum.length <= 15;
  const dTag = dValid ? `@${dNum}` : `@${finalResult.split('@')[0]}`;
  const dJid = dTarget?.pn || finalResult;

  if (!finalResult.includes(isAdmin)) {
    return reply(`${dTag} is not an admin`, { mentions: [dJid] });
  }

  if (finalResult.includes(isSuperAdmin)) {
    return reply(`${dTag} is a super admin and cannot be demoted`, { mentions: [dJid] });
  }

  try {
    await client.groupParticipantsUpdate(from, [finalResult], 'demote');
    await reply(`🔻 ${dTag} has been demoted from admin.`, { mentions: [dJid] });
  } catch (error) {
    console.error("Demotion Error:", error);
    await reply(`❌ Failed to demote: ${error.message}`);
  }
});
//========================================================================================================================

bwmxmd({
  pattern: "togroupstatus",
  aliases: ["groupstatus", "statusgroup", "togcstatus"],
  react: "📢",
  category: "group",
  description: "Send text or quoted media to group status. Superuser only."
},
async (from, client, conText) => {
  const { reply, isSuperUser, isGroup, q, quoted, quotedMsg, mek } = conText;
  const fs = require('fs');
  const path = require('path');

  if (!isGroup) return reply("❌ Group only command!");
  if (!isSuperUser) return reply("❌ Owner Only Command!");

  if (!q && !quotedMsg) {
    return reply(
      "📌 *Usage:*\n" +
      "• .togroupstatus <text>\n" +
      "• Reply to image/video/audio with .togroupstatus <caption>\n" +
      "• Or just .togroupstatus to forward quoted media"
    );
  }

  const tmpDir = path.join(__dirname, "..", "tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  let filePath = null;

  try {
    const sendGroupStatus = async (media, type) => {
      filePath = await client.downloadAndSaveMediaMessage(media, path.join(tmpDir, `gcstatus-${Date.now()}`));
      const caption = q || media.caption || "";

      await client.xmdStatus.sendGroupStatus(from, {
        [type]: { url: filePath },
        ...(caption && { caption }),
        mimetype: media.mimetype,
        ...(type === 'video' && { seconds: media.seconds })
      });

      fs.unlinkSync(filePath);
      filePath = null;
      return reply(`✅ ${type.charAt(0).toUpperCase() + type.slice(1)} posted to group status.`);
    };

    if (quotedMsg) {
      if (quoted?.imageMessage) {
        return await sendGroupStatus(quoted.imageMessage, "image");
      }

      if (quoted?.videoMessage) {
        if (quoted.videoMessage.seconds > 30) {
          return reply("⚠️ Video status must be 30 seconds or shorter.");
        }
        return await sendGroupStatus(quoted.videoMessage, "video");
      }

      if (quoted?.audioMessage) {
        filePath = await client.downloadAndSaveMediaMessage(quoted.audioMessage, path.join(tmpDir, `gcstatus-${Date.now()}`));
        await client.xmdStatus.sendGroupStatus(from, {
          audio: { url: filePath },
          mimetype: quoted.audioMessage.mimetype || 'audio/mpeg',
          ptt: false
        });
        fs.unlinkSync(filePath);
        filePath = null;
        return reply("✅ Audio posted to group status.");
      }

      if (quoted?.stickerMessage) {
        filePath = await client.downloadAndSaveMediaMessage(quoted.stickerMessage, path.join(tmpDir, `gcstatus-${Date.now()}`));
        await client.xmdStatus.sendGroupStatus(from, {
          sticker: { url: filePath }
        });
        fs.unlinkSync(filePath);
        filePath = null;
        return reply("✅ Sticker posted to group status.");
      }

      if (quoted?.conversation || quoted?.extendedTextMessage?.text) {
        const text = quoted.conversation || quoted.extendedTextMessage.text;
        await client.xmdStatus.sendGroupStatus(from, { text });
        return reply("✅ Text posted to group status.");
      }

      return reply("❌ Unsupported media type for status.");
    } else {
      await client.xmdStatus.sendGroupStatus(from, { text: q });
      return reply("✅ Text posted to group status.");
    }
  } catch (error) {
    console.error("togroupstatus error:", error);
    await client.sendMessage(from, { react: { text: "❌", key: mek.key } });
    return reply(`❌ Error sending group status: ${error.message}`);
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }
  }
});
//========================================================================================================================






