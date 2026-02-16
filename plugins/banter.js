const XMD = require("../core/xmd");
const axios = require("axios");
const { bwmxmd } = require("../core/commandHandler");
const { getCampaignState, updateCampaignState, getParticipant } = require("../core/database/campaign");

// System Prompt for "Demolisher"
const getDemolisherPrompt = (manifesto, level = 3, targetType = 'neutral', messageLength = 'short') => {
    let aggression = "";
    switch (level) {
        case 1: aggression = "Polite, firm, and informative. Counter with facts and positive arguments."; break;
        case 2: aggression = "Confident and persuasive. Use wit and charm."; break;
        case 3: aggression = "Sharp, student-like, and witty. Balance humor with substance."; break;
        case 4: aggression = "Aggressive, savage, and hits back hard. But stay classy."; break;
        case 5: aggression = "TOTAL DEMOLITION. Ruthless, brutal, and absolutely crushing. Destroy the opposition's argument without mercy."; break;
        default: aggression = "Sharp, student-like, and witty.";
    }

    const targeting = targetType === 'foe' ? "TARGET: FOE. Counter their arguments. You can be hurtful OR positive - read the room and choose the best approach. Sometimes a positive counter-argument is more effective than aggression." :
        (targetType === 'pal' ? "TARGET: PAL. Be supportive, reinforcing, and friendly." : "TARGET: NEUTRAL. Be persuasive and recruitment-focused.");

    const lengthGuidance = messageLength === 'long' ?
        "RESPONSE LENGTH: They sent a paragraph, so respond with a paragraph (3-5 sentences). Match their energy." :
        messageLength === 'medium' ?
            "RESPONSE LENGTH: They sent 2-3 sentences, so respond with 2-3 sentences. Match their length." :
            "RESPONSE LENGTH: They sent a one-liner, so respond with ONE sharp sentence. Be concise and punchy.";

    return `
[System: You are the "Demolisher", a powerful campaign AI for Moi University CHS student CORAZONE CHEPKOECH BOR (Delegate 002).
Your goal is to win arguments, demolish opposition, and secure the 002 seat.

STYLE: ${aggression}
${targeting}

INTELLIGENCE RULES:
1. READ THE ROOM: Analyze their message tone. Are they aggressive? Casual? Serious? Match or counter appropriately.
2. FLEXIBLE STRATEGY: You don't always have to be hurtful. Sometimes a positive, fact-based counter is more effective. Choose wisely.
3. ${lengthGuidance}
4. CONTEXT MATTERS: If they're making a weak argument, expose it. If they're asking a question, answer powerfully. If they're trolling, shut it down.

CORE RULES:
1. Tone: Student-like, relatable, Muso-savvy.
2. Language: English only.
3. BRAND PROTECTION: Always protect Corazone Bor's public image. Deface others respectably (use facts and wit, not slurs).
4. TARGETING: We support PALS and fight FOES. We fight GRACE and ANNE. We IGNORE GERRY and LAMECH (do not touch them or their banters).
5. IDENTITIES: Corazone Bor is the best. Grace/Anne are the rivals. 
6. NO REPEAT: Don't use generic AI filler.
7. NEVER intro yourself.
8. BE FLEXIBLE: Paragraph for paragraph, one-liner for one-liner. But you can adjust if needed for impact.]

MANIFESTO CONTEXT:
${manifesto}`;
};

