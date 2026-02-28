// ═══════════════════════════════════════════════════════════════
//   diamonds.js  —  Diamond economy for the Pet System
//
//   💎 1 diamond = $1,000,000,000,000 (1 trillion)
//   Diamonds are the exclusive currency for buying pets.
//
//   Commands:
//     +diamonds                  — Check your diamond balance
//     +diamonds convert <amount> — Convert money to diamonds
//     +diamonds give @tag <amt>  — Give diamonds to someone
//     +diamonds top              — Diamond leaderboard
// ═══════════════════════════════════════════════════════════════

const DIAMOND_RATE = 1_000_000_000_000; // $1 trillion = 1 diamond

// Format large numbers cleanly
function formatMoney(n) {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function formatDiamonds(n) {
  return Number.isInteger(n) ? `${n}` : n.toFixed(4).replace(/\.?0+$/, "");
}

module.exports = {
  config: {
    name: "diamonds",
    aliases: ["diamond", "gem", "gems"],
    version: "1.0",
    author: "Charles MK",
    countDown: 5,
    role: 0,
    shortDescription: { en: "💎 Diamond economy for the pet system" },
    category: "pets",
    guide: {
      en:
        "{pn}                    — Check your diamond balance\n" +
        "{pn} convert <amount>   — Convert money → diamonds\n" +
        "                          (min: $1T per diamond)\n" +
        "{pn} give @tag <amount> — Give diamonds to someone\n" +
        "{pn} top                — Diamond leaderboard (top 10)",
    },
  },

  onStart: async function ({ event, message, args, usersData }) {
    const senderID  = event.senderID;
    const subcmd    = (args[0] || "").toLowerCase();
    const userData  = await usersData.get(senderID);
    const data      = userData.data || {};
    const diamonds  = data.petDiamonds || 0;

    // ── No subcommand → show balance ───────────────────────
    if (!subcmd || subcmd === "balance" || subcmd === "bal") {
      const money = userData.money || 0;
      return message.reply(
        `💎 𝗗𝗜𝗔𝗠𝗢𝗡𝗗 𝗕𝗔𝗟𝗔𝗡𝗖𝗘\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💎 Diamonds:  ${formatDiamonds(diamonds)}\n` +
        `💵 Money:     ${formatMoney(money)}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📌 Rate: $1,000,000,000,000 = 1 💎\n` +
        `💡 Use: +diamonds convert <amount>`
      );
    }

    // ── convert <amount> ───────────────────────────────────
    if (subcmd === "convert") {
      const input = args[1];
      if (!input) {
        return message.reply(
          `❌ Specify an amount.\n` +
          `Example: +diamonds convert 5000000000000\n` +
          `         +diamonds convert 5T\n\n` +
          `📌 Minimum: $1,000,000,000,000 (1T) per diamond`
        );
      }

      // Parse shorthand like 5T, 2.5T, 1000B
      let amount = parseShorthand(input);
      if (!amount || isNaN(amount) || amount <= 0) {
        return message.reply(
          `❌ Invalid amount.\n` +
          `Use a number or shorthand: 5T, 2.5T, 500B`
        );
      }

      const money = userData.money || 0;
      if (amount > money) {
        return message.reply(
          `❌ Not enough money.\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `💵 Your money:  ${formatMoney(money)}\n` +
          `💸 You need:    ${formatMoney(amount)}`
        );
      }

      if (amount < DIAMOND_RATE) {
        return message.reply(
          `❌ Minimum conversion is $1,000,000,000,000 (1T).\n` +
          `You provided: ${formatMoney(amount)}`
        );
      }

      const diamondsEarned = amount / DIAMOND_RATE;
      const remainder      = amount % DIAMOND_RATE;
      const actualSpent    = amount - remainder; // Only spend whole-diamond amounts
      const actualDiamonds = actualSpent / DIAMOND_RATE;

      if (actualDiamonds <= 0) {
        return message.reply(
          `❌ Amount is less than 1 diamond.\n` +
          `You need at least $1,000,000,000,000 (1T).`
        );
      }

      // Deduct money, add diamonds
      const newMoney    = money - actualSpent;
      const newDiamonds = diamonds + actualDiamonds;

      await usersData.set(senderID, {
        ...userData,
        money: newMoney,
        data:  { ...data, petDiamonds: newDiamonds },
      });

      return message.reply(
        `✅ 𝗖𝗢𝗡𝗩𝗘𝗥𝗦𝗜𝗢𝗡 𝗦𝗨𝗖𝗖𝗘𝗦𝗦𝗙𝗨𝗟\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💸 Spent:     ${formatMoney(actualSpent)}\n` +
        `💎 Received:  +${formatDiamonds(actualDiamonds)} diamond${actualDiamonds !== 1 ? "s" : ""}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💎 New balance: ${formatDiamonds(newDiamonds)} diamonds\n` +
        `💵 Remaining:   ${formatMoney(newMoney)}`
      );
    }

    // ── give @tag <amount> ─────────────────────────────────
    if (subcmd === "give") {
      const mentionIDs = Object.keys(event.mentions || {});
      if (!mentionIDs.length) {
        return message.reply(
          `❌ Tag someone to give diamonds to.\n` +
          `Example: +diamonds give @user 2`
        );
      }

      const targetID   = mentionIDs[0];
      const amountArg  = args[2] || args[1];
      const giveAmount = parseFloat(amountArg);

      if (!giveAmount || isNaN(giveAmount) || giveAmount <= 0) {
        return message.reply(`❌ Invalid amount. Example: +diamonds give @user 2`);
      }
      if (giveAmount > diamonds) {
        return message.reply(
          `❌ You don't have enough diamonds.\n` +
          `💎 Your balance: ${formatDiamonds(diamonds)}`
        );
      }
      if (targetID === senderID) {
        return message.reply(`❌ You can't give diamonds to yourself.`);
      }

      const targetData     = await usersData.get(targetID);
      const targetDiamonds = (targetData.data?.petDiamonds || 0) + giveAmount;
      const newSenderDiamonds = diamonds - giveAmount;

      await usersData.set(senderID, {
        ...userData,
        data: { ...data, petDiamonds: newSenderDiamonds },
      });
      await usersData.set(targetID, {
        ...targetData,
        data: { ...(targetData.data || {}), petDiamonds: targetDiamonds },
      });

      const targetName = targetData.name || "that user";
      const senderName = userData.name   || "Someone";

      return message.reply(
        `✅ 𝗗𝗜𝗔𝗠𝗢𝗡𝗗𝗦 𝗦𝗘𝗡𝗧\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💎 Sent:  ${formatDiamonds(giveAmount)} to ${targetName}\n` +
        `💎 Your new balance: ${formatDiamonds(newSenderDiamonds)}`
      );
    }

    // ── top — leaderboard ──────────────────────────────────
    if (subcmd === "top" || subcmd === "leaderboard" || subcmd === "lb") {
      const allUsers = await usersData.getAll();
      const ranked   = Object.entries(allUsers)
        .map(([id, u]) => ({
          id,
          name:     u.name || "Unknown",
          diamonds: u.data?.petDiamonds || 0,
        }))
        .filter(u => u.diamonds > 0)
        .sort((a, b) => b.diamonds - a.diamonds)
        .slice(0, 10);

      if (!ranked.length) {
        return message.reply("💎 No one has diamonds yet!\nUse +diamonds convert to get started.");
      }

      const medals = ["🥇", "🥈", "🥉"];
      const lines  = ranked.map((u, i) =>
        `${medals[i] || `${i + 1}.`} ${u.name}: 💎 ${formatDiamonds(u.diamonds)}`
      ).join("\n");

      return message.reply(
        `💎 𝗗𝗜𝗔𝗠𝗢𝗡𝗗 𝗟𝗘𝗔𝗗𝗘𝗥𝗕𝗢𝗔𝗥𝗗\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${lines}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 Use +diamonds convert to earn more!`
      );
    }

    // ── Unknown subcommand ─────────────────────────────────
    return message.reply(
      `❓ Unknown command.\n` +
      `Use: +diamonds, +diamonds convert <amount>,\n` +
      `     +diamonds give @tag <amount>, +diamonds top`
    );
  },
};

// ── Parse shorthand amounts like 5T, 2.5T, 500B, 1000M ────────
function parseShorthand(input) {
  if (!input) return null;
  const str = input.toString().trim().toUpperCase();
  const match = str.match(/^([\d.]+)(T|B|M|K)?$/);
  if (!match) return null;
  const num    = parseFloat(match[1]);
  const suffix = match[2];
  if (isNaN(num)) return null;
  switch (suffix) {
    case "T":  return num * 1e12;
    case "B":  return num * 1e9;
    case "M":  return num * 1e6;
    case "K":  return num * 1e3;
    default:   return num;
  }
}
