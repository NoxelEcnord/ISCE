const { bwmxmd } = require('../core/commandHandler');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const FormData = require('form-data');
const mime = require('mime-types');
const XMD = require('../core/xmd');

const getContactMsg = (contactName, sender) => XMD.getContactMsg(contactName, sender);

bwmxmd({
  pattern: "sora",
  aliases: ["text2video", "t2v"],
  category: "AI",
  description: "Generate video from text using Sora API"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) {
    return reply("❌ Provide a query, e.g. .sora monkey running");
  }

  try {
    const apiUrl = XMD.API.AI.TEXT2VIDEO(q);
    const response = await axios.get(apiUrl, { timeout: 120000 });
    const result = response.data?.results;

    if (!result) {
      return reply("❌ No video result found.");
    }

    await client.sendMessage(from, {
      video: { url: result },
      mimetype: "video/mp4",
      caption: `result for: ${q}`,
      contextInfo: {
        externalAdReply: {
          title: "AI Message Assistant",
          body: "ISCE-BOT Bot Support",
          thumbnailUrl: "https://files.catbox.moe/bkuj17.jpg",
          sourceUrl: "https://github.com/Bwmxmd254/ISCE-BOT-GO",
          mediaType: 1,
          renderLargerThumbnail: false
        }
      }
    }, { quoted: mek });

  } catch (error) {
    console.error("Sora error:", error);
    reply("❌ Failed to fetch Sora video: " + error.message);
  }
});

//========================================================================================================================

bwmxmd({
  pattern: "flux",
  aliases: ["fluxai", "imageai"],
  category: "ai",
  description: "Generate an image using Flux API"
},
async (from, client, conText) => {
  const { q, reply } = conText;

  if (!q) return reply("❌ Provide a query, e.g. .flux dog");

  try {
    // Call Flux API (returns raw image)
    const res = await axios.get(XMD.API.AI.FLUX(q), {
      responseType: "arraybuffer"
    });

    // Save temporarily
    const filePath = "./flux_img.jpg";
    fs.writeFileSync(filePath, res.data);

    // Send image to chat
    await client.sendMessage(from, { 
      image: { url: filePath }, 
      caption: `Flux result for: ${q}`,
      contextInfo: {
        externalAdReply: {
          title: "AI Message Assistant",
          body: "ISCE-BOT Bot Support",
          thumbnailUrl: "https://files.catbox.moe/bkuj17.jpg",
          sourceUrl: "https://github.com/Bwmxmd254/ISCE-BOT-GO",
          mediaType: 1,
          renderLargerThumbnail: false
        }
      }
    });

    // Clean up
    fs.unlinkSync(filePath);
  } catch (err) {
    console.error("flux Error:", err);
    reply("❌ Failed to fetch Flux image: " + err.message);
  }
});
//========================================================================================================================


bwmxmd({
  pattern: "speechwriter",
  aliases: ["speech", "writer"],
  category: "ai",
  description: "Generate a speech using the Speechwriter API"
},
async (from, client, conText) => {
  const { q, reply } = conText;

  if (!q) {
    return reply("❌ Provide a topic, e.g. .speechwriter how to pass exam");
  }

  try {
    // Defaults
    const length = "short";
    const type = "dedication";
    const tone = "serious";

    // Build API URL with defaults
    const url = XMD.API.AI_TOOLS.SPEECHWRITER(q, length, type, tone);

    // Call API
    const res = await axios.get(url);

    if (!res.data || !res.data.status || !res.data.result?.data?.data?.speech) {
      return reply("❌ Speechwriter API returned an invalid response.");
    }

    const speech = res.data.result.data.data.speech;

    // Reply with the speech
    reply(speech);
  } catch (err) {
    console.error("speechwriter Error:", err);
    reply("❌ Failed to fetch speech: " + err.message);
  }
});

//========================================================================================================================