async function handleDemolisherBanter(client, from, sender, text, history, pushName, isMedia = false) {
    if (isMedia) return; // Only banter text as requested

    const botId = client.user.id.split(':')[0] + '@s.whatsapp.net';
    if (sender === botId || sender === client.user.id) return;

    // Load state
    const state = await getCampaignState();
    if (!state.is_flooding) return; // Only banter when campaign is active (or separate banter flag, but user implies it's part of it)

    // Check targeting
    const participant = await getParticipant(sender);
    const targetType = participant?.type || 'neutral';

    // Ignore list check
    const lowerText = text.toLowerCase();
    if (lowerText.includes('gerry') || lowerText.includes('lamech')) {
        console.log(`[BANTER] Ignoring message related to Gerry/Lamech from ${sender}`);
        return;
    }

    // Detect message length for context-aware responses
    const wordCount = text.split(/\s+/).length;
    const messageLength = wordCount > 30 ? 'long' : wordCount > 10 ? 'medium' : 'short';
    console.log(`[BANTER] Message from ${pushName}: ${wordCount} words (${messageLength})`);

    const manifesto = XMD.MANIFESTO;
    const systemPrompt = getDemolisherPrompt(manifesto, state.banter_level, targetType, messageLength);

    let context = "Recent context:\n";
    context += history.map(m => {
        const s = m.key.participant || m.key.remoteJid;
        const name = m.pushName || s.split('@')[0];
        const msg = m.message?.conversation || m.message?.extendedTextMessage?.text || "";
        return `${name}: ${msg}`;
    }).join("\n");

    const fullQuery = systemPrompt + "\n\n" + context + "\n\nCurrent: " + pushName + ": " + text;

    try {
        let aiResponse = null;
        const providers = [
            `https://api.bk9.dev/ai/gemini?q=${encodeURIComponent(fullQuery)}`,
            `https://api.bk9.dev/ai/llama?q=${encodeURIComponent(fullQuery)}`,
            XMD.API.AI.CHAT(fullQuery)
        ];

        for (const url of providers) {
            try {
                const res = await axios.get(url, { timeout: 10000 });
                aiResponse = res.data.BK9 || res.data.result;
                if (aiResponse) break;
            } catch (e) { }
        }

        if (aiResponse) {
            await client.sendMessage(from, {
                text: aiResponse,
                contextInfo: {
                    mentionedJid: [sender],
                    ...XMD.getContextInfo()
                }
            });

            // Random manifesto/slogan touch (low frequency in banter)
            if (Math.random() < 0.2) {
                const finalTouch = XMD.CAMPAIGN_VARIANTS.SLOGANS[Math.floor(Math.random() * XMD.CAMPAIGN_VARIANTS.SLOGANS.length)];
                setTimeout(async () => {
                    await client.sendMessage(from, {
                        text: `🔥 ${finalTouch} 🔥`,
                        contextInfo: { ...XMD.getContextInfo() }
                    });
                }, 2000);
            }
        }
    } catch (error) {
        console.error('Banter logic error:', error);
    }
}

// Banter Control Command
bwmxmd({
    pattern: "banter",
    description: "Toggle campaign banter and set level (1-5)",
    category: "campaign",
    use: "<on/off> [level]",
    filename: __filename
}, async (from, client, conText) => {
    const { reply, args } = conText;
    if (!conText.isSuperUser) return reply("❌ Unauthorized.");

    const action = args[0]?.toLowerCase();
    if (action === 'on') {
        const level = parseInt(args[1]) || 3;
        if (level < 1 || level > 5) return reply("❌ Level must be between 1 and 5.");

        await updateCampaignState({ is_flooding: true, banter_level: level });
        reply(`🔥 *Banter Engaged!*\n📊 *Level:* ${level}\n🎯 *Style:* ${level === 5 ? 'Ruthless Demolition' : 'Persuasive'}\n\n_I am now watching for opponents to dismantle._`);
    } else if (action === 'off') {
        const state = await getCampaignState();
        // If we only want to stop banter but keep flooding, we'd need a separate flag.
        // But user implies "banter on 5" is the command.
        // For now, I'll assume banter is tied to the campaign state or I'll just keep it simple.
        await updateCampaignState({ is_flooding: false });
        reply("🛑 Banter disengaged.");
    } else {
        const state = await getCampaignState();
        reply(`ℹ️ *Banter Status:* ${state.is_flooding ? 'ON' : 'OFF'}\n📊 *Level:* ${state.banter_level}\n\n_Use .banter <on/off> [level] to configure._`);
    }
});

module.exports = { handleDemolisherBanter };
