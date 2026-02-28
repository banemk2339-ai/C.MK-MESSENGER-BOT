// ═══════════════════════════════════════════════════════════════
//   petshop.js  —  Buy & manage common pets
//
//   Commands:
//     +petshop                    — Browse all pets
//     +petshop buy <id> [name]    — Buy a pet
//     +petshop info <id>          — View pet details
//     +petshop slots              — Check your pet slots
//     +petshop release <slot#>    — Release a pet (no refund)
//     +petshop sell <slot#>       — Sell a pet (30% refund)
//     +petshop rename <slot#> <name> — Rename your pet
//
//   💎 Currency: Diamonds only
//   🏠 Slots: 10 default, expandable to 15 via +petslots
// ═══════════════════════════════════════════════════════════════

const DEFAULT_SLOTS = 10;
const MAX_SLOTS     = 15;

// ── Decay configuration ────────────────────────────────────────
// Time thresholds in hours for lazy decay calculation
const DECAY = {
  GRACE:    12,   // No decay within 12h
  MILD:     24,   // Mild decay 12–24h
  MODERATE: 48,   // Moderate 24–48h
  SEVERE:   72,   // Severe 48–72h
  CRITICAL: 168,  // Critical 72–168h (7 days)
  DEATH:    168,  // Pet dies at 168h with 0 hunger
};

