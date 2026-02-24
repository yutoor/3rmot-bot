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

// رولات اللي يقدرون يستخدمون الأوامر
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID || null;     // ملاك المتجر
const SUPPORT_ROLE_ID = process.env.SUPPORT_ROLE_ID || null; // الدعم الفني

// إعدادات التكت (اختياري)
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID || null; // لو تبي تقيّد على كاتيجوري
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || null;           // لو تبي تنبيه التكت يشتغل للموظفين فقط

// كولداون لمنع السبام (لتنبيه التكت)
const cooldown = new Map();
const COOLDOWN_MS = 60 * 1000;

function hasCommandPermission(member) {
  if (!member) return false;

  // أدمن السيرفر
  if (member.permissions?.has("Administrator")) return true;

  // رولات محددة
  if (ADMIN_ROLE_ID && member.roles.cache.has(ADMIN_ROLE_ID)) return true;
  if (SUPPORT_ROLE_ID && member.roles.cache.has(SUPPORT_ROLE_ID)) return true;

  return false;
}

function isTicketChannel(channel) {
  if (channel?.name?.toLowerCase().startsWith("ticket-")) return true;
  if (TICKET_CATEGORY_ID && channel?.parentId === TICKET_CATEGORY_ID) return true;
  return false;
}

client.on("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  try {
    if (!message.guild) return;
    if (message.author.bot) return;

    const content = (message.content || "").trim();

    // ===================== أوامر (ملاك المتجر + الدعم الفني) =====================
    if (content.startsWith(PREFIX)) {
      const member = await message.guild.members.fetch(message.author.id).catch(() => null);
      if (!hasCommandPermission(member)) return; // أي شخص غيرهم يتجاهله

      const args = content.slice(PREFIX.length).trim().split(/\s+/);
      const cmd = (args.shift() || "").toLowerCase();

      // مساعده
      if (cmd === "مساعدة" || cmd === "اوامر") {
        return message.reply(
          "**أوامر البوت:**\n" +
          "🧾 `!تنبيه_تكت @شخص السبب`\n" +
          "📢 `!تنبيه_اعلان @شخص السبب`\n" +
          "⚠️ `!تحذير @شخص السبب`\n" +
          "⏳ `!تايم_اوت @شخص 10m السبب`  (مثال 10m أو 1h)\n" +
          "👢 `!فصل @شخص السبب`\n"
        );
      }

      // !تنبيه_تكت @user سبب
      if (cmd === "تنبيه_تكت") {
        const target = message.mentions.users.first();
        if (!target) return message.reply("اكتب: `!تنبيه_تكت @شخص السبب`");

        const reason = args.filter(x => !x.startsWith("<@")).join(" ").trim() || "في موظف ينتظرك في التكت";
        const dmText =
          `⚠️ تنبيه تكت\n` +
          `📌 السيرفر: **${message.guild.name}**\n` +
          `🧾 المكان: **#${message.channel?.name || "ticket"}**\n` +
          `📝 السبب: ${reason}\n` +
          `🔗 رابط: ${message.url}`;

        await target.send(dmText)
          .then(() => message.reply("✅ تم إرسال تنبيه التكت بالخاص."))
          .catch(() => message.reply("❌ ما قدرت أرسل DM (خاصه مقفل)."));
        return;
      }

      // !تنبيه_اعلان @user سبب
      if (cmd === "تنبيه_اعلان") {
        const target = message.mentions.users.first();
        if (!target) return message.reply("اكتب: `!تنبيه_اعلان @شخص السبب`");

        const reason = args.filter(x => !x.startsWith("<@")).join(" ").trim() || "في إعلان جديد";
        await target.send(`📢 تنبيه إعلان\n📌 **${message.guild.name}**\n📝 ${reason}`)
          .then(() => message.reply("✅ تم إرسال تنبيه الإعلان بالخاص."))
          .catch(() => message.reply("❌ ما قدرت أرسل DM (خاصه مقفل)."));
        return;
      }

      // !تحذير @user سبب
      if (cmd === "تحذير") {
        const target = message.mentions.members.first();
        if (!target) return message.reply("اكتب: `!تحذير @شخص السبب`");

        const reason = args.filter(x => !x.startsWith("<@")).join(" ").trim() || "بدون سبب";
        await message.channel.send(`⚠️ **تحذير** لـ ${target}\n📝 السبب: ${reason}`);
        await target.send(`⚠️ تم تحذيرك في **${message.guild.name}**\n📝 السبب: ${reason}`).catch(() => {});
        return;
      }

      // !تايم_اوت @user 10m سبب
      if (cmd === "تايم_اوت") {
        const target = message.mentions.members.first();
        if (!target) return message.reply("اكتب: `!تايم_اوت @شخص 10m السبب`");

        const cleanArgs = args.filter(x => !x.startsWith("<@"));
        const durationStr = cleanArgs[0] || "10m";
        const reason = cleanArgs.slice(1).join(" ").trim() || "بدون سبب";

        const m = durationStr.match(/^(\d+)(s|m|h|d)$/i);
        if (!m) return message.reply("صيغة الوقت غلط. مثال: `10m` أو `1h`");

        const num = parseInt(m[1], 10);
        const unit = m[2].toLowerCase();
        const ms =
          unit === "s" ? num * 1000 :
          unit === "m" ? num * 60 * 1000 :
          unit === "h" ? num * 60 * 60 * 1000 :
          num * 24 * 60 * 60 * 1000;

        await target.timeout(ms, reason)
          .then(() => message.reply(`✅ تم التايم اوت لـ ${target} مدة ${durationStr}`))
          .catch(() => message.reply("❌ ما قدرت أسوي تايم اوت (تأكد صلاحيات البوت: Moderate Members)."));
        return;
      }

      // !فصل @user سبب
      if (cmd === "فصل") {
        const target = message.mentions.members.first();
        if (!target) return message.reply("اكتب: `!فصل @شخص السبب`");

        const reason = args.filter(x => !x.startsWith("<@")).join(" ").trim() || "بدون سبب";
        await target.kick(reason)
          .then(() => message.reply(`✅ تم فصل ${target.user.tag}`))
          .catch(() => message.reply("❌ ما قدرت أفصل (تأكد صلاحيات البوت: Kick Members)."));
        return;
      }

      return message.reply("❌ أمر غير معروف. اكتب `!مساعدة`.");
    }

    // ===================== تنبيه التكت بالمنشن =====================
    if (!isTicketChannel(message.channel)) return;

    // لو حاط STAFF_ROLE_ID: لا يرسل إلا إذا الكاتب موظف
    if (STAFF_ROLE_ID) {
      const member = await message.guild.members.fetch(message.author.id).catch(() => null);
      if (!member || !member.roles.cache.has(STAFF_ROLE_ID)) return;
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
