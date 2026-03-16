const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  config: {
    name: "wanted",
    version: "1.0.1",
    author: "NTKhang",
    countDown: 5,
    role: 0,
    shortDescription: "Create a wanted poster",
    longDescription: "Create a wanted poster with your avatar or tagged user",
    category: "image",
    guide: "{pn} [@tag/reply]"
  },

  onStart: async function ({ message, event, args, getPrefix }) {
    const { targetID, caption } = await getTarget(event, args);
    const endpoint = `https://www.api.vyturex.com/wanted?uid=${targetID}`; 
    // Note: If this public API is down, some versions use a local Canvas draw method.

    const pathSave = path.join(__dirname, "cache", `wanted_${targetID}.png`);

    try {
      const response = await axios.get(endpoint, { responseType: "arraybuffer" });
      fs.writeFileSync(pathSave, Buffer.from(response.data, "utf-8"));

      return message.reply({
        body: `Reward: $${Math.floor(Math.random() * 1000000).toLocaleString()}`,
        attachment: fs.createReadStream(pathSave)
      }, () => fs.unlinkSync(pathSave));
    } catch (err) {
      return message.reply("Could not generate the image. The image API might be offline.");
    }
  }
};

async function getTarget(event, args) {
  let targetID, caption;
  if (event.type == "message_reply") {
    targetID = event.messageReply.senderID;
  } else if (Object.keys(event.mentions).length > 0) {
    targetID = Object.keys(event.mentions)[0];
  } else {
    targetID = event.senderID;
  }
  return { targetID };
}
