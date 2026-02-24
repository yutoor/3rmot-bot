const { Client, GatewayIntentBits, Partials } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // ✅ مهم عشان نجيب أعضاء الرول للـ DM
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

const ANNOUNCE_CHANNEL_ID = process.env.ANNOUNCE_CHANNEL_ID || null; // قناة الإعلانات (للإعلان العام)
const BROADCAST_ROLE_ID = process.env.BROADCAST_ROLE_ID || null;     // رول للإرسال الجماعي DM (اختياري)

const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID || null; // اختياري
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || null;           // اختياري

// كولداون لتنبيه المنشن داخل التكت
const cooldown = new Map();
const COOLDOWN_MS = 60 * 1000;

// جلسات المنيو
const sessions = new Map(); // userId => { step, action, targetsType, targetIds, createdAt, channelId, timeoutDuration }
const SESSION_TTL_MS = 5 * 60 * 1000;

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

// ===================== ✅ جديد: تنبيه عند فتح تكت =====================
// يمنع تكرار الإشعار (بعض البوتات تعدّل القناة بعد الإنشاء)
const notifiedTickets = new Set();

client.on("channelCreate", async (channel) => {
  try {
    if (!channel?.guild) return;

    // يعتبرها تكت إذا اسمها يبدأ بـ ticket-
    // أو داخل كاتيجوري التكت (إذا ضبطت TICKET_CATEGORY_ID)
    const isTicket =
      (channel.name?.toLowerCase().startsWith("ticket-")) ||
      (TICKET_CATEGORY_ID && channel.parentId === TICKET_CATEGORY_ID);

    if (!isTicket) return;
    if (notifiedTickets.has(channel.id)) return;
    notifiedTickets.add(channel.id);

    const guild = channel.guild;

    // جيب الرولين
    const adminRole = ADMIN_ROLE_ID ? await guild.roles.fetch(ADMIN_ROLE_ID).catch(() => null) : null;
    const supportRole = SUPPORT_ROLE_ID ? await guild.roles.fetch(SUPPORT_ROLE_ID).catch(() => null) : null;

    // جمع الأعضاء بدون تكرار + بدون بوتات
    const membersToNotify = new Map();

    if (adminRole) {
      adminRole.members.forEach((m) => {
        if (!m.user.bot) membersToNotify.set(m.id, m);
      });
    }
    if (supportRole) {
      supportRole.members.forEach((m) => {
        if (!m.user.bot) membersToNotify.set(m.id, m);
      });
    }

    if (membersToNotify.size === 0) return;

    const dmText =
      `🆕 **تم فتح تكت جديد**\n` +
      `📌 السيرفر: **${guild.name}**\n` +
      `🧾 القناة: ${channel}\n` +
      `🔗 الرابط: https://discord.com/channels/${guild.id}/${channel.id}`;

    for (const [, m] of membersToNotify) {
      await m.user.send(dmText).catch(() => {});
    }
  } catch (err) {
    console.error(err);
  }
});

// ===================== وظائف مساعدة =====================
async function getBroadcastTargets(guild) {
  if (!BROADCAST_ROLE_ID) return [];
  const role = await guild.roles.fetch(BROADCAST_ROLE_ID).catch(() => null);
  if (!role) return [];
  return role.members.filter((m) => !m.user.bot).map((m) => m.user);
}

