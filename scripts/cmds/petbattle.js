// ═══════════════════════════════════════════════════════════════
//   petbattle.js  —  Turn-based Pet Battle System
//
//   Targeting: @tag, UID, or reply to message (all supported)
//
//   Commands:
//     +petbattle                          — Show help & your battle pets
//     +petbattle challenge <target> <yourSlot> [theirSlot]
//       target = @tag | uid | (reply)
//     +petbattle accept                   — Accept incoming challenge
//     +petbattle decline                  — Decline challenge
//     +petbattle spectate <target>        — Watch someone's last battle
//       target = @tag | uid | (reply)
//     +petbattle record [target]          — View win/loss record
//     +petbattle top                      — Battle leaderboard
//
//   💎 Material rewards for winning with magic beasts
//   ⚔️ XP rewards for all battle pets
// ═══════════════════════════════════════════════════════════════

// ── Import shared utilities ────────────────────────────────────
let applyDecay, formatDiamonds, ARCHETYPE_MATERIAL;
try {
  const ps       = require("./petshop");
  applyDecay     = ps.applyDecay;
  formatDiamonds = ps.formatDiamonds;
} catch {
  applyDecay     = (p) => p;
  formatDiamonds = (n) => Number.isInteger(n) ? `${n}` : n.toFixed(4).replace(/\.?0+$/, "");
}
try {
  ARCHETYPE_MATERIAL = require("./petsmagic").ARCHETYPE_MATERIAL;
} catch {
  ARCHETYPE_MATERIAL = {};
}

// ── Pending challenges map ─────────────────────────────────────
// challengerID → { defenderID, challengerPet, defenderSlot, timeout, threadID, messageID }
const pendingChallenges = new Map();
// Store last battle log per user for spectate
const lastBattleLogs    = new Map();

const CHALLENGE_TIMEOUT = 60_000; // 60s to accept
const MAX_ROUNDS        = 20;
const MIN_ENERGY        = 30;
const MIN_HUNGER        = 30;
const MATERIAL_CHANCE   = 0.6;    // 60% chance to drop material on magic beast win

// ── Resolve target from event (tag / uid / reply) ─────────────
function resolveTarget(event, args, argIndex = 0) {
  // 1) Reply
  if (event.messageReply?.senderID) {
    return { id: event.messageReply.senderID, method: "reply" };
  }
  // 2) Tag
  const mentionIDs = Object.keys(event.mentions || {});
  if (mentionIDs.length > 0) {
    return { id: mentionIDs[0], method: "tag" };
  }
  // 3) UID as argument
  const candidate = args[argIndex];
  if (candidate && /^\d{10,20}$/.test(candidate)) {
    return { id: candidate, method: "uid" };
  }
  return null;
}

// ── Stat bar helper ────────────────────────────────────────────
function hpBar(current, max) {
  const pct    = Math.max(0, Math.round((current / max) * 10));
  const filled = "█".repeat(pct);
  const empty  = "░".repeat(10 - pct);
  const color  = pct >= 6 ? "💚" : pct >= 3 ? "🟡" : "🔴";
  return `${color}[${filled}${empty}] ${current}/${max}`;
}

// ── Clamp helper ───────────────────────────────────────────────
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// ══════════════════════════════════════════════════════════════
//  BATTLE ENGINE
// ══════════════════════════════════════════════════════════════

function buildBattlePet(pet) {
  // Apply overweight agility penalty
  let agiMult = 1.0;
  try {
    const { PET_CATALOG } = require("./petshop");
    const base  = PET_CATALOG[pet.catalogId]?.baseStats?.weight || 10;
    const ratio = pet.weight / base;
    if (ratio > 1.5) agiMult = 0.75;
    else if (ratio > 1.3) agiMult = 0.85;
  } catch {}

  return {
    ...pet,
    currentHp:     pet.hp,
    maxHp:         pet.maxHp || pet.hp,
    effectiveAgi:  Math.round(pet.agility * agiMult),
    // Status effect slots
    burns:         0,   // stacks of burn (inferno trait)
    bleeds:        0,   // stacks of bleed
    stunned:       false,
    frozen:        false,
    paralyzed:     false,
    agiReduction:  0,   // % reduction from permafrost/ice_slash etc.
    armorHits:     pet.trait === "armored" ? 2 : 0, // croc first 2 hits
    hasDodgedPhase: false, // void wolf used phase this battle
    hasVanished:   false,  // phantom panther vanished
    vanishTurn:    -1,
    hasReborn:     pet.trait === "rebirth" ? false : null, // phoenix rebirth
    hasBlinkStrike: pet.trait === "blink_strike" ? false : null,
    soulDrainTotal: 0,
    feedingFrenzyKills: 0,
    darknessApplied: false,
    statsDebuffed:  false,
    blindTurns:    0,    // remaining blind turns
    blinded:       false,
    inkCloudUsed:  false,
    coralReflect:  pet.trait === "coral_shield",
    divineWindUsed: pet.trait === "divine_wind" ? false : null,
    log:           [],
  };
}

