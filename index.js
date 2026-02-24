const { Client, GatewayIntentBits, Partials } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

// ====== إعدادات ======
const PREFIX = "!";
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID || null;     // ملاك المتجر
const SUPPORT_ROLE_ID = process.env.SUPPORT_ROLE_ID || null; // الدعم الفني
const BROADCAST_ROLE_ID = process.env.BROADCAST_ROLE_ID || null; // رول "الكل" (اختياري)

const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID || null;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || null;

// كولداون لتنبيه المنشن داخل التكت
const cooldown = new Map();
const COOLDOWN_MS = 60 * 1000;

// جلسات المنيو (لكل مستخدم)
const sessions = new Map(); // key: userId => { step, action, targetsType, targetIds, createdAt }
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 دقائق

function hasCommandPermission(member) {
  if (!member) return false;
  if (member.permissions?.has("Administrator")) return true;
  if (ADMIN_ROLE_ID && member.roles.cache.has(ADMIN_ROLE_ID)) return true;
  if (SUPPORT_ROLE_ID && member.roles.cache.has(SUPPORT_ROLE_ID)) return true;
  return false;
}

function isTicketChannel(channel) {
  if (channel?.name?.toLowerCase().startsWith("ticket-")) return true;
  if (TICKET_CATEGORY_ID && channel?.parentId === TICKET_CATEGORY_ID) return true;
  return false;
}

function cleanupSession(userId) {
  sessions.delete(userId);
}

function isExpired(sess) {
  return !sess || (Date.now() - sess.createdAt > SESSION_TTL_MS);
}

// ====== قوالب ثابتة ======
function ticketTemplate(guildName, channelName, url, body) {
  return (
    `⚠️ *تنبيه تكت*\n` +
    `📌 السيرفر: **${guildName}**\n` +
    `🧾 التكت: **#${channelName}**\n` +
    `━━━━━━━━━━━━\n` +
    `${body}\n` +
    `━━━━━━━━━━━━\n` +
    `🔗 الرابط: ${url}`
  );
}

function announceTemplate(guildName, body) {
  return (
    `📢 *تنبيه إعلان*\n` +
    `📌 السيرفر: **${guildName}**\n` +
    `━━━━━━━━━━━━\n` +
    `${body}\n` +
    `━━━━━━━━━━━━`
  );
}

function promoTemplate(guildName, body) {
  return (
    `🔥 *ترويج / عرض*\n` +
    `📌 السيرفر: **${guildName}**\n` +
    `━━━━━━━━━━━━\n` +
    `${body}\n` +
    `━━━━━━━━━━━━`
  );
}

