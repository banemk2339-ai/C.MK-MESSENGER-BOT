// ═══════════════════════════════════════════════════════════════
//   petcare.js  —  Take care of your pets
//
//   Actions:
//     +petcare feed <slot#> [amount]  — Feed your pet
//     +petcare wash <slot#>           — Wash your pet
//     +petcare play <slot#>           — Play with your pet
//     +petcare sleep <slot#>          — Put your pet to sleep
//     +petcare walk <slot#>           — Take your pet for a walk
//     +petcare train <slot#>          — Train your pet (battle pets only)
//     +petcare medicine <slot#>       — Give medicine (when sick/critical)
//     +petcare groom <slot#>          — Groom your pet
//     +petcare status <slot#>         — Quick status check
//     +petcare all                    — Quick status of all pets
//
//   💎 Medicine costs 0.5💎 per use
//   🍖 Food uses are free but limited by what's sensible
// ═══════════════════════════════════════════════════════════════

// ── Import decay engine from petshop ──────────────────────────
// Since GoatBot loads all scripts, we reference petshop's exports
// via a try/catch in case load order varies
let applyDecay, statBar, statusEmoji, weightStatus, formatDiamonds;
try {
  const petshop    = require("./petshop");
  applyDecay       = petshop.applyDecay;
  statBar          = petshop.statBar;
  statusEmoji      = petshop.statusEmoji;
  weightStatus     = petshop.weightStatus;
  formatDiamonds   = petshop.formatDiamonds;
} catch {
  // Fallback implementations if petshop isn't loaded yet
  applyDecay     = (p) => p;
  statBar        = (v, m = 100) => { const f = Math.round((v/m)*10); return "█".repeat(f) + "░".repeat(10-f); };
  statusEmoji    = (s) => ({ healthy:"💚", hungry:"🟡", starving:"🟠", critical:"🔴", dead:"💀" }[s] || "💚");
  weightStatus   = (p) => "✅ Normal";
  formatDiamonds = (n) => Number.isInteger(n) ? `${n}` : n.toFixed(4).replace(/\.?0+$/, "");
}

const MEDICINE_COST = 0.5; // diamonds

// ── Parrot fun messages (vocal trait) ─────────────────────────
const PARROT_PHRASES = [
  "Squawk! Feed me more crackers! 🦜",
  "Pretty bird wants a diamond! 💎",
  "I can talk better than you! 😤",
  "Polly wants world domination! 🌍",
  "Did you know parrots live 80 years? You're stuck with me! 😂",
  "SQUAAAWK! Someone's at the door! 🚪",
  "I heard what you said last night... 👀",
  "Teach me bad words! ...Please? 🙏",
];

// ── Food items with effects ────────────────────────────────────
const FOOD_TIERS = [
  { name: "Small Snack",   hungerGain: 15, weightGain: 0.05, emoji: "🍪" },
  { name: "Regular Meal",  hungerGain: 35, weightGain: 0.15, emoji: "🍖" },
  { name: "Big Meal",      hungerGain: 60, weightGain: 0.30, emoji: "🍗" },
  { name: "Feast",         hungerGain: 90, weightGain: 0.50, emoji: "🥩" },
];

// ── Training XP rewards ────────────────────────────────────────
const TRAIN_XP_BASE   = 25;
const TRAIN_XP_LEVEL_MULT = 1.2; // XP needed per level scales up
const TRAIN_STAT_GAIN = 3;        // flat stat gain per training

// ── Helper: get food tier from arg ────────────────────────────
function parseFoodTier(arg) {
  if (!arg) return FOOD_TIERS[1]; // default: Regular Meal
  const n = parseInt(arg);
  if (!isNaN(n) && n >= 1 && n <= 4) return FOOD_TIERS[n - 1];
  const name = arg.toLowerCase();
  if (name.includes("small") || name.includes("snack"))   return FOOD_TIERS[0];
  if (name.includes("big"))                                return FOOD_TIERS[2];
  if (name.includes("feast"))                             return FOOD_TIERS[3];
  return FOOD_TIERS[1];
}

// ── XP needed to reach next level ─────────────────────────────
function xpForLevel(level) {
  return Math.floor(100 * Math.pow(TRAIN_XP_LEVEL_MULT, level - 1));
}

