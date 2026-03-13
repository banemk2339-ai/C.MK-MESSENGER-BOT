const slotUsage = new Map();

module.exports = {
  config: {
    name: "slot",
    aliases: ["slots"],
    version: "2.0",
    author: "CharlesMK",
    countDown: 30,
    role: 0,
    description: {
      en: "Spin the slot machine and win money! (10 spins per hour)"
    },
    category: "game",
    guide: {
      en: "{pn} <amount>\nExample: {pn} 50\n\n⏰ Limit: 10 spins per hour"
    }
  },

  onStart: async function ({ args, message, event, usersData }) {
    const { senderID } = event;

    // Format balance — handles numbers of any size cleanly
    function formatBalance(num) {
      const abs = Math.abs(num);
      const sign = num < 0 ? "-" : "";
      const tiers = [
        [1e24, "septillion"],
        [1e21, "sextillion"],
        [1e18, "quintillion"],
        [1e15, "quadrillion"],
        [1e12, "trillion"],
        [1e9,  "billion"],
        [1e6,  "M"],
      ];
      for (const [val, suffix] of tiers) {
        if (abs >= val) {
          const divided = abs / val;
          const formatted = Number.isInteger(divided)
            ? divided.toString()
            : parseFloat(divided.toFixed(2)).toString();
          const sep = suffix.length <= 2 ? "" : " ";
          return `${sign}$${formatted}${sep}${suffix}`;
        }
      }
      return `${sign}$${abs.toLocaleString()}`;
    }

    // Check if user wants to see their remaining spins
    if (args[0] && args[0].toLowerCase() === "status") {
      const usage = slotUsage.get(senderID);

      if (!usage || usage.spins < 10) {
        const spinsLeft = usage ? 10 - usage.spins : 10;
        return message.reply(
          `🎰 SLOT STATUS\n\n` +
          `🎮 Spins remaining: ${spinsLeft}/10\n` +
          `✅ Ready to play!`
        );
      }

      const now = Date.now();
      const timeLeft = usage.resetTime - now;

      if (timeLeft <= 0) {
        slotUsage.delete(senderID);
        return message.reply(
          `🎰 SLOT STATUS\n\n` +
          `🎮 Spins remaining: 10/10\n` +
          `✅ Your spins have been reset!`
        );
      }

      const minutes = Math.floor(timeLeft / 60000);
      const seconds = Math.floor((timeLeft % 60000) / 1000);

      return message.reply(
        `🎰 SLOT STATUS\n\n` +
        `🎮 Spins used: 10/10\n` +
        `⏰ Cooldown: ${minutes}m ${seconds}s\n\n` +
        `Come back later to spin again!`
      );
    }

    const spinAmount = parseInt(args[0]);
    if (!spinAmount || spinAmount <= 0) {
      return message.reply("❌ Please enter a valid amount.\nExample: +slot 50\n\nCheck status: +slot status");
    }

    // Get or initialize user's slot usage
    const now = Date.now();
    let usage = slotUsage.get(senderID);

    // Reset if cooldown period has passed
    if (usage && now >= usage.resetTime) {
      slotUsage.delete(senderID);
      usage = null;
    }

    // Initialize usage if not exists
    if (!usage) {
      usage = {
        spins: 0,
        resetTime: now + 3600000 // 1 hour from now
      };
      slotUsage.set(senderID, usage);
    }

    // Check if user has exceeded spin limit
    if (usage.spins >= 10) {
      const timeLeft = usage.resetTime - now;
      const minutes = Math.floor(timeLeft / 60000);
      const seconds = Math.floor((timeLeft % 60000) / 1000);

      return message.reply(
        `⏰ SLOT COOLDOWN\n\n` +
        `You've used all 10 spins! 🎰\n\n` +
        `⏳ Time remaining: ${minutes}m ${seconds}s\n\n` +
        `Come back later to play again!\n` +
        `Check status anytime: +slot status`
      );
    }

    const userData = await usersData.get(senderID);
    const balance = userData.money || 0;

    if (spinAmount > balance) {
      return message.reply(
        `❌ You don't have enough money to spin $${spinAmount}.\n💰 Your balance: ${formatBalance(balance)}`
      );
    }

    const slots = ["🍒", "🍋", "🍉", "💎", "7️⃣"];
    const spin = () => slots[Math.floor(Math.random() * slots.length)];

    const reel1 = spin();
    const reel2 = spin();
    const reel3 = spin();

    // Box display for reels
    const reelDisplay =
      `🎰 SLOT MACHINE\n\n` +
      `┌───────────────┐\n` +
      `│  ${reel1}  |  ${reel2}  |  ${reel3}  │\n` +
      `└───────────────┘`;

    const chance = Math.random();
    let reward = 0;
    let resultText = "";

    if (chance < 0.1) {
      // JACKPOT 10% - 6x multiplier
      reward = spinAmount * 6;
      resultText =
        `${reelDisplay}\n\n` +
        `🎉 𝙅𝘼𝘾𝙆𝙋𝙊𝙏 𝙒𝙄𝙉 🎉\n` +
        `+$${reward}`;
    } else if (chance < 0.6) {
      // NORMAL WIN 50% - 2x multiplier
      reward = spinAmount * 2;
      resultText =
        `${reelDisplay}\n\n` +
        `✨ 𝙔𝙊𝙐 𝙒𝙊𝙉!\n` +
        `+$${reward}`;
    } else {
      // LOSS 40%
      reward = -spinAmount;
      resultText =
        `${reelDisplay}\n\n` +
        `💸 𝙔𝙊𝙐 𝙇𝙊𝙎𝙏\n` +
        `-$${spinAmount}`;
    }

    const newBalance = balance + reward;

    // Increment spin count
    usage.spins += 1;
    slotUsage.set(senderID, usage);

    const spinsLeft = 10 - usage.spins;

    await usersData.set(senderID, {
      money: newBalance,
      exp: userData.exp,
      data: userData.data
    });

    const spinInfo = spinsLeft > 0
      ? `🎮 𝗦𝗽𝗶𝗻𝘀: ${spinsLeft}/10`
      : `⏰ 𝗡𝗼 𝘀𝗽𝗶𝗻𝘀 𝗹𝗲𝗳𝘁! Cooldown: 1 hour`;

    return message.reply(
      `${resultText}\n\n` +
      `💰 𝗕𝗔𝗟𝗔𝗡𝗖𝗘: ${formatBalance(newBalance)}\n` +
      `${spinInfo}`
    );
  }
};
