
const fs = require("fs-extra");
const { utils } = global;

module.exports = {
  config: {
    name: "prefix",
    version: "1.5",
    author: "Charles MK",
    countDown: 5,
    role: 0,
    description: "Change bot prefix for this group or globally.",
    category: "config",
    guide: {
      en: "{pn} <new prefix>: change prefix in this group\n{pn} <new prefix> -g: change global prefix (Admin only)\n{pn} reset: reset to default"
    }
  },

  langs: {
    en: {
      reset: "Your prefix reset to default: %1",
      onlyAdmin: "Only admin can change prefix of system bot",
      confirmGlobal: "Please react to this message to confirm global prefix change",
      confirmThisThread: "Please react to this message to confirm prefix change for this group",
      successGlobal: "Changed global prefix to: %1",
      successThisThread: "Changed prefix in this group to: %1",
      myPrefix: "👋 Hey %1!\n\n🌐 Global Prefix: %2\n💬 Chat Prefix: %3\n\n🕒 Time: %4\n📅 Date: %5"
    }
  },

  onStart: async function ({ message, role, args, commandName, event, threadsData, getLang }) {
    if (!args[0]) return message.SyntaxError();

    if (args[0] == 'reset') {
      await threadsData.set(event.threadID, null, "data.prefix");
      return message.reply(getLang("reset", global.GoatBot.config.prefix));
    }

    const newPrefix = args[0];
    const formSet = {
      commandName,
      author: event.senderID,
      newPrefix
    };

    if (args[1] === "-g") {
      if (role < 2) return message.reply(getLang("onlyAdmin"));
      else formSet.setGlobal = true;
    } else {
      formSet.setGlobal = false;
    }

    return message.reply(args[1] === "-g" ? getLang("confirmGlobal") : getLang("confirmThisThread"), (err, info) => {
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
    } else {
      await threadsData.set(event.threadID, newPrefix, "data.prefix");
      return message.reply(getLang("successThisThread", newPrefix));
    }
  },

  onChat: async function ({ event, message, getLang, usersData }) {
    if (event.body && event.body.toLowerCase() === "prefix") {
      return async () => {
        const userName = await usersData.getName(event.senderID);
        
        // --- South African Time Logic ---
        const options = {
          timeZone: "Africa/Johannesburg",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true
        };
        const dateOptions = {
          timeZone: "Africa/Johannesburg",
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "long"
        };
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString("en-ZA", options);
        const dateStr = now.toLocaleDateString("en-ZA", dateOptions);

        return message.reply(
          getLang("myPrefix", 
            userName, 
            global.GoatBot.config.prefix, 
            utils.getPrefix(event.threadID), 
            timeStr, 
            dateStr
          )
        );
      };
    }
  }
};
