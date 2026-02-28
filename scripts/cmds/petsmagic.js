// ═══════════════════════════════════════════════════════════════
//   petsmagic.js  —  Ancient & Mythical Beast Shop
//
//   25 rare beasts across 5 archetypes, exclusively for battles.
//   Each beast can be upgraded 20 levels toward God Mode stats.
//
//   Commands:
//     +petsmagic                      — Browse all beasts
//     +petsmagic <category>           — Filter by type
//       categories: dragons, wolves, sea, felines, birds
//     +petsmagic info <id>            — Full beast details
//     +petsmagic buy <id> [name]      — Purchase a beast
//     +petsmagic upgrade <slot#>      — Upgrade a beast (costs 💎 + materials)
//     +petsmagic materials            — View your upgrade materials
//
//   💎 Slots shared with petshop (10 default, 15 max)
// ═══════════════════════════════════════════════════════════════

const DEFAULT_SLOTS = 10;
const MAX_SLOTS     = 15;
const MAX_LEVEL     = 20;

// ── Upgrade material costs per level tier ─────────────────────
// Tier 1 (Lv 1–5):   cheap
// Tier 2 (Lv 6–10):  moderate
// Tier 3 (Lv 11–15): expensive
// Tier 4 (Lv 16–20): God Mode tier — very expensive
const UPGRADE_COSTS = [
  null, // index 0 unused (level starts at 1)
  { diamonds: 5,  mat: 1 },  // → Lv 2
  { diamonds: 5,  mat: 1 },  // → Lv 3
  { diamonds: 8,  mat: 1 },  // → Lv 4
  { diamonds: 8,  mat: 2 },  // → Lv 5
  { diamonds: 12, mat: 2 },  // → Lv 6
  { diamonds: 12, mat: 2 },  // → Lv 7
  { diamonds: 18, mat: 3 },  // → Lv 8
  { diamonds: 18, mat: 3 },  // → Lv 9
  { diamonds: 25, mat: 3 },  // → Lv 10
  { diamonds: 30, mat: 4 },  // → Lv 11
  { diamonds: 30, mat: 4 },  // → Lv 12
  { diamonds: 40, mat: 5 },  // → Lv 13
  { diamonds: 40, mat: 5 },  // → Lv 14
  { diamonds: 55, mat: 6 },  // → Lv 15
  { diamonds: 70, mat: 7 },  // → Lv 16
  { diamonds: 85, mat: 8 },  // → Lv 17
  { diamonds: 100, mat: 9 }, // → Lv 18
  { diamonds: 120, mat: 10 },// → Lv 19
  { diamonds: 150, mat: 12 },// → Lv 20 (God Mode)
];

// ── Upgrade material names per archetype ──────────────────────
const ARCHETYPE_MATERIAL = {
  dragon:  { name: "Dragon Scale",   emoji: "🐉", key: "matDragonScale"  },
  wolf:    { name: "Wolf Fang",       emoji: "🐺", key: "matWolfFang"     },
  sea:     { name: "Deep Crystal",    emoji: "🔷", key: "matDeepCrystal"  },
  feline:  { name: "Shadow Claw",     emoji: "🐆", key: "matShadowClaw"   },
  bird:    { name: "Mythic Feather",  emoji: "🪶", key: "matMythicFeather"},
};

