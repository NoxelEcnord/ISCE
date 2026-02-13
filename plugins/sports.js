const { bwmxmd } = require('../core/commandHandler');
const axios = require('axios');
const { generateWAMessageContent, generateWAMessageFromContent } = require('@whiskeysockets/baileys');
const s = require(__dirname + "/../config");
const XMD = require('../core/xmd');

const BOT_NAME = s.BOT || 'ISCE-BOT';
const getGlobalContextInfo = () => XMD.getContextInfo();
const getContactMsg = (contactName, sender) => XMD.getContactMsg(contactName, sender);

bwmxmd({
  pattern: "livescore",
  aliases: ["live", "score"],
  description: "Get live, finished, or upcoming football matches",
  category: "Sports",
  filename: __filename
}, async (from, client, conText) => {
  const { mek, reply, timezone } = conText;

  const caption = `*${BOT_NAME} - LIVE SCORES*

Select match status:

1. Live Matches
2. Finished Matches
3. Upcoming Matches

Reply with number (1-3)

▬▬▬▬▬▬▬▬▬▬\n *Visit for more*\n> bwmxmd.co.ke \n\n*Deploy your bot now*\n> pro.bwmxmd.co.ke \n▬▬▬▬▬▬▬▬▬▬`;

  const sent = await client.sendMessage(from, { text: caption, contextInfo: getGlobalContextInfo() }, { quoted: mek });
  const messageId = sent.key.id;

  const handleReply = async (update) => {
    const msg = update.messages[0];
    if (!msg.message) return;

    const responseText = msg.message.conversation || msg.message.extendedTextMessage?.text;
    const isReply = msg.message.extendedTextMessage?.contextInfo?.stanzaId === messageId;
    const chatId = msg.key.remoteJid;

    if (!isReply || chatId !== from) return;

    const choice = responseText?.trim();
    
    const optionMap = {
      "1": { name: "Live", emoji: "🔴", filter: "live" },
      "2": { name: "Finished", emoji: "✅", filter: "finished" },
      "3": { name: "Upcoming", emoji: "⏰", filter: "upcoming" }
    };

    if (!optionMap[choice]) {
      return client.sendMessage(chatId, {
        text: "Invalid option. Reply with 1, 2, or 3.",
        contextInfo: getGlobalContextInfo()
      }, { quoted: msg });
    }

    const selected = optionMap[choice];

    try {
      await client.sendMessage(chatId, { react: { text: selected.emoji, key: msg.key } });

      const res = await axios.get(XMD.API.SPORTS.LIVESCORE);
      const data = res.data;

      if (!data.status || !data.result || !data.result.games) {
        return client.sendMessage(chatId, {
          text: `No match data available at the moment.`,
          contextInfo: getGlobalContextInfo()
        }, { quoted: msg });
      }

      const games = Object.values(data.result.games);
      const userTimeZone = timezone || "Africa/Nairobi";
      
      const now = new Date();
      const currentUserTimeStr = now.toLocaleTimeString("en-US", {
        timeZone: userTimeZone,
        hour12: false,
        hour: "2-digit",
        minute: "2-digit"
      });
      
      let filteredGames = [];

      games.forEach(game => {
        const matchStatus = game.R?.st || "";
        const userMatchTime = convertToUserTime(game.tm, game.dt, userTimeZone);
        
        let category = "";
        
        if (matchStatus === '1T' || matchStatus === '2T' || matchStatus === 'HT') {
          category = "live";
        } else if (matchStatus === 'FT' || matchStatus === 'Pen') {
          category = "finished";
        } else if (matchStatus === '' || matchStatus === 'Pst' || matchStatus === 'Canc') {
          category = "upcoming";
        }
        
        if (category === selected.filter) {
          filteredGames.push({
            ...game,
            category,
            userMatchTime: userMatchTime ? userMatchTime.time : game.tm,
            userMatchDate: userMatchTime ? userMatchTime.date : game.dt
          });
        }
      });

      if (filteredGames.length === 0) {
        return client.sendMessage(chatId, {
          text: `*${selected.name} Matches*\n\nNo ${selected.name.toLowerCase()} matches found.\n\n▬▬▬▬▬▬▬▬▬▬\n *Visit for more*\n> bwmxmd.co.ke \n\n*Deploy your bot now*\n> pro.bwmxmd.co.ke \n▬▬▬▬▬▬▬▬▬▬`,
          contextInfo: getGlobalContextInfo()
        }, { quoted: msg });
      }

      const matchesByDate = {};
      
      filteredGames.forEach(game => {
        const date = game.userMatchDate || game.dt || "Today";
        if (!matchesByDate[date]) matchesByDate[date] = [];
        matchesByDate[date].push(game);
      });

      let output = `*${BOT_NAME} - ${selected.name.toUpperCase()} MATCHES* ${selected.emoji}\n\n`;
      output += `Timezone: ${userTimeZone}\n`;
      output += `Current Time: ${currentUserTimeStr}\n\n`;
      
      let totalMatches = 0;
      
      Object.entries(matchesByDate).forEach(([date, dateGames]) => {
        output += `${date}\n`;
        output += `${"—".repeat(25)}\n`;
        
        dateGames.forEach(game => {
          const status = getMatchDisplay(game);
          const score = getScoreDisplay(game);
          
          output += `${status} ${game.p1} vs ${game.p2}\n`;
          output += `   ${score}`;
          
          if (game.userMatchTime) {
            output += ` | ${game.userMatchTime}`;
            const statusText = getMatchStatusText(game.R?.st);
            if (statusText) output += ` (${statusText})`;
          }
          
          output += "\n\n";
          totalMatches++;
        });
      });

      output += `Total: ${totalMatches} match(es)\n\n▬▬▬▬▬▬▬▬▬▬\n *Visit for more*\n> bwmxmd.co.ke \n\n*Deploy your bot now*\n> pro.bwmxmd.co.ke \n▬▬▬▬▬▬▬▬▬▬`;

      await client.sendMessage(chatId, { text: output, contextInfo: getGlobalContextInfo() }, { quoted: msg });

    } catch (err) {
      console.error("livescore error:", err);
      await client.sendMessage(chatId, {
        text: `Error fetching ${selected.name} matches.`,
        contextInfo: getGlobalContextInfo()
      }, { quoted: msg });
    }
  };

  client.ev.on("messages.upsert", handleReply);
  setTimeout(() => client.ev.off("messages.upsert", handleReply), 300000);
});

