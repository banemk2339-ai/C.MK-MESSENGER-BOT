// ═══════════════════════════════════════════════════════════════
//   adminresetbattle.js  —  Admin: wipe a target user's fight stats
//   Usage: +adminresetbattle @tag | +adminresetbattle <uid> | reply
//   Role 2 (admin) required — no confirmation step needed
// ═══════════════════════════════════════════════════════════════

// All fight-related data keys that will be wiped (mirrors resetbattle.js)
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
    name: "adminresetbattle",
    aliases: ["abattlereset", "adminbattlereset", "adminresetfight"],
    version: "1.0",
    author: "Charles MK",
    countDown: 3,
    role: 2, // Admin only
    shortDescription: { en: "🛡️ [Admin] Reset a user's battle stats" },
    category: "admin",
    guide: {
      en:
        "{pn} @tag        — Reset tagged user's battle stats\n" +
        "{pn} <uid>       — Reset user by UID\n" +
        "Reply to a message — Reset the replied-to user's battle stats\n\n" +
        "⚠️ Wipes: level, XP, wins, losses, trait,\n" +
        "   skills, HP upgrades, atk/def/agility upgrades,\n" +
        "   and all unlocked abilities.\n" +
        "💵 Target's money is NOT affected.",
    },
  },

  onStart: async function ({ event, message, usersData, args }) {
    const { senderID, mentions, messageReply } = event;

    // ── Resolve target UID (tag > reply > UID arg) ──────────
    let targetID = null;

    // 1) Tagged user
    const mentionIDs = Object.keys(mentions || {});
    if (mentionIDs.length > 0) {
      targetID = mentionIDs[0];
    }
    // 2) Reply to a message
    else if (messageReply && messageReply.senderID) {
      targetID = messageReply.senderID;
    }
    // 3) Raw UID passed as argument
    else if (args[0] && /^\d{10,20}$/.test(args[0].trim())) {
      targetID = args[0].trim();
    }

    // ── No target found ─────────────────────────────────────
    if (!targetID) {
      return message.reply(
        `❌ No target specified.\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Usage:\n` +
        `  • Tag a user:    +adminresetbattle @name\n` +
        `  • Provide UID:   +adminresetbattle <uid>\n` +
        `  • Reply to msg:  +adminresetbattle (while replying)`
      );
    }

    // ── Prevent self-reset via this command ─────────────────
    if (targetID === senderID) {
      return message.reply(
        `⚠️ Use +resetbattle to reset your own battle stats.\n` +
        `This command is for resetting other users.`
      );
    }

    // ── Fetch target's data ─────────────────────────────────
    let targetData;
    try {
      targetData = await usersData.get(targetID);
    } catch {
      return message.reply(
        `❌ Could not fetch data for UID: ${targetID}\n` +
        `Make sure the ID is correct.`
      );
    }

    if (!targetData) {
      return message.reply(`❌ No user data found for UID: ${targetID}`);
    }

    const d        = targetData.data || {};
    const name     = targetData.name || `User (${targetID})`;

    // ── Snapshot what will be wiped ─────────────────────────
    const level     = d.fightLevel        || 1;
    const xp        = d.fightXP           || 0;
    const wins      = d.fightWins         || 0;
    const losses    = d.fightLosses       || 0;
    const trait     = d.fightTrait        || "None";
    const bonusHP   = d.fightBonusHP      || 0;
    const atkBonus  = d.fightAtkBonus     || 0;
    const defBonus  = d.fightDefBonus     || 0;
    const agiBonus  = d.fightAgilityBonus || 0;
    const atkLvl    = d.fightAtkBonusLevel     || 0;
    const defLvl    = d.fightDefBonusLevel     || 0;
    const agiLvl    = d.fightAgilityBonusLevel || 0;
    const skills    = Object.keys(d.fightSkills    || {});
    const abilities = Object.keys(d.fightAbilities || {});

    // ── Wipe all fight keys ─────────────────────────────────
    const newData = { ...(d) };
    for (const key of FIGHT_KEYS) delete newData[key];

    try {
      await usersData.set(targetID, { ...targetData, data: newData });
    } catch {
      return message.reply(
        `❌ Failed to save reset data for ${name}.\n` +
        `Please try again.`
      );
    }

    // ── Success report ──────────────────────────────────────
    return message.reply(
      `✅ 𝗔𝗗𝗠𝗜𝗡 𝗕𝗔𝗧𝗧𝗟𝗘 𝗥𝗘𝗦𝗘𝗧 𝗖𝗢𝗠𝗣𝗟𝗘𝗧𝗘\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 User:     ${name}\n` +
      `🆔 UID:      ${targetID}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🗑️ Wiped data:\n` +
      `  ⚔️ Level:    ${level}  (${xp} XP)\n` +
      `  🏆 Wins:     ${wins}\n` +
      `  💀 Losses:   ${losses}\n` +
      `  🧬 Trait:    ${trait}\n` +
      `  ❤️ Bonus HP: +${bonusHP}\n` +
      `  💪 Atk:      Lv.${atkLvl} (+${atkBonus} dmg)\n` +
      `  🛡️ Def:      Lv.${defLvl} (+${defBonus}% red.)\n` +
      `  💨 Agi:      Lv.${agiLvl} (+${agiBonus}% dodge)\n` +
      `  ⚡ Skills:   ${skills.length ? skills.join(", ") : "None"}\n` +
      `  💚 Abilities:${abilities.length ? " " + abilities.join(", ") : " None"}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 ${name} is now a fresh fighter: Lv.1, 0W/0L.\n` +
      `💵 Their money was not touched.`
    );
  },
};
