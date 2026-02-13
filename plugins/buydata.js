const { bwmxmd } = require("../core/commandHandler");
const axios = require("axios");
const XMD = require("../core/xmd");

const BASE_API_URL = "https://virusi-mpesa-test.giftedtech.co.ke";

const paymentSessions = new Map();

const dataBundles = [
    { id: 1, name: "1GB 1hr", price: 19, description: "1GB 1hr @ Ksh 19/=" },
    { id: 2, name: "250MB 24hrs", price: 20, description: "250MB 24hrs @ Ksh 20/=" },
    { id: 3, name: "1GB 24hrs", price: 99, description: "1GB 24hrs @ Ksh 99/=" },
    { id: 4, name: "1.5GB 3hrs", price: 50, description: "1.5GB 3hrs @ Ksh 50/=" },
    { id: 5, name: "1.2GB till midnight", price: 55, description: "1.2GB till midnight @ Ksh 55/=" },
    { id: 6, name: "20 SMS 24hrs", price: 5, description: "20 SMS 24hrs @ Ksh 5/=" },
    { id: 7, name: "200 SMS 24hrs", price: 10, description: "200 SMS 24hrs @ Ksh 10/=" },
    { id: 8, name: "1000 SMS 7days", price: 30, description: "1000 SMS 7days @ Ksh 30/=" },
    { id: 9, name: "50 min midnight", price: 51, description: "50 min midnight @ Ksh 51/=" },
    { id: 10, name: "1GB 1HOUR", price: 24, description: "1GB 1HOUR @ Ksh 24/=" },
    { id: 11, name: "1.5GB 3hours", price: 53, description: "1.5GB 3hours @ Ksh 53/=" },
    { id: 12, name: "2GB 24hrs", price: 120, description: "2GB 24hrs @ Ksh 120/=" },
    { id: 13, name: "43 min 3hrs", price: 22, description: "43 min 3hrs @ Ksh 22/=" }
];

function validatePhoneNumber(phone) {
    const digits = phone.replace(/\D/g, '');
    if ((digits.startsWith('07') && digits.length === 10) || 
        (digits.startsWith('01') && digits.length === 10)) {
        return digits;
    }
    return null;
}

async function monitorPayment(checkoutId, session, client, message, onSuccess, onFailure) {
    let attempts = 0;
    const maxAttempts = 60;

    const interval = setInterval(async () => {
        attempts++;
        try {
            const response = await axios.get(`${BASE_API_URL}/mpesa/status/${checkoutId}`);
            const data = response.data;

            if (data.success === true && data.status === 'completed' && data.transaction) {
                clearInterval(interval);
                session.status = "completed";
                const txn = data.transaction;
                session.mpesaReceiptNumber = txn.MpesaReceiptNumber;
                session.transactionDate = txn.TransactionDate;
                session.amount = txn.Amount || session.amount;
                session.phone = txn.PhoneNumber || session.phone;
                await onSuccess(session, client, message);
                return;
            }

            if (data.success === false || data.status === 'not_found') {
                clearInterval(interval);
                session.status = "failed";
                await onFailure(session, client, message, data.message || "Payment failed");
                return;
            }

            if (attempts >= maxAttempts) {
                clearInterval(interval);
                session.status = "timeout";
                await onFailure(session, client, message, "Payment timeout. Please check your M-Pesa messages.");
            }
        } catch (error) {
            if (attempts >= maxAttempts) {
                clearInterval(interval);
                session.status = "error";
                await onFailure(session, client, message, "Error checking payment status.");
            }
        }
    }, 5000);
}

