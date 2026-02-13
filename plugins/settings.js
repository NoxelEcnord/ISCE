const { bwmxmd } = require('../core/commandHandler');
const { getAntiDeleteSettings, updateAntiDeleteSettings, syncAntiDeleteFromEnv } = require('../core/database/antidelete');
const { getAntiLinkSettings, updateAntiLinkSettings, clearAllWarns, syncAntiLinkFromEnv } = require('../core/database/antilink');
const { getAntiStatusMentionSettings, updateAntiStatusMentionSettings, clearAllStatusWarns, syncAntiStatusMentionFromEnv } = require('../core/database/antistatusmention');
const { getAutoBioSettings, updateAutoBioSettings, syncAutoBioFromEnv } = require('../core/database/autobio');
const { getAutoReadSettings, updateAutoReadSettings, syncAutoReadFromEnv } = require('../core/database/autoread');
const { getAutoStatusSettings, updateAutoStatusSettings, syncAutoStatusFromEnv } = require('../core/database/autostatus');
const { getChatbotSettings, updateChatbotSettings, clearConversationHistory, getConversationHistory, availableVoices, syncChatbotFromEnv } = require('../core/database/chatbot');
const axios = require('axios');
const XMD = require('../core/xmd');
const { getGreetSettings, updateGreetSettings, clearRepliedContacts } = require('../core/database/greet');
const { getPresenceSettings, updatePresenceSettings, syncPresenceFromEnv } = require('../core/database/presence');
const { updateSettings, getSettings, syncSettingsFromEnv } = require('../core/database/settings');
const { getGroupEventsSettings, updateGroupEventsSettings } = require('../core/database/groupevents');
const { getAntiCallSettings, updateAntiCallSettings, syncAntiCallFromEnv } = require('../core/database/anticall');

//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//const { bwmxmd } = require('../core/commandHandler');

bwmxmd({
  pattern: "anticall",
  aliases: ["callset", "anticallsetting"],
  description: "Manage anti-call settings",
  category: "Settings",
  filename: __filename
}, async (from, client, conText) => {
  const { q, prefix, reply, isSuperUser, isSubBot, updateSubBotSettings, botSettings } = conText;

  if (!isSuperUser) {
    return reply("❌ You need superuser privileges to manage anti-call settings.");
  }

  const args = q?.trim().split(/\s+/) || [];
  const subcommand = args[0]?.toLowerCase();
  const value = args.slice(1).join(" ");
  
  // Get settings based on whether this is a sub-bot or main bot
  let settings;
  if (isSubBot && botSettings) {
    settings = {
      status: botSettings.anticallStatus || false,
      action: botSettings.anticallAction || 'reject',
      message: botSettings.anticallMessage || '⚠️ *Calls are not allowed!*\n\nPlease send a message instead.'
    };
  } else {
    settings = await getAntiCallSettings();
  }
  
  const subBotNote = isSubBot ? '\n_(Only affects this sub-bot)_' : '';

  if (!subcommand) {
    const status = settings.status ? '✅ ON' : '❌ OFF';
    const action = settings.action === 'block' ? 'Block caller' : 'Reject call';
    const actionEmoji = settings.action === 'block' ? '🚫' : '❌';

    return reply(
      `*📜 Anti-Call Settings*\n\n` +
      `🔹 *Status:* ${status}\n` +
      `🔹 *Action:* ${actionEmoji} ${action}\n` +
      `🔹 *Message:* ${settings.message || '*No message set*'}\n` +
      (isSubBot ? `🔹 *Sub-Bot:* Yes\n` : '') + `\n` +
      `*🛠 Usage Instructions:*\n` +
      `▸ *${prefix}anticall on/off* - Toggle anti-call\n` +
      `▸ *${prefix}anticall message <text>* - Set rejection message\n` +
      `▸ *${prefix}anticall action reject/block* - Set call action\n\n` +
      `*💡 Action Differences:*\n` +
      `✔️ Reject: Declines call but allows future calls\n` +
      `🚫 Block: Declines and blocks the caller`
    );
  }

  switch (subcommand) {
    case 'on':
    case 'off': {
      const newStatus = subcommand === 'on';
      if (settings.status === newStatus) {
        return reply(`⚠️ Anti-call is already ${newStatus ? 'enabled' : 'disabled'}.`);
      }
      if (isSubBot && updateSubBotSettings) {
        await updateSubBotSettings({ anticallStatus: newStatus });
      } else {
        await updateAntiCallSettings({ status: newStatus });
      }
      return reply(`✅ Anti-call has been ${newStatus ? 'enabled' : 'disabled'}.` + subBotNote);
    }

    case 'message': {
      if (!value) return reply('❌ Please provide a message for anti-call rejection.');
      if (isSubBot && updateSubBotSettings) {
        await updateSubBotSettings({ anticallMessage: value });
      } else {
        await updateAntiCallSettings({ message: value });
      }
      return reply(`✅ Anti-call message updated successfully:\n\n"${value}"` + subBotNote);
    }

    case 'action': {
      const action = value.toLowerCase();
      if (!['reject', 'block'].includes(action)) {
        return reply(
          '❌ Invalid action. Use "reject" or "block".\n\n' +
          '*Reject:* Declines call but allows future calls\n' +
          '*Block:* Declines and permanently blocks the caller'
        );
      }
      if (settings.action === action) {
        return reply(`⚠️ Action is already set to "${action}".`);
      }
      if (isSubBot && updateSubBotSettings) {
        await updateSubBotSettings({ anticallAction: action });
      } else {
        await updateAntiCallSettings({ action });
      }
      return reply(
        `🔹 Call action changed to: *${action}*\n\n` +
        (action === 'block'
          ? '🚫 Now blocking callers who try to call.'
          : '✔️ Calls will now be rejected without blocking.') + subBotNote
      );
    }

    default:
      return reply(
        '❌ Invalid subcommand. Available options:\n\n' +
        `▸ *${prefix}anticall on/off*\n` +
        `▸ *${prefix}anticall message <text>*\n` +
        `▸ *${prefix}anticall action reject/block*`
      );
  }
});
//========================================================================================================================
//const { bwmxmd } = require('../core/commandHandler');

