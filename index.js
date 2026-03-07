const { Client, GatewayIntentBits, Partials } = require("discord.js");

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

// ====== إعدادات ======
const PREFIX = "!";
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID || null;     
const SUPPORT_ROLE_ID = process.env.SUPPORT_ROLE_ID || null; 
const ANNOUNCE_CHANNEL_ID = process.env.ANNOUNCE_CHANNEL_ID || null; 
const BROADCAST_ROLE_ID = process.env.BROADCAST_ROLE_ID || null;     

const sessions = new Map(); 
const SESSION_TTL_MS = 5 * 60 * 1000;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ====== وظائف مساعدة ======
function hasCommandPermission(member) {
  if (!member) return false;
  if (member.permissions.has("Administrator")) return true;
  if (ADMIN_ROLE_ID && member.roles.cache.has(ADMIN_ROLE_ID)) return true;
  if (SUPPORT_ROLE_ID && member.roles.cache.has(SUPPORT_ROLE_ID)) return true;
  return false;
}

function cleanupSession(userId) { sessions.delete(userId); }

function promoTemplate(guildName, body) {
  return (
    `🎁 **عرض خاص من ${guildName}**\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `${body}\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `✨ نتمنى لك وقتاً ممتعاً ✨`
  );
}

client.on("ready", () => {
  console.log(`🚀 البوت متصل الآن: ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  try {
    if (!message.guild || message.author.bot) return;

    const content = message.content.trim();
    const isCommand = content.startsWith(PREFIX);
    const hasActiveSession = sessions.has(message.author.id);

    // --- حذف رسالة المستخدم تلقائياً ---
    if (isCommand || hasActiveSession) {
        setTimeout(() => message.delete().catch(() => null), 1000);
    }

    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
    if (!hasCommandPermission(member)) return;

    // --- أمر المساعدة ---
    if (content === `${PREFIX}مساعدة` || content === `${PREFIX}اوامر`) {
      sessions.set(message.author.id, {
        step: "choose_action",
        createdAt: Date.now(),
        channelId: message.channel.id,
      });

      const menuMsg = await message.reply("✨ **تم فتح لوحة التحكم.. اختر رقم العملية:**\n1️⃣ تنبيه تكت | 2️⃣ إعلان عام | 3️⃣ ترويج جماعي");
      setTimeout(() => menuMsg.delete().catch(() => null), 10000);
      return;
    }

    const sess = sessions.get(message.author.id);
    if (sess && (Date.now() - sess.createdAt < SESSION_TTL_MS)) {
      
      if (content === "إلغاء") {
        cleanupSession(message.author.id);
        const cancelMsg = await message.channel.send("✅ تم الإلغاء وح
