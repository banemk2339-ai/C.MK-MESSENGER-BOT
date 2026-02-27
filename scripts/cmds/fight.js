const TIMEOUT_SECONDS = 120;
const ongoingFights     = new Map();
const gameInstances     = new Map();
const pendingChallenges = new Map();

// ═══════════════════════════════════════════════════════════════
//   HP BAR HELPER
// ═══════════════════════════════════════════════════════════════
function hpBar(current, max, length = 10) {
  const ratio  = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(ratio * length);
  const empty  = length - filled;
  const bar    = "█".repeat(filled) + "░".repeat(empty);
  const pct    = Math.round(ratio * 100);
  return `[${bar}] ${pct}%`;
}

function hpLine(participant) {
  const hp    = Math.max(0, participant.hp);
  const maxHP = participant.maxHP;
  const icon  = hp > maxHP * 0.5 ? "💚" : hp > maxHP * 0.25 ? "💛" : "❤️";
  return `${icon} ${participant.name}: ${hp}/${maxHP} HP  ${hpBar(hp, maxHP)}`;
}

// ═══════════════════════════════════════════════════════════════
//   MOVES DATABASE
// ═══════════════════════════════════════════════════════════════
const MOVES = {
  punch:     { min: 5,  max: 15,  emoji: "👊", type: "basic",   label: "punch"      },
  kick:      { min: 10, max: 20,  emoji: "🦵", type: "basic",   label: "kick"       },
  slap:      { min: 1,  max: 5,   emoji: "✋", type: "basic",   label: "slap"       },
  headbutt:  { min: 15, max: 25,  emoji: "🗿", type: "basic",   label: "headbutt"   },
  elbow:     { min: 8,  max: 18,  emoji: "💪", type: "basic",   label: "elbow"      },
  uppercut:  { min: 12, max: 22,  emoji: "🥊", type: "basic",   label: "uppercut"   },
  backslash: { min: 20, max: 35,  emoji: "⚡", type: "power",   label: "backslash"  },
  dropkick:  { min: 18, max: 30,  emoji: "🌀", type: "power",   label: "dropkick"   },
  suplex:    { min: 22, max: 38,  emoji: "🤼", type: "power",   label: "suplex"     },
  haymaker:  { min: 25, max: 40,  emoji: "💢", type: "power",   label: "haymaker"   },
  stomp:     { min: 14, max: 28,  emoji: "👟", type: "power",   label: "stomp"      },
  deathblow: { min: 35, max: 55,  emoji: "💀", type: "special", label: "deathblow", requires: "deathblow" },
  sonicfist: { min: 30, max: 50,  emoji: "🌪️", type: "special", label: "sonicfist", requires: "sonicfist" },
  shockwave: { min: 28, max: 45,  emoji: "⚡", type: "special", label: "shockwave",  requires: "shockwave" },
  blazekick: { min: 32, max: 52,  emoji: "🔥", type: "special", label: "blazekick", requires: "blazekick" },
  block:     { type: "defense", emoji: "🛡️", label: "block"   },
  parry:     { type: "defense", emoji: "⚔️",  label: "parry"   },
  counter:   { type: "defense", emoji: "🔄",  label: "counter" },
  evade:     { type: "defense", emoji: "💨",  label: "evade"   },
};

// ═══════════════════════════════════════════════════════════════
//   STATS HELPERS
// ═══════════════════════════════════════════════════════════════
function getStats(userData) {
  const d = userData.data || {};
  return {
    level:        d.fightLevel        || 1,
    wins:         d.fightWins         || 0,
    losses:       d.fightLosses       || 0,
    atkBonus:     d.fightAtkBonus     || 0,
    defBonus:     d.fightDefBonus     || 0,
    agilityBonus: d.fightAgilityBonus || 0,
    bonusHP:      d.fightBonusHP      || 0,
    abilities:    d.fightAbilities    || {},
    trait:        d.fightTrait        || null,
    skills:       d.fightSkills       || {},
    trainedAt:    d.fightTrainedAt    || 0,
    xp:           d.fightXP           || 0,
  };
}

function xpForLevel(lvl) { return lvl * 100; }

