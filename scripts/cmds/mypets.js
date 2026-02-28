// ═══════════════════════════════════════════════════════════════
//   mypets.js  —  Complete pet overview & status dashboard
//
//   Commands:
//     +mypets                  — Full overview of all your pets
//     +mypets <slot#>          — Detailed view of one pet
//     +mypets [target]         — View another user's pets
//       target = @tag | uid | reply
//     +mypets compare <s1> <s2> — Compare two of your pets
// ═══════════════════════════════════════════════════════════════

// ── Import shared utilities ────────────────────────────────────
let applyDecay, statBar, statusEmoji, weightStatus, formatDiamonds;
try {
  const ps     = require("./petshop");
  applyDecay   = ps.applyDecay;
  statBar      = ps.statBar;
  statusEmoji  = ps.statusEmoji;
  weightStatus = ps.weightStatus;
  formatDiamonds = ps.formatDiamonds;
} catch {
  applyDecay     = (p) => p;
  statBar        = (v, m = 100) => { const f = Math.round((v / m) * 10); return "█".repeat(f) + "░".repeat(10 - f); };
  statusEmoji    = (s) => ({ healthy: "💚", hungry: "🟡", starving: "🟠", critical: "🔴", dead: "💀" }[s] || "💚");
  weightStatus   = () => "✅ Normal";
  formatDiamonds = (n) => Number.isInteger(n) ? `${n}` : n.toFixed(4).replace(/\.?0+$/, "");
}

const DEFAULT_SLOTS = 10;
const MAX_SLOTS     = 15;

// ── HP bar with color indicator ────────────────────────────────
function hpBar(current, max) {
  const pct    = Math.max(0, Math.round((current / max) * 10));
  const color  = pct >= 6 ? "💚" : pct >= 3 ? "🟡" : "🔴";
  return `${color}[${statBar(current, max)}] ${current}/${max}`;
}