function calcDamage(attacker, defender, isSpecial = false) {
  const rawAtk  = attacker.atk * (isSpecial ? 1.5 : 1.0);
  const variance = 0.85 + Math.random() * 0.30; // 0.85–1.15
  let dmg = Math.round(rawAtk * variance - defender.def * 0.4);

  // Armor hits (crocodile) — first 2 hits deal 30% less
  if (defender.armorHits > 0) {
    dmg = Math.round(dmg * 0.7);
    defender.armorHits--;
  }

  // Coral shield reflect
  if (defender.coralReflect && dmg > 0) {
    attacker.currentHp = Math.max(0, attacker.currentHp - Math.round(dmg * 0.2));
  }

  // Stats debuff from darkness (Shadowquill)
  if (attacker.statsDebuffed) dmg = Math.round(dmg * 0.85);

  return Math.max(1, dmg);
}

function tryDodge(attacker, defender) {
  // Blinded attacker misses more
  if (attacker.blinded && Math.random() < 0.35) return true;

  // Phase (Voidhowl) — 40% full dodge, once per turn attempt
  if (defender.trait === "phase" && !defender.hasDodgedPhase && Math.random() < 0.40) {
    defender.hasDodgedPhase = true;
    return true;
  }

  // Shadow step (Umbraclaw) — 60% base dodge
  if (defender.trait === "shadow_step") {
    const dodgeChance = 0.60;
    if (Math.random() < dodgeChance) return true;
  }

  // Aerial (Eagle from petshop) — 25% dodge
  if (defender.trait === "aerial" && Math.random() < 0.25) return true;

  // Standard agility-based dodge
  const total       = attacker.effectiveAgi + defender.effectiveAgi;
  const defDodgePct = total > 0 ? (defender.effectiveAgi / total) * 0.35 : 0;
  return Math.random() < defDodgePct;
}

function applyTraitOnAttack(attacker, defender, dmg) {
  const log = [];

  // Inferno — burn 8% ATK per turn
  if (attacker.trait === "inferno" && Math.random() < 0.7) {
    defender.burns = Math.min(5, (defender.burns || 0) + 1);
    log.push(`🔥 ${attacker.name} inflicts Burn! (${defender.burns} stack${defender.burns > 1 ? "s" : ""})`);
  }

  // Freeze — 25% stun
  if (attacker.trait === "freeze" && Math.random() < 0.25 && !defender.stunned) {
    defender.stunned = true;
    log.push(`❄️ ${defender.name} is FROZEN! Loses next turn!`);
  }

  // Chain Lightning — bounced in full battle engine (noted in log)
  if (attacker.trait === "chain_lightning") {
    log.push(`⚡ Chain Lightning crackles!`);
  }

  // Soul Drain — steal 12% of dmg as HP
  if (attacker.trait === "soul_drain") {
    const steal = Math.round(dmg * 0.12);
    attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + steal);
    attacker.soulDrainTotal += steal;
    log.push(`🌑 Soul Drain: +${steal} HP stolen!`);
  }

  // Hemorrhage — stacking bleed
  if (attacker.trait === "hemorrhage" && Math.random() < 0.65) {
    defender.bleeds = Math.min(5, (defender.bleeds || 0) + 1);
    log.push(`🩸 Bleed applied! (${defender.bleeds} stack${defender.bleeds > 1 ? "s" : ""})`);
  }

  // Windstrike — already baked into damage (ignores 40% DEF) — noted
  if (attacker.trait === "windstrike") {
    log.push(`🌪️ Windstrike tears through armor!`);
  }

  // Permafrost — reduce enemy AGI 30% permanently after first hit
  if (attacker.trait === "permafrost" && !defender.agiReduction) {
    defender.agiReduction  = 0.30;
    defender.effectiveAgi  = Math.round(defender.effectiveAgi * 0.70);
    log.push(`🧊 Permafrost! ${defender.name}'s agility reduced 30%!`);
  }

  // Ink Cloud (Kraelos) — 35% miss for 3 turns
  if (attacker.trait === "ink_cloud" && !attacker.inkCloudUsed && Math.random() < 0.5) {
    defender.blindTurns  = 3;
    defender.blinded     = true;
    attacker.inkCloudUsed = true;
    log.push(`🦑 Ink Cloud! ${defender.name} is blinded for 3 turns!`);
  }

  // Feeding Frenzy — ATK boost tracked (kills tracked in main loop)
  // Volt Surge — 30% paralyze
  if (attacker.trait === "volt_surge" && Math.random() < 0.30 && !defender.paralyzed) {
    defender.paralyzed = true;
    defender.stunned   = true;
    log.push(`⚡ Volt Surge! ${defender.name} is PARALYZED!`);
  }

  // Solar Flare — blind + burn on activation (use once)
  if (attacker.trait === "solar_flare" && !attacker.solarUsed && Math.random() < 0.4) {
    defender.blindTurns  = 2;
    defender.blinded     = true;
    defender.burns       = Math.min(5, (defender.burns || 0) + 2);
    attacker.solarUsed   = true;
    log.push(`🦁 Solar Flare! ${defender.name} blinded + burned!`);
  }

  // Ice Slash — slow AGI + bleed
  if (attacker.trait === "ice_slash") {
    if (!defender.iceSlashed) {
      defender.effectiveAgi  = Math.round(defender.effectiveAgi * 0.85);
      defender.iceSlashed    = true;
    }
    if (Math.random() < 0.6) {
      defender.bleeds = Math.min(5, (defender.bleeds || 0) + 1);
      log.push(`❄️🩸 Ice Slash! Slowed + bleed!`);
    }
  }

  // Darkness — reduce all enemy stats 15% at battle start (applied once)
  if (attacker.trait === "darkness" && !attacker.darknessApplied) {
    defender.atk           = Math.round(defender.atk * 0.85);
    defender.def           = Math.round(defender.def * 0.85);
    defender.effectiveAgi  = Math.round(defender.effectiveAgi * 0.85);
    defender.statsDebuffed = true;
    attacker.darknessApplied = true;
    log.push(`🌑 Darkness shrouds ${defender.name}! All stats -15%!`);
  }

  return log;
}

