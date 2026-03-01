const moment = require("moment-timezone");

// -Possible resource types for discovered locations
const DISCOVERY_RESOURCES = {
  // Ultra Rare Discoveries (Very valuable)
  ultra_rare: [
    { name: "Meteorite Impact Site", emoji: "☄️", rarityBoost: { ultra: 30, rare: 35, uncommon: 20, common: 15 } },
    { name: "Ancient Volcano Crater", emoji: "🌋", rarityBoost: { ultra: 28, rare: 32, uncommon: 25, common: 15 } },
    { name: "Crystal Cavern", emoji: "💠", rarityBoost: { ultra: 32, rare: 30, uncommon: 23, common: 15 } },
    { name: "Prehistoric Seabed", emoji: "🦴", rarityBoost: { ultra: 25, rare: 35, uncommon: 25, common: 15 } }
  ],
  
  // Rare Discoveries (Great finds)
  rare: [
    { name: "Underground Lake", emoji: "🌊", rarityBoost: { ultra: 18, rare: 30, uncommon: 32, common: 20 } },
    { name: "Geothermal Vents", emoji: "♨️", rarityBoost: { ultra: 20, rare: 28, uncommon: 30, common: 22 } },
    { name: "Fossil Beds", emoji: "🦕", rarityBoost: { ultra: 15, rare: 32, uncommon: 33, common: 20 } },
    { name: "Glacier Deposits", emoji: "🧊", rarityBoost: { ultra: 17, rare: 30, uncommon: 31, common: 22 } }
  ],
  
  // Uncommon Discoveries (Good finds)
  uncommon: [
    { name: "Mountain Ridge", emoji: "⛰️", rarityBoost: { ultra: 10, rare: 25, uncommon: 38, common: 27 } },
    { name: "Desert Oasis", emoji: "🏜️", rarityBoost: { ultra: 12, rare: 23, uncommon: 40, common: 25 } },
    { name: "Jungle Clearing", emoji: "🌴", rarityBoost: { ultra: 8, rare: 22, uncommon: 42, common: 28 } },
    { name: "Coastal Cliffs", emoji: "🏖️", rarityBoost: { ultra: 11, rare: 24, uncommon: 39, common: 26 } }
  ],
  
  // Common Discoveries (Basic finds)
  common: [
    { name: "Forest Valley", emoji: "🌲", rarityBoost: { ultra: 6, rare: 18, uncommon: 36, common: 40 } },
    { name: "Grassland Plains", emoji: "🌾", rarityBoost: { ultra: 5, rare: 17, uncommon: 38, common: 40 } },
    { name: "River Delta", emoji: "🏞️", rarityBoost: { ultra: 7, rare: 19, uncommon: 34, common: 40 } },
    { name: "Rocky Plateau", emoji: "🗻", rarityBoost: { ultra: 6, rare: 18, uncommon: 36, common: 40 } }
  ]
};

