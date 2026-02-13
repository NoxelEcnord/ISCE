const { bwmxmd } = require('../core/commandHandler');
const axios = require('axios');
const XMD = require('../core/xmd');

const getContactMsg = (contactName, sender) => XMD.getContactMsg(contactName, sender);

bwmxmd({
  pattern: "inspirobot",
  aliases: ["inspireimg", "quoteimage"],
  description: "Send a surreal inspirobot image",
  category: "fun",
  filename: __filename
}, async (from, client, conText) => {
  const { mek } = conText;

  try {
    const imageUrl = (await axios.get(XMD.API.FUN.INSPIROBOT)).data;
    if (!imageUrl) return;

    await client.sendMessage(from, {
      image: { url: imageUrl }
    }, { quoted: mek });
  } catch (err) {
    console.error("inspirobot error:", err);
  }
});
//========================================================================================================================


bwmxmd({
  pattern: "neverhaveiever",
  aliases: ["nhie", "neverever"],
  description: "Get a random 'Never Have I Ever' prompt",
  category: "fun",
  filename: __filename
}, async (from, client, conText) => {
  const { reply } = conText;

  try {
    const res = await axios.get(XMD.API.FUN.NEVER_HAVE_I_EVER);
    const data = res.data;

    if (!data.status || !data.result) {
      return reply("❌ Failed to fetch a prompt.");
    }

    reply(data.result);
  } catch (err) {
    console.error("neverhaveiever error:", err);
    reply("❌ Error fetching prompt: " + err.message);
  }
});
//========================================================================================================================


bwmxmd({
  pattern: "quote",
  aliases: ["inspire", "wisdom"],
  description: "Get a random quote",
  category: "fun",
  filename: __filename
}, async (from, client, conText) => {
  const { reply } = conText;

  try {
    const res = await axios.get(XMD.API.FUN.QUOTE);
    const data = res.data;

    if (!data.status || !data.result?.quote || !data.result?.author) {
      return reply("❌ Failed to fetch a quote.");
    }

    reply(`"${data.result.quote}"\n— ${data.result.author}`);
  } catch (err) {
    console.error("quote error:", err);
    reply("❌ Error fetching quote: " + err.message);
  }
});
//========================================================================================================================


bwmxmd({
  pattern: "question",
  aliases: ["quiz", "trivia"],
  description: "Get a random multiple-choice question",
  category: "fun",
  filename: __filename
}, async (from, client, conText) => {
  const { reply, mek } = conText;

  try {
    const res = await axios.get(XMD.API.FUN.QUESTION);
    const data = res.data;

    if (!data.status || !data.result?.question || !Array.isArray(data.result.allAnswers)) {
      return reply("❌ Failed to fetch a question.");
    }

    const { question, allAnswers, correctAnswer } = data.result;
    const options = allAnswers.map((opt, i) => `${i + 1}. ${opt}`).join("\n");

    const caption = `❓ *${question}*\n\n${options}\n\n📌 Reply with the correct number.`;

    const sent = await client.sendMessage(from, { text: caption }, { quoted: mek });
    const messageId = sent.key.id;

    client.ev.on("messages.upsert", async (update) => {
      const msg = update.messages[0];
      if (!msg.message) return;

      const responseText = msg.message.conversation || msg.message.extendedTextMessage?.text;
      const isReply = msg.message.extendedTextMessage?.contextInfo?.stanzaId === messageId;
      const chatId = msg.key.remoteJid;

      if (!isReply) return;

      const index = parseInt(responseText.trim()) - 1;
      const selected = allAnswers[index];

      if (!selected) {
        return client.sendMessage(chatId, {
          text: "❌ Invalid number. Reply with a valid option.",
          quoted: msg
        });
      }

      const resultText = selected === correctAnswer
        ? `✅ Correct! *${correctAnswer}*`
        : `❌ Wrong. The correct answer is *${correctAnswer}*`;

      await client.sendMessage(chatId, { text: resultText }, { quoted: msg });
    });
  } catch (err) {
    console.error("question error:", err);
    reply("❌ Error fetching question: " + err.message);
  }
});
//========================================================================================================================


bwmxmd({
  pattern: "meme",
  aliases: ["memes", "funmeme"],
  description: "Get a random meme",
  category: "fun",
  filename: __filename
}, async (from, client, conText) => {
  const { reply, mek } = conText;

  try {
    const res = await axios.get(XMD.API.FUN.MEME);
    const data = res.data;

    if (!data.status || !data.url || !data.title) {
      return reply("❌ Failed to fetch meme.");
    }

    await client.sendMessage(from, {
      image: { url: data.url },
      caption: data.title
    }, { quoted: mek });
  } catch (err) {
    console.error("meme error:", err);
    reply("❌ Error fetching meme: " + err.message);
  }
});
//========================================================================================================================

