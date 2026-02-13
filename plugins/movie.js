const axios = require('axios');
const { bwmxmd } = require('../core/commandHandler');
const s = require(__dirname + "/../config");
const XMD = require('../core/xmd');

const BOT_NAME = s.BOT || 'ISCE-BOT';
const getGlobalContextInfo = () => XMD.getContextInfo();

bwmxmd({
  pattern: "movie",
  aliases: ["trailer", "movietrailer", "filmtrailer", "preview", "film"],
  category: "Movie",
  description: "Search for a movie and send its trailer video"
},
async (from, client, conText) => {
  const { q, mek, reply, deviceMode } = conText;

  if (!q) {
    return reply("Usage: .movie <movie name>\nExample: .movie As Good As Dead");
  }

  try {
    const { data: search } = await axios.get(XMD.API.MOVIE.SEARCH(q));

    if (!search.status || !search.result?.results?.length) {
      return reply("No movies found for that query.");
    }

    const movie = search.result.results[0];
    const { data: trailer } = await axios.get(XMD.API.MOVIE.TRAILER(movie.url));

    if (!trailer.status || !trailer.result?.trailerUrl) {
      return reply("Trailer not available.");
    }

    let movieId = '';
    try {
      const { data: movieData } = await axios.get(XMD.API.MOVIE.MOVI_SEARCH(q));
      if (movieData.data?.items?.length) {
        movieId = movieData.data.items[0].id;
      }
    } catch (e) {}

    const streamLink = movieId ? XMD.API.MOVIE.STREAM(movieId) : '';
    const typeLabel = movie.type === 'series' ? 'Series' : 'Movie';
    
    let description = trailer.result.description || '';
    description = description.replace(/MoviesBox/gi, 'BwmGift');
    
    let caption = `*${BOT_NAME} - MOVIE TRAILER*\n\n`;
    caption += `Title: ${movie.title}\n`;
    caption += `Rating: ${movie.rating}\n`;
    caption += `Type: ${typeLabel}\n\n`;
    caption += `${description}\n\n`;
    if (streamLink) {
      caption += `Stream/Download:\n${streamLink}\n\n`;
    }
    caption += `▬▬▬▬▬▬▬▬▬▬\n *Visit for more*\n> bwmxmd.co.ke \n\n*Deploy your bot now*\n> pro.bwmxmd.co.ke \n▬▬▬▬▬▬▬▬▬▬`;

    const sendOptions = deviceMode === 'iPhone' ? {} : { quoted: mek };
    const msgContent = { video: { url: trailer.result.trailerUrl }, caption: caption };
    if (deviceMode !== 'iPhone') {
      msgContent.contextInfo = getGlobalContextInfo();
    }
    await client.sendMessage(from, msgContent, sendOptions);

  } catch (err) {
    console.error("Movie error:", err);
    reply("An error occurred while fetching the trailer.");
  }
});

bwmxmd({
  pattern: "movietable",
  aliases: ["mtable", "movies", "movielist"],
  category: "Movie",
  description: "Browse movies from various categories"
},
async (from, client, conText) => {
  const { q, mek, reply, deviceMode } = conText;

  const categories = {
    'popular': { name: 'Popular Searches', url: XMD.API.MOVIE.POPULAR_SEARCHES },
    'latest': { name: 'Latest Releases', url: XMD.API.MOVIE.LATEST },
    'watched': { name: 'Most Watched', url: XMD.API.MOVIE.MOST_WATCHED },
    'week': { name: 'Trending This Week', url: XMD.API.MOVIE.TRENDING_WEEK },
    'today': { name: 'Trending Today', url: XMD.API.MOVIE.TRENDING_TODAY },
    'trending': { name: 'Trending Now', url: XMD.API.MOVIE.TRENDING }
  };

  const selectedCategory = q?.toLowerCase() || 'trending';
  const category = categories[selectedCategory] || categories['trending'];

  try {
    const { data } = await axios.get(category.url);
    
    if (!data.success || !data.data) {
      return reply("Failed to fetch movie listings.");
    }

    const items = data.data.items || [];
    const keywords = data.data.keywords || [];

    if (items.length === 0 && keywords.length === 0) {
      return reply("No movies found in this category.");
    }
    
    if (items.length > 0) {
      const displayItems = items.slice(0, 10);

      let tableText = `*${BOT_NAME} - BWMGIFT MOVIES*\n`;
      tableText += `━━━━━━━━━━━━━━━━━━━━\n`;
      tableText += `📂 *${category.name}*\n\n`;
      
      displayItems.forEach((item, index) => {
        const typeIcon = item.type === 'series' ? '📺' : '🎬';
        tableText += `*${index + 1}.* ${typeIcon} ${item.title} (${item.year})\n`;
        tableText += `   ⭐ ${item.rating} | ${item.genre || 'N/A'}\n\n`;
      });
      
      tableText += `━━━━━━━━━━━━━━━━━━━━\n`;
      tableText += `📝 *Reply with number (1-${displayItems.length}) to get details*\n\n`;
      tableText += `_Categories: popular, latest, watched, week, today, trending_\n\n`;
      tableText += `▬▬▬▬▬▬▬▬▬▬\n *Visit for more*\n> bwmxmd.co.ke \n\n*Deploy your bot now*\n> pro.bwmxmd.co.ke \n▬▬▬▬▬▬▬▬▬▬`;

      const firstPoster = displayItems[0]?.poster || displayItems[0]?.thumbnail;
      
      let sent;
      if (firstPoster) {
        const msgContent = { 
          image: { url: firstPoster }, 
          caption: tableText 
        };
        if (deviceMode !== 'iPhone') {
          msgContent.contextInfo = getGlobalContextInfo();
        }
        sent = await client.sendMessage(from, msgContent, deviceMode === 'iPhone' ? {} : { quoted: mek });
      } else {
        sent = await client.sendMessage(from, { text: tableText }, deviceMode === 'iPhone' ? {} : { quoted: mek });
      }

      const messageId = sent.key.id;

      const handleReply = async (update) => {
        const msg = update.messages[0];
        if (!msg?.message) return;

        const responseText = msg.message.conversation || msg.message.extendedTextMessage?.text;
        const isReply = msg.message.extendedTextMessage?.contextInfo?.stanzaId === messageId;
        const chatId = msg.key.remoteJid;

        if (!isReply || chatId !== from) return;

        const num = parseInt(responseText?.trim());
        if (isNaN(num) || num < 1 || num > displayItems.length) return;

        try {
          await client.sendMessage(from, { react: { text: '⏳', key: msg.key } });
        } catch (e) {}

        const movie = displayItems[num - 1];
        await sendMovieDetails(client, from, movie, msg, deviceMode);
      };

      client.ev.on("messages.upsert", handleReply);
      setTimeout(() => client.ev.off("messages.upsert", handleReply), 300000);
      
    } else if (keywords.length > 0) {
      let tableText = `*${BOT_NAME} - BWMGIFT MOVIES*\n`;
      tableText += `━━━━━━━━━━━━━━━━━━━━\n`;
      tableText += `🔍 *${category.name}*\n\n`;
      
      keywords.slice(0, 15).forEach((keyword, index) => {
        tableText += `*${index + 1}.* ${keyword}\n`;
      });
      
      tableText += `\n━━━━━━━━━━━━━━━━━━━━\n`;
      tableText += `Use: .movie <title> to search\n\n`;
      tableText += `▬▬▬▬▬▬▬▬▬▬\n *Visit for more*\n> bwmxmd.co.ke \n\n*Deploy your bot now*\n> pro.bwmxmd.co.ke \n▬▬▬▬▬▬▬▬▬▬`;

      await client.sendMessage(from, { text: tableText }, deviceMode === 'iPhone' ? {} : { quoted: mek });
    }

  } catch (err) {
    console.error("Movie table error:", err);
    reply("An error occurred while fetching movie listings.");
  }
});