function applyDoTEffects(pet) {
  const log  = [];
  let   dmg  = 0;

  // Burn stacks — 8% ATK per stack (ignores DEF)
  if (pet.burns > 0) {
    const burnDmg = Math.round(pet.atk * 0.08 * pet.burns);
    pet.currentHp = Math.max(0, pet.currentHp - burnDmg);
    dmg += burnDmg;
    log.push(`🔥 Burn deals ${burnDmg} dmg! (${pet.burns} stack${pet.burns > 1 ? "s" : ""})`);
  }

  // Bleed stacks — 5% ATK per stack
  if (pet.bleeds > 0) {
    const bleedDmg = Math.round(pet.atk * 0.05 * pet.bleeds);
    pet.currentHp  = Math.max(0, pet.currentHp - bleedDmg);
    dmg += bleedDmg;
    log.push(`🩸 Bleed deals ${bleedDmg} dmg! (${pet.bleeds} stack${pet.bleeds > 1 ? "s" : ""})`);
  }

  // Holy aura regen (Auroryn) — 3% max HP
  if (pet.trait === "holy_aura" || pet.regen > 0) {
    const regenAmt = Math.round((pet.regen || pet.maxHp * 0.03));
    if (pet.currentHp < pet.maxHp) {
      pet.currentHp = Math.min(pet.maxHp, pet.currentHp + regenAmt);
      log.push(`✨ Holy Aura: +${regenAmt} HP regenerated!`);
    }
  }

  // Blind tick
  if (pet.blinded && pet.blindTurns > 0) {
    pet.blindTurns--;
    if (pet.blindTurns <= 0) {
      pet.blinded = false;
      log.push(`👁️ ${pet.name} can see again!`);
    }
  }

  // Paralysis wears off
  if (pet.paralyzed) {
    pet.paralyzed = false;
    log.push(`⚡ Paralysis fades.`);
  }

  // Stun wears off after being applied
  if (pet.stunned && !pet.frozen) {
    pet.stunned = false;
  }

  return { log, dmg };
}

