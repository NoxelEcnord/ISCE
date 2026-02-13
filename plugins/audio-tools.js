const { bwmxmd } = require('../core/commandHandler');
const fs = require('fs');
const { exec } = require('child_process');
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

bwmxmd({
  pattern: "trim",
  description: "Trim quoted audio or video using start and end time",
  category: "Utility",
  filename: __filename
}, async (from, client, conText) => {
  const { quotedMsg, q, mek, reply, keithRandom } = conText;

  if (!quotedMsg) {
    return reply("❌ Reply to an audio or video file with start and end time.\n\nExample: `trim 0:10 0:30`");
  }

  const [startTime, endTime] = q.split(" ").map(t => t.trim());
  if (!startTime || !endTime) {
    return reply("⚠️ Invalid format.\n\nExample: `trim 0:10 0:30`");
  }

  const mediaType = quotedMsg.audioMessage || quotedMsg.videoMessage;
  if (!mediaType) {
    return reply("❌ Unsupported media type. Quote an audio or video file.");
  }

  try {
    const mediaPath = await client.downloadAndSaveMediaMessage(mediaType);
    const isAudio = !!quotedMsg.audioMessage;
    const outputExt = isAudio ? ".mp3" : ".mp4";
    const outputPath = await keithRandom(outputExt);

    exec(`ffmpeg -i ${mediaPath} -ss ${startTime} -to ${endTime} -c copy ${outputPath}`, async (err) => {
      fs.unlinkSync(mediaPath);
      if (err) {
        console.error("ffmpeg error:", err);
        return reply("❌ Trimming failed.");
      }

      const buffer = fs.readFileSync(outputPath);
      const message = isAudio
        ? { audio: buffer, mimetype: "audio/mpeg" }
        : { video: buffer, mimetype: "video/mp4" };

      await client.sendMessage(from, message, { quoted: mek });
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    console.error("trim error:", error);
    await reply("❌ An error occurred while processing the media.");
  }
});
//========================================================================================================================

bwmxmd({
  pattern: "volume",
  description: "Adjust volume of quoted audio or video",
  category: "Utility",
  filename: __filename
}, async (from, client, conText) => {
  const { quotedMsg, q, mek, reply, keithRandom } = conText;

  if (!q) {
    return reply("⚠️ Example: volume 1.5");
  }

  const mediaType = quotedMsg?.audioMessage || quotedMsg?.videoMessage;
  if (!mediaType) {
    return reply("❌ Quote an audio or video file to adjust its volume.");
  }

  try {
    const mediaPath = await client.downloadAndSaveMediaMessage(mediaType);
    const isAudio = !!quotedMsg.audioMessage;
    const outputExt = isAudio ? ".mp3" : ".mp4";
    const outputPath = await keithRandom(outputExt);

    exec(`ffmpeg -i ${mediaPath} -filter:a volume=${q} ${outputPath}`, async (err) => {
      fs.unlinkSync(mediaPath);
      if (err) {
        console.error("ffmpeg error:", err);
        return reply("❌ Volume adjustment failed.");
      }

      const buffer = fs.readFileSync(outputPath);
      const message = isAudio
        ? { audio: buffer, mimetype: "audio/mpeg" }
        : { video: buffer, mimetype: "video/mp4" };

      await client.sendMessage(from, message, { quoted: mek });
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    console.error("volume error:", error);
    await reply("❌ An error occurred while processing the media.");
  }
});
//========================================================================================================================

bwmxmd({
  pattern: "tomp3",
  aliases: ["toaudio", "audioextract"],
  description: "Convert quoted audio or video to MP3",
  category: "Utility",
  filename: __filename
}, async (from, client, conText) => {
  const { quotedMsg, mek, reply, keithRandom } = conText;

  const mediaType = quotedMsg?.videoMessage || quotedMsg?.audioMessage;
  if (!mediaType) {
    return reply("❌ Quote an audio or video to convert to MP3.");
  }

  try {
    const media = await client.downloadAndSaveMediaMessage(mediaType);
    const output = await keithRandom(".mp3");

    exec(`ffmpeg -i ${media} -q:a 0 -map a ${output}`, async (err) => {
      fs.unlinkSync(media);
      if (err) {
        console.error("ffmpeg error:", err);
        return reply("❌ Conversion failed.");
      }

      const buffer = fs.readFileSync(output);
      await client.sendMessage(from, {
        audio: buffer,
        mimetype: "audio/mpeg"
      }, { quoted: mek });

      fs.unlinkSync(output);
    });
  } catch (error) {
    console.error("tomp3 error:", error);
    await reply("❌ An error occurred while converting the media.");
  }
});
//========================================================================================================================


bwmxmd({
  pattern: "toimg",
  aliases: ["sticker2img", "webp2png"],
  description: "Convert quoted sticker to image",
  category: "Utility",
  filename: __filename
}, async (from, client, conText) => {
  const { quotedMsg, mek, reply, keithRandom } = conText;

  if (!quotedMsg?.stickerMessage) {
    return reply("❌ Quote a sticker to convert.");
  }

  try {
    const media = await client.downloadAndSaveMediaMessage(quotedMsg.stickerMessage);
    const output = await keithRandom('.png');

    exec(`ffmpeg -i ${media} ${output}`, async (err) => {
      fs.unlinkSync(media);
      if (err) return reply("❌ Conversion failed.");

      const buffer = fs.readFileSync(output);
      await client.sendMessage(from, {
        image: buffer,
        caption: "🖼️ Converted from sticker"
      }, { quoted: mek });

      fs.unlinkSync(output);
    });
  } catch (e) {
    console.error("toimg error:", e);
    await reply("❌ Unable to convert the sticker." + e );
  }
});
//==================================================================================================================
bwmxmd({
  pattern: "amplify",
  aliases: ["replaceaudio", "mergeaudio"],
  description: "Replace quoted video's audio with a new audio URL",
  category: "Utility",
  filename: __filename
}, async (from, client, conText) => {
  const { quotedMsg, q, mek, reply, keithRandom } = conText;

  if (!quotedMsg?.videoMessage) {
    return reply("❌ Reply to a video file with the audio URL to replace its audio.");
  }

  if (!q) {
    return reply("❌ Provide an audio URL.");
  }

  try {
    const audioUrl = q.trim();
    const media = await client.downloadAndSaveMediaMessage(quotedMsg.videoMessage);

    const ext = audioUrl.split('.').pop().split('?')[0].toLowerCase();
    const audioPath = await keithRandom(`.${ext}`);
    const outputPath = await keithRandom(".mp4");

    const response = await axios.get(audioUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(audioPath, response.data);

    exec(`ffmpeg -i ${media} -i ${audioPath} -c:v copy -map 0:v:0 -map 1:a:0 -shortest ${outputPath}`, async (err) => {
      fs.unlinkSync(media);
      fs.unlinkSync(audioPath);
      if (err) {
        console.error("ffmpeg error:", err);
        return reply("❌ Error during audio replacement.");
      }

      const videoBuffer = fs.readFileSync(outputPath);
      await client.sendMessage(from, {
        video: videoBuffer,
        mimetype: "video/mp4"
      }, { quoted: mek });

      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    console.error("amplify error:", error);
    await reply("❌ An error occurred while processing the media.");
  }
});





