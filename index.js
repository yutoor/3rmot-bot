const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require("discord.js");

// أضفت EmbedBuilder عشان نخلي الرسائل فخمة

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

// ====== إعدادات إضافية ======
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || null; // قناة للسجلات (اختياري)

// ... (نفس الإعدادات السابقة اللي عندك) ...

// ====== تعديل قالب تنبيه التكت ليكون Embed ======
function createTicketEmbed(guildName, channelName, url, body, author) {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle("⚠️ تنبيه تكت جديد")
    .addFields(
      { name: "📌 السيرفر", value: guildName, inline: true },
      { name: "🧾 التكت", value: `#${channelName}`, inline: true },
      { name: "✍️ بواسطة", value: author.tag, inline: true },
      { name: "💬 المحتوى/السبب", value: body }
    )
    .setDescription(`🔗 [اضغط هنا للانتقال للتكت](${url})`)
    .setTimestamp();
}

// ===================== تعديل مهم في استقبال الرسائل =====================

client.on("messageCreate", async (message) => {
  try {
    if (!message.guild || message.author.bot) return;

    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
    if (!hasCommandPermission(member)) return;

    const content = message.content.trim();

    // تطوير أمر المساعدة ليكون أوضح
    if (content === `${PREFIX}مساعدة` || content === `${PREFIX}اوامر`) {
      const menuEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle("🛠️ لوحة التحكم بالإدارة")
        .setDescription(
            "1️⃣ **تنبيه تكت (DM)**\n" +
            "2️⃣ **إعلان عام (@everyone)**\n" +
            "3️⃣ **ترويج (إرسال جماعي)**\n" +
            "4️⃣ **تحذير عضو**\n" +
            "5️⃣ **تايم اوت (إسكات)**\n" +
            "6️⃣ **فصل (Kick)**\n\n" +
            "❌ لإلغاء العملية اكتب: `إلغاء`"
        );
      
      sessions.set(message.author.id, {
        step: "choose_action",
        createdAt: Date.now(),
        channelId: message.channel.id,
      });

      return message.reply({ embeds: [menuEmbed] });
    }

    const sess = sessions.get(message.author.id);
    // ... (تكملة نظام الجلسات الخاص بك) ...

    // عند تنفيذ "تايم أوت" أو "فصل"، يفضل إرسال نسخة لقناة اللوق
    if (sess?.step === "ask_body" && LOG_CHANNEL_ID) {
        const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
            logChannel.send(`🛡️ **إجراء إداري:** ${sess.action} بواسطة ${message.author.tag} ضد ${sess.targetIds[0] || 'الكل'}`);
        }
    }

  } catch (err) {
    console.error("خطأ في معالجة الرسالة:", err);
  }
});

// ... (بقية الكود الخاص بك) ...