bwmxmd({
    pattern: "buydata",
    aliases: ["data", "bundle", "bundles"],
    category: "Payment",
    react: "📱",
    description: "Buy Safaricom data bundles via M-Pesa"
}, async (from, client, conText) => {
    const { mek, pushName, reply } = conText;
    const contactName = pushName || "User";

    try {
        const menuMessage = `📱 *ISCE-BOT DATA SOLUTIONS*

Welcome ${contactName}!
Cash in, Connect Out 💙

*━━━━ DATA BUNDLES ━━━━*

*1.* 1GB 1hr @ Ksh 19
*2.* 250MB 24hrs @ Ksh 20
*3.* 1GB 24hrs @ Ksh 99
*4.* 1.5GB 3hrs @ Ksh 50
*5.* 1.2GB till midnight @ Ksh 55

*━━━━ SMS BUNDLES ━━━━*

*6.* 20 SMS 24hrs @ Ksh 5
*7.* 200 SMS 24hrs @ Ksh 10
*8.* 1000 SMS 7days @ Ksh 30

*━━━━ MINUTES + DATA ━━━━*

*9.* 50 min midnight @ Ksh 51
*10.* 1GB 1HOUR @ Ksh 24
*11.* 1.5GB 3hours @ Ksh 53
*12.* 2GB 24hrs @ Ksh 120
*13.* 43 min 3hrs @ Ksh 22

💡 *Quote/Reply this message with bundle number (1-13)*`;

        const sentMessage = await client.sendMessage(from, {
            text: menuMessage,
            contextInfo: XMD.getContextInfo()
        }, { quoted: mek });

        const sessionId = sentMessage.key.id;
        paymentSessions.set(sessionId, {
            dest: from,
            status: "waiting_bundle_selection",
            createdAt: Date.now()
        });

        const handleReply = async (update) => {
            const message = update.messages[0];
            if (!message?.message) return;

            const quotedStanzaId = message.message.extendedTextMessage?.contextInfo?.stanzaId;
            if (!quotedStanzaId) return;

            const session = paymentSessions.get(quotedStanzaId);
            if (!session) return;

            const responseText = message.message.extendedTextMessage?.text?.trim() || 
                               message.message.conversation?.trim();
            if (!responseText) return;

            if (session.status === "waiting_bundle_selection") {
                await processBundleSelection(responseText, quotedStanzaId, session, client, message);
            } else if (session.status === "waiting_receiving_phone") {
                await processReceivingPhone(responseText, quotedStanzaId, session, client, message);
            } else if (session.status === "waiting_paying_phone") {
                await processPayingPhone(responseText, quotedStanzaId, session, client, message);
            }
        };

        client.ev.on("messages.upsert", handleReply);

        setTimeout(() => {
            client.ev.off("messages.upsert", handleReply);
            paymentSessions.delete(sessionId);
        }, 30 * 60 * 1000);

    } catch (error) {
        console.error("Buydata command error:", error);
        return reply("❌ Error loading data bundles. Please try again.");
    }
});

async function processBundleSelection(bundleInput, sessionId, session, client, message) {
    try {
        const bundleNumber = parseInt(bundleInput.trim());
        
        if (isNaN(bundleNumber) || bundleNumber < 1 || bundleNumber > 13) {
            return await client.sendMessage(session.dest, {
                text: "❌ Invalid bundle number. Reply with 1-13."
            }, { quoted: message });
        }

        const selectedBundle = dataBundles.find(b => b.id === bundleNumber);
        if (!selectedBundle) {
            return await client.sendMessage(session.dest, {
                text: "❌ Bundle not found. Try again with 1-13."
            }, { quoted: message });
        }

        session.selectedBundle = selectedBundle;
        session.amount = selectedBundle.price;
        session.status = "waiting_receiving_phone";
        paymentSessions.delete(sessionId);

        const phonePrompt = `📱 *BUNDLE SELECTED*

${selectedBundle.description}
💰 *Price:* Ksh ${selectedBundle.price}

📞 *Reply this message with phone number to RECEIVE data*

📱 Format: 07xxxxxxxx or 01xxxxxxxx
💡 Example: 0712345678`;

        const phoneMessage = await client.sendMessage(session.dest, {
            text: phonePrompt,
            contextInfo: XMD.getContextInfo()
        }, { quoted: message });

        paymentSessions.set(phoneMessage.key.id, session);

    } catch (error) {
        console.error("Bundle selection error:", error);
        await client.sendMessage(session.dest, {
            text: "❌ Error processing selection. Please try again."
        }, { quoted: message });
    }
}