// ── Pet catalog ────────────────────────────────────────────────
const PET_CATALOG = {
  1: {
    id: 1, name: "Dog", emoji: "🐕", price: 2,
    canBattle: false,
    trait: "loyal",
    traitDesc: "Mood recovers 30% faster",
    description: "Man's best friend. Loyal and loving.",
    baseStats: { hunger: 100, energy: 100, mood: 100, cleanliness: 100, health: 100, weight: 10 },
    battleStats: null,
    careNeeds: { hungerRate: 1.2, energyRate: 0.8, moodRate: 0.6, cleanRate: 0.5 },
  },
  2: {
    id: 2, name: "Cat", emoji: "🐈", price: 2,
    canBattle: false,
    trait: "independent",
    traitDesc: "Hunger decays 25% slower",
    description: "Mysterious and self-sufficient.",
    baseStats: { hunger: 100, energy: 100, mood: 100, cleanliness: 100, health: 100, weight: 4 },
    battleStats: null,
    careNeeds: { hungerRate: 0.75, energyRate: 0.7, moodRate: 0.9, cleanRate: 0.4 },
  },
  3: {
    id: 3, name: "Rabbit", emoji: "🐇", price: 1,
    canBattle: false,
    trait: "fluffy",
    traitDesc: "Gains weight cutely with no health penalty",
    description: "Soft and gentle. Loves to hop around.",
    baseStats: { hunger: 100, energy: 100, mood: 100, cleanliness: 100, health: 100, weight: 2 },
    battleStats: null,
    careNeeds: { hungerRate: 1.0, energyRate: 0.6, moodRate: 0.8, cleanRate: 0.6 },
  },
  4: {
    id: 4, name: "Hamster", emoji: "🐹", price: 1,
    canBattle: false,
    trait: "tiny",
    traitDesc: "Eats very little (60% hunger rate)",
    description: "Tiny ball of joy. Loves running on wheels.",
    baseStats: { hunger: 100, energy: 100, mood: 100, cleanliness: 100, health: 100, weight: 0.1 },
    battleStats: null,
    careNeeds: { hungerRate: 0.6, energyRate: 0.5, moodRate: 0.7, cleanRate: 0.7 },
  },
  5: {
    id: 5, name: "Parrot", emoji: "🦜", price: 3,
    canBattle: false,
    trait: "vocal",
    traitDesc: "Generates fun random messages when interacted with",
    description: "Colorful and chatty. Always has something to say.",
    baseStats: { hunger: 100, energy: 100, mood: 100, cleanliness: 100, health: 100, weight: 0.5 },
    battleStats: null,
    careNeeds: { hungerRate: 0.9, energyRate: 0.9, moodRate: 1.2, cleanRate: 0.3 },
  },
  6: {
    id: 6, name: "Turtle", emoji: "🐢", price: 3,
    canBattle: false,
    trait: "resilient",
    traitDesc: "Health decays the slowest of all pets",
    description: "Ancient and wise. Lives for centuries.",
    baseStats: { hunger: 100, energy: 100, mood: 100, cleanliness: 100, health: 100, weight: 5 },
    battleStats: null,
    careNeeds: { hungerRate: 0.5, energyRate: 0.3, moodRate: 0.4, cleanRate: 0.2 },
  },
  7: {
    id: 7, name: "Fox", emoji: "🦊", price: 5,
    canBattle: true,
    trait: "cunning",
    traitDesc: "+15% agility in battle",
    description: "Quick and clever. A natural trickster.",
    baseStats: { hunger: 100, energy: 100, mood: 100, cleanliness: 100, health: 100, weight: 6 },
    battleStats: { atk: 45, def: 30, agility: 65, hp: 350, maxHp: 350 },
    careNeeds: { hungerRate: 1.1, energyRate: 1.0, moodRate: 0.8, cleanRate: 0.8 },
  },
  8: {
    id: 8, name: "Wolf Pup", emoji: "🐺", price: 8,
    canBattle: true,
    trait: "pack_instinct",
    traitDesc: "+20% ATK when HP below 30%",
    description: "Born hunter. Gets fiercer when cornered.",
    baseStats: { hunger: 100, energy: 100, mood: 100, cleanliness: 100, health: 100, weight: 15 },
    battleStats: { atk: 70, def: 40, agility: 55, hp: 500, maxHp: 500 },
    careNeeds: { hungerRate: 1.3, energyRate: 1.1, moodRate: 0.9, cleanRate: 1.0 },
  },
  9: {
    id: 9, name: "Lion Cub", emoji: "🦁", price: 10,
    canBattle: true,
    trait: "apex",
    traitDesc: "+20% critical hit chance",
    description: "King of beasts, even as a cub.",
    baseStats: { hunger: 100, energy: 100, mood: 100, cleanliness: 100, health: 100, weight: 20 },
    battleStats: { atk: 85, def: 50, agility: 50, hp: 600, maxHp: 600 },
    careNeeds: { hungerRate: 1.4, energyRate: 1.2, moodRate: 1.0, cleanRate: 1.1 },
  },
  10: {
    id: 10, name: "Tiger Cub", emoji: "🐯", price: 10,
    canBattle: true,
    trait: "stealth",
    traitDesc: "30% chance to strike first regardless of speed",
    description: "Silent predator. Strikes before you see it coming.",
    baseStats: { hunger: 100, energy: 100, mood: 100, cleanliness: 100, health: 100, weight: 20 },
    battleStats: { atk: 80, def: 45, agility: 60, hp: 580, maxHp: 580 },
    careNeeds: { hungerRate: 1.4, energyRate: 1.2, moodRate: 1.0, cleanRate: 1.1 },
  },
  11: {
    id: 11, name: "Bear Cub", emoji: "🐻", price: 8,
    canBattle: true,
    trait: "tank",
    traitDesc: "+25% defense, highest base HP of common pets",
    description: "Massive and sturdy. Hard to take down.",
    baseStats: { hunger: 100, energy: 100, mood: 100, cleanliness: 100, health: 100, weight: 30 },
    battleStats: { atk: 60, def: 75, agility: 30, hp: 750, maxHp: 750 },
    careNeeds: { hungerRate: 1.5, energyRate: 1.0, moodRate: 0.7, cleanRate: 1.2 },
  },
  12: {
    id: 12, name: "Eagle", emoji: "🦅", price: 6,
    canBattle: true,
    trait: "aerial",
    traitDesc: "+25% dodge chance in battle",
    description: "Master of the skies. Hard to hit.",
    baseStats: { hunger: 100, energy: 100, mood: 100, cleanliness: 100, health: 100, weight: 4 },
    battleStats: { atk: 65, def: 35, agility: 70, hp: 420, maxHp: 420 },
    careNeeds: { hungerRate: 1.0, energyRate: 1.1, moodRate: 1.1, cleanRate: 0.6 },
  },
  13: {
    id: 13, name: "Crocodile", emoji: "🐊", price: 7,
    canBattle: true,
    trait: "armored",
    traitDesc: "First 2 hits each battle deal 30% less damage",
    description: "Ancient predator with natural armor plating.",
    baseStats: { hunger: 100, energy: 100, mood: 100, cleanliness: 100, health: 100, weight: 50 },
    battleStats: { atk: 75, def: 70, agility: 25, hp: 650, maxHp: 650 },
    careNeeds: { hungerRate: 0.8, energyRate: 0.7, moodRate: 0.5, cleanRate: 0.9 },
  },
  14: {
    id: 14, name: "Butterfly", emoji: "🦋", price: 1,
    canBattle: false,
    trait: "delicate",
    traitDesc: "Purely cosmetic — boosts your profile mood score",
    description: "Beautiful and fragile. A joy to watch.",
    baseStats: { hunger: 100, energy: 100, mood: 100, cleanliness: 100, health: 100, weight: 0.01 },
    battleStats: null,
    careNeeds: { hungerRate: 0.3, energyRate: 0.2, moodRate: 1.5, cleanRate: 0.1 },
  },
  15: {
    id: 15, name: "Clownfish", emoji: "🐠", price: 1,
    canBattle: false,
    trait: "aquatic",
    traitDesc: "Never gets dirty — unique water-based care",
    description: "Bright and cheerful. Lives in its own little world.",
    baseStats: { hunger: 100, energy: 100, mood: 100, cleanliness: 100, health: 100, weight: 0.1 },
    battleStats: null,
    careNeeds: { hungerRate: 0.7, energyRate: 0.4, moodRate: 0.8, cleanRate: 0.0 },
  },
};

