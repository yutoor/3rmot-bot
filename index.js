const { 
    Client, GatewayIntentBits, Partials, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle 
} = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
});

// --- الإعدادات الثابتة ---
const ADMIN_ROLE_ID = "1466572944166883461"; // الرتبة المسموح لها باستدعاء البوت
const BROADCAST_ROLE_ID = process.env.BROADCAST_ROLE_ID; // رتبة الإعلان الجماعي
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const sessions = new Map();

client.on("ready", () => {
    console.log(`🚀 تم تشغيل أقوى بوت: ${client.user.tag}`);
});

// ===================== [1] أمر المساعدة (استدعاء البوت) =====================
client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;

    // قبول "مساعدة" أو "مساعده" بدون استفهام وبأي مسافة
    const content = message.content.trim().replace(/\s+/g, ' ');
    if (content === "مساعدة" || content === "مساعده" || content === "!مساعدة") {
        
        // التحقق الصارم من الرتبة
        if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) return;

        // حذف رسالة الاستدعاء فوراً
        setTimeout(() => message.delete().catch(() => null), 500);

        const mainEmbed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle("🛡️ لوحة التحكم الإدارية الكبرى")
            .setDescription("# اختر العملية المطلوبة\nسيتم نقلك للخاص لتكملة الإجراءات بسرية تامة.")
            .setTimestamp();

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('op_broadcast').setLabel('إعلان للجميع').setStyle(ButtonStyle.Success).setEmoji('📢'),
            new ButtonBuilder().setCustomId('op_warn').setLabel('تحذير').setStyle(ButtonStyle.Danger).setEmoji('⚠️'),
            new ButtonBuilder().setCustomId('op_kick').setLabel('فصل (Kick)').setStyle(ButtonStyle.Danger).setEmoji('👢')
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('op_alert').setLabel('تنبيه خاص').setStyle(ButtonStyle.Primary).setEmoji('🔔'),
            new ButtonBuilder().setCustomId('op_role').setLabel('إعطاء رتبة').setStyle(ButtonStyle.Secondary).setEmoji('🎖️')
        );

        await message.channel.send({ embeds: [mainEmbed], components: [row1, row2] });
    }
});

// ===================== [2] معالجة الأزرار والخاص والـ AI =====================
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) return interaction.reply({ content: "لا تملك الصلاحية.", ephemeral: true });

    const op = interaction.customId;
    sessions.set(interaction.user.id, { step: "init", action: op, guildId: interaction.guild.id });

    let startText = "بدأت العملية! ";
    if (op === 'op_broadcast') startText += "أرسل نص **الإعلان** الآن.";
    else if (op === 'op_role') startText += "أرسل **آيدي الشخص** ثم **آيدي الرتبة**.";
    else startText += "قم بعمل **منشن للعضو
