// In-memory tracker: { userID: [timestamp, timestamp, ...] }
const commandTracker = new Map();

module.exports = {
  config: {
    name: "autoban",
    version: "1.0",
    author: "Charles MK",
    countDown: 5,
    role: 2,
    description: "Auto-ban users who spam commands too fast",
    category: "admin",
    guide: {
      en: "{pn} <limit> <seconds> — Set spam threshold\n" +
          "Example: {pn} 5 10\n" +
          "Bans anyone who sends <limit> commands in <seconds> seconds\n\n" +
          "{pn} status — View current settings\n" +
          "{pn} off — Disable autoban"
    }
  },

  // ── This runs on every message, checking for spammers ──────
  onChat: async function ({ event, usersData, message, globalData }) {
    const { senderID } = event;
    if (!senderID) return;

    // Skip admins
    const adminBot = global.GoatBot?.config?.adminBot || [];
    if (adminBot.includes(senderID)) return;

    // Load settings
    const settings = await globalData.get("autobanSettings", "data", null);
    if (!settings || !settings.enabled) return;

    const { limit, seconds } = settings;
    const window = seconds * 1000;
    const now = Date.now();

    // Get or init this user's command timestamps
    if (!commandTracker.has(senderID)) {
      commandTracker.set(senderID, []);
    }

    const timestamps = commandTracker.get(senderID);

    // Only keep timestamps within the time window
    const recent = timestamps.filter(t => now - t < window);
    recent.push(now);
    commandTracker.set(senderID, recent);

    // Check if user hit the warning threshold (one below limit)
    if (recent.length === limit - 1) {
      return message.reply(
        `⚠️ 𝗦𝗟𝗢𝗪 𝗗𝗢𝗪𝗡!\n\n` +
        `You're sending commands too fast.\n` +
        `Send ${1} more within ${seconds}s and you'll be auto-banned.`
      );
    }

    // Check if user hit the ban threshold
    if (recent.length >= limit) {
      commandTracker.delete(senderID);

      // Build banned object matching GoatBot's handler format
      const banData = await usersData.get(senderID);
      await usersData.set(senderID, {
        ...banData,
        banned: {
          status: true,
          reason: `Auto-banned: sent ${limit}+ commands in ${seconds} seconds`,
          date: new Date().toLocaleString()
        }
      });

      // Schedule unban after 5 hours
      setTimeout(async () => {
        try {
          const freshData = await usersData.get(senderID);
          await usersData.set(senderID, {
            ...freshData,
            banned: { status: false }
          });
        } catch (_) {}
      }, 5 * 60 * 60 * 1000);

      return; // silent ban — no reply, they just stop getting responses
    }
  },

  // ── Admin command to configure/view/disable ─────────────────
  onStart: async function ({ args, message, globalData }) {

    // ── Status ───────────────────────────────────────────────
    if (args[0] === "status") {
      const settings = await globalData.get("autobanSettings", "data", null);
      if (!settings || !settings.enabled) {
        return message.reply(`🛡️ 𝗔𝗨𝗧𝗢𝗕𝗔𝗡 𝗦𝗧𝗔𝗧𝗨𝗦\n\n❌ Currently disabled`);
      }
      return message.reply(
        `🛡️ 𝗔𝗨𝗧𝗢𝗕𝗔𝗡 𝗦𝗧𝗔𝗧𝗨𝗦\n\n` +
        `✅ Enabled\n` +
        `📊 Limit: ${settings.limit} commands\n` +
        `⏱️ Window: ${settings.seconds} seconds\n` +
        `⛔ Ban duration: 5 hours\n\n` +
        `Warning sent at ${settings.limit - 1} commands.`
      );
    }

    // ── Off ───────────────────────────────────────────────────
    if (args[0] === "off") {
      const settings = await globalData.get("autobanSettings", "data", null) || {};
      settings.enabled = false;
      await globalData.set("autobanSettings", settings, "data");
      return message.reply(`🛡️ 𝗔𝗨𝗧𝗢𝗕𝗔𝗡\n\n❌ Disabled. Users will no longer be auto-banned.`);
    }

    // ── Set limit and seconds ─────────────────────────────────
    const limit = parseInt(args[0]);
    const seconds = parseInt(args[1]);

    if (!limit || !seconds || limit <= 1 || seconds <= 0) {
      return message.reply(
        `❌ Invalid usage.\n\n` +
        `Example: +autoban 5 10\n` +
        `(Ban anyone who sends 5+ commands in 10 seconds)\n\n` +
        `Other options:\n` +
        `• +autoban status\n` +
        `• +autoban off`
      );
    }

    const settings = {
      enabled: true,
      limit,
      seconds
    };
    await globalData.set("autobanSettings", settings, "data");

    // Clear existing tracker when settings change
    commandTracker.clear();

    return message.reply(
      `🛡️ 𝗔𝗨𝗧𝗢𝗕𝗔𝗡 𝗘𝗡𝗔𝗕𝗟𝗘𝗗\n\n` +
      `📊 Limit: ${limit} commands\n` +
      `⏱️ Window: ${seconds} seconds\n` +
      `⛔ Ban duration: 5 hours\n\n` +
      `Users will be warned at ${limit - 1} commands,\n` +
      `then silently banned on the ${limit}th.`
    );
  }
};