// ── Lazy decay engine ──────────────────────────────────────────
// Called whenever a pet is accessed. Calculates stat loss
// based on hours elapsed since last interaction.
function applyDecay(pet) {
  if (!pet || !pet.lastInteraction) return pet;

  const now     = Date.now();
  const elapsed = (now - pet.lastInteraction) / (1000 * 60 * 60); // hours
  const catalog = PET_CATALOG[pet.catalogId];

  if (elapsed < DECAY.GRACE) return pet; // Within grace period

  // Determine decay multiplier based on time bucket
  let multiplier;
  if      (elapsed < DECAY.MILD)     multiplier = 0.3;
  else if (elapsed < DECAY.MODERATE) multiplier = 0.7;
  else if (elapsed < DECAY.SEVERE)   multiplier = 1.5;
  else if (elapsed < DECAY.CRITICAL) multiplier = 3.0;
  else                                multiplier = 6.0;

  const rate   = catalog?.careNeeds || { hungerRate: 1, energyRate: 1, moodRate: 1, cleanRate: 1 };
  const hours  = Math.min(elapsed - DECAY.GRACE, elapsed); // Only decay past grace period

  // Apply proportional stat decay
  const hungerLoss = Math.min(pet.hunger,      hours * rate.hungerRate * multiplier * 0.8);
  const energyLoss = Math.min(pet.energy,      hours * rate.energyRate * multiplier * 0.5);
  const moodLoss   = Math.min(pet.mood,        hours * rate.moodRate   * multiplier * 0.6);
  const cleanLoss  = Math.min(pet.cleanliness, hours * rate.cleanRate  * multiplier * 0.4);

  let newHunger      = Math.max(0, pet.hunger      - hungerLoss);
  let newEnergy      = Math.max(0, pet.energy      - energyLoss);
  let newMood        = Math.max(0, pet.mood        - moodLoss);
  let newCleanliness = Math.max(0, pet.cleanliness - cleanLoss);
  let newHealth      = pet.health;

  // Health drops when hunger hits 0 (starvation)
  if (newHunger === 0 && elapsed > DECAY.MODERATE) {
    const starvHours = elapsed - DECAY.MODERATE;
    const healthLoss = Math.min(newHealth, starvHours * 2.0 * multiplier);
    newHealth = Math.max(0, newHealth - healthLoss);
  }

  // Weight loss from hunger
  let newWeight = pet.weight;
  if (newHunger < 30) {
    newWeight = Math.max(
      catalog?.baseStats.weight * 0.6,
      pet.weight - (elapsed * 0.01 * multiplier)
    );
  }

  // Determine status
  let status = pet.status;
  if (newHealth <= 0) {
    status = "dead";
  } else if (newHunger === 0 && elapsed > DECAY.SEVERE) {
    status = "critical";
  } else if (newHunger < 20) {
    status = "starving";
  } else if (newHunger < 50) {
    status = "hungry";
  } else {
    status = "healthy";
  }

  return {
    ...pet,
    hunger:      Math.round(newHunger),
    energy:      Math.round(newEnergy),
    mood:        Math.round(newMood),
    cleanliness: Math.round(newCleanliness),
    health:      Math.round(newHealth),
    weight:      parseFloat(newWeight.toFixed(2)),
    status,
  };
}

