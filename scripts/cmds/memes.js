const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const MAX_MEMES = 10;

module.exports = {
  config: {
    name: "meme",
    version: "1.1",
    author: "Charles MK",
    countDown: 5,
    role: 0,
    description: "Fetch random memes from Reddit",
    category: "fun",
    guide: {
      en: "{pn} random — 1 random meme\n" +
          "{pn} random <count> — up to 10 memes\n" +
          "{pn} <subreddit> — meme from specific subreddit\n" +
          "{pn} <subreddit> <count> — multiple from subreddit\n\n" +
          "Examples:\n" +
          "  {pn} random\n" +
          "  {pn} random 5\n" +
          "  {pn} dankmemes 3\n" +
          "  {pn} wholesomememes"
    }
  },

  onStart: async function ({ args, message }) {
    const sub   = args[0]?.toLowerCase() || "random";
    const count = Math.min(Math.max(parseInt(args[1]) || 1, 1), MAX_MEMES);

    const subreddit = sub === "random" ? "" : `/${sub}`;
    const url = `https://meme-api.com/gimme${subreddit}/${count}`;

    const loading = await message.reply(
      count === 1
        ? `🔄 Fetching a meme${sub !== "random" ? ` from r/${sub}` : ""}...`
        : `🔄 Fetching ${count} memes${sub !== "random" ? ` from r/${sub}` : ""}...`
    );

    try {
      const res   = await axios.get(url, { timeout: 10000 });
      const memes = res.data.memes || [res.data];

      if (!memes || memes.length === 0) {
        message.unsend(loading.messageID).catch(() => {});
        return message.reply("❌ No memes found. Try a different subreddit.");
      }

      const imageExts = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
      const valid = memes.filter(m =>
        m.url && imageExts.some(ext => m.url.toLowerCase().includes(ext)) && !m.nsfw
      );

      if (valid.length === 0) {
        message.unsend(loading.messageID).catch(() => {});
        return message.reply("❌ Couldn't find image memes this time. Try again!");
      }

      // Ensure tmp dir exists
      const tmpDir = path.join(__dirname, "tmp");
      await fs.ensureDir(tmpDir);

      for (let i = 0; i < valid.length; i++) {
        const meme = valid[i];

        // Download image to a temp file, then stream it
        const ext      = (meme.url.split(".").pop().split("?")[0] || "jpg").toLowerCase();
        const tmpPath  = path.join(tmpDir, `meme_${Date.now()}_${i}.${ext}`);

        const imgRes = await axios.get(meme.url, {
          responseType: "arraybuffer",
          timeout: 15000
        });
        await fs.writeFile(tmpPath, Buffer.from(imgRes.data));

        await message.reply({
          body: `${valid.length > 1 ? `[${i + 1}/${valid.length}] ` : ""}` +
                `😂 ${meme.title}\n` +
                `━━━━━━━━━━━━━━━\n` +
                `📌 r/${meme.subreddit}  👍 ${meme.ups.toLocaleString()}`,
          attachment: fs.createReadStream(tmpPath)
        });

        // Clean up temp file after sending
        fs.remove(tmpPath).catch(() => {});

        if (i < valid.length - 1) await new Promise(r => setTimeout(r, 800));
      }

      message.unsend(loading.messageID).catch(() => {});

    } catch (err) {
      message.unsend(loading.messageID).catch(() => {});
      if (err.response?.status === 404) {
        return message.reply(`❌ Subreddit r/${sub} not found or has no memes.`);
      }
      if (err.code === "ECONNABORTED") {
        return message.reply("❌ Request timed out. Try again.");
      }
      return message.reply(`❌ Failed to fetch memes.\nError: ${err.message}`);
    }
  }
};
