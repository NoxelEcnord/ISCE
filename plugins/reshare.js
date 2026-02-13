const { bwmxmd } = require('../core/commandHandler');
const fs = require('fs');
const path = require('path');

const jidsPath = path.join(__dirname, '..', 'core', 'jids.json');
let statusJidList = [];
try {
  const allJids = JSON.parse(fs.readFileSync(jidsPath, 'utf-8'));
  // ✅ Only keep contacts ending with @s.whatsapp.net
  statusJidList = allJids.filter(jid => typeof jid === "string" && jid.endsWith('@s.whatsapp.net'));
} catch (err) {
  console.error('Error reading jids.json:', err);
}

bwmxmd({
  pattern: "reshare",
  aliases: ["story", "tostatus", "poststatus", "sendstatus"],
  description: "Post a status visible only to selected contacts (@s.whatsapp.net only)",
  category: "Owner",
  filename: __filename
}, async (from, client, conText) => {
  const { mek, quoted, quotedMsg, reply, isSuperUser } = conText;

  if (!isSuperUser) {
    return reply("❌ Owner Only Command!");
  }

  if (!quotedMsg) return reply("❌ Please quote an image or video message to post.");
  if (statusJidList.length === 0) return reply("❌ No valid @s.whatsapp.net contacts configured for private status.");

  try {
    const tmpDir = path.join(__dirname, "..", "tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const sendStatus = async (media, type) => {
      const filePath = await client.downloadAndSaveMediaMessage(media, path.join(tmpDir, `${type}-${Date.now()}`));
      const caption = media.caption || "";

      const statusOptions = {
        statusJidList, // ✅ filtered list only
        backgroundColor: '#000000'
      };

      await client.sendMessage("status@broadcast", {
        [type]: { url: filePath },
        ...(caption && { caption }),
        mimetype: media.mimetype,
        ...(type === 'video' && { seconds: media.seconds })
      }, statusOptions);

      fs.unlinkSync(filePath);
      return reply(`✅ ${type.charAt(0).toUpperCase() + type.slice(1)} posted to ${statusJidList.length} contacts.`);
    };

    if (quoted?.imageMessage) {
      return await sendStatus(quoted.imageMessage, "image");
    }

    if (quoted?.videoMessage) {
      if (quoted.videoMessage.seconds > 30) {
        return reply("⚠️ Video status must be 30 seconds or shorter.");
      }
      return await sendStatus(quoted.videoMessage, "video");
    }

    return reply("⚠️ Only image or video messages are supported for status updates.");
  } catch (err) {
    console.error("tostatus error:", err);
    return reply("❌ Failed to post status. Error: " + err.message);
  }
});


bwmxmd({
  pattern: "jidcount",
  aliases: ["totaljids", "jidsize"],
  description: "Show total number of saved JIDs",
  category: "Owner",
  filename: __filename
}, async (from, client, conText) => {
  const { reply, isSuperUser } = conText;

  if (!isSuperUser) {
    return reply("❌ Owner Only Command!");
  }

  try {
    const total = statusJidList.length;
    return reply(`📌 Total saved JIDs: *${total}*`);
  } catch (err) {
    console.error("jidcount error:", err);
    return reply("❌ Failed to read JIDs. Error: " + err.message);
  }
});