module.exports = {
  config: {
    name: "discovermine",
    aliases: ["exploremine", "searchmine"],
    version: "1.0",
    author: "CharlesMK",
    countDown: 10,
    role: 0,
    shortDescription: "Discover new mining locations",
    longDescription: "Search for undiscovered mining locations. 5% success rate. Owner earns from all miners.",
    category: "economy",
    guide: {
      en: "{pn} - Attempt to discover a new location ($100,000)\n" +
          "{pn} owned - View your discovered locations\n" +
          "{pn} earnings - View earnings from your locations\n" +
          "{pn} info <location_id> - View discovered location details\n" +
          "{pn} collect - Collect earnings from your locations"
    }
  },

  langs: {
    en: {
      discoveryAttempt: "🔍 𝗦𝗘𝗔𝗥𝗖𝗛𝗜𝗡𝗚 𝗙𝗢𝗥 𝗟𝗢𝗖𝗔𝗧𝗜𝗢𝗡𝗦\n━━━━━━━━━━━━━━━━━━\n\n🗺️ 𝖲𝖼𝖺𝗇𝗇𝗂𝗇𝗀 𝗎𝗇𝖾𝗑𝗉𝗅𝗈𝗋𝖾𝖽 𝖺𝗋𝖾𝖺𝗌...\n💰 𝖢𝗈𝗌𝗍: $100,000\n🎲 𝖲𝗎𝖼𝖼𝖾𝗌𝗌 𝖱𝖺𝗍𝖾: 5%\n\n⏳ 𝖯𝗋𝗈𝖼𝖾𝗌𝗌𝗂𝗇𝗀...",
      
      discoverySuccess: "🎉 𝗗𝗜𝗦𝗖𝗢𝗩𝗘𝗥𝗬 𝗦𝗨𝗖𝗖𝗘𝗦𝗦!\n━━━━━━━━━━━━━━━━━━\n\n%1 %2\n🆔 𝗟𝗼𝗰𝗮𝗍𝗶𝗼𝗻 𝗜𝗗: %3\n🎯 𝗧𝗶𝗲𝗿: %4\n\n💎 𝗥𝗮𝗿𝗶𝘁𝘆 𝗕𝗼𝗻𝘂𝘀:\n   🌟 Ultra: %5%\n   ⭐ Rare: %6%\n   ✨ Uncommon: %7%\n   📦 Common: %8%\n\n👑 𝗬𝗼𝘂 𝗮𝗿𝗲 𝘁𝗵𝗲 𝗼𝘄𝗻𝗲𝗿!\n💰 𝖸𝗈𝗎 𝖾𝖺𝗋𝗇 80%% 𝖿𝗋𝗈𝗆 𝖺𝗅𝗅 𝗆𝗂𝗇𝖾𝗋𝗌 𝗁𝖾𝗋𝖾\n\n💡 𝖭𝖺𝗆𝖾 𝗒𝗈𝗎𝗋 𝗅𝗈𝖼𝖺𝗍𝗂𝗈𝗇:\n   +name %3 <your_name>\n━━━━━━━━━━━━━━━━━━",
      
      discoveryFailed: "❌ 𝗗𝗜𝗦𝗖𝗢𝗩𝗘𝗥𝗬 𝗙𝗔𝗜𝗟𝗘𝗗\n━━━━━━━━━━━━━━━━━━\n\n🗺️ 𝖭𝗈 𝗏𝗂𝖺𝖻𝗅𝖾 𝗆𝗂𝗇𝗂𝗇𝗀 𝗅𝗈𝖼𝖺𝗍𝗂𝗈𝗇 𝖿𝗈𝗎𝗇𝖽\n💸 𝖫𝗈𝗌𝗍: $100,000\n🎲 𝖲𝗎𝖼𝖼𝖾𝗌𝗌 𝖱𝖺𝗍𝖾: 5%%\n\n💡 𝖳𝗋𝗒 𝖺𝗀𝖺𝗂𝗇! 𝖤𝖺𝖼𝗁 𝖺𝗍𝗍𝖾𝗆𝗉𝗍 𝗂𝗌 𝗂𝗇𝖽𝖾𝗉𝖾𝗇𝖽𝖾𝗇𝗍.\n━━━━━━━━━━━━━━━━━━",
      
      ownedLocations: "🏆 𝗬𝗢𝗨𝗥 𝗗𝗜𝗦𝗖𝗢𝗩𝗘𝗥𝗘𝗗 𝗟𝗢𝗖𝗔𝗧𝗜𝗢𝗡𝗦\n━━━━━━━━━━━━━━━━━━\n\n%1\n\n💰 𝗧𝗼𝘁𝗮𝗹 𝗘𝗮𝗿𝗻𝗶𝗻𝗴𝘀: $%2\n📊 𝗟𝗼𝗰𝗮𝘁𝗶𝗼𝗻𝘀 𝗢𝘄𝗻𝗲𝗱: %3\n\n💡 𝖴𝗌𝖾 +discover collect 𝗍𝗈 𝖼𝗅𝖺𝗂𝗆\n━━━━━━━━━━━━━━━━━━",
      
      noOwnedLocations: "📦 𝗡𝗢 𝗗𝗜𝗦𝗖𝗢𝗩𝗘𝗥𝗜𝗘𝗦 𝗬𝗘𝗧\n━━━━━━━━━━━━━━━━━━\n\n🔍 𝖸𝗈𝗎 𝗁𝖺𝗏𝖾𝗇'𝗍 𝖽𝗂𝗌𝖼𝗈𝗏𝖾𝗋𝖾𝖽 𝖺𝗇𝗒 𝗅𝗈𝖼𝖺𝗍𝗂𝗈𝗇𝗌 𝗒𝖾𝗍\n\n💡 𝖴𝗌𝖾 +discover 𝗍𝗈 𝗌𝖾𝖺𝗋𝖼𝗁 ($100,000)\n🎲 5%% 𝖼𝗁𝖺𝗇𝖼𝖾 𝗍𝗈 𝖿𝗂𝗇𝖽 𝗇𝖾𝗐 𝗅𝗈𝖼𝖺𝗍𝗂𝗈𝗇𝗌\n👑 𝖤𝖺𝗋𝗇 80%% 𝖿𝗋𝗈𝗆 𝖺𝗅𝗅 𝗆𝗂𝗇𝖾𝗋𝗌 𝗍𝗁𝖾𝗋𝖾!\n━━━━━━━━━━━━━━━━━━",
      
      earningsCollected: "💰 𝗘𝗔𝗥𝗡𝗜𝗡𝗚𝗦 𝗖𝗢𝗟𝗟𝗘𝗖𝗧𝗘𝗗\n━━━━━━━━━━━━━━━━━━\n\n💵 𝖢𝗈𝗅𝗅𝖾𝖼𝗍𝖾𝖽: $%1\n💳 𝖭𝖾𝗐 𝖡𝖺𝗅𝖺𝗇𝖼𝖾: $%2\n\n🏆 𝖥𝗋𝗈𝗆 %3 𝗅𝗈𝖼𝖺𝗍𝗂𝗈𝗇(𝗌)\n━━━━━━━━━━━━━━━━━━",
      
      noEarnings: "📊 𝗡𝗢 𝗘𝗔𝗥𝗡𝗜𝗡𝗚𝗦 𝗬𝗘𝗧\n━━━━━━━━━━━━━━━━━━\n\n💰 𝖸𝗈𝗎 𝗁𝖺𝗏𝖾 $0 𝗍𝗈 𝖼𝗈𝗅𝗅𝖾𝖼𝗍\n\n💡 𝖮𝗍𝗁𝖾𝗋 𝗉𝗅𝖺𝗒𝖾𝗋𝗌 𝗆𝗎𝗌𝗍 𝗆𝗂𝗇𝖾 𝖺𝗍 𝗒𝗈𝗎𝗋 𝗅𝗈𝖼𝖺𝗍𝗂𝗈𝗇𝗌\n🌍 𝖴𝗌𝖾 +discover owned 𝗍𝗈 𝗌𝖾𝖾 𝗒𝗈𝗎𝗋 𝗅𝗈𝖼𝖺𝗍𝗂𝗈𝗇𝗌\n━━━━━━━━━━━━━━━━━━",
      
      insufficientFunds: "❌ 𝗜𝗡𝗦𝗨𝗙𝗙𝗜𝗖𝗜𝗘𝗡𝗧 𝗙𝗨𝗡𝗗𝗦\n━━━━━━━━━━━━━━━━━━\n\n💰 𝖢𝗈𝗌𝗍: $100,000\n💵 𝖸𝗈𝗎𝗋 𝖡𝖺𝗅𝖺𝗇𝖼𝖾: $%1\n📊 𝖭𝖾𝖾𝖽𝖾𝖽: $%2\n\n💡 𝖬𝗂𝗇𝖾 𝗆𝗈𝗋𝖾 𝗍𝗈 𝖾𝖺𝗋𝗇 𝗆𝗈𝗇𝖾𝗒!\n━━━━━━━━━━━━━━━━━━",
      
      locationInfo: "%1 %2\n━━━━━━━━━━━━━━━━━━\n\n🆔 𝗟𝗼𝗰𝗮𝘁𝗶𝗼𝗻 𝗜𝗗: %3\n👑 𝗢𝘄𝗻𝗲𝗿: %4\n🎯 𝗧𝗶𝗲𝗿: %5\n📅 𝗗𝗶𝘀𝗰𝗼𝘃𝗲𝗿𝗲𝗱: %6\n\n💎 𝗥𝗮𝗿𝗶𝘁𝘆 𝗕𝗼𝗻𝘂𝘀:\n   🌟 Ultra: %7%\n   ⭐ Rare: %8%\n   ✨ Uncommon: %9%\n   📦 Common: %10%\n\n📊 𝗦𝘁𝗮𝘁𝘀:\n   ⛏️ Total Mines: %11\n   💰 Total Earned: $%12\n\n💡 𝖴𝗌𝖾: +travel %3\n━━━━━━━━━━━━━━━━━━",
      
      locationNotFound: "❌ 𝖫𝗈𝖼𝖺𝗍𝗂𝗈𝗇 𝗇𝗈𝗍 𝖿𝗈𝗎𝗇𝖽!\n\n💡 𝖴𝗌𝖾 +discover owned 𝗍𝗈 𝗌𝖾𝖾 𝗒𝗈𝗎𝗋 𝗅𝗈𝖼𝖺𝗍𝗂𝗈𝗇𝗌"
    }
  },

  onStart: async function ({ message, args, event, usersData, getLang, globalData }) {
    const { senderID } = event;
    const userData = await usersData.get(senderID);

    // Initialize discovery data globally
    if (!global.discoveredLocations) {
      global.discoveredLocations = {};
    }

    // Initialize user discovery data
    if (!userData.data.discoveries) {
      userData.data.discoveries = {
        ownedLocations: [],
        pendingEarnings: 0,
        totalEarnings: 0,
        totalDiscoveries: 0
      };
    }

    const discoveryData = userData.data.discoveries;

    // Show owned locations
    if (args[0] === "owned") {
      if (discoveryData.ownedLocations.length === 0) {
        return message.reply(getLang("noOwnedLocations"));
      }

      let locationsList = "";
      discoveryData.ownedLocations.forEach(locId => {
        const loc = global.discoveredLocations[locId];
        if (loc) {
          const tierEmoji = getTierEmoji(loc.tier);
          locationsList += `${tierEmoji} ${loc.emoji} ${loc.customName || loc.baseName}\n`;
          locationsList += `   🆔 ${locId} | ⛏️ ${loc.totalMines} mines\n`;
          locationsList += `   💰 Earned: $${loc.ownerEarnings.toLocaleString()}\n\n`;
        }
      });

      return message.reply(
        getLang("ownedLocations",
          locationsList.trim(),
          discoveryData.totalEarnings.toLocaleString(),
          discoveryData.ownedLocations.length
        )
      );
    }

    // Collect earnings
    if (args[0] === "collect") {
      if (discoveryData.pendingEarnings <= 0) {
        return message.reply(getLang("noEarnings"));
      }

      const earnings = discoveryData.pendingEarnings;
      discoveryData.pendingEarnings = 0;

      await usersData.set(senderID, {
        money: userData.money + earnings,
        data: userData.data
      });

      return message.reply(
        getLang("earningsCollected",
          earnings.toLocaleString(),
          (userData.money + earnings).toLocaleString(),
          discoveryData.ownedLocations.length
        )
      );
    }

    // Show location info
    if (args[0] === "info" && args[1]) {
      const locId = args[1].toLowerCase();
      const location = global.discoveredLocations[locId];

      if (!location) {
        return message.reply(getLang("locationNotFound"));
      }

      const ownerData = await usersData.get(location.ownerId);
      const ownerName = ownerData.name || "Unknown";
      const discoveryDate = moment(location.discoveredAt).format("MMM DD, YYYY");

      return message.reply(
        getLang("locationInfo",
          location.emoji,
          location.customName || location.baseName,
          locId,
          ownerName,
          location.tier.toUpperCase(),
          discoveryDate,
          location.rarityBoost.ultra,
          location.rarityBoost.rare,
          location.rarityBoost.uncommon,
          location.rarityBoost.common,
          location.totalMines,
          location.ownerEarnings.toLocaleString()
        )
      );
    }

    // Attempt discovery
    const DISCOVERY_COST = 100000;
    const SUCCESS_RATE = 5; // 5%

    if (userData.money < DISCOVERY_COST) {
      return message.reply(
        getLang("insufficientFunds",
          userData.money.toLocaleString(),
          (DISCOVERY_COST - userData.money).toLocaleString()
        )
      );
    }

    // Send attempt message
    await message.reply(getLang("discoveryAttempt"));

    // Deduct cost
    await usersData.set(senderID, {
      money: userData.money - DISCOVERY_COST,
      data: userData.data
    });

    // Wait for suspense
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Roll for success
    const roll = Math.random() * 100;

    if (roll > SUCCESS_RATE) {
      // Failed discovery
      return message.reply(getLang("discoveryFailed"));
    }

    // SUCCESS! Determine tier
    const tierRoll = Math.random() * 100;
    let tier = "common";
    let tierType = "common";

    if (tierRoll <= 2) {
      tier = "legendary";
      tierType = "ultra_rare";
    } else if (tierRoll <= 10) {
      tier = "ultra";
      tierType = "ultra_rare";
    } else if (tierRoll <= 30) {
      tier = "rare";
      tierType = "rare";
    } else if (tierRoll <= 60) {
      tier = "uncommon";
      tierType = "uncommon";
    } else {
      tier = "common";
      tierType = "common";
    }

    // Select random location type
    const possibleLocations = DISCOVERY_RESOURCES[tierType];
    const selectedLocation = possibleLocations[Math.floor(Math.random() * possibleLocations.length)];

    // Generate unique ID
    const locationId = `user_${senderID}_${Date.now()}`;

    // Create location
    const newLocation = {
      id: locationId,
      baseName: selectedLocation.name,
      customName: null,
      emoji: selectedLocation.emoji,
      rarityBoost: selectedLocation.rarityBoost,
      tier: tier,
      ownerId: senderID,
      ownerName: userData.name,
      discoveredAt: Date.now(),
      totalMines: 0,
      ownerEarnings: 0,
      distance: Math.floor(Math.random() * 15000) + 5000 // Random distance 5000-20000km
    };

    // Save to global
    global.discoveredLocations[locationId] = newLocation;

    // Save to user data
    discoveryData.ownedLocations.push(locationId);
    discoveryData.totalDiscoveries += 1;

    await usersData.set(senderID, {
      data: userData.data
    });

    // Success message
    return message.reply(
      getLang("discoverySuccess",
        selectedLocation.emoji,
        selectedLocation.name,
        locationId,
        tier.toUpperCase(),
        selectedLocation.rarityBoost.ultra,
        selectedLocation.rarityBoost.rare,
        selectedLocation.rarityBoost.uncommon,
        selectedLocation.rarityBoost.common
      )
    );
  }
};

// Helper function
function getTierEmoji(tier) {
  const emojis = {
    legendary: "⭐",
    ultra: "🌟",
    rare: "⭐",
    uncommon: "✨",
    common: "📦"
  };
  return emojis[tier] || "📦";
}
