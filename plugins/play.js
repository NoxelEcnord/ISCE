const axios = require('axios');
const { bwmxmd } = require('../core/commandHandler');
const s = require(__dirname + "/../config");
const XMD = require('../core/xmd');

const BOT_NAME = s.BOT || 'ISCE-BOT';

const extractVideoId = (url) => {
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  return match ? match[1] : null;
};

bwmxmd({
  pattern: "play",
  aliases: ["song", "music", "yta"],
  category: "Downloader",
  description: "Search and download audio/video from YouTube"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) return reply("Please provide a search query or YouTube URL");

  try {
    let videoUrl;
    let videoTitle;
    let videoThumbnail;
    let videoDuration;
    let videoViews;
    let videoChannel;
    let videoId;

    if (q.match(/(youtube\.com|youtu\.be)/i)) {
      videoUrl = q;
      videoId = extractVideoId(q);
      if (!videoId) return reply("Invalid YouTube URL");
      videoTitle = "YouTube Media";
      videoThumbnail = XMD.EXTERNAL.YOUTUBE_THUMB(videoId);
      videoDuration = "Unknown";
      videoViews = "Unknown";
      videoChannel = "Unknown";
    } else {
      let videos;
      try {
        const searchResponse = await axios.get(XMD.SEARCH_EXT.YTS_QUERY(q), { timeout: 15000 });
        videos = Array.isArray(searchResponse.data) ? searchResponse.data : searchResponse.data?.result;
      } catch (searchErr) {
        console.log("Primary YT search failed, trying backup...");
        const backupResponse = await axios.get(XMD.SEARCH_EXT.YTS_BACKUP(q), { timeout: 15000 });
        videos = backupResponse.data?.result;
      }
      
      if (!Array.isArray(videos) || videos.length === 0) return reply("No results found");

      const firstVideo = videos[0];
      videoUrl = firstVideo.url;
      videoId = firstVideo.id || extractVideoId(firstVideo.url);
      videoTitle = firstVideo.name || firstVideo.title;
      videoThumbnail = firstVideo.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      videoDuration = firstVideo.duration || "Unknown";
      videoViews = firstVideo.views || "Unknown";
      videoChannel = firstVideo.author || firstVideo.channel || "Unknown";
    }

    const infoBoxContext = {
      forwardingScore: 1,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: XMD.NEWSLETTER_JID,
        newsletterName: BOT_NAME,
        serverMessageId: -1
      },
      externalAdReply: {
        title: videoTitle,
        body: "Available on YouTube",
        mediaType: 2,
        thumbnailUrl: videoThumbnail,
        mediaUrl: XMD.EXTERNAL.YOUTUBE_WATCH(videoId),
        sourceUrl: XMD.EXTERNAL.YOUTUBE_WATCH(videoId)
      }
    };

    const infoMessage = `*${videoTitle}*

🎬 *Channel:* ${videoChannel}
⏱️ *Duration:* ${videoDuration}
👀 *Views:* ${videoViews}

*Reply with a number to download:*

*1.* 🎵 Audio (MP3)
*2.* 🎬 Video (MP4)
*3.* 📄 Audio Document
*4.* 📄 Video Document

_Reply *0* to cancel_`;

    const sentMsg = await client.sendMessage(from, {
      image: { url: videoThumbnail },
      caption: infoMessage,
      contextInfo: infoBoxContext
    }, { quoted: mek });

    const cleanup = () => {
      client.ev.off("messages.upsert", handleReply);
    };

    const handleReply = async (update) => {
      const message = update.messages[0];
      if (!message?.message) return;

      const quotedStanzaId = message.message.extendedTextMessage?.contextInfo?.stanzaId;
      if (!quotedStanzaId || quotedStanzaId !== sentMsg.key.id) return;

      const responseText = message.message.extendedTextMessage?.text?.trim() || 
                         message.message.conversation?.trim();
      
      if (!responseText) return;

      const selectedIndex = parseInt(responseText);
      if (isNaN(selectedIndex)) return;

      const destChat = message.key.remoteJid;

      try {
        if (selectedIndex === 0) {
          await client.sendMessage(destChat, { react: { text: "❌", key: message.key } });
          await client.sendMessage(destChat, { text: "❌ Download cancelled" }, { quoted: message });
          cleanup();
          return;
        }

        if (selectedIndex >= 1 && selectedIndex <= 4) {
          await client.sendMessage(destChat, { react: { text: "⏳", key: message.key } });
        }

        const fileName = `${videoTitle}`.replace(/[^\w\s.-]/gi, '');

        const fetchMedia = async (apiCall, retries = 2) => {
          for (let i = 0; i <= retries; i++) {
            try {
              const response = await axios.get(apiCall, { timeout: 60000 });
              if (response.data?.result) return response.data.result;
            } catch (err) {
              if (i === retries) throw err;
              await new Promise(r => setTimeout(r, 1000));
            }
          }
          return null;
        };

        switch (selectedIndex) {
          case 1:
            try {
              const audioUrl = await fetchMedia(XMD.API.DOWNLOAD.AUDIO(videoUrl));
              if (!audioUrl) {
                await client.sendMessage(destChat, { react: { text: "❌", key: message.key } });
                await client.sendMessage(destChat, { text: "❌ Audio not available. Try option 3." }, { quoted: message });
                return;
              }
              await client.sendMessage(destChat, {
                audio: { url: audioUrl },
                mimetype: "audio/mpeg",
                fileName: `${fileName}.mp3`
              }, { quoted: message });
              await client.sendMessage(destChat, { react: { text: "✅", key: message.key } });
            } catch (err) {
              console.error("Audio error:", err.message);
              await client.sendMessage(destChat, { react: { text: "❌", key: message.key } });
              await client.sendMessage(destChat, { text: "❌ Audio failed. Try option 3." }, { quoted: message });
            }
            break;

          case 2:
            try {
              const videoDownloadUrl = await fetchMedia(XMD.API.DOWNLOAD.VIDEO(videoUrl));
              if (!videoDownloadUrl) {
                await client.sendMessage(destChat, { react: { text: "❌", key: message.key } });
                await client.sendMessage(destChat, { text: "❌ Video not available. Try option 4." }, { quoted: message });
                return;
              }
              await client.sendMessage(destChat, {
                video: { url: videoDownloadUrl },
                mimetype: "video/mp4",
                fileName: `${fileName}.mp4`
              }, { quoted: message });
              await client.sendMessage(destChat, { react: { text: "✅", key: message.key } });
            } catch (err) {
              console.error("Video error:", err.message);
              await client.sendMessage(destChat, { react: { text: "❌", key: message.key } });
              await client.sendMessage(destChat, { text: "❌ Video failed. Try option 4." }, { quoted: message });
            }
            break;

          case 3:
            try {
              const audioDocUrl = await fetchMedia(XMD.API.DOWNLOAD.AUDIO(videoUrl));
              if (!audioDocUrl) {
                await client.sendMessage(destChat, { react: { text: "❌", key: message.key } });
                await client.sendMessage(destChat, { text: "❌ Audio document not available." }, { quoted: message });
                return;
              }
              await client.sendMessage(destChat, {
                document: { url: audioDocUrl },
                mimetype: "audio/mpeg",
                fileName: `${fileName}.mp3`
              }, { quoted: message });
              await client.sendMessage(destChat, { react: { text: "✅", key: message.key } });
            } catch (err) {
              console.error("Audio doc error:", err.message);
              await client.sendMessage(destChat, { react: { text: "❌", key: message.key } });
              await client.sendMessage(destChat, { text: "❌ Audio document failed." }, { quoted: message });
            }
            break;

          case 4:
            try {
              const videoDocUrl = await fetchMedia(XMD.API.DOWNLOAD.VIDEO(videoUrl));
              if (!videoDocUrl) {
                await client.sendMessage(destChat, { react: { text: "❌", key: message.key } });
                await client.sendMessage(destChat, { text: "❌ Video document not available." }, { quoted: message });
                return;
              }
              await client.sendMessage(destChat, {
                document: { url: videoDocUrl },
                mimetype: "video/mp4",
                fileName: `${fileName}.mp4`
              }, { quoted: message });
              await client.sendMessage(destChat, { react: { text: "✅", key: message.key } });
            } catch (err) {
              console.error("Video doc error:", err.message);
              await client.sendMessage(destChat, { react: { text: "❌", key: message.key } });
              await client.sendMessage(destChat, { text: "❌ Video document failed." }, { quoted: message });
            }
            break;

          default:
            await client.sendMessage(destChat, { text: "❌ Invalid option. Reply 1, 2, 3, or 4" }, { quoted: message });
            break;
        }
      } catch (error) {
        console.error("Play reply error:", error.message);
      }
    };

    client.ev.on("messages.upsert", handleReply);
    setTimeout(cleanup, 600000);

  } catch (error) {
    console.error("Error during play command:", error);
    reply("❌ An error occurred. Please try again.");
  }
});

