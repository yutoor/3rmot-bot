require("dotenv").config();
const { Client, GatewayIntentBits, Partials } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // لازم
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel], // عشان الـ DM
});

// إعدادات اختيارية
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID || null; // لو تبي تقيّد على كاتيجوري التكتات
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || null; // لو تبي فقط الموظفين يفعّلوا التنبيه

// منع سبام (كولداون)
const cooldown = new Map(); // key: userId, value: timestamp
const COOLDOWN_MS = 60 * 1000; // دقيقة

function isTicketChannel(channel) {
  // خيار 1: اسم القناة يبدأ بـ ticket-
  if (channel?.name?.toLowerCase().startsWith("ticket-")) return true;

  // خيار 2: التكتات داخل كاتيجوري معيّن
  if (TICKET_CATEGORY_ID && channel?.parentId === TICKET_CATEGORY_ID) return true;

  return false;
}

client.on("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  try {
    if (!message.guild) return;                 // تجاهل DM
    if (message.author.bot) return;             // تجاهل البوتات
    if (!isTicketChannel(message.channel)) return;

    // لو محدد رول موظفين: لازم المرسل يكون عنده الرول
    if (STAFF_ROLE_ID) {
      const member = await message.guild.members.fetch(message.author.id).catch(() => null);
      if (!member || !member.roles.cache.has(STAFF_ROLE_ID)) return;
    }

    const mentionedUsers = message.mentions.users;
    if (!mentionedUsers || mentionedUsers.size === 0) return;

    for (const [, user] of mentionedUsers) {
      // لا ترسل للمرسل نفسه
      if (user.id === message.author.id) continue;

      // كولداون لكل شخص
      const key = `${message.channelId}:${user.id}`;
      const last = cooldown.get(key) || 0;
      if (Date.now() - last < COOLDOWN_MS) continue;
      cooldown.set(key, Date.now());

      const dmText =
        `⚠️ تنبيه: في موظف ينتظرك في التكت.\n` +
        `📌 السيرفر: **${message.guild.name}**\n` +
        `🧾 التكت: **#${message.channel.name}**\n` +
        `🔗 رابط الرسالة: ${message.url}`;

      await user.send(dmText).catch(() => {
        // لو الشخص قافل الخاص ما نقدر نغصب
      });
    }
  } catch (err) {
    console.error(err);
  }
});

client.login(process.env.DISCORD_TOKEN);
