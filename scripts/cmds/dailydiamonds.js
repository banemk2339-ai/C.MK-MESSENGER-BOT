// ═══════════════════════════════════════════════════════════════
//   dailydiamond.js  —  Claim 0.2 diamonds every 20 hours
//
//   Base reward:  0.2 💎 per claim
//   Streak bonus: +0.05 💎 per consecutive day (max +0.3 💎)
//   So max daily = 0.5 💎 at a 6-day streak
//   Full diamond in 5 days (base), faster with streaks
//
//   Streak resets if you miss more than 48 hours since last claim
// ═══════════════════════════════════════════════════════════════

const COOLDOWN_MS    = 20 * 60 * 60 * 1000; // 20 hours
const STREAK_EXPIRE  = 48 * 60 * 60 * 1000; // 48 hours to keep streak
const BASE_REWARD    = 0.2;
const STREAK_BONUS   = 0.05; // per streak day
const MAX_STREAK     = 6;    // caps bonus at +0.3

function formatDiamonds(n) {
  return Number.isInteger(n) ? `${n}` : n.toFixed(4).replace(/\.?0+$/, "");
}

function msToReadable(ms) {
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s || !parts.length) parts.push(`${s}s`);
  return parts.join(" ");
}

function streakBar(streak) {
  const max   = MAX_STREAK;
  const filled = Math.min(streak, max);
  const bar    = "█".repeat(filled) + "░".repeat(max - filled);
  return `[${bar}] ${filled}/${max}`;
}

module.exports = {
  config: {
    name: "dailydiamond",
    aliases: ["ddiamond", "dailygem", "claimdiamond"],
    version: "1.0",
    author: "Charles MK",
    countDown: 5,
    role: 0,
    shortDescription: { en: "💎 Claim your daily diamond reward" },
    category: "pets",
    guide: {
      en:
        "{pn}  — Claim 0.2 💎 every 20 hours\n\n" +
        "🔥 Streak bonuses (consecutive days):\n" +
        "   Day 1: +0.00 💎  →  0.20 💎\n" +
        "   Day 2: +0.05 💎  →  0.25 💎\n" +
        "   Day 3: +0.05 💎  →  0.30 💎\n" +
        "   Day 4: +0.05 💎  →  0.35 💎\n" +
        "   Day 5: +0.05 💎  →  0.40 💎\n" +
        "   Day 6: +0.05 💎  →  0.45 💎\n" +
        "   Day 7: +0.05 💎  →  0.50 💎 (MAX)\n\n" +
        "⚠️ Miss 48h and your streak resets to 0.",
    },
  },

  onStart: async function ({ event, message, usersData }) {
    const senderID = event.senderID;
    const userData = await usersData.get(senderID);
    const data     = userData.data || {};
    const now      = Date.now();

    const lastClaim  = data.ddLastClaim  || 0;
    const streak     = data.ddStreak     || 0;
    const totalEarned = data.ddTotal     || 0;
    const diamonds   = data.petDiamonds  || 0;

    const elapsed    = now - lastClaim;
    const remaining  = COOLDOWN_MS - elapsed;

    // ── Too soon ───────────────────────────────────────────
    if (lastClaim > 0 && remaining > 0) {
      return message.reply(
        `⏳ 𝗔𝗟𝗥𝗘𝗔𝗗𝗬 𝗖𝗟𝗔𝗜𝗠𝗘𝗗\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💎 Balance:    ${formatDiamonds(diamonds)}\n` +
        `⏱️ Next claim: ${msToReadable(remaining)}\n` +
        `🔥 Streak:     ${streakBar(streak)}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 Keep your streak for bonus diamonds!`
      );
    }

    // ── Calculate new streak ───────────────────────────────
    let newStreak;
    if (lastClaim === 0) {
      // First ever claim
      newStreak = 1;
    } else if (elapsed <= STREAK_EXPIRE) {
      // Within 48h — streak continues
      newStreak = Math.min(streak + 1, MAX_STREAK);
    } else {
      // Missed window — streak resets
      newStreak = 1;
    }

    const streakBroken = lastClaim > 0 && elapsed > STREAK_EXPIRE && streak > 1;

    // ── Calculate reward ───────────────────────────────────
    const bonusDiamonds = (newStreak - 1) * STREAK_BONUS;
    const reward        = parseFloat((BASE_REWARD + bonusDiamonds).toFixed(4));
    const newDiamonds   = parseFloat((diamonds + reward).toFixed(4));
    const newTotal      = parseFloat((totalEarned + reward).toFixed(4));

    // ── Save ───────────────────────────────────────────────
    await usersData.set(senderID, {
      ...userData,
      data: {
        ...data,
        petDiamonds: newDiamonds,
        ddLastClaim: now,
        ddStreak:    newStreak,
        ddTotal:     newTotal,
      },
    });

    // ── Build streak display ───────────────────────────────
    const nextReward = parseFloat((BASE_REWARD + Math.min(newStreak, MAX_STREAK - 1) * STREAK_BONUS).toFixed(4));
    const streakMsg  = newStreak >= MAX_STREAK
      ? `🔥 MAX STREAK! Keep it up!`
      : `🔥 Next claim: ${formatDiamonds(nextReward)} 💎 (day ${newStreak + 1})`;

    // ── Milestone messages ─────────────────────────────────
    let milestone = "";
    const fullDiamonds = Math.floor(newDiamonds);
    const prevFull     = Math.floor(diamonds);
    if (fullDiamonds > prevFull) {
      milestone = `\n🎉 You now have ${fullDiamonds} full diamond${fullDiamonds > 1 ? "s" : ""}!`;
    }

    return message.reply(
      `💎 𝗗𝗔𝗜𝗟𝗬 𝗗𝗜𝗔𝗠𝗢𝗡𝗗 𝗖𝗟𝗔𝗜𝗠𝗘𝗗!\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${streakBroken ? `💔 Streak broken! (was ${streak} days)\n` : ""}` +
      `💎 Reward:     +${formatDiamonds(reward)} diamond${reward !== 1 ? "s" : ""}\n` +
      `   (Base 0.2 + ${formatDiamonds(bonusDiamonds)} streak bonus)\n` +
      `💎 Balance:    ${formatDiamonds(newDiamonds)}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔥 Streak:     ${streakBar(newStreak)}\n` +
      `${streakMsg}` +
      `${milestone}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 Total earned: ${formatDiamonds(newTotal)} 💎 all time\n` +
      `⏱️ Next claim in: 20 hours`
    );
  },
};
