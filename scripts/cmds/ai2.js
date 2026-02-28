// ═══════════════════════════════════════════════════════════════
//   youai.js  —  AI chat + image + script analyzer
//   Powered by Shizu AI (shizuai.vercel.app)
//
//   Commands:
//     +ai <message>                    — Chat normally
//     +ai <message> + image attached  — AI reads the image too
//     +ai analyze <file.js> [question] — Inject script into AI
//     +ai list                         — List all available scripts
//     +ai read <file.js>               — Dump raw script content
//     +ai reset                        — Clear your conversation
// ═══════════════════════════════════════════════════════════════

const axios  = require("axios");
const fs     = require("fs-extra");
const path   = require("path");

const API_ENDPOINT   = "https://shizuai.vercel.app/chat";
const CLEAR_ENDPOINT = "https://shizuai.vercel.app/chat/clear";
const CMDS_DIR       = __dirname;
const TMP_DIR        = path.join(__dirname, "cache");
const MAX_SCRIPT_CHARS = 8000; // Shizu has limits — keep it reasonable

// ── Resolve a script filename safely ──────────────────────────
function resolveScript(fileName) {
  const safe = path.basename(fileName);
  const candidates = [
    path.join(CMDS_DIR, safe),
    path.join(CMDS_DIR, safe.endsWith(".js") ? safe : `${safe}.js`),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// ── List all .js files in the commands folder ──────────────────
function listScripts() {
  try {
    return fs.readdirSync(CMDS_DIR).filter(f => f.endsWith(".js")).sort();
  } catch {
    return [];
  }
}

// ── Download a URL to a temp file ─────────────────────────────
async function downloadFile(url, ext) {
  await fs.ensureDir(TMP_DIR);
  const filePath = path.join(TMP_DIR, `shizu_${Date.now()}.${ext}`);
  const res = await axios.get(url, { responseType: "arraybuffer" });
  await fs.writeFile(filePath, res.data);
  return filePath;
}

// ── Normalize AI response (replace original author refs) ──────
function normalizeText(text) {
  if (!text) return text;
  return text
    .replace(/Aryan\s*Chau[ch]an/gi, "Charles MK")
    .replace(/A\.?\s*Chau[ch]an/gi,  "Charles MK")
    .replace(/Shizu/gi, "AI");
}

// ── Strip Shizu's header line e.g. "🎀 𝗦𝗵𝗶𝘇𝘂 ( 30/78202 )" ──
// The API prepends this to every response — remove it and add
// a clean divider instead so the reply looks native to the bot.
function cleanResponse(text) {
  if (!text) return text;
  // Remove any leading line that contains the Shizu badge pattern
  // Matches lines like: "🎀 𝗦𝗵𝗶𝘇𝘂 ( 30/78202 )" or "🎀 Shizu (12/5000)"
  const cleaned = text.replace(/^.*[Ss]hizu.*[\(\)]\s*\n?/u, "").trimStart();
  return `━━━━━━━━━━━━━━━━━━━━━━\n${cleaned}`;
}

module.exports = {
  config: {
    name: "youai2",
    aliases: ["shizuai2", "ai2", "gpt2"],
    version: "9.0",
    author: "Aryan",
    countDown: 5,
    role: 2,
    shortDescription: "Chat with AI, analyze images & scripts",
    longDescription:
      "AI chat powered by Shizu. Supports image input, script analysis, and music/video responses.\n" +
      "Use '+ai list' to see analyzable scripts.",
    category: "ai",
    guide: {
      en:
        "{pn} <message>                    — Chat with AI\n" +
        "{pn} <message> [+ image]          — AI reads your image\n" +
        "{pn} list                         — List all scripts\n" +
        "{pn} analyze <file.js> [question] — Analyze a script\n" +
        "{pn} read <file.js>               — Show raw script content\n" +
        "{pn} reset                        — Clear conversation history",
    },
  },

  langs: {
    en: {
      noInput:      "💬 Please provide a message or image.",
      loading:      "🤖 AI is thinking...\nPlease wait...",
      analyzing:    "📂 Injecting script into AI...\nPlease wait...",
      resetSuccess: "♻️ Conversation successfully reset.",
      resetFail:    "❌ Reset failed.",
      error:        "❌ An AI error occurred. Please try again.",
      fileNotFound: "❌ Script '{file}' not found.\nUse +ai list to see available scripts.",
      readError:    "❌ Could not read '{file}'.",
    },
  },

  onStart: async function (ctx) {
    return this.handleChat(ctx);
  },

  onReply: async function ({ message, event, Reply, getLang }) {
    if (event.senderID !== Reply.author) return;
    const args = event.body.trim().split(/\s+/);
    return this.handleChat({ message, args, event, getLang });
  },

  handleChat: async function ({ message, args, event, getLang }) {
    const senderID  = event.senderID;
    const rawInput  = args.join(" ").trim();
    const subcmd    = (args[0] || "").toLowerCase();

    if (!rawInput && !event.attachments?.length) {
      return message.reply(getLang("noInput"));
    }

    // ── reset ────────────────────────────────────────────────
    if (["reset", "clear"].includes(subcmd)) {
      try {
        await axios.delete(`${CLEAR_ENDPOINT}/${encodeURIComponent(senderID)}`);
        return message.reply(getLang("resetSuccess"));
      } catch {
        return message.reply(getLang("resetFail"));
      }
    }

    // ── list ─────────────────────────────────────────────────
    if (subcmd === "list") {
      const scripts = listScripts();
      if (!scripts.length) return message.reply("❌ No scripts found in the commands folder.");
      const lines = scripts.map((f, i) => `${i + 1}. ${f}`).join("\n");
      return message.reply(
        `📂 𝗔𝗩𝗔𝗜𝗟𝗔𝗕𝗟𝗘 𝗦𝗖𝗥𝗜𝗣𝗧𝗦 (${scripts.length})\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n${lines}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Use: +ai analyze <filename> [question]`
      );
    }

    // ── read <file> ──────────────────────────────────────────
    if (subcmd === "read") {
      const fileName = args[1];
      if (!fileName) return message.reply("❌ Specify a file. Example: +ai read fight.js");
      const filePath = resolveScript(fileName);
      if (!filePath) return message.reply(getLang("fileNotFound").replace("{file}", fileName));
      try {
        const content = fs.readFileSync(filePath, "utf8");
        const lines   = content.split("\n").length;
        const preview = content.length > 2000
          ? content.slice(0, 2000) + `\n\n... [${lines} lines total — use +ai analyze for full AI review]`
          : content;
        return message.reply(`📄 ${path.basename(filePath)} (${lines} lines)\n━━━━━━━━━━━━━━━━━━━━━━\n${preview}`);
      } catch {
        return message.reply(getLang("readError").replace("{file}", fileName));
      }
    }

    // ── Build the message to send to Shizu ───────────────────
    let finalMessage = rawInput;
    let imageUrl     = null;
    const isAnalyze  = subcmd === "analyze";

    // ── analyze <file> [question] ────────────────────────────
    if (isAnalyze) {
      const fileName = args[1];
      if (!fileName) return message.reply("❌ Specify a file. Example: +ai analyze pair.js");
      const filePath = resolveScript(fileName);
      if (!filePath) return message.reply(getLang("fileNotFound").replace("{file}", fileName));
      try {
        let content  = fs.readFileSync(filePath, "utf8");
        const baseName = path.basename(filePath);
        if (content.length > MAX_SCRIPT_CHARS) {
          content = content.slice(0, MAX_SCRIPT_CHARS) +
            `\n// ... [truncated at ${MAX_SCRIPT_CHARS} chars]`;
        }
        const question = args.slice(2).join(" ").trim() ||
          "Analyze this script. Explain what it does, find any bugs or issues, and suggest improvements.";

        // Inject full script into the message sent to Shizu
        finalMessage =
          `Here is a GoatBot Node.js script called "${baseName}":\n\n` +
          `\`\`\`javascript\n${content}\n\`\`\`\n\n${question}`;
      } catch {
        return message.reply(getLang("readError").replace("{file}", args[1]));
      }
    }

    // ── Image detection (direct or replied-to message) ───────
    const directImage = event.attachments?.find(a => a.type === "photo");
    if (directImage?.url) imageUrl = directImage.url;

    const replyImage = event.messageReply?.attachments?.find(a => a.type === "photo");
    if (replyImage?.url) imageUrl = replyImage.url;

    // ── Show loading message ──────────────────────────────────
    const loadingMsg = await message.reply(
      isAnalyze ? getLang("analyzing") : getLang("loading")
    );

    const createdFiles = [];

    try {
      const res = await axios.post(API_ENDPOINT, {
        uid:       senderID,
        message:   finalMessage,
        image_url: imageUrl || undefined,
      }, { timeout: 60000 });

      const {
        reply,
        image_url,
        music_data,
        video_data,
        shoti_data,
        lyrics_data,
      } = res.data;

      let body        = normalizeText(cleanResponse(reply || "✅ Done!"));
      const attachments = [];

      // ── Handle media responses ──────────────────────────────
      if (image_url) {
        const file = await downloadFile(image_url, "jpg");
        attachments.push(fs.createReadStream(file));
        createdFiles.push(file);
      }

      if (music_data?.downloadUrl) {
        const file = await downloadFile(music_data.downloadUrl, "mp3");
        attachments.push(fs.createReadStream(file));
        createdFiles.push(file);
      }

      if (video_data?.downloadUrl) {
        const file = await downloadFile(video_data.downloadUrl, "mp4");
        attachments.push(fs.createReadStream(file));
        createdFiles.push(file);
      }

      if (shoti_data?.downloadUrl) {
        const file = await downloadFile(shoti_data.downloadUrl, "mp4");
        attachments.push(fs.createReadStream(file));
        createdFiles.push(file);
      }

      if (lyrics_data?.lyrics) {
        body += `\n\n🎵 ${lyrics_data.track_name || "Lyrics"}\n` +
          normalizeText(lyrics_data.lyrics.slice(0, 1500));
      }

      // ── Unsend loading & send reply ───────────────────────
      if (loadingMsg?.messageID) await message.unsend(loadingMsg.messageID).catch(() => {});

      const sentMessage = await message.reply({
        body,
        attachment: attachments.length ? attachments : undefined,
      });

      // ── Enable reply chaining ─────────────────────────────
      global.GoatBot.onReply.set(sentMessage.messageID, {
        commandName: this.config.name,
        author:      senderID,
        messageID:   sentMessage.messageID,
      });

    } catch (err) {
      console.error("[youai/shizu error]", err.message);
      if (loadingMsg?.messageID) await message.unsend(loadingMsg.messageID).catch(() => {});
      return message.reply(getLang("error"));
    } finally {
      // ── Clean up temp files ───────────────────────────────
      for (const file of createdFiles) {
        if (await fs.pathExists(file)) await fs.remove(file);
      }
    }
  },
};
