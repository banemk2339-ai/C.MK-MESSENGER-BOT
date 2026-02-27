// ═══════════════════════════════════════════════════════════════
//   resetprogress.js  —  Wipe ALL bot progress for a user
//   Double confirmation: first "yes", then a unique code phrase
// ═══════════════════════════════════════════════════════════════

const pendingConfirms = new Map(); // senderID → { step, code, timeout }

// Generate a short random code so the user has to actively type it
function genCode() {
  return Math.random().toString(36).slice(2, 7).toUpperCase(); // e.g. "X4R9K"
}

module.exports = {
  config: {
    name: "resetprogress",
    aliases: ["resetbot", "fullreset", "wipedata"],
    version: "1.0",
    author: "Charles MK",
    countDown: 5,
    role: 0,
    shortDescription: { en: "💀 Reset ALL bot progress (money, rank, everything)" },
    category: "economy",
    guide: {
      en:
        "{pn}       — Start full reset (double confirmation required)\n\n" +
        "⚠️ This removes EVERYTHING:\n" +
        "   money, bot rank/XP, fight stats, skills,\n" +
        "   traits, upgrades, and all other bot data.\n" +
        "   You will be treated as a brand new user.",
    },
  },

  onStart: async function ({ event, message, usersData }) {
    const senderID = event.senderID;
    const userData = await usersData.get(senderID);
    const d        = userData.data || {};

    // ── Build summary of everything they will lose ─────────
    const money    = userData.money || 0;
    const wins     = d.fightWins    || 0;
    const losses   = d.fightLosses  || 0;
    const fightLvl = d.fightLevel   || 1;
    const trait    = d.fightTrait   || "None";
    const bonusHP  = d.fightBonusHP || 0;
    const skills   = Object.keys(d.fightSkills    || {});
    const abilities= Object.keys(d.fightAbilities || {});

    // Clear any existing pending state first
    const existing = pendingConfirms.get(senderID);
    if (existing) {
      clearTimeout(existing.timeout);
      pendingConfirms.delete(senderID);
    }

    const handle = setTimeout(() => {
      pendingConfirms.delete(senderID);
    }, 60_000);

    pendingConfirms.set(senderID, { step: 1, timeout: handle });

    return message.reply(
      `💀 𝗙𝗨𝗟𝗟 𝗣𝗥𝗢𝗚𝗥𝗘𝗦𝗦 𝗥𝗘𝗦𝗘𝗧\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🚨 This will permanently delete ALL your data:\n\n` +
      `💵 Money:     $${money.toLocaleString()}\n` +
      `⚔️ Fight Lvl: ${fightLvl}  (${wins}W / ${losses}L)\n` +
      `🧬 Trait:     ${trait}\n` +
      `❤️ Bonus HP:  +${bonusHP}\n` +
      `⚡ Skills:    ${skills.length ? skills.join(", ") : "None"}\n` +
      `💚 Abilities: ${abilities.length ? abilities.join(", ") : "None"}\n` +
      `📦 All other bot data stored for your account\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚠️ This CANNOT be undone. You will start fresh.\n\n` +
      `❓ Reply "𝘆𝗲𝘀" within 60s to continue.\n` +
      `   Any other reply cancels immediately.`
    );
  },

  onChat: async function ({ event, message, usersData }) {
    const senderID = event.senderID;
    const input    = event.body.trim().toLowerCase();

    const state = pendingConfirms.get(senderID);
    if (!state) return;

    // ── Step 1: first "yes" → generate a code ─────────────
    if (state.step === 1) {
      if (input !== "yes") {
        clearTimeout(state.timeout);
        pendingConfirms.delete(senderID);
        return message.reply("❌ Full reset cancelled.");
      }

      // Upgrade to step 2 with a code
      const code = genCode();
      clearTimeout(state.timeout);
      const handle = setTimeout(() => {
        pendingConfirms.delete(senderID);
      }, 60_000);
      pendingConfirms.set(senderID, { step: 2, code, timeout: handle });

      return message.reply(
        `🔐 𝗙𝗜𝗡𝗔𝗟 𝗖𝗢𝗡𝗙𝗜𝗥𝗠𝗔𝗧𝗜𝗢𝗡\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `This is your last chance to back out.\n\n` +
        `To permanently wipe ALL your data,\n` +
        `type this exact code within 60s:\n\n` +
        `     🔑  ${code}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Any other reply cancels the reset.`
      );
    }

    // ── Step 2: code verification ──────────────────────────
    if (state.step === 2) {
      if (input !== state.code.toLowerCase()) {
        clearTimeout(state.timeout);
        pendingConfirms.delete(senderID);
        return message.reply(
          `❌ Wrong code. Full reset cancelled.\n` +
          `Your data is safe.`
        );
      }

      // ── Confirmed — nuke everything ────────────────────
      clearTimeout(state.timeout);
      pendingConfirms.delete(senderID);

      await usersData.set(senderID, {
        money: 0,
        data:  {},
      });

      return message.reply(
        `💀 𝗣𝗥𝗢𝗚𝗥𝗘𝗦𝗦 𝗪𝗜𝗣𝗘𝗗\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `✅ All your data has been permanently deleted.\n` +
        `🆕 You are now a brand new user.\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 Start fresh with the bot's commands!\n` +
        `   Good luck on your new journey. 👋`
      );
    }
  },
};
