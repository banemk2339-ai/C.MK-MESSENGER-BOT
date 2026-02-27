// ═══════════════════════════════════════════════════════════════
//   battlestats.js  —  Visual Fighter Profile Card v3.0
//   Changes: removed "BATTLE PROFILE" title, name font adjusted,
//            instant "Loading..." reply, no broken emoji icons
// ═══════════════════════════════════════════════════════════════

const { createCanvas, loadImage } = require("canvas");
const axios = require("axios");
const fs    = require("fs");
const path  = require("path");

const BG_URL = "https://i.postimg.cc/PfYNBwQq/file-000000004da471f78bac4b4a4d308e25.jpg";
const AV_URL = uid =>
  `https://graph.facebook.com/${uid}/picture?width=512&height=512&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;

const W = 720, H = 1280;

const CYAN   = "#64DCFF";
const WHITE  = "#E6F5FF";
const DIM    = "#A0C8E6";
const GREEN  = "#50FF8C";
const RED    = "#FF6464";
const YELLOW = "#FFD250";
const PURPLE = "#D2A0FF";
const GOLD   = "#FFD750";
const DARK_P = "rgba(5,20,60,0.75)";

function hexToRgba(hex, alpha = 1) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function glowText(ctx, text, x, y, font, color, glowColor, align = "center", glowRadius = 8) {
  ctx.save();
  ctx.font         = font;
  ctx.textAlign    = align;
  ctx.textBaseline = "middle";
  ctx.shadowColor  = glowColor || hexToRgba(color, 0.6);
  ctx.shadowBlur   = glowRadius;
  ctx.fillStyle    = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function separator(ctx, y, alpha = 0.5) {
  ctx.save();
  ctx.strokeStyle = hexToRgba(CYAN, alpha);
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(50, y);
  ctx.lineTo(W - 50, y);
  ctx.stroke();
  ctx.fillStyle = hexToRgba(CYAN, alpha + 0.2);
  ctx.beginPath();
  ctx.moveTo(W/2, y - 5);
  ctx.lineTo(W/2 + 5, y);
  ctx.lineTo(W/2, y + 5);
  ctx.lineTo(W/2 - 5, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r, fill, stroke, strokeW = 1) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  if (fill)   { ctx.fillStyle   = fill;   ctx.fill();   }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = strokeW; ctx.stroke(); }
}

function xpBar(ctx, x, y, w, h, pct) {
  roundRect(ctx, x, y, w, h, 4, "rgba(5,20,60,0.8)", hexToRgba(CYAN, 0.3));
  if (pct > 0) {
    const fillW = Math.max(8, Math.floor(w * pct));
    const grad  = ctx.createLinearGradient(x, y, x + fillW, y);
    grad.addColorStop(0,   "#0090FF");
    grad.addColorStop(0.6, "#00C8FF");
    grad.addColorStop(1,   "#80F0FF");
    roundRect(ctx, x + 1, y + 1, fillW - 2, h - 2, 3, grad, null);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    roundRect(ctx, x + 1, y + 1, fillW - 2, Math.floor(h * 0.4), 3, "rgba(255,255,255,0.15)", null);
  }
}

function circleAvatar(ctx, img, cx, cy, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

function xpForLevel(lvl) { return lvl * 100; }
function getLevelAndXP(totalXP) {
  let lvl = 1, xp = totalXP || 0;
  while (xp >= xpForLevel(lvl)) { xp -= xpForLevel(lvl); lvl++; if (lvl >= 100) break; }
  return { level: lvl, currentXP: xp, xpNeeded: xpForLevel(lvl) };
}

const TRAITS = {
  ironhide:   { name: "Iron Hide",     desc: "-18% incoming damage"           },
  shadowstep: { name: "Shadow Step",   desc: "+20% base dodge chance"         },
  berserker:  { name: "Berserker",     desc: "+12 flat attack damage"         },
  cursed:     { name: "Cursed Fist",   desc: "-10% opp. defense per hit"      },
  phoenix:    { name: "Phoenix Blood", desc: "Survive lethal blow (1HP, 1x)"  },
};
const SPECIAL_NAMES = {
  deathblow: "Deathblow",
  sonicfist: "SonicFist",
  shockwave: "Shockwave",
  blazekick: "BlazeKick",
};
const RANK_DATA = [
  { min: 500, rank: "Legendary",   color: "#D090FF" },
  { min: 300, rank: "Grandmaster", color: GOLD      },
  { min: 150, rank: "Master",      color: GOLD      },
  { min: 70,  rank: "Expert",      color: "#C8C8C8" },
  { min: 30,  rank: "Veteran",     color: "#C88050" },
  { min: 10,  rank: "Competitor",  color: GREEN     },
  { min: 0,   rank: "Novice",      color: CYAN      },
];

// ═══════════════════════════════════════════════════════════════
module.exports = {
  config: {
    name: "battlestats",
    aliases: ["bstats", "fstats", "fighterstats", "battleprofile"],
    version: "3.0",
    author: "Charles",
    countDown: 8,
    role: 0,
    shortDescription: { en: "🃏 View your fighter profile card" },
    category: "fun",
    guide: {
      en:
        "+battlestats           — Your fighter card\n" +
        "+battlestats @mention  — Another user's card",
    },
  },

  onStart: async function ({ api, event, message, usersData }) {
    const { threadID, messageID, senderID, mentions } = event;

    // ── Resolve target ──────────────────────────────────────
    let targetID = senderID;
    if (event.type === "message_reply") {
      targetID = event.messageReply.senderID;
    } else if (Object.keys(mentions || {}).length > 0) {
      targetID = Object.keys(mentions)[0];
    }

    // ── Instant loading reply ───────────────────────────────
    await api.sendMessage("⚔️ Loading your battle status...", threadID, messageID);

    const cachePath = path.join(__dirname, "cache", `bstats_${targetID}_${Date.now()}.png`);
    if (!fs.existsSync(path.join(__dirname, "cache")))
      fs.mkdirSync(path.join(__dirname, "cache"));

    try {
      // ── Fetch user data ─────────────────────────────────
      const userData = await usersData.get(targetID);
      const name     = await usersData.getName(targetID);
      const d        = userData.data || {};

      const { level, currentXP, xpNeeded } = getLevelAndXP(d.fightXP || 0);
      const wins         = d.fightWins         || 0;
      const losses       = d.fightLosses       || 0;
      const total        = wins + losses;
      const wr           = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";
      const rankScore    = level * 10 + wins;
      const rankInfo     = RANK_DATA.find(r => rankScore >= r.min) || RANK_DATA[RANK_DATA.length - 1];
      const atkBonus     = d.fightAtkBonus     || 0;
      const defBonus     = d.fightDefBonus     || 0;
      const agilityBonus = d.fightAgilityBonus || 0;
      const bonusHP      = d.fightBonusHP      || 0;
      const maxHP        = 100 + bonusHP;
      const abilities    = d.fightAbilities    || {};
      const skills       = d.fightSkills       || {};
      const traitKey     = d.fightTrait;
      const traitInfo    = TRAITS[traitKey] || null;
      const specials     = Object.keys(SPECIAL_NAMES).filter(s => skills[s] >= 1).map(s => SPECIAL_NAMES[s]);

      const trainedAt     = d.fightTrainedAt || 0;
      const sinceTraining = Date.now() - trainedAt;
      const cooldownMs    = 5 * 60 * 60 * 1000;
      const trainReady    = sinceTraining >= cooldownMs;
      const remainMs      = cooldownMs - sinceTraining;
      const hh = Math.floor(remainMs / 3600000);
      const mm = Math.floor((remainMs % 3600000) / 60000);

      // ── Load images ─────────────────────────────────────
      const [bgImg, avImg] = await Promise.all([
        loadImage(BG_URL),
        loadImage(AV_URL(targetID)).catch(() => null),
      ]);

      // ── Canvas setup ─────────────────────────────────────
      const canvas = createCanvas(W, H);
      const ctx    = canvas.getContext("2d");

      // Background
      ctx.drawImage(bgImg, 0, 0, W, H);

      // Dark vignette overlay
      const vignette = ctx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, H*0.85);
      vignette.addColorStop(0, "rgba(0,10,40,0.30)");
      vignette.addColorStop(1, "rgba(0,5,25,0.72)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, H);

      // ── Top deco lines (no title text, just decorative lines) ──
      ctx.fillStyle = hexToRgba(CYAN, 0.8);
      ctx.fillRect(35, 28, W - 70, 2);
      ctx.fillStyle = hexToRgba(CYAN, 0.35);
      ctx.fillRect(35, 34, W - 70, 1);

      // ── Avatar (moved up since title is gone) ─────────────
      const cx = W/2, cy = 160, cr = 75;

      // Glow rings
      for (let i = 16; i > 0; i -= 2) {
        ctx.beginPath();
        ctx.arc(cx, cy, cr + i, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(CYAN, 0.04 * i);
        ctx.lineWidth   = 3;
        ctx.stroke();
      }
      // Rim
      ctx.beginPath();
      ctx.arc(cx, cy, cr + 3, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(CYAN, 0.85);
      ctx.lineWidth   = 3;
      ctx.stroke();

      if (avImg) {
        circleAvatar(ctx, avImg, cx, cy, cr);
      } else {
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(8,45,120,0.9)";
        ctx.fill();
      }

      // ── Name — slightly larger than rank badge font ─────────
      // Rank badge uses ~22px bold, so name uses 28px bold
      const maxNameW  = W - 100;
      let nameSize    = 28;
      let displayName = name;
      ctx.font        = `bold ${nameSize}px DejaVu Sans`;

      // Shrink if needed (down to 22px min)
      while (ctx.measureText(displayName).width > maxNameW && nameSize > 22) {
        nameSize--;
        ctx.font = `bold ${nameSize}px DejaVu Sans`;
      }
      // Truncate with ellipsis if still too wide
      if (ctx.measureText(displayName).width > maxNameW) {
        while (ctx.measureText(displayName + "...").width > maxNameW && displayName.length > 1) {
          displayName = displayName.slice(0, -1);
        }
        displayName = displayName.trimEnd() + "...";
      }
      glowText(ctx, displayName, W/2, 262, `bold ${nameSize}px DejaVu Sans`, WHITE, hexToRgba(CYAN, 0.5), "center", 8);

      // Rank badge (font: bold 22px → name is 28px, visibly but subtly larger)
      const rankFont = "bold 22px DejaVu Sans";
      ctx.font       = rankFont;
      const rw = ctx.measureText(rankInfo.rank).width + 48;
      roundRect(ctx, W/2 - rw/2, 278, rw, 34, 8,
                "rgba(15,8,50,0.8)", hexToRgba(rankInfo.color, 0.7), 1);
      glowText(ctx, rankInfo.rank, W/2, 295, rankFont, rankInfo.color,
               hexToRgba(rankInfo.color, 0.6), "center", 6);

      separator(ctx, 325);

      // ── Level + XP ────────────────────────────────────────
      glowText(ctx, "LV", 62, 354, "20px DejaVu Sans", DIM, null, "left", 0);
      glowText(ctx, String(level), 100, 350, "bold 38px DejaVu Sans", CYAN, hexToRgba(CYAN, 0.6), "left", 8);

      const barX = 62, barY = 378, barW = W - 124, barH = 22;
      xpBar(ctx, barX, barY, barW, barH, currentXP / xpNeeded);
      glowText(ctx, `XP  ${currentXP} / ${xpNeeded}`, W/2, barY + barH/2,
               "13px DejaVu Sans", WHITE, null, "center", 0);

      separator(ctx, 414);

      // ── Wins / Losses / WR ────────────────────────────────
      const cw = (W - 80) / 3;
      const wlData = [
        { label: "WINS",     val: String(wins),   color: GREEN },
        { label: "LOSSES",   val: String(losses), color: RED   },
        { label: "WIN RATE", val: `${wr}%`,        color: CYAN  },
      ];
      wlData.forEach(({ label, val, color }, i) => {
        const cx_s = 40 + cw * i + cw / 2;
        glowText(ctx, label, cx_s, 432, "16px DejaVu Sans", DIM, null, "center", 0);
        glowText(ctx, val, cx_s, 469,   "bold 36px DejaVu Sans", color, hexToRgba(color, 0.55), "center", 8);
      });
      [40 + cw, 40 + cw * 2].forEach(dx => {
        ctx.strokeStyle = hexToRgba(CYAN, 0.2);
        ctx.lineWidth   = 1;
        ctx.beginPath(); ctx.moveTo(dx, 414); ctx.lineTo(dx, 497); ctx.stroke();
      });

      separator(ctx, 500);

      // ── Combat Stats (no emoji — plain text labels) ────────
      glowText(ctx, "COMBAT STATS", W/2, 520, "bold 22px DejaVu Sans", CYAN, hexToRgba(CYAN, 0.5), "center", 6);

      const statRows = [
        { label: "MAX HP",   val: `${maxHP} HP`,              color: "#FF6478" },
        { label: "ATTACK",   val: `+${atkBonus} DMG`,         color: YELLOW    },
        { label: "DEFENSE",  val: `${defBonus}% REDUCTION`,   color: CYAN      },
        { label: "AGILITY",  val: `+${agilityBonus}% DODGE`,  color: "#96FFA0" },
        { label: "HEAL",     val: abilities.heal ? "UNLOCKED" : "LOCKED",
                              color: abilities.heal ? GREEN : "#909090" },
      ];

      let rowY = 536;
      statRows.forEach(({ label, val, color }) => {
        roundRect(ctx, 46, rowY, W - 92, 36, 4, DARK_P, hexToRgba(CYAN, 0.08));
        glowText(ctx, label, 66, rowY + 18, "19px DejaVu Sans", DIM, null, "left", 0);
        glowText(ctx, val, W - 66, rowY + 18, "bold 19px DejaVu Sans", color,
                 hexToRgba(color, 0.4), "right", 4);
        rowY += 42;
      });

      separator(ctx, rowY + 6);

      // ── Inborn Trait ──────────────────────────────────────
      let traitY = rowY + 24;
      glowText(ctx, "INBORN TRAIT", W/2, traitY, "bold 22px DejaVu Sans", CYAN,
               hexToRgba(CYAN, 0.5), "center", 6);
      traitY += 18;

      if (traitInfo) {
        roundRect(ctx, 46, traitY, W - 92, 54, 6,
                  "rgba(20,8,60,0.85)", hexToRgba(PURPLE, 0.5));
        ctx.fillStyle = hexToRgba(PURPLE, 0.9);
        ctx.fillRect(46, traitY, 4, 54);
        glowText(ctx, traitInfo.name, W/2, traitY + 18,
                 "bold 21px DejaVu Sans", PURPLE, hexToRgba(PURPLE, 0.6), "center", 5);
        glowText(ctx, traitInfo.desc, W/2, traitY + 40,
                 "17px DejaVu Sans", DIM, null, "center", 0);
      } else {
        roundRect(ctx, 46, traitY, W - 92, 36, 6,
                  "rgba(15,15,25,0.7)", hexToRgba(DIM, 0.2));
        glowText(ctx, "None  —  Purchase via +fightupgrade", W/2, traitY + 18,
                 "16px DejaVu Sans", DIM, null, "center", 0);
      }

      separator(ctx, traitY + (traitInfo ? 68 : 50));

      // ── Special Moves ─────────────────────────────────────
      let specY = traitY + (traitInfo ? 86 : 68);
      glowText(ctx, "SPECIAL MOVES", W/2, specY, "bold 22px DejaVu Sans", CYAN,
               hexToRgba(CYAN, 0.5), "center", 6);
      specY += 18;

      if (specials.length > 0) {
        const pillW  = 158;
        const gap    = 14;
        const totalW = specials.length * pillW + (specials.length - 1) * gap;
        let sx       = (W - totalW) / 2;
        specials.slice(0, 4).forEach(sp => {
          roundRect(ctx, sx, specY, pillW, 38, 6,
                    "rgba(15,35,110,0.85)", hexToRgba(CYAN, 0.5));
          ctx.fillStyle = hexToRgba(CYAN, 0.8);
          ctx.fillRect(sx, specY, 3, 38);
          glowText(ctx, sp, sx + pillW/2, specY + 19,
                   "bold 17px DejaVu Sans", WHITE, hexToRgba(CYAN, 0.4), "center", 4);
          sx += pillW + gap;
        });
      } else {
        glowText(ctx, "None unlocked", W/2, specY + 19,
                 "17px DejaVu Sans", DIM, null, "center", 0);
      }

      separator(ctx, specY + 56);

      // ── Training Status ───────────────────────────────────
      const trainY  = specY + 74;
      const tColor  = trainReady ? GREEN : YELLOW;
      const tText   = trainReady ? "READY TO TRAIN" : `${hh}h ${mm}m remaining`;
      glowText(ctx, "TRAINING STATUS", W/2, trainY,
               "bold 20px DejaVu Sans", CYAN, hexToRgba(CYAN, 0.4), "center", 4);
      glowText(ctx, tText, W/2, trainY + 32,
               "bold 26px DejaVu Sans", tColor, hexToRgba(tColor, 0.6), "center", 8);

      // ── Bottom deco lines ─────────────────────────────────
      ctx.fillStyle = hexToRgba(CYAN, 0.8);
      ctx.fillRect(35, H - 58, W - 70, 2);
      ctx.fillStyle = hexToRgba(CYAN, 0.35);
      ctx.fillRect(35, H - 50, W - 70, 1);
      glowText(ctx, "FIGHTER CARD", W/2, H - 28,
               "18px DejaVu Sans", hexToRgba(CYAN, 0.7), CYAN, "center", 4);

      // ── Save & send ───────────────────────────────────────
      fs.writeFileSync(cachePath, canvas.toBuffer());

      return api.sendMessage(
        { body: "", attachment: fs.createReadStream(cachePath) },
        threadID,
        () => { try { fs.unlinkSync(cachePath); } catch (_) {} },
        messageID
      );

    } catch (err) {
      console.error("[battlestats]", err);

      // ── Text fallback ─────────────────────────────────────
      const userData = await usersData.get(targetID).catch(() => ({ data: {} }));
      const name     = await usersData.getName(targetID).catch(() => "Fighter");
      const d        = userData.data || {};
      const { level, currentXP, xpNeeded } = getLevelAndXP(d.fightXP || 0);
      const wins   = d.fightWins   || 0;
      const losses = d.fightLosses || 0;
      const wr     = (wins + losses) ? ((wins / (wins+losses)) * 100).toFixed(1) : "0.0";
      const rankScore = level * 10 + wins;
      const rankInfo  = RANK_DATA.find(r => rankScore >= r.min) || RANK_DATA[RANK_DATA.length - 1];
      const xpBarStr  = "█".repeat(Math.min(10, Math.round((currentXP / xpNeeded) * 10))) +
                        "░".repeat(Math.max(0, 10 - Math.round((currentXP / xpNeeded) * 10)));

      return api.sendMessage(
        `⚔️ BATTLE PROFILE\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Fighter: ${name}  |  ${rankInfo.rank}\n` +
        `Lv.${level}  [${xpBarStr}] ${currentXP}/${xpNeeded} XP\n` +
        `Wins: ${wins}  Losses: ${losses}  WR: ${wr}%\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `HP: ${100+(d.fightBonusHP||0)}  ATK: +${d.fightAtkBonus||0}  DEF: ${d.fightDefBonus||0}%  AGI: +${d.fightAgilityBonus||0}%`,
        threadID, messageID
      );

      try { if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath); } catch (_) {}
    }
  },
};
