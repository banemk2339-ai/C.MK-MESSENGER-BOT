const axios = require("axios");

module.exports = {
  config: {
    name: "hentai",
    aliases: ["nsfw", "lewds", "ecchi", "porn", "hent"],
    version: "1.7",
    author: "Charles MK",
    countDown: 12,
    role: 2,
    description: {
      en: "Generate random hentai image(s) (NSFW, no femboy/gay)"
    },
    category: "NSFW",
    guide: {
      en: "{pn} [number] [category/tag]\nExamples:\n  {pn}       -> 1 random hentai\n  {pn} 5     -> 5 random hentai\n  {pn} 5 waifu -> 5 waifu images\nMax images: 15\n\nAvailable Categories:\nwaifu, neko, blowjob, hentai, boobs, tits, cum,\npussy, lewd, lesbian, feet, futanari, solo, gasm,\nspank, anal, kuni, classic, ngif, erok, erofeet,\nfox_girl, kemonomimi, wallpaper, tickle, eroyuri,\neron, bj, nsfw_neko_gif, nsfw_avatar, feetg,\nholoero, holo, lewdk, solog, lewdkemo, hass,\nhboobs, hanal, pgif, 4k, hneko, hkitsune,\ngonewild, kanna, ass, thigh, hthigh, paizuri,\ntentacle, hmidriff, yuri\n\nNote: Categories matched across APIs. If not found, returns random."
    }
  },

  onStart: async function ({ message, args }) {
    try {
      let num = 1;
      let category = null;
      
      if (args.length > 0) {
        const firstArg = parseInt(args[0], 10);
        if (!isNaN(firstArg) && firstArg >= 1) {
          num = firstArg;
          if (args.length > 1) {
            category = args.slice(1).join('_').toLowerCase();
          }
        } else {
          category = args.join('_').toLowerCase();
        }
      }

      if (num > 15) {
        num = 15;
        await message.reply("Max 15 images due to Messenger limits. Using 15.");
      }

      const blockedCategories = ['trap', 'femboy', 'yaoi', 'shota', 'gay', 'male_only', 'bara', 'tomgirl'];
      if (category && blockedCategories.includes(category)) {
        return message.reply("This category is filtered out (femboy/gay content).");
      }

      const catDisplay = category ? category : 'random';
      await message.reply(`Fetching ${num} ${catDisplay} hentai image${num > 1 ? 's' : ''} (straight only)...`);

      const images = [];
      let attempts = 0;
      const maxAttempts = num * 5;
      
      const blockedKeywords = ['trap', 'femboy', 'yaoi', 'shota', 'gay', 'male_only', 'bara', 'tomgirl'];
      
      const isBlockedContent = (url) => {
        const lowerUrl = url.toLowerCase();
        return blockedKeywords.some(keyword => lowerUrl.includes(keyword));
      };

      const categoryMap = {
        'waifu': { api: 'waifu.pics', endpoint: 'waifu' },
        'neko': { api: 'waifu.pics', endpoint: 'neko' },
        'blowjob': { api: 'waifu.pics', endpoint: 'blowjob' },
        'hentai': { api: 'nekos.life', endpoint: 'hentai' },
        'boobs': { api: 'nekos.life', endpoint: 'boobs' },
        'tits': { api: 'nekos.life', endpoint: 'tits' },
        'cum': { api: 'nekos.life', endpoint: 'cum' },
        'pussy': { api: 'nekos.life', endpoint: 'pussy' },
        'lewd': { api: 'nekos.life', endpoint: 'lewd' },
        'lesbian': { api: 'nekos.life', endpoint: 'lesbian' },
        'feet': { api: 'nekos.life', endpoint: 'feet' },
        'futanari': { api: 'nekos.life', endpoint: 'futanari' },
        'solo': { api: 'nekos.life', endpoint: 'solo' },
        'gasm': { api: 'nekos.life', endpoint: 'gasm' },
        'spank': { api: 'nekos.life', endpoint: 'spank' },
        'anal': { api: 'nekos.life', endpoint: 'anal' },
        'kuni': { api: 'nekos.life', endpoint: 'kuni' },
        'classic': { api: 'nekos.life', endpoint: 'classic' },
        'ngif': { api: 'nekos.life', endpoint: 'ngif' },
        'erok': { api: 'nekos.life', endpoint: 'erok' },
        'erofeet': { api: 'nekos.life', endpoint: 'erofeet' },
        'fox_girl': { api: 'nekos.life', endpoint: 'fox_girl' },
        'kemonomimi': { api: 'nekos.life', endpoint: 'kemonomimi' },
        'wallpaper': { api: 'nekos.life', endpoint: 'wallpaper' },
        'tickle': { api: 'nekos.life', endpoint: 'tickle' },
        'eroyuri': { api: 'nekos.life', endpoint: 'eroyuri' },
        'eron': { api: 'nekos.life', endpoint: 'eron' },
        'bj': { api: 'nekos.life', endpoint: 'bj' },
        'nsfw_neko_gif': { api: 'nekos.life', endpoint: 'nsfw_neko_gif' },
        'nsfw_avatar': { api: 'nekos.life', endpoint: 'nsfw_avatar' },
        'feetg': { api: 'nekos.life', endpoint: 'feetg' },
        'holoero': { api: 'nekos.life', endpoint: 'holoero' },
        'holo': { api: 'nekos.life', endpoint: 'holo' },
        'lewdk': { api: 'nekos.life', endpoint: 'lewdk' },
        'solog': { api: 'nekos.life', endpoint: 'solog' },
        'lewdkemo': { api: 'nekos.life', endpoint: 'lewdkemo' },
        'hass': { api: 'nekobot', endpoint: 'hass' },
        'hboobs': { api: 'nekobot', endpoint: 'hboobs' },
        'hanal': { api: 'nekobot', endpoint: 'hanal' },
        'pgif': { api: 'nekobot', endpoint: 'pgif' },
        '4k': { api: 'nekobot', endpoint: '4k' },
        'hneko': { api: 'nekobot', endpoint: 'hneko' },
        'hkitsune': { api: 'nekobot', endpoint: 'hkitsune' },
        'gonewild': { api: 'nekobot', endpoint: 'gonewild' },
        'kanna': { api: 'nekobot', endpoint: 'kanna' },
        'ass': { api: 'nekobot', endpoint: 'ass' },
        'thigh': { api: 'nekobot', endpoint: 'thigh' },
        'hthigh': { api: 'nekobot', endpoint: 'hthigh' },
        'paizuri': { api: 'nekobot', endpoint: 'paizuri' },
        'tentacle': { api: 'nekobot', endpoint: 'tentacle' },
        'hmidriff': { api: 'nekobot', endpoint: 'hmidriff' },
        'yuri': { api: 'nekobot', endpoint: 'yuri' }
      };

      const fetchImage = async () => {
        if (category && categoryMap[category]) {
          const mapping = categoryMap[category];
          
          if (mapping.api === 'waifu.pics') {
            try {
              const res = await axios.get(`https://api.waifu.pics/nsfw/${mapping.endpoint}`, { timeout: 10000 });
              if (res.data?.url && !isBlockedContent(res.data.url)) {
                const imgStream = await axios.get(res.data.url, { responseType: "stream", timeout: 10000 });
                return imgStream.data;
              }
            } catch (e) {
              console.log(`waifu.pics ${category} failed`);
            }
          }
          
          else if (mapping.api === 'nekos.life') {
            try {
              const res = await axios.get(`https://nekos.life/api/v2/img/${mapping.endpoint}`, { timeout: 10000 });
              if (res.data?.url && !isBlockedContent(res.data.url)) {
                const imgStream = await axios.get(res.data.url, { responseType: "stream", timeout: 10000 });
                return imgStream.data;
              }
            } catch (e) {
              console.log(`nekos.life ${category} failed`);
            }
          }
          
          else if (mapping.api === 'nekobot') {
            try {
              const res = await axios.get(`https://nekobot.xyz/api/image?type=${mapping.endpoint}`, { timeout: 10000 });
              if (res.data?.message && !isBlockedContent(res.data.message)) {
                const imgStream = await axios.get(res.data.message, { responseType: "stream", timeout: 10000 });
                return imgStream.data;
              }
            } catch (e) {
              console.log(`nekobot ${category} failed`);
            }
          }
        }
        
        const waifuPicsCategories = ['waifu', 'neko', 'blowjob'];
        
        try {
          const randomCat = waifuPicsCategories[Math.floor(Math.random() * waifuPicsCategories.length)];
          const res = await axios.get(`https://api.waifu.pics/nsfw/${randomCat}`, { timeout: 10000 });
          if (res.data?.url && !isBlockedContent(res.data.url)) {
            const imgStream = await axios.get(res.data.url, { responseType: "stream", timeout: 10000 });
            return imgStream.data;
          }
        } catch (e) {
          console.log("waifu.pics random failed");
        }

        const nekosEndpoints = ['hentai', 'boobs', 'tits', 'blowjob', 'cum', 'pussy', 'lewd', 'lesbian'];
        for (const endpoint of nekosEndpoints) {
          try {
            const res = await axios.get(`https://nekos.life/api/v2/img/${endpoint}`, { timeout: 8000 });
            if (res.data?.url && !isBlockedContent(res.data.url)) {
              const imgStream = await axios.get(res.data.url, { responseType: "stream", timeout: 10000 });
              return imgStream.data;
            }
          } catch (e) {
            continue;
          }
        }

        const nekoBotTypes = ['hentai', 'hass', 'hboobs', 'hanal', 'pgif', '4k', 'yuri', 'neko'];
        for (const type of nekoBotTypes) {
          try {
            const res = await axios.get(`https://nekobot.xyz/api/image?type=${type}`, { timeout: 8000 });
            if (res.data?.message && !isBlockedContent(res.data.message)) {
              const imgStream = await axios.get(res.data.message, { responseType: "stream", timeout: 10000 });
              return imgStream.data;
            }
          } catch (e) {
            continue;
          }
        }
        
        throw new Error("All APIs failed");
      };

      while (images.length < num && attempts < maxAttempts) {
        attempts++;
        try {
          const img = await fetchImage();
          if (img) {
            images.push(img);
          }
        } catch (err) {
          console.log(`Attempt ${attempts} failed:`, err.message);
        }
      }

      if (images.length === 0) {
        throw new Error("Could not fetch any images");
      }

      const filterNote = images.length < num ? ` (filtered ${num - images.length})` : '';
      const catText = category ? `[${category}]` : '[random]';
      await message.reply({
        body: `**HENTAI GENERATED!** ${catText} (${images.length} image${images.length !== 1 ? 's' : ''})${filterNote}\nStraight content only~ (NSFW 18+)`,
        attachment: images
      });

    } catch (err) {
      console.error("Hentai fetch error:", err?.message || err);
      await message.reply("Failed to fetch images.\nAPI might be down or category invalid.\nTry: +hentai 5 waifu");
    }
  }
};
