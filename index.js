const { 
    Client, GatewayIntentBits, Partials, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle 
} = require("discord.js");

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

// --- الإعدادات من Variables ---
const PREFIX = "!";
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;
const BROADCAST_ROLE_ID = process.env.BROADCAST_ROLE_ID;
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID;

const sessions = new Map();
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

client.on("ready", () => {
    console.log(`✅ ${client.user.tag} is Online!`);
});

// ===================== [1] تنبيه الإدارة عند فتح تكت جديد =====================
client.on("channelCreate", async (channel) => {
    try {
        if (!channel.guild) return;
        const isTicket = channel.name.toLowerCase().startsWith("ticket-") || (TICKET_CATEGORY_ID && channel.parentId === TICKET_CATEGORY_ID);
        if (!isTicket) return;

        const ticketEmbed = new EmbedBuilder()
            .setColor(0xffa500)
            .setTitle("🆕 New Ticket Opened")
            .setDescription(`A new ticket channel has been created: ${channel}`)
            .addFields({ name: "Link", value: `[Click Here](https://discord.com/channels/${channel.guild.id}/${channel.id})` })
            .setTimestamp();

        const adminRole = await channel.guild.roles.fetch(ADMIN_ROLE_ID).catch(() => null);
        if (adminRole) {
            adminRole.members.forEach(m => {
                if (!m.user.bot) m.user.send({ embeds: [ticketEmbed] }).catch(() => null);
            });
        }
    } catch (err) { console.error(err); }
});

// ===================== [2] الأوامر واللوحة الرئيسية =====================
client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;

    if (message.content === PREFIX + "help" || message.content === PREFIX + "اوامر") {
        if (!message.member.roles.cache.has(ADMIN_ROLE_ID) && !message.member.permissions.has("Administrator")) return;

        setTimeout(() => message.delete().catch(() => null), 500);

        const mainEmbed = new EmbedBuilder()
            .setColor(0x2b2d31)
            .setTitle("🛠️ Control Panel")
            .setDescription("Choose an operation to manage your server privately.")
            .setFooter({ text: "Stealth Mode Active" });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_broadcast').setLabel('Global Broadcast').setStyle(ButtonStyle.Success).setEmoji('📢'),
            new ButtonBuilder().setCustomId('btn_ticket_alert').setLabel('Ticket Alert').setStyle(ButtonStyle.Primary).setEmoji('🎫')
        );

        await message.channel.send({ embeds: [mainEmbed], components: [row] });
    }
});

// ===================== [3] معالجة الأزرار والخاص =====================
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'btn_broadcast') {
        sessions.set(interaction.user.id, { step: "ask_promo", guildId: interaction.guild.id });
        await interaction.user.send("📝 **Global Broadcast:** Type your message now (10s delay applied).");
        await interaction.reply({ content: "Check DMs! 🔒", ephemeral: true });
    }

    if (interaction.customId === 'btn_ticket_alert') {
        sessions.set(interaction.user.id, { step: "ask_ticket_user", guildId: interaction.guild.id });
        await interaction.user.send("🎫 **Ticket Alert:** Mention the user (or ID) to alert them about their ticket.");
        await interaction.reply({ content: "Check DMs! 🔒", ephemeral: true });
    }
});

// ===================== [4] تنفيذ العمليات في الخاص =====================
client.on("messageCreate", async (message) => {
    if (message.guild || message.author.bot) return;

    const sess = sessions.get(message.author.id);
    if (!sess) return;

    // --- إرسال تنبيه لصاحب التكت ---
    if (sess.step === "ask_ticket_user") {
        const userId = message.content.replace(/[<@!>]/g, "");
        sess.targetUserId = userId;
        sess.step = "ask_ticket_body";
        return message.reply("✍️ Now type the message you want to send to this user:");
    }
    if (sess.step === "ask_ticket_body") {
        const guild = client.guilds.cache.get(sess.guildId);
        const
