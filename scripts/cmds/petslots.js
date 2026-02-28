// ═══════════════════════════════════════════════════════════════
//   petslots.js  —  Expand your pet slots
//
//   Default: 10 slots
//   Maximum: 15 slots
//   Cost:    2💎 per additional slot
//
//   Commands:
//     +petslots            — View your current slots & expansion info
//     +petslots buy        — Buy one more slot (2💎)
//     +petslots buy <amt>  — Buy multiple slots at once
// ═══════════════════════════════════════════════════════════════

const DEFAULT_SLOTS  = 10;
const MAX_SLOTS      = 15;
const COST_PER_SLOT  = 2; // diamonds

let formatDiamonds;
try {
  formatDiamonds = require("./petshop").formatDiamonds;
} catch {
  formatDiamonds = (n) => Number.isInteger(n) ? `${n}` : n.toFixed(4).replace(/\.?0+$/, "");
}

function slotsBar(current, max) {
  const filled = Math.round((current / MAX_SLOTS) * 10);
  return `[${"█".repeat(filled)}${"░".repeat(10 - filled)}] ${current}/${MAX_SLOTS}`;
}

module.exports = {
  config: {
    name: "petslots",
    aliases: ["pslots", "expandpets", "petexpand"],
    version: "1.0",
    author: "Charles MK",
    countDown: 5,
    role: 0,
    shortDescription: { en: "🏠 Expand your pet slots (max 15)" },
    category: "pets",
    guide: {
      en:
        "{pn}             — View slot info\n" +
        "{pn} buy         — Buy 1 extra slot (💎2)\n" +
        "{pn} buy <amt>   — Buy multiple slots at once",
    },
  },

  onStart: async function ({ event, message, args, usersData }) {
    const senderID = event.senderID;
    const subcmd   = (args[0] || "").toLowerCase();
    const userData = await usersData.get(senderID);
    const data     = userData.data || {};
    const diamonds  = data.petDiamonds  || 0;
    const maxSlots  = data.petSlots     || DEFAULT_SLOTS;
    const pets      = data.pets         || [];
    const used      = pets.length;
    const free      = maxSlots - used;
    const canExpand = maxSlots < MAX_SLOTS;
    const slotsLeft = MAX_SLOTS - maxSlots;

    // ── View info ──────────────────────────────────────────
    if (!subcmd || subcmd === "info") {
      return message.reply(
        `🏠 𝗣𝗘𝗧 𝗦𝗟𝗢𝗧𝗦\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📊 Slots:   ${slotsBar(maxSlots, MAX_SLOTS)}\n` +
        `🐾 Used:    ${used}/${maxSlots}\n` +
        `📭 Free:    ${free}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        (canExpand
          ? `💡 Expand available!\n` +
            `  💎 Cost:       ${COST_PER_SLOT} per slot\n` +
            `  📦 Slots left: ${slotsLeft} more purchasable\n` +
            `  💎 Your gems:  ${formatDiamonds(diamonds)}\n` +
            `  💰 Max expand: ${Math.min(slotsLeft, Math.floor(diamonds / COST_PER_SLOT))} slots affordable\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `✅ +petslots buy        — Add 1 slot\n` +
            `✅ +petslots buy <amt>  — Add multiple`
          : `🔒 Maximum slots reached (${MAX_SLOTS})!\n` +
            `You've unlocked all available pet slots.`)
      );
    }

    // ── Buy slots ──────────────────────────────────────────
    if (subcmd === "buy") {
      if (!canExpand) {
        return message.reply(
          `🔒 You already have the maximum of ${MAX_SLOTS} pet slots!\n` +
          `No further expansion is possible.`
        );
      }

      // Parse amount (default 1)
      const rawAmt = parseInt(args[1]) || 1;
      const amount = Math.max(1, rawAmt);

      // Cap at what's actually available
      const maxBuyable = Math.min(amount, slotsLeft);
      if (maxBuyable < amount) {
        // Inform user we're capping
      }

      const totalCost = maxBuyable * COST_PER_SLOT;

      if (amount < 1 || isNaN(amount)) {
        return message.reply(`❌ Invalid amount. Example: +petslots buy 3`);
      }

      if (diamonds < totalCost) {
        const canAfford = Math.floor(diamonds / COST_PER_SLOT);
        return message.reply(
          `❌ Not enough diamonds.\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `  Buying ${maxBuyable} slot${maxBuyable > 1 ? "s" : ""}: 💎${totalCost}\n` +
          `  Your balance:         💎${formatDiamonds(diamonds)}\n` +
          (canAfford > 0
            ? `  You can afford:       ${canAfford} slot${canAfford > 1 ? "s" : ""}\n` +
              `  Try: +petslots buy ${canAfford}`
            : `  💡 Use +dailydiamond or +diamonds convert`)
        );
      }

      const newSlots    = Math.min(MAX_SLOTS, maxSlots + maxBuyable);
      const actualBought = newSlots - maxSlots;
      const actualCost   = actualBought * COST_PER_SLOT;
      const newDiamonds  = parseFloat((diamonds - actualCost).toFixed(4));

      await usersData.set(senderID, {
        ...userData,
        data: {
          ...data,
          petSlots:    newSlots,
          petDiamonds: newDiamonds,
        },
      });

      const atMax = newSlots >= MAX_SLOTS;
      return message.reply(
        `✅ 𝗦𝗟𝗢𝗧𝗦 𝗘𝗫𝗣𝗔𝗡𝗗𝗘𝗗!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🏠 Slots:   ${slotsBar(newSlots, MAX_SLOTS)}\n` +
        `📦 Added:   +${actualBought} slot${actualBought > 1 ? "s" : ""}\n` +
        `💎 Spent:   ${actualCost} diamonds\n` +
        `💎 Balance: ${formatDiamonds(newDiamonds)}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        (atMax
          ? `🔒 Maximum slots reached! No further expansion possible.`
          : `💡 ${MAX_SLOTS - newSlots} more slot${MAX_SLOTS - newSlots > 1 ? "s" : ""} available to unlock`)
      );
    }

    return message.reply(
      `❓ Unknown command.\n` +
      `Use +petslots or +petslots buy`
    );
  },
};
