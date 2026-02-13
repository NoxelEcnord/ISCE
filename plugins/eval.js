const { bwmxmd } = require("../core/commandHandler");
const util = require("util");

bwmxmd({
    pattern: "eval",
    aliases: ["ev", "$"],
    category: "Owner",
    react: "⚡",
    description: "Evaluate JavaScript code",
    dontAddCommandList: true
}, async (from, client, conText) => {
    const {
        mek, reply, q, sender, pushName, isSuperUser,
        quoted, isGroup, groupInfo, groupName,
        mentionedJid, repliedMessage, quotedMsg,
        prefix, botSettings, ownerNumber
    } = conText;

    if (!isSuperUser) return reply("❌ Superuser only command.");

    if (!q) return reply("❌ Provide code to evaluate.\n\nExample: .eval 2+2");

    try {
        const isAsync = q.includes('await') || q.includes('async');

        let evaled;
        if (isAsync) {
            evaled = await eval(`(async () => { 
                try { 
                    return ${q.includes('return') ? q : `(${q})`}
                } catch (e) { 
                    return "❌ Async Eval Error: " + e.message; 
                } 
            })()`);
        } else {
            evaled = eval(q);
        }

        if (typeof evaled !== 'string') {
            evaled = util.inspect(evaled, { depth: 2, maxArrayLength: 50 });
        }

        if (evaled.length > 4000) {
            evaled = evaled.substring(0, 4000) + "\n\n... [truncated]";
        }

        await reply(evaled);

    } catch (error) {
        console.error("Eval Error:", error);
        await reply(`❌ Error: ${error.message}`);
    }
});

bwmxmd({
    pattern: "exec",
    aliases: ["shell", "bash", "sh"],
    category: "Owner",
    react: "💻",
    description: "Execute shell commands",
    dontAddCommandList: true
}, async (from, client, conText) => {
    const { reply, q, isSuperUser } = conText;

    if (!isSuperUser) return reply("❌ Superuser only command.");

    if (!q) return reply("❌ Provide a command to execute.\n\nExample: .exec ls -la");

    try {
        const { exec } = require("child_process");
        
        exec(q, { timeout: 30000, maxBuffer: 1024 * 1024 }, async (error, stdout, stderr) => {
            let output = "";
            
            if (stdout) output += stdout;
            if (stderr) output += "\n" + stderr;
            if (error) output += "\n❌ Error: " + error.message;
            
            if (!output.trim()) output = "✅ Command executed (no output)";
            
            if (output.length > 4000) {
                output = output.substring(0, 4000) + "\n\n... [truncated]";
            }
            
            await reply(output);
        });

    } catch (error) {
        console.error("Exec Error:", error);
        await reply(`❌ Error: ${error.message}`);
    }
});