// ── Beast catalog ──────────────────────────────────────────────
const BEAST_CATALOG = {
  // ── DRAGONS ─────────────────────────────────────────────────
  1: {
    id: 1, name: "Ignaroth", title: "The Inferno Dragon",
    emoji: "🔥", archetype: "dragon", price: 50,
    description: "Born in the heart of a dying star. Its breath melts mountains.",
    trait: "inferno",
    traitDesc: "Burns enemy for 8% of ATK every turn (ignores defense)",
    baseStats: { atk: 550, def: 200, agility: 180, hp: 5000, maxHp: 5000 },
    maxStats:  { atk: 20000, def: 6000, agility: 5000, hp: 5000, maxHp: 5000 },
    regen: 0,
  },
  2: {
    id: 2, name: "Glacivorn", title: "The Frost Dragon",
    emoji: "❄️", archetype: "dragon", price: 50,
    description: "Its scales are colder than absolute zero. One touch shatters steel.",
    trait: "freeze",
    traitDesc: "25% chance to stun enemy for 1 turn per attack",
    baseStats: { atk: 500, def: 220, agility: 170, hp: 5000, maxHp: 5000 },
    maxStats:  { atk: 20000, def: 7000, agility: 5000, hp: 5000, maxHp: 5000 },
    regen: 0,
  },
  3: {
    id: 3, name: "Stormax", title: "The Thunder Dragon",
    emoji: "⚡", archetype: "dragon", price: 50,
    description: "Commands the sky itself. Lightning answers its call.",
    trait: "chain_lightning",
    traitDesc: "Attacks bounce to 2 additional targets in group battles",
    baseStats: { atk: 580, def: 180, agility: 210, hp: 5000, maxHp: 5000 },
    maxStats:  { atk: 20000, def: 5500, agility: 6000, hp: 5000, maxHp: 5000 },
    regen: 0,
  },
  4: {
    id: 4, name: "Nyxrath", title: "The Shadow Dragon",
    emoji: "🌑", archetype: "dragon", price: 50,
    description: "It feeds on life force. Looking it in the eye drains your soul.",
    trait: "soul_drain",
    traitDesc: "Steals 12% of damage dealt back as HP",
    baseStats: { atk: 520, def: 190, agility: 200, hp: 5000, maxHp: 5000 },
    maxStats:  { atk: 20000, def: 6000, agility: 5500, hp: 5000, maxHp: 5000 },
    regen: 120, // bonus regen from soul drain
  },
  5: {
    id: 5, name: "Auroryn", title: "The Divine Dragon",
    emoji: "✨", archetype: "dragon", price: 50,
    description: "Ancient guardian of the heavens. Its light purifies all darkness.",
    trait: "holy_aura",
    traitDesc: "Passively regenerates 3% max HP every turn",
    baseStats: { atk: 510, def: 250, agility: 160, hp: 5000, maxHp: 5000 },
    maxStats:  { atk: 20000, def: 8000, agility: 4500, hp: 5000, maxHp: 5000 },
    regen: 150,
  },

  // ── WOLF BEASTS ──────────────────────────────────────────────
  6: {
    id: 6, name: "Bloodfang", title: "The Blood Wolf",
    emoji: "🩸", archetype: "wolf", price: 35,
    description: "Leaves a trail of blood wherever it hunts. Never stops until its prey falls.",
    trait: "hemorrhage",
    traitDesc: "Applies stacking bleed — +5% ATK damage per stack (max 5 stacks)",
    baseStats: { atk: 380, def: 160, agility: 220, hp: 4000, maxHp: 4000 },
    maxStats:  { atk: 15000, def: 5000, agility: 7000, hp: 4000, maxHp: 4000 },
    regen: 0,
  },
  7: {
    id: 7, name: "Galeclaw", title: "The Storm Wolf",
    emoji: "🌪️", archetype: "wolf", price: 35,
    description: "Moves like a hurricane. Its claws cut through armor like paper.",
    trait: "windstrike",
    traitDesc: "All attacks ignore 40% of enemy defense",
    baseStats: { atk: 400, def: 140, agility: 260, hp: 4000, maxHp: 4000 },
    maxStats:  { atk: 15000, def: 4000, agility: 8000, hp: 4000, maxHp: 4000 },
    regen: 0,
  },
  8: {
    id: 8, name: "Voidhowl", title: "The Void Wolf",
    emoji: "🌑", archetype: "wolf", price: 35,
    description: "Steps between dimensions. Attacks from angles that don't exist.",
    trait: "phase",
    traitDesc: "40% chance to phase through any attack (full dodge)",
    baseStats: { atk: 360, def: 150, agility: 280, hp: 4000, maxHp: 4000 },
    maxStats:  { atk: 15000, def: 4500, agility: 9000, hp: 4000, maxHp: 4000 },
    regen: 0,
  },
  9: {
    id: 9, name: "Emberpelt", title: "The Ember Wolf",
    emoji: "🔥", archetype: "wolf", price: 35,
    description: "Its fur is made of living flame. The ground scorches under its paws.",
    trait: "wildfire",
    traitDesc: "In group battles, attacks hit all enemies for 60% damage",
    baseStats: { atk: 370, def: 170, agility: 230, hp: 4000, maxHp: 4000 },
    maxStats:  { atk: 15000, def: 5500, agility: 7000, hp: 4000, maxHp: 4000 },
    regen: 0,
  },
  10: {
    id: 10, name: "Frostmaw", title: "The Frost Wolf",
    emoji: "🧊", archetype: "wolf", price: 35,
    description: "Its howl freezes rivers. Enemies slow to a crawl in its presence.",
    trait: "permafrost",
    traitDesc: "Reduces enemy agility by 30% permanently after first hit",
    baseStats: { atk: 350, def: 190, agility: 210, hp: 4000, maxHp: 4000 },
    maxStats:  { atk: 15000, def: 6000, agility: 6500, hp: 4000, maxHp: 4000 },
    regen: 0,
  },

  // ── SEA CREATURES ─────────────────────────────────────────────
  11: {
    id: 11, name: "Kraelos", title: "The Ancient Kraken",
    emoji: "🦑", archetype: "sea", price: 30,
    description: "Older than the ocean. Its tentacles reach across entire seas.",
    trait: "ink_cloud",
    traitDesc: "Blinds enemy — 35% miss chance for 3 turns",
    baseStats: { atk: 300, def: 280, agility: 120, hp: 5000, maxHp: 5000 },
    maxStats:  { atk: 12000, def: 9000, agility: 3500, hp: 5000, maxHp: 5000 },
    regen: 0,
  },
  12: {
    id: 12, name: "Titanfin", title: "The Deep Leviathan",
    emoji: "🐋", archetype: "sea", price: 30,
    description: "Largest creature to ever exist. A single wave from its tail sinks fleets.",
    trait: "tidal_crush",
    traitDesc: "Reduces all incoming damage by 35% (highest base DEF)",
    baseStats: { atk: 280, def: 320, agility: 100, hp: 5000, maxHp: 5000 },
    maxStats:  { atk: 12000, def: 10000, agility: 3000, hp: 5000, maxHp: 5000 },
    regen: 0,
  },
  13: {
    id: 13, name: "Razortide", title: "The Ancient Megashark",
    emoji: "🦈", archetype: "sea", price: 30,
    description: "Its teeth regenerate instantly. Has never stopped hunting.",
    trait: "feeding_frenzy",
    traitDesc: "ATK increases by 8% for each enemy KO'd this battle",
    baseStats: { atk: 350, def: 240, agility: 160, hp: 5000, maxHp: 5000 },
    maxStats:  { atk: 12000, def: 7500, agility: 4500, hp: 5000, maxHp: 5000 },
    regen: 0,
  },
  14: {
    id: 14, name: "Coralith", title: "The Sea Titan",
    emoji: "🐚", archetype: "sea", price: 30,
    description: "Its body is encrusted with ancient coral. A living fortress.",
    trait: "coral_shield",
    traitDesc: "Reflects 20% of damage taken back at attacker",
    baseStats: { atk: 260, def: 300, agility: 110, hp: 5000, maxHp: 5000 },
    maxStats:  { atk: 12000, def: 9500, agility: 3200, hp: 5000, maxHp: 5000 },
    regen: 0,
  },
  15: {
    id: 15, name: "Stormveil", title: "The Storm Eel",
    emoji: "⚡", archetype: "sea", price: 30,
    description: "Channels unlimited electricity. Touching it triggers cardiac arrest.",
    trait: "volt_surge",
    traitDesc: "30% chance to paralyze enemy for 1 turn on each attack",
    baseStats: { atk: 320, def: 220, agility: 180, hp: 5000, maxHp: 5000 },
    maxStats:  { atk: 12000, def: 7000, agility: 5000, hp: 5000, maxHp: 5000 },
    regen: 0,
  },

  // ── FELINE BEASTS ─────────────────────────────────────────────
  16: {
    id: 16, name: "Phantclaw", title: "The Phantom Panther",
    emoji: "🐆", archetype: "feline", price: 40,
    description: "Exists between life and death. You only see it when it wants you to.",
    trait: "vanish",
    traitDesc: "Can vanish for one full turn — untargetable and resets cooldowns",
    baseStats: { atk: 420, def: 150, agility: 320, hp: 3500, maxHp: 3500 },
    maxStats:  { atk: 14000, def: 4500, agility: 10000, hp: 3500, maxHp: 3500 },
    regen: 0,
  },
  17: {
    id: 17, name: "Solmane", title: "The Solar Lion",
    emoji: "🦁", archetype: "feline", price: 40,
    description: "Carries the power of a sun in its mane. Its roar blinds armies.",
    trait: "solar_flare",
    traitDesc: "On activation: blinds enemy (30% miss) AND burns for 10% ATK/turn",
    baseStats: { atk: 400, def: 170, agility: 290, hp: 3500, maxHp: 3500 },
    maxStats:  { atk: 14000, def: 5000, agility: 9000, hp: 3500, maxHp: 3500 },
    regen: 0,
  },
  18: {
    id: 18, name: "Vortexfang", title: "The Void Tiger",
    emoji: "🐯", archetype: "feline", price: 40,
    description: "Strikes from the void. Its attack cannot be blocked or dodged.",
    trait: "blink_strike",
    traitDesc: "Once per battle: guaranteed hit that ignores all dodge and defense",
    baseStats: { atk: 440, def: 140, agility: 310, hp: 3500, maxHp: 3500 },
    maxStats:  { atk: 14000, def: 4200, agility: 9500, hp: 3500, maxHp: 3500 },
    regen: 0,
  },
  19: {
    id: 19, name: "Glacepard", title: "The Frost Leopard",
    emoji: "❄️", archetype: "feline", price: 40,
    description: "Its claws freeze what they touch. Prey bleeds ice instead of blood.",
    trait: "ice_slash",
    traitDesc: "Attacks slow enemy agility by 15% AND apply bleed (5% ATK/turn)",
    baseStats: { atk: 390, def: 160, agility: 300, hp: 3500, maxHp: 3500 },
    maxStats:  { atk: 14000, def: 5000, agility: 9000, hp: 3500, maxHp: 3500 },
    regen: 0,
  },
  20: {
    id: 20, name: "Umbraclaw", title: "The Shadow Cheetah",
    emoji: "🌑", archetype: "feline", price: 40,
    description: "Fastest creature alive. By the time you see the shadow, it's already done.",
    trait: "shadow_step",
    traitDesc: "+60% base dodge chance — highest agility of all felines",
    baseStats: { atk: 450, def: 130, agility: 380, hp: 3500, maxHp: 3500 },
    maxStats:  { atk: 14000, def: 4000, agility: 11000, hp: 3500, maxHp: 3500 },
    regen: 0,
  },

  // ── MYTHICAL BIRDS ────────────────────────────────────────────
  21: {
    id: 21, name: "Emberwing", title: "The Eternal Phoenix",
    emoji: "🔥", archetype: "bird", price: 45,
    description: "Cannot truly die. Every death makes it more powerful.",
    trait: "rebirth",
    traitDesc: "Revives once per battle at 40% HP — cannot be prevented",
    baseStats: { atk: 460, def: 200, agility: 250, hp: 4200, maxHp: 4200 },
    maxStats:  { atk: 16000, def: 6000, agility: 7000, hp: 4200, maxHp: 4200 },
    regen: 80,
  },
  22: {
    id: 22, name: "Voltaeron", title: "The Ancient Thunderbird",
    emoji: "⚡", archetype: "bird", price: 45,
    description: "Creates storms by simply flying. Its wingspan covers continents.",
    trait: "storm_call",
    traitDesc: "Signature attack hits ALL enemies simultaneously for full damage",
    baseStats: { atk: 480, def: 180, agility: 240, hp: 4200, maxHp: 4200 },
    maxStats:  { atk: 16000, def: 5500, agility: 7000, hp: 4200, maxHp: 4200 },
    regen: 0,
  },
  23: {
    id: 23, name: "Lumiveil", title: "The Celestial Crane",
    emoji: "✨", archetype: "bird", price: 45,
    description: "Messenger of the gods. Its feathers carry divine healing properties.",
    trait: "divine_wind",
    traitDesc: "Once per battle: heals all allies for 25% of their max HP",
    baseStats: { atk: 420, def: 220, agility: 260, hp: 4200, maxHp: 4200 },
    maxStats:  { atk: 16000, def: 7000, agility: 7500, hp: 4200, maxHp: 4200 },
    regen: 100,
  },
  24: {
    id: 24, name: "Shadowquill", title: "The Nightmare Raven",
    emoji: "🌑", archetype: "bird", price: 45,
    description: "Flies through nightmares. Its presence weakens the will to fight.",
    trait: "darkness",
    traitDesc: "Reduces all enemy stats (ATK/DEF/AGI) by 15% at battle start",
    baseStats: { atk: 500, def: 170, agility: 270, hp: 4200, maxHp: 4200 },
    maxStats:  { atk: 16000, def: 5000, agility: 8000, hp: 4200, maxHp: 4200 },
    regen: 0,
  },
  25: {
    id: 25, name: "Frostplume", title: "The Glacial Harpy",
    emoji: "❄️", archetype: "bird", price: 45,
    description: "Commands blizzards with a single wingbeat. Entire armies freeze mid-charge.",
    trait: "blizzard",
    traitDesc: "AoE attack — slows all enemies 20% + deals 80% ATK to each",
    baseStats: { atk: 440, def: 190, agility: 280, hp: 4200, maxHp: 4200 },
    maxStats:  { atk: 16000, def: 6000, agility: 8000, hp: 4200, maxHp: 4200 },
    regen: 0,
  },
};

