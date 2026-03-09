module.exports = {
  config: {
    name: "give",
    aliases: ["pay", "transfer"],
    version: "1.1",
    author: "Charles MK",
    countDown: 5,
    role: 0,
    category: "economy",
    guide: {
      en: "{pn} [amount] (reply or tag/uid)"
    }
  },

  onStart: async function ({ api, event, args, usersData, message }) {
    const { senderID, messageReply, mentions } = event;

    // 1. Determine Target User and Amount
    let targetID;
    let amountStr;

    if (messageReply) {
      targetID = messageReply.senderID;
      amountStr = args[0];
    } else if (Object.keys(mentions).length > 0) {
      targetID = Object.keys(mentions)[0];
      amountStr = args.find(arg => !isNaN(parseInt(arg)) && parseInt(arg) > 0);
    } else if (args.length >= 2) {
      targetID = args[0];
      amountStr = args[1];
    }

    const amount = parseInt(amountStr);

    // 2. Validation Checks
    if (!targetID || isNaN(amount) || amount <= 0) {
      return message.reply("⚠️ 𝖯𝗅𝖾𝖺𝗌𝖾 𝖾𝗇𝗍𝖾𝗋 𝖺 𝗏𝖺𝗅𝗂𝖽 𝖺𝗆𝗈𝗎𝗇𝗍 𝖺𝗇𝖽 𝗌𝗉𝖾𝖼𝗂𝖿𝗒 𝖺 𝗎𝗌𝖾𝗋 (𝗋𝖾𝗉𝗅𝗒, 𝗍𝖺𝗀, 𝗈𝗋 𝖴𝖨𝖣).");
    }

    if (targetID == senderID) {
      return message.reply("🤡 𝖸𝗈𝗎 𝖼𝖺𝗇'𝗍 𝗀𝗂𝗏𝖾 𝗆𝗈𝗇𝖾𝗒 𝗍𝗈 𝗒𝗈𝗎𝗋𝗌𝖾𝗅𝖿, 𝗇𝗂𝖼𝖾 𝗍𝗋𝗒.");
    }

    const senderData = await usersData.get(senderID);
    const receiverData = await usersData.get(targetID);

    if (!receiverData) {
      return message.reply("❌ 𝖴𝗌𝖾𝗋 𝗇𝗈𝗍 𝖿𝗈𝗎𝗇𝖽 𝗂𝗇 𝗍𝗁𝖾 𝖽𝖺𝗍𝖺𝖻𝖺𝗌𝖾.");
    }

    // 3. Fee Calculation
    const fee = Math.floor(amount * 0.06);       // 6% fee deducted from sender
    const totalDeducted = amount + fee;           // Sender loses amount + fee
    const receiverGets = amount;                  // Receiver gets the full amount

    if (senderData.money < totalDeducted) {
      return message.reply(
        `💸 𝖸𝗈𝗎 𝖼𝖺𝗇'𝗍 𝖺𝖿𝖿𝗈𝗋𝖽 𝗍𝗁𝗂𝗌 𝗍𝗋𝖺𝗇𝗌𝖿𝖾𝗋!\n` +
        `💰 𝖠𝗆𝗈𝗎𝗇𝗍: $${amount.toLocaleString()}\n` +
        `🏦 𝖥𝖾𝖾 (6%): $${fee.toLocaleString()}\n` +
        `📊 𝖳𝗈𝗍𝖺𝗅 𝖭𝖾𝖾𝖽𝖾𝖽: $${totalDeducted.toLocaleString()}\n` +
        `💳 𝖸𝗈𝗎𝗋 𝖡𝖺𝗅𝖺𝗇𝖼𝖾: $${senderData.money.toLocaleString()}`
      );
    }

    // 4. Apply Transaction
    const finalSenderMoney = senderData.money - totalDeducted;
    const finalReceiverMoney = (receiverData.money || 0) + receiverGets;

    await usersData.set(targetID, { money: finalReceiverMoney });
    await usersData.set(senderID, { money: finalSenderMoney });

    // 5. Send Success Message
    const senderName = senderData.name;
    const receiverName = receiverData.name;

    return api.sendMessage(
      `💸 𝗧𝗥𝗔𝗡𝗦𝗙𝗘𝗥 𝗦𝗨𝗖𝗖𝗘𝗦𝗦𝗙𝗨𝗟\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `👤 𝖥𝗋𝗈𝗆: ${senderName}\n` +
      `👤 𝖳𝗈: ${receiverName}\n` +
      `💰 𝖠𝗆𝗈𝗎𝗇𝗍 𝖲𝖾𝗇𝗍: $${receiverGets.toLocaleString()}\n` +
      `🏦 𝖳𝗋𝖺𝗇𝗌𝖿𝖾𝗋 𝖥𝖾𝖾 (6%): -$${fee.toLocaleString()}\n` +
      `📊 𝖳𝗈𝗍𝖺𝗅 𝖣𝖾𝖽𝗎𝖼𝗍𝖾𝖽: $${totalDeducted.toLocaleString()}\n` +
      `💳 𝖸𝗈𝗎𝗋 𝖭𝖾𝗐 𝖡𝖺𝗅𝖺𝗇𝖼𝖾: $${finalSenderMoney.toLocaleString()}\n` +
      `━━━━━━━━━━━━━━━━━━`,
      event.threadID,
      event.messageID
    );
  }
};
