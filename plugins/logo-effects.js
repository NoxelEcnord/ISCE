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

async function uploadToUguu(filePath) {
  if (!fs.existsSync(filePath)) throw new Error("File does not exist");

  const mimeType = mime.lookup(filePath) || 'application/octet-stream';
  const form = new FormData();
  form.append('files[]', fs.createReadStream(filePath), {
    filename: path.basename(filePath),
    contentType: mimeType
  });

  const response = await axios.post(XMD.API.EFFECTS.UGUU_UPLOAD, form, {
    headers: {
      ...form.getHeaders(),
      'origin': 'https://uguu.se',
      'referer': 'https://uguu.se/',
      'user-agent': 'Mozilla/5.0'
    }
  });

  const result = response.data;
  if (result.success && result.files?.[0]?.url) {
    return result.files[0].url;
  } else {
    throw new Error("Uguu upload failed or malformed response");
  }
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
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
bwmxmd({
  pattern: "countryhouse",
  category: "photofunia",
  description: "Apply sketch effect to quoted image"
},
async (from, client, conText) => {
  const { mek, quoted, quotedMsg, reply } = conText;

  if (!quotedMsg) return reply("📌 Reply to an image message to apply  effect");

  const type = getMediaType(quotedMsg);
  if (type !== "image") return reply("❌ Only image messages are supported");

  const mediaNode = quoted?.imageMessage;
  if (!mediaNode) return reply("❌ Could not extract image content");

  let filePath;
  try {
    // Save quoted image locally
    filePath = await saveMediaToTemp(client, mediaNode, type);

    // Upload to Uguu to get a public URL
    const imageUrl = await uploadToUguu(filePath);

    // Call sketch effect API
    const { data: result } = await axios.get(
      XMD.API.EFFECTS.APPLY('countryhouse', imageUrl)
    );

    if (!result?.results || !Array.isArray(result.results) || result.results.length === 0) {
      return reply("❌ No response from  API");
    }

    // Pick Regular size by default
    const sketchUrl = result.results.find(r => r.size === "Regular")?.url || result.results[0].url;

    // Send back the processed image
    await client.sendMessage(from, { image: { url: sketchUrl } }, { quoted: mek });

  } catch (err) {
    console.error("Sketch effect error:", err);
    await reply("❌ Failed to apply effect. Try a different image.");
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "musketeers",
  category: "photofunia",
  description: "Apply sketch effect to quoted image"
},
async (from, client, conText) => {
  const { mek, quoted, quotedMsg, reply } = conText;

  if (!quotedMsg) return reply("📌 Reply to an image message to apply  effect");

  const type = getMediaType(quotedMsg);
  if (type !== "image") return reply("❌ Only image messages are supported");

  const mediaNode = quoted?.imageMessage;
  if (!mediaNode) return reply("❌ Could not extract image content");

  let filePath;
  try {
    // Save quoted image locally
    filePath = await saveMediaToTemp(client, mediaNode, type);

    // Upload to Uguu to get a public URL
    const imageUrl = await uploadToUguu(filePath);

    // Call sketch effect API
    const { data: result } = await axios.get(
      XMD.API.EFFECTS.APPLY('musketeers', imageUrl)
    );

    if (!result?.results || !Array.isArray(result.results) || result.results.length === 0) {
      return reply("❌ No response from  API");
    }

    // Pick Regular size by default
    const sketchUrl = result.results.find(r => r.size === "Regular")?.url || result.results[0].url;

    // Send back the processed image
    await client.sendMessage(from, { image: { url: sketchUrl } }, { quoted: mek });

  } catch (err) {
    console.error("Sketch effect error:", err);
    await reply("❌ Failed to apply effect. Try a different image.");
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "jedi",
  category: "photofunia",
  description: "Apply sketch effect to quoted image"
},
async (from, client, conText) => {
  const { mek, quoted, quotedMsg, reply } = conText;

  if (!quotedMsg) return reply("📌 Reply to an image message to apply  effect");

  const type = getMediaType(quotedMsg);
  if (type !== "image") return reply("❌ Only image messages are supported");

  const mediaNode = quoted?.imageMessage;
  if (!mediaNode) return reply("❌ Could not extract image content");

  let filePath;
  try {
    // Save quoted image locally
    filePath = await saveMediaToTemp(client, mediaNode, type);

    // Upload to Uguu to get a public URL
    const imageUrl = await uploadToUguu(filePath);

    // Call sketch effect API
    const { data: result } = await axios.get(
      XMD.API.EFFECTS.APPLY('jedi', imageUrl)
    );

    if (!result?.results || !Array.isArray(result.results) || result.results.length === 0) {
      return reply("❌ No response from  API");
    }

    // Pick Regular size by default
    const sketchUrl = result.results.find(r => r.size === "Regular")?.url || result.results[0].url;

    // Send back the processed image
    await client.sendMessage(from, { image: { url: sketchUrl } }, { quoted: mek });

  } catch (err) {
    console.error("Sketch effect error:", err);
    await reply("❌ Failed to apply effect. Try a different image.");
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "knight",
  category: "photofunia",
  description: "Apply sketch effect to quoted image"
},
async (from, client, conText) => {
  const { mek, quoted, quotedMsg, reply } = conText;

  if (!quotedMsg) return reply("📌 Reply to an image message to apply  effect");

  const type = getMediaType(quotedMsg);
  if (type !== "image") return reply("❌ Only image messages are supported");

  const mediaNode = quoted?.imageMessage;
  if (!mediaNode) return reply("❌ Could not extract image content");

  let filePath;
  try {
    // Save quoted image locally
    filePath = await saveMediaToTemp(client, mediaNode, type);

    // Upload to Uguu to get a public URL
    const imageUrl = await uploadToUguu(filePath);

    // Call sketch effect API
    const { data: result } = await axios.get(
      XMD.API.EFFECTS.APPLY('knight', imageUrl)
    );

    if (!result?.results || !Array.isArray(result.results) || result.results.length === 0) {
      return reply("❌ No response from  API");
    }

    // Pick Regular size by default
    const sketchUrl = result.results.find(r => r.size === "Regular")?.url || result.results[0].url;

    // Send back the processed image
    await client.sendMessage(from, { image: { url: sketchUrl } }, { quoted: mek });

  } catch (err) {
    console.error("Sketch effect error:", err);
    await reply("❌ Failed to apply effect. Try a different image.");
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "halloween",
  category: "photofunia",
  description: "Apply sketch effect to quoted image"
},
async (from, client, conText) => {
  const { mek, quoted, quotedMsg, reply } = conText;

  if (!quotedMsg) return reply("📌 Reply to an image message to apply  effect");

  const type = getMediaType(quotedMsg);
  if (type !== "image") return reply("❌ Only image messages are supported");

  const mediaNode = quoted?.imageMessage;
  if (!mediaNode) return reply("❌ Could not extract image content");

  let filePath;
  try {
    // Save quoted image locally
    filePath = await saveMediaToTemp(client, mediaNode, type);

    // Upload to Uguu to get a public URL
    const imageUrl = await uploadToUguu(filePath);

    // Call sketch effect API
    const { data: result } = await axios.get(
      XMD.API.EFFECTS.APPLY('halloween', imageUrl)
    );

    if (!result?.results || !Array.isArray(result.results) || result.results.length === 0) {
      return reply("❌ No response from  API");
    }

    // Pick Regular size by default
    const sketchUrl = result.results.find(r => r.size === "Regular")?.url || result.results[0].url;

    // Send back the processed image
    await client.sendMessage(from, { image: { url: sketchUrl } }, { quoted: mek });

  } catch (err) {
    console.error("Sketch effect error:", err);
    await reply("❌ Failed to apply effect. Try a different image.");
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "admirer",
  category: "photofunia",
  description: "Apply sketch effect to quoted image"
},
async (from, client, conText) => {
  const { mek, quoted, quotedMsg, reply } = conText;

  if (!quotedMsg) return reply("📌 Reply to an image message to apply  effect");

  const type = getMediaType(quotedMsg);
  if (type !== "image") return reply("❌ Only image messages are supported");

  const mediaNode = quoted?.imageMessage;
  if (!mediaNode) return reply("❌ Could not extract image content");

  let filePath;
  try {
    // Save quoted image locally
    filePath = await saveMediaToTemp(client, mediaNode, type);

    // Upload to Uguu to get a public URL
    const imageUrl = await uploadToUguu(filePath);

    // Call sketch effect API
    const { data: result } = await axios.get(
      XMD.API.EFFECTS.APPLY('admirer', imageUrl)
    );

    if (!result?.results || !Array.isArray(result.results) || result.results.length === 0) {
      return reply("❌ No response from  API");
    }

    // Pick Regular size by default
    const sketchUrl = result.results.find(r => r.size === "Regular")?.url || result.results[0].url;

    // Send back the processed image
    await client.sendMessage(from, { image: { url: sketchUrl } }, { quoted: mek });

  } catch (err) {
    console.error("Sketch effect error:", err);
    await reply("❌ Failed to apply effect. Try a different image.");
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "magic",
  category: "photofunia",
  description: "Apply sketch effect to quoted image"
},
async (from, client, conText) => {
  const { mek, quoted, quotedMsg, reply } = conText;

  if (!quotedMsg) return reply("📌 Reply to an image message to apply  effect");

  const type = getMediaType(quotedMsg);
  if (type !== "image") return reply("❌ Only image messages are supported");

  const mediaNode = quoted?.imageMessage;
  if (!mediaNode) return reply("❌ Could not extract image content");

  let filePath;
  try {
    // Save quoted image locally
    filePath = await saveMediaToTemp(client, mediaNode, type);

    // Upload to Uguu to get a public URL
    const imageUrl = await uploadToUguu(filePath);

    // Call sketch effect API
    const { data: result } = await axios.get(
      XMD.API.EFFECTS.APPLY('magic', imageUrl)
    );

    if (!result?.results || !Array.isArray(result.results) || result.results.length === 0) {
      return reply("❌ No response from  API");
    }

    // Pick Regular size by default
    const sketchUrl = result.results.find(r => r.size === "Regular")?.url || result.results[0].url;

    // Send back the processed image
    await client.sendMessage(from, { image: { url: sketchUrl } }, { quoted: mek });

  } catch (err) {
    console.error("Sketch effect error:", err);
    await reply("❌ Failed to apply effect. Try a different image.");
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "shopping",
  category: "photofunia",
  description: "Apply sketch effect to quoted image"
},
async (from, client, conText) => {
  const { mek, quoted, quotedMsg, reply } = conText;

  if (!quotedMsg) return reply("📌 Reply to an image message to apply  effect");

  const type = getMediaType(quotedMsg);
  if (type !== "image") return reply("❌ Only image messages are supported");

  const mediaNode = quoted?.imageMessage;
  if (!mediaNode) return reply("❌ Could not extract image content");

  let filePath;
  try {
    // Save quoted image locally
    filePath = await saveMediaToTemp(client, mediaNode, type);

    // Upload to Uguu to get a public URL
    const imageUrl = await uploadToUguu(filePath);

    // Call sketch effect API
    const { data: result } = await axios.get(
      XMD.API.EFFECTS.APPLY('shopping', imageUrl)
    );

    if (!result?.results || !Array.isArray(result.results) || result.results.length === 0) {
      return reply("❌ No response from  API");
    }

    // Pick Regular size by default
    const sketchUrl = result.results.find(r => r.size === "Regular")?.url || result.results[0].url;

    // Send back the processed image
    await client.sendMessage(from, { image: { url: sketchUrl } }, { quoted: mek });

  } catch (err) {
    console.error("Sketch effect error:", err);
    await reply("❌ Failed to apply effect. Try a different image.");
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "interior",
  category: "photofunia",
  description: "Apply sketch effect to quoted image"
},
async (from, client, conText) => {
  const { mek, quoted, quotedMsg, reply } = conText;

  if (!quotedMsg) return reply("📌 Reply to an image message to apply  effect");

  const type = getMediaType(quotedMsg);
  if (type !== "image") return reply("❌ Only image messages are supported");

  const mediaNode = quoted?.imageMessage;
  if (!mediaNode) return reply("❌ Could not extract image content");

  let filePath;
  try {
    // Save quoted image locally
    filePath = await saveMediaToTemp(client, mediaNode, type);

    // Upload to Uguu to get a public URL
    const imageUrl = await uploadToUguu(filePath);

    // Call sketch effect API
    const { data: result } = await axios.get(
      XMD.API.EFFECTS.APPLY('interior', imageUrl)
    );

    if (!result?.results || !Array.isArray(result.results) || result.results.length === 0) {
      return reply("❌ No response from  API");
    }

    // Pick Regular size by default
    const sketchUrl = result.results.find(r => r.size === "Regular")?.url || result.results[0].url;

    // Send back the processed image
    await client.sendMessage(from, { image: { url: sketchUrl } }, { quoted: mek });

  } catch (err) {
    console.error("Sketch effect error:", err);
    await reply("❌ Failed to apply effect. Try a different image.");
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "shredder",
  category: "photofunia",
  description: "Apply sketch effect to quoted image"
},
async (from, client, conText) => {
  const { mek, quoted, quotedMsg, reply } = conText;

  if (!quotedMsg) return reply("📌 Reply to an image message to apply  effect");

  const type = getMediaType(quotedMsg);
  if (type !== "image") return reply("❌ Only image messages are supported");

  const mediaNode = quoted?.imageMessage;
  if (!mediaNode) return reply("❌ Could not extract image content");

  let filePath;
  try {
    // Save quoted image locally
    filePath = await saveMediaToTemp(client, mediaNode, type);

    // Upload to Uguu to get a public URL
    const imageUrl = await uploadToUguu(filePath);

    // Call sketch effect API
    const { data: result } = await axios.get(
      XMD.API.EFFECTS.APPLY('shredder', imageUrl)
    );

    if (!result?.results || !Array.isArray(result.results) || result.results.length === 0) {
      return reply("❌ No response from  API");
    }

    // Pick Regular size by default
    const sketchUrl = result.results.find(r => r.size === "Regular")?.url || result.results[0].url;

    // Send back the processed image
    await client.sendMessage(from, { image: { url: sketchUrl } }, { quoted: mek });

  } catch (err) {
    console.error("Sketch effect error:", err);
    await reply("❌ Failed to apply effect. Try a different image.");
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "woods",
  category: "photofunia",
  description: "Apply sketch effect to quoted image"
},
async (from, client, conText) => {
  const { mek, quoted, quotedMsg, reply } = conText;

  if (!quotedMsg) return reply("📌 Reply to an image message to apply  effect");

  const type = getMediaType(quotedMsg);
  if (type !== "image") return reply("❌ Only image messages are supported");

  const mediaNode = quoted?.imageMessage;
  if (!mediaNode) return reply("❌ Could not extract image content");

  let filePath;
  try {
    // Save quoted image locally
    filePath = await saveMediaToTemp(client, mediaNode, type);

    // Upload to Uguu to get a public URL
    const imageUrl = await uploadToUguu(filePath);

    // Call sketch effect API
    const { data: result } = await axios.get(
      XMD.API.EFFECTS.APPLY('woods', imageUrl)
    );

    if (!result?.results || !Array.isArray(result.results) || result.results.length === 0) {
      return reply("❌ No response from  API");
    }

    // Pick Regular size by default
    const sketchUrl = result.results.find(r => r.size === "Regular")?.url || result.results[0].url;

    // Send back the processed image
    await client.sendMessage(from, { image: { url: sketchUrl } }, { quoted: mek });

  } catch (err) {
    console.error("Sketch effect error:", err);
    await reply("❌ Failed to apply effect. Try a different image.");
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "beach",
  category: "photofunia",
  description: "Apply sketch effect to quoted image"
},
async (from, client, conText) => {
  const { mek, quoted, quotedMsg, reply } = conText;

  if (!quotedMsg) return reply("📌 Reply to an image message to apply  effect");

  const type = getMediaType(quotedMsg);
  if (type !== "image") return reply("❌ Only image messages are supported");

  const mediaNode = quoted?.imageMessage;
  if (!mediaNode) return reply("❌ Could not extract image content");

  let filePath;
  try {
    // Save quoted image locally
    filePath = await saveMediaToTemp(client, mediaNode, type);

    // Upload to Uguu to get a public URL
    const imageUrl = await uploadToUguu(filePath);

    // Call sketch effect API
    const { data: result } = await axios.get(
      XMD.API.EFFECTS.APPLY('beach', imageUrl)
    );

    if (!result?.results || !Array.isArray(result.results) || result.results.length === 0) {
      return reply("❌ No response from  API");
    }

    // Pick Regular size by default
    const sketchUrl = result.results.find(r => r.size === "Regular")?.url || result.results[0].url;

    // Send back the processed image
    await client.sendMessage(from, { image: { url: sketchUrl } }, { quoted: mek });

  } catch (err) {
    console.error("Sketch effect error:", err);
    await reply("❌ Failed to apply effect. Try a different image.");
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "explorer",
  category: "photofunia",
  description: "Apply sketch effect to quoted image"
},
async (from, client, conText) => {
  const { mek, quoted, quotedMsg, reply } = conText;

  if (!quotedMsg) return reply("📌 Reply to an image message to apply  effect");

  const type = getMediaType(quotedMsg);
  if (type !== "image") return reply("❌ Only image messages are supported");

  const mediaNode = quoted?.imageMessage;
  if (!mediaNode) return reply("❌ Could not extract image content");

  let filePath;
  try {
    // Save quoted image locally
    filePath = await saveMediaToTemp(client, mediaNode, type);

    // Upload to Uguu to get a public URL
    const imageUrl = await uploadToUguu(filePath);

    // Call sketch effect API
    const { data: result } = await axios.get(
      XMD.API.EFFECTS.APPLY('explorer', imageUrl)
    );

    if (!result?.results || !Array.isArray(result.results) || result.results.length === 0) {
      return reply("❌ No response from  API");
    }

    // Pick Regular size by default
    const sketchUrl = result.results.find(r => r.size === "Regular")?.url || result.results[0].url;

    // Send back the processed image
    await client.sendMessage(from, { image: { url: sketchUrl } }, { quoted: mek });

  } catch (err) {
    console.error("Sketch effect error:", err);
    await reply("❌ Failed to apply effect. Try a different image.");
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "sepia",
  category: "photofunia",
  description: "Apply sketch effect to quoted image"
},
async (from, client, conText) => {
  const { mek, quoted, quotedMsg, reply } = conText;

  if (!quotedMsg) return reply("📌 Reply to an image message to apply  effect");

  const type = getMediaType(quotedMsg);
  if (type !== "image") return reply("❌ Only image messages are supported");

  const mediaNode = quoted?.imageMessage;
  if (!mediaNode) return reply("❌ Could not extract image content");

  let filePath;
  try {
    // Save quoted image locally
    filePath = await saveMediaToTemp(client, mediaNode, type);

    // Upload to Uguu to get a public URL
    const imageUrl = await uploadToUguu(filePath);

    // Call sketch effect API
    const { data: result } = await axios.get(
      XMD.API.EFFECTS.APPLY('sepia', imageUrl)
    );

    if (!result?.results || !Array.isArray(result.results) || result.results.length === 0) {
      return reply("❌ No response from  API");
    }

    // Pick Regular size by default
    const sketchUrl = result.results.find(r => r.size === "Regular")?.url || result.results[0].url;

    // Send back the processed image
    await client.sendMessage(from, { image: { url: sketchUrl } }, { quoted: mek });

  } catch (err) {
    console.error("Sketch effect error:", err);
    await reply("❌ Failed to apply effect. Try a different image.");
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "christmas",
  category: "photofunia",
  description: "Apply sketch effect to quoted image"
},
async (from, client, conText) => {
  const { mek, quoted, quotedMsg, reply } = conText;

  if (!quotedMsg) return reply("📌 Reply to an image message to apply  effect");

  const type = getMediaType(quotedMsg);
  if (type !== "image") return reply("❌ Only image messages are supported");

  const mediaNode = quoted?.imageMessage;
  if (!mediaNode) return reply("❌ Could not extract image content");

  let filePath;
  try {
    // Save quoted image locally
    filePath = await saveMediaToTemp(client, mediaNode, type);

    // Upload to Uguu to get a public URL
    const imageUrl = await uploadToUguu(filePath);

    // Call sketch effect API
    const { data: result } = await axios.get(
      XMD.API.EFFECTS.APPLY('christmas', imageUrl)
    );

    if (!result?.results || !Array.isArray(result.results) || result.results.length === 0) {
      return reply("❌ No response from  API");
    }

    // Pick Regular size by default
    const sketchUrl = result.results.find(r => r.size === "Regular")?.url || result.results[0].url;

    // Send back the processed image
    await client.sendMessage(from, { image: { url: sketchUrl } }, { quoted: mek });

  } catch (err) {
    console.error("Sketch effect error:", err);
    await reply("❌ Failed to apply effect. Try a different image.");
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
});

//========================================================================================================================
bwmxmd({
  pattern: "sketch",
  category: "photofunia",
  description: "Apply sketch effect to quoted image"
},
async (from, client, conText) => {
  const { mek, quoted, quotedMsg, reply } = conText;

  if (!quotedMsg) return reply("📌 Reply to an image message to apply  effect");

  const type = getMediaType(quotedMsg);
  if (type !== "image") return reply("❌ Only image messages are supported");

  const mediaNode = quoted?.imageMessage;
  if (!mediaNode) return reply("❌ Could not extract image content");

  let filePath;
  try {
    // Save quoted image locally
    filePath = await saveMediaToTemp(client, mediaNode, type);

    // Upload to Uguu to get a public URL
    const imageUrl = await uploadToUguu(filePath);

    // Call sketch effect API
    const { data: result } = await axios.get(
      XMD.API.EFFECTS.APPLY('sketch', imageUrl)
    );

    if (!result?.results || !Array.isArray(result.results) || result.results.length === 0) {
      return reply("❌ No response from  API");
    }

    // Pick Regular size by default
    const sketchUrl = result.results.find(r => r.size === "Regular")?.url || result.results[0].url;

    // Send back the processed image
    await client.sendMessage(from, { image: { url: sketchUrl } }, { quoted: mek });

  } catch (err) {
    console.error("Sketch effect error:", err);
    await reply("❌ Failed to apply effect. Try a different image.");
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
});