function convertToUserTime(timeStr, dateStr, userTimeZone) {
  if (!timeStr || !dateStr) return null;
  
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);
    const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));
    
    const userDateStr = utcDate.toLocaleDateString("en-US", {
      timeZone: userTimeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    
    const userTimeStr = utcDate.toLocaleTimeString("en-US", {
      timeZone: userTimeZone,
      hour12: false,
      hour: "2-digit",
      minute: "2-digit"
    });
    
    const [userMonth, userDay, userYear] = userDateStr.split('/');
    const formattedDate = `${userYear}-${userMonth.padStart(2, '0')}-${userDay.padStart(2, '0')}`;
    
    return { date: formattedDate, time: userTimeStr };
  } catch (e) {
    return null;
  }
}

function getMatchDisplay(game) {
  const status = game.R?.st || "";
  if (status === 'HT') return "⏸";
  if (status === 'FT' || status === 'Pen') return "✅";
  if (status === '1T' || status === '2T') return "🔴";
  return game.category === "upcoming" ? "⏰" : "⚽";
}

function getMatchStatusText(status) {
  const statusMap = {
    '': 'Not Started',
    'FT': 'Full Time',
    '1T': 'First Half',
    '2T': 'Second Half',
    'HT': 'Half Time',
    'Pst': 'Postponed',
    'Canc': 'Cancelled',
    'Pen': 'Penalties'
  };
  return statusMap[status] || status;
}

