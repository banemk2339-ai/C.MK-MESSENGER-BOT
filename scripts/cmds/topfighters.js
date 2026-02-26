// ═══════════════════════════════════════════════════════════════
//   TOPFIGHTERS — Standalone leaderboard command
//   Shows Top 10 by wins, Top 10 by losses, with level & W/L ratio
// ═══════════════════════════════════════════════════════════════

function calcLevel(xp = 0) {
  let lvl = 1;
  while (xp >= lvl * 100) { xp -= lvl * 100; lvl++; if (lvl >= 100) break; }
  return lvl;
}

function winBar(wins, losses, length = 8) {
  const total = wins + losses;
  if (total === 0) return "░".repeat(length);
  const filled = Math.round((wins / total) * length);
  const empty  = length - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

function rankIcon(i) {
  if (i === 0) return "🥇";
  if (i === 1) return "🥈";
  if (i === 2) return "🥉";
  return `${i + 1}.`;
}

function traitEmoji(trait) {
  const map = {
    ironhide:   "🛡️",
    shadowstep: "👤",
    berserker:  "😡",
    cursed:     "☠️",
    phoenix:    "🔥",
  };
  return map[trait] || "";
}

function buildSection(title, emoji, fighters, sortKey, limit = 10) {
  if (!fighters.length)
    return `${emoji} ${title}\n━━━━━━━━━━━━━━━━━━━━━━\nNo fighters yet!\n`;

  const sorted = [...fighters].sort((a, b) => {
    if (b[sortKey] !== a[sortKey]) return b[sortKey] - a[sortKey];
    // tiebreak: higher W/R for wins board, higher losses for losses board
    if (sortKey === "wins")   return b.wr - a.wr;
    if (sortKey === "losses") return b.wins - a.wins;
    return 0;
  }).slice(0, limit);

  let out = `${emoji} ${title}\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  sorted.forEach((f, i) => {
    const bar   = winBar(f.wins, f.losses);
    const trait = traitEmoji(f.trait);
    out +=
      `${rankIcon(i)} 𝗟𝘃.${f.level}${trait ? " " + trait : ""} ${f.name}\n` +
      `   🏆 ${f.wins}W  💀 ${f.losses}L  📊 ${f.wr}%  [${bar}]\n`;
  });
  return out;
}

module.exports = {
  config: {
    name: "topfighters",
    aliases: ["topfight", "fightboard", "fightlb"],
    version: "1.0",
    author: "Charles MK",
    countDown: 5,
    role: 0,
    shortDescription: { en: "🏆 Fight leaderboard — top wins & losses" },
    category: "fun",
    guide: {
      en:
        "{pn}              — Show top 10 by wins & top 10 by losses\n" +
        "{pn} wins         — Top 10 most wins only\n" +
        "{pn} losses       — Top 10 most losses only\n" +
        "{pn} @mention     — Show a specific player's stats",
    },
  },

  onStart: async function ({ event, message, usersData, args }) {
    // ── Single player lookup ──────────────────────────────
    const mentionedID = Object.keys(event.mentions)[0]
      || (event.type === "message_reply" ? event.messageReply.senderID : null)
      || (args[0] && /^\d+$/.test(args[0]) ? args[0] : null);

    if (mentionedID) {
      const userData = await usersData.get(mentionedID);
      const name     = await usersData.getName(mentionedID);
      const d        = userData?.data || {};
      const wins     = d.fightWins    || 0;
      const losses   = d.fightLosses  || 0;
      const xp       = d.fightXP      || 0;
      const level    = calcLevel(xp);
      const total    = wins + losses;
      const wr       = total ? ((wins / total) * 100).toFixed(1) : "0.0";
      const trait    = d.fightTrait   || null;
      const bar      = winBar(wins, losses, 10);

      return message.reply(
        `👤 𝗙𝗜𝗚𝗛𝗧𝗘𝗥 𝗣𝗥𝗢𝗙𝗜𝗟𝗘\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🏷️ ${name}${trait ? "  " + traitEmoji(trait) + " " + trait : ""}\n` +
        `⚔️ Level: 𝗟𝘃.${level}\n` +
        `✨ XP: ${xp}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🏆 Wins:   ${wins}\n` +
        `💀 Losses: ${losses}\n` +
        `📊 Win Rate: ${wr}%\n` +
        `   [${bar}]\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🥊 Total Fights: ${total}`
      );
    }

    // ── Build fighter list ────────────────────────────────
    const allUsers = await usersData.getAll();
    const fighters = allUsers
      .filter(u => u.data && (u.data.fightWins > 0 || u.data.fightLosses > 0))
      .map(u => {
        const d      = u.data;
        const wins   = d.fightWins   || 0;
        const losses = d.fightLosses || 0;
        const xp     = d.fightXP     || 0;
        const total  = wins + losses;
        return {
          name:   u.name,
          wins,
          losses,
          level:  calcLevel(xp),
          xp,
          wr:     total ? parseFloat(((wins / total) * 100).toFixed(1)) : 0,
          trait:  d.fightTrait || null,
        };
      });

    if (!fighters.length)
      return message.reply(
        `🥊 𝗧𝗢𝗣 𝗙𝗜𝗚𝗛𝗧𝗘𝗥𝗦\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `No fighters yet! Use +fight to start a duel.`
      );

    const mode = (args[0] || "").toLowerCase();

    // ── Wins-only mode ────────────────────────────────────
    if (mode === "wins") {
      return message.reply(
        buildSection("TOP 10 — MOST WINS", "🏆", fighters, "wins")
      );
    }

    // ── Losses-only mode ──────────────────────────────────
    if (mode === "losses") {
      return message.reply(
        buildSection("TOP 10 — MOST LOSSES", "💀", fighters, "losses")
      );
    }

    // ── Default: both boards ──────────────────────────────
    const winsSection   = buildSection("TOP 10 — MOST WINS",   "🏆", fighters, "wins");
    const lossesSection = buildSection("TOP 10 — MOST LOSSES", "💀", fighters, "losses");

    return message.reply(
      `🥊 𝗙𝗜𝗚𝗛𝗧 𝗟𝗘𝗔𝗗𝗘𝗥𝗕𝗢𝗔𝗥𝗗\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      winsSection +
      `\n` +
      lossesSection +
      `\n━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 +topfighters wins | losses | @mention`
    );
  },
};