// ── Category display labels ────────────────────────────────────
const CATEGORIES = {
  dragons: { label: "🐉 Dragons",        ids: [1,2,3,4,5],        price: 50 },
  wolves:  { label: "🐺 Wolf Beasts",    ids: [6,7,8,9,10],       price: 35 },
  sea:     { label: "🌊 Sea Creatures",  ids: [11,12,13,14,15],   price: 30 },
  felines: { label: "🐆 Feline Beasts",  ids: [16,17,18,19,20],   price: 40 },
  birds:   { label: "🪶 Mythical Birds", ids: [21,22,23,24,25],   price: 45 },
};

// ── Stat scaling — interpolates between base and max per level ─
function getScaledStats(beast, level) {
  const t    = (level - 1) / (MAX_LEVEL - 1); // 0.0 at Lv1, 1.0 at Lv20
  const lerp = (a, b) => Math.round(a + (b - a) * t);
  return {
    atk:     lerp(beast.baseStats.atk,     beast.maxStats.atk),
    def:     lerp(beast.baseStats.def,     beast.maxStats.def),
    agility: lerp(beast.baseStats.agility, beast.maxStats.agility),
    hp:      beast.baseStats.hp,   // HP is always 5000 max — no scaling
    maxHp:   beast.baseStats.maxHp,
  };
}