bwmxmd({
  pattern: "jokes",
  aliases: ["joke", "funny"],
  description: "Get a random joke",
  category: "fun",
  filename: __filename
}, async (from, client, conText) => {
  const { reply } = conText;

  try {
    const res = await axios.get(XMD.API.FUN.JOKES);
    const data = res.data;

    if (!data.status || !data.result?.setup || !data.result?.punchline) {
      return reply("❌ Failed to fetch a joke.");
    }

    reply(`${data.result.setup}\n\n${data.result.punchline}`);
  } catch (err) {
    console.error("jokes error:", err);
    reply("❌ Error fetching joke: " + err.message);
  }
});
//========================================================================================================================

bwmxmd({
  pattern: "fact",
  aliases: ["funfact", "randomfact"],
  description: "Get a random fun fact",
  category: "fun",
  filename: __filename
}, async (from, client, conText) => {
  const { reply } = conText;

  try {
    const res = await axios.get(XMD.API.FUN.FACT);
    const data = res.data;

    if (!data.status || !data.result) {
      return reply("❌ Failed to fetch a fact.");
    }

    reply(data.result);
  } catch (err) {
    console.error("fact error:", err);
    reply("❌ Error fetching fact: " + err.message);
  }
});
//========================================================================================================================


bwmxmd({
  pattern: "paranoia",
  aliases: ["paranoiaprompt", "mostlikely"],
  description: "Get a random paranoia question",
  category: "fun",
  filename: __filename
}, async (from, client, conText) => {
  const { reply } = conText;

  try {
    const res = await axios.get(XMD.API.FUN.PARANOIA);
    const data = res.data;

    if (!data.status || !data.result) {
      return reply("❌ Failed to fetch a paranoia prompt.");
    }

    reply(data.result);
  } catch (err) {
    console.error("paranoia error:", err);
    reply("❌ Error fetching paranoia: " + err.message);
  }
});
//========================================================================================================================

bwmxmd({
  pattern: "wyrather",
  description: "Get a random truth question",
  category: "fun",
  filename: __filename
}, async (from, client, conText) => {
  const { reply } = conText;

  try {
    const res = await axios.get(XMD.API.FUN.WOULD_YOU_RATHER);
    const data = res.data;

    if (!data.status || !data.result) {
      return reply("❌ Failed to fetch a truth prompt.");
    }

    reply(data.result);
  } catch (err) {
    console.error("truth error:", err);
    reply("❌ Error fetching truth: " + err.message);
  }
});
//========================================================================================================================

bwmxmd({
  pattern: "dare",
  description: "Get a random dare question",
  category: "fun",
  filename: __filename
}, async (from, client, conText) => {
  const { reply } = conText;

  try {
    const res = await axios.get(XMD.API.FUN.DARE);
    const data = res.data;

    if (!data.status || !data.result) {
      return reply("❌ Failed to fetch a truth prompt.");
    }

    reply(data.result);
  } catch (err) {
    console.error("truth error:", err);
    reply("❌ Error fetching truth: " + err.message);
  }
});
//========================================================================================================================

bwmxmd({
  pattern: "truth",
  description: "Get a random truth question",
  category: "fun",
  filename: __filename
}, async (from, client, conText) => {
  const { reply } = conText;

  try {
    const res = await axios.get(XMD.API.FUN.TRUTH);
    const data = res.data;

    if (!data.status || !data.result) {
      return reply("❌ Failed to fetch a truth prompt.");
    }

    reply(data.result);
  } catch (err) {
    console.error("truth error:", err);
    reply("❌ Error fetching truth: " + err.message);
  }
});
//====================================================================================================================
bwmxmd({
  pattern: "quoteaudio",
  aliases: ["audioquote", "inspireaudio"],
  description: "Play a surreal quote audio with caption",
  category: "fun",
  filename: __filename
}, async (from, client, conText) => {
  const { reply, mek } = conText;

  try {
    const res = await axios.get(XMD.API.FUN.QUOTE_AUDIO);
    const data = res.data;

    if (!data.status || !data.result?.mp3 || !Array.isArray(data.result.data)) {
      return reply("❌ Failed to fetch quote audio.");
    }

    const quotes = data.result.data
      .filter(item => item.type === "quote" && item.text)
      .map((item, i) => `🧠 ${i + 1}. ${item.text}`)
      .join("\n");

    const caption = `${quotes}`;

    await client.sendMessage(from, {
      audio: { url: data.result.mp3 },
      mimetype: 'audio/mpeg',
      caption
    }, { quoted: mek });
  } catch (err) {
    console.error("quowteaudio error:", err);
    reply("❌ Error fetching quote audio: " + err.message);
  }
});