function calcLevel(stats) {
  let lvl = 1, xp = stats.xp;
  while (xp >= xpForLevel(lvl)) { xp -= xpForLevel(lvl); lvl++; if (lvl >= 100) break; }
  return lvl;
}

// ═══════════════════════════════════════════════════════════════
//   POWER SCORE — matchmaking fairness
// ═══════════════════════════════════════════════════════════════
function calcPower(stats) {
  const atkPts     = stats.atkBonus     / 5;
  const defPts     = stats.defBonus     / 5;
  const agiPts     = stats.agilityBonus / 5;
  const hpPts      = stats.bonusHP      / 50;
  const traitBonus = stats.trait ? 15 : 0;
  return atkPts + defPts + agiPts + hpPts + traitBonus;
}

const TRAITS = {
  ironhide:   { label: "𝗜𝗿𝗼𝗻 𝗛𝗶𝗱𝗲",     defBonus: 18 },
  shadowstep: { label: "𝗦𝗵𝗮𝗱𝗼𝘄 𝗦𝘁𝗲𝗽",   agilityBonus: 20 },
  berserker:  { label: "𝗕𝗲𝗿𝘀𝗲𝗿𝗸𝗲𝗿",     atkBonus: 12 },
  cursed:     { label: "𝗖𝘂𝗿𝘀𝗲𝗱 𝗙𝗶𝘀𝘁",   debuff: 10 },
  phoenix:    { label: "𝗣𝗵𝗼𝗲𝗻𝗶𝘅 𝗕𝗹𝗼𝗼𝗱", revive: true },
};

// ═══════════════════════════════════════════════════════════════
//   FIX #1 — endFight is the SINGLE place that clears state.
//   Both maps + timeout cleared atomically, every time.
//   All code paths that end a fight call this before anything else.
// ═══════════════════════════════════════════════════════════════
function endFight(threadID) {
  const inst = gameInstances.get(threadID);
  if (inst?.timeoutID) clearTimeout(inst.timeoutID);
  gameInstances.delete(threadID);
  ongoingFights.delete(threadID);
}

