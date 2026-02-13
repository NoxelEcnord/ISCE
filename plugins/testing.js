const { bwmxmd } = require('../core/commandHandler');
const { generateWAMessageFromContent, generateWAMessageContent, proto } = require('@whiskeysockets/baileys');
const XMD = require('../core/xmd');

const getContactMsg = (contactName, sender) => XMD.getContactMsg(contactName, sender);

bwmxmd({
  pattern: "catalogbtn",
  aliases: [],
  description: "Send a button catalog",
  category: "Fun",
  filename: __filename
}, async (from, client, conText) => {
  const { mek } = conText;

  const imageMessage = (await generateWAMessageContent(
    { image: { url: "IMAGE_URL" } },
    { upload: client.waUploadToServer }
  )).imageMessage;

  const msg = await generateWAMessageFromContent(from, {
    viewOnceMessage: {
      message: {
        interactiveMessage: {
          body: { text: "whyuxD" },
          header: {
            title: "wxx",
            hasMediaAttachment: true,
            productMessage: {
              product: {
                productImage: imageMessage,
                productId: "9116471035103640",
                title: "wxx",
                description: "hytam vs putyh",
                currencyCode: "IDR",
                priceAmount1000: "5000200",
                retailerId: "4144242",
                url: "https://wa.me/c/6283189053897",
                productImageCount: 1
              },
              businessOwnerJid: "6283189053897@s.whatsapp.net"
            }
          },
          nativeFlowMessage: {
            buttons: [
              {
                name: "single_select",
                buttonParamsJson: "{\"has_multiple_buttons\":true}"
              },
              {
                name: "cta_catalog",
                buttonParamsJson: `{"business_phone_number": "6283189053897", "catalog_product_id": "9116471035103640"}`
              }
            ]
          }
        }
      }
    }
  }, { quoted: mek });

  await client.relayMessage(from, msg.message, { messageId: msg.key.id });
});