// ── Main battle simulation ─────────────────────────────────────
function simulateBattle(pet1Raw, pet2Raw, name1, name2) {
  let a = buildBattlePet(pet1Raw); // challenger
  let b = buildBattlePet(pet2Raw); // defender
  a.name = name1;
  b.name = name2;

  const fullLog  = [];
  let   round    = 0;

  // Darkness at battle start
  if (a.trait === "darkness" && !a.darknessApplied) {
    const dl = applyTraitOnAttack(a, b, 0);
    dl.forEach(l => fullLog.push(l));
  }
  if (b.trait === "darkness" && !b.darknessApplied) {
    const dl = applyTraitOnAttack(b, a, 0);
    dl.forEach(l => fullLog.push(l));
  }

  while (round < MAX_ROUNDS && a.currentHp > 0 && b.currentHp > 0) {
    round++;
    fullLog.push(`\n— Round ${round} —`);

    // Determine turn order by agility
    let first  = a.effectiveAgi >= b.effectiveAgi ? a : b;
    let second = first === a ? b : a;
    if (a.effectiveAgi === b.effectiveAgi) {
      if (Math.random() < 0.5) { first = b; second = a; }
    }

    // Stealth trait — tiger cub 30% first strike override
    if (second.trait === "stealth" && Math.random() < 0.30) {
      [first, second] = [second, first];
      fullLog.push(`🐯 ${second.name} STEALTH STRIKE — moves first!`);
    }

    // Process each fighter's turn
    for (const [attacker, defender] of [[first, second], [second, first]]) {
      if (attacker.currentHp <= 0 || defender.currentHp <= 0) break;

      // Vanish (Phantclaw) — skip targeting this turn
      if (defender.hasVanished) {
        defender.hasVanished = false;
        fullLog.push(`🐆 ${defender.name} reappears from the shadows!`);
        continue;
      }

      // Stunned — skip turn
      if (attacker.stunned) {
        fullLog.push(`💫 ${attacker.name} is stunned and cannot move!`);
        attacker.stunned = false;
        attacker.frozen  = false;
        continue;
      }

      // Vanish activation — use once when HP drops below 40%
      if (attacker.trait === "vanish" && !attacker.hasVanished &&
          attacker.currentHp / attacker.maxHp < 0.40) {
        attacker.hasVanished = true;
        fullLog.push(`🐆 ${attacker.name} VANISHES into the shadows!`);
        continue;
      }

      // Blink Strike — once per battle, undodgeable
      let isBlinkStrike = false;
      if (attacker.hasBlinkStrike === false &&
          attacker.currentHp / attacker.maxHp < 0.50) {
        isBlinkStrike           = true;
        attacker.hasBlinkStrike = true;
        fullLog.push(`🐯 ${attacker.name} activates BLINK STRIKE — undodgeable!`);
      }

      // Dodge check (skip if blink strike)
      const dodged = !isBlinkStrike && tryDodge(attacker, defender);
      if (dodged) {
        fullLog.push(`💨 ${defender.name} dodges the attack!`);
        continue;
      }

      // Pack instinct (Wolf Pup) — +20% ATK below 30% HP
      let atkMult = 1.0;
      if (attacker.trait === "pack_instinct" &&
          attacker.currentHp / attacker.maxHp < 0.30) {
        atkMult = 1.20;
        fullLog.push(`🐺 ${attacker.name} enters a FRENZY! (+20% ATK)`);
      }

      // Feeding frenzy ATK boost
      if (attacker.trait === "feeding_frenzy" && attacker.feedingFrenzyKills > 0) {
        atkMult *= 1 + (attacker.feedingFrenzyKills * 0.08);
      }

      // Windstrike — ignore 40% DEF
      const effDef = attacker.trait === "windstrike"
        ? Math.round(defender.def * 0.60)
        : defender.def;
      const savedDef = defender.def;
      defender.def   = effDef;

      const dmg = Math.round(calcDamage(attacker, defender) * atkMult);
      defender.def = savedDef;

      defender.currentHp = Math.max(0, defender.currentHp - dmg);
      fullLog.push(`⚔️ ${attacker.name} attacks ${defender.name} for ${dmg} dmg!`);
      fullLog.push(`   ${hpBar(defender.currentHp, defender.maxHp)}`);

      // Trait effects on hit
      const traitLog = applyTraitOnAttack(attacker, defender, dmg);
      traitLog.forEach(l => fullLog.push(`   ${l}`));

      // Feeding frenzy kill
      if (defender.currentHp <= 0 && attacker.trait === "feeding_frenzy") {
        attacker.feedingFrenzyKills++;
      }

      // Phoenix rebirth
      if (defender.currentHp <= 0 && defender.hasReborn === false) {
        const rebirthHp       = Math.round(defender.maxHp * 0.40);
        defender.currentHp    = rebirthHp;
        defender.hasReborn    = true;
        fullLog.push(`🔥 ${defender.name} REBORN FROM ASHES! (${rebirthHp} HP)`);
      }
    }

    // DoT effects at end of round
    for (const fighter of [a, b]) {
      if (fighter.currentHp <= 0) continue;
      const { log: dotLog } = applyDoTEffects(fighter);
      dotLog.forEach(l => fullLog.push(`   ${l}`));
    }

    // Divine Wind — heal once when an ally drops below 30%
    // (In 1v1 heals self)
    for (const fighter of [a, b]) {
      if (fighter.divineWindUsed === false &&
          fighter.currentHp / fighter.maxHp < 0.30) {
        const healAmt           = Math.round(fighter.maxHp * 0.25);
        fighter.currentHp       = Math.min(fighter.maxHp, fighter.currentHp + healAmt);
        fighter.divineWindUsed  = true;
        fullLog.push(`✨ ${fighter.name} calls DIVINE WIND! Heals ${healAmt} HP!`);
      }
    }
  }

  // Determine winner
  let winner, loser;
  if (a.currentHp > b.currentHp) {
    winner = a; loser = b;
  } else if (b.currentHp > a.currentHp) {
    winner = b; loser = a;
  } else {
    // Tie — whoever has more HP percentage wins
    winner = a; loser = b;
  }

  return { winner, loser, log: fullLog, rounds: round };
}

// ── XP reward calculation ──────────────────────────────────────
function calcXP(winner, loser) {
  const base    = 40;
  const levelDiff = Math.max(0, loser.level - winner.level);
  return base + levelDiff * 10;
}

// ── Post-battle stat update ────────────────────────────────────
function applyPostBattle(pet) {
  return {
    ...pet,
    energy:          Math.max(0, pet.energy - 30),
    hunger:          Math.max(0, pet.hunger - 25),
    cleanliness:     Math.max(0, pet.cleanliness - 20),
    hp:              Math.max(1, pet.currentHp || 1),
    lastInteraction: Date.now(),
  };
}

