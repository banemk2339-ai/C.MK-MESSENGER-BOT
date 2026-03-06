const wheelUsage = new Map();

module.exports = {
  config: {
    name: "wheel",
    aliases: ["spin", "spinwheel"],
    version: "1.3",
    author: "CharlesMK",
    countDown: 40,
    role: 0,
    description: {
      en: "Spin the prize wheel and win money! (10 spins per hour)"
    },
    category: "game",
    guide: {
      en: "{pn} <amount>\nExample: {pn} 100\n\nCheck status: {pn} status"
    }
  },

  onStart: async function ({ args, message, event, usersData, api }) {
    const { senderID } = event;

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

    function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ── Status check ──────────────────────────────────────────
    if (args[0] && args[0].toLowerCase() === "status") {
      const usage = wheelUsage.get(senderID);

      if (!usage || usage.spins < 10) {
        const spinsLeft = usage ? 10 - usage.spins : 10;
        return message.reply(
          `🎡 𝗪𝗛𝗘𝗘𝗟 𝗦𝗧𝗔𝗧𝗨𝗦\n\n` +
          `🎮 Spins remaining: ${spinsLeft}/10\n` +
          `✅ Ready to spin!`
        );
      }

      const now = Date.now();
      const timeLeft = usage.resetTime - now;

      if (timeLeft <= 0) {
        wheelUsage.delete(senderID);
        return message.reply(
          `🎡 𝗪𝗛𝗘𝗘𝗟 𝗦𝗧𝗔𝗧𝗨𝗦\n\n` +
          `🎮 Spins remaining: 10/10\n` +
          `✅ Your spins have been reset!`
        );
      }

      const minutes = Math.floor(timeLeft / 60000);
      const seconds = Math.floor((timeLeft % 60000) / 1000);

      return message.reply(
        `🎡 𝗪𝗛𝗘𝗘𝗟 𝗦𝗧𝗔𝗧𝗨𝗦\n\n` +
        `🎮 Spins used: 10/10\n` +
        `⏰ Cooldown: ${minutes}m ${seconds}s\n\n` +
        `Come back later to spin again!`
      );
    }

    // ── Validate bet ──────────────────────────────────────────
    const spinAmount = parseInt(args[0]);
    if (!spinAmount || spinAmount <= 0) {
      return message.reply(
        `❌ Please enter a valid amount.\n` +
        `Example: +wheel 100\n\n` +
        `Check status: +wheel status`
      );
    }

    // ── Cooldown logic ────────────────────────────────────────
    const now = Date.now();
    let usage = wheelUsage.get(senderID);

    if (usage && now >= usage.resetTime) {
      wheelUsage.delete(senderID);
      usage = null;
    }

    if (!usage) {
      usage = { spins: 0, resetTime: now + 3600000 };
      wheelUsage.set(senderID, usage);
    }

    if (usage.spins >= 10) {
      const timeLeft = usage.resetTime - now;
      const minutes = Math.floor(timeLeft / 60000);
      const seconds = Math.floor((timeLeft % 60000) / 1000);
      return message.reply(
        `⏰ 𝗪𝗛𝗘𝗘𝗟 𝗖𝗢𝗢𝗟𝗗𝗢𝗪𝗡\n\n` +
        `You've used all 10 spins! 🎡\n\n` +
        `⏳ Time remaining: ${minutes}m ${seconds}s\n\n` +
        `Come back later to spin again!\n` +
        `Check status: +wheel status`
      );
    }

    // ── Balance check ─────────────────────────────────────────
    const userData = await usersData.get(senderID);
    const balance = userData.money || 0;

    if (spinAmount > balance) {
      return message.reply(
        `❌ Not enough money to bet $${spinAmount.toLocaleString()}.\n` +
        `💰 Your balance: ${formatBalance(balance)}`
      );
    }

    // ── Send initial message, then EDIT it for animation ──────
    const initialMsg = await message.reply(`🎡 𝗦𝗣𝗜𝗡𝗡𝗜𝗡𝗚 𝗧𝗛𝗘 𝗪𝗛𝗘𝗘𝗟\n\n🌀 The wheel is spinning .`);
    const msgID = initialMsg.messageID;

    // 3 edits then result — stays within Facebook's edit limit
    const animFrames = [
      `🎡 𝗦𝗣𝗜𝗡𝗡𝗜𝗡𝗚 𝗧𝗛𝗘 𝗪𝗛𝗘𝗘𝗟\n\n🌀 The wheel is spinning ..`,
      `🎡 𝗦𝗣𝗜𝗡𝗡𝗜𝗡𝗚 𝗧𝗛𝗘 𝗪𝗛𝗘𝗘𝗟\n\n🌀 The wheel is spinning ...`,
      `🎡 𝗦𝗣𝗜𝗡𝗡𝗜𝗡𝗚 𝗧𝗛𝗘 𝗪𝗛𝗘𝗘𝗟\n\n❓ Where will it land .`,
      `🎡 𝗦𝗣𝗜𝗡𝗡𝗜𝗡𝗚 𝗧𝗛𝗘 𝗪𝗛𝗘𝗘𝗟\n\n❓ Where will it land ..`,
    ];

    for (const frame of animFrames) {
      await sleep(800);
      try {
        await api.editMessage(frame, msgID);
      } catch (_) {
        await sleep(600);
        try { await api.editMessage(frame, msgID); } catch (_) {}
      }
    }


    // ── Wheel segments ────────────────────────────────────────
    const segments = [
      { label: "JACKPOT",   emoji: "💰", multiplier: 10,  weight: 2  },
      { label: "BIG WIN",   emoji: "🤑", multiplier: 5,   weight: 5  },
      { label: "WIN x3",    emoji: "🎉", multiplier: 3,   weight: 10 },
      { label: "WIN x2",    emoji: "✨", multiplier: 2,   weight: 18 },
      { label: "WIN x1.5",  emoji: "🙂", multiplier: 1.5, weight: 20 },
      { label: "LOSE",      emoji: "💸", multiplier: 0,   weight: 25 },
      { label: "LOSE x2",   emoji: "😬", multiplier: -1,  weight: 12 },
      { label: "BANKRUPT",  emoji: "💀", multiplier: -2,  weight: 3  },
      { label: "FREE SPIN", emoji: "🎁", multiplier: 0,   weight: 5, freeSpin: true },
    ];

    // Weighted random pick
    const totalWeight = segments.reduce((s, seg) => s + seg.weight, 0);
    let rand = Math.random() * totalWeight;
    let landed = segments[segments.length - 1];
    for (const seg of segments) {
      rand -= seg.weight;
      if (rand <= 0) { landed = seg; break; }
    }

    // ── Wheel display — no box, no padding, emoji-safe ──────────
    // Each segment on its own line. Landed one marked with ▶ ◀
    const segLines = segments.map(seg =>
      seg === landed
        ? `  ▶ ${seg.emoji} ${seg.label} ◀`
        : `      ${seg.emoji} ${seg.label}`
    );

    const wheelDisplay =
      `🎡 𝗦𝗣𝗜𝗡 𝗧𝗛𝗘 𝗪𝗛𝗘𝗘𝗟\n` +
      `══════════════════\n` +
      segLines.join("\n") + "\n" +
      `══════════════════`;

    // ── Calculate reward ──────────────────────────────────────
    let reward = 0;
    let resultLine = "";
    let bonusSpin = false;

    if (landed.freeSpin) {
      reward = 0;
      bonusSpin = true;
      resultLine = `🎁 𝙁𝙍𝙀𝙀 𝙎𝙋𝙄𝙉!\nThis spin doesn't count — go again!`;
    } else if (landed.multiplier === -2) {
      reward = -balance;
      resultLine = `💀 𝘽𝘼𝙉𝙆𝙍𝙐𝙋𝙏!!\nYou lost everything! -${formatBalance(balance)}`;
    } else if (landed.multiplier === -1) {
      reward = -(spinAmount * 2);
      resultLine = `😬 𝙇𝙊𝙎𝙀 ×𝟮\n-$${(spinAmount * 2).toLocaleString()}`;
    } else if (landed.multiplier === 0) {
      reward = -spinAmount;
      resultLine = `💸 𝙔𝙊𝙐 𝙇𝙊𝙎𝙏\n-$${spinAmount.toLocaleString()}`;
    } else {
      reward = Math.floor(spinAmount * landed.multiplier);
      const winLabel = landed.multiplier >= 10
        ? `🎉 𝙅𝘼𝘾𝙆𝙋𝙊𝙏 𝙒𝙄𝙉 🎉`
        : landed.multiplier >= 5
          ? `🤑 𝘽𝙄𝙂 𝙒𝙄𝙉!`
          : `✨ 𝙔𝙊𝙐 𝙒𝙊𝙉!`;
      resultLine = `${winLabel}\n+$${reward.toLocaleString()}`;
    }

    const newBalance = balance + reward;

    if (!bonusSpin) usage.spins += 1;
    wheelUsage.set(senderID, usage);
    const spinsLeft = 10 - usage.spins;

    await usersData.set(senderID, {
      money: Math.max(0, newBalance),
      exp: userData.exp,
      data: userData.data
    });

    const spinInfo = bonusSpin
      ? `🎁 Spin again! Spins: ${spinsLeft}/10`
      : spinsLeft > 0
        ? `🎮 𝗦𝗽𝗶𝗻𝘀: ${spinsLeft}/10`
        : `⏰ 𝗡𝗼 𝘀𝗽𝗶𝗻𝘀 𝗹𝗲𝗳𝘁! Cooldown: 1 hour`;

    // Edit the same message one final time with the result
    return api.editMessage(
      `${wheelDisplay}\n\n` +
      `${resultLine}\n\n` +
      `💰 𝗕𝗔𝗟𝗔𝗡𝗖𝗘: ${formatBalance(Math.max(0, newBalance))}\n` +
      `${spinInfo}`,
      msgID
    );
  }
};
