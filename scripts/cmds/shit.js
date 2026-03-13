const { GoatWrapper } = require("fca-saim-x69x");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");

// ── Base meme image ───────────────────────────────────────────────────────────
const MEME_URL = "https://i.postimg.cc/wjrkbP28/file-000000005c8471fb825969e4d0bccab1.png";

// ── Coordinates as RATIOS of image width/height (0.0 – 1.0) ──────────────────
// Works regardless of what resolution postimg serves.
//
// Measured from screenshot (~541×730px):
//
// TOP PANEL (y: 0 → ~50% of image):
//   Skull face center ≈ pixel (275, 155)
//   → ratioX = 275/541 = 0.508,  ratioY = 155/730 = 0.212
//   pfp diameter ≈ 90px → sizeRatio = 90/541 = 0.166
//
// BOTTOM PANEL (y: ~50% → 100%):
//   Inner oval of shoe sole center ≈ pixel (225, 575)
//   → ratioX = 225/541 = 0.416,  ratioY = 575/730 = 0.787
//   pfp diameter ≈ 120px → sizeRatio = 120/541 = 0.222

const FACE = { rx: 0.508, ry: 0.212, rs: 0.166 };
const SHOE = { rx: 0.416, ry: 0.787, rs: 0.222 };

async function getProfilePicBuffer(uid) {
  // Same method as pair.js — works reliably for high-res pfps
  const url = `https://graph.facebook.com/${uid}/picture?width=720&height=720&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 10000,
    maxRedirects: 10,
  });
  return Buffer.from(res.data);
}

// Draw pfp as circle. cx/cy = CENTER of circle, size = diameter.
function drawCircularPfp(ctx, img, cx, cy, size) {
  const r = size / 2;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, cx - r, cy - r, size, size);
  ctx.restore();
}

module.exports = {
  config: {
    name: "shit",
    aliases: ["steppedIn"],
    version: "1.1",
    author: "CharlesMK",
    countDown: 5,
    role: 0,
    category: "fun",
    description: "💩 Ew, I stepped in shit! Your pfp on the face, tagged person's pfp on the shoe sole.",
    usage: "shit @mention | shit (reply to msg) | shit <uid>"
  },

  onStart: async function ({ event, api, args, message }) {
    const senderID = event.senderID;

    // ── Resolve target UID ────────────────────────────────────────────────────
    let targetID = null;
    let targetName = null;

    if (event.messageReply) {
      targetID = event.messageReply.senderID;
    } else if (event.mentions && Object.keys(event.mentions).length > 0) {
      targetID = Object.keys(event.mentions)[0];
      targetName = Object.values(event.mentions)[0];
    } else if (args[0] && /^\d+$/.test(args[0])) {
      targetID = args[0];
    }

    if (!targetID) {
      return message.reply(
        `❌ 𝐍𝐎 𝐓𝐀𝐑𝐆𝐄𝐓 𝐅𝐎𝐔𝐍𝐃\n` +
        `Tag someone, reply to their message, or pass a UID.\n\n` +
        `Usage: +shit @mention`
      );
    }

    if (targetID === senderID) {
      return message.reply(`😂 𝐘𝐎𝐔 𝐒𝐓𝐄𝐏𝐏𝐄𝐃 𝐈𝐍 𝐘𝐎𝐔𝐑𝐒𝐄𝐋𝐅\nBro really stepped in his own shit 💀`);
    }


    try {
      // Fetch all in parallel
      const [memeRes, senderBuf, targetBuf] = await Promise.all([
        axios.get(MEME_URL, { responseType: "arraybuffer", timeout: 12000 }),
        getProfilePicBuffer(senderID),
        getProfilePicBuffer(targetID),
      ]);

      const memeImg   = await loadImage(Buffer.from(memeRes.data));
      const senderImg = await loadImage(senderBuf);
      const targetImg = await loadImage(targetBuf);

      const W = memeImg.width;
      const H = memeImg.height;
      console.log(`[shit.js] Image: ${W}x${H}`);

      // Convert ratios to pixel coords
      const faceCX   = Math.round(W * FACE.rx);
      const faceCY   = Math.round(H * FACE.ry);
      const faceSize = Math.round(W * FACE.rs);

      const shoeCX   = Math.round(W * SHOE.rx);
      const shoeCY   = Math.round(H * SHOE.ry);
      const shoeSize = Math.round(W * SHOE.rs);

      console.log(`[shit.js] Face → center(${faceCX},${faceCY}) size=${faceSize}`);
      console.log(`[shit.js] Shoe → center(${shoeCX},${shoeCY}) size=${shoeSize}`);

      // Composite
      const canvas = createCanvas(W, H);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(memeImg, 0, 0);
      drawCircularPfp(ctx, senderImg, faceCX, faceCY, faceSize);
      drawCircularPfp(ctx, targetImg, shoeCX, shoeCY, shoeSize);

      // Save & send
      const outPath = path.join(__dirname, `shit_${Date.now()}.png`);
      fs.writeFileSync(outPath, canvas.toBuffer("image/png"));


      const victim = targetName || targetID;
      await api.sendMessage(
        {
          body: "",
          attachment: fs.createReadStream(outPath),
        },
        event.threadID,
        () => fs.unlink(outPath, () => {})
      );

    } catch (err) {
      console.error("[shit.js] Error:", err.message);
      await message.reply(`❌ 𝐅𝐀𝐈𝐋𝐄𝐃 𝐓𝐎 𝐆𝐄𝐍𝐄𝐑𝐀𝐓𝐄\nError: ${err.message}`);
    }
  }
};

const wrapper = new GoatWrapper(module.exports);
wrapper.applyNoPrefix({ allowPrefix: true });