// ═══════════════════════════════════════════════════════════════
module.exports = {
  config: {
    name: "fight",
    aliases: ["battle", "duel"],
    version: "3.2",
    author: "Charles MK",
    countDown: 10,
    role: 0,
    shortDescription: { en: "⚔️ Fight, bet & rise through the ranks!" },
    category: "fun",
    guide: {
      en:
        "{pn} @mention | reply | {pn} [UID]\n" +
        "{pn} topfighter — 🏆 Leaderboard\n" +
        "Attacks: punch, kick, slap, headbutt, elbow, uppercut,\n" +
        "         backslash, dropkick, suplex, haymaker, stomp (power)\n" +
        "Special: deathblow, sonicfist, shockwave, blazekick (unlock via +fightupgrade)\n" +
        "Defense: block, parry, counter, evade\n" +
        "Ability: heal (unlock via +fightupgrade — restores 50% HP, once per fight)\n" +
        "Type 'forfeit' to surrender.",
    },
  },

  // ───────────────────────────────────────────────────────────
  onStart: async function ({ event, message, usersData, args }) {
    const threadID = event.threadID;

    // ── Leaderboard ────────────────────────────────────────
    if (args[0] === "topfighter" || args[0] === "topfight") {
      const allUsers = await usersData.getAll();
      const fighters = allUsers
        .filter(u => u.data && u.data.fightWins > 0)
        .sort((a, b) => {
          if ((b.data.fightWins || 0) !== (a.data.fightWins || 0))
            return (b.data.fightWins || 0) - (a.data.fightWins || 0);
          return (a.data.fightLosses || 0) - (b.data.fightLosses || 0);
        });

      if (!fighters.length)
        return message.reply("🥊 𝗧𝗢𝗣 𝗙𝗜𝗚𝗛𝗧𝗘𝗥𝗦\n━━━━━━━━━━━━━━━━━━━━━━\nNo fighters yet!");

      const medals = ["🥇", "🥈", "🥉"];
      let msg = "🥊 𝗧𝗢𝗣 𝗙𝗜𝗚𝗛𝗧𝗘𝗥𝗦\n━━━━━━━━━━━━━━━━━━━━━━\n";
      fighters.slice(0, 10).forEach((u, i) => {
        const wins   = u.data.fightWins   || 0;
        const losses = u.data.fightLosses || 0;
        const wr     = (wins + losses) ? ((wins / (wins + losses)) * 100).toFixed(1) : "0.0";
        const lvl    = u.data.fightLevel  || 1;
        msg += `${medals[i] || `${i + 1}.`} 𝗟𝘃.${lvl} ${u.name}\n`;
        msg += `   🏆 ${wins}W  💀 ${losses}L  📊 ${wr}%\n\n`;
      });
      return message.reply(msg);
    }

    if (ongoingFights.has(threadID))
      return message.send("⚔️ A fight is already in progress here.");

    // ── Resolve opponent ───────────────────────────────────
    let opponentID;
    if (event.type === "message_reply")          opponentID = event.messageReply.senderID;
    else if (Object.keys(event.mentions).length) opponentID = Object.keys(event.mentions)[0];
    else if (args[0] && /^\d+$/.test(args[0]))   opponentID = args[0];

    if (!opponentID)
      return message.send("🤔 Mention, reply to, or provide a UID to challenge.");
    if (opponentID === event.senderID)
      return message.send("🤡 You cannot fight yourself.");

    try {
      const challengerID   = event.senderID;
      const challengerName = await usersData.getName(challengerID);
      const opponentName   = await usersData.getName(opponentID);

      // ── Power-gap matchmaking check ────────────────────
      const cData      = await usersData.get(challengerID);
      const oData      = await usersData.get(opponentID);
      const cStats     = getStats(cData);
      const oStats     = getStats(oData);
      const cPower     = calcPower(cStats);
      const oPower     = calcPower(oStats);
      const cPowerSafe = Math.max(1, cPower);
      const oPowerSafe = Math.max(1, oPower);

      if (cPowerSafe > oPowerSafe * 2) {
        const ratio = (cPowerSafe / oPowerSafe).toFixed(1);
        return message.send(
          `⚖️ 𝗠𝗔𝗧𝗖𝗛𝗠𝗔𝗞𝗜𝗡𝗚 𝗕𝗟𝗢𝗖𝗞𝗘𝗗\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `❌ You cannot challenge ${opponentName}.\n\n` +
          `⚔️ Your power score is ${ratio}× theirs — that's too large a gap.\n` +
          `📊 You: ${Math.round(cPower)} pts  |  ${opponentName}: ${Math.round(oPower)} pts\n\n` +
          `💡 Find a more evenly matched opponent!`
        );
      }
      if (oPowerSafe > cPowerSafe * 2) {
        const ratio = (oPowerSafe / cPowerSafe).toFixed(1);
        return message.send(
          `⚖️ 𝗠𝗔𝗧𝗖𝗛𝗠𝗔𝗞𝗜𝗡𝗚 𝗕𝗟𝗢𝗖𝗞𝗘𝗗\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `❌ You cannot challenge ${opponentName}.\n\n` +
          `⚔️ ${opponentName}'s power score is ${ratio}× yours — that's too large a gap.\n` +
          `📊 You: ${Math.round(cPower)} pts  |  ${opponentName}: ${Math.round(oPower)} pts\n\n` +
          `💡 Upgrade your skills first, or find a more evenly matched opponent!`
        );
      }

      const key = `${threadID}_${challengerID}`;
      pendingChallenges.set(key, {
        challengerID, challengerName, opponentID, opponentName,
        threadID, step: "mode_selection",
      });

      await message.send(
        `🤺 𝗙𝗜𝗚𝗛𝗧 𝗖𝗛𝗔𝗟𝗟𝗘𝗡𝗚𝗘!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 ${challengerName} challenges ${opponentName}!\n` +
        `📊 Power: ${Math.round(cPower)} vs ${Math.round(oPower)}\n\n` +
        `Choose mode:\n` +
        `  💰 Type "bet"      — Fight with money on the line\n` +
        `  🤝 Type "friendly" — Friendly match ($50M prize)\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⏱️ Reply within 60s or type "cancel"`
      );

      setTimeout(() => {
        if (pendingChallenges.has(key)) {
          pendingChallenges.delete(key);
          message.send("⏰ Challenge expired — no response.");
        }
      }, 60_000);
    } catch {
      return message.send("❌ Could not find that user.");
    }
  },

  // ───────────────────────────────────────────────────────────
  onChat: async function ({ event, message, usersData }) {
    const threadID = event.threadID;
    const senderID = event.senderID;
    const input    = event.body.trim().toLowerCase();

    // ── Pending challenge flow ─────────────────────────────
    const cKey    = `${threadID}_${senderID}`;
    const pending = pendingChallenges.get(cKey);

    if (pending) {
      const { challengerID, challengerName, opponentID, opponentName, step } = pending;

      if (input === "cancel") {
        pendingChallenges.delete(cKey);
        return message.send("❌ Challenge cancelled.");
      }

      if (step === "mode_selection") {
        if (input === "bet") {
          pending.mode = "bet";
          pending.step = "bet_amount";
          return message.send(
            `💰 𝗕𝗘𝗧 𝗠𝗢𝗗𝗘\n━━━━━━━━━━━━━━━━━━━━━━\n` +
            `${challengerName}, how much will you wager?\n(Min $1,000)`
          );
        }
        if (input === "friendly") {
          pendingChallenges.delete(cKey);
          return this.startFight(message, usersData, {
            challengerID, challengerName, opponentID, opponentName,
            threadID, mode: "friendly", challengerBet: 0, opponentBet: 0,
          });
        }
        return;
      }

      if (step === "bet_amount") {
        const bet = parseInt(input.replace(/[,$\s]/g, ""));
        if (isNaN(bet) || bet < 1000)
          return message.send("❌ Invalid amount (min $1,000).");
        const cData = await usersData.get(challengerID);
        if (cData.money < bet)
          return message.send(`❌ Insufficient funds!\n💵 Balance: $${cData.money.toLocaleString()}`);
        pending.challengerBet = bet;
        pending.step = "waiting_opponent_bet";

        const oKey = `${threadID}_${opponentID}`;
        pendingChallenges.set(oKey, { ...pending, step: "opponent_bet" });
        pendingChallenges.delete(cKey);
        return message.send(
          `💰 ${challengerName} bets $${bet.toLocaleString()}\n━━━━━━━━━━━━━━━━━━━━━━\n` +
          `${opponentName}, how much will you wager?\n(Type amount or "decline")`
        );
      }
    }

    // ── Opponent bet response ──────────────────────────────
    const oKey    = `${threadID}_${senderID}`;
    const oppChal = pendingChallenges.get(oKey);

    if (oppChal?.step === "opponent_bet") {
      if (input === "decline") {
        pendingChallenges.delete(oKey);
        return message.send(`❌ ${oppChal.opponentName} declined the fight.`);
      }
      const bet = parseInt(input.replace(/[,$\s]/g, ""));
      if (isNaN(bet) || bet < 1000)
        return message.send("❌ Invalid amount (min $1,000).");
      const oData = await usersData.get(senderID);
      if (oData.money < bet)
        return message.send(`❌ Insufficient funds!\n💵 Balance: $${oData.money.toLocaleString()}`);
      oppChal.opponentBet = bet;
      pendingChallenges.delete(oKey);
      return this.startFight(message, usersData, oppChal);
    }

    // ── Active fight ───────────────────────────────────────
    const inst = gameInstances.get(threadID);
    if (!inst) return;
    const { fight } = inst;

    const isP1 = senderID === fight.participants[0].id;
    const isP2 = senderID === fight.participants[1].id;
    if (!isP1 && !isP2) return;

    // ── FIX #2 — forfeit checked BEFORE the turn gate.
    //    Either player can forfeit at any time, even out of turn.
    //    endFight() called first so the thread unblocks immediately.
    if (input === "forfeit") {
      const loser  = fight.participants.find(p => p.id === senderID);
      const winner = fight.participants.find(p => p.id !== senderID);
      endFight(threadID);
      await this.handleFightEnd(message, usersData, fight, winner, loser, true);
      return;
    }

    if (senderID !== fight.currentPlayer) {
      if (!inst.turnMessageSent) {
        const curName = fight.participants.find(p => p.id === fight.currentPlayer).name;
        await message.send(`⏳ Wait! It's ${curName}'s turn.`);
        inst.turnMessageSent = true;
      }
      return;
    }

    // ── Heal ───────────────────────────────────────────────
    if (input === "heal") {
      const healerData  = await usersData.get(senderID);
      const healerStats = getStats(healerData);

      if (!healerStats.abilities?.heal)
        return message.send(
          `🔒 Heal not unlocked!\n` +
          `Purchase it for $100,000,000 using +fightupgrade buy heal`
        );

      const healer = fight.participants.find(p => p.id === senderID);
      if (fight.healUsed?.[senderID])
        return message.send(`❌ You've already used heal this fight!\n` + hpLine(healer));

      fight.healUsed = fight.healUsed || {};
      fight.healUsed[senderID] = true;

      const healAmt  = Math.floor(healer.maxHP * 0.5);
      const oldHP    = healer.hp;
      healer.hp      = Math.min(healer.maxHP, healer.hp + healAmt);
      const restored = healer.hp - oldHP;
      const defender = fight.participants.find(p => p.id !== senderID);

      await message.send(
        `💚 𝗛𝗘𝗔𝗟!\n━━━━━━━━━━━━━━━━━━━━━━\n` +
        `✨ ${healer.name} recovers ${restored} HP!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${hpLine(healer)}\n` +
        `${hpLine(defender)}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ Heal can only be used once per fight!`
      );

      fight.currentPlayer  = defender.id;
      inst.turnMessageSent = false;
      resetTimeout(threadID, message);
      return;
    }

    const attacker = fight.participants.find(p => p.id === senderID);
    const defender = fight.participants.find(p => p.id !== senderID);
    const atkData  = await usersData.get(attacker.id);
    const defData  = await usersData.get(defender.id);
    const atkStats = getStats(atkData);
    const defStats = getStats(defData);
    const move     = MOVES[input];

    // ── Defense ────────────────────────────────────────────
    if (move?.type === "defense") {
      let defMsg = "";
      if (input === "block") {
        fight.blockActive = { id: attacker.id, reduction: 0.45 + (defStats.defBonus / 200) };
        defMsg = `🛡️ 𝗕𝗟𝗢𝗖𝗞!\n━━━━━━━━━━━━━━━━━━━━━━\n${attacker.name} raises their guard!\n🛡️ Next hit reduced ~45%`;
      } else if (input === "parry") {
        fight.parryActive = { id: attacker.id };
        defMsg = `⚔️ 𝗣𝗔𝗥𝗥𝗬!\n━━━━━━━━━━━━━━━━━━━━━━\n${attacker.name} ready to reflect!\n⚔️ If attacked, reflects 30% dmg back`;
      } else if (input === "counter") {
        fight.counterActive = { id: attacker.id };
        defMsg = `🔄 𝗖𝗢𝗨𝗡𝗧𝗘𝗥!\n━━━━━━━━━━━━━━━━━━━━━━\n${attacker.name} enters counter stance!\n🔄 Next attack bounces back`;
      } else if (input === "evade") {
        const ch = Math.min(0.85, 0.55 + (atkStats.agilityBonus / 200));
        fight.evadeActive = { id: attacker.id, chance: ch };
        defMsg = `💨 𝗘𝗩𝗔𝗗𝗘!\n━━━━━━━━━━━━━━━━━━━━━━\n${attacker.name} prepares to dodge!\n💨 ${Math.round(ch * 100)}% dodge chance next hit`;
      }
      defMsg +=
        `\n━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${hpLine(attacker)}\n` +
        `${hpLine(defender)}`;
      await message.send(defMsg);
      fight.currentPlayer  = defender.id;
      inst.turnMessageSent = false;
      resetTimeout(threadID, message);
      return;
    }

    if (!move || !["basic", "power", "special"].includes(move.type)) return;

    if (move.requires && !(atkStats.skills[move.requires] >= 1))
      return message.send(`🔒 "${input}" requires the "${move.requires}" upgrade.\nUse +fightupgrade to unlock.`);

    // Counter stance triggers
    if (fight.counterActive?.id === defender.id) {
      delete fight.counterActive;
      attacker.hp -= 10;
      await message.send(
        `🔄 𝗖𝗢𝗨𝗡𝗧𝗘𝗥𝗘𝗗!\n━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${attacker.name} attacked — ${defender.name} countered!\n` +
        `💥 ${attacker.name} takes 10 reflected damage!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${hpLine(attacker)}\n` +
        `${hpLine(defender)}`
      );
      if (attacker.hp <= 0) {
        endFight(threadID);
        await this.handleFightEnd(message, usersData, fight, defender, attacker, false);
        return;
      }
      fight.currentPlayer  = defender.id;
      inst.turnMessageSent = false;
      return resetTimeout(threadID, message);
    }

    // ── Calculate damage ───────────────────────────────────
    let damage = Math.floor(Math.random() * (move.max - move.min + 1)) + move.min;
    damage += atkStats.atkBonus;
    if (atkStats.skills[input]) damage += atkStats.skills[input] * 3;

    const atkTrait = TRAITS[atkStats.trait];
    const defTrait = TRAITS[defStats.trait];
    if (atkTrait?.atkBonus) damage += atkTrait.atkBonus;

    let dodgeChance = 0.08 + (defStats.agilityBonus / 200);
    if (defTrait?.agilityBonus) dodgeChance += defTrait.agilityBonus / 100;
    if (fight.evadeActive?.id === defender.id) {
      dodgeChance = fight.evadeActive.chance;
      delete fight.evadeActive;
    }

    const isCrit  = Math.random() < 0.15;
    const isDodge = Math.random() < dodgeChance;

    if (isDodge) {
      await message.send(
        `💨 𝗗𝗢𝗗𝗚𝗘𝗗!\n━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${move.emoji} ${attacker.name} used ${move.label}\n` +
        `🌪️ ${defender.name} evaded the attack!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${hpLine(attacker)}\n` +
        `${hpLine(defender)}`
      );
      fight.currentPlayer  = defender.id;
      inst.turnMessageSent = false;
      resetTimeout(threadID, message);
      return;
    }

    if (isCrit) damage = Math.floor(damage * 1.5);

    let dmgReduction = defStats.defBonus / 100;
    if (defTrait?.defBonus) dmgReduction += defTrait.defBonus / 100;
    if (fight.debuffOnDefender) dmgReduction = Math.max(0, dmgReduction - fight.debuffOnDefender / 100);

    let statusLine = "";
    if (fight.parryActive?.id === defender.id) {
      const ref = Math.floor(damage * 0.3);
      attacker.hp -= ref;
      damage = Math.floor(damage * 0.7);
      delete fight.parryActive;
      statusLine += `⚔️ 𝗣𝗔𝗥𝗥𝗬𝗘𝗗! ${defender.name} reflected ${ref} dmg!\n`;
    }
    if (fight.blockActive?.id === defender.id) {
      damage = Math.floor(damage * (1 - fight.blockActive.reduction));
      delete fight.blockActive;
      statusLine += `🛡️ 𝗕𝗟𝗢𝗖𝗞𝗘𝗗! Damage reduced!\n`;
    }
    if (atkTrait?.debuff) {
      fight.debuffOnDefender = (fight.debuffOnDefender || 0) + atkTrait.debuff;
      statusLine += `☠️ 𝗖𝗨𝗥𝗦𝗘! ${defender.name} −${atkTrait.debuff}% def!\n`;
    }

    damage = Math.max(1, Math.floor(damage * (1 - dmgReduction)));
    defender.hp -= damage;

    // Phoenix survival
    if (defender.hp <= 0 && defTrait?.revive) {
      fight.phoenixUsed = fight.phoenixUsed || {};
      if (!fight.phoenixUsed[defender.id]) {
        fight.phoenixUsed[defender.id] = true;
        defender.hp = 1;
        statusLine += `🔥 𝗣𝗛𝗢𝗘𝗡𝗜𝗫 𝗕𝗟𝗢𝗢𝗗! ${defender.name} survives with 1 HP!\n`;
      }
    }

    const header = isCrit
      ? `💥 𝗖𝗥𝗜𝗧𝗜𝗖𝗔𝗟 𝗛𝗜𝗧!\n━━━━━━━━━━━━━━━━━━━━━━\n`
      : `⚔️ 𝗔𝗧𝗧𝗔𝗖𝗞!\n━━━━━━━━━━━━━━━━━━━━━━\n`;

    const atkHPLine = Math.max(0, attacker.hp) > 0 ? hpLine(attacker) : `💀 ${attacker.name}: K.O.`;
    const defHPLine = Math.max(0, defender.hp) > 0 ? hpLine(defender) : `💀 ${defender.name}: K.O.`;

    await message.send(
      header +
      statusLine +
      `${move.emoji} ${attacker.name} used ${move.label}\n` +
      `💥 ${defender.name} took ${damage} damage` + (isCrit ? " ⚡ CRIT!" : "") + `\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${atkHPLine}\n` +
      `${defHPLine}`
    );

    if (defender.hp <= 0) {
      // ── FIX #3 — endFight BEFORE handleFightEnd so the thread
      //    is freed immediately, not after async DB writes finish.
      //    No setTimeout: removing it also eliminates a race where
      //    someone could start a new fight in that 1s window.
      endFight(threadID);
      await this.handleFightEnd(message, usersData, fight, attacker, defender, false);
      return;
    }

    fight.currentPlayer  = defender.id;
    inst.turnMessageSent = false;
    resetTimeout(threadID, message);
  },

  // ───────────────────────────────────────────────────────────
  startFight: async function (message, usersData, fightData) {
    const {
      challengerID, challengerName, opponentID, opponentName,
      threadID, mode, challengerBet, opponentBet,
    } = fightData;

    const cData  = await usersData.get(challengerID);
    const oData  = await usersData.get(opponentID);
    const cStats = getStats(cData);
    const oStats = getStats(oData);
    const cMaxHP = 100 + cStats.bonusHP;
    const oMaxHP = 100 + oStats.bonusHP;

    const fight = {
      participants: [
        { id: challengerID, name: challengerName, hp: cMaxHP, maxHP: cMaxHP },
        { id: opponentID,   name: opponentName,   hp: oMaxHP, maxHP: oMaxHP },
      ],
      currentPlayer: Math.random() < 0.5 ? challengerID : opponentID,
      threadID, mode,
      challengerBet: challengerBet || 0,
      opponentBet:   opponentBet   || 0,
    };

    gameInstances.set(threadID, { fight, timeoutID: null, turnMessageSent: false });
    ongoingFights.set(threadID, fight);

    const first    = fight.currentPlayer === challengerID ? challengerName : opponentName;
    const modeText = mode === "bet"
      ? `💰 𝗕𝗘𝗧 𝗠𝗔𝗧𝗖𝗛\n   ${challengerName}: $${challengerBet.toLocaleString()}\n   ${opponentName}: $${opponentBet.toLocaleString()}\n   🏆 Pool: $${(challengerBet + opponentBet).toLocaleString()}`
      : `🤝 𝗙𝗥𝗜𝗘𝗡𝗗𝗟𝗬 𝗠𝗔𝗧𝗖𝗛\n   🏆 Prize: $50,000,000`;

    await message.send(
      `🤺 𝗧𝗛𝗘 𝗗𝗨𝗘𝗟 𝗕𝗘𝗚𝗜𝗡𝗦!\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${modeText}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 ${challengerName} (${cMaxHP}HP)  vs  ${opponentName} (${oMaxHP}HP)\n` +
      `⚡ First: ${first}\n\n` +
      `💡 Basic: punch, kick, slap, headbutt, elbow, uppercut\n` +
      `💥 Power: backslash, dropkick, suplex, haymaker, stomp\n` +
      `🔒 Special (unlockable): deathblow, sonicfist, shockwave, blazekick\n` +
      `🛡️ Defense: block, parry, counter, evade\n` +
      `💚 Ability: heal (unlockable — 50% HP, 1×/fight)\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⏱️ ${TIMEOUT_SECONDS}s timer | "forfeit" to surrender`
    );

    if (mode === "bet") {
      await usersData.set(challengerID, { money: cData.money - challengerBet });
      await usersData.set(opponentID,   { money: oData.money - opponentBet   });
    }

    startTimeout(threadID, message);

    for (const [k, v] of pendingChallenges.entries()) {
      if (v.threadID === threadID && (v.challengerID === challengerID || v.opponentID === opponentID))
        pendingChallenges.delete(k);
    }
  },

  // ───────────────────────────────────────────────────────────
  handleFightEnd: async function (message, usersData, fight, winner, loser, forfeited) {
    const winnerData = await usersData.get(winner.id);
    const loserData  = await usersData.get(loser.id);
    const wStats     = getStats(winnerData);
    const lStats     = getStats(loserData);

    const xpGain    = forfeited ? 20 : 50;
    const newXP     = (wStats.xp     || 0) + xpGain;
    const newLvl    = calcLevel({ ...wStats, xp: newXP });
    const newWins   = (wStats.wins   || 0) + 1;
    const newLosses = (lStats.losses || 0) + 1;

    const winnings = fight.mode === "bet"
      ? fight.challengerBet + fight.opponentBet
      : 50_000_000;

    await usersData.set(winner.id, {
      money: winnerData.money + winnings,
      data:  { ...winnerData.data, fightWins: newWins, fightXP: newXP, fightLevel: newLvl },
    });
    await usersData.set(loser.id, {
      data: { ...loserData.data, fightLosses: newLosses },
    });

    const lvlUp = newLvl > wStats.level ? `\n🆙 𝗟𝗘𝗩𝗘𝗟 𝗨𝗣! Now 𝗟𝘃.${newLvl}!` : "";

    await message.send(
      `🏆 𝗩𝗜𝗖𝗧𝗢𝗥𝗬!\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👑 ${winner.name} ${forfeited ? "wins by forfeit" : "defeats"} ${loser.name}!\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${fight.mode === "bet" ? "💰 𝗪𝗶𝗻𝗻𝗶𝗻𝗴𝘀" : "🎁 𝗣𝗿𝗶𝘇𝗲"}: $${winnings.toLocaleString()}\n` +
      `🏅 Victories: ${newWins}\n` +
      `✨ XP Gained: +${xpGain}${lvlUp}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🎉 GG WP!`
    );
  },
};

// ═══════════════════════════════════════════════════════════════
//   TIMEOUT UTILITIES
// ═══════════════════════════════════════════════════════════════
function startTimeout(threadID, message) {
  const id = setTimeout(async () => {
    if (!gameInstances.has(threadID)) return;
    const { fight } = gameInstances.get(threadID);

    // ── FIX #1 (part 2) — unblock the thread immediately before
    //    any async work so no ghost-fight lingers during DB writes.
    endFight(threadID);

    await message.send(
      `⏰ 𝗧𝗜𝗠𝗘𝗢𝗨𝗧!\n━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Fight cancelled due to inactivity.\n` +
      (fight.mode === "bet" ? "💰 Bets refunded." : "")
    );

    if (fight.mode === "bet") {
      try {
        const ud = global.GoatBot.usersData;
        const [d0, d1] = await Promise.all([
          ud.get(fight.participants[0].id),
          ud.get(fight.participants[1].id),
        ]);
        await ud.set(fight.participants[0].id, { money: d0.money + fight.challengerBet });
        await ud.set(fight.participants[1].id, { money: d1.money + fight.opponentBet   });
      } catch (e) {
        console.error("[fight] Timeout refund error:", e);
      }
    }
  }, TIMEOUT_SECONDS * 1000);

  gameInstances.get(threadID).timeoutID = id;
}

function resetTimeout(threadID, message) {
  const inst = gameInstances.get(threadID);
  if (inst?.timeoutID) { clearTimeout(inst.timeoutID); startTimeout(threadID, message); }
}
