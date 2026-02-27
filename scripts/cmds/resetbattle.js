// ═══════════════════════════════════════════════════════════════
//   resetbattle.js  —  Wipe all fight/battle stats for a user
//   Confirmation required: user must reply "yes" within 30s
// ═══════════════════════════════════════════════════════════════

const pendingConfirms = new Map(); // senderID → timeout handle

// All fight-related data keys that will be wiped
const FIGHT_KEYS = [
  "fightLevel",
  "fightWins",
  "fightLosses",
  "fightAtkBonus",
  "fightAtkBonusLevel",
  "fightDefBonus",
  "fightDefBonusLevel",
  "fightAgilityBonus",
  "fightAgilityBonusLevel",
  "fightBonusHP",
  "fightAbilities",
  "fightTrait",
  "fightSkills",
  "fightTrainedAt",
  "fightXP",
];

module.exports = {
  config: {
    name: "resetbattle",
    aliases: ["battleresset", "fightreset", "resetfight"],
    version: "1.0",
    author: "Charles MK",
    countDown: 5,
    role: 0,
    shortDescription: { en: "⚔️ Reset your battle stats, skills & traits" },
    category: "fun",
    guide: {
      en:
        "{pn}       — Start reset (asks for confirmation)\n" +
        "Then reply: yes — confirm and wipe battle data\n\n" +
        "⚠️ This removes: level, XP, wins, losses, traits,\n" +
        "   skills, HP upgrades, atk/def/agility upgrades,\n" +
        "   and all unlocked abilities.\n" +
        "💵 Your money is NOT affected.",
    },
  },

  onStart: async function ({ event, message, usersData }) {
    const senderID = event.senderID;
    const userData = await usersData.get(senderID);
    const d        = userData.data || {};

    // ── Build a summary of what will be lost ───────────────
    const wins        = d.fightWins         || 0;
    const losses      = d.fightLosses       || 0;
    const xp          = d.fightXP           || 0;
    const level       = d.fightLevel        || 1;
    const trait       = d.fightTrait        || null;
    const bonusHP     = d.fightBonusHP      || 0;
    const atkBonus    = d.fightAtkBonus     || 0;
    const defBonus    = d.fightDefBonus     || 0;
    const agiBonus    = d.fightAgilityBonus || 0;
    const skills      = Object.keys(d.fightSkills    || {});
    const abilities   = Object.keys(d.fightAbilities || {});

    const atkLvl = d.fightAtkBonusLevel     || 0;
    const defLvl = d.fightDefBonusLevel     || 0;
    const agiLvl = d.fightAgilityBonusLevel || 0;

    // Queue confirmation
    const existing = pendingConfirms.get(senderID);
    if (existing) clearTimeout(existing);

    const handle = setTimeout(() => {
      pendingConfirms.delete(senderID);
    }, 30_000);
    pendingConfirms.set(senderID, handle);

    return message.reply(
      `⚠️ 𝗕𝗔𝗧𝗧𝗟𝗘 𝗥𝗘𝗦𝗘𝗧 𝗪𝗔𝗥𝗡𝗜𝗡𝗚\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `The following battle data will be permanently deleted:\n\n` +
      `⚔️ Level:    ${level}  (${xp} XP)\n` +
      `🏆 Wins:     ${wins}\n` +
      `💀 Losses:   ${losses}\n` +
      `🧬 Trait:    ${trait || "None"}\n` +
      `❤️ Bonus HP: +${bonusHP}\n` +
      `💪 Atk Boost: Lv.${atkLvl} (+${atkBonus} dmg)\n` +
      `🛡️ Def Boost: Lv.${defLvl} (+${defBonus}% red.)\n` +
      `💨 Agi Boost: Lv.${agiLvl} (+${agiBonus}% dodge)\n` +
      `⚡ Skills:   ${skills.length ? skills.join(", ") : "None"}\n` +
      `💚 Abilities: ${abilities.length ? abilities.join(", ") : "None"}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💵 Your money will NOT be affected.\n\n` +
      `❓ Reply "𝘆𝗲𝘀" within 30s to confirm.\n` +
      `   Any other reply or inactivity cancels.`
    );
  },

  onChat: async function ({ event, message, usersData }) {
    const senderID = event.senderID;
    const input    = event.body.trim().toLowerCase();

    if (!pendingConfirms.has(senderID)) return;

    // ── Cancel on anything that isn't "yes" ───────────────
    if (input !== "yes") {
      clearTimeout(pendingConfirms.get(senderID));
      pendingConfirms.delete(senderID);
      return message.reply("❌ Battle reset cancelled.");
    }

    // ── Confirmed — wipe all fight keys ───────────────────
    clearTimeout(pendingConfirms.get(senderID));
    pendingConfirms.delete(senderID);

    const userData = await usersData.get(senderID);
    const newData  = { ...(userData.data || {}) };
    for (const key of FIGHT_KEYS) delete newData[key];

    await usersData.set(senderID, { data: newData });

    return message.reply(
      `✅ 𝗕𝗔𝗧𝗧𝗟𝗘 𝗦𝗧𝗔𝗧𝗦 𝗥𝗘𝗦𝗘𝗧!\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚔️ All fight data has been wiped.\n` +
      `📊 You are now a fresh fighter: Lv.1, 0W/0L.\n` +
      `💵 Your money was not touched.\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 Use +fightupgrade to rebuild your stats!`
    );
  },
};