client.on("messageCreate", async (message) => {
  try {
    if (!message.guild) return;
    if (message.author.bot) return;

    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
    const canUse = hasCommandPermission(member);

    const content = (message.content || "").trim();

    // ===================== منيو الأرقام =====================
    if (content === `${PREFIX}مساعدة` || content === `${PREFIX}اوامر`) {
      if (!canUse) return;

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
          "1) تنبيه تكت (DM)\n" +
          "2) إعلان عام للجميع (@everyone)\n" +
          "3) ترويج (DM لشخص أو الكل)\n" +
          "4) تحذير\n" +
          "5) تايم اوت\n" +
          "6) فصل\n" +
          "❌ للإلغاء اكتب: `إلغاء`"
      );
    }

    // ===================== جلسة المنيو =====================
    const sess = sessions.get(message.author.id);
    if (sess && canUse && !isExpired(sess) && sess.channelId === message.channel.id) {
      if (content === "إلغاء") {
        cleanupSession(message.author.id);
        return message.reply("✅ تم الإلغاء.");
      }

      // اختيار العملية
      if (sess.step === "choose_action") {
        if (!/^[1-6]$/.test(content)) {
          return message.reply("اكتب رقم من 1 إلى 6، أو `إلغاء`.");
        }

        const map = {
          "1": "ticket_dm",
          "2": "announce_public",
          "3": "promo_dm",
          "4": "warn",
          "5": "timeout",
          "6": "kick",
        };

        sess.action = map[content];
        sess.step = sess.action === "announce_public" ? "ask_body" : "choose_target";
        sess.createdAt = Date.now();
        sessions.set(message.author.id, sess);

        if (sess.action === "announce_public") {
          return message.reply("✍️ اكتب نص الإعلان الآن (بينزل للجميع).");
        }

        const allHint = BROADCAST_ROLE_ID ? "أو اكتب `الكل`" : "(خيار الكل غير مفعّل)";
        return message.reply(
          `تمام ✅\n` +
            `الحين **من ترسل له؟**\n` +
            `- منشن الشخص @\n` +
            `- ${allHint}\n` +
            `❌ للإلغاء: اكتب \`إلغاء\``
        );
      }

      // اختيار المستهدف
      if (sess.step === "choose_target") {
        // الكل (DM لرول)
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

        const needMember = ["warn", "timeout", "kick"].includes(sess.action);
        if (needMember) {
          const m = message.mentions.members?.first();
          if (!m) return message.reply("منشن الشخص @ أو اكتب `إلغاء`.");

          sess.targetsType = "single_member";
          sess.targetIds = [m.id];
          sess.step = sess.action === "timeout" ? "ask_timeout_duration" : "ask_body";
          sess.createdAt = Date.now();
          sessions.set(message.author.id, sess);

          if (sess.step === "ask_timeout_duration") {
            return message.reply("⏳ اكتب مدة التايم اوت مثل: `10m` أو `1h`");
          }
          return message.reply("✍️ اكتب السبب الآن.");
        } else {
          const u = message.mentions.users?.first();
          if (!u) return message.reply("منشن الشخص @ أو اكتب `الكل` أو `إلغاء`.");

          sess.targetsType = "single_user";
          sess.targetIds = [u.id];
          sess.step = "ask_body";
          sess.createdAt = Date.now();
          sessions.set(message.author.id, sess);

          return message.reply("✍️ اكتب نص الرسالة الآن.");
        }
      }

      // للتايم اوت: المدة
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

      // تنفيذ بعد كتابة النص
      if (sess.step === "ask_body") {
        const body = content;
        if (!body) return message.reply("اكتب نص/سبب، أو `إلغاء`.");

        // ===== إعلان عام =====
        if (sess.action === "announce_public") {
          if (!ANNOUNCE_CHANNEL_ID) {
            cleanupSession(message.author.id);
            return message.reply("❌ لازم تحط ANNOUNCE_CHANNEL_ID في Variables.");
          }
          const ch = await message.guild.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null);
          if (!ch || !ch.isTextBased()) {
            cleanupSession(message.author.id);
            return message.reply("❌ قناة الإعلانات غير صحيحة.");
          }

          await ch.send(`@everyone\n📢 **إعلان**\n${body}`);
          cleanupSession(message.author.id);
          return message.reply("✅ تم نشر الإعلان للجميع في قناة الإعلانات.");
        }

        // ===== تجهيز المستهدفين =====
        let targetsUsers = [];
        let targetMember = null;

        if (sess.targetsType === "broadcast") {
          targetsUsers = await getBroadcastTargets(message.guild);
          if (!targetsUsers.length) {
            cleanupSession(message.author.id);
            return message.reply("❌ ما لقيت أحد داخل رول الإرسال (BROADCAST_ROLE_ID).");
          }
        } else if (sess.targetsType === "single_user") {
          const user = await client.users.fetch(sess.targetIds[0]).catch(() => null);
          if (!user) {
            cleanupSession(message.author.id);
            return message.reply("❌ ما قدرت أجيب الشخص.");
          }
          targetsUsers = [user];
        } else if (sess.targetsType === "single_member") {
          targetMember = await message.guild.members.fetch(sess.targetIds[0]).catch(() => null);
          if (!targetMember) {
            cleanupSession(message.author.id);
            return message.reply("❌ ما قدرت أجيب العضو.");
          }
          targetsUsers = [targetMember.user];
        }

        // ===== تنبيه تكت DM =====
        if (sess.action === "ticket_dm") {
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

        // ===== ترويج DM =====
        if (sess.action === "promo_dm") {
          const text = promoTemplate(message.guild.name, body);

          let ok = 0;
          for (const u of targetsUsers) {
            const sent = await u.send(text).then(() => true).catch(() => false);
            if (sent) ok++;
          }

          cleanupSession(message.author.id);
          return message.reply(`✅ تم إرسال الترويج. (نجح: ${ok}/${targetsUsers.length})`);
        }

        // ===== تحذير =====
        if (sess.action === "warn") {
          if (!targetMember) {
            cleanupSession(message.author.id);
            return message.reply("❌ التحذير لازم يكون لشخص محدد (منشن).");
          }

          await message.channel.send(`⚠️ **تحذير** لـ ${targetMember}\n📝 السبب: ${body}`);
          await targetMember.send(`⚠️ تم تحذيرك في **${message.guild.name}**\n📝 السبب: ${body}`).catch(() => {});
          cleanupSession(message.author.id);
          return;
        }

        // ===== تايم اوت =====
        if (sess.action === "timeout") {
          if (!targetMember) {
            cleanupSession(message.author.id);
            return message.reply("❌ التايم اوت لازم يكون لشخص محدد (منشن).");
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

          await targetMember.timeout(ms, body).catch(() => null);
          await message.reply(`✅ تم التايم اوت لـ ${targetMember} مدة ${durationStr}`);
          await targetMember.send(
            `⏳ تم إعطاؤك تايم اوت في **${message.guild.name}** مدة ${durationStr}\n📝 السبب: ${body}`
          ).catch(() => {});
          cleanupSession(message.author.id);
          return;
        }

        // ===== فصل =====
        if (sess.action === "kick") {
          if (!targetMember) {
            cleanupSession(message.author.id);
            return message.reply("❌ الفصل لازم يكون لشخص محدد (منشن).");
          }

          await targetMember.kick(body).catch(() => null);
          await message.reply(`✅ تم فصل ${targetMember.user.tag}`);
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