bwmxmd({
  pattern: "muslimai",
  aliases: ["muslim", "quranai"],
  category: "ai",
  description: "Query MuslimAI API for Qur'anic references"
},
async (from, client, conText) => {
  const { q, reply } = conText;

  if (!q) return reply("❌ Provide a query, e.g. .muslimai who is Allah");

  try {
    // Call MuslimAI API
    const res = await axios.get(XMD.API.AI_TOOLS.MUSLIM(q));

    if (!res.data || !res.data.status || !res.data.result) {
      return reply("❌ MuslimAI API returned an invalid response.");
    }

    const results = res.data.result.results;

    if (!results || results.length === 0) {
      return reply("ℹ️ No relevant verses found.");
    }

    // Format top 3 results
    let output = `📖 *MuslimAI Results for:* ${res.data.result.query}\n\n`;
    results.slice(0, 3).forEach((r, i) => {
      output += `*${i + 1}. Surah ${r.surah_title}*\n${r.content.trim()}\n🔗 ${r.surah_url}\n\n`;
    });

    reply(output.trim());
  } catch (err) {
    console.error("muslimai Error:", err);
    reply("❌ Failed to fetch MuslimAI response: " + err.message);
  }
});
//========================================================================================================================

bwmxmd({
  pattern: "wormgpt",
  aliases: ["wgpt", "evilgpt"],
  category: "ai",
  description: "Interact with WormGPT API"
},
async (from, client, conText) => {
  const { q, reply } = conText;

  if (!q) return reply("❌ Provide a query, e.g. .wormgpt hi");

  try {
    // Call WormGPT API
    const res = await axios.get(XMD.API.AI_TOOLS.WORMGPT(q));

    if (!res.data || !res.data.status) {
      return reply("❌ WormGPT API returned an invalid response.");
    }

    const output = res.data.result;

    // Reply with the result
    reply(output);
  } catch (err) {
    console.error("wormgpt Error:", err);
    reply("❌ Failed to fetch WormGPT response: " + err.message);
  }
});
//========================================================================================================================

bwmxmd({
  pattern: "bibleai",
  aliases: ["aibible", "scripture"],
  description: "Ask Bible-based questions and get answers with references",
  category: "ai",
  filename: __filename
}, async (from, client, conText) => {
  const { q, reply, mek } = conText;

  if (!q) return reply("📖 Ask a Bible question.\n\nExample: bibleai what is faith");

  try {
    const res = await axios.get(XMD.API.AI_TOOLS.BIBLE(q));
    const data = res.data;

    if (!data.status || !data.result?.results?.data?.answer) {
      return reply("❌ No Bible answer found.");
    }

    const answer = data.result.results.data.answer;
    const sources = data.result.results.data.sources;

    const caption = `📖 *${q}*\n\n${answer}\n\n📌 *Sources:* Reply with a number to view\n` +
      sources.map((src, i) => {
        if (src.type === "verse") return `${i + 1}. 📜 ${src.text}`;
        if (src.type === "article") return `${i + 1}. 📘 ${src.title}`;
      }).join("\n");

    const sent = await client.sendMessage(from, { 
      text: caption,
      contextInfo: {
        externalAdReply: {
          title: "AI Message Assistant",
          body: "ISCE-BOT Bot Support",
          thumbnailUrl: "https://files.catbox.moe/bkuj17.jpg",
          sourceUrl: "https://github.com/Bwmxmd254/ISCE-BOT-GO",
          mediaType: 1,
          renderLargerThumbnail: false
        }
      }
    }, { quoted: mek });
    const messageId = sent.key.id;

    client.ev.on("messages.upsert", async (update) => {
      const msg = update.messages[0];
      if (!msg.message) return;

      const responseText = msg.message.conversation || msg.message.extendedTextMessage?.text;
      const isReply = msg.message.extendedTextMessage?.contextInfo?.stanzaId === messageId;
      const chatId = msg.key.remoteJid;

      if (!isReply) return;

      const index = parseInt(responseText.trim()) - 1;
      const selected = sources[index];

      if (!selected) {
        return client.sendMessage(chatId, {
          text: "❌ Invalid number. Reply with a valid source number.",
          quoted: msg
        });
      }

      await client.sendMessage(chatId, { react: { text: "📖", key: msg.key } });

      if (selected.type === "verse") {
        const ref = selected.bcv.referenceLong.replace(/\s+/g, "").replace(":", ":");
        try {
          const verseRes = await axios.get(XMD.SEARCH_EXT.BIBLE(ref));
          const verseData = verseRes.data;

          if (!verseData.status || !verseData.result?.verses) {
            return client.sendMessage(chatId, {
              text: `❌ Couldn't fetch verse: ${selected.text}`,
              quoted: msg
            });
          }

          const verses = verseData.result.verses.map(v =>
            `📖 *${v.book} ${v.chapter}:${v.verse}*\n${v.text}`
          ).join("\n\n");

          await client.sendMessage(chatId, { text: verses }, { quoted: msg });
        } catch (err) {
          console.error("Verse fetch error:", err);
          await client.sendMessage(chatId, {
            text: "❌ Error fetching verse text.",
            quoted: msg
          });
        }
      } else if (selected.type === "article") {
        await client.sendMessage(chatId, {
          image: { url: selected.image },
          caption: `📘 *${selected.title}*\n\n${selected.text}\n\n🔗 ${selected.url}`
        }, { quoted: msg });
      }
    });
  } catch (err) {
    console.error("bibleai error:", err);
    reply("❌ Error fetching Bible answer: " + err.message);
  }
});
//==============================================================================