function getScoreDisplay(game) {
  if (game.R && game.R.r1 !== undefined && game.R.r2 !== undefined) {
    return `${game.R.r1} - ${game.R.r2}`;
  }
  return "0 - 0";
}

function formatDate(ts) {
  try {
    const d = new Date(Number(ts));
    return d.toDateString();
  } catch {
    return "Unknown Date";
  }
}

bwmxmd({
  pattern: "sportnews",
  aliases: ["footballnews", "soccernews"],
  category: "Sports",
  description: "Get latest football news",
  filename: __filename
}, async (from, client, conText) => {
  const { mek, deviceMode } = conText;

  try {
    const apiUrl = XMD.API.SPORTS.NEWS;
    const res = await axios.get(apiUrl, { timeout: 100000 });
    const items = res.data?.result?.data?.items;

    if (!Array.isArray(items) || items.length === 0) return;

    const news = items.slice(0, 8);
    
    if (deviceMode === 'iPhone') {
      let textList = `⚽ *${BOT_NAME} - FOOTBALL NEWS*\n\n`;
      news.forEach((item, i) => {
        textList += `*${i + 1}.* ${item.title}\n${item.summary?.substring(0, 100)}...\n📅 ${formatDate(item.createdAt)}\n\n`;
      });
      textList += `🔗 More: ${XMD.EXTERNAL.KEITH_SPORTS}`;
      await client.sendMessage(from, { text: textList });
      return;
    }
    
    const cards = await Promise.all(news.map(async (item) => ({
      header: {
        title: `${item.title}`,
        hasMediaAttachment: true,
        imageMessage: (await generateWAMessageContent({ image: { url: item.cover?.url } }, {
          upload: client.waUploadToServer
        })).imageMessage
      },
      body: { text: `${item.summary}` },
      footer: { text: formatDate(item.createdAt) },
      nativeFlowMessage: {
        buttons: [
          {
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: "Read More",
              url: XMD.EXTERNAL.KEITH_SPORTS
            })
          },
          {
            name: "cta_copy",
            buttonParamsJson: JSON.stringify({
              display_text: "Copy Link",
              copy_code: XMD.EXTERNAL.KEITH_SPORTS
            })
          }
        ]
      }
    })));

    try {
      const message = generateWAMessageFromContent(from, {
        viewOnceMessage: {
          message: {
            messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
            interactiveMessage: {
              body: { text: `*${BOT_NAME} - FOOTBALL NEWS*` },
              footer: { text: `Showing ${news.length} stories | ${XMD.WEB}` },
              carouselMessage: { cards }
            }
          }
        }
      }, { quoted: mek });

      await client.relayMessage(from, message.message, { messageId: message.key.id });
    } catch (carouselErr) {
      let textList = `⚽ *${BOT_NAME} - FOOTBALL NEWS*\n\n`;
      news.forEach((item, i) => {
        textList += `*${i + 1}.* ${item.title}\n${item.summary?.substring(0, 100)}...\n📅 ${formatDate(item.createdAt)}\n\n`;
      });
      textList += `🔗 More: ${XMD.EXTERNAL.KEITH_SPORTS}`;
      await client.sendMessage(from, { text: textList }, { quoted: mek });
    }

  } catch (err) {
    console.error("sportnews error:", err);
  }
});

