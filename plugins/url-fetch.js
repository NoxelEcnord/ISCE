const { bwmxmd } = require('../core/commandHandler');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const FormData = require('form-data');
const mime = require('mime-types');
const XMD = require('../core/xmd');

const getContactMsg = (contactName, sender) => XMD.getContactMsg(contactName, sender);

function getMediaType(quoted) {
  if (quoted.imageMessage) return "image";
  if (quoted.videoMessage) return "video";
  if (quoted.stickerMessage) return "sticker";
  if (quoted.audioMessage) return "audio";
  return "unknown";
}

async function saveMediaToTemp(client, quotedMedia, type) {
  const tmpDir = path.join(__dirname, "..", "tmp");
  await fs.ensureDir(tmpDir);
  const fileName = `${type}-${Date.now()}`;
  const filePath = path.join(tmpDir, fileName);
  const savedPath = await client.downloadAndSaveMediaMessage(quotedMedia, filePath);
  return savedPath;
}

async function uploadToCatbox(filePath) {
  const buffer = await fs.readFile(filePath);
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', buffer, {
    filename: path.basename(filePath),
    contentType: mime.lookup(path.extname(filePath)) || 'application/octet-stream'
  });

  const { data } = await axios.post(XMD.CATBOX_API, form, {
    headers: form.getHeaders(),
    maxContentLength: Infinity,
    maxBodyLength: Infinity
  });

  return data.trim(); // Catbox returns the full valid URL
}

bwmxmd({
  pattern: "url",
  aliases: ["upload", "urlconvert"],
  description: "Convert quoted media to Catbox URL",
  category: "Uploader",
  filename: __filename
}, async (from, client, conText) => {
  const { mek, quoted, quotedMsg, reply } = conText;

  if (!quotedMsg) return reply("📌 Please quote an image, video, audio, or sticker to upload.");

  const type = getMediaType(quotedMsg);
  if (type === "unknown") return reply("❌ Unsupported media type.");

  const mediaNode =
    quoted?.imageMessage ||
    quoted?.videoMessage ||
    quoted?.audioMessage ||
    quoted?.stickerMessage;

  if (!mediaNode) return reply("❌ Could not extract media content.");

  let filePath;
  try {
    filePath = await saveMediaToTemp(client, mediaNode, type);
    const link = await uploadToCatbox(filePath);
    await client.sendMessage(from, { text: link }, { quoted: mek });
  } catch (err) {
    console.error("Upload error:", err);
    await reply("❌ Failed to upload. Error:\n" + err.message);
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) { console.error("unlink error:", e); }
    }
  }
});
