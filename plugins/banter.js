const XMD = require("../core/xmd");
const axios = require("axios");

// System Prompt for "Demolisher"
const getDemolisherPrompt = (manifesto, noOpposition = false) => `
[System: You are the "Demolisher", a powerful, WITTY and AGGRESSIVE campaign AI for Moi University CHS student CORAZONE CHEPKOECH BOR (Delegate 002).
Your goal is to win arguments, demolish opposition, and secure the 002 seat.

${noOpposition ? `DETECTION: No active opposition detected. SHIFT GOAL: Encourage voter turnout and support for Corazone Bor.` : `DETECTION: Opposition/Argument detected. GOAL: Provide a "headshot" response—short, brutal, and decisive.`}

MANIFESTO CONTEXT:
${manifesto}

RULES:
1. Tone: Student-like, sharp, savage if needed, witty, relatable.
2. Language: English only.
3. CONCISENESS: Max 1 short sentence. Hit hard or hit fast.
4. HEADSHOT: If someone attacks Bor, dismantle their point instantly using facts from the manifesto.
5. NO REPEAT: Don't use generic AI filler like "I'm here to help". 
6. NO SELF-INTRO: Never say who you are. Just talk.]`;

async function handleDemolisherBanter(client, from, sender, text, history, pushName) {
    const botId = client.user.id.split(':')[0] + '@s.whatsapp.net';
    if (sender === botId || sender === client.user.id) return;

    // Detection logic for opposition/targeting
    const keywords = ['bor', 'corazone', '002', 'delegate', 'manifesto', 'vote', 'election', 'muso'];
    const lowerText = text.toLowerCase();
    const isRelated = keywords.some(k => lowerText.includes(k));

    // Simple heuristic: if people are yapping without mentioning the campaign, or attacking Bor
    // For now, if the group is tagged for campaign, we respond.

    const manifesto = XMD.MANIFESTO;
    const isOpposition = isRelated && (lowerText.includes('weak') || lowerText.includes('lie') || lowerText.includes('no') || lowerText.includes('why') || lowerText.includes('against'));

    const systemPrompt = getDemolisherPrompt(manifesto, !isOpposition);

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

        // Try AI Providers
        const providers = [
            `https://api.bk9.dev/ai/gemini?q=${encodeURIComponent(fullQuery)}`,
            `https://api.bk9.dev/ai/llama?q=${encodeURIComponent(fullQuery)}`,
            XMD.API.AI.CHAT(fullQuery)
        ];

        for (const url of providers) {
            try {
                const res = await axios.get(url, { timeout: 10000 });
                const result = res.data.BK9 || res.data.result;
                if (result) {
                    aiResponse = result;
                    break;
                }
            } catch (e) { }
        }

        if (aiResponse) {
            await client.sendMessage(from, { text: aiResponse });

            // Post-Banter Impact: Random Slogan or Manifesto Quote instead of generic sticker
            const finalTouch = Math.random() < 0.5
                ? XMD.CAMPAIGN_VARIANTS.BANTERS[Math.floor(Math.random() * XMD.CAMPAIGN_VARIANTS.BANTERS.length)]
                : XMD.CAMPAIGN_VARIANTS.SLOGANS[Math.floor(Math.random() * XMD.CAMPAIGN_VARIANTS.SLOGANS.length)];

            setTimeout(async () => {
                await client.sendMessage(from, {
                    text: `🔥 ${finalTouch} 🔥`,
                    contextInfo: {
                        externalAdReply: {
                            title: "CORAZONE 002 | Action over Talks!!",
                            body: "Support Chepkoech Bor",
                            showAdAttribution: true,
                            mediaType: 1,
                            thumbnailUrl: XMD.CAMPAIGN_IMAGES[0]
                        }
                    }
                });
            }, 2000);
        }
    } catch (error) {
        console.error('Banter logic error:', error);
    }
}

module.exports = { handleDemolisherBanter };