bwmxmd({
  pattern: "topscorers",
  aliases: ["scorers", "goals"],
  description: "View top goal scorers across major leagues",
  category: "Sports",
  filename: __filename
}, async (from, client, conText) => {
  const { mek, reply } = conText;

  const caption = `*${BOT_NAME} - TOP SCORERS*

Select a league:

1. Premier League
2. Bundesliga
3. La Liga
4. Ligue 1
5. Serie A
6. UEFA Champions League
7. FIFA International
8. UEFA Euro

Reply with number (1-8)

▬▬▬▬▬▬▬▬▬▬\n *Visit for more*\n> bwmxmd.co.ke \n\n*Deploy your bot now*\n> pro.bwmxmd.co.ke \n▬▬▬▬▬▬▬▬▬▬`;

  const sent = await client.sendMessage(from, { text: caption, contextInfo: getGlobalContextInfo() }, { quoted: mek });
  const messageId = sent.key.id;

  const handleReply = async (update) => {
    const msg = update.messages[0];
    if (!msg.message) return;

    const responseText = msg.message.conversation || msg.message.extendedTextMessage?.text;
    const isReply = msg.message.extendedTextMessage?.contextInfo?.stanzaId === messageId;
    const chatId = msg.key.remoteJid;

    if (!isReply) return;

    const leagueMap = {
      "1": { name: "Premier League", url: XMD.API.SPORTS.SCORERS.EPL },
      "2": { name: "Bundesliga", url: XMD.API.SPORTS.SCORERS.BUNDESLIGA },
      "3": { name: "La Liga", url: XMD.API.SPORTS.SCORERS.LALIGA },
      "4": { name: "Ligue 1", url: XMD.API.SPORTS.SCORERS.LIGUE1 },
      "5": { name: "Serie A", url: XMD.API.SPORTS.SCORERS.SERIEA },
      "6": { name: "UEFA Champions League", url: XMD.API.SPORTS.SCORERS.UCL },
      "7": { name: "FIFA International", url: XMD.API.SPORTS.SCORERS.FIFA },
      "8": { name: "UEFA Euro", url: XMD.API.SPORTS.SCORERS.EUROS }
    };

    const selected = leagueMap[responseText?.trim()];
    if (!selected) {
      return client.sendMessage(chatId, {
        text: "Invalid option. Reply with a number 1-8.",
        contextInfo: getGlobalContextInfo()
      }, { quoted: msg });
    }

    try {
      await client.sendMessage(chatId, { react: { text: "⚽", key: msg.key } });

      const res = await axios.get(selected.url);
      const data = res.data;

      if (!data.status || !Array.isArray(data.result?.topScorers)) {
        return client.sendMessage(chatId, {
          text: `Failed to fetch ${selected.name} scorers.`,
          contextInfo: getGlobalContextInfo()
        }, { quoted: msg });
      }

      let output = `*${BOT_NAME} - ${data.result.competition.toUpperCase()}*\n\n`;

      data.result.topScorers.forEach(scorer => {
        let medal = "";
        if (scorer.rank === 1) medal = "🥇 ";
        else if (scorer.rank === 2) medal = "🥈 ";
        else if (scorer.rank === 3) medal = "🥉 ";

        output += `${medal}${scorer.rank}. ${scorer.player}\n`;
        output += `   Team: ${scorer.team}\n`;
        output += `   Goals: ${scorer.goals} | Assists: ${scorer.assists} | Pens: ${scorer.penalties}\n\n`;
      });

      output += `▬▬▬▬▬▬▬▬▬▬\n *Visit for more*\n> bwmxmd.co.ke \n\n*Deploy your bot now*\n> pro.bwmxmd.co.ke \n▬▬▬▬▬▬▬▬▬▬`;

      await client.sendMessage(chatId, { text: output, contextInfo: getGlobalContextInfo() }, { quoted: msg });
    } catch (err) {
      console.error("topscorers error:", err);
      await client.sendMessage(chatId, {
        text: `Error fetching ${selected.name} scorers.`,
        contextInfo: getGlobalContextInfo()
      }, { quoted: msg });
    }
  };

  client.ev.on("messages.upsert", handleReply);
  setTimeout(() => client.ev.off("messages.upsert", handleReply), 300000);
});

