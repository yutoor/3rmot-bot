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

// إعدادات البوت من Variables
const PREFIX = "!";
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;
const BROADCAST_ROLE_ID = process.env.BROADCAST_ROLE_ID;
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID;

client.on("ready", () => {
    console.log(`✅ ${client.user.tag} is Online!`);
});

// --- نظام الأوامر مع الـ Embed والأزرار ---
client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;

    if (message.content === PREFIX + "help" || message.content === PREFIX + "اوامر") {
        // التحقق من الصلاحيات
        if (!message.member.roles.cache.has(ADMIN_ROLE_ID) && !message.member.permissions.has("Administrator")) return;

        // حذف رسالة المستخدم لنظافة الشات
        setTimeout(() => message.delete().catch(() => null), 1000);

        // إنشاء الـ Embed (البطاقة الملونة)
        const helpEmbed = new EmbedBuilder()
            .setColor(0x2b2d31) // لون ديسكورد الغامق الفخم
            .setTitle("🛡️ Dashboard Control Panel")
            .setDescription("Welcome to the Admin Command Center.\nUse the buttons below to manage the bot.")
            .addFields(
                { name: "📢 Broadcast", value: "Send safe messages to members with 10s delay.", inline: true },
                { name: "🔒 Stealth Mode", value: "All operations are handled via DMs.", inline: true }
            )
            .setFooter({ text: "Secure System • March 2026", iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        // إنشاء الأزرار (Buttons)
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('start_broadcast')
                    .setLabel('Start Broadcast')
                    .setEmoji('📢')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setLabel('Support Server')
                    .setURL('https://discord.gg/yourlink') // حط رابط سيرفرك هنا
                    .setStyle(ButtonStyle.Link)
            );

        // إرسال الرسالة
        const msg = await message.reply({ 
            embeds: [helpEmbed], 
            components: [buttons] 
        });

        // حذف الرسالة بعد 30 ثانية
        setTimeout(() => msg.delete().catch(() => null), 30000);
    }
});

// معالجة ضغط الأزرار
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'start_broadcast') {
        try {
            await interaction.user.send("✅ **Stealth Session Started.**\nPlease type the message you want to broadcast now:");
            await interaction.reply({ content: "Check your DMs! 🔒", ephemeral: true });
        } catch (e) {
            await interaction.reply({ content: "❌ Please open your DMs first.", ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
