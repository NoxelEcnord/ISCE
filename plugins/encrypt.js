const { bwmxmd } = require('../core/commandHandler');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const XMD = require('../core/xmd');

const getContactMsg = (contactName, sender) => XMD.getContactMsg(contactName, sender);
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
bwmxmd({
  pattern: "encrypt2",
  aliases: ["byte", "obfuscate3", "enc2", "obfu2", "obf2"],
  description: "Encrypt JavaScript code via API",
  category: "Tools",
  filename: __filename
}, async (from, client, conText) => {
  const { mek, quoted, quotedMsg, reply, q } = conText;

  try {
    
    let code = q;
    if (quotedMsg && quotedMsg.conversation) {
      code = quotedMsg.conversation;
    }
    if (!code) {
      return reply("❌ Provide JavaScript code or quote a message containing code.\nExample: .encryptjs console.log('hi')");
    }

    
    const apiUrl = XMD.API.TOOLS.ENCRYPT2(code);
    const { data } = await axios.get(apiUrl);

    if (!data?.status || !data?.result) {
      return reply("❌ Encryption failed.");
    }

    const encryptedCode = data.result;

    
    const tmpDir = path.join(__dirname, "..", "tmp");
    await fs.ensureDir(tmpDir);
    const filePath = path.join(tmpDir, `encrypted-${Date.now()}.js`);
    await fs.writeFile(filePath, encryptedCode, "utf8");

  
    await client.sendMessage(from, {
      document: { url: filePath },
      mimetype: "application/javascript",
      fileName: "bytehide.js"
    }, { quoted: mek });


    try { fs.unlinkSync(filePath); } catch {}
  } catch (err) {
    console.error("encryptjs error:", err);
    await reply("❌ Error: " + err.message);
  }
});
//========================================================================================================================
//
bwmxmd({
  pattern: "encrypt",
  aliases: ["preemptive", "obfuscate", "enc", "obfu", "obf"],
  description: "Encrypt JavaScript code via API",
  category: "Tools",
  filename: __filename
}, async (from, client, conText) => {
  const { mek, quoted, quotedMsg, reply, q } = conText;

  try {
    
    let code = q;
    if (quotedMsg && quotedMsg.conversation) {
      code = quotedMsg.conversation;
    }
    if (!code) {
      return reply("❌ Provide JavaScript code or quote a message containing code.\nExample: .encryptjs console.log('hi')");
    }

    
    const apiUrl = XMD.API.TOOLS.ENCRYPT(code);
    const { data } = await axios.get(apiUrl);

    if (!data?.status || !data?.result) {
      return reply("❌ Encryption failed.");
    }

    const encryptedCode = data.result;

    
    const tmpDir = path.join(__dirname, "..", "tmp");
    await fs.ensureDir(tmpDir);
    const filePath = path.join(tmpDir, `encrypted-${Date.now()}.js`);
    await fs.writeFile(filePath, encryptedCode, "utf8");

  
    await client.sendMessage(from, {
      document: { url: filePath },
      mimetype: "application/javascript",
      fileName: "preemptive.js"
    }, { quoted: mek });


    try { fs.unlinkSync(filePath); } catch {}
  } catch (err) {
    console.error("encryptjs error:", err);
    await reply("❌ Error: " + err.message);
  }
});