bwmxmd({
  pattern: "standings",
  aliases: ["leaguetable", "league"],
  description: "View league standings",
  category: "Sports",
  filename: __filename
}, async (from, client, conText) => {
  const { mek, reply } = conText;

  const caption = `*${BOT_NAME} - LEAGUE STANDINGS*

Select a league:

1. Premier League
2. Bundesliga
3. La Liga
4. Ligue 1
5. Serie A
6. UEFA Champions League
7. FIFA International
8. UEFA Euro

Reply with number (1-8)

▬▬▬▬▬▬▬▬▬▬\n *Visit for more*\n> bwmxmd.co.ke \n\n*Deploy your bot now*\n> pro.bwmxmd.co.ke \n▬▬▬▬▬▬▬▬▬▬`;

  const sent = await client.sendMessage(from, { text: caption, contextInfo: getGlobalContextInfo() }, { quoted: mek });
  const messageId = sent.key.id;

  const handleReply = async (update) => {
    const msg = update.messages[0];
    if (!msg.message) return;

    const responseText = msg.message.conversation || msg.message.extendedTextMessage?.text;
    const isReply = msg.message.extendedTextMessage?.contextInfo?.stanzaId === messageId;
    const chatId = msg.key.remoteJid;

    if (!isReply) return;

    const leagueMap = {
      "1": { name: "Premier League", url: XMD.API.SPORTS.STANDINGS.EPL },
      "2": { name: "Bundesliga", url: XMD.API.SPORTS.STANDINGS.BUNDESLIGA },
      "3": { name: "La Liga", url: XMD.API.SPORTS.STANDINGS.LALIGA },
      "4": { name: "Ligue 1", url: XMD.API.SPORTS.STANDINGS.LIGUE1 },
      "5": { name: "Serie A", url: XMD.API.SPORTS.STANDINGS.SERIEA },
      "6": { name: "UEFA Champions League", url: XMD.API.SPORTS.STANDINGS.UCL },
      "7": { name: "FIFA International", url: XMD.API.SPORTS.STANDINGS.FIFA },
      "8": { name: "UEFA Euro", url: XMD.API.SPORTS.STANDINGS.EUROS }
    };

    const selected = leagueMap[responseText?.trim()];
    if (!selected) {
      return client.sendMessage(chatId, {
        text: "Invalid option. Reply with a number 1-8.",
        contextInfo: getGlobalContextInfo()
      }, { quoted: msg });
    }

    try {
      await client.sendMessage(chatId, { react: { text: "📊", key: msg.key } });

      const res = await axios.get(selected.url);
      const data = res.data;

      if (!data.status || !Array.isArray(data.result?.standings)) {
        return client.sendMessage(chatId, {
          text: `Failed to fetch ${selected.name} standings.`,
          contextInfo: getGlobalContextInfo()
        }, { quoted: msg });
      }

      let output = `*${BOT_NAME} - ${data.result.competition.toUpperCase()}*\n\n`;
      output += `Pos | Team | P | W | D | L | Pts | GD\n`;
      output += `${"—".repeat(35)}\n`;

      data.result.standings.forEach(team => {
        let tag = "";
        if (team.position <= 4) tag = "🟢";
        else if (team.position === 5 || team.position === 6) tag = "🔵";
        else if (team.position >= 18) tag = "🔴";

        output += `${tag}${team.position}. ${team.team}\n`;
        output += `   P:${team.played} W:${team.won} D:${team.draw} L:${team.lost} | Pts:${team.points} GD:${team.goalDifference}\n\n`;
      });

      output += `🟢 UCL | 🔵 Europa | 🔴 Relegation\n\n▬▬▬▬▬▬▬▬▬▬\n *Visit for more*\n> bwmxmd.co.ke \n\n*Deploy your bot now*\n> pro.bwmxmd.co.ke \n▬▬▬▬▬▬▬▬▬▬`;

      await client.sendMessage(chatId, { text: output, contextInfo: getGlobalContextInfo() }, { quoted: msg });
    } catch (err) {
      console.error("standings error:", err);
      await client.sendMessage(chatId, {
        text: `Error fetching ${selected.name} standings.`,
        contextInfo: getGlobalContextInfo()
      }, { quoted: msg });
    }
  };

  client.ev.on("messages.upsert", handleReply);
  setTimeout(() => client.ev.off("messages.upsert", handleReply), 300000);
});

