const { createCanvas, loadImage } = require("canvas");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const slotUsage = new Map();

// Fruit symbols — filenames in slotpic/ folder
const SYMBOLS = [
  { name: "apple",    file: "apple.png"   },
  { name: "pear",     file: "pear.png"    },
  { name: "bananas",  file: "bananas.png" },
  { name: "grapes",   file: "grapes.png"  },
  { name: "diamond",  file: "diamond.png" },
  { name: "seven",    file: "seven.png"   },
];


module.exports = {
  config: {
    name: "slot2",
    aliases: ["slots2"],
    version: "3.1",
    author: "CharlesMK",
    countDown: 30,
    role: 0,
    description: {
      en: "Spin the slot machine and win money! (10 spins per hour)"
    },
    category: "game",
    guide: {
      en: "{pn} <amount>\nExample: {pn} 50\n\n⏰ Limit: 10 spins per hour\n💵 Max bet: $5,000,000"
    }
  },

  onStart: async function ({ args, message, event, usersData, api }) {
    const { senderID } = event;

    // ── helpers ──────────────────────────────────────────────────────────────

    function formatBalance(num) {
      const abs = Math.abs(num);
      const sign = num < 0 ? "-" : "";
      const tiers = [
        [1e24, "septillion"], [1e21, "sextillion"], [1e18, "quintillion"],
        [1e15, "quadrillion"], [1e12, "trillion"], [1e9, "billion"], [1e6, "M"],
      ];
      for (const [val, suffix] of tiers) {
        if (abs >= val) {
          const divided = abs / val;
          const formatted = Number.isInteger(divided)
            ? divided.toString()
            : parseFloat(divided.toFixed(2)).toString();
          return `${sign}$${formatted}${suffix.length <= 2 ? "" : " "}${suffix}`;
        }
      }
      return `${sign}$${abs.toLocaleString()}`;
    }

    // Load a PNG from the slotpic folder (or a URL) into a canvas Image
    async function loadSymbolImage(filename) {
      const filePath = path.join(__dirname, "slotpic", filename);
      return await loadImage(filePath);
    }

    // Draw one frame of the slot machine
    // reels: array of 3 symbol objects (or null = blank during spin)
    // status: { type: "spinning"|"win"|"jackpot"|"loss", reward, newBalance, bet, playerName }
    async function drawSlotImage(reels, status) {
      const W = 800, H = 480;
      const canvas = createCanvas(W, H);
      const ctx = canvas.getContext("2d");

      // ── background (deep navy/purple) ──
      const bgGrad = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * 0.75);
      bgGrad.addColorStop(0, "#1a1235");
      bgGrad.addColorStop(1, "#0d0b1e");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // ── stars ──
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      const starSeed = [
        [60,40],[150,90],[280,30],[400,70],[530,20],[670,55],[750,35],
        [100,160],[350,130],[600,110],[720,170],[40,300],[180,340],
        [320,380],[480,420],[650,390],[760,310],[90,430],[230,460],
        [560,450],[700,440],[30,200],[420,240],[580,270],[760,220],
      ];
      for (const [sx, sy] of starSeed) {
        const r = 1 + Math.random() * 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── title — "MK SLOTS" 3D shadow + neon gold glow ──
      ctx.save();
      ctx.textAlign = "center";
      ctx.font = "bold 54px Arial";

      const depthColor = "#7a5500";
      for (let d = 6; d >= 1; d--) {
        ctx.globalAlpha = 0.55;
        ctx.shadowBlur = 0;
        ctx.fillStyle = depthColor;
        ctx.fillText("MK SLOTS", W / 2 + d, 68 + d);
      }

      ctx.globalAlpha = 0.35;
      ctx.shadowColor = "#000000";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 6;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = "#000000";
      ctx.fillText("MK SLOTS", W / 2, 68);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      ctx.globalAlpha = 0.3;
      ctx.shadowColor = "#ffd700";
      ctx.shadowBlur = 40;
      ctx.fillStyle = "#ffd700";
      ctx.fillText("MK SLOTS", W / 2, 68);

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#ffd700";
      ctx.fillStyle = "#fffbe0";
      ctx.fillText("MK SLOTS", W / 2, 68);
      ctx.restore();

      // ── reel panel ──
      const panelX = 80, panelY = 90, panelW = 640, panelH = 220;
      const radius = 24;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(panelX + radius, panelY);
      ctx.lineTo(panelX + panelW - radius, panelY);
      ctx.quadraticCurveTo(panelX + panelW, panelY, panelX + panelW, panelY + radius);
      ctx.lineTo(panelX + panelW, panelY + panelH - radius);
      ctx.quadraticCurveTo(panelX + panelW, panelY + panelH, panelX + panelW - radius, panelY + panelH);
      ctx.lineTo(panelX + radius, panelY + panelH);
      ctx.quadraticCurveTo(panelX, panelY + panelH, panelX, panelY + panelH - radius);
      ctx.lineTo(panelX, panelY + radius);
      ctx.quadraticCurveTo(panelX, panelY, panelX + radius, panelY);
      ctx.closePath();
      ctx.fillStyle = "rgba(40, 32, 80, 0.92)";
      ctx.fill();

      ctx.strokeStyle = "#5af";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#5af";
      ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = "rgba(120,160,255,0.35)";
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 0;
      const cellW = panelW / 3;
      for (let i = 1; i < 3; i++) {
        const x = panelX + cellW * i;
        ctx.beginPath();
        ctx.moveTo(x, panelY + 10);
        ctx.lineTo(x, panelY + panelH - 10);
        ctx.stroke();
      }
      ctx.restore();

      // ── reel symbols ──
      for (let i = 0; i < 3; i++) {
        const sym = reels[i];
        const cellCx = panelX + cellW * i + cellW / 2;
        const cellCy = panelY + panelH / 2;
        if (!sym) {
          ctx.save();
          ctx.font = "bold 72px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "rgba(150,150,200,0.4)";
          ctx.fillText("?", cellCx, cellCy);
          ctx.restore();
        } else {
          try {
            const img = await loadSymbolImage(sym.file);
            const imgSize = 130;
            ctx.drawImage(img, cellCx - imgSize / 2, cellCy - imgSize / 2, imgSize, imgSize);
          } catch {
            ctx.save();
            ctx.font = "bold 72px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#fff";
            ctx.fillText(sym.name[0].toUpperCase(), cellCx, cellCy);
            ctx.restore();
          }
        }
      }

      function drawGlowText(text, x, y, font, glowColor, align) {
        ctx.save();
        ctx.font = font;
        ctx.textAlign = align || "left";
        ctx.textBaseline = "alphabetic";
        ctx.globalAlpha = 0.2;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 28;
        ctx.fillStyle = "#ffffff";
        ctx.fillText(text, x, y);
        ctx.globalAlpha = 0.55;
        ctx.shadowBlur = 14;
        ctx.fillText(text, x, y);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 7;
        ctx.fillText(text, x, y);
        ctx.restore();
      }

      function draw3DWhiteText(text, x, y, font, align) {
        ctx.save();
        ctx.font = font;
        ctx.textAlign = align || "left";
        ctx.textBaseline = "alphabetic";
        for (let d = 4; d >= 1; d--) {
          ctx.globalAlpha = 0.5;
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#222244";
          const ox = align === "right" ? -d : d;
          ctx.fillText(text, x + ox, y + d);
        }
        ctx.globalAlpha = 0.3;
        ctx.shadowColor = "#000000";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = align === "right" ? -4 : 4;
        ctx.shadowOffsetY = 5;
        ctx.fillStyle = "#000000";
        ctx.fillText(text, x, y);
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.globalAlpha = 0.25;
        ctx.shadowColor = "#aaddff";
        ctx.shadowBlur = 22;
        ctx.fillStyle = "#ffffff";
        ctx.fillText(text, x, y);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 8;
        ctx.shadowColor = "#aaddff";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(text, x, y);
        ctx.restore();
      }

      draw3DWhiteText(`PLAYER: ${status.playerName.toUpperCase()}`, panelX, panelY + panelH + 36, "bold 22px Arial", "left");
      draw3DWhiteText(`BET: ${formatBalance(status.bet)}`, panelX + panelW, panelY + panelH + 36, "bold 22px Arial", "right");

      // ── result banner ──
      const bannerY = panelY + panelH + 56;
      const bannerW = panelW;
      const bannerH = 80;
      const bannerX = panelX;
      const br = 18;

      let bannerColor, bannerBorder, bannerGlow, line1, line2;

      if (status.type === "spinning") {
        bannerColor = "rgba(30,30,80,0.85)";
        bannerBorder = "#5af";
        bannerGlow = "#5af";
        line1 = "🎰  SPINNING...";
        line2 = "";
      } else if (status.type === "jackpot") {
        bannerColor = "rgba(40,10,90,0.95)";
        bannerBorder = "#bf5fff";
        bannerGlow = "#bf5fff";
        line1 = `🎉  JACKPOT!  WIN +${formatBalance(status.reward)}`;
        line2 = `NEW BALANCE: ${formatBalance(status.newBalance)}`;
      } else if (status.type === "win") {
        bannerColor = "rgba(10,20,80,0.95)";
        bannerBorder = "#5af";
        bannerGlow = "#5af";
        line1 = `✨  WIN +${formatBalance(status.reward)}`;
        line2 = `NEW BALANCE: ${formatBalance(status.newBalance)}`;
      } else {
        bannerColor = "rgba(20,10,70,0.95)";
        bannerBorder = "#7055ee";
        bannerGlow = "#7055ee";
        line1 = `💸  YOU LOST  -${formatBalance(status.bet)}`;
        line2 = `NEW BALANCE: ${formatBalance(status.newBalance)}`;
      }

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(bannerX + br, bannerY);
      ctx.lineTo(bannerX + bannerW - br, bannerY);
      ctx.quadraticCurveTo(bannerX + bannerW, bannerY, bannerX + bannerW, bannerY + br);
      ctx.lineTo(bannerX + bannerW, bannerY + bannerH - br);
      ctx.quadraticCurveTo(bannerX + bannerW, bannerY + bannerH, bannerX + bannerW - br, bannerY + bannerH);
      ctx.lineTo(bannerX + br, bannerY + bannerH);
      ctx.quadraticCurveTo(bannerX, bannerY + bannerH, bannerX, bannerY + bannerH - br);
      ctx.lineTo(bannerX, bannerY + br);
      ctx.quadraticCurveTo(bannerX, bannerY, bannerX + br, bannerY);
      ctx.closePath();
      ctx.fillStyle = bannerColor;
      ctx.fill();
      ctx.strokeStyle = bannerBorder;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = bannerGlow;
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.restore();

      if (line2) {
        drawGlowText(line1, bannerX + bannerW / 2, bannerY + 32, "bold 22px Arial", bannerGlow, "center");
        drawGlowText(line2, bannerX + bannerW / 2, bannerY + 58, "bold 17px Arial", bannerGlow, "center");
      } else {
        drawGlowText(line1, bannerX + bannerW / 2, bannerY + bannerH / 2 + 10, "bold 22px Arial", bannerGlow, "center");
      }

      const neonOverlay = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, W * 0.78);
      neonOverlay.addColorStop(0, "rgba(0,0,0,0)");
      neonOverlay.addColorStop(0.7, "rgba(20,10,60,0.0)");
      neonOverlay.addColorStop(1, "rgba(30,80,180,0.22)");
      ctx.fillStyle = neonOverlay;
      ctx.fillRect(0, 0, W, H);

      const topGlow = ctx.createLinearGradient(0, 0, 0, 12);
      topGlow.addColorStop(0, "rgba(80,180,255,0.35)");
      topGlow.addColorStop(1, "rgba(80,180,255,0)");
      ctx.fillStyle = topGlow;
      ctx.fillRect(0, 0, W, 12);

      const botGlow = ctx.createLinearGradient(0, H - 12, 0, H);
      botGlow.addColorStop(0, "rgba(80,180,255,0)");
      botGlow.addColorStop(1, "rgba(80,180,255,0.35)");
      ctx.fillStyle = botGlow;
      ctx.fillRect(0, H - 12, W, 12);

      return canvas.toBuffer("image/png");
    }

    // ── status command ────────────────────────────────────────────────────────

    if (args[0] && args[0].toLowerCase() === "status") {
      const usage = slotUsage.get(senderID);
      if (!usage || usage.spins < 10) {
        const spinsLeft = usage ? 10 - usage.spins : 10;
        return message.reply(
          `🎰 SLOT STATUS\n\n🎮 Spins remaining: ${spinsLeft}/10\n✅ Ready to play!`
        );
      }
      const now = Date.now();
      const timeLeft = usage.resetTime - now;
      if (timeLeft <= 0) {
        slotUsage.delete(senderID);
        return message.reply(`🎰 SLOT STATUS\n\n🎮 Spins remaining: 10/10\n✅ Your spins have been reset!`);
      }
      const minutes = Math.floor(timeLeft / 60000);
      const seconds = Math.floor((timeLeft % 60000) / 1000);
      return message.reply(
        `🎰 SLOT STATUS\n\n🎮 Spins used: 10/10\n⏰ Cooldown: ${minutes}m ${seconds}s\n\nCome back later to spin again!`
      );
    }

    // ── validate bet ──────────────────────────────────────────────────────────

    const spinAmount = parseInt(args[0]);
    if (!spinAmount || spinAmount <= 0) {
      return message.reply("❌ Please enter a valid amount.\nExample: +slot 50\n\nCheck status: +slot status");
    }

    // ── spin limit ────────────────────────────────────────────────────────────

    const now = Date.now();
    let usage = slotUsage.get(senderID);
    if (usage && now >= usage.resetTime) { slotUsage.delete(senderID); usage = null; }
    if (!usage) {
      usage = { spins: 0, resetTime: now + 3600000 };
      slotUsage.set(senderID, usage);
    }
    if (usage.spins >= 10) {
      const timeLeft = usage.resetTime - now;
      const minutes = Math.floor(timeLeft / 60000);
      const seconds = Math.floor((timeLeft % 60000) / 1000);
      return message.reply(
        `⏰ SLOT COOLDOWN\n\nYou've used all 10 spins! 🎰\n\n⏳ Time remaining: ${minutes}m ${seconds}s\n\nCome back later!\nCheck status: +slot status`
      );
    }

    // ── balance check ─────────────────────────────────────────────────────────

    const userData = await usersData.get(senderID);
    const balance = userData.money || 0;

    // Wallet cap — must bank excess before playing
    if (balance > 500000000) {
      return message.reply(
        `🏦 𝗪𝗔𝗟𝗟𝗘𝗧 𝗢𝗩𝗘𝗥𝗟𝗢𝗔𝗗!\n\n` +
        `💰 Your wallet: ${formatBalance(balance)}\n\n` +
        `You're carrying too much cash to play! Deposit your money in the bank and keep your wallet under $500,000,000 before spinning.\n\n` +
        `🏧 Use +bank deposit <amount> to store your excess funds.`
      );
    }

    // Bet limit — max $5,000,000 per spin
    if (spinAmount > 5000000) {
      return message.reply(
        `🚫 𝗕𝗘𝗧 𝗟𝗜𝗠𝗜𝗧 𝗘𝗫𝗖𝗘𝗘𝗗𝗘𝗗\n\n` +
        `Maximum bet per spin is $5,000,000.\n` +
        `💡 Use +bank to grow your money safely instead.`
      );
    }

    if (spinAmount > balance) {
      return message.reply(`❌ Insufficient funds.\n💰 Your balance: ${formatBalance(balance)}`);
    }

    // ── get player name ───────────────────────────────────────────────────────

    let playerName = "PLAYER";
    try {
      const info = await new Promise((resolve, reject) => {
        api.getUserInfo(senderID, (err, ret) => err ? reject(err) : resolve(ret));
      });
      if (info && info[senderID]) {
        playerName = info[senderID].name || "PLAYER";
      }
    } catch {}

    // ── spin reels ────────────────────────────────────────────────────────────

    const spin = () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    const reel1 = spin();
    const reel2 = spin();
    const reel3 = spin();

    let reward = 0;
    let resultType = "loss";

    const allSame = reel1.name === reel2.name && reel2.name === reel3.name;
    const twoSame =
      !allSame && (
        reel1.name === reel2.name ||
        reel2.name === reel3.name ||
        reel1.name === reel3.name
      );

    if (allSame) {
      resultType = "jackpot";
      reward = spinAmount * 6;
    } else if (twoSame) {
      const multiplier = (reel1.name === reel3.name) ? 3 : 2;
      resultType = "win";
      reward = spinAmount * multiplier;
    } else {
      resultType = "loss";
      reward = -spinAmount;
    }

    const newBalance = balance + reward;

    // ── update usage + money ──────────────────────────────────────────────────

    usage.spins += 1;
    slotUsage.set(senderID, usage);

    await usersData.set(senderID, {
      ...userData,
      money: newBalance,
    });

    // ── send spinning text immediately, draw image in parallel ───────────────

    const tmpDir = path.join(__dirname, "tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const statusBase = {
      playerName,
      bet: spinAmount,
      reward: Math.abs(reward),
      newBalance,
    };

    const spinsLeft = 10 - usage.spins;
    const spinInfo = spinsLeft > 0
      ? `🎮 𝗦𝗽𝗶𝗻𝘀: ${spinsLeft}/10`
      : `⏰ No spins left! Cooldown: 1 hour`;

    let resultLine;
    if (resultType === "jackpot") {
      resultLine = `🎉 𝙅𝘼𝘾𝙆𝙋𝙊𝙏! +${formatBalance(reward)}`;
    } else if (resultType === "win") {
      resultLine = `✨ 𝙔𝙊𝙐 𝙒𝙊𝙉! +${formatBalance(reward)}`;
    } else {
      resultLine = `💸 𝙔𝙊𝙐 𝙇𝙊𝙎𝙏 -${formatBalance(spinAmount)}`;
    }

    const spinFrames = [
      `🎰 𝘽𝙚𝙜𝙞𝙣𝙨 𝙨𝙥𝙞𝙣𝙣𝙞𝙣𝙜...`,
      `🎰 𝘽𝙚𝙜𝙞𝙣𝙨 𝙨𝙥𝙞𝙣𝙣𝙞𝙣𝙜...\n\n🎲 𝙏𝙝𝙚 𝙧𝙚𝙚𝙡𝙨 𝙖𝙧𝙚 𝙩𝙪𝙧𝙣𝙞𝙣𝙜...`,
      `🎰 𝘽𝙚𝙜𝙞𝙣𝙨 𝙨𝙥𝙞𝙣𝙣𝙞𝙣𝙜...\n\n🎲 𝙏𝙝𝙚 𝙧𝙚𝙚𝙡𝙨 𝙖𝙧𝙚 𝙩𝙪𝙧𝙣𝙞𝙣𝙜...\n🌀 𝙎𝙥𝙞𝙣𝙣𝙞𝙣𝙜 𝙛𝙖𝙨𝙩...`,
      `🎰 𝘽𝙚𝙜𝙞𝙣𝙨 𝙨𝙥𝙞𝙣𝙣𝙞𝙣𝙜...\n\n🎲 𝙏𝙝𝙚 𝙧𝙚𝙚𝙡𝙨 𝙖𝙧𝙚 𝙩𝙪𝙧𝙣𝙞𝙣𝙜...\n🌀 𝙎𝙥𝙞𝙣𝙣𝙞𝙣𝙜 𝙛𝙖𝙨𝙩...\n✨ 𝘼𝙡𝙢𝙤𝙨𝙩 𝙩𝙝𝙚𝙧𝙚...`,
      `🎰 𝘽𝙚𝙜𝙞𝙣𝙨 𝙨𝙥𝙞𝙣𝙣𝙞𝙣𝙜...\n\n🎲 𝙏𝙝𝙚 𝙧𝙚𝙚𝙡𝙨 𝙖𝙧𝙚 𝙩𝙪𝙧𝙣𝙞𝙣𝙜...\n🌀 𝙎𝙥𝙞𝙣𝙣𝙞𝙣𝙜 𝙛𝙖𝙨𝙩...\n✨ 𝘼𝙡𝙢𝙤𝙨𝙩 𝙩𝙝𝙚𝙧𝙚...\n🎯 𝙍𝙚𝙚𝙡𝙨 𝙨𝙡𝙤𝙬𝙞𝙣𝙜 𝙙𝙤𝙬𝙣...`,
      `🎰 𝘽𝙚𝙜𝙞𝙣𝙨 𝙨𝙥𝙞𝙣𝙣𝙞𝙣𝙜...\n\n🎲 𝙏𝙝𝙚 𝙧𝙚𝙚𝙡𝙨 𝙖𝙧𝙚 𝙩𝙪𝙧𝙣𝙞𝙣𝙜...\n🌀 𝙎𝙥𝙞𝙣𝙣𝙞𝙣𝙜 𝙛𝙖𝙨𝙩...\n✨ 𝘼𝙡𝙢𝙤𝙨𝙩 𝙩𝙝𝙚𝙧𝙚...\n🎯 𝙍𝙚𝙚𝙡𝙨 𝙨𝙡𝙤𝙬𝙞𝙣𝙜 𝙙𝙤𝙬𝙣...\n🔒 𝙎𝙩𝙤𝙥𝙥𝙞𝙣𝙜!`,
      `🎰 𝘽𝙚𝙜𝙞𝙣𝙨 𝙨𝙥𝙞𝙣𝙣𝙞𝙣𝙜...\n\n🎲 𝙏𝙝𝙚 𝙧𝙚𝙚𝙡𝙨 𝙖𝙧𝙚 𝙩𝙪𝙧𝙣𝙞𝙣𝙜...\n🌀 𝙎𝙥𝙞𝙣𝙣𝙞𝙣𝙜 𝙛𝙖𝙨𝙩...\n✨ 𝘼𝙡𝙢𝙤𝙨𝙩 𝙩𝙝𝙚𝙧𝙚...\n🎯 𝙍𝙚𝙚𝙡𝙨 𝙨𝙡𝙤𝙬𝙞𝙣𝙜 𝙙𝙤𝙬𝙣...\n🔒 𝙎𝙩𝙤𝙥𝙥𝙞𝙣𝙜!\n⏳ 𝙒𝙖𝙞𝙩𝙞𝙣𝙜 𝙛𝙤𝙧 𝙧𝙚𝙨𝙪𝙡𝙩...`,
      `🎰 𝘽𝙚𝙜𝙞𝙣𝙨 𝙨𝙥𝙞𝙣𝙣𝙞𝙣𝙜...\n\n🎲 𝙏𝙝𝙚 𝙧𝙚𝙚𝙡𝙨 𝙖𝙧𝙚 𝙩𝙪𝙧𝙣𝙞𝙣𝙜...\n🌀 𝙎𝙥𝙞𝙣𝙣𝙞𝙣𝙜 𝙛𝙖𝙨𝙩...\n✨ 𝘼𝙡𝙢𝙤𝙨𝙩 𝙩𝙝𝙚𝙧𝙚...\n🎯 𝙍𝙚𝙚𝙡𝙨 𝙨𝙡𝙤𝙬𝙞𝙣𝙜 𝙙𝙤𝙬𝙣...\n🔒 𝙎𝙩𝙤𝙥𝙥𝙞𝙣𝙜!\n⏳ 𝙒𝙖𝙞𝙩𝙞𝙣𝙜 𝙛𝙤𝙧 𝙧𝙚𝙨𝙪𝙡𝙩...\n🎴 𝙍𝙚𝙫𝙚𝙖𝙡𝙞𝙣𝙜 𝙨𝙤𝙤𝙣...`,
    ];

    const loopFrames = [
      `🎰 𝘽𝙚𝙜𝙞𝙣𝙨 𝙨𝙥𝙞𝙣𝙣𝙞𝙣𝙜...\n\n🎲 𝙏𝙝𝙚 𝙧𝙚𝙚𝙡𝙨 𝙖𝙧𝙚 𝙩𝙪𝙧𝙣𝙞𝙣𝙜...\n🌀 𝙎𝙥𝙞𝙣𝙣𝙞𝙣𝙜 𝙛𝙖𝙨𝙩...\n✨ 𝘼𝙡𝙢𝙤𝙨𝙩 𝙩𝙝𝙚𝙧𝙚...\n🎯 𝙍𝙚𝙚𝙡𝙨 𝙨𝙡𝙤𝙬𝙞𝙣𝙜 𝙙𝙤𝙬𝙣...\n🔒 𝙎𝙩𝙤𝙥𝙥𝙞𝙣𝙜!\n⏳ 𝙒𝙖𝙞𝙩𝙞𝙣𝙜 𝙛𝙤𝙧 𝙧𝙚𝙨𝙪𝙡𝙩...\n🎴 𝙍𝙚𝙫𝙚𝙖𝙡𝙞𝙣𝙜 𝙨𝙤𝙤𝙣...\n🎰 𝙃𝙤𝙡𝙙 𝙤𝙣...`,
      `🎰 𝘽𝙚𝙜𝙞𝙣𝙨 𝙨𝙥𝙞𝙣𝙣𝙞𝙣𝙜...\n\n🎲 𝙏𝙝𝙚 𝙧𝙚𝙚𝙡𝙨 𝙖𝙧𝙚 𝙩𝙪𝙧𝙣𝙞𝙣𝙜...\n🌀 𝙎𝙥𝙞𝙣𝙣𝙞𝙣𝙜 𝙛𝙖𝙨𝙩...\n✨ 𝘼𝙡𝙢𝙤𝙨𝙩 𝙩𝙝𝙚𝙧𝙚...\n🎯 𝙍𝙚𝙚𝙡𝙨 𝙨𝙡𝙤𝙬𝙞𝙣𝙜 𝙙𝙤𝙬𝙣...\n🔒 𝙎𝙩𝙤𝙥𝙥𝙞𝙣𝙜!\n⏳ 𝙒𝙖𝙞𝙩𝙞𝙣𝙜 𝙛𝙤𝙧 𝙧𝙚𝙨𝙪𝙡𝙩...\n🎴 𝙍𝙚𝙫𝙚𝙖𝙡𝙞𝙣𝙜 𝙨𝙤𝙤𝙣...\n🎰 𝙃𝙤𝙡𝙙 𝙤𝙣...\n⚡ 𝘼𝙡𝙢𝙤𝙨𝙩 𝙧𝙚𝙖𝙙𝙮...`,
    ];

    const spinMsg = await message.reply(spinFrames[0]);
    const frameDelay = ms => new Promise(r => setTimeout(r, ms));

    let imageReady = false;
    let tmpResultPath = null;
    const imagePromise = (async () => {
      const tmpResult = path.join(tmpDir, `slot_result_${senderID}_${Date.now()}.png`);
      const resultBuf = await drawSlotImage([reel1, reel2, reel3], { ...statusBase, type: resultType });
      fs.writeFileSync(tmpResult, resultBuf);
      tmpResultPath = tmpResult;
      imageReady = true;
    })();

    for (let i = 1; i < spinFrames.length; i++) {
      if (imageReady) break;
      await frameDelay(400);
      try { await api.editMessage(spinFrames[i], spinMsg.messageID); } catch {}
    }

    let loopIdx = 0;
    while (!imageReady) {
      await frameDelay(500);
      if (imageReady) break;
      try { await api.editMessage(loopFrames[loopIdx % loopFrames.length], spinMsg.messageID); } catch {}
      loopIdx++;
    }

    await imagePromise;
    const tmpResult = tmpResultPath;

    try { await api.unsendMessage(spinMsg.messageID); } catch {}

    await message.reply({
      body: `${resultLine}\n💰 𝗕𝗔𝗟𝗔𝗡𝗖𝗘: ${formatBalance(newBalance)}\n${spinInfo}`,
      attachment: fs.createReadStream(tmpResult),
    });

    try { fs.unlinkSync(tmpResult); } catch {}
  }
};
