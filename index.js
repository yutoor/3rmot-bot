const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
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

// --- إعدادات النظام ---
const PREFIX = "!";
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;
const BROADCAST_ROLE_ID = process.env.BROADCAST_ROLE_ID;
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID;

const sessions = new Map();
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

client.on("ready", () => {
    console.log(`✅ Logged in as: ${client.user.tag}`);
});

// ===================== [1] نظام الأوامر (اللوحة الرئيسية) =====================
client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;

    if (message.content === PREFIX + "help" || message.content === PREFIX + "اوامر") {
        // التحقق من الصلاحيات
        if (!message.member.roles.cache.has(ADMIN_ROLE_ID) && !message.member.permissions.has("Administrator")) return;

        // حذف رسالة المشرف فوراً
        setTimeout(() => message.delete().catch(() => null), 500);

        // بناء الـ Embed (نفس ستايل الصورة)
        const helpEmbed = new EmbedBuilder()
            .setColor(0x2b2d31)
            .setTitle("🛠️ Management Dashboard")
            .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL() })
            .setDescription(
                "Welcome to the high-security broadcast system.\n\n" +
                "**Available Operations:**\n" +
                "• **Safe Broadcast:** Send DMs to members with 10s delay.\n" +
                "• **Stealth Mode:** Entire setup happens in your DM."
            )
            .addFields(
                { name: "📋 Current Role", value: `<@&${BROADCAST_ROLE_ID}>`, inline: true },
                { name: "🛡️ Security", value: "Anti-Spam Enabled", inline: true }
            )
            .setFooter({ text: "System Online • Stealth Mode Active" })
            .setTimestamp();

        // بناء الأزرار (Buttons)
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('initiate_broadcast')
                    .setLabel('Start Broadcast')
                    .setEmoji('📢')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('server_stats')
                    .setLabel('Stats')
                    .setEmoji('📊')
                    .setStyle(ButtonStyle.Secondary)
            );

        await message.channel.send({ embeds: [helpEmbed], components: [row] });
    }
});

// ===================== [2] معالجة الأزرار والعمليات السرية =====================
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'initiate_broadcast') {
        try {
            // بدء الجلسة في الخاص
            sessions.set(interaction.user.id, { 
                step: "ask_body", 
                guildId: interaction.guild.id, 
                createdAt: Date.now() 
            });

            await interaction.user.send("🔒 **Stealth Session Started.**\nPlease type the **Message** you want to broadcast:");
            await interaction.reply({ content: "Check your DMs! 🔒", ephemeral: true });
        } catch (e) {
            await interaction.reply({ content: "❌ Error: Please open your DMs first.", ephemeral: true });
        }
    }

    if (interaction.customId === 'server_stats') {
        await interaction.reply({ content: `Current Server: **${interaction.guild.name}**\nMembers in Role: Checking...`, ephemeral: true });
    }
});

// ===================== [3] نظام الإرسال الآمن (في الخاص) =====================
client.on("messageCreate", async (message) => {
    if (message.guild || message.author.bot) return;

    const sess = sessions.get(message.author.id);
    if (!sess || sess.step !== "