bwmxmd({
  pattern: "fixtures",
  aliases: ["upcoming", "nextgames", "upcomingmatches"],
  description: "View upcoming matches across leagues",
  category: "Sports",
  filename: __filename
}, async (from, client, conText) => {
  const { mek, reply } = conText;

  const caption = `*${BOT_NAME} - UPCOMING FIXTURES*

Select a league:

1. Premier League
2. Bundesliga
3. La Liga
4. Ligue 1
5. Serie A
6. UEFA Champions League
7. FIFA International
8. UEFA Euro

Reply with number (1-8)

▬▬▬▬▬▬▬▬▬▬\n *Visit for more*\n> bwmxmd.co.ke \n\n*Deploy your bot now*\n> pro.bwmxmd.co.ke \n▬▬▬▬▬▬▬▬▬▬`;

  const sent = await client.sendMessage(from, { text: caption, contextInfo: getGlobalContextInfo() }, { quoted: mek });
  const messageId = sent.key.id;

  const handleReply = async (update) => {
    const msg = update.messages[0];
    if (!msg.message) return;

    const responseText = msg.message.conversation || msg.message.extendedTextMessage?.text;
    const isReply = msg.message.extendedTextMessage?.contextInfo?.stanzaId === messageId;
    const chatId = msg.key.remoteJid;

    if (!isReply) return;

    const leagueMap = {
      "1": { name: "Premier League", url: XMD.API.SPORTS.UPCOMING.EPL },
      "2": { name: "Bundesliga", url: XMD.API.SPORTS.UPCOMING.BUNDESLIGA },
      "3": { name: "La Liga", url: XMD.API.SPORTS.UPCOMING.LALIGA },
      "4": { name: "Ligue 1", url: XMD.API.SPORTS.UPCOMING.LIGUE1 },
      "5": { name: "Serie A", url: XMD.API.SPORTS.UPCOMING.SERIEA },
      "6": { name: "UEFA Champions League", url: XMD.API.SPORTS.UPCOMING.UCL },
      "7": { name: "FIFA International", url: XMD.API.SPORTS.UPCOMING.FIFA },
      "8": { name: "UEFA Euro", url: XMD.API.SPORTS.UPCOMING.EUROS }
    };

    const selected = leagueMap[responseText?.trim()];
    if (!selected) {
      return client.sendMessage(chatId, {
        text: "Invalid option. Reply with a number 1-8.",
        contextInfo: getGlobalContextInfo()
      }, { quoted: msg });
    }

    try {
      await client.sendMessage(chatId, { react: { text: "📅", key: msg.key } });

      const res = await axios.get(selected.url);
      const data = res.data;

      if (!data.status || !Array.isArray(data.result?.upcomingMatches)) {
        return client.sendMessage(chatId, {
          text: `Failed to fetch ${selected.name} fixtures.`,
          contextInfo: getGlobalContextInfo()
        }, { quoted: msg });
      }

      let output = `*${BOT_NAME} - ${selected.name.toUpperCase()} FIXTURES*\n\n`;

      data.result.upcomingMatches.forEach(match => {
        output += `Matchday ${match.matchday}\n`;
        output += `${match.homeTeam} vs ${match.awayTeam}\n`;
        output += `${match.date}\n\n`;
      });

      output += `▬▬▬▬▬▬▬▬▬▬\n *Visit for more*\n> bwmxmd.co.ke \n\n*Deploy your bot now*\n> pro.bwmxmd.co.ke \n▬▬▬▬▬▬▬▬▬▬`;

      await client.sendMessage(chatId, { text: output, contextInfo: getGlobalContextInfo() }, { quoted: msg });
    } catch (err) {
      console.error("fixtures error:", err);
      await client.sendMessage(chatId, {
        text: `Error fetching ${selected.name} fixtures.`,
        contextInfo: getGlobalContextInfo()
      }, { quoted: msg });
    }
  };

  client.ev.on("messages.upsert", handleReply);
  setTimeout(() => client.ev.off("messages.upsert", handleReply), 300000);
});

