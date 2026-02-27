// ═══════════════════════════════════════════════════════════════
//   fight_upgrade.js  —  Shop for skills, traits & upgrades
// ═══════════════════════════════════════════════════════════════

// ─── SHOP CATALOG ──────────────────────────────────────────────
const SHOP = {
  // ── Traits (inborn / always-active after purchase) ──────────
  traits: {
    ironhide:   {
      label: "𝗜𝗿𝗼𝗻 𝗛𝗶𝗱𝗲",     cost: 10_000_000_000,
      desc:  "Permanently reduces all incoming damage by 18%.",
      type: "trait",
    },
    shadowstep: {
      label: "𝗦𝗵𝗮𝗱𝗼𝘄 𝗦𝘁𝗲𝗽",   cost: 25_000_000_000,
      desc:  "Permanently adds +20% base dodge chance.",
      type: "trait",
    },
    berserker:  {
      label: "𝗕𝗲𝗿𝘀𝗲𝗿𝗸𝗲𝗿",     cost: 50_000_000_000,
      desc:  "Permanently adds +12 flat damage to every attack.",
      type: "trait",
    },
    cursed:     {
      label: "𝗖𝘂𝗿𝘀𝗲𝗱 𝗙𝗶𝘀𝘁",   cost: 75_000_000_000,
      desc:  "Every attack applies a stacking curse that reduces opponent defense by 10%.",
      type: "trait",
    },
    phoenix:    {
      label: "𝗣𝗵𝗼𝗲𝗻𝗶𝘅 𝗕𝗹𝗼𝗼𝗱", cost: 90_000_000_000_000_000_000,
      desc:  "Once per fight, survive a lethal blow with 1 HP. (Rarest trait!)",
      type: "trait",
    },
  },

  // ── Special Attack Unlocks ────────────────────────────────
  specialAttacks: {
    deathblow: {
      label: "𝗗𝗲𝗮𝘁𝗵𝗯𝗹𝗼𝘄", cost: 15_000_000_000,
      desc:  "Unlock the Deathblow attack (35–55 dmg).",
      type: "skill",
    },
    sonicfist: {
      label: "𝗦𝗼𝗻𝗶𝗰𝗙𝗶𝘀𝘁",  cost: 20_000_000_000,
      desc:  "Unlock the SonicFist attack (30–50 dmg).",
      type: "skill",
    },
    shockwave: {
      label: "𝗦𝗵𝗼𝗰𝗸𝘄𝗮𝘃𝗲",  cost: 18_000_000_000,
      desc:  "Unlock the Shockwave attack (28–45 dmg).",
      type: "skill",
    },
    blazekick: {
      label: "𝗕𝗹𝗮𝘇𝗲𝗞𝗶𝗰𝗸",  cost: 22_000_000_000,
      desc:  "Unlock the BlazeKick attack (32–52 dmg).",
      type: "skill",
    },
  },

  // ── Passive Upgrades ────────────────────────────────────────
  // maxLevel raised from 10 → 100.
  // Existing Lv.10 owners are unaffected — they simply continue from Lv.11.
  passives: {
    atkup: {
      label:    "𝗔𝘁𝘁𝗮𝗰𝗸 𝗕𝗼𝗼𝘀𝘁",
      cost:     5_000_000_000,
      desc:     "+5 flat damage per level (max 100 levels).",
      maxLevel: 100, type: "passive", stat: "fightAtkBonus", gain: 5,
    },
    defup: {
      label:    "𝗗𝗲𝗳𝗲𝗻𝘀𝗲 𝗕𝗼𝗼𝘀𝘁",
      cost:     5_000_000_000,
      desc:     "+5% damage reduction per level (max 100 levels, soft-cap applies in combat).",
      maxLevel: 100, type: "passive", stat: "fightDefBonus", gain: 5,
    },
    agilityup: {
      label:    "𝗔𝗴𝗶𝗹𝗶𝘁𝘆 𝗕𝗼𝗼𝘀𝘁",
      cost:     5_000_000_000,
      desc:     "+5% dodge chance per level (max 100 levels, soft-cap applies in combat).",
      maxLevel: 100, type: "passive", stat: "fightAgilityBonus", gain: 5,
    },
    hpup: {
      label:    "𝗛𝗲𝗮𝗹𝘁𝗵 𝗕𝗼𝗼𝘀𝘁",
      cost:     5_000_000,
      desc:     "+50 max HP per purchase (hard limit: 5,000 bonus HP / 5,100 total HP).",
      maxBonus: 5000,
      type:     "hpup",
    },
  },

  // ── Unlockable In-Fight Abilities ────────────────────────
  abilities: {
    heal: {
      label: "𝗛𝗲𝗮𝗹", cost: 100_000_000,
      desc:  "Unlock the 'heal' in-fight action — restores 50% of your max HP once per fight.",
      type: "ability",
    },
  },
};

