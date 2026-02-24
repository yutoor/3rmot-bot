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

// إعدادات اختيارية (حطها في Variables لو تبي)
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID || null;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || null;

// منع السبام
const cooldown = new Map();
const COOLDOWN_MS = 60 * 1000;

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
    if (!isTicketChannel(message.channel)) return;

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
