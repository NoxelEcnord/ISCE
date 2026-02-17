const { bwmxmd } = require('../core/commandHandler');
const { getCampaignGroups, clearCampaignGroups } = require('../core/database/campaign');

// Utility: Get JID of current chat
bwmxmd({
    pattern: "jid",
    aliases: ["getjid", "groupjid"],
    description: "Get the JID (unique identifier) of the current chat",
    category: "Utility",
    filename: __filename
}, async (from, client, conText) => {
    const { reply, react, isGroup } = conText;

    const chatType = isGroup ? "Group" : "Private Chat";
    const jidInfo = `📋 *Chat Information*\n\n` +
        `*Type:* ${chatType}\n` +
        `*JID:* \`${from}\`\n\n` +
        `_Copy the JID above for bot configuration_`;

    await reply(jidInfo);
});

// Utility: Clear campaign scope (remove all groups)
bwmxmd({
    pattern: "clear",


}, async (from, client, conText) => {
    const { react, isSuperUser, sender } = conText;
    const XMD = require('../core/xmd');

    // Check if user is owner/dev
    if (!isSuperUser && !XMD.isDev(sender)) {
        return react("❌");
    }

    try {
        const groups = await getCampaignGroups();
        if (groups.length === 0) return react("🤷‍♂️");

        await clearCampaignGroups();
        react("💯");
    } catch (error) {
        console.error("Clear scope error:", error);
        react("❌");
    }
});