// ─── HELPERS ────────────────────────────────────────────────────
const ALL_ITEMS = {
  ...SHOP.traits,
  ...SHOP.specialAttacks,
  ...SHOP.passives,
  ...SHOP.abilities,
};

function fmt(n) { return `$${BigInt(Math.round(n)).toLocaleString()}`; }

function hpCapBar(current, max, length = 10) {
  const filled = Math.round((Math.min(current, max) / max) * length);
  return "█".repeat(filled) + "░".repeat(length - filled);
}

// ═══════════════════════════════════════════════════════════════
module.exports = {
  config: {
    name: "fightupgrade",
    aliases: ["fightshop", "fightbuy"],
    version: "1.1",
    author: "Charles MK",
    countDown: 25,
    role: 0,
    shortDescription: { en: "⚔️ Purchase fight upgrades, traits & special moves" },
    category: "fun",
    guide: {
      en:
        "+fightupgrade           — View shop\n" +
        "+fightupgrade buy [id]  — Purchase an item\n" +
        "+fightupgrade info [id] — Details about an item",
    },
  },

  onStart: async function ({ event, message, usersData, args }) {
    const senderID = event.senderID;
    const sub      = args[0]?.toLowerCase();

    // ── Info ───────────────────────────────────────────────
    if (sub === "info" && args[1]) {
      const id   = args[1].toLowerCase();
      const item = ALL_ITEMS[id];
      if (!item) return message.send("❌ Item not found. Use +fightupgrade to see the shop.");
      return message.send(
        `🔍 𝗜𝗧𝗘𝗠 𝗗𝗘𝗧𝗔𝗜𝗟𝗦\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📦 ${item.label}\n` +
        `💵 Cost: ${fmt(item.cost)}\n` +
        `📋 ${item.desc}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Use: +fightupgrade buy ${id}`
      );
    }

    // ── Buy ────────────────────────────────────────────────
    if (sub === "buy" && args[1]) {
      const id   = args[1].toLowerCase();
      const item = ALL_ITEMS[id];
      if (!item) return message.send("❌ Item not found.");

      const userData = await usersData.get(senderID);
      const data     = userData.data || {};

      // ── Trait ────────────────────────────────────────────
      if (item.type === "trait") {
        if (data.fightTrait)
          return message.send(
            `❌ You already have a trait: ${SHOP.traits[data.fightTrait]?.label || data.fightTrait}\n` +
            `Traits cannot be replaced.`
          );
        if (userData.money < item.cost)
          return message.send(`❌ Insufficient funds!\n💵 Balance: ${fmt(userData.money)}\n💸 Need: ${fmt(item.cost)}`);

        await usersData.set(senderID, {
          money: userData.money - item.cost,
          data:  { ...data, fightTrait: id },
        });
        return message.send(
          `✅ 𝗧𝗿𝗮𝗶𝘁 𝗨𝗻𝗹𝗼𝗰𝗸𝗲𝗱!\n━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🧬 ${item.label} is now active!\n` +
          `📋 ${item.desc}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `💰 Remaining: ${fmt(userData.money - item.cost)}`
        );
      }

      // ── Skill unlock ─────────────────────────────────────
      if (item.type === "skill") {
        const skills = data.fightSkills || {};
        if (skills[id] >= 1)
          return message.send(`✅ You already own ${item.label}.`);
        if (userData.money < item.cost)
          return message.send(`❌ Insufficient funds!\n💵 Balance: ${fmt(userData.money)}\n💸 Need: ${fmt(item.cost)}`);

        skills[id] = 1;
        await usersData.set(senderID, {
          money: userData.money - item.cost,
          data:  { ...data, fightSkills: skills },
        });
        return message.send(
          `✅ 𝗦𝗸𝗶𝗹𝗹 𝗨𝗻𝗹𝗼𝗰𝗸𝗲𝗱!\n━━━━━━━━━━━━━━━━━━━━━━\n` +
          `⚔️ ${item.label} is now available!\n` +
          `📋 ${item.desc}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `💰 Remaining: ${fmt(userData.money - item.cost)}`
        );
      }

      // ── Passive upgrade ───────────────────────────────────
      if (item.type === "passive") {
        const curLevel = data[`${item.stat}Level`] || 0;
        if (curLevel >= item.maxLevel)
          return message.send(`❌ ${item.label} is at max level (${item.maxLevel}).`);

        const scaledCost = item.cost * (curLevel + 1);
        if (userData.money < scaledCost)
          return message.send(
            `❌ Insufficient funds!\n` +
            `💵 Balance: ${fmt(userData.money)}\n` +
            `💸 Need: ${fmt(scaledCost)} (Lv.${curLevel + 1})`
          );

        const newLevel   = curLevel + 1;
        const newStatVal = (data[item.stat] || 0) + item.gain;

        await usersData.set(senderID, {
          money: userData.money - scaledCost,
          data: {
            ...data,
            [item.stat]:           newStatVal,
            [`${item.stat}Level`]: newLevel,
          },
        });
        return message.send(
          `✅ 𝗨𝗽𝗴𝗿𝗮𝗱𝗲𝗱!\n━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📈 ${item.label} → Lv.${newLevel} / ${item.maxLevel}\n` +
          `💪 +${item.gain} applied (Total: ${newStatVal})\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `💰 Remaining: ${fmt(userData.money - scaledCost)}\n` +
          (newLevel < item.maxLevel
            ? `🔼 Next upgrade: ${fmt(item.cost * (newLevel + 1))}`
            : `🏆 MAX LEVEL REACHED!`)
        );
      }

      // ── HP upgrade ────────────────────────────────────────
      if (item.type === "hpup") {
        const curBonus = data.fightBonusHP || 0;

        if (curBonus >= item.maxBonus)
          return message.send(
            `❌ 𝗛𝗣 𝗖𝗮𝗽 𝗥𝗲𝗮𝗰𝗵𝗲𝗱!\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `❤️ Bonus HP: ${curBonus} / ${item.maxBonus} (${100 + curBonus} total)\n` +
            `You cannot purchase any more HP upgrades.`
          );

        if (userData.money < item.cost)
          return message.send(`❌ Insufficient funds!\n💵 Balance: ${fmt(userData.money)}\n💸 Need: ${fmt(item.cost)}`);

        const newBonus = curBonus + 50;
        const newMoney = userData.money - item.cost;
        const atCap    = newBonus >= item.maxBonus;

        await usersData.set(senderID, {
          money: newMoney,
          data:  { ...data, fightBonusHP: newBonus },
        });
        return message.send(
          `✅ 𝗛𝗲𝗮𝗹𝘁𝗵 𝗨𝗽𝗴𝗿𝗮𝗱𝗲𝗱!\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `❤️ Max HP: ${100 + curBonus} → ${100 + newBonus}\n` +
          `💪 +50 HP added!\n` +
          `📊 Bonus HP: ${newBonus} / ${item.maxBonus}\n` +
          `   [${hpCapBar(newBonus, item.maxBonus)}]\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `💰 Remaining: ${fmt(newMoney)}\n` +
          (atCap
            ? `🏆 MAX HP REACHED!`
            : `🔼 Buy again for another +50 HP (${item.maxBonus - newBonus} remaining until cap)`)
        );
      }

      // ── Ability unlock ────────────────────────────────────
      if (item.type === "ability") {
        const abilities = data.fightAbilities || {};
        if (abilities[id])
          return message.send(`✅ You already own ${item.label}.`);
        if (userData.money < item.cost)
          return message.send(`❌ Insufficient funds!\n💵 Balance: ${fmt(userData.money)}\n💸 Need: ${fmt(item.cost)}`);

        abilities[id] = true;
        await usersData.set(senderID, {
          money: userData.money - item.cost,
          data:  { ...data, fightAbilities: abilities },
        });
        return message.send(
          `✅ 𝗔𝗯𝗶𝗹𝗶𝘁𝘆 𝗨𝗻𝗹𝗼𝗰𝗸𝗲𝗱!\n━━━━━━━━━━━━━━━━━━━━━━\n` +
          `💚 ${item.label} is now usable in fight!\n` +
          `📋 ${item.desc}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `💰 Remaining: ${fmt(userData.money - item.cost)}`
        );
      }

      return message.send("❌ Unknown item type.");
    }

    // ── Shop listing ───────────────────────────────────────
    const userData = await usersData.get(senderID);
    const data     = userData?.data || {};
    const curBonus = data.fightBonusHP || 0;

    let msg =
      `🛒 𝗙𝗜𝗚𝗛𝗧 𝗦𝗛𝗢𝗣\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Use: +fightupgrade buy [id]\n\n`;

    msg += `🧬 𝗧𝗥𝗔𝗜𝗧𝗦 (Permanent, always active)\n`;
    for (const [id, item] of Object.entries(SHOP.traits)) {
      const owned = data.fightTrait === id;
      msg += `  [${id}] ${item.label} — ${fmt(item.cost)}${owned ? " ✅" : ""}\n`;
    }

    msg += `\n⚔️ 𝗦𝗣𝗘𝗖𝗜𝗔𝗟 𝗔𝗧𝗧𝗔𝗖𝗞𝗦 (Unlockable moves)\n`;
    for (const [id, item] of Object.entries(SHOP.specialAttacks)) {
      const owned = (data.fightSkills || {})[id] >= 1;
      msg += `  [${id}] ${item.label} — ${fmt(item.cost)}${owned ? " ✅" : ""}\n`;
    }

    msg += `\n📈 𝗣𝗔𝗦𝗦𝗜𝗩𝗘 𝗨𝗣𝗚𝗥𝗔𝗗𝗘𝗦\n`;
    for (const [id, item] of Object.entries(SHOP.passives)) {
      if (item.type === "hpup") {
        const atCap = curBonus >= item.maxBonus;
        msg +=
          `  [${id}] ${item.label} — ${fmt(item.cost)} per +50 HP\n` +
          `         ${curBonus}/${item.maxBonus} bonus HP  [${hpCapBar(curBonus, item.maxBonus)}]` +
          (atCap ? " 🏆 MAXED" : "") + `\n`;
      } else {
        const curLvl = data[`${item.stat}Level`] || 0;
        const maxed  = curLvl >= item.maxLevel;
        const nextCost = !maxed ? fmt(item.cost * (curLvl + 1)) : null;
        msg +=
          `  [${id}] ${item.label} — ${fmt(item.cost)}/lvl × level (max ${item.maxLevel})\n` +
          `         Lv.${curLvl}/${item.maxLevel}` +
          (maxed ? " 🏆 MAXED" : `  Next: ${nextCost}`) + `\n`;
      }
    }

    msg += `\n💚 𝗜𝗡-𝗙𝗜𝗚𝗛𝗧 𝗔𝗕𝗜𝗟𝗜𝗧𝗜𝗘𝗦\n`;
    for (const [id, item] of Object.entries(SHOP.abilities)) {
      const owned = (data.fightAbilities || {})[id];
      msg += `  [${id}] ${item.label} — ${fmt(item.cost)}${owned ? " ✅" : ""}\n`;
    }

    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🔍 +fightupgrade info [id] for details`;
    return message.send(msg);
  },
};
