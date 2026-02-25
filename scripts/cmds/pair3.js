const axios = require("axios");
const { createCanvas, loadImage } = require("canvas");
const fs = require("fs");
const path = require("path");

module.exports = {
  config: {
    name: "pair3",
    author: "Charles MK",
    category: "love",
    version: "6.0",
    guide: {
        en: "{pn} - Random pair\n{pn} @tag - Pair yourself with someone\n{pn} @tag1 @tag2 - Pair two specific people\n{pn} [UID1] [UID2] - Pair via UIDs"
    }
  },

  onStart: async function ({ api, event, args, usersData }) {
    const { threadID, messageID, senderID, mentions } = event;
    const cachePath = path.join(__dirname, "cache", `pair_${Date.now()}.png`);

    try {
      let user1, user2;
      const mentionIDs = Object.keys(mentions);

      // --- LOGIC: CHOOSE USERS TO PAIR ---
      if (mentionIDs.length >= 2) {
        // Scenario 1: Two users tagged (+pair @user1 @user2)
        user1 = mentionIDs[0];
        user2 = mentionIDs[1];
      } else if (args.length >= 2 && !isNaN(args[0]) && !isNaN(args[1])) {
        // Scenario 2: Two UIDs provided (+pair UID1 UID2)
        user1 = args[0];
        user2 = args[1];
      } else if (mentionIDs.length === 1) {
        // Scenario 3: One user tagged (+pair @user) -> Pair with Sender
        user1 = senderID;
        user2 = mentionIDs[0];
      } else if (args.length === 1 && !isNaN(args[0])) {
        // Scenario 4: One UID provided (+pair UID) -> Pair with Sender
        user1 = senderID;
        user2 = args[0];
      } else {
        // Scenario 5: Random matching (Original logic)
        const threadInfo = await api.getThreadInfo(threadID);
        const participantIDs = threadInfo.participantIDs.filter(id => id !== senderID && id !== api.getCurrentUserID());
        if (participantIDs.length === 0) return api.sendMessage("❌ Need more members!", threadID, messageID);

        user1 = senderID;
        user2 = participantIDs[Math.floor(Math.random() * participantIDs.length)];
      }

      // --- FETCH DATA & RENDER ---
      const allUsers = await api.getUserInfo([user1, user2]);
      const name1 = allUsers[user1]?.name || "User 1";
      const name2 = allUsers[user2]?.name || "User 2";

      const canvas = createCanvas(800, 400);
      const ctx = canvas.getContext("2d");

      const background = await loadImage("https://i.postimg.cc/pdv5dFVX/611905695-855684437229208-8377464727643815456-n.png");
      ctx.drawImage(background, 0, 0, 800, 400);

      const avt1 = await loadImage(`https://graph.facebook.com/${user1}/picture?width=512&height=512&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`);
      const avt2 = await loadImage(`https://graph.facebook.com/${user2}/picture?width=512&height=512&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`);

      const radius = 88;
      // Upper Frame
      ctx.save();
      ctx.beginPath();
      ctx.arc(471, 124, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avt1, 471 - radius, 124 - radius, radius * 2, radius * 2);
      ctx.restore();

      // Lower Frame
      ctx.save();
      ctx.beginPath();
      ctx.arc(673, 276, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avt2, 673 - radius, 276 - radius, radius * 2, radius * 2);
      ctx.restore();

      if (!fs.existsSync(path.join(__dirname, "cache"))) fs.mkdirSync(path.join(__dirname, "cache"));
      fs.writeFileSync(cachePath, canvas.toBuffer());

      const matchPercentage = Math.floor(Math.random() * 30) + 70;
      const randomMessage = `💕 Match Analysis Complete! 💕\n━━━━━━━━━━━━━━━━━\n👤 ${name1}\n💖 ${matchPercentage}% Compatible 💖\n👤 ${name2}\n━━━━━━━━━━━━━━━━━\n✨ Destiny has brought you together! ✨`;

      return api.sendMessage({
        body: randomMessage,
        attachment: fs.createReadStream(cachePath)
      }, threadID, () => {
        if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
      }, messageID);

    } catch (err) {
      console.error(err);
      return api.sendMessage("❌ Error: Make sure both users are in this group and UIDs are correct.", threadID, messageID);
    }
  }
};
