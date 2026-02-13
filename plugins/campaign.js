const { bwmxmd } = require("../core/commandHandler");
const { addCampaignGroup, removeCampaignGroup, getCampaignGroups, getCampaignState, updateCampaignState } = require("../core/database/campaign");
const XMD = require("../core/xmd");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

// Helper to check if sender is sudo/owner
const isOwner = (conText) => conText.isSuperUser || XMD.isDev(conText.sender);

// Helper for logo generation
const fetchLogoUrl = async (url, name) => {
    try {
        const response = await axios.get(XMD.LOGO.EPHOTO(url, name));
        const data = response.data;
        if (data && data.result && data.result.download_url) {
            return data.result.download_url;
        }
        return null;
    } catch (error) {
        console.error("Error fetching logo:", error);
        return null;
    }
};

// Group Management Commands
bwmxmd({
    pattern: "addgroup",
    description: "Add current group to campaign scope",
    category: "campaign",
    filename: __filename
}, async (from, client, conText) => {
    const { reply, sender, isGroup } = conText;
    if (!isGroup) return reply("❌ This command can only be used in groups.");
    if (!isOwner(conText)) return reply("❌ Only owner can add groups to campaign scope.");

    const success = await addCampaignGroup(from, sender);
    if (success) {
        reply("✅ Group added to campaign scope. ISCE is watching! 🦅");
    } else {
        reply("❌ Failed to add group.");
    }
});

bwmxmd({
    pattern: "delgroup",
    description: "Remove current group from campaign scope",
    category: "campaign",
    filename: __filename
}, async (from, client, conText) => {
    const { reply, isGroup } = conText;
    if (!isGroup) return reply("❌ This command can only be used in groups.");
    if (!isOwner(conText)) return reply("❌ Only owner can manage campaign scope.");

    const success = await removeCampaignGroup(from);
    if (success) {
        reply("🗑️ Group removed from campaign scope.");
    } else {
        reply("❌ Failed to remove group.");
    }
});

bwmxmd({
    pattern: "autoscan",
    description: "Scan all groups and add those matching campaign keywords in title",
    category: "campaign",
    filename: __filename
}, async (from, client, conText) => {
    const { reply } = conText;
    if (!isOwner(conText)) return reply("❌ Unauthorized.");

    let addedCount = 0;
    try {
        const groups = await client.groupFetchAllParticipating();
        const keywords = XMD.CAMPAIGN_GROUP_KEYWORDS.map(k => k.toLowerCase());

        for (const jid in groups) {
            const subject = groups[jid].subject.toLowerCase();
            const matches = keywords.some(k => subject.includes(k));

            if (matches) {
                const success = await addCampaignGroup(jid, conText.sender);
                if (success) addedCount++;
            }
        }
        reply(`✅ Autoscan complete. Added ${addedCount} new groups to campaign scope.`);
    } catch (e) {
        console.error("Autoscan error:", e);
        reply("❌ Error during autoscan: " + e.message);
    }
});

// Sticker/Text Flooding Logic
let floodInterval = null;

bwmxmd({
    pattern: "campaignstart",
    description: "Start campaign bursts to scoped groups",
    category: "campaign",
    use: "<count> <interval_ms>",
    filename: __filename
}, async (from, client, conText) => {
    const { reply, args, isGroup } = conText;

    if (isGroup) return reply("❌ Control campaign bursts from my DM!");
    if (!isOwner(conText)) return reply("❌ Unauthorized.");

    const count = parseInt(args[0]) || 0;
    const interval = parseInt(args[1]) || 5000;

    await updateCampaignState({
        is_flooding: true,
        sticker_count: count,
        interval_ms: interval
    });

    reply(`🚀 Initializing Campaign Bursts!\n🎯 Targets: Scoped Groups\n⏱️ Baseline Interval: ${interval}ms\n🔢 Count: ${count === 0 ? 'Infinite' : count}\n✨ Mode: Randomized Manifesto & Slogans`);

    startFlooding(client);
});

bwmxmd({
    pattern: "campaignstop",
    description: "Stop campaign bursts",
    category: "campaign",
    filename: __filename
}, async (from, client, conText) => {
    const { reply, isGroup } = conText;
    if (isGroup) return reply("❌ Control from DM!");
    if (!isOwner(conText)) return reply("❌ Unauthorized.");

    await updateCampaignState({ is_flooding: false });
    if (floodInterval) {
        clearInterval(floodInterval);
        floodInterval = null;
    }
    reply("🛑 Campaign bursts stopped.");
});