async function processReceivingPhone(phoneInput, sessionId, session, client, message) {
    try {
        const validatedPhone = validatePhoneNumber(phoneInput);
        
        if (!validatedPhone) {
            return await client.sendMessage(session.dest, {
                text: "❌ Invalid phone format!\n\n📱 Reply with: 07xxxxxxxx or 01xxxxxxxx\n💡 Example: 0712345678"
            }, { quoted: message });
        }

        session.receivingPhone = validatedPhone;
        session.status = "waiting_paying_phone";
        paymentSessions.delete(sessionId);

        const payPrompt = `✅ *DATA WILL GO TO:* ${validatedPhone}

📦 *Bundle:* ${session.selectedBundle.description}
💰 *Price:* Ksh ${session.amount}

📞 *Reply this message with M-Pesa number to PAY*

📱 Format: 07xxxxxxxx or 01xxxxxxxx
⚠️ This number will receive the M-Pesa STK Push`;

        const payMessage = await client.sendMessage(session.dest, {
            text: payPrompt,
            contextInfo: XMD.getContextInfo()
        }, { quoted: message });

        paymentSessions.set(payMessage.key.id, session);

    } catch (error) {
        console.error("Receiving phone error:", error);
        await client.sendMessage(session.dest, {
            text: "❌ Error processing phone number. Please try again."
        }, { quoted: message });
    }
}

async function processPayingPhone(phoneInput, sessionId, session, client, message) {
    try {
        const validatedPhone = validatePhoneNumber(phoneInput);
        
        if (!validatedPhone) {
            return await client.sendMessage(session.dest, {
                text: "❌ Invalid phone format!\n\n📱 Reply with: 07xxxxxxxx or 01xxxxxxxx"
            }, { quoted: message });
        }

        session.payingPhone = validatedPhone;
        session.phone = validatedPhone;
        paymentSessions.delete(sessionId);

        await client.sendMessage(session.dest, {
            text: `⏳ *Processing M-Pesa Payment...*

📱 Number to receive data: ${session.receivingPhone}
📱 Number to pay: ${validatedPhone}
📦 Bundle: ${session.selectedBundle.name}
💰 Amount: Ksh ${session.amount}

🔄 Please check phone ${validatedPhone} to enter M-Pesa PIN...`
        }, { quoted: message });

        const response = await axios.get(`${BASE_API_URL}/mpesa/pay`, {
            params: {
                payingPhone: validatedPhone,
                receivingPhone: session.receivingPhone,
                amount: session.amount.toString()
            },
            timeout: 30000
        });

        const result = response.data;

        if (result.success && result.data && result.data.CheckoutRequestID) {
            session.checkoutId = result.data.CheckoutRequestID;
            session.status = "stk_sent";
            
            await client.sendMessage(session.dest, {
                text: `📲 *M-Pesa Request Sent Successfully*
━━━━━━━━━━━━━━━━━━━━━━━━
💰 Amount: Ksh ${result.data.amount || session.amount}
📱 Number paying: ${result.data.phone || validatedPhone}
📱 Number receiving: ${session.receivingPhone}
📦 Bundle: ${session.selectedBundle.name}
━━━━━━━━━━━━━━━━━━━━━━━━

📱 Check phone ${validatedPhone} for M-Pesa prompt

> © ISCE-BOT DATA SOLUTIONS`
            }, { quoted: message });

            monitorPayment(
                session.checkoutId,
                session,
                client,
                message,
                handlePaymentSuccess,
                handlePaymentFailure
            );
        } else {
            throw new Error(result.message || "Payment request failed");
        }

    } catch (error) {
        console.error("Payment initiation error:", error);
        let errorMsg = error.message || "Unable to process payment";
        if (error.response?.data?.message) {
            errorMsg = error.response.data.message;
        }
        await client.sendMessage(session.dest, {
            text: `❌ *PAYMENT FAILED*

${errorMsg}

Please try again with .buydata`
        }, { quoted: message });
    }
}

