const { bwmxmd } = require("../core/commandHandler");
const fs = require("fs");
const path = require("path");

const CONTACTS_FILE = path.join(__dirname, "../assets/contacts.txt");
const INDEX_FILE = path.join(__dirname, "../assets/last_text_index.txt");

bwmxmd({
    pattern: "text",
    description: "Broadcast campaign message to contacts",
    category: "campaign",
    use: "[start_index]",
    filename: __filename
}, async (from, client, conText) => {
    const { reply, react, sender, isSuperUser, args } = conText;

    if (!isSuperUser) return react("❌");

    if (!fs.existsSync(CONTACTS_FILE)) {
        return reply("❌ contacts.txt not found in assets/");
    }

    const contacts = fs.readFileSync(CONTACTS_FILE, 'utf-8').split('\n').filter(n => n.trim() !== "");
    let startIndex = 0;

    if (args[0] && !isNaN(args[0])) {
        startIndex = parseInt(args[0]);
    } else if (fs.existsSync(INDEX_FILE)) {
        startIndex = parseInt(fs.readFileSync(INDEX_FILE, 'utf-8').trim()) || 0;
    }

    reply(`🚀 Starting broadcast to ${contacts.length} numbers from index ${startIndex}...\n_I will be verbose on terminal._`);
    react("📤");

    const messageTemplate = `🗳️ *URGENT ELECTION UPDATE* 🗳️

Today is the ELECTION DAY! 🦅

Please turn up at the *MAIN HOSTEL BUILDING* (Opposite school mess/cafeteria).

📋 *Requirements:*
1. School ID / Student Portal Login
2. National ID
_(If you don't have your ID right now, just come! We just need to prove you are a student first)_

🕒 *Timing:*
Ongoing since 7:00 AM. 
Ends strictly at *5:00 PM*.

🗳️ *VOTE CORAZONE - DELEGATE 002* 🗳️

Thank you to everyone who has already cast their vote! Let's make it happen.

#WekaMawe #TukoZoneNaCorazone 🦅💎
Action over talks!!`;

    let sentCount = 0;
    let failedCount = 0;
    const textedNumbers = [];

    for (let i = startIndex; i < contacts.length; i++) {
        const number = contacts[i].trim();
        const jid = number.includes("@") ? number : `${number}@s.whatsapp.net`;

        console.log(`[BROADCASTER] [${i + 1}/${contacts.length}] Processing: ${jid}`);

        try {
            await client.sendMessage(jid, { text: messageTemplate });
            console.log(`[BROADCASTER] [SUCCESS] Sent to ${jid}`);
            sentCount++;
            textedNumbers.push(number);

            // Update last index
            fs.writeFileSync(INDEX_FILE, i.toString());

            // Random delay between 5-10 seconds to avoid ban
            const delay = Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000;
            await new Promise(res => setTimeout(res, delay));
        } catch (e) {
            console.error(`[BROADCASTER] [FAILED] To ${jid}:`, e.message);
            failedCount++;
            // Continue to next number
        }
    }

    const summary = `✅ *Broadcast Complete!*

📈 *Stats:*
• Total: ${contacts.length}
• Sent: ${sentCount}
• Failed: ${failedCount}
• Resumed from: ${startIndex}

Numbers texted have been logged to terminal. 🦅`;

    await client.sendMessage(sender, { text: summary });
    console.log(`[BROADCASTER] COMPLETED. Sent: ${sentCount}, Failed: ${failedCount}`);
});
