const { loadImage, createCanvas } = require("canvas");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
    config: {
        name: "pair",
        author: "Charles MK",
        version: "1.2",
        countDown: 12,
        role: 0,
        category: "fun",
        guide: {
            en: "{pn} - Random pair based on gender\n{pn} @tag - Pair yourself with someone\n{pn} @tag1 @tag2 - Pair two specific people\n{pn} [UID1] [UID2] - Pair via UIDs"
        }
    },
    onStart: async function ({ api, event, args }) {
        const { threadID, messageID, senderID, mentions } = event;
        const cacheDir = path.join(__dirname, "cache");
        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);

        let pathImg = path.join(cacheDir, `pair2_${Date.now()}.png`);
        let pathAvt1 = path.join(cacheDir, `Avt1_${Date.now()}.png`);
        let pathAvt2 = path.join(cacheDir, `Avt2_${Date.now()}.png`);

        try {
            let id1, id2;
            const mentionIDs = Object.keys(mentions);

            // --- SELECTION LOGIC ---
            if (mentionIDs.length >= 2) {
                // Case 1: Two people tagged
                id1 = mentionIDs[0];
                id2 = mentionIDs[1];
            } else if (args.length >= 2 && !isNaN(args[0]) && !isNaN(args[1])) {
                // Case 2: Two UIDs provided
                id1 = args[0];
                id2 = args[1];
            } else if (mentionIDs.length === 1) {
                // Case 3: One person tagged (Pair with sender)
                id1 = senderID;
                id2 = mentionIDs[0];
            } else if (args.length === 1 && !isNaN(args[0])) {
                // Case 4: One UID provided (Pair with sender)
                id1 = senderID;
                id2 = args[0];
            } else {
                // Case 5: Original Random Logic
                var id1_temp = senderID;
                var ThreadInfo = await api.getThreadInfo(threadID);
                var all = ThreadInfo.userInfo;

                let gender1;
                for (let c of all) if (c.id == id1_temp) gender1 = c.gender;

                const botID = api.getCurrentUserID();
                let candidates = [];
                if (gender1 == "FEMALE") {
                    candidates = all.filter(u => u.gender == "MALE" && u.id !== id1_temp && u.id !== botID).map(u => u.id);
                } else if (gender1 == "MALE") {
                    candidates = all.filter(u => u.gender == "FEMALE" && u.id !== id1_temp && u.id !== botID).map(u => u.id);
                } else {
                    candidates = all.filter(u => u.id !== id1_temp && u.id !== botID).map(u => u.id);
                }

                if (!candidates.length) return api.sendMessage("No suitable partner found in this group.", threadID, messageID);

                id1 = id1_temp;
                id2 = candidates[Math.floor(Math.random() * candidates.length)];
            }

            // --- FETCH NAMES ---
            const userInfo = await api.getUserInfo([id1, id2]);
            const name1 = userInfo[id1]?.name || "User 1";
            const name2 = userInfo[id2]?.name || "User 2";

            // --- MATCH DATA ---
            var rd1 = Math.floor(Math.random() * 100) + 1;
            var cc = ["-𝟭", "𝟵𝟵.𝟵𝟵", "𝟭𝟵", "∞", "𝟭𝟬𝟭", "𝟬.𝟬𝟭"];
            var rd2 = cc[Math.floor(Math.random() * cc.length)];
            var djtme = Array(5).fill(`${rd1}`).concat([`${rd2}`], Array(4).fill(`${rd1}`));
            var matchRate = djtme[Math.floor(Math.random() * djtme.length)];

            const notes = [
                "𝗘𝘃𝗲𝗿𝘆 𝘁𝗶𝗺𝗲 𝗜 𝘀𝗲𝗲 𝘆𝗼𝘂, 𝗺𝘆 𝗵𝗲𝗮𝗿𝘁 𝘀𝗸𝗶𝗽𝘀 𝗮 𝗯𝗲𝗮𝘁.",
                "𝗬𝗼𝘂’𝗿𝗲 𝗺𝘆 𝘁𝗼𝗱𝗮𝘆 𝗮𝗻𝗱 𝗮𝗹𝗹 𝗼𝗳 𝗺𝘆 𝘁𝗼𝗺𝗼𝗿𝗿𝗼𝘄𝘀.",
                "𝗜𝗻 𝘆𝗼𝘂𝗿 𝘀𝗺𝗶𝗹𝗲, 𝗜 𝘀𝗲𝗲 𝘀𝗼𝗺𝗲𝘁𝗵𝗶𝗻𝗴 𝗺𝗼𝗿𝗲 𝗯𝗲𝗮𝘂𝘁𝗶𝗳𝘂𝗹 𝘁𝗵𝗮𝗻 𝘁𝗵𝗲 𝘀𝘁𝗮𝗿𝘀.",
                "𝗬𝗼𝘂 𝗺𝗮𝗸𝗲 𝗺𝘆 𝗵𝗲𝗮𝗿𝘁 𝗿𝗮𝗰𝗲 𝘄𝗶𝘁𝗵𝗼𝘂𝘁 𝗲𝘃𝗲𝗻 𝘁𝗿𝘆𝗶𝗻𝗴.",
                "𝗘𝘃𝗲𝗿𝘆 𝗹𝗼𝘃𝗲 𝘀𝘁𝗼𝗿𝘆 𝗶𝘀 𝗯𝗲𝗮𝘂𝘁𝗶𝗳𝘂𝗹, 𝗯𝘂𝘁 𝗼𝘂𝗿𝘀 𝗶𝘀 𝗺𝘆 𝗳𝗮𝘃𝗼𝗿𝗶𝘁𝗲."
            ];
            const lovelyNote = notes[Math.floor(Math.random() * notes.length)];

            // --- IMAGE PROCESSING ---
            const bgURL = "https://i.postimg.cc/nrgPFtDG/Picsart-25-08-12-20-22-41-970.png";
            const avtBase = (id) => `https://graph.facebook.com/${id}/picture?width=720&height=720&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;

            const [bgData, avt1Data, avt2Data] = await Promise.all([
                axios.get(bgURL, { responseType: "arraybuffer" }),
                axios.get(avtBase(id1), { responseType: "arraybuffer" }),
                axios.get(avtBase(id2), { responseType: "arraybuffer" })
            ]);

            fs.writeFileSync(pathAvt1, Buffer.from(avt1Data.data));
            fs.writeFileSync(pathAvt2, Buffer.from(avt2Data.data));
            fs.writeFileSync(pathImg, Buffer.from(bgData.data));

            let baseImage = await loadImage(pathImg);
            let imgAvt1 = await loadImage(pathAvt1);
            let imgAvt2 = await loadImage(pathAvt2);

            let canvas = createCanvas(baseImage.width, baseImage.height);
            let ctx = canvas.getContext("2d");

            ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
            ctx.drawImage(imgAvt1, 120, 170, 300, 300);
            ctx.drawImage(imgAvt2, canvas.width - 420, 170, 300, 300);

            fs.writeFileSync(pathImg, canvas.toBuffer());
            fs.removeSync(pathAvt1);
            fs.removeSync(pathAvt2);

            const kawaiiMessage = `
🌸💞 *Cᴏɴɢʀᴀᴛs* 💞🌸
@${name1}  ＆ @${name2} ✨

💖 *Mᴀᴛᴄʜ Rᴀᴛᴇ:* ${matchRate}% 💖

🌷 𝓛𝓸𝓿𝓮𝓵𝔂 𝓝𝓸𝓽𝓮 🌷
❝ ${lovelyNote}❞

💫 𝒀𝒐𝒖 𝒂𝒓𝒆 𝒎𝒚 𝒔𝒖𝒏𝒔𝒉𝒊𝒏𝒆! 💫`;

            return api.sendMessage({
                body: kawaiiMessage,
                mentions: [
                    { tag: name1, id: id1 },
                    { tag: name2, id: id2 }
                ],
                attachment: fs.createReadStream(pathImg),
            }, threadID, () => fs.unlinkSync(pathImg), messageID);

        } catch (err) {
            console.error(err);
            return api.sendMessage("❌ Error during pairing. Make sure UIDs are valid and user is in the group.", threadID, messageID);
        }
    },
};