async function handlePaymentSuccess(session, client, message) {
    try {
        let formattedDate = "";
        if (session.transactionDate) {
            const dateStr = session.transactionDate.toString();
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            const hour = dateStr.substring(8, 10);
            const minute = dateStr.substring(10, 12);
            formattedDate = `${day}/${month}/${year} ${hour}:${minute}`;
        }

        const confirmationMessage = `✅ *PAYMENT SUCCESSFUL!*
━━━━━━━━━━━━━━━━━━━━━━━━
🔖 Checkout ID: ${session.checkoutId}
${session.mpesaReceiptNumber ? `💳 M-Pesa Code: ${session.mpesaReceiptNumber}\n` : ''}💰 Amount: Ksh ${session.amount}
📱 Paid by: ${session.payingPhone}
📲 Data to: ${session.receivingPhone}
📦 Bundle: ${session.selectedBundle.name}
${formattedDate ? `📅 Date: ${formattedDate}\n` : ''}━━━━━━━━━━━━━━━━━━━━━━━━

🎉 Your data bundle will be sent shortly!

*ISCE-BOT DATA SOLUTIONS*
_Cash in, Connect Out!_ 💙`;

        await client.sendMessage(session.dest, {
            text: confirmationMessage,
            contextInfo: XMD.getContextInfo()
        }, { quoted: message });

    } catch (error) {
        console.error("Success message error:", error);
    }
}

async function handlePaymentFailure(session, client, message, reason) {
    try {
        const errorMessage = `❌ *PAYMENT FAILED*
━━━━━━━━━━━━━━━━━━━━━━━━
${session.checkoutId ? `🔖 Checkout ID: ${session.checkoutId}\n` : ''}📱 Phone: ${session.phone || "Unknown"}
💰 Amount: Ksh ${session.amount}
━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ *Reason:* ${reason}

🔧 *Please ensure:*
• Safaricom number only
• Sufficient M-Pesa balance
• Correct phone format (07xxx or 01xxx)

💡 *Try again:* .buydata`;

        await client.sendMessage(session.dest, {
            text: errorMessage,
            contextInfo: XMD.getContextInfo()
        }, { quoted: message });

    } catch (error) {
        console.error("Failure message error:", error);
    }
}