bwmxmd({
  pattern: "gamehistory",
  aliases: ["matchevents", "gameevents", "h2h"],
  description: "View match history between teams",
  category: "Sports",
  filename: __filename
}, async (from, client, conText) => {
  const { q, reply, mek } = conText;

  if (!q || !q.includes("vs")) {
    return reply("Usage: .gamehistory Arsenal vs Chelsea");
  }

  try {
    const res = await axios.get(XMD.API.SPORTS.GAME_EVENTS(q));
    const data = res.data;

    if (!data.status || !Array.isArray(data.result) || data.result.length === 0) {
      return reply("No match history found.");
    }

    for (const match of data.result.slice(0, 3)) {
      const { teams, league, venue, dateTime, status, season, media } = match;
      
      let caption = `*${BOT_NAME} - MATCH HISTORY*\n\n`;
      caption += `${match.match}\n\n`;
      caption += `League: ${league.name} (${season})\n`;
      caption += `Date: ${dateTime.date} at ${dateTime.time}\n`;
      caption += `Venue: ${venue.name || "—"}\n`;
      caption += `Round: ${match.round}\n`;
      caption += `Status: ${status}\n\n`;
      caption += `${teams.home.name}: ${teams.home.score ?? "—"}\n`;
      caption += `${teams.away.name}: ${teams.away.score ?? "—"}\n\n`;
      if (match.media?.video) caption += `Video: ${match.media.video}\n\n`;
      caption += `▬▬▬▬▬▬▬▬▬▬\n *Visit for more*\n> bwmxmd.co.ke \n\n*Deploy your bot now*\n> pro.bwmxmd.co.ke \n▬▬▬▬▬▬▬▬▬▬`;

      const mediaMsg = match.media?.poster || match.media?.thumb
        ? { image: { url: match.media.poster || match.media.thumb }, caption, contextInfo: getGlobalContextInfo() }
        : { text: caption, contextInfo: getGlobalContextInfo() };

      await client.sendMessage(from, mediaMsg, { quoted: mek });
    }
  } catch (err) {
    console.error("gamehistory error:", err);
    reply("Error fetching match history.");
  }
});

bwmxmd({
  pattern: "stadium",
  aliases: ["venue", "venuesearch"],
  description: "Search for sports venues",
  category: "Sports",
  filename: __filename
}, async (from, client, conText) => {
  const { q, reply, mek } = conText;

  if (!q) return reply("Usage: .stadium Emirates");

  try {
    const res = await axios.get(XMD.API.SPORTS.VENUE_SEARCH(q));
    const data = res.data;

    if (!data.status || !Array.isArray(data.result) || data.result.length === 0) {
      return reply("No venues found.");
    }

    for (const venue of data.result.slice(0, 3)) {
      let caption = `*${BOT_NAME} - STADIUM INFO*\n\n`;
      caption += `${venue.name}\n\n`;
      caption += `Sport: ${venue.sport || "—"}\n`;
      caption += `Location: ${venue.location || "—"}\n`;
      caption += `Country: ${venue.country || "—"}\n`;
      caption += `Built: ${venue.yearBuilt || "—"}\n`;
      caption += `Capacity: ${venue.capacity || "—"}\n`;
      caption += `Timezone: ${venue.timezone || "—"}\n\n`;
      if (venue.description) {
        caption += `${venue.description.split("\r\n").slice(0, 2).join("\n")}\n\n`;
      }
      caption += `▬▬▬▬▬▬▬▬▬▬\n *Visit for more*\n> bwmxmd.co.ke \n\n*Deploy your bot now*\n> pro.bwmxmd.co.ke \n▬▬▬▬▬▬▬▬▬▬`;

      const media = venue.media?.thumb
        ? { image: { url: venue.media.thumb }, caption, contextInfo: getGlobalContextInfo() }
        : { text: caption, contextInfo: getGlobalContextInfo() };

      await client.sendMessage(from, media, { quoted: mek });
    }
  } catch (err) {
    console.error("stadium error:", err);
    reply("Error fetching venue data.");
  }
});