// ── Create a new beast object ──────────────────────────────────
function createBeast(catalogId, beastName, ownerID) {
  const template = BEAST_CATALOG[catalogId];
  const now      = Date.now();
  const mat      = ARCHETYPE_MATERIAL[template.archetype];
  return {
    id:           `beast_${now}_${Math.random().toString(36).slice(2, 6)}`,
    catalogId,
    isMagic:      true,
    name:         beastName,
    ownerID,
    emoji:        template.emoji,
    species:      template.name,
    title:        template.title,
    archetype:    template.archetype,
    trait:        template.trait,
    traitDesc:    template.traitDesc,
    canBattle:    true,
    // Current stats (start at base = level 1)
    atk:          template.baseStats.atk,
    def:          template.baseStats.def,
    agility:      template.baseStats.agility,
    hp:           template.baseStats.hp,
    maxHp:        template.baseStats.maxHp,
    regen:        template.regen,
    // Progression
    level:        1,
    xp:           0,
    wins:         0,
    losses:       0,
    // Care stats (magic beasts still need care)
    hunger:       100,
    energy:       100,
    mood:         100,
    cleanliness:  100,
    health:       100,
    weight:       50,
    status:       "healthy",
    // Upgrade material type for this beast
    matKey:       mat.key,
    matName:      mat.name,
    matEmoji:     mat.emoji,
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

function levelBar(level) {
  const filled = Math.round((level / MAX_LEVEL) * 10);
  return `[${"█".repeat(filled)}${"░".repeat(10 - filled)}] Lv.${level}/${MAX_LEVEL}`;
}

function isGodMode(level) {
  return level >= MAX_LEVEL;
}

module.exports = {
  config: {
    name: "petsmagic",
    aliases: ["magicpets", "beastshop", "rarebeasts", "pmagic"],
    version: "1.0",
    author: "Charles MK",
    countDown: 5,
    role: 0,
    shortDescription: { en: "🐉 Buy and upgrade ancient magical beasts" },
    category: "pets",
    guide: {
      en:
        "{pn}                        — Browse all beasts\n" +
        "{pn} dragons/wolves/sea/     — Filter by type\n" +
        "     felines/birds\n" +
        "{pn} info <id>               — Full beast details\n" +
        "{pn} buy <id> [name]         — Purchase a beast\n" +
        "{pn} upgrade <slot#>         — Upgrade a beast\n" +
        "{pn} materials               — View your materials",
    },
  },

  onStart: async function ({ event, message, args, usersData }) {
    const senderID = event.senderID;
    const subcmd   = (args[0] || "").toLowerCase();
    const userData = await usersData.get(senderID);
    const data     = userData.data || {};
    const diamonds = data.petDiamonds || 0;
    const pets     = data.pets        || [];
    const maxSlots = data.petSlots    || DEFAULT_SLOTS;

    // ── Browse / category filter ───────────────────────────
    if (!subcmd || CATEGORIES[subcmd]) {
      const catKeys   = subcmd && CATEGORIES[subcmd] ? [subcmd] : Object.keys(CATEGORIES);
      const sections  = catKeys.map(key => {
        const cat    = CATEGORIES[key];
        const beasts = cat.ids.map(id => BEAST_CATALOG[id]);
        const lines  = beasts.map(b =>
          `  [${b.id}] ${b.emoji} ${b.name} — 💎${b.price}\n` +
          `       ${b.title}\n` +
          `       ✦ ${b.traitDesc}\n` +
          `       ⚔️${b.baseStats.atk}→${b.maxStats.atk} | ` +
          `🛡️${b.baseStats.def}→${b.maxStats.def} | ` +
          `💨${b.baseStats.agility}→${b.maxStats.agility} | ` +
          `❤️${b.baseStats.hp}`
        ).join("\n");
        return `${cat.label} (💎${cat.price} each)\n${lines}`;
      }).join("\n━━━━━━━━━━━━━━━━━━━━━━\n");

      return message.reply(
        `🐉 𝗣𝗘𝗧𝗦 𝗠𝗔𝗚𝗜𝗖 — 𝗔𝗡𝗖𝗜𝗘𝗡𝗧 𝗕𝗘𝗔𝗦𝗧𝗦\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💎 Your diamonds: ${formatDiamonds(diamonds)}\n` +
        `🏠 Slots: ${pets.length}/${maxSlots}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${sections}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 Stats shown as: Base → God Mode (Lv.20)\n` +
        `💡 +petsmagic info <id> for full details\n` +
        `💡 +petsmagic buy <id> [name] to purchase`
      );
    }

    // ── Info <id> ──────────────────────────────────────────
    if (subcmd === "info") {
      const id    = parseInt(args[1]);
      const beast = BEAST_CATALOG[id];
      if (!beast) return message.reply(`❌ Invalid beast ID. Use +petsmagic to browse.`);

      const mat = ARCHETYPE_MATERIAL[beast.archetype];
      return message.reply(
        `${beast.emoji} 𝗕𝗘𝗔𝗦𝗧 𝗜𝗡𝗙𝗢\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🏷️  ${beast.name} — ${beast.title}\n` +
        `📖 ${beast.description}\n` +
        `💰 Price:     💎${beast.price}\n` +
        `🏛️ Archetype: ${beast.archetype.charAt(0).toUpperCase() + beast.archetype.slice(1)}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `✦ TRAIT: ${beast.trait.replace(/_/g, " ").toUpperCase()}\n` +
        `  ${beast.traitDesc}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📊 BASE STATS (Lv.1)\n` +
        `  ⚔️ ATK:     ${beast.baseStats.atk}\n` +
        `  🛡️ DEF:     ${beast.baseStats.def}\n` +
        `  💨 Agility: ${beast.baseStats.agility}\n` +
        `  ❤️ HP:      ${beast.baseStats.hp}\n` +
        (beast.regen ? `  💚 Regen:   ${beast.regen}/turn\n` : "") +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🔱 GOD MODE STATS (Lv.20)\n` +
        `  ⚔️ ATK:     ${beast.maxStats.atk}\n` +
        `  🛡️ DEF:     ${beast.maxStats.def}\n` +
        `  💨 Agility: ${beast.maxStats.agility}\n` +
        `  ❤️ HP:      ${beast.maxStats.hp} (unchanged)\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🔧 Upgrade material: ${mat.emoji} ${mat.name}\n` +
        `   (Earned by winning +petbattle)\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 Buy: +petsmagic buy ${id} [name]`
      );
    }

    // ── Materials ──────────────────────────────────────────
    if (subcmd === "materials" || subcmd === "mats") {
      const lines = Object.values(ARCHETYPE_MATERIAL).map(mat =>
        `  ${mat.emoji} ${mat.name}: ${data[mat.key] || 0}`
      ).join("\n");

      return message.reply(
        `🔧 𝗬𝗢𝗨𝗥 𝗨𝗣𝗚𝗥𝗔𝗗𝗘 𝗠𝗔𝗧𝗘𝗥𝗜𝗔𝗟𝗦\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${lines}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 Earn materials by winning +petbattle\n` +
        `💡 Use +petsmagic upgrade <slot#> to upgrade`
      );
    }

    // ── Buy <id> [name] ────────────────────────────────────
    if (subcmd === "buy") {
      const id       = parseInt(args[1]);
      const template = BEAST_CATALOG[id];

      if (!template) return message.reply(`❌ Invalid beast ID. Use +petsmagic to browse.`);

      if (pets.length >= maxSlots) {
        return message.reply(
          `❌ All ${maxSlots} pet slots are full!\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `  • +petshop sell <slot#> to sell a pet\n` +
          `  • +petshop release <slot#> to release\n` +
          (maxSlots < MAX_SLOTS
            ? `  • +petslots to expand (max ${MAX_SLOTS})`
            : `  • Maximum slots reached (${MAX_SLOTS})`)
        );
      }

      if (diamonds < template.price) {
        return message.reply(
          `❌ Not enough diamonds.\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `💎 ${template.emoji} ${template.name} costs: 💎${template.price}\n` +
          `💎 Your balance: ${formatDiamonds(diamonds)}\n` +
          `💡 +diamonds convert or +dailydiamond`
        );
      }

      const rawName   = args.slice(2).join(" ").trim();
      const finalName = rawName
        ? rawName.slice(0, 20).replace(/[^\w\s\-!?♥]/g, "").trim() || template.name
        : template.name;

      const newBeast    = createBeast(id, finalName, senderID);
      const newPets     = [...pets, newBeast];
      const newDiamonds = parseFloat((diamonds - template.price).toFixed(4));

      await usersData.set(senderID, {
        ...userData,
        data: { ...data, pets: newPets, petDiamonds: newDiamonds },
      });

      const mat = ARCHETYPE_MATERIAL[template.archetype];
      return message.reply(
        `🎉 𝗔𝗡𝗖𝗜𝗘𝗡𝗧 𝗕𝗘𝗔𝗦𝗧 𝗔𝗖𝗤𝗨𝗜𝗥𝗘𝗗!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${template.emoji} ${finalName}\n` +
        `🏷️  ${template.title}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `✦ ${template.traitDesc}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚔️ ATK:     ${template.baseStats.atk} (max ${template.maxStats.atk})\n` +
        `🛡️ DEF:     ${template.baseStats.def} (max ${template.maxStats.def})\n` +
        `💨 Agility: ${template.baseStats.agility} (max ${template.maxStats.agility})\n` +
        `❤️ HP:      ${template.baseStats.hp}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💎 Spent:   💎${template.price}\n` +
        `💎 Balance: ${formatDiamonds(newDiamonds)}\n` +
        `🏠 Slot:    ${newPets.length}/${maxSlots}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🔧 Upgrade with ${mat.emoji} ${mat.name} from +petbattle wins!\n` +
        `💡 Use +petsmagic upgrade ${newPets.length} to power up`
      );
    }

    // ── Upgrade <slot#> ────────────────────────────────────
    if (subcmd === "upgrade") {
      const slot = parseInt(args[1]);
      if (!slot || slot < 1 || slot > pets.length) {
        return message.reply(`❌ Invalid slot. You have ${pets.length} pet(s). Use +petshop slots to check.`);
      }

      const pet = pets[slot - 1];
      if (!pet.isMagic) {
        return message.reply(
          `❌ Only Magic Beasts from +petsmagic can be upgraded.\n` +
          `${pet.emoji} ${pet.name} is a regular pet.`
        );
      }

      if (pet.level >= MAX_LEVEL) {
        return message.reply(
          `✨ ${pet.emoji} ${pet.name} is already at GOD MODE (Lv.${MAX_LEVEL})!\n` +
          `It has reached its ultimate form.`
        );
      }

      const cost    = UPGRADE_COSTS[pet.level];
      const matKey  = pet.matKey;
      const matName = pet.matName;
      const matEmoji = pet.matEmoji;
      const matOwned = data[matKey] || 0;

      // Show cost preview if no confirmation yet
      const confirm = (args[2] || "").toLowerCase();
      if (confirm !== "confirm") {
        const nextLevel  = pet.level + 1;
        const nextStats  = getScaledStats(BEAST_CATALOG[pet.catalogId], nextLevel);
        const currStats  = getScaledStats(BEAST_CATALOG[pet.catalogId], pet.level);
        return message.reply(
          `🔧 𝗨𝗣𝗚𝗥𝗔𝗗𝗘 𝗣𝗥𝗘𝗩𝗜𝗘𝗪\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `${pet.emoji} ${pet.name}\n` +
          `${levelBar(pet.level)}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📈 Lv.${pet.level} → Lv.${nextLevel}\n` +
          `  ⚔️ ATK:     ${currStats.atk} → ${nextStats.atk} (+${nextStats.atk - currStats.atk})\n` +
          `  🛡️ DEF:     ${currStats.def} → ${nextStats.def} (+${nextStats.def - currStats.def})\n` +
          `  💨 Agility: ${currStats.agility} → ${nextStats.agility} (+${nextStats.agility - currStats.agility})\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `💰 COST:\n` +
          `  💎 Diamonds: ${cost.diamonds} (you have: ${formatDiamonds(diamonds)})\n` +
          `  ${matEmoji} ${matName}: ${cost.mat} (you have: ${matOwned})\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `${nextLevel >= MAX_LEVEL ? "⚠️ This is the FINAL upgrade — GOD MODE!\n" : ""}` +
          `✅ Confirm: +petsmagic upgrade ${slot} confirm`
        );
      }

      // Validate resources
      if (diamonds < cost.diamonds) {
        return message.reply(
          `❌ Not enough diamonds.\n` +
          `Need: 💎${cost.diamonds} | Have: 💎${formatDiamonds(diamonds)}`
        );
      }
      if (matOwned < cost.mat) {
        return message.reply(
          `❌ Not enough ${matEmoji} ${matName}.\n` +
          `Need: ${cost.mat} | Have: ${matOwned}\n` +
          `💡 Win +petbattle matches to earn materials!`
        );
      }

      // Apply upgrade
      const newLevel   = pet.level + 1;
      const newStats   = getScaledStats(BEAST_CATALOG[pet.catalogId], newLevel);
      const newPets    = [...pets];
      newPets[slot - 1] = {
        ...pet,
        level:   newLevel,
        atk:     newStats.atk,
        def:     newStats.def,
        agility: newStats.agility,
        hp:      pet.hp, // preserve current HP
        maxHp:   newStats.maxHp,
      };

      const newDiamonds = parseFloat((diamonds - cost.diamonds).toFixed(4));
      const newMats     = matOwned - cost.mat;

      await usersData.set(senderID, {
        ...userData,
        data: {
          ...data,
          pets:        newPets,
          petDiamonds: newDiamonds,
          [matKey]:    newMats,
        },
      });

      const godMode = newLevel >= MAX_LEVEL;
      return message.reply(
        `${godMode ? "🔱 GOD MODE UNLOCKED!" : "⬆️ BEAST UPGRADED!"}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${pet.emoji} ${pet.name}\n` +
        `${levelBar(newLevel)}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚔️ ATK:     ${newStats.atk}\n` +
        `🛡️ DEF:     ${newStats.def}\n` +
        `💨 Agility: ${newStats.agility}\n` +
        `❤️ HP:      ${pet.maxHp}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💎 Diamonds left: ${formatDiamonds(newDiamonds)}\n` +
        `${matEmoji} ${matName} left: ${newMats}\n` +
        (godMode
          ? `\n🔱 ${pet.name} has reached its ultimate form!\n✦ ${pet.traitDesc}`
          : `\n💡 Next upgrade: 💎${UPGRADE_COSTS[newLevel]?.diamonds} + ${matEmoji}${UPGRADE_COSTS[newLevel]?.mat}`)
      );
    }

    return message.reply(
      `❓ Unknown command.\nUse +petsmagic to browse all beasts.`
    );
  },
};

// ── Export for petbattle.js ────────────────────────────────────
module.exports.BEAST_CATALOG       = BEAST_CATALOG;
module.exports.ARCHETYPE_MATERIAL  = ARCHETYPE_MATERIAL;
module.exports.getScaledStats      = getScaledStats;
module.exports.formatDiamonds      = formatDiamonds;
module.exports.MAX_LEVEL           = MAX_LEVEL;