// ── Create a new pet object ────────────────────────────────────
function createPet(catalogId, petName, ownerID) {
  const template = PET_CATALOG[catalogId];
  const now      = Date.now();
  return {
    id:           `pet_${now}_${Math.random().toString(36).slice(2, 6)}`,
    catalogId,
    name:         petName,
    ownerID,
    emoji:        template.emoji,
    species:      template.name,
    trait:        template.trait,
    canBattle:    template.canBattle,
    // Care stats
    hunger:       100,
    energy:       100,
    mood:         100,
    cleanliness:  100,
    health:       100,
    weight:       template.baseStats.weight,
    status:       "healthy",
    // Battle stats (null if can't battle)
    ...(template.battleStats ? {
      atk:     template.battleStats.atk,
      def:     template.battleStats.def,
      agility: template.battleStats.agility,
      hp:      template.battleStats.hp,
      maxHp:   template.battleStats.maxHp,
      xp:      0,
      level:   1,
      wins:    0,
      losses:  0,
    } : {
      atk: null, def: null, agility: null,
      hp: null, maxHp: null,
      xp: 0, level: 1,
    }),
    // Timestamps
    boughtAt:        now,
    lastInteraction: now,
    lastFed:         now,
    lastWashed:      now,
    lastPlayed:      now,
  };
}

// ── Helpers ────────────────────────────────────────────────────
function formatDiamonds(n) {
  return Number.isInteger(n) ? `${n}` : n.toFixed(4).replace(/\.?0+$/, "");
}

function statBar(value, max = 100) {
  const pct    = Math.round((value / max) * 10);
  const filled = "█".repeat(pct);
  const empty  = "░".repeat(10 - pct);
  return `${filled}${empty}`;
}

function statusEmoji(status) {
  switch (status) {
    case "healthy":  return "💚";
    case "hungry":   return "🟡";
    case "starving": return "🟠";
    case "critical": return "🔴";
    case "dead":     return "💀";
    default:         return "💚";
  }
}

function weightStatus(pet) {
  const base    = PET_CATALOG[pet.catalogId]?.baseStats.weight || 1;
  const ratio   = pet.weight / base;
  if (ratio > 1.5)  return "⚖️ Overweight";
  if (ratio > 1.2)  return "🍖 Chubby";
  if (ratio < 0.7)  return "💨 Underweight";
  if (ratio < 0.85) return "📉 Thin";
  return "✅ Healthy weight";
}

