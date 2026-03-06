const axios = require("axios");

// Tracks active quiz sessions per user: userID → sessionID
// When a session ends (stop/cheat/timeout with no answer), we remove it.
// getNextQuestion checks the session is still valid before proceeding.
const activeSessions = new Map();

function startSession(userID) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
  activeSessions.set(userID, id);
  return id;
}

function endSession(userID) {
  activeSessions.delete(userID);
}

function isSessionActive(userID, sessionID) {
  return activeSessions.get(userID) === sessionID;
}

module.exports = {
  config: {
    name: "quiz",
    aliases: ["q", "trivia"],
    version: "4.2.0",
    author: "Charles MK",
    countDown: 5,
    role: 0,
    description: "Quiz with Levels, Streaks, and Lifetime Stats. Anti-cheat enabled.",
    category: "game",
    guide: { en: "{pn} [category] | categories: geography, biology, sports, tv show, information technology, gaming, anime, history" }
  },

  onStart: async function({ message, event, args }) {
    const categoryMap = {
      "geography": 22, "biology": 17, "sports": 21, "tv show": 14,
      "information technology": 18, "gaming": 15, "anime": 31,
      "history": 23, "movies": 11, "music": 12
    };
    const input = args.join(" ").toLowerCase();
    const categoryId = categoryMap[input] || 9;
    const stats = { total: 0, correct: 0, incorrect: 0, sessionPoints: 0, streak: 0 };

    // End any previous session for this user before starting a new one
    endSession(event.senderID);
    const sessionID = startSession(event.senderID);

    return this.getNextQuestion(message, event, categoryId, stats, sessionID);
  },

  onReply: async function({ Reply, message, event, args, usersData, api }) {
    const { author, type, quizData, quizMessageID, categoryId, stats, sessionID } = Reply;
    if (author !== event.senderID) return;

    const userInput = args.join(" ").trim();
    const userInputLower = userInput.toLowerCase();
    const self = this;

    // ── STOP ─────────────────────────────────────────────────
    if (["stop", "end", "quit"].includes(userInputLower)) {
      global.GoatBot.onReply.delete(quizMessageID);
      endSession(event.senderID);
      const accuracy = stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(1) : 0;
      message.unsend(quizMessageID).catch(() => {});
      return message.reply(
        `🏁 𝗦𝗘𝗦𝗦𝗜𝗢𝗡 𝗘𝗡𝗗𝗘𝗗\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📝 𝗧𝗼𝘁𝗮𝗹: ${stats.total}\n` +
        `✅ 𝗖𝗼𝗿𝗿𝗲𝗰𝘁: ${stats.correct}\n` +
        `🎯 𝗔𝗰𝗰𝘂𝗿𝗮𝗰𝘆: ${accuracy}%\n` +
        `✨ 𝗦𝗲𝘀𝘀𝗶𝗼𝗻 𝗣𝘁𝘀: +${stats.sessionPoints}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━`
      );
    }

    // ── Anti-cheat ────────────────────────────────────────────
    const aiPatterns = [
      '@meta','@ai','@gpt','@chatgpt','@claude','@gemini',
      '@copilot','@bard','/meta','/ai','hey meta','meta ai',
      '@bing','@perplexity','hey google','@assistant'
    ];
    if (aiPatterns.some(p => userInputLower.includes(p))) {
      global.GoatBot.onReply.delete(quizMessageID);
      endSession(event.senderID);
      message.unsend(quizMessageID).catch(() => {});
      const currentUser = await usersData.get(event.senderID);
      await usersData.set(event.senderID, {
        ...currentUser,
        exp:   Math.max(0, (currentUser.exp   || 0) - 500),
        money: Math.max(0, (currentUser.money || 0) - 50000),
        data: {
          ...currentUser.data,
          cheaterFlag: (currentUser.data?.cheaterFlag || 0) + 1,
          lastCheatTime: Date.now()
        }
      });
      return message.reply(
        `🚨 𝗖𝗛𝗘𝗔𝗧 𝗗𝗘𝗧𝗘𝗖𝗧𝗘𝗗! 🚨\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Using AI assistance is prohibited!\n\n` +
        `⚠️ 𝗣𝗘𝗡𝗔𝗟𝗧𝗜𝗘𝗦:\n` +
        `❌ -500 EXP\n❌ -$50,000\n` +
        `🚫 Strike: ${(currentUser.data?.cheaterFlag || 0) + 1}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Play fair or don't play at all! 💪`
      );
    }

    if (type !== "answerQuiz") return;

    const answer = userInputLower.toUpperCase();
    if (!['A','B','C','D'].includes(answer)) return;

    // Late answer — timeout already fired
    if (!global.GoatBot.onReply.has(quizMessageID)) {
      return message.reply(`⏰ Too late! The time limit already passed for that question.`);
    }

    // Claim the entry immediately
    global.GoatBot.onReply.delete(quizMessageID);

    // ── Process answer ────────────────────────────────────────
    stats.total++;
    const isCorrect = answer === quizData.correctLetter;
    const currentUser = await usersData.get(event.senderID);

    if (isCorrect) {
      stats.correct++;
      stats.streak++;

      let pointGain = 10;
      let coinGain  = Math.floor(Math.random() * 501) + 500;
      if (stats.streak >= 3) {
        pointGain = Math.floor(pointGain * 1.5);
        coinGain  = Math.floor(coinGain  * 1.2);
      }
      stats.sessionPoints += pointGain;

      const newTotalPoints = (currentUser.data?.quizScore || 0) + pointGain;
      const level = newTotalPoints < 500  ? "Novice"      :
                    newTotalPoints < 2000 ? "Scholar"     :
                    newTotalPoints < 5000 ? "Professor"   : "Grandmaster";

      await usersData.set(event.senderID, {
        ...currentUser,
        money: (currentUser.money || 0) + coinGain,
        exp:   (currentUser.exp   || 0) + pointGain,
        data: {
          ...currentUser.data,
          quizScore:   newTotalPoints,
          quizTotal:   (currentUser.data?.quizTotal   || 0) + 1,
          quizCorrect: (currentUser.data?.quizCorrect || 0) + 1,
          quizLevel:   level
        }
      });

      await api.editMessage(
        `✅ 𝗖𝗢𝗥𝗥𝗘𝗖𝗧!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💰 +${coinGain} coins\n` +
        `⭐ +${pointGain} pts${stats.streak >= 3 ? ' (Streak! 🔥)' : ''}\n` +
        `🎓 𝗟𝗲𝘃𝗲𝗹: ${level}\n` +
        `📈 𝗦𝗲𝘀𝘀𝗶𝗼𝗻: ${stats.correct}/${stats.total}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━`,
        quizMessageID
      );
    } else {
      stats.incorrect++;
      stats.streak = 0;

      await usersData.set(event.senderID, {
        ...currentUser,
        data: {
          ...currentUser.data,
          quizTotal: (currentUser.data?.quizTotal || 0) + 1
        }
      });

      await api.editMessage(
        `❌ 𝗪𝗥𝗢𝗡𝗚\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `𝗖𝗼𝗿𝗿𝗲𝗰𝘁: ${quizData.correctLetter}. ${quizData.correctAnswer}\n` +
        `🔥 Streak lost!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━`,
        quizMessageID
      );
    }

    // Next question — session must still be active
    setTimeout(() => {
      if (!isSessionActive(event.senderID, sessionID)) return;
      self.getNextQuestion(message, event, categoryId, stats, sessionID);
    }, 2000);
  },

  onChat: async function({ message, event, usersData }) {
    const body = event.body?.toLowerCase() || "";
    const aiPatterns = [
      '@meta','@ai','@gpt','@chatgpt','@claude','@gemini',
      '@copilot','@bard','/meta','/ai','hey meta','meta ai',
      '@bing','@perplexity','hey google','@assistant'
    ];
    if (!aiPatterns.some(p => body.includes(p))) return;

    const hasActiveQuiz = Array.from(global.GoatBot.onReply.values()).some(
      r => r.author === event.senderID && r.commandName === "quiz"
    );
    if (!hasActiveQuiz) return;

    endSession(event.senderID);
    const currentUser = await usersData.get(event.senderID);
    await usersData.set(event.senderID, {
      ...currentUser,
      exp:   Math.max(0, (currentUser.exp   || 0) - 500),
      money: Math.max(0, (currentUser.money || 0) - 50000),
      data: {
        ...currentUser.data,
        cheaterFlag: (currentUser.data?.cheaterFlag || 0) + 1,
        lastCheatTime: Date.now()
      }
    });
    for (const [msgId, reply] of global.GoatBot.onReply.entries()) {
      if (reply.author === event.senderID && reply.commandName === "quiz")
        global.GoatBot.onReply.delete(msgId);
    }
    return message.reply(
      `🚨 𝗖𝗛𝗘𝗔𝗧 𝗗𝗘𝗧𝗘𝗖𝗧𝗘𝗗! 🚨\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Trying to use AI during a quiz?\n\n` +
      `⚠️ 𝗣𝗘𝗡𝗔𝗟𝗧𝗜𝗘𝗦:\n` +
      `❌ -500 EXP\n❌ -$50,000\n` +
      `🚫 Strike: ${(currentUser.data?.cheaterFlag || 0) + 1}\n` +
      `⛔ Quiz terminated\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Play fair! Use your own brain! 🧠`
    );
  },

  getNextQuestion: async function(message, event, categoryId, stats, sessionID) {
    const self = this;

    // Guard: don't send a question if the session was ended
    if (!isSessionActive(event.senderID, sessionID)) return;

    try {
      const res = await axios.get(
        `https://opentdb.com/api.php?amount=1&category=${categoryId}&type=multiple`
      );

      // Rate limit from OpenTDB — wait and retry, but only if session still active
      if (res.data.response_code === 5) {
        await new Promise(r => setTimeout(r, 5000));
        if (!isSessionActive(event.senderID, sessionID)) return;
        return self.getNextQuestion(message, event, categoryId, stats, sessionID);
      }

      // Session could have ended during the API call
      if (!isSessionActive(event.senderID, sessionID)) return;

      const data = res.data.results[0];
      const decode = str => str
        .replace(/&quot;/g, '"') .replace(/&#039;/g, "'")
        .replace(/&amp;/g,  "&") .replace(/&deg;/g,   "°")
        .replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"')
        .replace(/&rsquo;/g, "'").replace(/&lt;/g,    "<")
        .replace(/&gt;/g,   ">") .replace(/&laquo;/g, "«")
        .replace(/&raquo;/g, "»");

      const question     = decode(data.question);
      const correctAnswer = decode(data.correct_answer);
      const options = [...data.incorrect_answers.map(decode), correctAnswer]
        .sort(() => Math.random() - 0.5);

      const letters      = ["A","B","C","D"];
      const correctLetter = letters[options.indexOf(correctAnswer)];
      const optionsText  = options.map((opt, i) => `${letters[i]}. ${opt}`).join("\n\n");

      const sent = await message.reply(
        `❓ 𝗤𝗨𝗘𝗦𝗧𝗜𝗢𝗡\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🗂️ ${data.category}\n` +
        `🔰 ${data.difficulty.charAt(0).toUpperCase() + data.difficulty.slice(1)}\n\n` +
        `${question}\n\n` +
        `${optionsText}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 Reply A, B, C or D  |  'stop' to quit\n` +
        `⏰ 18 seconds`
      );

      global.GoatBot.onReply.set(sent.messageID, {
        commandName:  self.config.name,
        messageID:    sent.messageID,
        author:       event.senderID,
        type:         "answerQuiz",
        quizData:     { question, options, correctAnswer, correctLetter },
        quizMessageID: sent.messageID,
        categoryId,
        stats,
        sessionID,                    // ← stored so onReply can check it
        threadID:     event.threadID
      });

      // ── Timeout ───────────────────────────────────────────
      setTimeout(async () => {
        if (!global.GoatBot.onReply.has(sent.messageID)) return; // already answered
        global.GoatBot.onReply.delete(sent.messageID);

        // User didn't answer — end the session, don't continue
        endSession(event.senderID);

        stats.total++;
        stats.incorrect++;
        stats.streak = 0;
        const accuracy = stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(1) : 0;

        try {
          await message.api?.editMessage?.(
            `⏰ 𝗧𝗜𝗠𝗘'𝗦 𝗨𝗣! 𝗦𝗘𝗦𝗦𝗜𝗢𝗡 𝗘𝗡𝗗𝗘𝗗\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `✔️ Answer: ${correctLetter}. ${correctAnswer}\n\n` +
            `📊 𝗙𝗶𝗻𝗮𝗹 𝗦𝘁𝗮𝘁𝘀:\n` +
            `📝 Total: ${stats.total}  ✅ Correct: ${stats.correct}\n` +
            `🎯 Accuracy: ${accuracy}%\n` +
            `✨ Points: ${stats.sessionPoints}\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `Type +quiz to start a new session!`,
            sent.messageID
          );
        } catch (_) {
          message.reply(
            `⏰ 𝗧𝗜𝗠𝗘'𝗦 𝗨𝗣! 𝗦𝗘𝗦𝗦𝗜𝗢𝗡 𝗘𝗡𝗗𝗘𝗗\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📝 Total: ${stats.total}  ✅ Correct: ${stats.correct}\n` +
            `🎯 Accuracy: ${accuracy}%  ✨ Points: ${stats.sessionPoints}\n` +
            `━━━━━━━━━━━━━━━━━━━━━━`
          );
        }
        // No setTimeout here — session is done
      }, 18000);

    } catch (err) {
      endSession(event.senderID);
      return message.reply("❌ 𝗔𝗣𝗜 𝗕𝘂𝘀𝘆. Try again with +quiz.");
    }
  }
};