// ── Time since last interaction ────────────────────────────────
function timeSince(ts) {
  if (!ts) return "Never";
  const diff = Date.now() - ts;
  const h    = Math.floor(diff / 3_600_000);
  const m    = Math.floor((diff % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h ago`;
  if (h > 0)   return `${h}h ${m}m ago`;
  return `${m}m ago`;
}

// ── Urgency alerts for a pet ───────────────────────────────────
function getAlerts(pet) {
  const alerts = [];
  if (pet.status === "dead")          return ["💀 PET IS DEAD — use +petshop release to clear slot"];
  if (pet.status === "critical")      alerts.push("🚨 CRITICAL — health draining fast! Use +petcare medicine");
  if (pet.status === "starving")      alerts.push("🟠 STARVING — feed immediately! +petcare feed");
  if (pet.hunger < 20)                alerts.push("🟡 Very hungry — feed soon");
  if (pet.health < 30)                alerts.push("🔴 Low health — use +petcare medicine");
  if (pet.energy < 20)                alerts.push("😴 Exhausted — use +petcare sleep");
  if (pet.mood < 20)                  alerts.push("😞 Very unhappy — use +petcare play");
  if (pet.cleanliness < 20)           alerts.push("🛁 Very dirty — use +petcare wash or groom");

  // Weight alerts
  try {
    const { PET_CATALOG } = require("./petshop");
    const base  = PET_CATALOG[pet.catalogId]?.baseStats?.weight || 10;
    const ratio = pet.weight / base;
    if (ratio > 1.5)  alerts.push("⚖️ Overweight! Health issues + speed penalty in battles");
    else if (ratio < 0.7) alerts.push("💨 Underweight — your pet needs more food");
  } catch {}

  return alerts;
}

// ── Battle readiness check ─────────────────────────────────────
function battleReadiness(pet) {
  if (!pet.canBattle) return null;
  const issues = [];
  if (pet.energy < 30)      issues.push(`⚡ Low energy (${pet.energy}/100)`);
  if (pet.hunger < 30)      issues.push(`🍖 Hungry (${pet.hunger}/100)`);
  if (pet.health < 50)      issues.push(`❤️ Low health (${pet.health}/100)`);
  if (pet.status === "dead") return "💀 DEAD — cannot battle";

  if (!issues.length) return "✅ Battle ready!";
  return `⚠️ Not ready:\n  ${issues.join("\n  ")}`;
}

// ── Build full detail block for one pet ───────────────────────
function buildDetailBlock(pet, slot) {
  const dead      = pet.status === "dead";
  const alerts    = getAlerts(pet);
  const readiness = battleReadiness(pet);

  // Time info
  const lastSeen  = timeSince(pet.lastInteraction);
  const lastFed   = timeSince(pet.lastFed);
  const lastWash  = timeSince(pet.lastWashed);
  const lastPlay  = timeSince(pet.lastPlayed);
  const age       = timeSince(pet.boughtAt);

  let block =
    `${"═".repeat(22)}\n` +
    `${pet.emoji} SLOT ${slot}: ${pet.name.toUpperCase()}\n` +
    `${"═".repeat(22)}\n` +
    `🐾 Species:  ${pet.species}${pet.isMagic ? " ✦ Magic Beast" : ""}\n` +
    `${pet.title ? `👑 Title:    ${pet.title}\n` : ""}` +
    `🧬 Trait:    ${pet.traitDesc || pet.trait}\n` +
    `📅 Age:      ${age}\n` +
    `⚔️ Battles:  ${pet.canBattle ? "Yes" : "No (Companion)"}\n`;

  if (dead) {
    block += `\n💀 THIS PET HAS DIED\n`;
    block += `💔 They are gone. Use +petshop release ${slot} to clear slot.\n`;
    return block;
  }

  // Care stats
  block +=
    `\n📊 𝗖𝗔𝗥𝗘 𝗦𝗧𝗔𝗧𝗦\n` +
    `  ${statusEmoji(pet.status)} Status:      ${pet.status.toUpperCase()}\n` +
    `  🍖 Hunger:      [${statBar(pet.hunger)}] ${pet.hunger}/100\n` +
    `  ⚡ Energy:      [${statBar(pet.energy)}] ${pet.energy}/100\n` +
    `  😊 Mood:        [${statBar(pet.mood)}] ${pet.mood}/100\n` +
    `  🛁 Cleanliness: [${statBar(pet.cleanliness)}] ${pet.cleanliness}/100\n` +
    `  ❤️ Health:      [${statBar(pet.health)}] ${pet.health}/100\n` +
    `  ⚖️ Weight:      ${pet.weight}kg — ${weightStatus(pet)}\n`;

  // Battle stats
  if (pet.canBattle) {
    block +=
      `\n⚔️ 𝗕𝗔𝗧𝗧𝗟𝗘 𝗦𝗧𝗔𝗧𝗦\n` +
      `  📈 Level:    ${pet.level}${pet.isMagic ? `/20` : ""}\n` +
      `  ✨ XP:       ${pet.xp || 0}/${Math.floor(100 * Math.pow(1.2, (pet.level || 1) - 1))}\n` +
      `  🏆 Record:   ${pet.wins || 0}W / ${pet.losses || 0}L` +
      `${(pet.wins || 0) + (pet.losses || 0) > 0
        ? ` (${Math.round(((pet.wins || 0) / ((pet.wins || 0) + (pet.losses || 0))) * 100)}% WR)`
        : ""}\n` +
      `  ⚔️ ATK:      ${pet.atk}\n` +
      `  🛡️ DEF:      ${pet.def}\n` +
      `  💨 Agility:  ${pet.agility}\n` +
      `  ❤️ HP:       ${hpBar(pet.hp, pet.maxHp)}\n`;

    if (pet.isMagic) {
      block +=
        `  🔧 Upgrade:  ${pet.level < 20
          ? `+petsmagic upgrade ${slot}`
          : "🔱 GOD MODE — MAX LEVEL"}\n` +
        `  ${pet.matEmoji || "🔷"} Material: ${pet.matName || "?"}\n`;
    }

    block += `\n  ${readiness}\n`;
  }

  // Activity log
  block +=
    `\n🕐 𝗔𝗖𝗧𝗜𝗩𝗜𝗧𝗬\n` +
    `  Last seen:  ${lastSeen}\n` +
    `  Last fed:   ${lastFed}\n` +
    `  Last wash:  ${lastWash}\n` +
    `  Last play:  ${lastPlay}\n`;

  // Alerts
  if (alerts.length) {
    block += `\n⚠️ 𝗔𝗟𝗘𝗥𝗧𝗦\n`;
    alerts.forEach(a => { block += `  ${a}\n`; });
  }

  // Quick actions
  block +=
    `\n💡 𝗤𝗨𝗜𝗖𝗞 𝗔𝗖𝗧𝗜𝗢𝗡𝗦\n` +
    `  +petcare feed ${slot}    +petcare play ${slot}\n` +
    `  +petcare wash ${slot}    +petcare sleep ${slot}\n` +
    (pet.canBattle
      ? `  +petcare train ${slot}   +petbattle challenge ...\n`
      : "");

  return block;
}

// ── Summary line for overview ──────────────────────────────────
function buildSummaryLine(pet, slot) {
  if (pet.status === "dead") {
    return `  Slot ${slot}: ${pet.emoji} ${pet.name} — 💀 DEAD (+petshop release ${slot})`;
  }
  const alerts = getAlerts(pet);
  const urgent  = alerts.length > 0 ? ` ⚠️(${alerts.length})` : "";
  const battle  = pet.canBattle ? ` | ⚔️Lv.${pet.level} ${pet.wins || 0}W` : "";
  return (
    `  Slot ${slot}: ${pet.emoji} ${pet.name}${urgent}\n` +
    `    ${statusEmoji(pet.status)} ${pet.status.toUpperCase()} | ` +
    `🍖${pet.hunger} ⚡${pet.energy} 😊${pet.mood} ❤️${pet.health}${battle}`
  );
}

// ── Resolve target from event ──────────────────────────────────
function resolveTarget(event, args, argIndex = 0) {
  if (event.messageReply?.senderID) {
    return { id: event.messageReply.senderID };
  }
  const mentionIDs = Object.keys(event.mentions || {});
  if (mentionIDs.length > 0) return { id: mentionIDs[0] };
  const candidate = args[argIndex];
  if (candidate && /^\d{10,20}$/.test(candidate)) return { id: candidate };
  return null;
}

module.exports = {
  config: {
    name: "mypets",
    aliases: ["mypet", "petlist", "viewpets"],
    version: "1.0",
    author: "Charles MK",
    countDown: 5,
    role: 0,
    shortDescription: { en: "🐾 View your full pet dashboard" },
    category: "pets",
    guide: {
      en:
        "{pn}               — All your pets overview\n" +
        "{pn} <slot#>        — Detailed view of one pet\n" +
        "{pn} @tag/uid/reply — View another user's pets\n" +
        "{pn} compare <s1> <s2> — Compare two pets",
    },
  },

  onStart: async function ({ event, message, args, usersData }) {
    const senderID = event.senderID;
    const subcmd   = (args[0] || "").toLowerCase();

    // ── compare <slot1> <slot2> ────────────────────────────
    if (subcmd === "compare") {
      const s1 = parseInt(args[1]);
      const s2 = parseInt(args[2]);
      const userData = await usersData.get(senderID);
      const pets     = userData.data?.pets || [];

      if (!s1 || !s2 || s1 === s2) {
        return message.reply(`❌ Usage: +mypets compare <slot1> <slot2>\nExample: +mypets compare 1 3`);
      }
      if (s1 > pets.length || s2 > pets.length) {
        return message.reply(`❌ Invalid slot. You have ${pets.length} pet(s).`);
      }

      const p1 = applyDecay(pets[s1 - 1]);
      const p2 = applyDecay(pets[s2 - 1]);

      const row = (label, v1, v2, higherIsBetter = true) => {
        const w1 = higherIsBetter ? v1 >= v2 : v1 <= v2;
        const w2 = higherIsBetter ? v2 > v1  : v2 < v1;
        return (
          `  ${label.padEnd(12)} ${String(v1).padStart(6)}${w1 ? " ◀" : "  "}` +
          `  ${String(v2).padStart(6)}${w2 ? " ◀" : ""}`
        );
      };

      let compareBlock =
        `🔀 𝗣𝗘𝗧 𝗖𝗢𝗠𝗣𝗔𝗥𝗜𝗦𝗢𝗡\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `  ${"".padEnd(12)} ${p1.emoji} ${p1.name.slice(0,6).padStart(6)}  ${p2.emoji} ${p2.name.slice(0,6).padStart(6)}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📊 CARE STATS\n` +
        row("Hunger",      p1.hunger,      p2.hunger)      + "\n" +
        row("Energy",      p1.energy,      p2.energy)      + "\n" +
        row("Mood",        p1.mood,        p2.mood)        + "\n" +
        row("Cleanliness", p1.cleanliness, p2.cleanliness) + "\n" +
        row("Health",      p1.health,      p2.health)      + "\n" +
        row("Weight (kg)", p1.weight,      p2.weight, false) + "\n";

      if (p1.canBattle && p2.canBattle) {
        compareBlock +=
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `⚔️ BATTLE STATS\n` +
          row("Level",    p1.level,   p2.level)   + "\n" +
          row("ATK",      p1.atk,     p2.atk)     + "\n" +
          row("DEF",      p1.def,     p2.def)     + "\n" +
          row("Agility",  p1.agility, p2.agility) + "\n" +
          row("HP",       p1.hp,      p2.hp)      + "\n" +
          row("Wins",     p1.wins || 0, p2.wins || 0) + "\n";
      } else if (p1.canBattle !== p2.canBattle) {
        compareBlock += `━━━━━━━━━━━━━━━━━━━━━━\n`;
        compareBlock += `⚔️ ${!p1.canBattle ? p1.name : p2.name} is a companion pet (no battle stats)\n`;
      }

      compareBlock += `━━━━━━━━━━━━━━━━━━━━━━\n◀ = better value`;

      // Save decayed pets
      const newPets    = [...(userData.data?.pets || [])];
      newPets[s1 - 1]  = p1;
      newPets[s2 - 1]  = p2;
      await usersData.set(senderID, {
        ...userData,
        data: { ...(userData.data || {}), pets: newPets },
      });

      return message.reply(compareBlock);
    }

    // ── Resolve viewing target (self or other user) ────────
    let targetID   = senderID;
    let isSelf     = true;
    let targetData;

    // Check if viewing another user (non-numeric non-compare arg, or tag/reply)
    const targetInfo = resolveTarget(event, args, 0);
    const slotArg    = parseInt(args[0]);
    const isSlotView = !isNaN(slotArg) && slotArg > 0;

    if (targetInfo && !isSlotView && subcmd !== "compare") {
      targetID   = targetInfo.id;
      isSelf     = targetID === senderID;
      targetData = await usersData.get(targetID);
    } else {
      targetData = await usersData.get(senderID);
    }

    const data     = targetData?.data || {};
    const pets     = data.pets        || [];
    const maxSlots = data.petSlots    || DEFAULT_SLOTS;
    const diamonds = data.petDiamonds || 0;
    const owner    = targetData?.name || (isSelf ? "You" : targetID);

    if (!pets.length) {
      return message.reply(
        `🐾 ${isSelf ? "You have" : `${owner} has`} no pets!\n` +
        (isSelf
          ? `💡 Use +petshop or +petsmagic to buy your first pet!`
          : `💡 They haven't bought any pets yet.`)
      );
    }

    // Apply decay to all pets
    const updatedPets = pets.map(p => applyDecay(p));

    // ── Single pet detail view ─────────────────────────────
    if (isSlotView) {
      const slot = slotArg;
      if (slot < 1 || slot > pets.length) {
        return message.reply(`❌ Invalid slot. ${owner} has ${pets.length} pet(s).`);
      }
      const pet = updatedPets[slot - 1];

      // Save decay back
      if (isSelf) {
        const newPets    = [...updatedPets];
        await usersData.set(senderID, {
          ...targetData,
          data: { ...data, pets: newPets },
        });
      }

      return message.reply(buildDetailBlock(pet, slot));
    }

    // ── Full overview ──────────────────────────────────────
    // Save decay back for self
    if (isSelf) {
      await usersData.set(senderID, {
        ...targetData,
        data: { ...data, pets: updatedPets },
      });
    }

    // Count alerts across all pets
    const totalAlerts = updatedPets.reduce((s, p) => s + getAlerts(p).length, 0);
    const deadCount   = updatedPets.filter(p => p.status === "dead").length;
    const battlePets  = updatedPets.filter(p => p.canBattle && p.status !== "dead");
    const magicBeasts = updatedPets.filter(p => p.isMagic && p.status !== "dead");

    // Summary lines
    const summaryLines = updatedPets
      .map((p, i) => buildSummaryLine(p, i + 1))
      .join("\n");

    // Global warnings
    let globalWarnings = "";
    if (deadCount > 0) {
      globalWarnings += `\n💀 ${deadCount} pet${deadCount > 1 ? "s have" : " has"} died!`;
    }
    if (totalAlerts > 0) {
      globalWarnings += `\n⚠️ ${totalAlerts} alert${totalAlerts > 1 ? "s" : ""} need attention!`;
    }

    // Battle summary
    let battleSummary = "";
    if (battlePets.length) {
      const totalWins   = battlePets.reduce((s, p) => s + (p.wins || 0), 0);
      const totalLosses = battlePets.reduce((s, p) => s + (p.losses || 0), 0);
      const wr          = totalWins + totalLosses > 0
        ? Math.round((totalWins / (totalWins + totalLosses)) * 100)
        : 0;
      battleSummary =
        `\n⚔️ 𝗕𝗔𝗧𝗧𝗟𝗘 𝗦𝗨𝗠𝗠𝗔𝗥𝗬\n` +
        `  Battle pets: ${battlePets.length}${magicBeasts.length ? ` (${magicBeasts.length} magic)` : ""}\n` +
        `  Total record: ${totalWins}W / ${totalLosses}L${totalWins + totalLosses > 0 ? ` (${wr}% WR)` : ""}`;
    }

    const overview =
      `🐾 ${isSelf ? "𝗠𝗬 𝗣𝗘𝗧𝗦" : `${owner.toUpperCase()}'𝗦 𝗣𝗘𝗧𝗦`}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🏠 Slots:    ${pets.length}/${maxSlots}` +
      (isSelf ? ` | 💎 ${formatDiamonds(diamonds)}` : "") +
      `\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${summaryLines}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━` +
      `${globalWarnings}` +
      `${battleSummary}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      (isSelf
        ? `💡 +mypets <slot#> for full pet details\n` +
          `💡 +mypets compare <s1> <s2> to compare\n` +
          `💡 +petcare <action> <slot#> to care for a pet`
        : `💡 +mypets <slot#> to view a specific pet`);

    return message.reply(overview);
  },
};
