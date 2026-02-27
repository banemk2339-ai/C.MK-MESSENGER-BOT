const axios = require("axios");

module.exports = {
  config: {
    name: "lyrics",
    aliases: ["lyric", "lyr"],
    version: "2.3.0",
    author: "Charles",
    countDown: 5,
    role: 0,
    shortDescription: { en: "🎵 Search song lyrics" },
    longDescription:  { en: "Search and display lyrics for any song." },
    category: "music",
    guide: {
      en: "{pn} <song name>\nExample: {pn} hamqadam",
    },
  },

  onStart: async function ({ api, event, args, message }) {
    const songName = args.join(" ").trim();
    if (!songName)
      return message.reply(
        `❌ Please provide a song name.\nExample: +lyrics hamqadam`
      );

    await message.reply(`🔍 Searching for "${songName}"...`);

    // ── Try API 1: goatbotnx nx-apis.json ─────────────────
    try {
      const apiRes = await axios.get(
        "https://raw.githubusercontent.com/goatbotnx/Sexy-nx2.0Updated/refs/heads/main/nx-apis.json",
        { timeout: 10000 }
      );
      const lyricsApiBase = apiRes.data?.lyrics;

      if (lyricsApiBase) {
        const res = await axios.get(`${lyricsApiBase}/lyrics`, {
          params: { song: songName },
          timeout: 20000,
        });

        if (res.data?.status) {
          const { title, artist, album, lyrics } = res.data;
          return message.reply(buildMsg(title, artist, album, lyrics));
        }
      }
    } catch (_) {
      // fall through to API 2
    }

    // ── Try API 2: betadash lyrics-finder ─────────────────
    try {
      const { data } = await axios.get(
        `https://betadash-api-swordslush-production.up.railway.app/lyrics-finder`,
        {
          params: { title: songName },
          timeout: 20000,
        }
      );

      if (data?.status === 200 && data?.response) {
        const title  = data.Title  || songName;
        const artist = data.author || "Unknown";
        const lyrics = data.response;

        // If lyrics are very long, send in chunks
        const chunks = splitLyrics(lyrics);
        if (chunks.length === 1) {
          return message.reply(buildMsg(title, artist, null, lyrics));
        }

        await message.reply(buildMsg(title, artist, null, chunks[0]));
        for (let i = 1; i < chunks.length; i++) {
          await message.reply(
            `📜 𝗟𝘆𝗿𝗶𝗰𝘀 (continued ${i + 1}/${chunks.length}):\n\n${chunks[i]}`
          );
        }
        return;
      }
    } catch (_) {
      // fall through to error
    }

    return message.reply(
      `❌ Sorry, no lyrics found for "${songName}".\nTry a different spelling or include the artist name.`
    );
  },
};

// ─── Helpers ────────────────────────────────────────────────────
function buildMsg(title, artist, album, lyrics) {
  return (
    `╭───────────────╮\n` +
    `   🎵  ━━  𝗟𝗬𝗥𝗜𝗖𝗦  ━━  🎵\n` +
    `╰───────────────╯\n\n` +
    `🎧 𝗧𝗶𝘁𝗹𝗲  : ${title}\n` +
    `👤 𝗔𝗿𝘁𝗶𝘀𝘁 : ${artist}\n` +
    (album ? `💿 𝗔𝗹𝗯𝘂𝗺 : ${album}\n` : "") +
    `━━━━━━━━━━━━━━━━━\n\n` +
    `📜 𝗟𝘆𝗿𝗶𝗰𝘀:\n\n${lyrics}\n\n` +
    `━━━━━━━━━━━━━━━━━`
  );
}

function splitLyrics(lyrics, maxLen = 1900) {
  const chunks = [];
  const lines  = lyrics.split("\n");
  let current  = "";

  for (const line of lines) {
    if ((current + "\n" + line).length > maxLen) {
      if (current) chunks.push(current.trim());
      current = line;
    } else {
      current += (current ? "\n" : "") + line;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [lyrics];
}
