const { bwmxmd } = require('../core/commandHandler');
const axios = require('axios');
const XMD = require('../core/xmd');

const getContactMsg = (contactName, sender) => XMD.getContactMsg(contactName, sender);

// helper function
const fetchLogoUrl = async (url, name) => {
  try {
    const response = await axios.get(XMD.LOGO.EPHOTO(url, name));
    const data = response.data;

    if (data && data.result && data.result.download_url) {
      return data.result.download_url;
    }

    console.error("Invalid response structure:", data);
    return null;
  } catch (error) {
    console.error("Error fetching logo:", error);
    return null;
  }
};
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
bwmxmd({
  pattern: "tigervideo",
  category: "ephoto",
  description: "Generate text logo using Ephoto API"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) {
    return reply("_Please provide text to create logo_");
  }

  try {
    const logoUrl = await fetchLogoUrl(
      "https://en.ephoto360.com/create-digital-tiger-logo-video-effect-723.html",
      q
    );

    if (logoUrl) {
      await client.sendMessage(from, {
        video: { url: logoUrl }
      }, { quoted: mek });
    } else {
      reply("_Unable to fetch logo. Please try again later._");
    }
  } catch (error) {
    console.error("Thunder logo command error:", error);
    reply(`❌ An error occurred:\n${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "introvideo",
  category: "ephoto",
  description: "Generate text logo using Ephoto API"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) {
    return reply("_Please provide text to create logo_");
  }

  try {
    const logoUrl = await fetchLogoUrl(
      "https://en.ephoto360.com/free-logo-intro-video-maker-online-558.html",
      q
    );

    if (logoUrl) {
      await client.sendMessage(from, {
        video: { url: logoUrl }
      }, { quoted: mek });
    } else {
      reply("_Unable to fetch logo. Please try again later._");
    }
  } catch (error) {
    console.error("Thunder logo command error:", error);
    reply(`❌ An error occurred:\n${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "lightningpubg",
  category: "ephoto",
  description: "Generate text logo using Ephoto API"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) {
    return reply("_Please provide text to create logo_");
  }

  try {
    const logoUrl = await fetchLogoUrl(
      "https://en.ephoto360.com/lightning-pubg-video-logo-maker-online-615.html",
      q
    );

    if (logoUrl) {
      await client.sendMessage(from, {
        video: { url: logoUrl }
      }, { quoted: mek });
    } else {
      reply("_Unable to fetch logo. Please try again later._");
    }
  } catch (error) {
    console.error("Thunder logo command error:", error);
    reply(`❌ An error occurred:\n${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "lovevideo",
  category: "ephoto",
  description: "Generate text logo using Ephoto API"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) {
    return reply("_Please provide text to create logo_");
  }

  try {
    const logoUrl = await fetchLogoUrl(
      "https://en.ephoto360.com/create-sweet-love-video-cards-online-734.html",
      q
    );

    if (logoUrl) {
      await client.sendMessage(from, {
        video: { url: logoUrl }
      }, { quoted: mek });
    } else {
      reply("_Unable to fetch logo. Please try again later._");
    }
  } catch (error) {
    console.error("Thunder logo command error:", error);
    reply(`❌ An error occurred:\n${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "blackpink",
  category: "ephoto",
  description: "Generate text logo using Ephoto API"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) {
    return reply("_Please provide text to create logo_");
  }

  try {
    const logoUrl = await fetchLogoUrl(
      "https://en.ephoto360.com/online-blackpink-style-logo-maker-effect-711.html",
      q
    );

    if (logoUrl) {
      await client.sendMessage(from, {
        image: { url: logoUrl }
      }, { quoted: mek });
    } else {
      reply("_Unable to fetch logo. Please try again later._");
    }
  } catch (error) {
    console.error("Thunder logo command error:", error);
    reply(`❌ An error occurred:\n${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "1917",
  category: "ephoto",
  description: "Generate text logo using Ephoto API"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) {
    return reply("_Please provide text to create logo_");
  }

  try {
    const logoUrl = await fetchLogoUrl(
      "https://en.ephoto360.com/1917-style-text-effect-523.html",
      q
    );

    if (logoUrl) {
      await client.sendMessage(from, {
        image: { url: logoUrl }
      }, { quoted: mek });
    } else {
      reply("_Unable to fetch logo. Please try again later._");
    }
  } catch (error) {
    console.error("Thunder logo command error:", error);
    reply(`❌ An error occurred:\n${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "advancedglow",
  category: "ephoto",
  description: "Generate text logo using Ephoto API"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) {
    return reply("_Please provide text to create logo_");
  }

  try {
    const logoUrl = await fetchLogoUrl(
      "https://en.ephoto360.com/advanced-glow-effects-74.html",
      q
    );

    if (logoUrl) {
      await client.sendMessage(from, {
        image: { url: logoUrl }
      }, { quoted: mek });
    } else {
      reply("_Unable to fetch logo. Please try again later._");
    }
  } catch (error) {
    console.error("Thunder logo command error:", error);
    reply(`❌ An error occurred:\n${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "cartoonstyle",
  category: "ephoto",
  description: "Generate text logo using Ephoto API"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) {
    return reply("_Please provide text to create logo_");
  }

  try {
    const logoUrl = await fetchLogoUrl(
      "https://en.ephoto360.com/create-a-cartoon-style-graffiti-text-effect-online-668.html",
      q
    );

    if (logoUrl) {
      await client.sendMessage(from, {
        image: { url: logoUrl }
      }, { quoted: mek });
    } else {
      reply("_Unable to fetch logo. Please try again later._");
    }
  } catch (error) {
    console.error("Thunder logo command error:", error);
    reply(`❌ An error occurred:\n${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "deletetext",
  category: "ephoto",
  description: "Generate text logo using Ephoto API"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) {
    return reply("_Please provide text to create logo_");
  }

  try {
    const logoUrl = await fetchLogoUrl(
      "https://en.ephoto360.com/create-eraser-deleting-text-effect-online-717.html",
      q
    );

    if (logoUrl) {
      await client.sendMessage(from, {
        image: { url: logoUrl }
      }, { quoted: mek });
    } else {
      reply("_Unable to fetch logo. Please try again later._");
    }
  } catch (error) {
    console.error("Thunder logo command error:", error);
    reply(`❌ An error occurred:\n${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "dragonball",
  category: "ephoto",
  description: "Generate text logo using Ephoto API"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) {
    return reply("_Please provide text to create logo_");
  }

  try {
    const logoUrl = await fetchLogoUrl(
      "https://en.ephoto360.com/create-dragon-ball-style-text-effects-online-809.html",
      q
    );

    if (logoUrl) {
      await client.sendMessage(from, {
        image: { url: logoUrl }
      }, { quoted: mek });
    } else {
      reply("_Unable to fetch logo. Please try again later._");
    }
  } catch (error) {
    console.error("Thunder logo command error:", error);
    reply(`❌ An error occurred:\n${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "cloudeffect",
  category: "ephoto",
  description: "Generate text logo using Ephoto API"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) {
    return reply("_Please provide text to create logo_");
  }

  try {
    const logoUrl = await fetchLogoUrl(
      "https://en.ephoto360.com/write-text-effect-clouds-in-the-sky-online-619.html",
      q
    );

    if (logoUrl) {
      await client.sendMessage(from, {
        image: { url: logoUrl }
      }, { quoted: mek });
    } else {
      reply("_Unable to fetch logo. Please try again later._");
    }
  } catch (error) {
    console.error("Thunder logo command error:", error);
    reply(`❌ An error occurred:\n${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "galaxy",
  category: "ephoto",
  description: "Generate text logo using Ephoto API"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) {
    return reply("_Please provide text to create logo_");
  }

  try {
    const logoUrl = await fetchLogoUrl(
      "https://en.ephoto360.com/create-galaxy-style-free-name-logo-438.html",
      q
    );

    if (logoUrl) {
      await client.sendMessage(from, {
        image: { url: logoUrl }
      }, { quoted: mek });
    } else {
      reply("_Unable to fetch logo. Please try again later._");
    }
  } catch (error) {
    console.error("Thunder logo command error:", error);
    reply(`❌ An error occurred:\n${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "galaxywallpaper",
  category: "ephoto",
  description: "Generate text logo using Ephoto API"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) {
    return reply("_Please provide text to create logo_");
  }

  try {
    const logoUrl = await fetchLogoUrl(
      "https://en.ephoto360.com/create-galaxy-wallpaper-mobile-online-528.html",
      q
    );

    if (logoUrl) {
      await client.sendMessage(from, {
        image: { url: logoUrl }
      }, { quoted: mek });
    } else {
      reply("_Unable to fetch logo. Please try again later._");
    }
  } catch (error) {
    console.error("Thunder logo command error:", error);
    reply(`❌ An error occurred:\n${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "glitch",
  category: "ephoto",
  description: "Generate text logo using Ephoto API"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) {
    return reply("_Please provide text to create logo_");
  }

  try {
    const logoUrl = await fetchLogoUrl(
      "https://en.ephoto360.com/create-digital-glitch-text-effects-online-767.html",
      q
    );

    if (logoUrl) {
      await client.sendMessage(from, {
        image: { url: logoUrl }
      }, { quoted: mek });
    } else {
      reply("_Unable to fetch logo. Please try again later._");
    }
  } catch (error) {
    console.error("Thunder logo command error:", error);
    reply(`❌ An error occurred:\n${error.message}`);
  }
});

//========================================================================================================================
bwmxmd({
  pattern: "glowingtext",
  category: "ephoto",
  description: "Generate text logo using Ephoto API"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) {
    return reply("_Please provide text to create logo_");
  }

  try {
    const logoUrl = await fetchLogoUrl(
      "https://en.ephoto360.com/create-glowing-text-effects-online-706.html",
      q
    );

    if (logoUrl) {
      await client.sendMessage(from, {
        image: { url: logoUrl }
      }, { quoted: mek });
    } else {
      reply("_Unable to fetch logo. Please try again later._");
    }
  } catch (error) {
    console.error("Thunder logo command error:", error);
    reply(`❌ An error occurred:\n${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "gradient",
  category: "ephoto",
  description: "Generate text logo using Ephoto API"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) {
    return reply("_Please provide text to create logo_");
  }

  try {
    const logoUrl = await fetchLogoUrl(
      "https://en.ephoto360.com/create-3d-gradient-text-effect-online-600.html",
      q
    );

    if (logoUrl) {
      await client.sendMessage(from, {
        image: { url: logoUrl }
      }, { quoted: mek });
    } else {
      reply("_Unable to fetch logo. Please try again later._");
    }
  } catch (error) {
    console.error("Thunder logo command error:", error);
    reply(`❌ An error occurred:\n${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "graffitipaint",
  category: "ephoto",
  description: "Generate text logo using Ephoto API"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) {
    return reply("_Please provide text to create logo_");
  }

  try {
    const logoUrl = await fetchLogoUrl(
      "https://en.ephoto360.com/cute-girl-painting-graffiti-text-effect-667.html",
      q
    );

    if (logoUrl) {
      await client.sendMessage(from, {
        image: { url: logoUrl }
      }, { quoted: mek });
    } else {
      reply("_Unable to fetch logo. Please try again later._");
    }
  } catch (error) {
    console.error("Thunder logo command error:", error);
    reply(`❌ An error occurred:\n${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "greenneon",
  category: "ephoto",
  description: "Generate text logo using Ephoto API"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) {
    return reply("_Please provide text to create logo_");
  }

  try {
    const logoUrl = await fetchLogoUrl(
      "https://en.ephoto360.com/create-light-effects-green-neon-online-429.html",
      q
    );

    if (logoUrl) {
      await client.sendMessage(from, {
        image: { url: logoUrl }
      }, { quoted: mek });
    } else {
      reply("_Unable to fetch logo. Please try again later._");
    }
  } catch (error) {
    console.error("Thunder logo command error:", error);
    reply(`❌ An error occurred:\n${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "hologram",
  category: "ephoto",
  description: "Generate text logo using Ephoto API"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) {
    return reply("_Please provide text to create logo_");
  }

  try {
    const logoUrl = await fetchLogoUrl(
      "https://en.ephoto360.com/free-create-a-3d-hologram-text-effect-441.html",
      q
    );

    if (logoUrl) {
      await client.sendMessage(from, {
        image: { url: logoUrl }
      }, { quoted: mek });
    } else {
      reply("_Unable to fetch logo. Please try again later._");
    }
  } catch (error) {
    console.error("Thunder logo command error:", error);
    reply(`❌ An error occurred:\n${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "icetext",
  category: "ephoto",
  description: "Generate text logo using Ephoto API"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) {
    return reply("_Please provide text to create logo_");
  }

  try {
    const logoUrl = await fetchLogoUrl(
      "https://en.ephoto360.com/ice-text-effect-online-101.html",
      q
    );

    if (logoUrl) {
      await client.sendMessage(from, {
        image: { url: logoUrl }
      }, { quoted: mek });
    } else {
      reply("_Unable to fetch logo. Please try again later._");
    }
  } catch (error) {
    console.error("Thunder logo command error:", error);
    reply(`❌ An error occurred:\n${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "incadescent",
  category: "ephoto",
  description: "Generate text logo using Ephoto API"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) {
    return reply("_Please provide text to create logo_");
  }

  try {
    const logoUrl = await fetchLogoUrl(
      "https://en.ephoto360.com/text-effects-incandescent-bulbs-219.html",
      q
    );

    if (logoUrl) {
      await client.sendMessage(from, {
        image: { url: logoUrl }
      }, { quoted: mek });
    } else {
      reply("_Unable to fetch logo. Please try again later._");
    }
  } catch (error) {
    console.error("Thunder logo command error:", error);
    reply(`❌ An error occurred:\n${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "tattoo",
  category: "ephoto",
  description: "Generate text logo using Ephoto API"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) {
    return reply("_Please provide text to create logo_");
  }

  try {
    const logoUrl = await fetchLogoUrl(
      "https://en.ephoto360.com/make-tattoos-online-by-your-name-309.html",
      q
    );

    if (logoUrl) {
      await client.sendMessage(from, {
        image: { url: logoUrl }
      }, { quoted: mek });
    } else {
      reply("_Unable to fetch logo. Please try again later._");
    }
  } catch (error) {
    console.error("Thunder logo command error:", error);
    reply(`❌ An error occurred:\n${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "zodiac",
  category: "ephoto",
  description: "Generate text logo using Ephoto API"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) {
    return reply("_Please provide text to create logo_");
  }

  try {
    const logoUrl = await fetchLogoUrl(
      "https://en.ephoto360.com/free-zodiac-online-logo-maker-491.html",
      q
    );

    if (logoUrl) {
      await client.sendMessage(from, {
        image: { url: logoUrl }
      }, { quoted: mek });
    } else {
      reply("_Unable to fetch logo. Please try again later._");
    }
  } catch (error) {
    console.error("Thunder logo command error:", error);
    reply(`❌ An error occurred:\n${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "comic",
  category: "ephoto",
  description: "Generate text logo using Ephoto API"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) {
    return reply("_Please provide text to create logo_");
  }

  try {
    const logoUrl = await fetchLogoUrl(
      "https://en.ephoto360.com/create-online-3d-comic-style-text-effects-817.html",
      q
    );

    if (logoUrl) {
      await client.sendMessage(from, {
        image: { url: logoUrl }
      }, { quoted: mek });
    } else {
      reply("_Unable to fetch logo. Please try again later._");
    }
  } catch (error) {
    console.error("Thunder logo command error:", error);
    reply(`❌ An error occurred:\n${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "graffiti",
  category: "ephoto",
  description: "Generate text logo using Ephoto API"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) {
    return reply("_Please provide text to create logo_");
  }

  try {
    const logoUrl = await fetchLogoUrl(
      "https://en.ephoto360.com/cover-graffiti-181.html",
      q
    );

    if (logoUrl) {
      await client.sendMessage(from, {
        image: { url: logoUrl }
      }, { quoted: mek });
    } else {
      reply("_Unable to fetch logo. Please try again later._");
    }
  } catch (error) {
    console.error("Thunder logo command error:", error);
    reply(`❌ An error occurred:\n${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "firework",
  category: "ephoto",
  description: "Generate text logo using Ephoto API"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) {
    return reply("_Please provide text to create logo_");
  }

  try {
    const logoUrl = await fetchLogoUrl(
      "https://en.ephoto360.com/vibrant-fireworks-text-effect-535.html",
      q
    );

    if (logoUrl) {
      await client.sendMessage(from, {
        image: { url: logoUrl }
      }, { quoted: mek });
    } else {
      reply("_Unable to fetch logo. Please try again later._");
    }
  } catch (error) {
    console.error("Thunder logo command error:", error);
    reply(`❌ An error occurred:\n${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "underwater",
  category: "ephoto",
  description: "Generate text logo using Ephoto API"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) {
    return reply("_Please provide text to create logo_");
  }

  try {
    const logoUrl = await fetchLogoUrl(
      "https://en.ephoto360.com/3d-underwater-text-effect-online-682.html",
      q
    );

    if (logoUrl) {
      await client.sendMessage(from, {
        image: { url: logoUrl }
      }, { quoted: mek });
    } else {
      reply("_Unable to fetch logo. Please try again later._");
    }
  } catch (error) {
    console.error("Thunder logo command error:", error);
    reply(`❌ An error occurred:\n${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "lighteffect",
  category: "ephoto",
  description: "Generate text logo using Ephoto API"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) {
    return reply("_Please provide text to create logo_");
  }

  try {
    const logoUrl = await fetchLogoUrl(
      "https://en.ephoto360.com/light-text-effect-futuristic-technology-style-648.html",
      q
    );

    if (logoUrl) {
      await client.sendMessage(from, {
        image: { url: logoUrl }
      }, { quoted: mek });
    } else {
      reply("_Unable to fetch logo. Please try again later._");
    }
  } catch (error) {
    console.error("Thunder logo command error:", error);
    reply(`❌ An error occurred:\n${error.message}`);
  }
});
//========================================================================================================================

bwmxmd({
  pattern: "thunder",
  aliases: ["thunderlogo", "ephoto-thunder"],
  category: "ephoto",
  description: "Generate thunder text logo using Ephoto API"
},
async (from, client, conText) => {
  const { q, mek, reply } = conText;

  if (!q) {
    return reply("_Please provide text to create logo_");
  }

  try {
    const logoUrl = await fetchLogoUrl(
      "https://en.ephoto360.com/thunder-text-effect-online-97.html",
      q
    );

    if (logoUrl) {
      await client.sendMessage(from, {
        image: { url: logoUrl }
      }, { quoted: mek });
    } else {
      reply("_Unable to fetch logo. Please try again later._");
    }
  } catch (error) {
    console.error("Thunder logo command error:", error);
    reply(`❌ An error occurred:\n${error.message}`);
  }
});
