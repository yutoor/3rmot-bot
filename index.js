const { Client, GatewayIntentBits, Partials } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, 
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel], // ضروري لاستلام رسائل الخاص
});

// ====== Settings / الإعدادات من Variables ======
const PREFIX = "!";
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID || null;     
const SUPPORT_ROLE_ID = process.env.SUPPORT_ROLE_ID || null; 
const BROADCAST_ROLE_ID = process.env.BROADCAST_ROLE_ID || null;     
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID || null;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || null;

const sessions = new Map(); 
const SESSION_TTL_MS = 5 * 60 * 1000; // مدة الجلسة 5 دقائق
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const cooldown = new Map();
const COOLDOWN_MS = 60 * 1000;

// التحقق من صلاحيات المشرف
function hasCommandPermission(member) {
  if (!member) return false;
  if (member.permissions.has("Administrator")) return true;
  if (ADMIN_ROLE_ID && member.roles.cache.has(ADMIN_ROLE_ID)) return true;
  if (SUPPORT_ROLE_ID && member.roles.cache.has(SUPPORT_ROLE_ID)) return true;
  return false;
}

client.on("ready", () => {
  console.log(`🚀 Bot is Online: ${client.user.tag}`);
});

// ===================== [1] نظام تنبيه التكت (تلقائي) =====================
client.on("channelCreate", async (channel) => {
  try {
    if (!channel.guild) return;
    const isTicket = channel.name.toLowerCase().startsWith("ticket-") || 
                     (TICKET_CATEGORY_ID && channel.parentId === TICKET_CATEGORY_ID);
    if (!isTicket) return;

    const guild = channel.guild;
    const adminRole = ADMIN_ROLE_ID ? await guild.roles.fetch(ADMIN_ROLE_ID).catch(() => null) : null;
    const supportRole = SUPPORT_ROLE_ID ? await guild.roles.fetch(SUPPORT_ROLE_ID).catch(() => null) : null;

    const membersToNotify = new Map();
    if (adminRole) adminRole.members.forEach(m => { if (!m.user.bot) membersToNotify.set(m.id, m); });
    if (supportRole) supportRole.members.forEach(m => { if (!m.user.bot) membersToNotify.set(m.id, m); });

    for (const [, m] of membersToNotify) {
      await m.user.send(`🆕 **New Ticket**\nServer: ${guild.name}\nChannel: ${channel}\nLink: https://discord.com/channels/${guild.id}/${channel.id}`).catch(() => {});
    }
  } catch (err) { console.error("Ticket Event Error:", err); }
});

// ===================== [2] الأوامر وإدارة المحادثة (السرية) =====================
client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;

    // --- (أ) الأوامر داخل السيرفر ---
    if (message.guild) {
      const content = message.content.trim();
      
      if (content === PREFIX + "help" || content === PREFIX + "اوامر" || content === PREFIX + "مساعدة") {
        const member = await message.guild.members.fetch(message.author.id).catch(() => null);
        if (!hasCommandPermission(member)) return;

        // حذف أمر المستخدم فوراً للخصوصية
        setTimeout(() => message.delete().catch(() => null), 500);

        try {
          // بدء الجلسة وتحويلها للخاص
          sessions.set(message.author.id, { 
            step: "choose_action", 
            createdAt: Date.now(), 
            guildId: message.guild.id 
          });

          await message.author.send("🔐 **Stealth Mode**\nReply with (3) for Safe Global Broadcast.");
          
          const notify = await message.reply("Check your DMs! 🔒");
          setTimeout(() => notify.delete().catch(() => null), 3000);
        } catch (e) {
          const errNotify = await message.reply("❌ Open your DMs first!");
          setTimeout(() => errNotify.delete().catch(() => null), 5000);
        }
        return;
      }

      // تنبيه التكت بالمنشن (تلقائي)
      if (TICKET_CATEGORY_ID && message.channel.parentId === TICKET_CATEGORY_ID) {
        const mentionedUsers = message.mentions.users;
        if (mentionedUsers.size > 0) {
          for (const [, user] of mentionedUsers) {
            if (user.id === message.author.id) continue;
            const key = `${message.channelId}:${user.id}`;
            if (Date.now() - (cooldown.get(key) || 0) < COOLDOWN_MS) continue;
            cooldown.set(key, Date.now());
            await user.send(`⚠️ Staff waiting: **#${message.channel.name}**\n${message.url}`).catch(() => {});
          }
        }
      }
    }

    // --- (ب) إدارة الجلسة داخل الخاص (DM) ---
    if (!message.guild) {
      const sess = sessions.get(message.author.id);
      if (!sess || (Date.now() - sess.createdAt > SESSION_TTL_MS)) return;

      const content = message.content.trim();
      
      if (content === "cancel" || content === "الغاء") {
        sessions.delete(message.author.id);
        return message.reply("❌ Cancelled.");
      }

      // اختيار الترويج
      if (sess.step === "choose