// ── Apply level ups from XP ────────────────────────────────────
function processLevelUp(pet) {
  if (!pet.canBattle) return { pet, leveledUp: false, newLevel: pet.level };
  let leveled = false;
  let p       = { ...pet };
  while (p.xp >= xpForLevel(p.level)) {
    p.xp   -= xpForLevel(p.level);
    p.level += 1;
    leveled  = true;
    // Common pets get small stat boosts on level up
    if (!p.isMagic) {
      p.atk     = (p.atk     || 0) + TRAIN_STAT_GAIN;
      p.def     = (p.def     || 0) + TRAIN_STAT_GAIN;
      p.agility = (p.agility || 0) + Math.floor(TRAIN_STAT_GAIN / 2);
    }
    // Magic beasts are leveled via +petsmagic upgrade, not training XP
  }
  return { pet: p, leveled, newLevel: p.level };
}

// ── Weight penalty check ───────────────────────────────────────
function getWeightPenalty(pet) {
  const { PET_CATALOG } = (() => { try { return require("./petshop"); } catch { return { PET_CATALOG: {} }; } })();
  const base  = PET_CATALOG[pet.catalogId]?.baseStats?.weight || 10;
  const ratio = pet.weight / base;
  if (ratio > 1.5) return { penalty: true, msg: "⚖️ Overweight! Speed and agility reduced in battles." };
  if (ratio > 1.3) return { penalty: true, msg: "🍖 Chubby! Slight speed reduction in battles." };
  return { penalty: false, msg: null };
}

// ── Build a compact status string for one pet ──────────────────
function buildStatusBlock(pet, slot) {
  const dead = pet.status === "dead";
  if (dead) {
    return (
      `Slot ${slot}: ${pet.emoji} ${pet.name} (${pet.species})\n` +
      `  💀 DEAD — Use +petshop release ${slot} to clear slot`
    );
  }
  const wp = getWeightPenalty(pet);
  return (
    `Slot ${slot}: ${pet.emoji} ${pet.name} (${pet.species})\n` +
    `  ${statusEmoji(pet.status)} Status: ${pet.status.toUpperCase()}\n` +
    `  🍖 Hunger:       [${statBar(pet.hunger)}] ${pet.hunger}/100\n` +
    `  ⚡ Energy:       [${statBar(pet.energy)}] ${pet.energy}/100\n` +
    `  😊 Mood:         [${statBar(pet.mood)}] ${pet.mood}/100\n` +
    `  🛁 Cleanliness:  [${statBar(pet.cleanliness)}] ${pet.cleanliness}/100\n` +
    `  ❤️ Health:       [${statBar(pet.health)}] ${pet.health}/100\n` +
    `  ⚖️ Weight:       ${pet.weight}kg (${weightStatus(pet)})\n` +
    (pet.canBattle
      ? `  🏆 Battle:  Lv.${pet.level} | W:${pet.wins || 0} L:${pet.losses || 0}\n` +
        `  ⚔️ ATK:${pet.atk} DEF:${pet.def} AGI:${pet.agility} HP:${pet.hp}/${pet.maxHp}\n`
      : "") +
    (wp.penalty ? `  ${wp.msg}\n` : "")
  );
}