// ── Module ─────────────────────────────────────────────────────
module.exports = {
  config: {
    name: "petbattle",
    aliases: ["pbattle", "petfight", "petpvp"],
    version: "1.0",
    author: "Charles MK",
    countDown: 5,
    role: 0,
    shortDescription: { en: "⚔️ Challenge other players to a pet battle" },
    category: "pets",
    guide: {
      en:
        "{pn}                             — Show your battle pets\n" +
        "{pn} challenge <target> <slot> [theirSlot]\n" +
        "  target = @tag | uid | reply to msg\n" +
        "{pn} accept                      — Accept a challenge\n" +
        "{pn} decline                     — Decline a challenge\n" +
        "{pn} spectate <target>           — View last battle log\n" +
        "  target = @tag | uid | reply\n" +
        "{pn} record [target]             — Win/loss record\n" +
        "{pn} top                         — Battle leaderboard",
    },
  },

  onStart: async function ({ event, message, args, usersData }) {
    const senderID  = event.senderID;
    const subcmd    = (args[0] || "").toLowerCase();
    const userData  = await usersData.get(senderID);
    const data      = userData.data || {};
    const pets      = data.pets || [];

    // ── No subcommand — show battle pets ──────────────────
    if (!subcmd) {
      const battlePets = pets
        .map((p, i) => ({ ...applyDecay(p), slot: i + 1 }))
        .filter(p => p.canBattle && p.status !== "dead");

      if (!battlePets.length) {
        return message.reply(
          `⚔️ 𝗣𝗘𝗧 𝗕𝗔𝗧𝗧𝗟𝗘\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `❌ You have no battle-ready pets!\n` +
          `💡 Buy battle pets from +petshop or +petsmagic`
        );
      }

      const lines = battlePets.map(p =>
        `  Slot ${p.slot}: ${p.emoji} ${p.name}${p.isMagic ? " ✦" : ""}\n` +
        `    Lv.${p.level} | ⚔️${p.atk} 🛡️${p.def} 💨${p.agility}\n` +
        `    ❤️ ${hpBar(p.hp, p.maxHp)}\n` +
        `    🏆 ${p.wins || 0}W / ${p.losses || 0}L\n` +
        `    🧬 ${p.traitDesc || p.trait}`
      ).join("\n");

      return message.reply(
        `⚔️ 𝗬𝗢𝗨𝗥 𝗕𝗔𝗧𝗧𝗟𝗘 𝗣𝗘𝗧𝗦\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${lines}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `✦ = Magic Beast\n` +
        `💡 +petbattle challenge <@tag|uid|reply> <slot>`
      );
    }

    // ── challenge ─────────────────────────────────────────
    if (subcmd === "challenge") {
      // Resolve target — support reply, tag, uid
      // Args shift: if reply used, slot args start at index 1
      // If tag/uid used, slot args start at index 2
      let targetInfo = null;
      let slotArgStart = 1;

      if (event.messageReply?.senderID) {
        targetInfo    = { id: event.messageReply.senderID, method: "reply" };
        slotArgStart  = 1; // +petbattle challenge <mySlot> [theirSlot]
      } else {
        const mentionIDs = Object.keys(event.mentions || {});
        if (mentionIDs.length > 0) {
          targetInfo   = { id: mentionIDs[0], method: "tag" };
          slotArgStart = 2; // +petbattle challenge @tag <mySlot> [theirSlot]
        } else if (args[1] && /^\d{10,20}$/.test(args[1])) {
          targetInfo   = { id: args[1], method: "uid" };
          slotArgStart = 2; // +petbattle challenge <uid> <mySlot> [theirSlot]
        }
      }

      if (!targetInfo) {
        return message.reply(
          `❌ No target specified.\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Ways to target:\n` +
          `  • Reply to their message, then: +petbattle challenge <slot>\n` +
          `  • Tag them: +petbattle challenge @name <slot>\n` +
          `  • Use UID: +petbattle challenge 100012345 <slot>`
        );
      }

      if (targetInfo.id === senderID) {
        return message.reply(`❌ You can't battle yourself!`);
      }

      const mySlot    = parseInt(args[slotArgStart]);
      const theirSlot = parseInt(args[slotArgStart + 1]) || null;

      if (!mySlot || mySlot < 1 || mySlot > pets.length) {
        return message.reply(`❌ Invalid slot. You have ${pets.length} pet(s). Use +petbattle to see your battle pets.`);
      }

      const myPet = applyDecay(pets[mySlot - 1]);
      if (!myPet.canBattle) {
        return message.reply(`❌ ${myPet.emoji} ${myPet.name} is a companion pet and cannot battle.`);
      }
      if (myPet.status === "dead") {
        return message.reply(`💀 ${myPet.emoji} ${myPet.name} is dead and cannot battle.`);
      }
      if (myPet.energy < MIN_ENERGY) {
        return message.reply(
          `😴 ${myPet.emoji} ${myPet.name} is too tired to battle!\n` +
          `⚡ Energy: ${myPet.energy}/100 (need ${MIN_ENERGY}+)\n` +
          `💡 Use +petcare sleep ${mySlot}`
        );
      }
      if (myPet.hunger < MIN_HUNGER) {
        return message.reply(
          `🍖 ${myPet.emoji} ${myPet.name} is too hungry to battle!\n` +
          `🍖 Hunger: ${myPet.hunger}/100 (need ${MIN_HUNGER}+)\n` +
          `💡 Use +petcare feed ${mySlot}`
        );
      }

      // Check if challenger already has a pending challenge
      if (pendingChallenges.has(senderID)) {
        clearTimeout(pendingChallenges.get(senderID).timeout);
        pendingChallenges.delete(senderID);
      }

      // Fetch defender info for display
      const defenderData = await usersData.get(targetInfo.id);
      const defenderName = defenderData?.name || `User (${targetInfo.id})`;

      const timeout = setTimeout(() => {
        pendingChallenges.delete(senderID);
        message.reply(`⏱️ Challenge to ${defenderName} expired — no response in 60s.`);
      }, CHALLENGE_TIMEOUT);

      pendingChallenges.set(senderID, {
        defenderID:   targetInfo.id,
        challengerPet: myPet,
        challengerSlot: mySlot,
        defenderSlot:  theirSlot,
        timeout,
        threadID:     event.threadID,
        challengerID: senderID,
        challengerName: userData.name || "Challenger",
      });

      const senderName = userData.name || "Someone";
      return message.reply(
        `⚔️ 𝗣𝗘𝗧 𝗕𝗔𝗧𝗧𝗟𝗘 𝗖𝗛𝗔𝗟𝗟𝗘𝗡𝗚𝗘!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🥊 ${senderName} challenges ${defenderName}!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${myPet.emoji} ${myPet.name} (${myPet.species})\n` +
        `  Lv.${myPet.level} | ⚔️${myPet.atk} 🛡️${myPet.def} 💨${myPet.agility}\n` +
        `  ❤️ ${myPet.hp}/${myPet.maxHp}\n` +
        `  🧬 ${myPet.traitDesc || myPet.trait}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📢 @${defenderName}: Reply with:\n` +
        `  +petbattle accept [slot#]   — Accept\n` +
        `  +petbattle decline          — Decline\n` +
        `⏱️ 60 seconds to respond!`
      );
    }

    // ── accept ────────────────────────────────────────────
    if (subcmd === "accept") {
      // Find a challenge directed at this user
      let challenge = null;
      let challengerID = null;
      for (const [cID, ch] of pendingChallenges.entries()) {
        if (ch.defenderID === senderID) {
          challenge    = ch;
          challengerID = cID;
          break;
        }
      }

      if (!challenge) {
        return message.reply(`❌ You have no pending challenge to accept.`);
      }

      // Pick defender's pet
      const defenderPets = pets;
      let defSlot = parseInt(args[1]) || challenge.defenderSlot;

      // Auto-pick first valid battle pet if no slot given
      if (!defSlot) {
        const firstBattle = defenderPets.findIndex(
          p => p.canBattle && p.status !== "dead" &&
               p.energy >= MIN_ENERGY && p.hunger >= MIN_HUNGER
        );
        if (firstBattle === -1) {
          clearTimeout(challenge.timeout);
          pendingChallenges.delete(challengerID);
          return message.reply(
            `❌ You have no battle-ready pets!\n` +
            `All your battle pets are tired, hungry, or dead.\n` +
            `💡 Use +petcare to prepare your pets.`
          );
        }
        defSlot = firstBattle + 1;
      }

      if (defSlot < 1 || defSlot > defenderPets.length) {
        return message.reply(`❌ Invalid slot. You have ${defenderPets.length} pet(s).`);
      }

      const defPet = applyDecay(defenderPets[defSlot - 1]);
      if (!defPet.canBattle) {
        return message.reply(`❌ ${defPet.emoji} ${defPet.name} cannot battle. Choose a battle pet.`);
      }
      if (defPet.status === "dead") {
        return message.reply(`💀 ${defPet.emoji} ${defPet.name} is dead!`);
      }
      if (defPet.energy < MIN_ENERGY) {
        return message.reply(
          `😴 ${defPet.emoji} ${defPet.name} is too tired! (Energy: ${defPet.energy})\n` +
          `💡 +petcare sleep ${defSlot}`
        );
      }
      if (defPet.hunger < MIN_HUNGER) {
        return message.reply(
          `🍖 ${defPet.emoji} ${defPet.name} is too hungry! (Hunger: ${defPet.hunger})\n` +
          `💡 +petcare feed ${defSlot}`
        );
      }

      // Clear challenge
      clearTimeout(challenge.timeout);
      pendingChallenges.delete(challengerID);

      const challPet   = challenge.challengerPet;
      const challName  = challenge.challengerName;
      const defName    = userData.name || "Defender";

      await message.reply(
        `⚔️ 𝗕𝗔𝗧𝗧𝗟𝗘 𝗦𝗧𝗔𝗥𝗧𝗦!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${challPet.emoji} ${challPet.name} (${challName})\n` +
        `  Lv.${challPet.level} | ⚔️${challPet.atk} 🛡️${challPet.def} 💨${challPet.agility} ❤️${challPet.hp}\n` +
        `  🧬 ${challPet.traitDesc || challPet.trait}\n` +
        `  VS\n` +
        `${defPet.emoji} ${defPet.name} (${defName})\n` +
        `  Lv.${defPet.level} | ⚔️${defPet.atk} 🛡️${defPet.def} 💨${defPet.agility} ❤️${defPet.hp}\n` +
        `  🧬 ${defPet.traitDesc || defPet.trait}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚡ Simulating battle...`
      );

      // ── Run battle ──────────────────────────────────────
      const { winner, loser, log: battleLog, rounds } =
        simulateBattle(challPet, defPet, challPet.name, defPet.name);

      const challengerWon = winner.name === challPet.name;
      const winnerOwnerID  = challengerWon ? challengerID : senderID;
      const loserOwnerID   = challengerWon ? senderID : challengerID;
      const winnerPetSlot  = challengerWon ? challenge.challengerSlot : defSlot;
      const loserPetSlot   = challengerWon ? defSlot : challenge.challengerSlot;

      // Fetch both users
      const [challUserData, defUserData] = await Promise.all([
        usersData.get(challengerID),
        usersData.get(senderID),
      ]);

      // Update both pets
      async function updatePetOwner(ownerData, ownerID, petSlot, battlePet, won) {
        const ownerPets     = ownerData.data?.pets || [];
        const updatedPets   = [...ownerPets];
        const xpGain        = won ? calcXP(winner, loser) : Math.floor(calcXP(winner, loser) * 0.3);
        let   updatedPet    = applyPostBattle({ ...ownerPets[petSlot - 1], ...battlePet });
        updatedPet.xp       = (updatedPet.xp || 0) + xpGain;
        updatedPet.wins     = (updatedPet.wins || 0) + (won ? 1 : 0);
        updatedPet.losses   = (updatedPet.losses || 0) + (won ? 0 : 1);

        // Level up processing
        const xpNeeded = (lvl) => Math.floor(100 * Math.pow(1.2, lvl - 1));
        while (updatedPet.xp >= xpNeeded(updatedPet.level) && !updatedPet.isMagic) {
          updatedPet.xp    -= xpNeeded(updatedPet.level);
          updatedPet.level += 1;
          updatedPet.atk    = (updatedPet.atk || 0) + 3;
          updatedPet.def    = (updatedPet.def || 0) + 3;
        }

        updatedPets[petSlot - 1] = updatedPet;

        // Material drop for magic beast winner
        let matDropMsg = "";
        const newData  = { ...(ownerData.data || {}), pets: updatedPets };
        if (won && updatedPet.isMagic && Math.random() < MATERIAL_CHANCE) {
          const matKey       = updatedPet.matKey;
          newData[matKey]    = (newData[matKey] || 0) + 1;
          const matEmoji     = updatedPet.matEmoji || "🔷";
          const matName      = updatedPet.matName  || "Material";
          matDropMsg         = `\n${matEmoji} Material drop: +1 ${matName}!`;
        }

        await usersData.set(ownerID, { ...ownerData, data: newData });
        return { xpGain, matDropMsg, updatedPet };
      }

      const [winRes, loseRes] = await Promise.all([
        updatePetOwner(
          challengerWon ? challUserData : defUserData,
          winnerOwnerID, winnerPetSlot, winner, true
        ),
        updatePetOwner(
          challengerWon ? defUserData : challUserData,
          loserOwnerID, loserPetSlot, loser, false
        ),
      ]);

      // Build condensed battle log (last 10 lines to avoid message spam)
      const logPreview = battleLog.slice(-15).join("\n");

      const resultMsg =
        `⚔️ 𝗕𝗔𝗧𝗧𝗟𝗘 𝗢𝗩𝗘𝗥! (${rounds} rounds)\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🏆 WINNER: ${winner.name}\n` +
        `  ❤️ ${hpBar(winner.currentHp, winner.maxHp)}\n` +
        `  ✨ +${winRes.xpGain} XP${winRes.matDropMsg}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💀 DEFEATED: ${loser.name}\n` +
        `  ❤️ ${hpBar(Math.max(0, loser.currentHp), loser.maxHp)}\n` +
        `  ✨ +${loseRes.xpGain} XP (consolation)\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📋 Battle Highlights:\n${logPreview}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 Full log: +petbattle spectate (reply to this)`;

      // Store full log for spectate
      const fullBattleRecord = {
        timestamp:   Date.now(),
        challName, defName,
        winnerName:  winner.name,
        loserName:   loser.name,
        rounds,
        log:         battleLog,
      };
      lastBattleLogs.set(challengerID, fullBattleRecord);
      lastBattleLogs.set(senderID,     fullBattleRecord);

      return message.reply(resultMsg);
    }

    // ── decline ───────────────────────────────────────────
    if (subcmd === "decline") {
      let found = false;
      for (const [cID, ch] of pendingChallenges.entries()) {
        if (ch.defenderID === senderID) {
          clearTimeout(ch.timeout);
          pendingChallenges.delete(cID);
          found = true;
          message.reply(`❌ ${userData.name || "Defender"} declined the challenge.`);
          break;
        }
      }
      if (!found) return message.reply(`❌ You have no pending challenge to decline.`);
    }

    // ── spectate ──────────────────────────────────────────
    if (subcmd === "spectate") {
      let targetID = null;

      if (event.messageReply?.senderID) {
        targetID = event.messageReply.senderID;
      } else {
        const mentionIDs = Object.keys(event.mentions || {});
        if (mentionIDs.length > 0) {
          targetID = mentionIDs[0];
        } else if (args[1] && /^\d{10,20}$/.test(args[1])) {
          targetID = args[1];
        } else {
          targetID = senderID; // default: own last battle
        }
      }

      const record = lastBattleLogs.get(targetID);
      if (!record) {
        return message.reply(
          `📋 No recent battle found for this user.\n` +
          `Battles are stored in memory until the bot restarts.`
        );
      }

      const fullLog = record.log.join("\n");
      // Split into chunks if too long
      const MAX_LEN = 1800;
      if (fullLog.length > MAX_LEN) {
        const parts = [];
        let   buf   = "";
        for (const line of record.log) {
          if ((buf + "\n" + line).length > MAX_LEN) {
            parts.push(buf);
            buf = line;
          } else {
            buf += (buf ? "\n" : "") + line;
          }
        }
        if (buf) parts.push(buf);

        await message.reply(
          `📋 𝗕𝗔𝗧𝗧𝗟𝗘 𝗟𝗢𝗚 (${record.challName} vs ${record.defName})\n` +
          `🏆 Winner: ${record.winnerName} | ${record.rounds} rounds\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `(Sending in ${parts.length} parts...)`
        );
        for (let i = 0; i < parts.length; i++) {
          await message.reply(`Part ${i + 1}/${parts.length}:\n${parts[i]}`);
        }
        return;
      }

      return message.reply(
        `📋 𝗕𝗔𝗧𝗧𝗟𝗘 𝗟𝗢𝗚\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${record.challName} vs ${record.defName}\n` +
        `🏆 Winner: ${record.winnerName} | ${record.rounds} rounds\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${fullLog}`
      );
    }

    // ── record ────────────────────────────────────────────
    if (subcmd === "record") {
      let targetID   = senderID;
      let targetData = userData;

      // Support tag/uid/reply for viewing others' records
      const tInfo = resolveTarget(event, args, 1);
      if (tInfo) {
        targetID   = tInfo.id;
        targetData = await usersData.get(targetID);
      }

      const tPets  = targetData?.data?.pets || [];
      const battle = tPets.filter(p => p.canBattle);

      if (!battle.length) {
        return message.reply(`❌ ${targetData?.name || "This user"} has no battle pets.`);
      }

      const lines = battle.map((p, i) =>
        `  ${p.emoji} ${p.name} (Lv.${p.level})\n` +
        `  🏆 ${p.wins || 0}W / ${p.losses || 0}L | ` +
        `WR: ${p.wins + p.losses > 0
          ? Math.round((p.wins / (p.wins + p.losses)) * 100)
          : 0}%`
      ).join("\n");

      return message.reply(
        `📊 𝗕𝗔𝗧𝗧𝗟𝗘 𝗥𝗘𝗖𝗢𝗥𝗗\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 ${targetData?.name || targetID}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${lines}`
      );
    }

    // ── top ───────────────────────────────────────────────
    if (subcmd === "top" || subcmd === "leaderboard") {
      const allUsers = await usersData.getAll();
      const ranked   = [];

      for (const [id, u] of Object.entries(allUsers)) {
        const battlePets = (u.data?.pets || []).filter(p => p.canBattle);
        const totalWins  = battlePets.reduce((s, p) => s + (p.wins || 0), 0);
        const totalLoss  = battlePets.reduce((s, p) => s + (p.losses || 0), 0);
        if (totalWins > 0) {
          ranked.push({
            name: u.name || "Unknown",
            wins: totalWins,
            losses: totalLoss,
            wr: totalWins + totalLoss > 0
              ? Math.round((totalWins / (totalWins + totalLoss)) * 100)
              : 0,
          });
        }
      }

      ranked.sort((a, b) => b.wins - a.wins || b.wr - a.wr);
      const top10  = ranked.slice(0, 10);
      const medals = ["🥇", "🥈", "🥉"];

      if (!top10.length) {
        return message.reply(`⚔️ No battles recorded yet! Be the first!`);
      }

      const lines = top10.map((u, i) =>
        `${medals[i] || `${i + 1}.`} ${u.name}\n` +
        `   🏆 ${u.wins}W ${u.losses}L | WR: ${u.wr}%`
      ).join("\n");

      return message.reply(
        `⚔️ 𝗣𝗘𝗧 𝗕𝗔𝗧𝗧𝗟𝗘 𝗟𝗘𝗔𝗗𝗘𝗥𝗕𝗢𝗔𝗥𝗗\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${lines}`
      );
    }

    return message.reply(
      `❓ Unknown command.\nUse +petbattle for help.`
    );
  },
};
