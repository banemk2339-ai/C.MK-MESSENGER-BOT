const axios = require("axios");
const fs = require("fs");
const path = require("path");

const GoatMart = "https://goatmart.vercel.app";

module.exports = {
  config: {
    name: "goatmart",
    aliases: ["gm"],
    shortDescription: { en: "🌟 GoatMart - Your Command Marketplace" },
    longDescription: { en: "✨ Browse, search, upload, and manage commands in the GoatMart marketplace." },
    category: "utility",
    version: "2.2",
    role: 0,
    author: "aryan",
    cooldowns: 0,
  },

  onStart: async ({ api, event, args, message }) => {
    const a = (content) => {
      const h = "╭───『 🐐 𝗚𝗼𝗮𝘁𝗠𝗮𝗿𝘁 』───╮\n";
      const f = "\n╰─────────────╯";
      return message.reply(h + content + f);
    };

    const b = (error, action) => {
      console.error(`GoatMart ${action} error:`, error);

      if (error.response?.status === 503) return a("\n🚧 Service under maintenance. Please try again later.");
      if (error.response?.status === 404) return a(`\n❌ Not found: The requested resource doesn't exist.`);
      if (error.response?.status === 500) return a(`\n⚠️ Server error: Please try again in a few moments.`);

      if (["ECONNREFUSED", "ENOTFOUND"].includes(error.code)) {
        return a(`\n🔌 Connection error: Cannot reach GoatMart server.\nPlease check: ${GoatMart}`);
      }

      if (error.response?.data?.maintenanceMode) {
        return a(`\n🚧 ${error.response.data.title}\n💬 ${error.response.data.message}\n` +
          (error.response.data.estimatedTime ? `⏰ Estimated: ${error.response.data.estimatedTime}` : ""));
      }

      return a(`\n❌ Error: Unable to ${action}.\nStatus: ${error.response?.status || "Unknown"}\nMessage: ${error.response?.data?.error || error.message || "Unknown error"}`);
    };

    try {
      if (!args[0]) {
        return a(
          "\n📋 𝗔𝘃𝗮𝗶𝗹𝗮𝗯𝗹𝗲 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝘀:\n\n" +
          `📦 ${event.body} show <ID>\n📄 ${event.body} page <number>\n🔍 ${event.body} search <query>\n📊 ${event.body} stats\n⬆️ ${event.body} upload <name>\n🔗 ${event.body} raw <ID>\n🎯 ${event.body} trending\n🔧 ${event.body} maintenance\n💡 Example: ${event.body} show 1`
        );
      }

      const c = args[0].toLowerCase();

      switch (c) {
        case "show": {
          const d = parseInt(args[1]);
          if (isNaN(d)) return a("\n⚠️ Please provide a valid item ID.");
          try {
            const e = await axios.get(`${GoatMart}/api/item/${d}`);
            const f = e.data;
            return a(`\n📦 Name: ${f.itemName}\n🆔 ID: ${f.itemID}\n⚙️ Type: ${f.type}\n📝 Desc: ${f.description}\n👨‍💻 Author: ${f.authorName}\n📅 Added: ${new Date(f.createdAt).toLocaleDateString()}\n👀 Views: ${f.views}\n💝 Likes: ${f.likes}\n📄 Raw: ${f.rawLink}\n🔗 View: ${GoatMart}/view?id=${f.itemID}`);
          } catch (err) {
            if (err.response?.status === 404) return a("\n❌ Command not found.");
            return b(err, "fetch command");
          }
        }

        case "get": 
        case "lookup": {
          const id = args[1];
          if (!id) return a("\n⚠️ Please provide a command ID (can be numeric or short ID).");
          try {
            const response = await axios.get(`${GoatMart}/api/lookup/${encodeURIComponent(id)}`);
            const f = response.data;
            return a(`\n📦 Name: ${f.itemName}\n🆔 ID: ${f.itemID} | 🔤 Short: ${f.shortId}\n📊 Sequential: ${f.sequentialId}\n⚙️ Type: ${f.type}\n📝 Desc: ${f.description}\n👨‍💻 Author: ${f.authorName}\n📅 Added: ${new Date(f.createdAt).toLocaleDateString()}\n👀 Views: ${f.views}\n💝 Likes: ${f.likes}\n📄 Raw: ${f.rawLink}\n🔗 View: ${GoatMart}/view?id=${f.itemID}`);
          } catch (err) {
            if (err.response?.status === 404) return a("\n❌ Command not found.");
            return b(err, "lookup command");
          }
        }

        case "page": {
          const g = parseInt(args[1]) || 1;
          if (g <= 0) return a("\n⚠️ Page number must be greater than 0.");

          try {
            const h = await axios.get(`${GoatMart}/api/items?page=${g}&limit=20`);
            const { items, total, totalPages } = h.data;

            if (g > totalPages && totalPages > 0) return a(`\n⚠️ Page ${g} doesn't exist. Total: ${totalPages}`);
            if (!items.length) return a("\n📭 No commands found.");

            const i = items.map((x, y) =>
              `${(g - 1) * 20 + y + 1}. 📦 ${x.itemName} (ID: ${x.itemID})\n 👀 ${x.views} | 💝 ${x.likes} | 👨‍💻 ${x.authorName}`
            ).join("\n\n");

            return a(`\n📄 Page ${g}/${totalPages} (${total} total)\n\n${i}\n\n💡 Use "${event.body} show <ID>"`);
          } catch (err) {
            return b(err, "browse commands");
          }
        }

        case "search": {
          const j = args.slice(1).join(" ");
          if (!j) return a("\n⚠️ Please provide a search query.");

          try {
            const k = await axios.get(`${GoatMart}/api/items?search=${encodeURIComponent(j)}&limit=8`);
            const results = k.data.items;
            if (!results.length) return a(`\n❌ No commands found for "${j}"`);

            const l = results.map((x, y) =>
              `${y + 1}. 📦 ${x.itemName} (ID: ${x.itemID})\n 👀 ${x.views} | 💝 ${x.likes} | 👨‍💻 ${x.authorName}`
            ).join("\n\n");

            return a(`\n🔍 Search: "${j}" (${k.data.total} results)\n\n${l}` +
              (k.data.total > 8 ? `\n\n📄 Showing top 8 results` : ""));
          } catch (err) {
            return b(err, "search commands");
          }
        }

        case "trending": {
          try {
            const m = await axios.get(`${GoatMart}/api/trending`);
            const trending = m.data;
            if (!trending.length) return a("\n📭 No trending commands found.");

            const trendingList = trending.map((x, y) =>
              `${y + 1}. 📦 ${x.itemName} (ID: ${x.itemID || 'N/A'})\n 👀 ${x.views} | 💝 ${x.likes} | 👨‍💻 ${x.authorName}`
            ).join("\n\n");

            return a(`\n🔥 Trending Commands:\n\n${trendingList}`);
          } catch (err) {
            return b(err, "fetch trending");
          }
        }

        case "raw": {
          const id = args[1];
          if (!id) return a("\n⚠️ Please provide a command ID or short ID.");
          try {
            let rawUrl;
            if (/^\d+$/.test(id)) {
              rawUrl = `${GoatMart}/raw/seq/${id}`;
            } else {
              rawUrl = `${GoatMart}/raw/${id}`;
            }
            
            const response = await axios.get(rawUrl);
            const codeLines = response.data.split('\n').length;
            return a(`\n📄 Raw code retrieved!\n🔗 URL: ${rawUrl}\n📊 Lines: ${codeLines}\n\n💡 Copy the URL to download the code`);
          } catch (err) {
            if (err.response?.status === 404) return a("\n❌ Command not found.");
            return b(err, "fetch raw code");
          }
        }

        case "maintenance": {
          try {
            const status = await axios.get(`${GoatMart}/api/maintenance`);
            const maintenance = status.data;
            if (maintenance.enabled) {
              return a(`\n🚧 Maintenance Mode: ACTIVE\n📝 Title: ${maintenance.title}\n💬 Message: ${maintenance.message}\n${maintenance.estimatedTime ? `⏰ Estimated: ${maintenance.estimatedTime}` : ''}`);
            } else {
              return a(`\n✅ Maintenance Mode: DISABLED\n🎉 All services operational!`);
            }
          } catch (err) {
            return b(err, "check maintenance status");
          }
        }

        case "stats": {
          try {
            const m = await axios.get(`${GoatMart}/api/stats`);
            const n = m.data;
            return a(`\n📊 Platform Stats\n\n📦 Commands: ${n.totalCommands || 0}\n💝 Total Likes: ${n.totalLikes || 0}\n👥 Daily Users: ${n.dailyActiveUsers || 0}\n📈 Total Views: ${n.totalViews || 0}\n📤 Total Uploads: ${n.totalUploads || 0}\n🔗 Total Requests: ${n.totalRequests || 0}\n⏰ Uptime: ${n.hosting?.uptime ? `${n.hosting.uptime.days}d ${n.hosting.uptime.hours}h` : "N/A"}\n💾 Memory: ${n.hosting?.memory ? `${Math.round(n.hosting.memory.heapUsed)}MB used` : "N/A"}\n🌟 Top Author: ${n.topAuthors?.[0]?._id || "N/A"}\n🔥 Most Viewed: ${n.topViewed?.[0]?.itemName || "N/A"}`);
          } catch (err) {
            return b(err, "fetch statistics");
          }
        }

        case "like": {
          const itemId = parseInt(args[1]);
          if (isNaN(itemId)) return a("\n⚠️ Please provide a valid item ID to like.");
          try {
            const response = await axios.post(`${GoatMart}/api/items/${itemId}/like`);
            return a(`\n💝 Command liked successfully!\n👍 Total likes: ${response.data.likes}`);
          } catch (err) {
            if (err.response?.status === 404) return a("\n❌ Command not found.");
            return b(err, "like command");
          }
        }

        case "upload": {
          const o = event.senderID;
          const p = global.GoatBot?.config?.adminBot || [];
          if (!p.includes(o)) return a("🚫 Only bot administrators can upload commands.");

          const q = args[1];
          if (!q) return a("⚠️ Provide a command filename to upload.");
          const r = path.join(__dirname, q.endsWith(".js") ? q : `${q}.js`);
          if (!fs.existsSync(r)) return a(`❌ File not found: ${r}`);

          try {
            const s = fs.readFileSync(r, "utf-8");
            let t;
            try {
              t = require(r);
            } catch {
              return a("❌ Unable to parse command file.");
            }

            const u = {
              itemName: t.config?.name || q,
              description: t.config?.longDescription?.en || t.config?.shortDescription?.en || "Bot command from GoatBot.",
              type: "GoatBot",
              code: s,
              authorName: t.config?.author || "Anonymous",
              tags: ["goatbot", "command"],
              difficulty: "Intermediate",
            };

            const v = await axios.post(`${GoatMart}/api/items`, u, { headers: { "Content-Type": "application/json" } });
            const { success, shortId, itemId, message: responseMessage } = v.data;
            if (!success) return a("❌ Upload failed. Try again later.");

            return a(`✅ Upload Success!\n\n📦 Name: ${u.itemName}\n🧑 Author: ${u.authorName}\n📄 Lines: ${s.split("\n").length}\n\n🆔 ID: ${itemId}\n🔐 Short ID: ${shortId}\n\n🔗 Raw: ${GoatMart}/raw/${shortId}\n🌐 View: ${GoatMart}/view?id=${itemId}`);
          } catch (err) {
            console.error("Upload error:", err);
            return a("❌ Upload failed due to server error.");
          }
        }

        default:
          return a(`\n⚠️ Unknown command: "${c}"\n\n💡 Use "${event.body}" to see all available options.`);
      }
    } catch (err) {
      console.error("GoatMart Error:", err);
      return a("\n❌ An unexpected error occurred. Please try again later.");
    }
  }
};
