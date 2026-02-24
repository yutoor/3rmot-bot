client.on("messageCreate", async (message) => {
const PREFIX = "!";
const OWNER_ID = process.env.OWNER_ID; // لازم تحطه في Render Variables

function ownerOnly(message) {
  return OWNER_ID && message.author.id === OWNER_ID;
}
const content = (message.content || "").trim();

// تجاهل DM + تجاهل البوتات
if (!message.guild || message.author.bot) return;

// أوامر البوت
if (content.startsWith(PREFIX)) {
  // قفل الأوامر عليك انت فقط
  if (!ownerOnly(message)) return;

  const args = content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = (args.shift() || "").toLowerCase();

  // ✅ help
  if (cmd === "help") {
    return message.reply(
      "**أوامري أنا فقط:**\n" +
      "`!ticket @user [سبب]` تنبيه تكت بالخاص\n" +
      "`!alert @user [سبب]` تنبيه إعلان بالخاص\n" +
      "`!warn @user [سبب]` تحذير\n" +
      "`!timeout @user 10m [سبب]` تايم اوت\n" +
      "`!kick @user [سبب]` فصل\n"
    );
  }

  // !ticket @user سبب
  if (cmd === "ticket") {
    const target = message.mentions.users.first();
    if (!target) return message.reply("اكتب: `!ticket @user السبب`");

    const reason = args.filter(x => !x.startsWith("<@")).join(" ").trim() || "موظف ينتظرك في التكت";

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

  // !alert @user سبب
  if (cmd === "alert") {
    const target = message.mentions.users.first();
    if (!target) return message.reply("اكتب: `!alert @user السبب`");

    const reason = args.filter(x => !x.startsWith("<@")).join(" ").trim() || "في إعلان جديد";

    await target.send(`📢 تنبيه إعلان\n📌 **${message.guild.name}**\n📝 ${reason}`)
      .then(() => message.reply("✅ تم إرسال تنبيه الإعلان بالخاص."))
      .catch(() => message.reply("❌ ما قدرت أرسل DM (خاصه مقفل)."));
    return;
  }

  // !warn @user سبب
  if (cmd === "warn") {
    const target = message.mentions.members.first();
    if (!target) return message.reply("اكتب: `!warn @user السبب`");

    const reason = args.filter(x => !x.startsWith("<@")).join(" ").trim() || "بدون سبب";

    await message.channel.send(`⚠️ **تحذير** لـ ${target}\n📝 السبب: ${reason}`);
    await target.send(`⚠️ تم تحذيرك في **${message.guild.name}**\n📝 السبب: ${reason}`).catch(() => {});
    return;
  }

  // !timeout @user 10m سبب
  if (cmd === "timeout") {
    const target = message.mentions.members.first();
    if (!target) return message.reply("اكتب: `!timeout @user 10m السبب`");

    // احذف المنشن من args
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

  // !kick @user سبب
  if (cmd === "kick") {
    const target = message.mentions.members.first();
    if (!target) return message.reply("اكتب: `!kick @user السبب`");

    const reason = args.filter(x => !x.startsWith("<@")).join(" ").trim() || "بدون سبب";

    await target.kick(reason)
      .then(() => message.reply(`✅ تم فصل ${target.user.tag}`))
      .catch(() => message.reply("❌ ما قدرت أفصل (تأكد صلاحيات البوت: Kick Members)."));
    return;
  }

  return message.reply("❌ أمر غير معروف. اكتب `!help`.");
}
