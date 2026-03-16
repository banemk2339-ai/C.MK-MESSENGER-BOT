const fs = require("fs-extra");
const path = require("path");
const { utils } = global;

const CACHE_PATH = path.join(__dirname, "tmp", "prefix.mp4");

async function ensureVideo() {
  if (!fs.existsSync(CACHE_PATH)) {
    fs.ensureDirSync(path.dirname(CACHE_PATH));
    const stream = await utils.getStreamFromURL("https://files.catbox.moe/hmli02.mp4");
    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(CACHE_PATH);
      stream.pipe(out);
      out.on("finish", resolve);
      out.on("error", reject);
    });
  }
}

module.exports = {
  config: {
    name: "prefix",
    version: "1.5",
    author: "Charles MK",
    countDown: 5,
    role: 0,
    description: "Change the bot prefix in your chat box or globally (admin only)",
    category: "⚙️ Configuration",
    guide: {
      en:
        "『 Prefix Settings 』\n"
      + "│\n"
      + "│ 🔹 {pn} <prefix>\n"
      + "│     Set prefix for this chat\n"
      + "│     Example: {pn} $\n"
      + "│\n"
      + "│ 🔹 {pn} <prefix> -g\n"
      + "│     Set global prefix (Admin only)\n"
      + "│     Example: {pn} $ -g\n"
      + "│\n"
      + "│ ♻️ {pn} reset\n"
      + "│     Reset to default prefix\n"
    }
  },

  langs: {
    en: {
      reset:
        "┌─『 Prefix Reset 』\n"
      + `│ ✅ Reset to default: %1`,
      onlyAdmin:
        "┌─『 Permission Denied 』\n"
      + "│ ⛔ Only bot admins can change global prefix!",
      confirmGlobal:
        "┌─『 Global Prefix Change 』\n"
      + "│ ⚙️ React to confirm global prefix update.",
      confirmThisThread:
        "┌─『 Chat Prefix Change 』\n"
      + "│ ⚙️ React to confirm this chat's prefix update.",
      successGlobal:
        "┌─『 Prefix Updated 』\n"
      + `│ ✅ Global prefix: %1`,
      successThisThread:
        "┌─『 Prefix Updated 』─┐\n"
      + `│ ✅ Chat prefix: %1\n`,
      myPrefix:
        "┌─『 Current Prefix 』─┐\n"
      + `│ 🌍 Global: %1\n`
      + `│ 💬 This Chat: %2\n`
      + "│\n"
      + `│ ➤ Type: ${2}help\n`
      + "└─────────────────────┘"
    }
  },

  onLoad: async function () {
    await ensureVideo();
  },

  onStart: async function ({ message, role, args, commandName, event, threadsData, getLang }) {
    if (!args[0]) return message.SyntaxError();

    if (args[0] === "reset") {
      await threadsData.set(event.threadID, null, "data.prefix");
      return message.reply(getLang("reset", global.GoatBot.config.prefix));
    }

    const newPrefix = args[0];
    const formSet = {
      commandName,
      author: event.senderID,
      newPrefix,
      setGlobal: args[1] === "-g"
    };

    if (formSet.setGlobal && role < 2) {
      return message.reply(getLang("onlyAdmin"));
    }

    const confirmMessage = formSet.setGlobal ? getLang("confirmGlobal") : getLang("confirmThisThread");
    return message.reply(confirmMessage, (err, info) => {
      formSet.messageID = info.messageID;
      global.GoatBot.onReaction.set(info.messageID, formSet);
    });
  },

  onReaction: async function ({ message, threadsData, event, Reaction, getLang }) {
    const { author, newPrefix, setGlobal } = Reaction;
    if (event.userID !== author) return;

    if (setGlobal) {
      global.GoatBot.config.prefix = newPrefix;
      fs.writeFileSync(global.client.dirConfig, JSON.stringify(global.GoatBot.config, null, 2));
      return message.reply(getLang("successGlobal", newPrefix));
    }

    await threadsData.set(event.threadID, newPrefix, "data.prefix");
    return message.reply(getLang("successThisThread", newPrefix));
  },

  onChat: async function ({ event, message, threadsData }) {
    const globalPrefix = global.GoatBot.config.prefix;
    const threadPrefix = await threadsData.get(event.threadID, "data.prefix") || globalPrefix;

    if (event.body && event.body.toLowerCase() === "prefix") {
      // Safety check in case onLoad download failed
      if (!fs.existsSync(CACHE_PATH)) await ensureVideo();

      return message.reply({
        body:
          "╔══『 𝐏𝐑𝐄𝐅𝐈𝐗 』══╗\n"
        + `║ 🌍 System : ${globalPrefix}\n`
        + `║ 💬 Chatbox : ${threadPrefix}\n`
        + `║ ➤ ${threadPrefix}help to see all available cmds \n`
        + "╚══════════════╝",
        attachment: fs.createReadStream(CACHE_PATH)
      });
    }
  }
};