async function sendMovieDetails(client, from, movie, quotedMsg, deviceMode) {
  const streamLink = XMD.API.MOVIE.STREAM(movie.id);
  const typeLabel = movie.type === 'series' ? 'Series' : 'Movie';
  
  try {
    const { data: search } = await axios.get(XMD.API.MOVIE.SEARCH(movie.title));
    
    let description = movie.description || '';
    let trailerUrl = null;
    
    if (search.status && search.result?.results?.length) {
      const searchedMovie = search.result.results[0];
      try {
        const { data: trailer } = await axios.get(XMD.API.MOVIE.TRAILER(searchedMovie.url));
        if (trailer.status && trailer.result) {
          description = trailer.result.description || description;
          trailerUrl = trailer.result.trailerUrl;
        }
      } catch (e) {}
    }
    
    description = description.replace(/MoviesBox/gi, 'BwmGift');
    
    let caption = `*${BOT_NAME} - BWMGIFT MOVIE*\n`;
    caption += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    caption += `🎬 *Title:* ${movie.title}\n`;
    caption += `📅 *Year:* ${movie.year}\n`;
    caption += `⭐ *Rating:* ${movie.rating}/10\n`;
    caption += `🎭 *Type:* ${typeLabel}\n`;
    caption += `🎪 *Genre:* ${movie.genre || movie.genres?.join(', ') || 'N/A'}\n`;
    if (description) {
      caption += `\n📝 *Description:*\n${description.substring(0, 500)}${description.length > 500 ? '...' : ''}\n`;
    }
    caption += `\n🔗 *Stream/Download:*\n${streamLink}\n`;
    caption += `\n▬▬▬▬▬▬▬▬▬▬\n *Visit for more*\n> bwmxmd.co.ke \n\n*Deploy your bot now*\n> pro.bwmxmd.co.ke \n▬▬▬▬▬▬▬▬▬▬`;

    if (trailerUrl) {
      const msgContent = { video: { url: trailerUrl }, caption: caption };
      if (deviceMode !== 'iPhone') {
        msgContent.contextInfo = getGlobalContextInfo();
      }
      await client.sendMessage(from, msgContent, { quoted: quotedMsg });
    } else {
      const poster = movie.poster || movie.thumbnail;
      if (poster) {
        const msgContent = { image: { url: poster }, caption: caption };
        if (deviceMode !== 'iPhone') {
          msgContent.contextInfo = getGlobalContextInfo();
        }
        await client.sendMessage(from, msgContent, { quoted: quotedMsg });
      } else {
        await client.sendMessage(from, { text: caption }, { quoted: quotedMsg });
      }
    }

    try {
      await client.sendMessage(from, { react: { text: '✅', key: quotedMsg.key } });
    } catch (e) {}
    
  } catch (err) {
    console.error("Movie details error:", err);
    try {
      await client.sendMessage(from, { react: { text: '❌', key: quotedMsg.key } });
    } catch (e) {}
  }
}