bwmxmd({
  pattern: "events",
  aliases: ["gevents", "groupevents"],
  category: "Settings",
  description: "Manage group welcome/leave events"
},
async (from, client, conText) => {
  const { reply, q, isSuperUser, isSubBot, updateSubBotSettings, botSettings } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");

  const args = q?.trim().split(/\s+/) || [];
  const action = args[0]?.toLowerCase();
  const value = args.slice(1).join(" ");

  // Get settings based on whether this is a sub-bot or main bot
  let settings;
  if (isSubBot && botSettings) {
    settings = {
      enabled: botSettings.groupEventsEnabled || false,
      welcomeMessage: botSettings.welcomeMessage || '👋 Welcome @user to {group}!\n\nYou are member number {count}.\n\n📝 Description: {desc}',
      goodbyeMessage: botSettings.goodbyeMessage || '👋 Goodbye @user!\n\nWe now have {count} members.',
      showPromotions: botSettings.showPromotions !== false
    };
  } else {
    settings = await getGroupEventsSettings();
  }
  
  const subBotNote = isSubBot ? '\n_(Only affects this sub-bot)_' : '';

  if (!action) {
    return reply(
      `*🎉 Group Events Settings*\n\n` +
      `🔹 *Status:* ${settings.enabled ? '✅ ON' : '❌ OFF'}\n` +
      `🔹 *Promotions:* ${settings.showPromotions ? '✅ ON' : '❌ OFF'}\n` +
      (isSubBot ? `🔹 *Sub-Bot:* Yes\n` : '') + `\n` +
      `*Welcome Message:*\n${settings.welcomeMessage}\n\n` +
      `*Goodbye Message:*\n${settings.goodbyeMessage}\n\n` +
      `*🛠 Usage:*\n` +
      `▸ events on/off\n` +
      `▸ events promote on/off\n` +
      `▸ events welcome <message>\n` +
      `▸ events goodbye <message>\n\n` +
      `*Placeholders:*\n` +
      `@user - Mention new member\n` +
      `{group} - Group name\n` +
      `{count} - Member count\n` +
      `{time} - Join time\n` +
      `{desc} - Group description`
    );
  }

  switch (action) {
    case 'on':
      if (isSubBot && updateSubBotSettings) {
        await updateSubBotSettings({ groupEventsEnabled: true });
      } else {
        await updateGroupEventsSettings({ enabled: true });
      }
      return reply("✅ Group events enabled." + subBotNote);

    case 'off':
      if (isSubBot && updateSubBotSettings) {
        await updateSubBotSettings({ groupEventsEnabled: false });
      } else {
        await updateGroupEventsSettings({ enabled: false });
      }
      return reply("✅ Group events disabled." + subBotNote);

    case 'promote':
      if (!['on', 'off'].includes(value)) return reply("❌ Use 'on' or 'off'.");
      if (isSubBot && updateSubBotSettings) {
        await updateSubBotSettings({ showPromotions: value === 'on' });
      } else {
        await updateGroupEventsSettings({ showPromotions: value === 'on' });
      }
      return reply(`✅ Promotion notices ${value === 'on' ? 'enabled' : 'disabled'}.` + subBotNote);

    case 'welcome':
      if (!value) return reply("❌ Provide a welcome message.");
      if (isSubBot && updateSubBotSettings) {
        await updateSubBotSettings({ welcomeMessage: value });
      } else {
        await updateGroupEventsSettings({ welcomeMessage: value });
      }
      return reply("✅ Welcome message updated." + subBotNote);

    case 'goodbye':
      if (!value) return reply("❌ Provide a goodbye message.");
      if (isSubBot && updateSubBotSettings) {
        await updateSubBotSettings({ goodbyeMessage: value });
      } else {
        await updateGroupEventsSettings({ goodbyeMessage: value });
      }
      return reply("✅ Goodbye message updated." + subBotNote);

    default:
      return reply(
        "❌ Invalid subcommand. Options:\n\n" +
        `▸ events on/off\n` +
        `▸ events promote on/off\n` +
        `▸ events welcome <message>\n` +
        `▸ events goodbye <message>`
      );
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "settings",
  aliases: ["config", "botconfig", "allsetting"],
  category: "Settings",
  description: "View all bot settings"
},
async (from, client, conText) => {
  const { reply, q, isSuperUser, prefix } = conText;

  if (!isSuperUser) return reply("*Owner only command*");

  try {
    const [botSettings, statusSettings, readSettings, presenceSettings] = await Promise.all([
      getSettings(),
      getAutoStatusSettings(),
      getAutoReadSettings(),
      getPresenceSettings()
    ]);
    
    let antideleteSettings = { status: false };
    let anticallSettings = { status: false, action: 'reject' };
    let autobioSettings = { enabled: false };
    let chatbotSettings = { enabled: false };
    let antilinkSettings = { enabled: false };
    let antistatusMention = { enabled: false };
    let groupEvents = { enabled: false };
    let greetSettings = { enabled: false };
    
    try { antideleteSettings = await getAntiDeleteSettings(); } catch (e) {}
    try { anticallSettings = await getAntiCallSettings(); } catch (e) {}
    try { autobioSettings = await getAutoBioSettings(); } catch (e) {}
    try { chatbotSettings = await getChatbotSettings(); } catch (e) {}
    try { antilinkSettings = await getAntiLinkSettings(); } catch (e) {}
    try { antistatusMention = await getAntiStatusMentionSettings(); } catch (e) {}
    try { groupEvents = await getGroupEventsSettings(); } catch (e) {}
    try { greetSettings = await getGreetSettings(); } catch (e) {}
    
    const on = 'ON';
    const off = 'OFF';
    
    let msg = `*ISCE-BOT SETTINGS*\n\n`;
    
    msg += `*BOT*\n`;
    msg += `> Prefix: ${botSettings.prefix}\n`;
    msg += `> Name: ${botSettings.botname}\n`;
    msg += `> Mode: ${botSettings.mode}\n`;
    msg += `> Device: ${botSettings.deviceMode}\n`;
    msg += `> Pack: ${botSettings.packname}\n`;
    msg += `> Author: ${botSettings.author}\n`;
    msg += `> Timezone: ${botSettings.timezone}\n`;
    msg += `> URL: ${botSettings.url || 'Not set'}\n`;
    msg += `> GitHub: ${botSettings.gurl || 'Not set'}\n\n`;
    
    msg += `*STATUS*\n`;
    msg += `> Auto View: ${statusSettings.autoviewStatus === 'true' ? on : off}\n`;
    msg += `> Auto Like: ${statusSettings.autoLikeStatus === 'true' ? on : off}\n`;
    msg += `> Auto Reply: ${statusSettings.autoReplyStatus === 'true' ? on : off}\n`;
    msg += `> Like Emojis: ${statusSettings.statusLikeEmojis}\n`;
    msg += `> Reply Text: ${(statusSettings.statusReplyText || '').slice(0, 30)}\n\n`;
    
    msg += `*AUTO*\n`;
    msg += `> Auto Read: ${readSettings.status ? on : off}\n`;
    msg += `> Auto Bio: ${autobioSettings.enabled ? on : off}\n`;
    msg += `> Bio Text: ${(autobioSettings.text || '').slice(0, 30) || 'Not set'}\n`;
    msg += `> Chatbot: ${chatbotSettings.enabled ? on : off}\n\n`;
    
    msg += `*PRESENCE*\n`;
    msg += `> DM: ${presenceSettings.privateChat}\n`;
    msg += `> Group: ${presenceSettings.groupChat}\n\n`;
    
    msg += `*ANTI DELETE*\n`;
    msg += `> Status: ${antideleteSettings.status ? on : off}\n`;
    msg += `> Send to Owner: ${antideleteSettings.sendToOwner ? on : off}\n`;
    msg += `> Include Media: ${antideleteSettings.includeMedia ? on : off}\n`;
    msg += `> Group Info: ${antideleteSettings.includeGroupInfo ? on : off}\n\n`;
    
    msg += `*ANTI CALL*\n`;
    msg += `> Status: ${anticallSettings.status ? on : off}\n`;
    msg += `> Action: ${anticallSettings.action || 'reject'}\n`;
    msg += `> Message: ${(anticallSettings.message || '').slice(0, 25) || 'Default'}\n\n`;
    
    msg += `*ANTI LINK*\n`;
    msg += `> Status: ${antilinkSettings.enabled ? on : off}\n`;
    msg += `> Action: ${antilinkSettings.action || 'warn'}\n`;
    msg += `> Warn Limit: ${antilinkSettings.warnLimit || 3}\n\n`;
    
    msg += `*ANTI TAG*\n`;
    msg += `> Status: ${antistatusMention.status !== 'off' ? antistatusMention.status.toUpperCase() : off}\n\n`;
    
    msg += `*GROUP*\n`;
    msg += `> Welcome/Bye: ${groupEvents.enabled ? on : off}\n`;
    msg += `> Greet: ${greetSettings.enabled ? on : off}\n\n`;
    
    msg += `*COMMANDS*\n`;
    msg += `${prefix}autoview on/off\n`;
    msg += `${prefix}antidelete on/off\n`;
    msg += `${prefix}anticall on/off\n`;
    msg += `${prefix}antilink on/off\n`;
    msg += `${prefix}events on/off`;
    
    return reply(msg);
  } catch (err) {
    console.error("Settings error:", err);
    return reply("*Failed to load settings*");
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "syncsettings",
  aliases: ["syncenv", "resetsettings", "syncheroku"],
  category: "Settings",
  description: "Reset all settings to Heroku environment variable values"
},
async (from, client, conText) => {
  const { reply, q, isSuperUser, prefix, isSubBot } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");
  
  if (isSubBot) {
    return reply("❌ This command is only for the main bot. Sub-bots use their own database settings.");
  }

  const args = q?.trim().toLowerCase();
  
  if (!args) {
    return reply(
      `*🔄 Sync Settings from Heroku*\n\n` +
      `This command resets your bot settings to match your Heroku environment variables.\n\n` +
      `*⚠️ Warning:* This will override any changes you made via bot commands!\n\n` +
      `*🛠 Usage:*\n` +
      `▸ ${prefix}syncsettings all - Reset ALL settings\n` +
      `▸ ${prefix}syncsettings anticall - Reset anti-call only\n` +
      `▸ ${prefix}syncsettings antidelete - Reset anti-delete only\n` +
      `▸ ${prefix}syncsettings antilink - Reset anti-link only\n` +
      `▸ ${prefix}syncsettings autostatus - Reset auto-status only\n` +
      `▸ ${prefix}syncsettings autoread - Reset auto-read only\n` +
      `▸ ${prefix}syncsettings autobio - Reset auto-bio only\n` +
      `▸ ${prefix}syncsettings presence - Reset presence only\n` +
      `▸ ${prefix}syncsettings chatbot - Reset chatbot only\n` +
      `▸ ${prefix}syncsettings bot - Reset bot config only\n\n` +
      `*💡 Tip:* Use this after changing Heroku vars to apply them!`
    );
  }

  try {
    let synced = [];
    
    if (args === 'all' || args === 'anticall') {
      await syncAntiCallFromEnv();
      synced.push('Anti-Call');
    }
    if (args === 'all' || args === 'antidelete') {
      await syncAntiDeleteFromEnv();
      synced.push('Anti-Delete');
    }
    if (args === 'all' || args === 'antilink') {
      await syncAntiLinkFromEnv();
      synced.push('Anti-Link');
    }
    if (args === 'all' || args === 'autostatus') {
      await syncAutoStatusFromEnv();
      synced.push('Auto-Status');
    }
    if (args === 'all' || args === 'autoread') {
      await syncAutoReadFromEnv();
      synced.push('Auto-Read');
    }
    if (args === 'all' || args === 'autobio') {
      await syncAutoBioFromEnv();
      synced.push('Auto-Bio');
    }
    if (args === 'all' || args === 'presence') {
      await syncPresenceFromEnv();
      synced.push('Presence');
    }
    if (args === 'all' || args === 'antistatusmention' || args === 'antitag') {
      await syncAntiStatusMentionFromEnv();
      synced.push('Anti-Status-Mention');
    }
    if (args === 'all' || args === 'chatbot') {
      await syncChatbotFromEnv();
      synced.push('Chatbot');
    }
    if (args === 'all' || args === 'bot' || args === 'config') {
      await syncSettingsFromEnv();
      synced.push('Bot Config');
    }
    
    if (synced.length === 0) {
      return reply(
        `❌ Unknown setting: "${args}"\n\n` +
        `Available: all, anticall, antidelete, antilink, autostatus, autoread, autobio, presence, antitag, chatbot, bot`
      );
    }
    
    return reply(
      `✅ *Settings Synced from Heroku!*\n\n` +
      `🔄 Updated: ${synced.join(', ')}\n\n` +
      `Your bot now uses the values from your Heroku environment variables.`
    );
  } catch (error) {
    console.error('Sync settings error:', error);
    return reply(`❌ Error syncing settings: ${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "devicemode",
  aliases: ["iphonemode", "iphone", "android", "device"],
  category: "Settings",
  description: "Set device mode - iPhone (plain text) or Android (full features)"
},
async (from, client, conText) => {
  const { reply, q, isSuperUser, botSettings, prefix } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");

  const currentMode = botSettings?.deviceMode || "Android";
  const args = q?.trim().toLowerCase();

  if (!args) {
    return reply(
      `📱 *Device Mode*\n\n` +
      `Current: ${currentMode === 'iPhone' ? '🍎 iPhone' : '🤖 Android'}\n\n` +
      `*🍎 iPhone Mode:*\n` +
      `• Plain text only (no buttons)\n` +
      `• No carousels or contextInfo\n` +
      `• ViewOnce media re-sent as normal\n` +
      `• Works for all iPhone users\n\n` +
      `*🤖 Android Mode:*\n` +
      `• Full features (buttons, carousels)\n` +
      `• Context info and thumbnails\n` +
      `• Quoted messages styled\n\n` +
      `*Usage:*\n` +
      `▸ ${prefix}devicemode iphone\n` +
      `▸ ${prefix}devicemode android`
    );
  }

  try {
    if (args === 'iphone' || args === 'ios' || args === 'apple') {
      await updateSettings({ deviceMode: 'iPhone' });
      conText.botSettings.deviceMode = 'iPhone';
      return reply(
        `🍎 *Device Mode: iPhone*\n\n` +
        `Bot will now send iPhone-compatible messages:\n` +
        `• Plain text only\n` +
        `• No buttons or carousels\n` +
        `• ViewOnce sent as normal media\n\n` +
        `_All iPhone users can now see everything!_`
      );
    } else if (args === 'android' || args === 'full' || args === 'normal') {
      await updateSettings({ deviceMode: 'Android' });
      conText.botSettings.deviceMode = 'Android';
      return reply(
        `🤖 *Device Mode: Android*\n\n` +
        `Bot will use full features:\n` +
        `• Buttons and carousels\n` +
        `• Context info and thumbnails\n` +
        `• Quoted messages\n\n` +
        `_Android users will see all features!_`
      );
    } else {
      return reply(`❌ Invalid option.\n\nUse:\n▸ ${prefix}devicemode iphone\n▸ ${prefix}devicemode android`);
    }
  } catch (error) {
    console.error('Device mode error:', error);
    return reply(`❌ Error: ${error.message}`);
  }
});
//========================================================================================================================
bwmxmd({
  pattern: "botname",
  aliases: ["setbotname"],
  category: "Settings",
  description: "Change bot display name"
},
async (from, client, conText) => {
  const { reply, q, isSuperUser, isSubBot, updateSubBotSettings, botSettings } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");

  const newName = q?.trim();

  if (!newName) {
    const settings = isSubBot ? botSettings : await getSettings();
    return reply(
      `🤖 Bot Name\n\n` +
      `🔹 Current Name: ${settings.botname}\n` +
      (isSubBot ? `🔹 Sub-Bot: Yes (changes only affect this bot)\n\n` : '\n') +
      `Usage: ${settings.prefix}botname <new_name>`
    );
  }

  if (newName.length > 50) {
    return reply("❌ Bot name must be less than 50 characters!");
  }

  try {
    if (isSubBot && updateSubBotSettings) {
      await updateSubBotSettings({ botname: newName });
    } else {
      await updateSettings({ botname: newName });
    }
    conText.botSettings.botname = newName;
    return reply(`✅ Bot name changed to: ${newName}` + (isSubBot ? '\n_(Only affects this sub-bot)_' : ''));
  } catch (error) {
    return reply("❌ Failed to update bot name!");
  }
});
//========================================================================================================================

bwmxmd({
  pattern: "author",
  aliases: ["setauthor"],
  category: "Settings",
  description: "Change bot author name"
},
async (from, client, conText) => {
  const { reply, q, isSuperUser, isSubBot, updateSubBotSettings, botSettings } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");

  const newAuthor = q?.trim();

  if (!newAuthor) {
    const settings = isSubBot ? botSettings : await getSettings();
    return reply(
      `👤 Bot Author\n\n` +
      `🔹 Current Author: ${settings.author}\n` +
      (isSubBot ? `🔹 Sub-Bot: Yes (changes only affect this bot)\n\n` : '\n') +
      `Usage: ${settings.prefix}author <new_author>`
    );
  }

  if (newAuthor.length > 30) {
    return reply("❌ Author name must be less than 30 characters!");
  }

  try {
    if (isSubBot && updateSubBotSettings) {
      await updateSubBotSettings({ author: newAuthor });
    } else {
      await updateSettings({ author: newAuthor });
    }
    conText.botSettings.author = newAuthor;
    return reply(`✅ Author changed to: ${newAuthor}` + (isSubBot ? '\n_(Only affects this sub-bot)_' : ''));
  } catch (error) {
    return reply("❌ Failed to update author!");
  }
});
//========================================================================================================================

bwmxmd({
  pattern: "packname",
  aliases: ["setpackname"],
  category: "Settings",
  description: "Change sticker pack name"
},
async (from, client, conText) => {
  const { reply, q, isSuperUser, isSubBot, updateSubBotSettings, botSettings } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");

  const newPackname = q?.trim();

  if (!newPackname) {
    const settings = isSubBot ? botSettings : await getSettings();
    return reply(
      `🖼️ Sticker Pack Name\n\n` +
      `🔹 Current Packname: ${settings.packname}\n` +
      (isSubBot ? `🔹 Sub-Bot: Yes (changes only affect this bot)\n\n` : '\n') +
      `Usage: ${settings.prefix}packname <new_packname>`
    );
  }

  if (newPackname.length > 30) {
    return reply("❌ Packname must be less than 30 characters!");
  }

  try {
    if (isSubBot && updateSubBotSettings) {
      await updateSubBotSettings({ packname: newPackname });
    } else {
      await updateSettings({ packname: newPackname });
    }
    conText.botSettings.packname = newPackname;
    return reply(`✅ Packname changed to: ${newPackname}` + (isSubBot ? '\n_(Only affects this sub-bot)_' : ''));
  } catch (error) {
    return reply("❌ Failed to update packname!");
  }
});
//========================================================================================================================

bwmxmd({
  pattern: "timezone",
  aliases: ["settimezone"],
  category: "Settings",
  description: "Change bot timezone"
},
async (from, client, conText) => {
  const { reply, q, isSuperUser, isSubBot, updateSubBotSettings, botSettings } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");

  const newTimezone = q?.trim();

  if (!newTimezone) {
    let settings;
    if (isSubBot && botSettings) {
      settings = { timezone: botSettings.timezone || 'Africa/Nairobi', prefix: botSettings.prefix || '.' };
    } else {
      settings = await getSettings();
    }
    return reply(
      `🌍 Bot Timezone\n\n` +
      `🔹 Current Timezone: ${settings.timezone}\n` +
      (isSubBot ? `🔹 *Sub-Bot:* Yes (changes only affect this bot)\n` : '') +
      `\nUsage: ${settings.prefix}timezone <new_timezone>\n\n` +
      `Example: ${settings.prefix}timezone Africa/Nairobi`
    );
  }

  // Basic timezone validation
  try {
    new Date().toLocaleString("en-US", { timeZone: newTimezone });
  } catch (error) {
    return reply("❌ Invalid timezone! Please use a valid IANA timezone.");
  }

  const subBotNote = isSubBot ? '\n_(Only affects this sub-bot)_' : '';
  try {
    if (isSubBot && updateSubBotSettings) {
      await updateSubBotSettings({ timezone: newTimezone });
    } else {
      await updateSettings({ timezone: newTimezone });
    }
    conText.botSettings.timezone = newTimezone;
    return reply(`✅ Timezone changed to: ${newTimezone}` + subBotNote);
  } catch (error) {
    return reply("❌ Failed to update timezone!");
  }
});
//========================================================================================================================

bwmxmd({
  pattern: "botpic",
  aliases: ["boturl", "botprofile"],
  category: "Settings",
  description: "Change bot profile picture URL"
},
async (from, client, conText) => {
  const { reply, q, isSuperUser, isSubBot, updateSubBotSettings, botSettings } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");

  const newUrl = q?.trim();

  if (!newUrl) {
    let settings;
    if (isSubBot && botSettings) {
      settings = { url: botSettings.url || 'Not Set', prefix: botSettings.prefix || '.' };
    } else {
      settings = await getSettings();
    }
    return reply(
      `🖼️ Bot Picture URL\n\n` +
      `🔹 Current URL: ${settings.url || 'Not Set'}\n` +
      (isSubBot ? `🔹 *Sub-Bot:* Yes (changes only affect this bot)\n` : '') +
      `\nUsage: ${settings.prefix}url <image_url>`
    );
  }

  // Basic URL validation
  if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
    return reply("❌ Invalid URL! Must start with http:// or https://");
  }

  const subBotNote = isSubBot ? '\n_(Only affects this sub-bot)_' : '';
  try {
    if (isSubBot && updateSubBotSettings) {
      await updateSubBotSettings({ url: newUrl });
    } else {
      await updateSettings({ url: newUrl });
    }
    conText.botSettings.url = newUrl;
    return reply(`✅ Profile picture URL updated!` + subBotNote);
  } catch (error) {
    return reply("❌ Failed to update URL!");
  }
});
//========================================================================================================================

bwmxmd({
  pattern: "boturl",
  aliases: ["setboturl", "seturl"],
  category: "Settings",
  description: "Change bot GitHub/repo URL"
},
async (from, client, conText) => {
  const { reply, q, isSuperUser, isSubBot, updateSubBotSettings, botSettings } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");

  const newGurl = q?.trim();

  if (!newGurl) {
    let settings;
    if (isSubBot && botSettings) {
      settings = { gurl: botSettings.gurl || 'Not Set', prefix: botSettings.prefix || '.' };
    } else {
      settings = await getSettings();
    }
    return reply(
      `🔗 Bot URL\n\n` +
      `🔹 Current URL: ${settings.gurl || 'Not Set'}\n` +
      (isSubBot ? `🔹 *Sub-Bot:* Yes (changes only affect this bot)\n` : '') +
      `\nUsage: ${settings.prefix}gurl <github_repo_url>`
    );
  }

  // Basic URL validation
  if (!newGurl.startsWith('http://') && !newGurl.startsWith('https://')) {
    return reply("❌ Invalid URL! Must start with http:// or https://");
  }

  const subBotNote = isSubBot ? '\n_(Only affects this sub-bot)_' : '';
  try {
    if (isSubBot && updateSubBotSettings) {
      await updateSubBotSettings({ gurl: newGurl });
    } else {
      await updateSettings({ gurl: newGurl });
    }
    conText.botSettings.gurl = newGurl;
    return reply(`✅ GitHub/Repo URL updated!` + subBotNote);
  } catch (error) {
    return reply("❌ Failed to update GitHub URL!");
  }
});
//========================================================================================================================
      
//========================================================================================================================
bwmxmd({
  pattern: "mode",
  aliases: ["setmode"],
  category: "Settings",
  description: "Change bot mode (public/private)"
},
async (from, client, conText) => {
  const { reply, q, isSuperUser, isSubBot, updateSubBotSettings, botSettings } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");

  const newMode = q?.trim().toLowerCase();

  if (!newMode) {
    const settings = isSubBot ? botSettings : await getSettings();
    return reply(
      `*🤖 Bot Mode*\n\n` +
      `🔹 *Current Mode:* ${settings.mode.toUpperCase()}\n` +
      (isSubBot ? `🔹 *Sub-Bot:* Yes (changes only affect this bot)\n\n` : '\n') +
      `*Available Modes:*\n` +
      `▸ public - Everyone can use commands\n` +
      `▸ private - Only owner/sudo can use commands\n\n` +
      `*Usage:* \`${settings.prefix}mode <public/private>\``
    );
  }

  if (!['public', 'private'].includes(newMode)) {
    return reply("❌ Invalid mode! Use: public or private");
  }

  try {
    if (isSubBot && updateSubBotSettings) {
      await updateSubBotSettings({ mode: newMode });
    } else {
      await updateSettings({ mode: newMode });
    }
    conText.botSettings.mode = newMode;
    return reply(`✅ Bot mode changed to: *${newMode.toUpperCase()}*` + (isSubBot ? '\n_(Only affects this sub-bot)_' : ''));
  } catch (error) {
    return reply("❌ Failed to update mode!");
  }
});
//========================================================================================================================

bwmxmd({
  pattern: "prefix",
  aliases: ["setprefix"],
  category: "Settings",
  description: "Change bot prefix"
},
async (from, client, conText) => {
  const { reply, q, isSuperUser, isSubBot, updateSubBotSettings, botSettings } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");

  const newPrefix = q?.trim();

  if (!newPrefix) {
    const settings = isSubBot ? botSettings : await getSettings();
    return reply(`*🔧 Current Prefix:* \`${settings.prefix}\`` + 
      (isSubBot ? `\n🔹 *Sub-Bot:* Yes (changes only affect this bot)` : '') +
      `\n\n*Usage:* \`${settings.prefix}prefix <new_prefix>\``);
  }

  if (newPrefix.length > 3) {
    return reply("❌ Prefix must be 1-3 characters long!");
  }

  try {
    if (isSubBot && updateSubBotSettings) {
      await updateSubBotSettings({ prefix: newPrefix });
    } else {
      await updateSettings({ prefix: newPrefix });
    }
    conText.botSettings.prefix = newPrefix;
    return reply(`✅ Prefix changed to: \`${newPrefix}\`` + (isSubBot ? '\n_(Only affects this sub-bot)_' : ''));
  } catch (error) {
    return reply("❌ Failed to update prefix!");
  }
});
//========================================================================================================================
//const { bwmxmd } = require('../core/commandHandler');

bwmxmd({
  pattern: "presence",
  aliases: ["setpresence", "mypresence"],
  category: "Settings",
  description: "Manage your presence settings"
},
async (from, client, conText) => {
  const { reply, q, isSuperUser, isSubBot, updateSubBotSettings, botSettings } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");

  const args = q?.trim().split(/\s+/) || [];
  const type = args[0]?.toLowerCase();
  const status = args[1]?.toLowerCase();

  let settings;
  if (isSubBot && botSettings) {
    settings = {
      privateChat: botSettings.presencePrivateChat || 'off',
      groupChat: botSettings.presenceGroupChat || 'off'
    };
  } else {
    settings = await getPresenceSettings();
  }

  if (!type) {
    const format = (s) => s === 'off' ? '❌ OFF' : `✅ ${s.toUpperCase()}`;
    return reply(
      `*🔄 Presence Settings*\n\n` +
      `🔹 *Private Chats:* ${format(settings.privateChat)}\n` +
      `🔹 *Group Chats:* ${format(settings.groupChat)}\n` +
      (isSubBot ? `🔹 *Sub-Bot:* Yes (changes only affect this bot)\n` : '') +
      `\n*🛠 Usage:*\n` +
      `▸ presence private [off/online/typing/recording]\n` +
      `▸ presence group [off/online/typing/recording]`
    );
  }

  if (!['private', 'group'].includes(type)) {
    return reply(
      "❌ Invalid type. Use:\n\n" +
      `▸ presence private [status]\n` +
      `▸ presence group [status]`
    );
  }

  if (!['off', 'online', 'typing', 'recording'].includes(status)) {
    return reply(
      "❌ Invalid status. Options:\n\n" +
      `▸ off - No presence\n` +
      `▸ online - Show as online\n` +
      `▸ typing - Show typing indicator\n` +
      `▸ recording - Show recording indicator`
    );
  }

  const subBotNote = isSubBot ? '\n_(Only affects this sub-bot)_' : '';
  if (isSubBot && updateSubBotSettings) {
    const updateKey = type === 'private' ? 'presencePrivateChat' : 'presenceGroupChat';
    await updateSubBotSettings({ [updateKey]: status });
  } else {
    await updatePresenceSettings({ [type === 'private' ? 'privateChat' : 'groupChat']: status });
  }
  reply(`✅ ${type === 'private' ? 'Private chat' : 'Group chat'} presence set to *${status}*` + subBotNote);
});
//========================================================================================================================
//const { bwmxmd } = require('../core/commandHandler');

bwmxmd({
  pattern: "greet",
  aliases: ["autoreply"],
  category: "Settings",
  description: "Manage private chat greeting settings"
},
async (from, client, conText) => {
  const { reply, q, isSuperUser, isSubBot, updateSubBotSettings, botSettings } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");

  const args = q?.trim().split(/\s+/) || [];
  const action = args[0]?.toLowerCase();
  const message = args.slice(1).join(" ");

  let settings;
  if (isSubBot && botSettings) {
    settings = {
      enabled: botSettings.greetEnabled || false,
      message: botSettings.greetMessage || 'Hello @user! Thanks for messaging.'
    };
  } else {
    settings = await getGreetSettings();
  }

  if (!action) {
    return reply(
      `*👋 Greeting Settings*\n\n` +
      `🔹 *Status:* ${settings.enabled ? '✅ ON' : '❌ OFF'}\n` +
      `🔹 *Message:* ${settings.message}\n` +
      (isSubBot ? `🔹 *Sub-Bot:* Yes (changes only affect this bot)\n` : '') +
      `\n*🛠 Usage:*\n` +
      `▸ greet on/off\n` +
      `▸ greet set <message>\n` +
      `▸ greet clear`
    );
  }

  const subBotNote = isSubBot ? '\n_(Only affects this sub-bot)_' : '';

  switch (action) {
    case 'on':
      if (isSubBot && updateSubBotSettings) {
        await updateSubBotSettings({ greetEnabled: true });
      } else {
        await updateGreetSettings({ enabled: true });
      }
      return reply("✅ Private chat greetings enabled." + subBotNote);

    case 'off':
      if (isSubBot && updateSubBotSettings) {
        await updateSubBotSettings({ greetEnabled: false });
      } else {
        await updateGreetSettings({ enabled: false });
      }
      return reply("✅ Private chat greetings disabled." + subBotNote);

    case 'set':
      if (!message) return reply("❌ Provide a greeting message.");
      if (isSubBot && updateSubBotSettings) {
        await updateSubBotSettings({ greetMessage: message });
      } else {
        await updateGreetSettings({ message });
      }
      return reply(`✅ Greet message updated:\n"${message}"` + subBotNote);

    case 'clear':
      clearRepliedContacts();
      return reply("✅ Replied contacts memory cleared.");

    default:
      return reply(
        "❌ Invalid subcommand. Options:\n\n" +
        `▸ greet on/off\n` +
        `▸ greet set <message>\n` +
        `▸ greet clear`
      );
  }
});
//========================================================================================================================
//const { bwmxmd } = require('../core/commandHandler');

// Helper functions for media download
async function downloadMedia(mediaUrl) {
    try {
        const response = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    } catch (error) {
        console.error('Error downloading media:', error);
        return null;
    }
}

bwmxmd({
  pattern: "chatbot",
  aliases: ["chatai"],
  category: "Settings",
  description: "Manage chatbot settings"
},
async (from, client, conText) => {
  const { reply, q, isSuperUser } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");

  const args = q?.trim().split(/\s+/) || [];
  const subcommand = args[0]?.toLowerCase();
  const value = args.slice(1).join(" ");

  const settings = await getChatbotSettings();

  if (!subcommand) {
    const statusMap = {
      'on': '✅ ON',
      'off': '❌ OFF'
    };

    const modeMap = {
      'private': '🔒 Private Only',
      'group': '👥 Group Only', 
      'both': '🌐 Both'
    };

    const triggerMap = {
      'dm': '📨 DM Trigger',
      'all': '🔊 All Messages'
    };

    const responseMap = {
      'text': '📝 Text',
      'audio': '🎵 Audio'
    };

    return reply(
      `*🤖 Chatbot Settings*\n\n` +
      `🔹 *Status:* ${statusMap[settings.status]}\n` +
      `🔹 *Mode:* ${modeMap[settings.mode]}\n` +
      `🔹 *Trigger:* ${triggerMap[settings.trigger]}\n` +
      `🔹 *Default Response:* ${responseMap[settings.default_response]}\n` +
      `🔹 *Voice:* ${settings.voice}\n\n` +
      `*🎯 Response Types:*\n` +
      `▸ *Text* - Normal AI conversation\n` +
      `▸ *Audio* - Add "audio" to get voice response\n` +
      `▸ *Video* - Add "video" to generate videos\n` +
      `▸ *Image* - Add "image" to generate images\n` +
      `▸ *Vision* - Send image + "analyze this"\n\n` +
      `*Usage Examples:*\n` +
      `▸ @bot hello how are you? (Text)\n` +
      `▸ @bot audio tell me a story (Audio response)\n` +
      `▸ @bot video a cat running (Video generation)\n` +
      `▸ @bot image a beautiful sunset (Image generation)\n` +
      `▸ [Send image] "analyze this" (Vision analysis)\n\n` +
      `*Commands:*\n` +
      `▸ chatbot on/off\n` +
      `▸ chatbot mode private/group/both\n` +
      `▸ chatbot trigger dm/all\n` +
      `▸ chatbot response text/audio\n` +
      `▸ chatbot voice <name>\n` +
      `▸ chatbot voices\n` +
      `▸ chatbot clear\n` +
      `▸ chatbot status\n` +
      `▸ chatbot test <type> <message>`
    );
  }

  switch (subcommand) {
    case 'on':
    case 'off':
      await updateChatbotSettings({ status: subcommand });
      return reply(`✅ Chatbot: *${subcommand.toUpperCase()}*`);

    case 'mode':
      if (!['private', 'group', 'both'].includes(value)) {
        return reply("❌ Invalid mode! Use: private, group, or both");
      }
      await updateChatbotSettings({ mode: value });
      return reply(`✅ Chatbot mode: *${value.toUpperCase()}*`);

    case 'trigger':
      if (!['dm', 'all'].includes(value)) {
        return reply("❌ Invalid trigger! Use: dm or all");
      }
      await updateChatbotSettings({ trigger: value });
      return reply(`✅ Chatbot trigger: *${value.toUpperCase()}*`);

    case 'response':
      if (!['text', 'audio'].includes(value)) {
        return reply("❌ Invalid response type! Use: text or audio");
      }
      await updateChatbotSettings({ default_response: value });
      return reply(`✅ Default response: *${value.toUpperCase()}*`);

    case 'voice':
      if (!availableVoices.includes(value)) {
        return reply(`❌ Invalid voice! Available voices:\n${availableVoices.join(', ')}`);
      }
      await updateChatbotSettings({ voice: value });
      return reply(`✅ Voice set to: *${value}*`);

    case 'voices':
      return reply(`*🎙️ Available Voices:*\n\n${availableVoices.join(', ')}`);

    case 'clear':
      const cleared = await clearConversationHistory(from);
      if (cleared) {
        return reply("✅ Chatbot conversation history cleared!");
      } else {
        return reply("❌ No conversation history to clear!");
      }

    case 'status':
      const history = await getConversationHistory(from, 5);
      if (history.length === 0) {
        return reply("📝 No recent conversations found.");
      }
      
      let historyText = `*📚 Recent Conversations (${history.length})*\n\n`;
      history.forEach((conv, index) => {
        const typeIcon = getTypeIcon(conv.type);
        historyText += `*${index + 1}. ${typeIcon} You:* ${conv.user}\n`;
        historyText += `   *AI:* ${conv.type === 'audio' ? '[Voice Message]' : conv.ai}\n\n`;
      });
      
      return reply(historyText);

    case 'test':
      const testArgs = value.split(' ');
      const testType = testArgs[0]?.toLowerCase();
      const testMessage = testArgs.slice(1).join(' ') || "Hello, this is a test message";
      
      try {
        await reply(`🧪 Testing ${testType || 'text'} with: "${testMessage}"`);
        
        if (testType === 'audio') {
          // Test audio: Get AI response first, then convert to audio
          const textResponse = await axios.get(XMD.API.AI.CHAT(testMessage));
          if (textResponse.data.status) {
            const audioResponse = await axios.get(XMD.API.AI.TEXT2SPEECH(textResponse.data.result, settings.voice));
            if (audioResponse.data.status && audioResponse.data.result.URL) {
              const audioBuffer = await downloadMedia(audioResponse.data.result.URL);
              if (audioBuffer) {
                await client.sendMessage(from, {
                  audio: audioBuffer,
                  ptt: true,
                  mimetype: 'audio/mpeg'
                });
              }
            }
          }
        } else if (testType === 'video') {
          const videoResponse = await axios.get(XMD.API.AI.TEXT2VIDEO(testMessage));
          if (videoResponse.data.success && videoResponse.data.results) {
            const videoBuffer = await downloadMedia(videoResponse.data.results);
            if (videoBuffer) {
              await client.sendMessage(from, {
                video: videoBuffer,
                caption: `🎥 Test video: ${testMessage}`
              });
            }
          }
        } else if (testType === 'image') {
          const imageBuffer = await downloadMedia(XMD.API.AI.FLUX(testMessage));
          if (imageBuffer) {
            await client.sendMessage(from, {
              image: imageBuffer,
              caption: `🖼️ Test image: ${testMessage}`
            });
          }
        } else {
          // Text test
          const textResponse = await axios.get(XMD.API.AI.CHAT(testMessage));
          if (textResponse.data.status) {
            await reply(`📝 Text Response: ${textResponse.data.result}`);
          }
        }
        
        return reply("✅ Test completed!");
      } catch (error) {
        return reply("❌ Test failed!");
      }

    default:
      return reply(
        "❌ Invalid command!\n\n" +
        `▸ chatbot on/off\n` +
        `▸ chatbot mode private/group/both\n` +
        `▸ chatbot trigger dm/all\n` +
        `▸ chatbot response text/audio\n` +
        `▸ chatbot voice <name>\n` +
        `▸ chatbot voices\n` +
        `▸ chatbot clear\n` +
        `▸ chatbot status\n` +
        `▸ chatbot test <text/audio/video/image> <message>`
      );
  }
});

function getTypeIcon(type) {
  const icons = {
    'text': '📝',
    'audio': '🎵',
    'video': '🎥',
    'image': '🖼️',
    'vision': '🔍'
  };
  return icons[type] || '📝';
}
//========================================================================================================================
//const { bwmxmd } = require('../core/commandHandler');

bwmxmd({
  pattern: "autoviewstatus",
  aliases: ["viewstatus"],
  category: "Settings",
  description: "Configure auto-view for incoming statuses"
},
async (from, client, conText) => {
  const { reply, q, isSuperUser, isSubBot, updateSubBotSettings, botSettings } = conText;
  if (!isSuperUser) return reply("❌ Owner Only Command!");

  const arg = q?.trim().toLowerCase();
  
  let settings;
  if (isSubBot && botSettings) {
    settings = {
      autoviewStatus: botSettings.autoviewStatus || 'false'
    };
  } else {
    settings = await getAutoStatusSettings();
  }

  if (!arg || arg === 'status') {
    return reply(
      `*👁️ Auto View Status*\n\n` +
      `🔹 *Enabled:* ${settings.autoviewStatus}\n` +
      (isSubBot ? `🔹 *Sub-Bot:* Yes (changes only affect this bot)\n` : '') +
      `\n*🛠 Usage:*\n` +
      `▸ autoviewstatus true/false\n` +
      `▸ autoviewstatus status`
    );
  }

  const subBotNote = isSubBot ? '\n_(Only affects this sub-bot)_' : '';
  if (['true', 'false'].includes(arg)) {
    if (isSubBot && updateSubBotSettings) {
      await updateSubBotSettings({ autoviewStatus: arg });
    } else {
      await updateAutoStatusSettings({ autoviewStatus: arg });
    }
    return reply(`✅ Auto-view status set to *${arg}*` + subBotNote);
  }

  reply("❌ Invalid input. Use `.autoviewstatus status` to view usage.");
});
//========================================================================================================================


//const { bwmxmd } = require('../core/commandHandler');

bwmxmd({
  pattern: "autoreplystatus",
  aliases: ["replystatus"],
  category: "Settings",
  description: "Configure auto-reply for viewed statuses"
},
async (from, client, conText) => {
  const { reply, q, isSuperUser, isSubBot, updateSubBotSettings, botSettings } = conText;
  if (!isSuperUser) return reply("❌ Owner Only Command!");

  const args = q?.trim().split(/\s+/) || [];
  const sub = args[0]?.toLowerCase();
  
  let settings;
  if (isSubBot && botSettings) {
    settings = {
      autoReplyStatus: botSettings.autoReplyStatus || 'false',
      statusReplyText: botSettings.statusReplyText || 'Nice status!'
    };
  } else {
    settings = await getAutoStatusSettings();
  }

  if (!sub || sub === 'status') {
    return reply(
      `*💬 Auto Reply Status*\n\n` +
      `🔹 *Enabled:* ${settings.autoReplyStatus}\n` +
      `🔹 *Reply Text:* ${settings.statusReplyText}\n` +
      (isSubBot ? `🔹 *Sub-Bot:* Yes (changes only affect this bot)\n` : '') +
      `\n*🛠 Usage:*\n` +
      `▸ autoreplystatus true/false\n` +
      `▸ autoreplystatus text [your message]\n` +
      `▸ autoreplystatus status`
    );
  }

  const subBotNote = isSubBot ? '\n_(Only affects this sub-bot)_' : '';

  if (sub === 'text') {
    const newText = args.slice(1).join(' ');
    if (!newText) return reply("❌ Provide reply text after 'text'");
    if (isSubBot && updateSubBotSettings) {
      await updateSubBotSettings({ statusReplyText: newText });
    } else {
      await updateAutoStatusSettings({ statusReplyText: newText });
    }
    return reply("✅ Auto-reply text updated." + subBotNote);
  }

  if (['true', 'false'].includes(sub)) {
    if (isSubBot && updateSubBotSettings) {
      await updateSubBotSettings({ autoReplyStatus: sub });
    } else {
      await updateAutoStatusSettings({ autoReplyStatus: sub });
    }
    return reply(`✅ Auto-reply status set to *${sub}*` + subBotNote);
  }

  reply("❌ Invalid input. Use `.autoreplystatus status` to view usage.");
});
//========================================================================================================================
//const { bwmxmd } = require('../core/commandHandler');

bwmxmd({
  pattern: "autoread",
  aliases: ["readmessages", "setread"],
  category: "Settings",
  description: "Manage auto-read settings"
},
async (from, client, conText) => {
  const { reply, q, isSuperUser } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");

  const args = q?.trim().split(/\s+/) || [];
  const subcommand = args[0]?.toLowerCase();
  const value = args.slice(1).join(" ");

  const settings = await getAutoReadSettings();

  if (!subcommand) {
    const status = settings.status ? '✅ ON' : '❌ OFF';
    const types = settings.chatTypes.length > 0 ? settings.chatTypes.join(', ') : '*No types set*';

    return reply(
      `*👓 Auto-Read Settings*\n\n` +
      `🔹 *Status:* ${status}\n` +
      `🔹 *Chat Types:* ${types}\n\n` +
      `*🛠 Usage:*\n` +
      `▸ autoread on/off\n` +
      `▸ autoread types <private/group/both>\n` +
      `▸ autoread addtype <type>\n` +
      `▸ autoread removetype <type>`
    );
  }

  switch (subcommand) {
    case 'on':
    case 'off': {
      const newStatus = subcommand === 'on';
      await updateAutoReadSettings({ status: newStatus });
      return reply(`✅ Auto-read has been ${newStatus ? 'enabled' : 'disabled'}.`);
    }

    case 'types': {
      if (!['private', 'group', 'both'].includes(value)) {
        return reply('❌ Use "private", "group", or "both".');
      }
      const types = value === 'both' ? ['private', 'group'] : [value];
      await updateAutoReadSettings({ chatTypes: types });
      return reply(`✅ Auto-read set for: ${types.join(', ')}`);
    }

    case 'addtype': {
      if (!['private', 'group'].includes(value)) {
        return reply('❌ Use "private" or "group".');
      }
      if (settings.chatTypes.includes(value)) {
        return reply(`⚠️ Type ${value} is already included.`);
      }
      const updated = [...settings.chatTypes, value];
      await updateAutoReadSettings({ chatTypes: updated });
      return reply(`✅ Added ${value} to auto-read types.`);
    }

    case 'removetype': {
      if (!['private', 'group'].includes(value)) {
        return reply('❌ Use "private" or "group".');
      }
      if (!settings.chatTypes.includes(value)) {
        return reply(`⚠️ Type ${value} is not currently included.`);
      }
      const updated = settings.chatTypes.filter(t => t !== value);
      await updateAutoReadSettings({ chatTypes: updated });
      return reply(`✅ Removed ${value} from auto-read types.`);
    }

    default:
      return reply(
        "❌ Invalid subcommand. Options:\n\n" +
        `▸ autoread on/off\n` +
        `▸ autoread types <private/group/both>\n` +
        `▸ autoread addtype <type>\n` +
        `▸ autoread removetype <type>`
      );
  }
});
//========================================================================================================================
//const { bwmxmd } = require('../core/commandHandler');

bwmxmd({
  pattern: "autolikestatus",
  aliases: ["likestatus"],
  category: "Settings",
  description: "Configure auto-like for viewed statuses"
},
async (from, client, conText) => {
  const { reply, q, isSuperUser, isSubBot, updateSubBotSettings, botSettings } = conText;
  if (!isSuperUser) return reply("❌ Owner Only Command!");

  const args = q?.trim().split(/\s+/) || [];
  const sub = args[0]?.toLowerCase();

  let settings;
  if (isSubBot && botSettings) {
    settings = {
      autoLikeStatus: botSettings.autoLikeStatus || 'false',
      statusLikeEmojis: botSettings.statusLikeEmojis || '💛,❤️,💜,🤍,💙'
    };
  } else {
    settings = await getAutoStatusSettings();
  }

  if (!sub || sub === 'status') {
    const currentEmojis = settings.statusLikeEmojis || '💛,❤️,💜,🤍,💙';
    return reply(
      `*💖 Auto Like Status*\n\n` +
      `🔹 *Enabled:* ${settings.autoLikeStatus}\n` +
      `🔹 *Emojis:* ${currentEmojis}\n` +
      (isSubBot ? `🔹 *Sub-Bot:* Yes (changes only affect this bot)\n` : '') +
      `\n*🛠 Usage:*\n` +
      `▸ autolikestatus true/false\n` +
      `▸ autolikestatus emojis 💚 💔 💥\n` +
      `▸ autolikestatus status`
    );
  }

  const subBotNote = isSubBot ? '\n_(Only affects this sub-bot)_' : '';

  if (sub === 'emojis') {
    const emojiList = args.slice(1).join(' ').trim();
    if (!emojiList) return reply("❌ Provide emojis after 'emojis'");
    
    // Clean and validate emojis - remove any commas and extra spaces
    const cleanedEmojis = emojiList
      .replace(/,/g, ' ') // Replace commas with spaces
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim()
      .split(' ') // Split by space to get individual emojis
      .filter(emoji => emoji.trim().length > 0) // Remove empty strings
      .join(','); // Join with commas for storage
    
    if (!cleanedEmojis) return reply("❌ No valid emojis provided");
    
    if (isSubBot && updateSubBotSettings) {
      await updateSubBotSettings({ statusLikeEmojis: cleanedEmojis });
    } else {
      await updateAutoStatusSettings({ statusLikeEmojis: cleanedEmojis });
    }
    return reply(`✅ Auto-like emojis updated to: ${cleanedEmojis.split(',').join(' ')}` + subBotNote);
  }

  if (['true', 'false'].includes(sub)) {
    if (isSubBot && updateSubBotSettings) {
      await updateSubBotSettings({ autoLikeStatus: sub });
    } else {
      await updateAutoStatusSettings({ autoLikeStatus: sub });
    }
    return reply(`✅ Auto-like status set to *${sub}*` + subBotNote);
  }

  reply("❌ Invalid input. Use `.autolikestatus status` to view usage.");
});
//========================================================================================================================
//const { bwmxmd } = require('../core/commandHandler');

bwmxmd({
  pattern: "autobio",
  aliases: ["bio", "setbio"],
  category: "Settings",
  description: "Manage auto-bio settings"
},
async (from, client, conText) => {
  const { reply, q, isSuperUser, botSettings } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");

  const args = q?.trim().split(/\s+/) || [];
  const subcommand = args[0]?.toLowerCase();
  const message = args.slice(1).join(" ");

  const settings = await getAutoBioSettings();

  if (!subcommand) {
    const status = settings.status === 'on' ? '✅ ON' : '❌ OFF';
    const currentBotName = botSettings.botname || 'ISCE-BOT';
    const currentTimezone = botSettings.timezone || 'Africa/Nairobi';

    return reply(
      `*📝 Auto-Bio Settings*\n\n` +
      `🔹 *Status:* ${status}\n` +
      `🔹 *Bot Name:* ${currentBotName}\n` +
      `🔹 *Timezone:* ${currentTimezone}\n` +
      `🔹 *Message:* ${settings.message}\n\n` +
      `*🛠 Usage:*\n` +
      `▸ autobio on/off\n` +
      `▸ autobio set <message>\n` +
      `▸ autobio reset\n\n` +
      `*💡 Note:* Uses bot name and timezone from settings`
    );
  }

  switch (subcommand) {
    case 'on':
    case 'off': {
      const newStatus = subcommand;
      if (settings.status === newStatus) {
        return reply(`⚠️ Auto-bio is already ${newStatus === 'on' ? 'enabled' : 'disabled'}.`);
      }
      await updateAutoBioSettings({ status: newStatus });
      
      // Restart auto-bio if enabled
      if (newStatus === 'on') {
        const { startAutoBio } = require('../index');
        startAutoBio();
      }
      
      return reply(`✅ Auto-bio has been ${newStatus === 'on' ? 'enabled' : 'disabled'}.`);
    }

    case 'set': {
      if (!message) return reply("❌ Provide a bio message.");
      if (message.length > 100) return reply("❌ Bio message too long (max 100 characters).");
      
      await updateAutoBioSettings({ message });
      return reply(`✅ Bio message updated to:\n"${message}"`);
    }

    case 'reset': {
      const defaultMessage = '🌟 Always active!';
      await updateAutoBioSettings({ message: defaultMessage });
      return reply(`✅ Bio message reset to default:\n"${defaultMessage}"`);
    }

    default:
      return reply(
        "❌ Invalid subcommand. Options:\n\n" +
        `▸ autobio on/off\n` +
        `▸ autobio set <message>\n` +
        `▸ autobio reset`
      );
  }
});
//========================================================================================================================
//const { bwmxmd } = require('../core/commandHandler');

bwmxmd({
  pattern: "antistatusmention",
  aliases: ["antistatus", "statusguard"],
  category: "Settings",
  description: "Manage anti-status-mention settings"
},
async (from, client, conText) => {
  const { reply, q, isSuperUser, isBotAdmin, isGroup } = conText;

  if (!isGroup) return reply("❌ Group command only!");
 // if (!isBotAdmin) return reply("❌ Need admin role!");
  if (!isSuperUser) return reply("❌ Admin only command!");

  const args = q?.trim().split(/\s+/) || [];
  const subcommand = args[0]?.toLowerCase();
  const value = args[1];

  const settings = await getAntiStatusMentionSettings();

  if (!subcommand) {
    const statusMap = {
      'off': '❌ OFF',
      'warn': '⚠️ WARN', 
      'delete': '🗑️ DELETE',
      'remove': '🚫 REMOVE'
    };

    return reply(
      `*🛡️ Anti-Status-Mention Settings*\n\n` +
      `🔹 *Status:* ${statusMap[settings.status]}\n` +
      `🔹 *Warn Limit:* ${settings.warn_limit}\n\n` +
      `*Blocks:* Status mention messages in groups\n\n` +
      `*Actions:*\n` +
      `▸ warn - Warn users (remove after ${settings.warn_limit} warnings)\n` +
      `▸ delete - Delete status mentions + warn\n` +
      `▸ remove - Delete status mentions + remove immediately\n\n` +
      `*Usage:*\n` +
      `▸ antistatusmention off/warn/delete/remove\n` +
      `▸ antistatusmention limit <1-10>\n` +
      `▸ antistatusmention resetwarns`
    );
  }

  switch (subcommand) {
    case 'off':
      await updateAntiStatusMentionSettings({ status: 'off' });
      return reply(`✅ Anti-status-mention: *OFF*`);
    case 'warn':
    case 'delete':
    case 'remove':
      await updateAntiStatusMentionSettings({ status: subcommand, action: subcommand });
      return reply(`✅ Anti-status-mention: *${subcommand.toUpperCase()}*`);

    case 'limit':
      const limit = parseInt(value);
      if (isNaN(limit) || limit < 1 || limit > 10) {
        return reply("❌ Limit must be 1-10");
      }
      await updateAntiStatusMentionSettings({ warn_limit: limit });
      return reply(`✅ Warn limit: *${limit}*`);

    case 'resetwarns':
      clearAllStatusWarns();
      return reply("✅ Status mention warning counts reset!");

    default:
      return reply(
        "❌ Invalid command!\n\n" +
        `▸ antistatusmention off/warn/delete/remove\n` +
        `▸ antistatusmention limit <1-10>\n` +
        `▸ antistatusmention resetwarns`
      );
  }
});
//========================================================================================================================
//const { bwmxmd } = require('../core/commandHandler');

bwmxmd({
  pattern: "antilink",
  aliases: ["linkguard"],
  category: "Settings",
  description: "Manage anti-link settings"
},
async (from, client, conText) => {
  const { reply, q, isSuperUser, isBotAdmin, isGroup, isSubBot, updateSubBotSettings, botSettings } = conText;

  if (!isGroup) return reply("❌ Group command only!");
  if (!isSuperUser) return reply("❌ Admin only command!");

  const args = q?.trim().split(/\s+/) || [];
  const subcommand = args[0]?.toLowerCase();
  const value = args[1];

  let settings;
  if (isSubBot && botSettings) {
    settings = {
      status: botSettings.antilinkStatus || 'off',
      action: botSettings.antilinkAction || 'delete',
      warn_limit: botSettings.antilinkWarnLimit || 3
    };
  } else {
    settings = await getAntiLinkSettings();
  }

  if (!subcommand) {
    const statusMap = {
      'off': '❌ OFF',
      'warn': '⚠️ WARN', 
      'delete': '🗑️ DELETE',
      'remove': '🚫 REMOVE'
    };

    return reply(
      `*🛡️ Anti-Link Settings*\n\n` +
      `🔹 *Status:* ${statusMap[settings.status]}\n` +
      `🔹 *Warn Limit:* ${settings.warn_limit}\n` +
      (isSubBot ? `🔹 *Sub-Bot:* Yes (changes only affect this bot)\n` : '') +
      `\n*Actions:*\n` +
      `▸ warn - Warn users (remove after ${settings.warn_limit} warnings)\n` +
      `▸ delete - Delete links + warn\n` +
      `▸ remove - Delete links + remove immediately\n\n` +
      `*Usage:*\n` +
      `▸ antilink off/warn/delete/remove\n` +
      `▸ antilink limit <1-10>\n` +
      `▸ antilink resetwarns`
    );
  }

  switch (subcommand) {
    case 'off':
      if (isSubBot && updateSubBotSettings) {
        await updateSubBotSettings({ antilinkStatus: 'off' });
      } else {
        await updateAntiLinkSettings({ status: 'off' });
      }
      return reply(`✅ Anti-link: *OFF*` + (isSubBot ? '\n_(Only affects this sub-bot)_' : ''));
    case 'warn':
    case 'delete':
    case 'remove':
      if (isSubBot && updateSubBotSettings) {
        await updateSubBotSettings({ antilinkStatus: subcommand, antilinkAction: subcommand });
      } else {
        await updateAntiLinkSettings({ status: subcommand, action: subcommand });
      }
      return reply(`✅ Anti-link: *${subcommand.toUpperCase()}*` + (isSubBot ? '\n_(Only affects this sub-bot)_' : ''));

    case 'limit':
      const limit = parseInt(value);
      if (isNaN(limit) || limit < 1 || limit > 10) {
        return reply("❌ Limit must be 1-10");
      }
      if (isSubBot && updateSubBotSettings) {
        await updateSubBotSettings({ antilinkWarnLimit: limit });
      } else {
        await updateAntiLinkSettings({ warn_limit: limit });
      }
      return reply(`✅ Warn limit: *${limit}*` + (isSubBot ? '\n_(Only affects this sub-bot)_' : ''));

    case 'resetwarns':
      clearAllWarns();
      return reply("✅ Warning counts reset!");

    default:
      return reply(
        "❌ Invalid command!\n\n" +
        `▸ antilink off/warn/delete/remove\n` +
        `▸ antilink limit <1-10>\n` +
        `▸ antilink resetwarns`
      );
  }
});
//========================================================================================================================

bwmxmd({
  pattern: "antidelete",
  aliases: ["deleteset", "antideletesetting"],
  category: "Settings",
  description: "Manage anti-delete settings"
},
async (from, client, conText) => {
  const { reply, q, isSuperUser, isSubBot, updateSubBotSettings, botSettings } = conText;

  if (!isSuperUser) return reply("❌ Owner Only Command!");

  const args = q?.trim().split(/\s+/) || [];
  const subcommand = args[0]?.toLowerCase();
  const value = args.slice(1).join(" ");

  let settings;
  if (isSubBot && botSettings) {
    settings = {
      status: botSettings.antideleteStatus || false,
      includeGroupInfo: botSettings.antideleteIncludeGroupInfo !== false,
      includeMedia: botSettings.antideleteIncludeMedia !== false,
      sendToOwner: botSettings.antideleteSendToOwner !== false,
      notification: botSettings.antideleteNotification || '🗑️ *Message Deleted*'
    };
  } else {
    settings = await getAntiDeleteSettings();
  }

  if (!subcommand) {
    const status = settings.status ? '✅ ON' : '❌ OFF';
    const groupInfo = settings.includeGroupInfo ? '✅ ON' : '❌ OFF';
    const media = settings.includeMedia ? '✅ ON' : '❌ OFF';
    const toOwner = settings.sendToOwner ? '✅ ON' : '❌ OFF';

    return reply(
      `*👿 Anti-Delete Settings*\n\n` +
      `🔹 *Status:* ${status}\n` +
      `🔹 *Notification Text:* ${settings.notification}\n` +
      `🔹 *Include Group Info:* ${groupInfo}\n` +
      `🔹 *Include Media Content:* ${media}\n` +
      `🔹 *Send to Owner Inbox:* ${toOwner}\n` +
      (isSubBot ? `🔹 *Sub-Bot:* Yes (changes only affect this bot)\n` : '') +
      `\n*🛠 Usage:*\n` +
      `▸ antidelete on/off\n` +
      `▸ antidelete notification <text>\n` +
      `▸ antidelete groupinfo on/off\n` +
      `▸ antidelete media on/off\n` +
      `▸ antidelete inbox on/off`
    );
  }

  const subBotNote = isSubBot ? '\n_(Only affects this sub-bot)_' : '';

  switch (subcommand) {
    case 'on':
    case 'off': {
      const newStatus = subcommand === 'on';
      if (isSubBot && updateSubBotSettings) {
        await updateSubBotSettings({ antideleteStatus: newStatus });
      } else {
        await updateAntiDeleteSettings({ status: newStatus });
      }
      return reply(`✅ Anti-delete has been ${newStatus ? 'enabled' : 'disabled'}.` + subBotNote);
    }

    case 'notification': {
      if (!value) return reply('❌ Provide a notification text.');
      if (isSubBot && updateSubBotSettings) {
        await updateSubBotSettings({ antideleteNotification: value });
      } else {
        await updateAntiDeleteSettings({ notification: value });
      }
      return reply(`✅ Notification updated:\n\n"${value}"` + subBotNote);
    }

    case 'groupinfo': {
      if (!['on', 'off'].includes(value)) return reply('❌ Use "on" or "off".');
      const newValue = value === 'on';
      if (isSubBot && updateSubBotSettings) {
        await updateSubBotSettings({ antideleteIncludeGroupInfo: newValue });
      } else {
        await updateAntiDeleteSettings({ includeGroupInfo: newValue });
      }
      return reply(`✅ Group info inclusion ${newValue ? 'enabled' : 'disabled'}.` + subBotNote);
    }

    case 'media': {
      if (!['on', 'off'].includes(value)) return reply('❌ Use "on" or "off".');
      const newValue = value === 'on';
      if (isSubBot && updateSubBotSettings) {
        await updateSubBotSettings({ antideleteIncludeMedia: newValue });
      } else {
        await updateAntiDeleteSettings({ includeMedia: newValue });
      }
      return reply(`✅ Media content inclusion ${newValue ? 'enabled' : 'disabled'}.` + subBotNote);
    }

    case 'inbox': {
      if (!['on', 'off'].includes(value)) return reply('❌ Use "on" or "off".');
      const newValue = value === 'on';
      if (isSubBot && updateSubBotSettings) {
        await updateSubBotSettings({ antideleteSendToOwner: newValue });
      } else {
        await updateAntiDeleteSettings({ sendToOwner: newValue });
      }
      return reply(`✅ Send to owner inbox ${newValue ? 'enabled' : 'disabled'}.` + subBotNote);
    }

    default:
      return reply(
        '❌ Invalid subcommand. Options:\n\n' +
        `▸ antidelete on/off\n` +
        `▸ antidelete notification <text>\n` +
        `▸ antidelete groupinfo on/off\n` +
        `▸ antidelete media on/off\n` +
        `▸ antidelete inbox on/off`
      );
  }
});
//========================================================================================================================
//========================================================================================================================

bwmxmd({
  pattern: "allvar",
  react: "📊",
  aliases: ["getallvar", "vars", "listvars", "varlist", "allsettings"],
  category: "Settings",
  description: "View all bot variables and settings"
},
async (from, client, conText) => {
  const { reply, isSuperUser } = conText;

  if (!isSuperUser) return reply("*Owner only command*");

  try {
    const [botSettings, statusSettings, readSettings, presenceSettings] = await Promise.all([
      getSettings(),
      getAutoStatusSettings(),
      getAutoReadSettings(),
      getPresenceSettings()
    ]);
    
    let antideleteSettings = { status: false };
    let anticallSettings = { status: false, action: 'reject' };
    let autobioSettings = { enabled: false, text: '' };
    
    try { antideleteSettings = await getAntiDeleteSettings(); } catch (e) {}
    try { anticallSettings = await getAntiCallSettings(); } catch (e) {}
    try { autobioSettings = await getAutoBioSettings(); } catch (e) {}
    
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const mins = Math.floor((uptime % 3600) / 60);
    const memUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    
    let msg = `*ISCE-BOT ALL VARIABLES*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    msg += `*BOT CONFIG*\n`;
    msg += `├ prefix: \`${botSettings.prefix}\`\n`;
    msg += `├ botname: ${botSettings.botname}\n`;
    msg += `├ mode: ${botSettings.mode}\n`;
    msg += `├ deviceMode: ${botSettings.deviceMode}\n`;
    msg += `├ packname: ${botSettings.packname}\n`;
    msg += `├ author: ${botSettings.author}\n`;
    msg += `└ timezone: ${botSettings.timezone}\n\n`;
    
    msg += `*STATUS*\n`;
    msg += `├ autoviewStatus: ${statusSettings.autoviewStatus === 'true' ? 'ON' : 'OFF'}\n`;
    msg += `├ autoLikeStatus: ${statusSettings.autoLikeStatus === 'true' ? 'ON' : 'OFF'}\n`;
    msg += `├ autoReplyStatus: ${statusSettings.autoReplyStatus === 'true' ? 'ON' : 'OFF'}\n`;
    msg += `├ statusLikeEmojis: ${statusSettings.statusLikeEmojis}\n`;
    msg += `└ statusReplyText: ${(statusSettings.statusReplyText || '').slice(0, 25)}...\n\n`;
    
    msg += `*AUTO FEATURES*\n`;
    msg += `├ autoread: ${readSettings.status ? 'ON' : 'OFF'}\n`;
    msg += `└ autobio: ${autobioSettings.enabled ? 'ON' : 'OFF'}\n\n`;
    
    msg += `*PRESENCE*\n`;
    msg += `├ privateChat: ${presenceSettings.privateChat}\n`;
    msg += `└ groupChat: ${presenceSettings.groupChat}\n\n`;
    
    msg += `*PROTECTION*\n`;
    msg += `├ antidelete: ${antideleteSettings.status ? 'ON' : 'OFF'}\n`;
    msg += `├ anticall: ${anticallSettings.status ? 'ON' : 'OFF'}\n`;
    msg += `└ anticallAction: ${anticallSettings.action}\n\n`;
    
    msg += `*SYSTEM*\n`;
    msg += `├ uptime: ${hours}h ${mins}m\n`;
    msg += `├ memory: ${memUsage}MB\n`;
    msg += `└ node: ${process.version}\n\n`;
    
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `*.getvar <key>* - Get specific var\n`;
    msg += `*.setvar key=value* - Set var`;
    
    return reply(msg);
  } catch (err) {
    console.error("Allvar error:", err);
    return reply("*Failed to load variables*");
  }
});

bwmxmd({
  pattern: "getvar",
  react: "📋",
  aliases: ["var", "gv", "get"],
  category: "Settings",
  description: "Get a specific variable value"
},
async (from, client, conText) => {
  const { q, reply, isSuperUser } = conText;

  if (!isSuperUser) return reply("*Owner only command*");

  if (!q) {
    return reply(
      `*Usage:* .getvar <variable>\n\n` +
      `*Available Variables:*\n` +
      `prefix, botname, mode, deviceMode, packname, author, timezone, ` +
      `autoviewStatus, autoLikeStatus, autoReplyStatus, autoread, autobio, ` +
      `privateChat, groupChat, antidelete, anticall`
    );
  }

  const varName = q.toLowerCase().trim();

  try {
    const [botSettings, statusSettings, readSettings, presenceSettings] = await Promise.all([
      getSettings(),
      getAutoStatusSettings(),
      getAutoReadSettings(),
      getPresenceSettings()
    ]);
    
    let antideleteSettings = { status: false };
    let anticallSettings = { status: false, action: 'reject' };
    let autobioSettings = { enabled: false };
    
    try { antideleteSettings = await getAntiDeleteSettings(); } catch (e) {}
    try { anticallSettings = await getAntiCallSettings(); } catch (e) {}
    try { autobioSettings = await getAutoBioSettings(); } catch (e) {}
    
    const allVars = {
      prefix: botSettings.prefix,
      botname: botSettings.botname,
      mode: botSettings.mode,
      devicemode: botSettings.deviceMode,
      packname: botSettings.packname,
      author: botSettings.author,
      timezone: botSettings.timezone,
      url: botSettings.url,
      gurl: botSettings.gurl,
      autoviewstatus: statusSettings.autoviewStatus === 'true' ? 'ON' : 'OFF',
      autolikestatus: statusSettings.autoLikeStatus === 'true' ? 'ON' : 'OFF',
      autoreplystatus: statusSettings.autoReplyStatus === 'true' ? 'ON' : 'OFF',
      statuslikeemojis: statusSettings.statusLikeEmojis,
      statusreplytext: statusSettings.statusReplyText,
      autoread: readSettings.status ? 'ON' : 'OFF',
      autobio: autobioSettings.enabled ? 'ON' : 'OFF',
      privatechat: presenceSettings.privateChat,
      groupchat: presenceSettings.groupChat,
      antidelete: antideleteSettings.status ? 'ON' : 'OFF',
      anticall: anticallSettings.status ? 'ON' : 'OFF',
      anticallaction: anticallSettings.action
    };
    
    if (allVars.hasOwnProperty(varName)) {
      return reply(
        `*Variable Info*\n━━━━━━━━━━━━━━\n\n` +
        `*Name:* ${varName}\n` +
        `*Value:* ${allVars[varName]}`
      );
    }
    
    const matchingVars = Object.keys(allVars).filter(k => k.includes(varName));
    if (matchingVars.length > 0) {
      let msg = `*Did you mean?*\n\n`;
      matchingVars.forEach(v => {
        msg += `*${v}:* ${allVars[v]}\n`;
      });
      return reply(msg);
    }
    
    return reply(`*Variable "${varName}" not found*\n\nUse \`.allvar\` to see all variables`);
  } catch (err) {
    console.error("Getvar error:", err);
    return reply("*Failed to get variable*");
  }
});

bwmxmd({
  pattern: "setvar",
  react: "✏️",
  aliases: ["sv", "setv"],
  category: "Settings",
  description: "Set a variable value"
},
async (from, client, conText) => {
  const { q, reply, isSuperUser, botSettings: ctxSettings } = conText;

  if (!isSuperUser) return reply("*Owner only command*");

  if (!q || !q.includes('=')) {
    return reply(
      `*Usage:* .setvar <variable>=<value>\n\n` +
      `*Examples:*\n` +
      `.setvar prefix=!\n` +
      `.setvar botname=MyBot\n` +
      `.setvar mode=private\n` +
      `.setvar deviceMode=iPhone\n` +
      `.setvar autoviewstatus=on\n` +
      `.setvar privatechat=typing`
    );
  }

  const [varName, ...valueParts] = q.split('=');
  const value = valueParts.join('=').trim();
  const key = varName.toLowerCase().trim();

  if (!value) return reply("*Value cannot be empty*");

  try {
    const botVars = ['prefix', 'botname', 'mode', 'devicemode', 'packname', 'author', 'timezone', 'url', 'gurl', 'sessionname'];
    const statusVars = ['autoviewstatus', 'autolikestatus', 'autoreplystatus', 'statuslikeemojis', 'statusreplytext'];
    const presenceVars = ['privatechat', 'groupchat'];
    
    let success = false;
    let displayName = key;

    if (botVars.includes(key)) {
      const keyMap = {
        'devicemode': 'deviceMode',
        'sessionname': 'sessionName'
      };
      const updateKey = keyMap[key] || key;
      await updateSettings({ [updateKey]: value });
      if (ctxSettings) ctxSettings[updateKey] = value;
      displayName = updateKey;
      success = true;
    } else if (statusVars.includes(key)) {
      const statusKeyMap = {
        'autoviewstatus': 'autoviewStatus',
        'autolikestatus': 'autoLikeStatus',
        'autoreplystatus': 'autoReplyStatus',
        'statuslikeemojis': 'statusLikeEmojis',
        'statusreplytext': 'statusReplyText'
      };
      const updateKey = statusKeyMap[key] || key;
      let updateValue = value;
      if (['autoviewstatus', 'autolikestatus', 'autoreplystatus'].includes(key)) {
        updateValue = ['on', 'true', 'yes', '1'].includes(value.toLowerCase()) ? 'true' : 'false';
      }
      await updateAutoStatusSettings({ [updateKey]: updateValue });
      displayName = updateKey;
      success = true;
    } else if (presenceVars.includes(key)) {
      const presenceKeyMap = { 'privatechat': 'privateChat', 'groupchat': 'groupChat' };
      const updateKey = presenceKeyMap[key] || key;
      const validValues = ['off', 'online', 'typing', 'recording'];
      if (!validValues.includes(value.toLowerCase())) {
        return reply(`*Invalid value!*\n\nValid options: ${validValues.join(', ')}`);
      }
      await updatePresenceSettings({ [updateKey]: value.toLowerCase() });
      displayName = updateKey;
      success = true;
    } else if (key === 'autoread') {
      const status = ['on', 'true', 'yes', '1'].includes(value.toLowerCase());
      const { AutoReadDB } = require('../core/database/autoread');
      const settings = await AutoReadDB.findOne();
      if (settings) {
        await settings.update({ status });
      } else {
        await AutoReadDB.create({ status, chatTypes: ['private', 'group'] });
      }
      displayName = 'autoread';
      success = true;
    } else if (key === 'antidelete') {
      const status = ['on', 'true', 'yes', '1'].includes(value.toLowerCase());
      await updateAntiDeleteSettings({ status });
      displayName = 'antidelete';
      success = true;
    } else if (key === 'anticall') {
      const status = ['on', 'true', 'yes', '1'].includes(value.toLowerCase());
      await updateAntiCallSettings({ status });
      displayName = 'anticall';
      success = true;
    } else if (key === 'autobio') {
      const enabled = ['on', 'true', 'yes', '1'].includes(value.toLowerCase());
      await updateAutoBioSettings({ enabled });
      displayName = 'autobio';
      success = true;
    }

    if (success) {
      return reply(
        `*Variable Updated*\n━━━━━━━━━━━━━━\n\n` +
        `*Variable:* ${displayName}\n` +
        `*Value:* ${value}\n` +
        `*Status:* Saved`
      );
    } else {
      return reply(`*Variable "${key}" not recognized*\n\nUse \`.allvar\` to see available variables`);
    }
  } catch (err) {
    console.error("Setvar error:", err);
    return reply("*Failed to update variable:* " + err.message);
  }
});

bwmxmd({
  pattern: "systeminfo",
  react: "📊",
  aliases: ["sysinfo", "botstatus", "runtime"],
  category: "Settings",
  description: "View system information and runtime status"
},
async (from, client, conText) => {
  const { reply, isSuperUser, botSettings } = conText;

  if (!isSuperUser) return reply("*Owner only command*");

  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const mins = Math.floor((uptime % 3600) / 60);
  const secs = Math.floor(uptime % 60);

  const memUsage = process.memoryUsage();
  const heapUsed = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotal = Math.round(memUsage.heapTotal / 1024 / 1024);
  const rss = Math.round(memUsage.rss / 1024 / 1024);

  let msg = `*ISCE-BOT SYSTEM INFO*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  msg += `*RUNTIME*\n`;
  msg += `├ Uptime: ${hours}h ${mins}m ${secs}s\n`;
  msg += `├ Node: ${process.version}\n`;
  msg += `├ Platform: ${process.platform}\n`;
  msg += `└ Arch: ${process.arch}\n\n`;

  msg += `*MEMORY*\n`;
  msg += `├ Heap: ${heapUsed}/${heapTotal}MB\n`;
  msg += `└ RSS: ${rss}MB\n\n`;

  msg += `*BOT*\n`;
  msg += `├ Name: ${botSettings?.botname || 'ISCE-BOT'}\n`;
  msg += `├ Mode: ${botSettings?.mode || 'public'}\n`;
  msg += `├ Device: ${botSettings?.deviceMode || 'Android'}\n`;
  msg += `└ Prefix: ${botSettings?.prefix || '.'}\n\n`;

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `*Status:* Online`;

  return reply(msg);
});