module.exports = {
  config: {
    name: "petcare",
    aliases: ["pcare", "pet", "feedpet"],
    version: "1.0",
    author: "Charles MK",
    countDown: 3,
    role: 0,
    shortDescription: { en: "🐾 Care for your pets" },
    category: "pets",
    guide: {
      en:
        "{pn} feed <slot#> [1-4]     — Feed (1=snack, 4=feast)\n" +
        "{pn} wash <slot#>            — Wash your pet\n" +
        "{pn} play <slot#>            — Play with your pet\n" +
        "{pn} sleep <slot#>           — Let your pet rest\n" +
        "{pn} walk <slot#>            — Walk your pet\n" +
        "{pn} train <slot#>           — Train (battle pets)\n" +
        "{pn} medicine <slot#>        — Heal (costs 💎0.5)\n" +
        "{pn} groom <slot#>           — Groom your pet\n" +
        "{pn} status <slot#>          — Check one pet\n" +
        "{pn} all                     — Check all pets",
    },
  },

  onStart: async function ({ event, message, args, usersData }) {
    const senderID = event.senderID;
    const subcmd   = (args[0] || "").toLowerCase();
    const userData = await usersData.get(senderID);
    const data     = userData.data || {};
    const pets     = data.pets || [];

    if (!subcmd) {
      return message.reply(
        `🐾 𝗣𝗘𝗧 𝗖𝗔𝗥𝗘\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Commands:\n` +
        `  +petcare feed <slot> [1-4]\n` +
        `  +petcare wash <slot>\n` +
        `  +petcare play <slot>\n` +
        `  +petcare sleep <slot>\n` +
        `  +petcare walk <slot>\n` +
        `  +petcare train <slot>\n` +
        `  +petcare medicine <slot>  (💎0.5)\n` +
        `  +petcare groom <slot>\n` +
        `  +petcare status <slot>\n` +
        `  +petcare all`
      );
    }

    // ── all — show all pets status ─────────────────────────
    if (subcmd === "all") {
      if (!pets.length) {
        return message.reply(
          `🐾 You have no pets!\n` +
          `💡 Use +petshop or +petsmagic to buy one.`
        );
      }
      const updatedPets = pets.map(p => applyDecay(p));
      const blocks      = updatedPets.map((p, i) => buildStatusBlock(p, i + 1)).join("\n─────────────────────\n");

      // Save decayed stats back
      await usersData.set(senderID, {
        ...userData,
        data: { ...data, pets: updatedPets },
      });

      return message.reply(
        `🐾 𝗔𝗟𝗟 𝗣𝗘𝗧𝗦 𝗦𝗧𝗔𝗧𝗨𝗦\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${blocks}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 Use +petcare <action> <slot#> to care for a pet`
      );
    }

    // ── All other commands need a slot number ──────────────
    if (subcmd === "status") {
      const slot = parseInt(args[1]);
      if (!slot || slot < 1 || slot > pets.length) {
        return message.reply(`❌ Invalid slot. You have ${pets.length} pet(s).`);
      }
      const pet = applyDecay(pets[slot - 1]);
      const newPets = [...pets];
      newPets[slot - 1] = pet;
      await usersData.set(senderID, { ...userData, data: { ...data, pets: newPets } });

      return message.reply(
        `🐾 𝗣𝗘𝗧 𝗦𝗧𝗔𝗧𝗨𝗦\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${buildStatusBlock(pet, slot)}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 +petcare feed/wash/play/train/sleep/walk ${slot}`
      );
    }

    // ── Shared slot validation for all remaining commands ──
    const slot = parseInt(args[1]);
    if (!slot || slot < 1 || slot > pets.length) {
      return message.reply(`❌ Invalid slot number. You have ${pets.length} pet(s).`);
    }

    let pet = applyDecay(pets[slot - 1]);

    // Block most actions on dead pets
    if (pet.status === "dead" && subcmd !== "status") {
      return message.reply(
        `💀 ${pet.emoji} ${pet.name} has passed away.\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `They are gone and cannot be cared for.\n` +
        `💔 Use +petshop release ${slot} to clear the slot.`
      );
    }

    const now = Date.now();
    let reply  = "";
    let extras = {};  // additional data fields to save

    // ══════════════════════════════════════════════════════════
    //  FEED
    // ══════════════════════════════════════════════════════════
    if (subcmd === "feed") {
      const food = parseFoodTier(args[2]);

      // Overfeeding check
      if (pet.hunger >= 95) {
        return message.reply(
          `🚫 ${pet.emoji} ${pet.name} is NOT hungry!\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🍖 Hunger: [${statBar(pet.hunger)}] ${pet.hunger}/100\n\n` +
          `⚠️ Overfeeding causes weight gain and health issues!\n` +
          `💡 Wait until hunger drops below 80 before feeding again.`
        );
      }

      // Warning on overfeeding when not really hungry
      let overfeedWarning = "";
      if (pet.hunger > 70) {
        overfeedWarning = `\n⚠️ Your pet wasn't very hungry — weight gained slightly!`;
      }

      // Apply rabbit trait (no weight penalty)
      const isRabbit = pet.trait === "fluffy";
      const weightGain = isRabbit ? food.weightGain * 0.3 : food.weightGain;

      // Check overweight health effect
      const { PET_CATALOG } = (() => { try { return require("./petshop"); } catch { return { PET_CATALOG: {} }; } })();
      const base  = PET_CATALOG[pet.catalogId]?.baseStats?.weight || 10;
      const newWeight = parseFloat((pet.weight + weightGain).toFixed(2));
      const ratio = newWeight / base;
      let healthDmg = 0;
      let overweightMsg = "";
      if (ratio > 1.5 && !isRabbit) {
        healthDmg    = 3;
        overweightMsg = `\n⚠️ Overweight! ${pet.name} is developing health issues (-${healthDmg} health).`;
      }

      const newHunger = Math.min(100, pet.hunger + food.hungerGain);
      const moodBoost = pet.hunger < 30 ? 15 : 5; // Extra mood if was very hungry

      pet = {
        ...pet,
        hunger:          newHunger,
        mood:            Math.min(100, pet.mood + moodBoost),
        weight:          newWeight,
        health:          Math.max(0, pet.health - healthDmg),
        lastFed:         now,
        lastInteraction: now,
      };

      // Parrot says something
      const parrotQuip = pet.trait === "vocal"
        ? `\n🦜 "${PARROT_PHRASES[Math.floor(Math.random() * PARROT_PHRASES.length)]}"`
        : "";

      reply =
        `${food.emoji} 𝗙𝗘𝗗 ${pet.name.toUpperCase()}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🍽️ Meal:   ${food.name}\n` +
        `🍖 Hunger: [${statBar(pet.hunger)}] ${pet.hunger}/100\n` +
        `😊 Mood:   [${statBar(pet.mood)}] ${pet.mood}/100\n` +
        `⚖️ Weight: ${pet.weight}kg\n` +
        `${overfeedWarning}${overweightMsg}${parrotQuip}`;
    }

    // ══════════════════════════════════════════════════════════
    //  WASH
    // ══════════════════════════════════════════════════════════
    else if (subcmd === "wash") {
      // Clownfish can't be washed (they live in water)
      if (pet.trait === "aquatic") {
        return message.reply(
          `💦 ${pet.emoji} ${pet.name} lives in water — they're always clean!\n` +
          `No washing needed for aquatic pets.`
        );
      }

      if (pet.cleanliness >= 90) {
        return message.reply(
          `🛁 ${pet.emoji} ${pet.name} is already clean!\n` +
          `Cleanliness: [${statBar(pet.cleanliness)}] ${pet.cleanliness}/100`
        );
      }

      const moodChange = pet.trait === "independent" ? -5 : 8; // Cats hate baths
      pet = {
        ...pet,
        cleanliness:     Math.min(100, pet.cleanliness + 60),
        mood:            Math.min(100, Math.max(0, pet.mood + moodChange)),
        energy:          Math.max(0, pet.energy - 5),
        lastWashed:      now,
        lastInteraction: now,
      };

      const catComplaint = pet.trait === "independent"
        ? `\n😾 Your cat is NOT happy about this bath...` : "";

      reply =
        `🛁 ${pet.name.toUpperCase()} IS CLEAN!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🛁 Cleanliness: [${statBar(pet.cleanliness)}] ${pet.cleanliness}/100\n` +
        `😊 Mood:        [${statBar(pet.mood)}] ${pet.mood}/100\n` +
        `${catComplaint}`;
    }

    // ══════════════════════════════════════════════════════════
    //  PLAY
    // ══════════════════════════════════════════════════════════
    else if (subcmd === "play") {
      if (pet.energy < 15) {
        return message.reply(
          `😴 ${pet.emoji} ${pet.name} is too tired to play!\n` +
          `⚡ Energy: [${statBar(pet.energy)}] ${pet.energy}/100\n` +
          `💡 Use +petcare sleep ${slot} to restore energy first.`
        );
      }
      if (pet.hunger < 20) {
        return message.reply(
          `🍖 ${pet.emoji} ${pet.name} is too hungry to play!\n` +
          `🍖 Hunger: [${statBar(pet.hunger)}] ${pet.hunger}/100\n` +
          `💡 Feed your pet first with +petcare feed ${slot}`
        );
      }

      // Weight drops slightly from exercise
      const weightLoss = parseFloat((pet.weight * 0.01).toFixed(2));

      // Loyalty trait (dogs) get double mood boost
      const moodBoost = pet.trait === "loyal" ? 25 : 18;

      pet = {
        ...pet,
        energy:          Math.max(0, pet.energy - 20),
        hunger:          Math.max(0, pet.hunger - 12),
        mood:            Math.min(100, pet.mood + moodBoost),
        cleanliness:     Math.max(0, pet.cleanliness - 15),
        weight:          Math.max(0.01, parseFloat((pet.weight - weightLoss).toFixed(2))),
        lastPlayed:      now,
        lastInteraction: now,
      };

      const activities = [
        "chased their tail", "jumped around excitedly",
        "played fetch", "rolled in the grass",
        "did zoomies around the room", "tackled a toy",
      ];
      const activity = activities[Math.floor(Math.random() * activities.length)];

      reply =
        `🎮 𝗣𝗟𝗔𝗬𝗧𝗜𝗠𝗘 𝗪𝗜𝗧𝗛 ${pet.name.toUpperCase()}!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${pet.emoji} ${pet.name} ${activity}!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `😊 Mood:   [${statBar(pet.mood)}] ${pet.mood}/100 (+${moodBoost})\n` +
        `⚡ Energy: [${statBar(pet.energy)}] ${pet.energy}/100 (-20)\n` +
        `🍖 Hunger: [${statBar(pet.hunger)}] ${pet.hunger}/100 (-12)\n` +
        `🛁 Clean:  [${statBar(pet.cleanliness)}] ${pet.cleanliness}/100 (-15)\n` +
        `⚖️ Weight: ${pet.weight}kg (-${weightLoss}kg from exercise)`;
    }

    // ══════════════════════════════════════════════════════════
    //  SLEEP
    // ══════════════════════════════════════════════════════════
    else if (subcmd === "sleep") {
      if (pet.energy >= 95) {
        return message.reply(
          `⚡ ${pet.emoji} ${pet.name} is already full of energy!\n` +
          `⚡ Energy: [${statBar(pet.energy)}] ${pet.energy}/100`
        );
      }

      // Turtles rest very efficiently
      const energyGain = pet.trait === "resilient" ? 70 : 50;
      // Health partially recovers during sleep
      const healthGain = pet.health < 100 ? Math.min(100 - pet.health, 10) : 0;

      pet = {
        ...pet,
        energy:          Math.min(100, pet.energy + energyGain),
        health:          Math.min(100, pet.health + healthGain),
        mood:            Math.min(100, pet.mood + 5),
        lastInteraction: now,
      };

      reply =
        `😴 ${pet.name.toUpperCase()} IS RESTING...\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${pet.emoji} ${pet.name} had a good nap!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚡ Energy: [${statBar(pet.energy)}] ${pet.energy}/100 (+${energyGain})\n` +
        `😊 Mood:   [${statBar(pet.mood)}] ${pet.mood}/100 (+5)\n` +
        (healthGain > 0 ? `❤️ Health: [${statBar(pet.health)}] ${pet.health}/100 (+${healthGain})\n` : "");
    }

    // ══════════════════════════════════════════════════════════
    //  WALK
    // ══════════════════════════════════════════════════════════
    else if (subcmd === "walk") {
      if (pet.energy < 20) {
        return message.reply(
          `😴 ${pet.emoji} ${pet.name} is too tired for a walk!\n` +
          `⚡ Energy: [${statBar(pet.energy)}] ${pet.energy}/100\n` +
          `💡 Use +petcare sleep ${slot} first.`
        );
      }

      // Fish/aquatic pets can't walk
      if (pet.trait === "aquatic") {
        return message.reply(
          `🐠 ${pet.emoji} ${pet.name} can't go for a walk — they live in water!\n` +
          `💡 Try +petcare play ${slot} instead.`
        );
      }

      const weightLoss  = parseFloat((pet.weight * 0.015).toFixed(2));
      const moodBoost   = 20;
      const healthBoost = 5;

      // Eagles/aerial pets love walks outdoors — extra mood
      const extraMood = pet.trait === "aerial" ? 10 : 0;

      pet = {
        ...pet,
        energy:          Math.max(0, pet.energy - 25),
        hunger:          Math.max(0, pet.hunger - 15),
        mood:            Math.min(100, pet.mood + moodBoost + extraMood),
        cleanliness:     Math.max(0, pet.cleanliness - 10),
        health:          Math.min(100, pet.health + healthBoost),
        weight:          Math.max(0.01, parseFloat((pet.weight - weightLoss).toFixed(2))),
        lastInteraction: now,
      };

      const walkScenes = [
        `sniffed every tree they passed 🌳`,
        `chased a butterfly 🦋`,
        `made friends with a stray dog 🐕`,
        `splashed in a puddle 💦`,
        `rolled in something suspicious... 😬`,
        `spotted a squirrel and went berserk 🐿️`,
      ];
      const scene = walkScenes[Math.floor(Math.random() * walkScenes.length)];

      reply =
        `🚶 𝗪𝗔𝗟𝗞 𝗪𝗜𝗧𝗛 ${pet.name.toUpperCase()}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${pet.emoji} ${pet.name} ${scene}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `😊 Mood:   [${statBar(pet.mood)}] ${pet.mood}/100\n` +
        `⚡ Energy: [${statBar(pet.energy)}] ${pet.energy}/100\n` +
        `❤️ Health: [${statBar(pet.health)}] ${pet.health}/100 (+${healthBoost})\n` +
        `⚖️ Weight: ${pet.weight}kg (-${weightLoss}kg)`;
    }

    // ══════════════════════════════════════════════════════════
    //  TRAIN
    // ══════════════════════════════════════════════════════════
    else if (subcmd === "train") {
      if (!pet.canBattle) {
        return message.reply(
          `❌ ${pet.emoji} ${pet.name} is a companion pet and cannot be trained for battle.\n` +
          `💡 Buy a battle pet from +petshop or +petsmagic`
        );
      }
      if (pet.energy < 25) {
        return message.reply(
          `😴 ${pet.emoji} ${pet.name} is too tired to train!\n` +
          `⚡ Energy: [${statBar(pet.energy)}] ${pet.energy}/100\n` +
          `💡 Use +petcare sleep ${slot} first.`
        );
      }
      if (pet.hunger < 25) {
        return message.reply(
          `🍖 ${pet.emoji} ${pet.name} needs to eat before training!\n` +
          `🍖 Hunger: [${statBar(pet.hunger)}] ${pet.hunger}/100\n` +
          `💡 Use +petcare feed ${slot} first.`
        );
      }

      // Magic beasts gain less XP from training (they upgrade via diamonds)
      const xpGained = pet.isMagic
        ? Math.floor(TRAIN_XP_BASE * 0.5)
        : TRAIN_XP_BASE + Math.floor(Math.random() * 10);

      const oldLevel = pet.level;
      pet = {
        ...pet,
        xp:              (pet.xp || 0) + xpGained,
        energy:          Math.max(0, pet.energy - 30),
        hunger:          Math.max(0, pet.hunger - 20),
        mood:            Math.min(100, pet.mood + 10),
        cleanliness:     Math.max(0, pet.cleanliness - 20),
        lastInteraction: now,
      };

      const { pet: leveledPet, leveled, newLevel } = processLevelUp(pet);
      pet = leveledPet;

      const levelUpMsg = leveled
        ? `\n🎉 LEVEL UP! ${oldLevel} → ${newLevel}!\n` +
          `  ⚔️ ATK +${TRAIN_STAT_GAIN} | 🛡️ DEF +${TRAIN_STAT_GAIN} | 💨 AGI +${Math.floor(TRAIN_STAT_GAIN/2)}`
        : `\n📊 XP: ${pet.xp}/${xpForLevel(pet.level)} to Lv.${pet.level + 1}`;

      const trainMoves = [
        "practiced combat stances", "sparred with a training dummy",
        "ran sprints and obstacle courses", "practiced elemental techniques",
        "honed its instincts on moving targets", "meditated to focus battle energy",
      ];
      const move = trainMoves[Math.floor(Math.random() * trainMoves.length)];

      // Magic beast training note
      const magicNote = pet.isMagic
        ? `\n🔱 Magic beasts upgrade via +petsmagic upgrade ${slot}` : "";

      reply =
        `💪 𝗧𝗥𝗔𝗜𝗡𝗜𝗡𝗚 — ${pet.name.toUpperCase()}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${pet.emoji} ${pet.name} ${move}!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `✨ XP Gained: +${xpGained}\n` +
        `⚡ Energy: [${statBar(pet.energy)}] ${pet.energy}/100\n` +
        `🍖 Hunger: [${statBar(pet.hunger)}] ${pet.hunger}/100\n` +
        `${levelUpMsg}${magicNote}`;
    }

    // ══════════════════════════════════════════════════════════
    //  MEDICINE
    // ══════════════════════════════════════════════════════════
    else if (subcmd === "medicine") {
      const diamonds = data.petDiamonds || 0;

      if (pet.health >= 80 && pet.status !== "critical" && pet.status !== "starving") {
        return message.reply(
          `💊 ${pet.emoji} ${pet.name} doesn't need medicine right now.\n` +
          `❤️ Health: [${statBar(pet.health)}] ${pet.health}/100\n` +
          `${statusEmoji(pet.status)} Status: ${pet.status}\n` +
          `💡 Medicine is only needed when health is below 80 or status is critical.`
        );
      }

      if (diamonds < MEDICINE_COST) {
        return message.reply(
          `❌ Not enough diamonds for medicine.\n` +
          `💊 Cost: 💎${MEDICINE_COST}\n` +
          `💎 Your balance: ${formatDiamonds(diamonds)}\n` +
          `💡 Use +dailydiamond or +diamonds convert`
        );
      }

      const healthGain  = 40;
      const newDiamonds = parseFloat((diamonds - MEDICINE_COST).toFixed(4));
      const newStatus   = pet.health + healthGain >= 50 ? "healthy" : pet.status;

      pet = {
        ...pet,
        health:          Math.min(100, pet.health + healthGain),
        hunger:          Math.min(100, pet.hunger + 10),
        status:          newStatus,
        lastInteraction: now,
      };

      extras = { petDiamonds: newDiamonds };

      reply =
        `💊 𝗠𝗘𝗗𝗜𝗖𝗜𝗡𝗘 𝗔𝗗𝗠𝗜𝗡𝗜𝗦𝗧𝗘𝗥𝗘𝗗\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${pet.emoji} ${pet.name} received treatment!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `❤️ Health: [${statBar(pet.health)}] ${pet.health}/100 (+${healthGain})\n` +
        `${statusEmoji(pet.status)} Status: ${pet.status}\n` +
        `💎 Cost: ${MEDICINE_COST} | Balance: ${formatDiamonds(newDiamonds)}`;
    }

    // ══════════════════════════════════════════════════════════
    //  GROOM
    // ══════════════════════════════════════════════════════════
    else if (subcmd === "groom") {
      if (pet.trait === "aquatic") {
        return message.reply(`🐠 Aquatic pets don't need grooming!`);
      }

      const moodBoost = 12;
      const cleanBoost = 30;

      pet = {
        ...pet,
        cleanliness:     Math.min(100, pet.cleanliness + cleanBoost),
        mood:            Math.min(100, pet.mood + moodBoost),
        lastInteraction: now,
      };

      const groomMessages = [
        `now has a shiny, beautiful coat! ✨`,
        `looks absolutely fabulous! 💅`,
        `is so clean it's practically glowing! 🌟`,
        `could win a pet show right now! 🏆`,
      ];
      const groomMsg = groomMessages[Math.floor(Math.random() * groomMessages.length)];

      reply =
        `✂️ 𝗚𝗥𝗢𝗢𝗠𝗜𝗡𝗚 — ${pet.name.toUpperCase()}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${pet.emoji} ${pet.name} ${groomMsg}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🛁 Cleanliness: [${statBar(pet.cleanliness)}] ${pet.cleanliness}/100 (+${cleanBoost})\n` +
        `😊 Mood:        [${statBar(pet.mood)}] ${pet.mood}/100 (+${moodBoost})`;
    }

    else {
      return message.reply(
        `❓ Unknown action: "${subcmd}"\n` +
        `Use +petcare to see all available actions.`
      );
    }

    // ── Hunger/starvation warnings ─────────────────────────
    let warning = "";
    if (pet.hunger <= 0 && pet.status !== "dead") {
      warning = `\n\n🚨 WARNING: ${pet.name} is STARVING! Health is draining!\n💊 Use +petcare medicine ${slot} or +petcare feed ${slot} NOW!`;
    } else if (pet.hunger < 20 && subcmd !== "feed") {
      warning = `\n\n⚠️ ${pet.name} is very hungry! Feed them soon! (+petcare feed ${slot})`;
    } else if (pet.health < 30) {
      warning = `\n\n🔴 ${pet.name}'s health is critical! Use +petcare medicine ${slot}!`;
    }

    // ── Save updated pet ───────────────────────────────────
    const newPets    = [...pets];
    newPets[slot - 1] = pet;

    await usersData.set(senderID, {
      ...userData,
      data: { ...data, pets: newPets, ...extras },
    });

    return message.reply(reply + warning);
  },
};