bwmxmd({
  pattern: "team",
  aliases: ["teamsearch", "club"],
  description: "Search for sports teams",
  category: "Sports",
  filename: __filename
}, async (from, client, conText) => {
  const { q, reply, mek } = conText;

  if (!q) return reply("Usage: .team Arsenal");

  try {
    const res = await axios.get(XMD.API.SPORTS.TEAM_SEARCH(q));
    const data = res.data;

    if (!data.status || !Array.isArray(data.result) || data.result.length === 0) {
      return reply("No teams found.");
    }

    const team = data.result[0];
    
    let caption = `*${BOT_NAME} - TEAM INFO*\n\n`;
    caption += `${team.name}\n\n`;
    caption += `Formed: ${team.formedYear}\n`;
    caption += `Sport: ${team.sport}\n`;
    caption += `League: ${team.league}\n`;
    caption += `Location: ${team.location}, ${team.country}\n`;
    caption += `Stadium: ${team.stadium} (${team.stadiumCapacity})\n\n`;
    caption += `Website: ${team.social?.website || "—"}\n`;
    caption += `Twitter: ${team.social?.twitter || "—"}\n`;
    caption += `Instagram: ${team.social?.instagram || "—"}\n\n`;
    if (team.description) {
      caption += `${team.description.split("\r\n").slice(0, 2).join("\n")}\n\n`;
    }
    caption += `▬▬▬▬▬▬▬▬▬▬\n *Visit for more*\n> bwmxmd.co.ke \n\n*Deploy your bot now*\n> pro.bwmxmd.co.ke \n▬▬▬▬▬▬▬▬▬▬`;

    await client.sendMessage(from, {
      image: { url: team.badges?.large },
      caption,
      contextInfo: getGlobalContextInfo()
    }, { quoted: mek });
  } catch (err) {
    console.error("team error:", err);
    reply("Error fetching team data.");
  }
});

bwmxmd({
  pattern: "player",
  aliases: ["playersearch", "athlete"],
  description: "Search for sports players",
  category: "Sports",
  filename: __filename
}, async (from, client, conText) => {
  const { q, reply, mek } = conText;

  if (!q) return reply("Usage: .player Bukayo Saka");

  try {
    const res = await axios.get(XMD.API.SPORTS.PLAYER_SEARCH(q));
    const data = res.data;

    if (!data.status || !Array.isArray(data.result) || data.result.length === 0) {
      return reply("No players found.");
    }

    for (const player of data.result.slice(0, 3)) {
      let caption = `*${BOT_NAME} - PLAYER INFO*\n\n`;
      caption += `${player.name}\n\n`;
      caption += `Team: ${player.team}\n`;
      caption += `Sport: ${player.sport}\n`;
      caption += `Nationality: ${player.nationality}\n`;
      caption += `Birth Date: ${player.birthDate}\n`;
      caption += `Position: ${player.position}\n`;
      caption += `Status: ${player.status}\n\n`;
      caption += `▬▬▬▬▬▬▬▬▬▬\n *Visit for more*\n> bwmxmd.co.ke \n\n*Deploy your bot now*\n> pro.bwmxmd.co.ke \n▬▬▬▬▬▬▬▬▬▬`;

      const media = player.thumbnail
        ? { image: { url: player.thumbnail }, caption, contextInfo: getGlobalContextInfo() }
        : { text: caption, contextInfo: getGlobalContextInfo() };

      await client.sendMessage(from, media, { quoted: mek });
    }
  } catch (err) {
    console.error("player error:", err);
    reply("Error fetching player data.");
  }
});