function getMediaType(quoted) {
  if (quoted.imageMessage) return "image";
  if (quoted.videoMessage) return "video";
  if (quoted.stickerMessage) return "sticker";
  if (quoted.audioMessage) return "audio";
  if (quoted.documentMessage) return "document";
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
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
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
bwmxmd({
  pattern: "removebg",
  aliases: ["rmbg", "bgremove"],
  description: "Remove background from quoted image",
  category: "Ai",
  filename: __filename
}, async (from, client, conText) => {
  const { mek, quoted, quotedMsg, reply } = conText;

  if (!quotedMsg) return reply("📌 Reply to an image message to remove its background");

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

    // Call removebg API
    const { data: result } = await axios.get(
      XMD.API.AI_TOOLS.REMOVEBG(imageUrl)
    );

    if (!result?.status || !result?.result?.data?.cutoutUrl) {
      return reply("❌ No response from RemoveBG API");
    }

    const cutoutUrl = result.result.data.cutoutUrl;

    // Send back the processed image
    await client.sendMessage(from, { 
      image: { url: cutoutUrl },
      contextInfo: {
        externalAdReply: {
          title: "AI Message Assistant",
          body: "ISCE-BOT Bot Support",
          thumbnailUrl: "https://files.catbox.moe/bkuj17.jpg",
          sourceUrl: "https://github.com/Bwmxmd254/ISCE-BOT-GO",
          mediaType: 1,
          renderLargerThumbnail: false
        }
      }
    }, { quoted: mek });

  } catch (err) {
    console.error("RemoveBG error:", err);
    await reply("❌ Failed to remove background. Try a different image.");
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
});


//========================================================================================================================

bwmxmd({
  pattern: "vision",
  aliases: ["imgai", "analyze", "geminivision"],
  description: "Analyze quoted image using Gemini Vision AI",
  category: "Ai",
  filename: __filename
}, async (from, client, conText) => {
  const { mek, quoted, quotedMsg, reply, q } = conText;

  if (!quotedMsg) return reply("📌 Reply to an image message to analyze it");
  if (!q || typeof q !== "string") return reply("❌ Missing query. Use q='your question'");

  const type = getMediaType(quotedMsg);
  if (type !== "image") return reply("❌ Only image messages are supported");

  const mediaNode = quoted?.imageMessage;
  if (!mediaNode) return reply("❌ Could not extract image content");

  let filePath;
  try {
    filePath = await saveMediaToTemp(client, mediaNode, type);
    const imageUrl = await uploadToUguu(filePath);

    const { data: result } = await axios.get(XMD.API.AI.GEMINI_VISION(imageUrl, q));
    if (!result?.status || !result?.result) return reply("❌ No response from Vision AI");

    await client.sendMessage(from, { 
      text: result.result,
      contextInfo: {
        externalAdReply: {
          title: "AI Message Assistant",
          body: "ISCE-BOT Bot Support",
          thumbnailUrl: "https://files.catbox.moe/bkuj17.jpg",
          sourceUrl: "https://github.com/Bwmxmd254/ISCE-BOT-GO",
          mediaType: 1,
          renderLargerThumbnail: false
        }
      }
    }, { quoted: mek });

  } catch (err) {
    console.error("Vision AI error:", err);
    await reply("❌ Failed to analyze image. Try a different one.");
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
});

//========================================================================================================================

bwmxmd({
  pattern: "transcribe",
  aliases: ["speech", "audio2text", "whisper"],
  description: "Transcribe quoted audio or video to text",
  category: "Ai",
  filename: __filename
}, async (from, client, conText) => {
  const { mek, quoted, quotedMsg, reply } = conText;

  if (!quotedMsg) return reply("📌 Reply to an audio or video message to transcribe it");

  const type = getMediaType(quotedMsg);
  if (type === "unknown") return reply("❌ Unsupported media type");

  const mediaNode = quoted?.[`${type}Message`];
  if (!mediaNode) return reply("❌ Could not extract media content");

  let filePath;
  try {
    filePath = await saveMediaToTemp(client, mediaNode, type);
    const mediaUrl = await uploadToUguu(filePath);

    const { data: result } = await axios.get(XMD.API.AI_TOOLS.TRANSCRIBE(mediaUrl));
    if (!result?.status || !result?.result?.text) return reply("❌ No transcription found");

    await client.sendMessage(from, { 
      text: result.result.text,
      contextInfo: {
        externalAdReply: {
          title: "AI Message Assistant",
          body: "ISCE-BOT Bot Support",
          thumbnailUrl: "https://files.catbox.moe/bkuj17.jpg",
          sourceUrl: "https://github.com/Bwmxmd254/ISCE-BOT-GO",
          mediaType: 1,
          renderLargerThumbnail: false
        }
      }
    }, { quoted: mek });

  } catch (err) {
    console.error("Transcription error:", err);
    await reply("❌ Failed to transcribe. Try a shorter or clearer clip.");
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
});

//========================================================================================================================

bwmxmd({
  pattern: "shazam",
  aliases: ["identify", "whatmusic", "whatsong"],
  description: "Identify music from quoted audio or video",
  category: "Ai",
  filename: __filename
}, async (from, client, conText) => {
  const { mek, quoted, quotedMsg, reply, botname } = conText;

  if (!quotedMsg) return reply("📌 Reply to an audio or video message to identify music");

  const type = getMediaType(quotedMsg);
  if (type === "unknown") return reply("❌ Unsupported media type");

  const mediaNode = quoted?.[`${type}Message`];
  if (!mediaNode) return reply("❌ Could not extract media content");

  let filePath;
  try {
    filePath = await saveMediaToTemp(client, mediaNode, type);
    const mediaUrl = await uploadToUguu(filePath);

    const { data: result } = await axios.get(XMD.API.AI_TOOLS.SHAZAM(mediaUrl));
    if (!result?.status || !result?.result?.title) return reply("❌ No music info found");

    const { title, artists, album, release_date } = result.result;

    let txt = `*${botname} Music ID*\n\n`;
    txt += `*Title:* ${title}\n`;
    if (artists?.length) txt += `*Artists:* ${artists.join(', ')}\n`;
    if (album) txt += `*Album:* ${album}\n`;
    if (release_date) txt += `*Release Date:* ${release_date}`;

    await client.sendMessage(from, { 
      text: txt,
      contextInfo: {
        externalAdReply: {
          title: "AI Message Assistant",
          body: "ISCE-BOT Bot Support",
          thumbnailUrl: "https://files.catbox.moe/bkuj17.jpg",
          sourceUrl: "https://github.com/Bwmxmd254/ISCE-BOT-GO",
          mediaType: 1,
          renderLargerThumbnail: false
        }
      }
    }, { quoted: mek });

  } catch (err) {
    console.error("Shazam error:", err);
    await reply("❌ Failed to identify music. Try with a shorter or fresh clip.");
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
});
