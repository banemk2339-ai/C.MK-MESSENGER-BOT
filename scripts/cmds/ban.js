module.exports = {
  config: {
    name: "ban",
    aliases: ["unban"],
    version: "2.1",
    author: "Charles MK",
    countDown: 5,
    role: 2,
    description: "Ban/Unban users from using the bot",
    category: "admin",
    guide: {
      en: "{pn} @user - Ban/unban tagged user\n" +
          "{pn} (reply) - Ban/unban replied user\n" +
          "{pn} [uid] - Ban/unban by UID\n" +
          "{pn} list - View all banned users"
    }
  },

  onStart: async function ({ api, event, args, usersData, message }) {
    const { senderID, messageReply, mentions } = event;

    // ── List banned users ─────────────────────────────────────
    if (args[0] === "list") {
      const allUsers = await usersData.getAll();
      const bannedUsers = allUsers.filter(u => u.banned?.status === true);

      if (bannedUsers.length === 0) {
        return message.reply("✅ 𝖭𝗈 𝗎𝗌𝖾𝗋𝗌 𝖺𝗋𝖾 𝖼𝗎𝗋𝗋𝖾𝗇𝗍𝗅𝗒 𝖻𝖺𝗇𝗇𝖾𝖽");
      }

      let response = "🚫 𝗕𝗔𝗡𝗡𝗘𝗗 𝗨𝗦𝗘𝗥𝗦\n━━━━━━━━━━━━━━━━━━\n\n";
      for (const user of bannedUsers) {
        const name = await usersData.getName(user.userID);
        response += `👤 ${name}\n   𝖴𝖨𝖣: ${user.userID}\n\n`;
      }
      response += `━━━━━━━━━━━━━━━━━━\n📊 𝖳𝗈𝗍𝖺𝗅: ${bannedUsers.length} 𝗎𝗌𝖾𝗋(𝗌)`;

      return message.reply(response);
    }

    // ── Determine target ──────────────────────────────────────
    let targetID = null;

    if (messageReply) {
      targetID = messageReply.senderID;
    } else if (Object.keys(mentions).length > 0) {
      targetID = Object.keys(mentions)[0];
    } else if (args[0] && /^\d+$/.test(args[0])) {
      targetID = args[0];
    }

    if (!targetID) {
      return message.reply(
        "❌ 𝖯𝗅𝖾𝖺𝗌𝖾 𝗌𝗉𝖾𝖼𝗂𝖿𝗒 𝖺 𝗎𝗌𝖾𝗋\n\n" +
        "𝖴𝗌𝖺𝗀𝖾:\n" +
        "• +ban @user\n" +
        "• +ban (reply)\n" +
        "• +ban [uid]\n" +
        "• +ban list"
      );
    }

    // ── Safety checks ─────────────────────────────────────────
    const adminBot = global.GoatBot?.config?.adminBot || [];

    if (targetID === senderID) {
      return message.reply("❌ 𝖸𝗈𝗎 𝖼𝖺𝗇'𝗍 𝖻𝖺𝗇 𝗒𝗈𝗎𝗋𝗌𝖾𝗅𝖿!");
    }
    if (adminBot.includes(targetID)) {
      return message.reply("❌ 𝖸𝗈𝗎 𝖼𝖺𝗇'𝗍 𝖻𝖺𝗇 𝖺𝗇𝗈𝗍𝗁𝖾𝗋 𝖻𝗈𝗍 𝖺𝖽𝗆𝗂𝗇!");
    }

    try {
      const targetData = await usersData.get(targetID);
      const targetName = await usersData.getName(targetID);
      const isBanned = targetData?.banned?.status === true;

      if (isBanned) {
        // ── Unban: set banned = false ─────────────────────────
        await usersData.set(targetID, {
          ...targetData,
          banned: { status: false }
        });

        return message.reply(
          `✅ 𝗨𝗡𝗕𝗔𝗡𝗡𝗘𝗗\n` +
          `━━━━━━━━━━━━━━━━━━\n\n` +
          `👤 ${targetName}\n` +
          `🆔 ${targetID}\n\n` +
          `💚 𝖴𝗌𝖾𝗋 𝖼𝖺𝗇 𝗇𝗈𝗐 𝗎𝗌𝖾 𝗍𝗁𝖾 𝖻𝗈𝗍 𝖺𝗀𝖺𝗂𝗇`
        );
      } else {
        // ── Ban: set banned = true ────────────────────────────
        await usersData.set(targetID, {
          ...targetData,
          banned: {
            status: true,
            reason: "Banned by admin",
            date: new Date().toLocaleString()
          }
        });

        return message.reply(
          `🚫 𝗕𝗔𝗡𝗡𝗘𝗗\n` +
          `━━━━━━━━━━━━━━━━━━\n\n` +
          `👤 ${targetName}\n` +
          `🆔 ${targetID}\n\n` +
          `🔒 𝖴𝗌𝖾𝗋 𝗂𝗌 𝗇𝗈𝗐 𝖻𝖺𝗇𝗇𝖾𝖽 𝖿𝗋𝗈𝗆 𝗎𝗌𝗂𝗇𝗀 𝗍𝗁𝖾 𝖻𝗈𝗍`
        );
      }

    } catch (error) {
      console.error("Ban command error:", error);
      return message.reply(
        "❌ 𝖠𝗇 𝖾𝗋𝗋𝗈𝗋 𝗈𝖼𝖼𝗎𝗋𝗋𝖾𝖽\n\n" +
        `𝖤𝗋𝗋𝗈𝗋: ${error.message}`
      );
    }
  }
};