client.on("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

async function getBroadcastTargets(guild) {
  if (!BROADCAST_ROLE_ID) return [];
  const role = await guild.roles.fetch(BROADCAST_ROLE_ID).catch(() => null);
  if (!role) return [];
  // فلترة البوتات
  return role.members.filter(m => !m.user.bot).map(m => m.user);
}

client.on("messageCreate", async (message) => {
  try {
    if (!message.guild) return;
    if (message.author.bot) return;

    const member = await message.guild.members.fetch(message.author.id).catch(() => null);

    // ============ فلترة: فقط اللي لهم صلاحية يتعاملون مع المنيو/الأوامر ============
    const canUse = hasCommandPermission(member);

    const content = (message.content || "").trim();

    // ============ منيو ============
    if (content === `${PREFIX}مساعدة` || content === `${PREFIX}اوامر`) {
      if (!canUse) return;

      // افتح جلسة جديدة
      sessions.set(message.author.id, {
        step: "choose_action",
        action: null,
        targetsType: null,
        targetIds: [],
        createdAt: Date.now(),
        channelId: message.channel.id,
      });

      return message.reply(
        "**اختر رقم:**\n" +
        "1) تنبيه تكت\n" +
        "2) تنبيه إعلان\n" +
        "3) ترويج\n" +
        "4) تحذير\n" +
        "5) تايم اوت\n" +
        "6) فصل\n" +
        "❌ للإلغاء اكتب: `إلغاء`"
      );
    }

    // ============ إدارة الجلسات (الأرقام) ============
    const sess = sessions.get(message.author.id);
    if (sess && !isExpired(sess) && canUse && sess.channelId === message.channel.id) {
      // إلغاء
      if (content === "إلغاء") {
        cleanupSession(message.author.id);
        return message.reply("✅ تم الإلغاء.");
      }

      // خطوة اختيار العملية
      if (sess.step === "choose_action") {
        if (!/^[1-6]$/.test(content)) {
          return message.reply("اكتب رقم من 1 إلى 6، أو اكتب `إلغاء`.");
        }

        const map = {
          "1": "ticket",
          "2": "announce",
          "3": "promo",
          "4": "warn",
          "5": "timeout",
          "6": "kick",
        };

        sess.action = map[content];
        sess.step = "choose_target";
        sess.createdAt = Date.now();
        sessions.set(message.author.id, sess);

        const allHint = BROADCAST_ROLE_ID ? "أو اكتب `الكل`" : "(خيار الكل غير مفعّل)";
        return message.reply(
          `تمام ✅\n` +
          `الحين **من ترسل له؟**\n` +
          `- منشن الشخص @\n` +
          `- ${allHint}\n` +
          `❌ للإلغاء: اكتب \`إلغاء\``
        );
      }

      // خطوة اختيار المستهدف
      if (sess.step === "choose_target") {
        // الكل
        if (content === "الكل") {
          if (!BROADCAST_ROLE_ID) {
            return message.reply("❌ خيار `الكل` مو مفعّل. أضف BROADCAST_ROLE_ID في Variables.");
          }
          sess.targetsType = "broadcast";
          sess.targetIds = [];
          sess.step = sess.action === "timeout" ? "ask_timeout_duration" : "ask_body";
          sess.createdAt = Date.now();
          sessions.set(message.author.id, sess);

          if (sess.step === "ask_timeout_duration") {
            return message.reply("⏳ اكتب مدة التايم اوت مثل: `10m` أو `1h`");
          }
          return message.reply("✍️ اكتب نص الرسالة/السبب الآن.");
        }

        // منشن
        const mentionedUsers = message.mentions.users;
        const mentionedMembers = message.mentions.members;

        // للأوامر اللي تحتاج Member (warn/timeout/kick) لازم منشن عضو
        const needMember = ["warn", "timeout", "kick"].includes(sess.action);

        if (needMember) {
          const m = mentionedMembers?.first();
          if (!m) return message.reply("منشن الشخص @ أو اكتب `الكل` أو `إلغاء`.");

          sess.targetsType = "single";
          sess.targetIds = [m.id];
          sess.step = sess.action === "timeout" ? "ask_timeout_duration" : "ask_body";
          sess.createdAt = Date.now();
          sessions.set(message.author.id, sess);

          if (sess.step === "ask_timeout_duration") {
            return message.reply("⏳ اكتب مدة التايم اوت مثل: `10m` أو `1h`");
          }
          return message.reply("✍️ اكتب السبب الآن.");
        } else {
          const u = mentionedUsers?.first();
          if (!u) return message.reply("منشن الشخص @ أو اكتب `الكل` أو `إلغاء`.");

          sess.targetsType = "single";
          sess.targetIds = [u.id];
          sess.step = "ask_body";
          sess.createdAt = Date.now();
          sessions.set(message.author.id, sess);

          return message.reply("✍️ اكتب نص الرسالة الآن.");
        }
      }

      // timeout: اسأل عن المدة
      if (sess.step === "ask_timeout_duration") {
        const durationStr = content;
        const m = durationStr.match(/^(\d+)(s|m|h|d)$/i);
        if (!m) return message.reply("صيغة الوقت غلط. مثال: `10m` أو `1h`");

        sess.timeoutDuration = durationStr;
        sess.step = "ask_body";
        sess.createdAt = Date.now();
        sessions.set(message.author.id, sess);

        return message.reply("✍️ اكتب السبب الآن.");
      }

      // خطوة كتابة النص/السبب والتنفيذ
      if (sess.step === "ask_body") {
        const body = content;
        if (!body) return message.reply("اكتب نص/سبب، أو `إلغاء`.");

        // جهز لسته المستهدفين
        let targetsUsers = [];
        let targetsMembers = [];

        if (sess.targetsType === "broadcast") {
          targetsUsers = await getBroadcastTargets(message.guild);
          if (!targetsUsers.length) {
            cleanupSession(message.author.id);
            return message.reply("❌ ما لقيت أحد داخل رول الإرسال (BROADCAST_ROLE_ID).");
          }
        } else {
          // single
          if (["warn", "timeout", "kick"].includes(sess.action)) {
            const mem = await message.guild.members.fetch(sess.targetIds[0]).catch(() => null);
            if (!mem) {
              cleanupSession(message.author.id);
              return message.reply("❌ ما قدرت أجيب العضو.");
            }
            targetsMembers = [mem];
            targetsUsers = [mem.user];
          } else {
            const user = await client.users.fetch(sess.targetIds[0]).catch(() => null);
            if (!user) {
              cleanupSession(message.author.id);
              return message.reply("❌ ما قدرت أجيب الشخص.");
            }
            targetsUsers = [user];
          }
        }

        // تنفيذ حسب النوع
        if (sess.action === "ticket") {
          const text = ticketTemplate(
            message.guild.name,
            message.channel?.name || "ticket",
            message.url,
            body
          );

          let ok = 0;
          for (const u of targetsUsers) {
            const sent = await u.send(text).then(() => true).catch(() => false);
            if (sent) ok++;
          }

          cleanupSession(message.author.id);
          return message.reply(`✅ تم إرسال تنبيه التكت. (نجح: ${ok}/${targetsUsers.length})`);
        }

        if (sess.action === "announce") {
          const text = announceTemplate(message.guild.name, body);

          let ok = 0;
          for (const u of targetsUsers) {
            const sent = await u.send(text).then(() => true).catch(() => false);
            if (sent) ok++;
          }

          cleanupSession(message.author.id);
          return message.reply(`✅ تم إرسال تنبيه الإعلان. (نجح: ${ok}/${targetsUsers.length})`);
        }

        if (sess.action === "promo") {
          const text = promoTemplate(message.guild.name, body);

          let ok = 0;
          for (const u of targetsUsers) {
            const sent = await u.send(text).then(() => true).catch(() => false);
            if (sent) ok++;
          }

          cleanupSession(message.author.id);
          return message.reply(`✅ تم إرسال الترويج. (نجح: ${ok}/${targetsUsers.length})`);
        }

        if (sess.action === "warn") {
          // إذا broadcast: نرسل DM فقط (ما نقدر نحذر "كل السيرفر" كعقوبة)
          if (sess.targetsType === "broadcast") {
            cleanupSession(message.author.id);
            return message.reply("❌ التحذير ما ينفع للكل. منشن شخص محدد.");
          }

          const target = targetsMembers[0];
          await message.channel.send(`⚠️ **تحذير** لـ ${target}\n📝 السبب: ${body}`);
          await target.send(`⚠️ تم تحذيرك في **${message.guild.name}**\n📝 السبب: ${body}`).catch(() => {});
          cleanupSession(message.author.id);
          return;
        }

        if (sess.action === "timeout") {
          if (sess.targetsType === "broadcast") {
            cleanupSession(message.author.id);
            return message.reply("❌ التايم اوت ما ينفع للكل. منشن شخص محدد.");
          }

          const durationStr = sess.timeoutDuration || "10m";
          const m = durationStr.match(/^(\d+)(s|m|h|d)$/i);
          const num = parseInt(m[1], 10);
          const unit = m[2].toLowerCase();
          const ms =
            unit === "s" ? num * 1000 :
            unit === "m" ? num * 60 * 1000 :
            unit === "h" ? num * 60 * 60 * 1000 :
            num * 24 * 60 * 60 * 1000;

          const target = targetsMembers[0];
          await target.timeout(ms, body).catch(() => null);
          await message.reply(`✅ تم التايم اوت لـ ${target} مدة ${durationStr}`);
          await target.send(`⏳ تم إعطاؤك تايم اوت في **${message.guild.name}** مدة ${durationStr}\n📝 السبب: ${body}`).catch(() => {});
          cleanupSession(message.author.id);
          return;
        }

        if (sess.action === "kick") {
          if (sess.targetsType === "broadcast") {
            cleanupSession(message.author.id);
            return message.reply("❌ الفصل ما ينفع للكل. منشن شخص محدد.");
          }

          const target = targetsMembers[0];
          await target.kick(body).catch(() => null);
          await message.reply(`✅ تم فصل ${target.user.tag}`);
          cleanupSession(message.author.id);
          return;
        }

        cleanupSession(message.author.id);
        return message.reply("❌ صار شيء غلط.");
      }
    } else if (sess && isExpired(sess)) {
      cleanupSession(message.author.id);
    }

    // ===================== تنبيه التكت بالمنشن (تلقائي) =====================
    if (!isTicketChannel(message.channel)) return;

    // لو حاط STAFF_ROLE_ID: لا يرسل إلا إذا الكاتب موظف
    if (STAFF_ROLE_ID) {
      const authorMember = await message.guild.members.fetch(message.author.id).catch(() => null);
      if (!authorMember || !authorMember.roles.cache.has(STAFF_ROLE_ID)) return;
    }

    const mentionedUsers = message.mentions.users;
    if (!mentionedUsers || mentionedUsers.size === 0) return;

    for (const [, user] of mentionedUsers) {
      if (user.id === message.author.id) continue;

      const key = `${message.channelId}:${user.id}`;
      const last = cooldown.get(key) || 0;
      if (Date.now() - last < COOLDOWN_MS) continue;
      cooldown.set(key, Date.now());

      const dmText =
        `⚠️ تنبيه: في موظف ينتظرك في التكت.\n` +
        `📌 السيرفر: **${message.guild.name}**\n` +
        `🧾 التكت: **#${message.channel.name}**\n` +
        `🔗 رابط الرسالة: ${message.url}`;

      await user.send(dmText).catch(() => {});
    }
  } catch (err) {
    console.error(err);
  }
});

client.login(process.env.DISCORD_TOKEN);
