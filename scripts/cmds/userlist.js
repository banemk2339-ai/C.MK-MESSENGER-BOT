// ═══════════════════════════════════════════════════════════════
//   userlist.js  —  List all bot users & search by name
// ═══════════════════════════════════════════════════════════════

const PAGE_SIZE = 15;

function fmt(n) {
  if (n === undefined || n === null) return "$0";
  return `$${Number(n).toLocaleString()}`;
}

function calcLevel(xp = 0) {
  let lvl = 1;
  while (xp >= lvl * 100) { xp -= lvl * 100; lvl++; if (lvl >= 100) break; }
  return lvl;
}

function traitEmoji(trait) {
  const map = {
    ironhide:   "🛡️",
    shadowstep: "👤",
    berserker:  "😡",
    cursed:     "☠️",
    phoenix:    "🔥",
  };
  return trait && map[trait] ? map[trait] + " " : "";
}

module.exports = {
  config: {
    name: "userlist",
    aliases: ["users", "userinfo", "finduser"],
    version: "1.0",
    author: "Charles MK",
    countDown: 5,
    role: 1, // admin only
    shortDescription: { en: "📋 List all bot users or search by name" },
    category: "admin",
    guide: {
      en:
        "{pn}                  — List all users (page 1)\n" +
        "{pn} [page]           — Go to a specific page\n" +
        "{pn} search [name]    — Search users by name\n" +
        "{pn} @mention         — View a specific user's profile\n" +
        "{pn} top              — Sort by balance (richest first)\n" +
        "{pn} top fights       — Sort by fight wins\n",
    },
  },

  onStart: async function ({ event, message, usersData, args }) {
    const allUsers = await usersData.getAll();
    const sub      = args[0]?.toLowerCase();

    // ── Profile lookup via mention / reply / UID ───────────
    const mentionedID =
      Object.keys(event.mentions)[0] ||
      (event.type === "message_reply" ? event.messageReply.senderID : null) ||
      (args[0] && /^\d{10,}$/.test(args[0]) ? args[0] : null);

    if (mentionedID) {
      const u    = allUsers.find(u => u.userID === mentionedID || u.id === mentionedID);
      const name = u?.name || await usersData.getName(mentionedID).catch(() => "Unknown");
      const d    = u?.data || {};
      const wins   = d.fightWins   || 0;
      const losses = d.fightLosses || 0;
      const xp     = d.fightXP     || 0;
      const level  = calcLevel(xp);
      const total  = wins + losses;
      const wr     = total ? ((wins / total) * 100).toFixed(1) : "0.0";
      const money  = u?.money ?? 0;
      const trait  = d.fightTrait || null;
      const bonusHP = d.fightBonusHP || 0;

      return message.reply(
        `👤 𝗨𝗦𝗘𝗥 𝗣𝗥𝗢𝗙𝗜𝗟𝗘\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🏷️  Name:    ${name}\n` +
        `🆔  UID:     ${mentionedID}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💵  Balance: ${fmt(money)}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚔️  Fight Level: Lv.${level}  (${xp} XP)\n` +
        `❤️  Max HP:      ${100 + bonusHP}\n` +
        `🧬  Trait:       ${trait ? traitEmoji(trait) + trait : "None"}\n` +
        `🏆  Wins:        ${wins}\n` +
        `💀  Losses:      ${losses}\n` +
        `📊  Win Rate:    ${wr}% (${total} fights)\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🔓 Skills: ${Object.keys(d.fightSkills || {}).join(", ") || "None"}\n` +
        `💚 Abilities: ${Object.keys(d.fightAbilities || {}).join(", ") || "None"}`
      );
    }

    // ── Search by name ─────────────────────────────────────
    if (sub === "search" || sub === "find") {
      const query = args.slice(1).join(" ").toLowerCase().trim();
      if (!query)
        return message.reply("❌ Please provide a name to search.\nExample: +userlist search John");

      const results = allUsers.filter(u =>
        u.name && u.name.toLowerCase().includes(query)
      );

      if (!results.length)
        return message.reply(
          `🔍 𝗦𝗘𝗔𝗥𝗖𝗛 𝗥𝗘𝗦𝗨𝗟𝗧𝗦\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `No users found matching "${query}".`
        );

      let msg =
        `🔍 𝗦𝗘𝗔𝗥𝗖𝗛 𝗥𝗘𝗦𝗨𝗟𝗧𝗦 — "${query}"\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Found ${results.length} user${results.length > 1 ? "s" : ""}:\n\n`;

      results.slice(0, 20).forEach((u, i) => {
        const d      = u.data || {};
        const wins   = d.fightWins || 0;
        const losses = d.fightLosses || 0;
        const level  = calcLevel(d.fightXP || 0);
        const uid    = u.userID || u.id || "???";
        const trait  = traitEmoji(d.fightTrait);
        msg +=
          `${i + 1}. ${trait}${u.name}\n` +
          `   🆔 ${uid}\n` +
          `   💵 ${fmt(u.money)}  ⚔️ Lv.${level}  🏆 ${wins}W ${losses}L\n\n`;
      });

      if (results.length > 20)
        msg += `... and ${results.length - 20} more.\n`;

      msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `Tip: +userlist @mention or UID for full profile.`;

      return message.reply(msg);
    }

    // ── Sort: top balance or top fights ────────────────────
    if (sub === "top") {
      const mode = args[1]?.toLowerCase();

      if (mode === "fights" || mode === "fight" || mode === "wins") {
        const sorted = [...allUsers]
          .filter(u => (u.data?.fightWins || 0) > 0)
          .sort((a, b) => (b.data?.fightWins || 0) - (a.data?.fightWins || 0))
          .slice(0, 15);

        if (!sorted.length)
          return message.reply("No fighters found yet.");

        const medals = ["🥇","🥈","🥉"];
        let msg =
          `🏆 𝗧𝗢𝗣 𝗙𝗜𝗚𝗛𝗧𝗘𝗥𝗦\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n`;

        sorted.forEach((u, i) => {
          const d      = u.data || {};
          const wins   = d.fightWins   || 0;
          const losses = d.fightLosses || 0;
          const level  = calcLevel(d.fightXP || 0);
          const total  = wins + losses;
          const wr     = total ? ((wins / total) * 100).toFixed(1) : "0.0";
          const trait  = traitEmoji(d.fightTrait);
          msg +=
            `${medals[i] || `${i + 1}.`} ${trait}${u.name}  Lv.${level}\n` +
            `   🏆 ${wins}W  💀 ${losses}L  📊 ${wr}%\n\n`;
        });

        return message.reply(msg.trimEnd());
      }

      // Default top: richest
      const sorted = [...allUsers]
        .filter(u => (u.money || 0) > 0)
        .sort((a, b) => (b.money || 0) - (a.money || 0))
        .slice(0, 15);

      if (!sorted.length)
        return message.reply("No users with balance found.");

      const medals = ["🥇","🥈","🥉"];
      let msg =
        `💰 𝗧𝗢𝗣 𝗥𝗜𝗖𝗛𝗘𝗦𝗧 𝗨𝗦𝗘𝗥𝗦\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n`;

      sorted.forEach((u, i) => {
        const trait = traitEmoji(u.data?.fightTrait);
        msg +=
          `${medals[i] || `${i + 1}.`} ${trait}${u.name}\n` +
          `   💵 ${fmt(u.money)}\n\n`;
      });

      return message.reply(msg.trimEnd());
    }

    // ── Paginated full user list ───────────────────────────
    const page    = Math.max(1, parseInt(args[0]) || 1);
    const total   = allUsers.length;
    const pages   = Math.ceil(total / PAGE_SIZE);
    const start   = (page - 1) * PAGE_SIZE;
    const slice   = allUsers.slice(start, start + PAGE_SIZE);

    if (!slice.length)
      return message.reply(`❌ No users on page ${page}. Total pages: ${pages}`);

    let msg =
      `📋 𝗔𝗟𝗟 𝗨𝗦𝗘𝗥𝗦  (Page ${page}/${pages})\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Total registered: ${total} users\n\n`;

    slice.forEach((u, i) => {
      const d      = u.data  || {};
      const uid    = u.userID || u.id || "???";
      const level  = calcLevel(d.fightXP || 0);
      const wins   = d.fightWins   || 0;
      const losses = d.fightLosses || 0;
      const trait  = traitEmoji(d.fightTrait);
      const num    = start + i + 1;

      msg +=
        `${num}. ${trait}${u.name}\n` +
        `   🆔 ${uid}\n` +
        `   💵 ${fmt(u.money)}  ⚔️ Lv.${level}  🏆 ${wins}W ${losses}L\n\n`;
    });

    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    if (page < pages) msg += `▶️ Next: +userlist ${page + 1}\n`;
    if (page > 1)     msg += `◀️ Prev: +userlist ${page - 1}\n`;
    msg += `🔍 Search: +userlist search [name]`;

    return message.reply(msg);
  },
};