bwmxmd({
  pattern: "video",
  aliases: ["ytmp4", "ytv", "vid"],
  category: "Downloader",
  description: "Search and download video from YouTube"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) return reply("Please provide a search query or YouTube URL");

  try {
    let videoUrl;
    let videoTitle;
    let videoThumbnail;
    let videoDuration;
    let videoViews;
    let videoChannel;
    let videoId;

    if (q.match(/(youtube\.com|youtu\.be)/i)) {
      videoUrl = q;
      videoId = extractVideoId(q);
      if (!videoId) return reply("Invalid YouTube URL");
      videoTitle = "YouTube Media";
      videoThumbnail = XMD.EXTERNAL.YOUTUBE_THUMB(videoId);
      videoDuration = "Unknown";
      videoViews = "Unknown";
      videoChannel = "Unknown";
    } else {
      let videos;
      try {
        const searchResponse = await axios.get(XMD.SEARCH_EXT.YTS_QUERY(q), { timeout: 15000 });
        videos = Array.isArray(searchResponse.data) ? searchResponse.data : searchResponse.data?.result;
      } catch (searchErr) {
        console.log("Primary YT search failed, trying backup...");
        const backupResponse = await axios.get(XMD.SEARCH_EXT.YTS_BACKUP(q), { timeout: 15000 });
        videos = backupResponse.data?.result;
      }
      
      if (!Array.isArray(videos) || videos.length === 0) return reply("No results found");

      const firstVideo = videos[0];
      videoUrl = firstVideo.url;
      videoId = firstVideo.id || extractVideoId(firstVideo.url);
      videoTitle = firstVideo.name || firstVideo.title;
      videoThumbnail = firstVideo.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      videoDuration = firstVideo.duration || "Unknown";
      videoViews = firstVideo.views || "Unknown";
      videoChannel = firstVideo.author || firstVideo.channel || "Unknown";
    }

    const infoBoxContext = {
      forwardingScore: 1,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: XMD.NEWSLETTER_JID,
        newsletterName: BOT_NAME,
        serverMessageId: -1
      },
      externalAdReply: {
        title: videoTitle,
        body: "Available on YouTube",
        mediaType: 2,
        thumbnailUrl: videoThumbnail,
        mediaUrl: XMD.EXTERNAL.YOUTUBE_WATCH(videoId),
        sourceUrl: XMD.EXTERNAL.YOUTUBE_WATCH(videoId)
      }
    };

    const infoMessage = `*${videoTitle}*

🎬 *Channel:* ${videoChannel}
⏱️ *Duration:* ${videoDuration}
👀 *Views:* ${videoViews}

*Reply with a number to download:*

*1.* 🎵 Audio (MP3)
*2.* 🎬 Video (MP4)
*3.* 📄 Audio Document
*4.* 📄 Video Document

_Reply *0* to cancel_`;

    const sentMsg = await client.sendMessage(from, {
      image: { url: videoThumbnail },
      caption: infoMessage,
      contextInfo: infoBoxContext
    }, { quoted: mek });

    const cleanup = () => {
      client.ev.off("messages.upsert", handleReply);
    };

    const handleReply = async (update) => {
      const message = update.messages[0];
      if (!message?.message) return;

      const quotedStanzaId = message.message.extendedTextMessage?.contextInfo?.stanzaId;
      if (!quotedStanzaId || quotedStanzaId !== sentMsg.key.id) return;

      const responseText = message.message.extendedTextMessage?.text?.trim() || 
                         message.message.conversation?.trim();
      
      if (!responseText) return;

      const selectedIndex = parseInt(responseText);
      if (isNaN(selectedIndex)) return;

      const destChat = message.key.remoteJid;

      try {
        if (selectedIndex === 0) {
          await client.sendMessage(destChat, { react: { text: "❌", key: message.key } });
          await client.sendMessage(destChat, { text: "❌ Download cancelled" }, { quoted: message });
          cleanup();
          return;
        }

        if (selectedIndex >= 1 && selectedIndex <= 4) {
          await client.sendMessage(destChat, { react: { text: "⏳", key: message.key } });
        }

        const fileName = `${videoTitle}`.replace(/[^\w\s.-]/gi, '');

        switch (selectedIndex) {
          case 1:
            try {
              const audioResponse = await axios.get(XMD.API.DOWNLOAD.AUDIO(videoUrl), { timeout: 30000 });
              const audioUrl = audioResponse.data?.result;
              
              if (!audioUrl) {
                await client.sendMessage(destChat, { react: { text: "❌", key: message.key } });
                await client.sendMessage(destChat, { text: "❌ Audio not available. Try option 3 for document." }, { quoted: message });
                return;
              }
              
              await client.sendMessage(destChat, {
                audio: { url: audioUrl },
                mimetype: "audio/mpeg",
                fileName: `${fileName}.mp3`
              }, { quoted: message });
              await client.sendMessage(destChat, { react: { text: "✅", key: message.key } });
            } catch (err) {
              console.error("Audio download error:", err.message);
              await client.sendMessage(destChat, { react: { text: "❌", key: message.key } });
              await client.sendMessage(destChat, { text: "❌ Audio failed. Try option 3 for document." }, { quoted: message });
            }
            break;

          case 2:
            try {
              const videoResponse = await axios.get(XMD.API.DOWNLOAD.VIDEO(videoUrl), { timeout: 30000 });
              const videoDownloadUrl = videoResponse.data?.result;
              
              if (!videoDownloadUrl) {
                await client.sendMessage(destChat, { react: { text: "❌", key: message.key } });
                await client.sendMessage(destChat, { text: "❌ Video not available. Try option 4 for document." }, { quoted: message });
                return;
              }
              
              await client.sendMessage(destChat, {
                video: { url: videoDownloadUrl },
                mimetype: "video/mp4",
                fileName: `${fileName}.mp4`
              }, { quoted: message });
              await client.sendMessage(destChat, { react: { text: "✅", key: message.key } });
            } catch (err) {
              console.error("Video download error:", err.message);
              await client.sendMessage(destChat, { react: { text: "❌", key: message.key } });
              await client.sendMessage(destChat, { text: "❌ Video failed. Try option 4 for document." }, { quoted: message });
            }
            break;

          case 3:
            try {
              const audioDocResponse = await axios.get(XMD.API.DOWNLOAD.AUDIO(videoUrl), { timeout: 30000 });
              const audioDocUrl = audioDocResponse.data?.result;
              
              if (!audioDocUrl) {
                await client.sendMessage(destChat, { react: { text: "❌", key: message.key } });
                await client.sendMessage(destChat, { text: "❌ Audio document not available." }, { quoted: message });
                return;
              }
              
              await client.sendMessage(destChat, {
                document: { url: audioDocUrl },
                mimetype: "audio/mpeg",
                fileName: `${fileName}.mp3`
              }, { quoted: message });
              await client.sendMessage(destChat, { react: { text: "✅", key: message.key } });
            } catch (err) {
              console.error("Audio doc error:", err.message);
              await client.sendMessage(destChat, { react: { text: "❌", key: message.key } });
              await client.sendMessage(destChat, { text: "❌ Audio document failed." }, { quoted: message });
            }
            break;

          case 4:
            try {
              const videoDocResponse = await axios.get(XMD.API.DOWNLOAD.VIDEO(videoUrl), { timeout: 30000 });
              const videoDocUrl = videoDocResponse.data?.result;
              
              if (!videoDocUrl) {
                await client.sendMessage(destChat, { react: { text: "❌", key: message.key } });
                await client.sendMessage(destChat, { text: "❌ Video document not available." }, { quoted: message });
                return;
              }
              
              await client.sendMessage(destChat, {
                document: { url: videoDocUrl },
                mimetype: "video/mp4",
                fileName: `${fileName}.mp4`
              }, { quoted: message });
              await client.sendMessage(destChat, { react: { text: "✅", key: message.key } });
            } catch (err) {
              console.error("Video doc error:", err.message);
              await client.sendMessage(destChat, { text: "❌ Video document failed." }, { quoted: message });
            }
            break;

          default:
            await client.sendMessage(destChat, { text: "❌ Invalid option. Reply 1, 2, 3, or 4" }, { quoted: message });
            break;
        }
      } catch (error) {
        console.error("Video reply error:", error);
        await client.sendMessage(destChat, { text: "❌ Download failed. Please try again." }, { quoted: message });
      }
    };

    client.ev.on("messages.upsert", handleReply);
    setTimeout(cleanup, 1800000);

  } catch (error) {
    console.error("Error during video command:", error);
    reply("❌ An error occurred. Please try again.");
  }
});