bwmxmd({
    pattern: "pay",
    aliases: ["mpesa", "stk"],
    category: "Payment",
    react: "💳",
    description: "Direct M-Pesa STK push payment"
}, async (from, client, conText) => {
    const { mek, pushName, reply, q } = conText;

    if (!q) {
        return reply(`💳 *ISCE-BOT DIRECT PAYMENT*

Usage: .pay <amount>
Example: .pay 100

This will send an M-Pesa STK push to your phone.`);
    }

    const amount = parseInt(q.trim());
    if (isNaN(amount) || amount < 1) {
        return reply("❌ Invalid amount. Example: .pay 100");
    }

    const phonePrompt = `💳 *DIRECT PAYMENT*

💰 *Amount:* Ksh ${amount}

📞 *Reply this message with your M-Pesa phone number*

📱 Format: 07xxxxxxxx or 01xxxxxxxx`;

    const sentMessage = await client.sendMessage(from, {
        text: phonePrompt,
        contextInfo: XMD.getContextInfo()
    }, { quoted: mek });

    const session = {
        dest: from,
        amount: amount,
        status: "waiting_direct_phone",
        createdAt: Date.now()
    };

    paymentSessions.set(sentMessage.key.id, session);

    const handleDirectReply = async (update) => {
        const message = update.messages[0];
        if (!message?.message) return;

        const quotedStanzaId = message.message.extendedTextMessage?.contextInfo?.stanzaId;
        if (quotedStanzaId !== sentMessage.key.id) return;

        const sess = paymentSessions.get(quotedStanzaId);
        if (!sess || sess.status !== "waiting_direct_phone") return;

        const responseText = message.message.extendedTextMessage?.text?.trim() || 
                           message.message.conversation?.trim();
        if (!responseText) return;

        const validatedPhone = validatePhoneNumber(responseText);
        if (!validatedPhone) {
            return await client.sendMessage(sess.dest, {
                text: "❌ Invalid phone format!\n\n📱 Reply with: 07xxxxxxxx or 01xxxxxxxx"
            }, { quoted: message });
        }

        sess.phone = validatedPhone;
        sess.receivingPhone = validatedPhone;
        sess.payingPhone = validatedPhone;
        paymentSessions.delete(quotedStanzaId);
        client.ev.off("messages.upsert", handleDirectReply);

        await client.sendMessage(sess.dest, {
            text: `⏳ *SENDING STK PUSH...*

📱 Phone: ${validatedPhone}
💰 Amount: Ksh ${sess.amount}

🔔 Check your phone for M-Pesa prompt!`
        }, { quoted: message });

        try {
            const response = await axios.get(`${BASE_API_URL}/mpesa/pay`, {
                params: {
                    payingPhone: validatedPhone,
                    receivingPhone: validatedPhone,
                    amount: sess.amount.toString()
                },
                timeout: 30000
            });

            const result = response.data;

            if (result.success && result.data && result.data.CheckoutRequestID) {
                sess.checkoutId = result.data.CheckoutRequestID;
                sess.status = "stk_sent";
                
                await client.sendMessage(sess.dest, {
                    text: `📲 *M-Pesa Request Sent!*

🔖 Checkout ID: ${sess.checkoutId}
📱 Phone: ${validatedPhone}
💰 Amount: Ksh ${sess.amount}

⏳ Enter your M-Pesa PIN...`
                }, { quoted: message });

                monitorPayment(
                    sess.checkoutId,
                    sess,
                    client,
                    message,
                    handleDirectPaymentSuccess,
                    handleDirectPaymentFailure
                );
            } else {
                throw new Error(result.message || "Failed to initiate payment");
            }
        } catch (error) {
            let errorMsg = error.message || "Unable to process";
            if (error.response?.data?.message) {
                errorMsg = error.response.data.message;
            }
            await client.sendMessage(sess.dest, {
                text: `❌ *PAYMENT FAILED*\n\n${errorMsg}\n\nTry again: .pay ${sess.amount}`
            }, { quoted: message });
        }
    };

    client.ev.on("messages.upsert", handleDirectReply);

    setTimeout(() => {
        client.ev.off("messages.upsert", handleDirectReply);
        paymentSessions.delete(sentMessage.key.id);
    }, 10 * 60 * 1000);
});

async function handleDirectPaymentSuccess(session, client, message) {
    let formattedDate = "";
    if (session.transactionDate) {
        const dateStr = session.transactionDate.toString();
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        const hour = dateStr.substring(8, 10);
        const minute = dateStr.substring(10, 12);
        formattedDate = `${day}/${month}/${year} ${hour}:${minute}`;
    }

    const confirmationMessage = `✅ *PAYMENT SUCCESSFUL!*
━━━━━━━━━━━━━━━━━━━━━━━━
🔖 Checkout ID: ${session.checkoutId}
${session.mpesaReceiptNumber ? `💳 M-Pesa Code: ${session.mpesaReceiptNumber}\n` : ''}📱 Phone: ${session.phone}
💰 Amount: Ksh ${session.amount}
${formattedDate ? `📅 Date: ${formattedDate}\n` : ''}━━━━━━━━━━━━━━━━━━━━━━━━

🎉 Thank you for your payment!

*ISCE-BOT*`;

    await client.sendMessage(session.dest, {
        text: confirmationMessage,
        contextInfo: XMD.getContextInfo()
    }, { quoted: message });
}

async function handleDirectPaymentFailure(session, client, message, reason) {
    const errorMessage = `❌ *PAYMENT FAILED*

${session.checkoutId ? `🔖 Checkout ID: ${session.checkoutId}\n` : ''}📱 Phone: ${session.phone || "Unknown"}
💰 Amount: Ksh ${session.amount}

⚠️ *Reason:* ${reason}

💡 Try again: .pay ${session.amount}`;

    await client.sendMessage(session.dest, {
        text: errorMessage,
        contextInfo: XMD.getContextInfo()
    }, { quoted: message });
}