async function startFlooding(client) {
    if (floodInterval) clearInterval(floodInterval);

    let sentCount = 0;

    const runFlood = async () => {
        const state = await getCampaignState();
        if (!state.is_flooding) {
            clearInterval(floodInterval);
            floodInterval = null;
            return;
        }

        if (state.sticker_count !== 0 && sentCount >= state.sticker_count) {
            await updateCampaignState({ is_flooding: false });
            clearInterval(floodInterval);
            floodInterval = null;
            return;
        }

        const groups = await getCampaignGroups();
        if (groups.length === 0) return;

        console.log(`[CAMPAIGN] Bursting to ${groups.length} groups...`);

        await Promise.allSettled(groups.map(async (jid) => {
            try {
                // Dynamic Frequency Adjustment
                const activity = client.getActivityLevel ? client.getActivityLevel(jid, 60000) : 0;
                // If group is busy (activity > 5), we increase burst frequency by reducing interval for this group
                // But since we are in a global loop, we can just decide to send multiple messages in one go
                const burstMultiplier = activity > 10 ? 3 : (activity > 5 ? 2 : 1);

                for (let i = 0; i < burstMultiplier; i++) {
                    const rand = Math.random();
                    let msg = "";

                    if (rand < 0.4) {
                        // 40% chance Manifesto Part
                        msg = XMD.MANIFESTO_PARTS[Math.floor(Math.random() * XMD.MANIFESTO_PARTS.length)];
                    } else if (rand < 0.7) {
                        // 30% chance Slogan
                        msg = XMD.CAMPAIGN_VARIANTS.SLOGANS[Math.floor(Math.random() * XMD.CAMPAIGN_VARIANTS.SLOGANS.length)];
                    } else {
                        // 30% chance Caption + Headline + Tags
                        const caption = XMD.CAMPAIGN_VARIANTS.CAPTIONS[Math.floor(Math.random() * XMD.CAMPAIGN_VARIANTS.CAPTIONS.length)];
                        const hashtag = XMD.CAMPAIGN_VARIANTS.HASHTAGS[Math.floor(Math.random() * XMD.CAMPAIGN_VARIANTS.HASHTAGS.length)];
                        msg = `✨ *CORAZONE 002* ✨\n\n${caption}\n\n${hashtag}`;
                    }

                    await client.sendMessage(jid, {
                        text: `${msg}\n\n_Action Over Talks!!_`,
                        contextInfo: {
                            externalAdReply: {
                                title: "CORAZONE CHEPKOECH BOR 🦅",
                                body: "Delegate 002 | #BorTosha",
                                mediaType: 1,
                                thumbnailUrl: XMD.CAMPAIGN_IMAGES[Math.floor(Math.random() * XMD.CAMPAIGN_IMAGES.length)]
                            }
                        }
                    });

                    if (burstMultiplier > 1) await new Promise(r => setTimeout(r, 1000));
                }
            } catch (e) {
                console.error(`Error sending burst to ${jid}:`, e.message);
            }
        }));
        sentCount++;
    };

    const state = await getCampaignState();
    floodInterval = setInterval(runFlood, state.interval_ms || 10000);
}

// Promotional Messages Loop (with Logo generation)
let promoInterval = null;

async function startPromoLoop(client) {
    if (promoInterval) clearInterval(promoInterval);

    promoInterval = setInterval(async () => {
        const groups = await getCampaignGroups();
        if (groups.length === 0) return;

        console.log(`[CAMPAIGN] Sending HQ promo to ${groups.length} groups...`);

        await Promise.allSettled(groups.map(async (jid) => {
            try {
                const rand = Math.random();
                const randomImg = XMD.CAMPAIGN_IMAGES[Math.floor(Math.random() * XMD.CAMPAIGN_IMAGES.length)];
                const randomCaption = XMD.CAMPAIGN_VARIANTS.CAPTIONS[Math.floor(Math.random() * XMD.CAMPAIGN_VARIANTS.CAPTIONS.length)];
                const randomQuote = XMD.CAMPAIGN_VARIANTS.QUOTES[Math.floor(Math.random() * XMD.CAMPAIGN_VARIANTS.QUOTES.length)];

                if (rand < 0.4) {
                    // 40% chance Logo Generation
                    const logoUrl = await fetchLogoUrl("https://en.ephoto360.com/create-digital-tiger-logo-video-effect-723.html", "CORAZONE");
                    if (logoUrl) {
                        await client.sendMessage(jid, {
                            video: { url: logoUrl },
                            caption: `🔥 *CORAZONE 002* 🔥\n\n${randomCaption}\n\n#ActionOverTalks`,
                            gifPlayback: true
                        });
                    } else {
                        // Fallback to static image
                        await client.sendMessage(jid, {
                            image: { url: randomImg },
                            caption: `📢 *OFFICIAL UPDATE*\n\n${randomCaption}\n\n_Vote Corazone Chepkoech!_`
                        });
                    }
                } else {
                    // 60% chance Random Quote Poster
                    await client.sendMessage(jid, {
                        image: { url: randomImg },
                        caption: `💎 *WORDS OF WISDOM*\n\n_${randomQuote}_\n\n*Vote Corazone Bor for Delegate 002!*`,
                        contextInfo: {
                            externalAdReply: {
                                title: "CORAZONE CHEPKOECH BOR",
                                body: "The Reliable Bridge",
                                mediaType: 1,
                                thumbnailUrl: randomImg
                            }
                        }
                    });
                }
            } catch (e) {
                console.error(`Failed to send HQ promo to ${jid}:`, e.message);
            }
        }));
    }, 120 * 1000); // Every 2 minutes
}

// Auto-start loops on bot start
bwmxmd({ pattern: "campaigninit", dontAddCommandList: true }, async (from, client, conText) => {
    if (!conText.isSuperUser) return;

    // Auto-scan on init
    try {
        const groups = await client.groupFetchAllParticipating();
        const keywords = XMD.CAMPAIGN_GROUP_KEYWORDS.map(k => k.toLowerCase());
        let addedCount = 0;

        for (const jid in groups) {
            const subject = groups[jid].subject.toLowerCase();
            if (keywords.some(k => subject.includes(k))) {
                const success = await addCampaignGroup(jid, conText.sender);
                if (success) addedCount++;
            }
        }

        startFlooding(client);
        startPromoLoop(client);
        conText.reply(`✅ Campaign tasks initialized.\n🔍 Autoscan: Added ${addedCount} groups.\n🚀 Mode: Randomized Text Bursts & Logo Gen.`);
    } catch (e) {
        conText.reply("❌ Init failed: " + e.message);
    }
});

module.exports = { startFlooding, startPromoLoop };