module.exports = {
  config: {
    name: "petshop",
    aliases: ["pshop", "buypet", "pets"],
    version: "1.0",
    author: "Charles MK",
    countDown: 5,
    role: 0,
    shortDescription: { en: "🐾 Buy and manage your pets" },
    category: "pets",
    guide: {
      en:
        "{pn}                       — Browse all pets\n" +
        "{pn} buy <id> [name]        — Buy a pet\n" +
        "{pn} info <id>              — View pet details\n" +
        "{pn} slots                  — Check your pet slots\n" +
        "{pn} release <slot#>        — Release a pet (no refund)\n" +
        "{pn} sell <slot#>           — Sell a pet (30% back)\n" +
        "{pn} rename <slot#> <name>  — Rename your pet",
    },
  },

  onStart: async function ({ event, message, args, usersData }) {
    const senderID = event.senderID;
    const subcmd   = (args[0] || "").toLowerCase();
    const userData = await usersData.get(senderID);
    const data     = userData.data || {};

    // ── Browse shop ────────────────────────────────────────
    if (!subcmd || subcmd === "list" || subcmd === "browse") {
      const battlePets = Object.values(PET_CATALOG).filter(p => p.canBattle);
      const normalPets = Object.values(PET_CATALOG).filter(p => !p.canBattle);

      const normalLines = normalPets.map(p =>
        `  [${p.id}] ${p.emoji} ${p.name} — 💎${p.price}\n` +
        `       ${p.traitDesc}`
      ).join("\n");

      const battleLines = battlePets.map(p =>
        `  [${p.id}] ${p.emoji} ${p.name} — 💎${p.price}\n` +
        `       ⚔️ ATK:${p.battleStats.atk} DEF:${p.battleStats.def} ` +
        `AGI:${p.battleStats.agility} HP:${p.battleStats.hp}\n` +
        `       ${p.traitDesc}`
      ).join("\n");

      const diamonds = data.petDiamonds || 0;
      const pets     = data.pets || [];
      const maxSlots = data.petSlots || DEFAULT_SLOTS;

      return message.reply(
        `🐾 𝗣𝗘𝗧 𝗦𝗛𝗢𝗣\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💎 Your diamonds: ${formatDiamonds(diamonds)}\n` +
        `🏠 Slots: ${pets.length}/${maxSlots}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🏠 𝗖𝗢𝗠𝗣𝗔𝗡𝗜𝗢𝗡 𝗣𝗘𝗧𝗦\n` +
        `${normalLines}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚔️ 𝗕𝗔𝗧𝗧𝗟𝗘 𝗣𝗘𝗧𝗦\n` +
        `${battleLines}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 +petshop buy <id> [name]\n` +
        `💡 +petshop info <id> for full details`
      );
    }

    // ── Info <id> ──────────────────────────────────────────
    if (subcmd === "info") {
      const id  = parseInt(args[1]);
      const pet = PET_CATALOG[id];
      if (!pet) return message.reply(`❌ Invalid pet ID. Use +petshop to see all pets.`);

      const bStats = pet.battleStats;
      return message.reply(
        `${pet.emoji} 𝗣𝗘𝗧 𝗜𝗡𝗙𝗢: ${pet.name.toUpperCase()}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📖 ${pet.description}\n` +
        `💰 Price:   💎${pet.price}\n` +
        `⚔️ Battle:  ${pet.canBattle ? "Yes" : "No"}\n` +
        `🧬 Trait:   ${pet.traitDesc}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🍽️ Hunger Rate:     ${pet.careNeeds.hungerRate}x\n` +
        `⚡ Energy Rate:     ${pet.careNeeds.energyRate}x\n` +
        `😊 Mood Rate:       ${pet.careNeeds.moodRate}x\n` +
        `🛁 Cleanliness Rate:${pet.careNeeds.cleanRate}x\n` +
        (bStats
          ? `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `⚔️  ATK:     ${bStats.atk}\n` +
            `🛡️  DEF:     ${bStats.def}\n` +
            `💨  Agility: ${bStats.agility}\n` +
            `❤️  HP:      ${bStats.hp}\n`
          : "") +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 Buy: +petshop buy ${id} [name]`
      );
    }

    // ── Slots ──────────────────────────────────────────────
    if (subcmd === "slots") {
      const pets    = data.pets    || [];
      const maxSlots = data.petSlots || DEFAULT_SLOTS;
      const used    = pets.length;
      const free    = maxSlots - used;

      if (!pets.length) {
        return message.reply(
          `🏠 𝗣𝗘𝗧 𝗦𝗟𝗢𝗧𝗦\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📭 You have no pets yet!\n` +
          `🏠 Slots: 0/${maxSlots}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `💡 Use +petshop buy <id> to get your first pet!`
        );
      }

      // Apply decay to all pets before displaying
      const updatedPets = pets.map(p => applyDecay(p));
      const lines = updatedPets.map((p, i) => {
        const dead = p.status === "dead";
        return (
          `  Slot ${i + 1}: ${p.emoji} ${p.name} (${p.species})\n` +
          `    ${statusEmoji(p.status)} ${dead ? "💀 DEAD" : `HP:${p.health} | Hunger:${p.hunger}`}\n` +
          `    ${dead ? "Use +petshop release " + (i + 1) + " to clear slot" : weightStatus(p)}`
        );
      }).join("\n");

      return message.reply(
        `🏠 𝗬𝗢𝗨𝗥 𝗣𝗘𝗧𝗦\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${lines}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🏠 Slots: ${used}/${maxSlots}  |  Free: ${free}\n` +
        `💡 +mypets for full details  |  +petcare to care for pets` +
        (maxSlots < MAX_SLOTS ? `\n💡 +petslots to expand (up to ${MAX_SLOTS})` : "")
      );
    }

    // ── Buy <id> [name] ────────────────────────────────────
    if (subcmd === "buy") {
      const id       = parseInt(args[1]);
      const petName  = args.slice(2).join(" ").trim() || null;
      const template = PET_CATALOG[id];

      if (!template) {
        return message.reply(`❌ Invalid pet ID. Use +petshop to see all pets.`);
      }

      const diamonds = data.petDiamonds || 0;
      const pets     = data.pets        || [];
      const maxSlots = data.petSlots    || DEFAULT_SLOTS;

      // Slot check
      if (pets.length >= maxSlots) {
        return message.reply(
          `❌ All ${maxSlots} pet slots are full!\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Options:\n` +
          `  • +petshop sell <slot#> to sell a pet\n` +
          `  • +petshop release <slot#> to release one\n` +
          (maxSlots < MAX_SLOTS
            ? `  • +petslots to expand slots (max ${MAX_SLOTS})`
            : `  • You're at the maximum of ${MAX_SLOTS} slots`)
        );
      }

      // Diamond check
      if (diamonds < template.price) {
        return message.reply(
          `❌ Not enough diamonds.\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `💎 ${template.emoji} ${template.name} costs: 💎${template.price}\n` +
          `💎 Your balance: ${formatDiamonds(diamonds)}\n` +
          `💡 Use +diamonds convert or +dailydiamond`
        );
      }

      // Name validation
      const finalName = petName
        ? petName.slice(0, 20).replace(/[^\w\s\-!?♥]/g, "").trim() || template.name
        : template.name;

      // Create pet and save
      const newPet      = createPet(id, finalName, senderID);
      const newPets     = [...pets, newPet];
      const newDiamonds = parseFloat((diamonds - template.price).toFixed(4));

      await usersData.set(senderID, {
        ...userData,
        data: {
          ...data,
          pets:        newPets,
          petDiamonds: newDiamonds,
        },
      });

      return message.reply(
        `🎉 𝗪𝗘𝗟𝗖𝗢𝗠𝗘 𝗬𝗢𝗨𝗥 𝗡𝗘𝗪 𝗣𝗘𝗧!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${template.emoji} Name:    ${finalName}\n` +
        `🐾 Species: ${template.name}\n` +
        `🧬 Trait:   ${template.traitDesc}\n` +
        (template.canBattle
          ? `⚔️ Battle ready! ATK:${template.battleStats.atk} HP:${template.battleStats.hp}\n`
          : `🏠 Companion pet (no battles)\n`) +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💎 Spent:   💎${template.price}\n` +
        `💎 Balance: ${formatDiamonds(newDiamonds)}\n` +
        `🏠 Slot:    ${newPets.length}/${maxSlots}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 Use +petcare feed ${newPets.length} to feed your pet!\n` +
        `💡 Use +mypets to see all your pets`
      );
    }

    // ── Release <slot#> ────────────────────────────────────
    if (subcmd === "release") {
      const slot = parseInt(args[1]);
      const pets = data.pets || [];

      if (!slot || slot < 1 || slot > pets.length) {
        return message.reply(`❌ Invalid slot number. You have ${pets.length} pet(s).`);
      }

      const pet     = applyDecay(pets[slot - 1]);
      const newPets = pets.filter((_, i) => i !== slot - 1);

      await usersData.set(senderID, {
        ...userData,
        data: { ...data, pets: newPets },
      });

      return message.reply(
        `💔 ${pet.emoji} ${pet.name} has been released.\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `They've gone back to the wild.\n` +
        `🏠 Slots: ${newPets.length}/${data.petSlots || DEFAULT_SLOTS}`
      );
    }

    // ── Sell <slot#> ───────────────────────────────────────
    if (subcmd === "sell") {
      const slot = parseInt(args[1]);
      const pets = data.pets || [];

      if (!slot || slot < 1 || slot > pets.length) {
        return message.reply(`❌ Invalid slot number. You have ${pets.length} pet(s).`);
      }

      const pet      = applyDecay(pets[slot - 1]);
      const template = PET_CATALOG[pet.catalogId];
      const refund   = parseFloat((template.price * 0.3).toFixed(4));
      const newPets  = pets.filter((_, i) => i !== slot - 1);
      const newDiamonds = parseFloat(((data.petDiamonds || 0) + refund).toFixed(4));

      await usersData.set(senderID, {
        ...userData,
        data: { ...data, pets: newPets, petDiamonds: newDiamonds },
      });

      return message.reply(
        `💰 𝗣𝗘𝗧 𝗦𝗢𝗟𝗗\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${pet.emoji} ${pet.name} (${pet.species}) sold.\n` +
        `💎 Refund: ${formatDiamonds(refund)} (30% of 💎${template.price})\n` +
        `💎 New balance: ${formatDiamonds(newDiamonds)}\n` +
        `🏠 Slots: ${newPets.length}/${data.petSlots || DEFAULT_SLOTS}`
      );
    }

    // ── Rename <slot#> <name> ──────────────────────────────
    if (subcmd === "rename") {
      const slot    = parseInt(args[1]);
      const newName = args.slice(2).join(" ").trim();
      const pets    = data.pets || [];

      if (!slot || slot < 1 || slot > pets.length) {
        return message.reply(`❌ Invalid slot number. You have ${pets.length} pet(s).`);
      }
      if (!newName) {
        return message.reply(`❌ Please provide a new name.\nExample: +petshop rename 1 Fluffy`);
      }

      const cleanName = newName.slice(0, 20).replace(/[^\w\s\-!?♥]/g, "").trim();
      if (!cleanName) return message.reply(`❌ Invalid name. Use letters, numbers, or basic symbols.`);

      const oldName    = pets[slot - 1].name;
      const newPets    = [...pets];
      newPets[slot - 1] = { ...newPets[slot - 1], name: cleanName };

      await usersData.set(senderID, {
        ...userData,
        data: { ...data, pets: newPets },
      });

      return message.reply(
        `✅ Pet renamed!\n` +
        `${pets[slot - 1].emoji} ${oldName} → ${cleanName}`
      );
    }

    return message.reply(
      `❓ Unknown command.\n` +
      `Use +petshop to see all options.`
    );
  },
};

// ── Export decay engine for use in other pet scripts ──────────
module.exports.applyDecay  = applyDecay;
module.exports.PET_CATALOG = PET_CATALOG;
module.exports.statBar     = statBar;
module.exports.statusEmoji = statusEmoji;
module.exports.weightStatus = weightStatus;
module.exports.formatDiamonds = formatDiamonds;
module.exports.DEFAULT_SLOTS  = DEFAULT_SLOTS;
module.exports.MAX_SLOTS      = MAX_SLOTS;
