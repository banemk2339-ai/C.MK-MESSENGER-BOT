module.exports = {
  config: {
    name: "github",
    aliases: ["git", "botgithub"],
    version: "1.0",
    author: "Charles MK",
    countDown: 3,
    role: 2,
    longDescription: "Returns the link the bot's github.",
    category: "system",
    guide: { en: "{pn}" }
  },

  onStart: async function({ message }) {
    const text = "✓ | Here is the bot's Github link:\n\nhttps://github.com/BaneleMK12/C.MK-MESSENGER-BOT\n\n";

    message.reply(text);
  }
};
