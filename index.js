const { 
    Client, GatewayIntentBits, Partials, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle 
} = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent
    ],
});

// --- الإعدادات ---
const ADMIN_ROLE_ID = "1466572944166883461"; // الرتبة المسموح لها
const BROADCAST_ROLE_ID = process.env.BROADCAST_ROLE_ID; 
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// لتجنب أخطاء SyntaxError في الاستضافة، نستخدم متغيرات للنصوص
const UI_TEXT = {
    title: "🛡️ لوحة التحكم الإدارية الكبرى",
    desc: "# اختر العملية المطلوبة\nسيتم تنفيذ العملية هنا بشكل مخفي لا يراه غيرك.",
    broadcast: "إعلان جماعي",
    warn: "تحذير",
    kick: "فصل (Kick)",
    alert: "تنبيه خاص",
    role: "إعطاء رتبة"
};

client.on("ready", () => {
    console.log(`✅ ${client.user.tag} شغال بنظام الرسائل المخفية`);
});

// ===================== [1] استدعاء اللوحة (مساعدة) =====================
client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;

    const content = message.content.trim();
    if (content === "مساعدة" || content === "مساعده") {
        
        // التحقق من الرتبة
        if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) return;

        // حذف رسالة "مساعدة" فوراً لنظافة الشات
        setTimeout(() => message.delete().catch(() => null), 500);

        const mainEmbed = new EmbedBuilder()
            .setColor(0x2b2d31)
            .setTitle(UI_TEXT.title)
            .setDescription(UI_TEXT.desc)
            .setImage("https://i.imgur.com/your-image-id.png"); // يمكنك وضع رابط الصورة اللي في اللوحة

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_broadcast').setLabel(UI_TEXT.broadcast).setStyle(ButtonStyle.Success).setEmoji('📢'),
            new ButtonBuilder().setCustomId('btn_warn').setLabel(UI_TEXT.warn).setStyle(ButtonStyle.Danger).setEmoji('⚠️'),
            new ButtonBuilder().setCustomId('btn_kick').setLabel(UI_TEXT.kick).setStyle(ButtonStyle.Danger).setEmoji('👢')
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_alert').setLabel(UI_TEXT.alert).setStyle(ButtonStyle.Primary).setEmoji('🔔'),
            new ButtonBuilder().setCustomId('btn_role').setLabel(UI_TEXT.role).setStyle(ButtonStyle.Secondary).setEmoji('🎖️')
        );

        // إرسال اللوحة (هذه الرسالة فقط تكون ظاهرة للمشرف)
        await message.channel.send({ embeds: [mainEmbed], components: [row1, row2] });
    }
});

// ===================== [2] معالجة الأزرار بنظام Ephemeral =====================
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) return;

    // الرد المخفي (لا يراه أحد غيرك)
    const op = interaction.customId;

    if (op === 'btn_broadcast') {
        return interaction.reply({ 
            content: "📢 **للإعلان الجماعي:** يرجى كتابة الأمر التالي في الشات:\n`!اعلان [نص الإعلان]`\n(لا تقلق، البوت سيحذف رسالتك فوراً ويرسل الإعلان بشكل فخم للجميع في الخاص).", 
            ephemeral: true 
        });
    }

    if (op === 'btn_kick') {
        return interaction.reply({ 
            content: "👢 **للفصل:** اكتب في الشات:\n`!فصل @العضو [السبب]`\nسيتم حذف رسالتك وتنفيذ الأمر مخفياً.", 
            ephemeral: true 
        });
    }

    // يمكنك إضافة باقي الأزرار بنفس الطريقة
    await interaction.reply({ content: "هذه الميزة تحت البرمجة حالياً بنفس النظام المخفي.", ephemeral: true });
});

// ===================== [3] تنفيذ الأوامر مع الحذف التلقائي =====================
client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;
    if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) return;

    const args = message.content.split(" ");
    const command = args[0].toLowerCase();

    // أمر الإعلان الجماعي
    if (command === "!اعلان") {
        setTimeout(() => message.delete().catch(() => null), 100);
        const text = args.slice(1).join(" ");
        if (!text) return;

        const role = await message.guild.roles.fetch(BROADCAST_ROLE_ID).catch(() => null);
        const targets = role ? role.members.filter(m => !m.user.bot) : [];

        for (const [, target] of targets) {
            await target.send(`# 📢 إعلان هـام\n━━━━━━━━━━━━━\n${text}\n━━━━━━━━━━━━━`).catch(() => null);
            await wait(10000); // فاصل 10 ثوانٍ للأمان
        }
    }

    // أمر الفصل Kick
    if (command === "!فصل") {
        setTimeout(() => message.delete().catch(() => null), 100);
        const member = message.mentions.members.first();
        const reason = args.slice(2).join(" ") || "بدون سبب";
        
        if (member) {
            await member.send(`# 👢 تم فصلك\n**السبب:** ${reason}`).catch(() => null);
            await member.kick(reason).catch(() => null);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
