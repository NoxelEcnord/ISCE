const { bwmxmd } = require('../core/commandHandler');
const axios = require('axios');
const XMD = require('../core/xmd');

bwmxmd({
  pattern: "tinube",
  aliases: ["tinu", "customurl"],
  category: "shortener",
  description: "Shorten a link using Tinube with a custom name"
},
async (from, client, conText) => {
  const { q, reply } = conText;

  // Expect input like: .tinube https://example.com custom123
  const parts = q?.trim().split(/\s+/);
  if (!parts || parts.length < 2) {
    return reply("❌ Provide both a URL and a custom name.\nExample: .tinube https://example.com custom123");
  }

  const url = parts[0];
  const name = parts[1];

  if (!url.startsWith("http")) {
    return reply("❌ Invalid URL. Must start with http/https.");
  }

  try {
    const apiUrl = XMD.API.SHORTENER.TINUBE(url, name);
    const response = await axios.get(apiUrl, { timeout: 100000 });

    const result = response.data?.result;
    if (!result) {
      return reply("❌ Failed to shorten the URL.");
    }

    reply(result);
  } catch (error) {
    console.error("Tinube error:", error);
    reply("❌ Error shortening URL.");
  }
});
//========================================================================================================================
//
bwmxmd({
  pattern: "tinyurl",
  aliases: ["shorturl", "shorten"],
  category: "shortener",
  description: "Shorten a link using TinyURL"
},
async (from, client, conText) => {
  const { q, reply } = conText;

  if (!q || !q.startsWith("http")) {
    return reply("❌ Provide a valid URL to shorten, e.g. .tinyurl https://example.com");
  }

  try {
    const apiUrl = XMD.API.SHORTENER.TINYURL(q);
    const response = await axios.get(apiUrl, { timeout: 100000 });

    const result = response.data?.result;
    if (!result) {
      return reply("❌ Failed to shorten the URL.");
    }

    reply(result);
  } catch (error) {
    console.error("TinyURL error:", error);
    reply("❌ Error shortening URL.");
  }
});
