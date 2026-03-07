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

// --- الإعدادات ---
const PREFIX = "!";
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;
const BROADCAST_ROLE_ID = process.env.BROADCAST_ROLE_ID;
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID;

const sessions = new Map();
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

client.on("ready", () => {
    console.log(`✅ تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);
});

// ===================== [1] تنبيه عند فتح تكت جديد =====================
client.on("channelCreate", async (channel) => {
    try {
        if (!channel.guild) return;
        const isTicket = channel.name.toLowerCase().startsWith("ticket-") || (TICKET_CATEGORY_ID && channel.parentId === TICKET_CATEGORY_ID);
        if (!isTicket) return;

        const ticketEmbed = new EmbedBuilder()
            .setColor(0xffa500)
            .setTitle("🆕 تنبيه: تكت جديد!")
            .setDescription(`تم فتح تكت جديد بواسطة أحد الأعضاء: ${channel}`)
            .addFields({ name: "رابط التكت", value: `[اضغط هنا للانتقال](https://discord.com/channels/${channel.guild.id}/${channel.id})` })
            .setTimestamp()
            .setFooter({ text: "نظام التنبيهات التلقائي" });

        const adminRole = await channel.guild.roles.fetch(ADMIN_ROLE_ID).catch(() => null);
        if (adminRole) {
            adminRole.members.forEach(m => {
                if (!m.user.bot) m.user.send({ embeds: [ticketEmbed] }).catch(() => null);
            });
        }
    } catch (err) { console.error("خطأ في تنبيه التكت:", err); }
});

// ===================== [2] أمر المساعدة (لوحة التحكم) =====================
client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;

    if (message.content === PREFIX + "مساعدة") {
        // التحقق من الصلاحيات
        if (!message.member.roles.cache.has(ADMIN_ROLE_ID) && !message.member.permissions.has("Administrator")) return;

        // حذف رسالة الأمر فوراً
        setTimeout(() => message.delete().catch(() => null), 500);

        const mainEmbed = new EmbedBuilder()
            .setColor(0x2b2d31)
            .setTitle("🛠️ لوحة تحكم الإدارة")
            .setDescription("مرحباً بك! اختر العملية التي تريد تنفيذها من الأزرار أدناه.\nسيتم تنفيذ جميع الخطوات في الخاص لضمان السرية.")
            .setFooter({ text: "وضع التخفي نشط 🔒" });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_broadcast').setLabel('إعلان جماعي').setStyle(ButtonStyle.Success).setEmoji('📢'),
            new ButtonBuilder().setCustomId('btn_ticket_alert').setLabel('تنبيه صاحب تكت').setStyle(ButtonStyle.Primary).setEmoji('🎫')
        );

        await message.channel.send({ embeds: [mainEmbed], components: [row] });
    }
});

// ===================== [3] معالجة الأزرار والرسائل الخاصة =====================
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'btn_broadcast') {
        sessions.set(interaction.user.id, { step: "ask_promo", guildId: interaction.guild.id });
        await interaction.user.send("📢 **إعلان جماعي:**\nأرسل الآن نص الإعلان الذي تريد إرساله للجميع (سيتم تطبيق فاصل 10 ثوانٍ تلقائياً).");
        await interaction.reply({ content: "تم إرسال التفاصيل في الخاص! 🔒", ephemeral: true });
    }

    if (interaction.customId === 'btn_ticket_alert') {
        sessions.set(interaction.user.id, { step: "ask_ticket_user", guildId: interaction.guild.id });
        await interaction.user.send("🎫 **تنبيه تكت:**\nقم بعمل منشن (Tag) للعضو أو أرسل الـ ID الخاص به لتنبيهه.");
        await interaction.reply({ content: "تم إرسال التفاصيل في الخاص! 🔒", ephemeral: true });
    }
});

// ===================== [4] تنفيذ العمليات في الخاص =====================
client.on("messageCreate", async (message) => {
    if (message.guild || message.author.bot) return;

    const sess = sessions.get(message.author.id);
    if (!sess) return;

    // --- تنبيه صاحب التكت ---
    if (sess.step === "ask_ticket_user") {
        const userId = message.content.replace(/[<@!>]/g, "");
        sess.targetUserId = userId;
        sess.step = "ask_ticket_body";
        return message.reply("✍️ الآن أرسل الرسالة التي تريد توجيهها لهذا العضو:");
    }
    
    if (sess.step === "ask_ticket_body") {
        const guild = client.guilds.cache.get(sess.guildId);
        const target = await guild.members.fetch(sess.targetUserId).catch(() => null);
        if (target) {
            await target.send(`⚠️ **تنبيه هام بخصوص التكت الخاص بك في ${guild.name}**\n\n${message.content}`).catch(() => null);
            message.reply("✅ تم إرسال التنبيه للعضو بنجاح.");
        } else { message.reply("❌ لم أتمكن من العثور على هذا العضو."); }
        return sessions.delete(message.author.id);
    }

    // --- الإرسال الجماعي ---
    if (sess.step === "ask_promo") {
        const guild = client.guilds.cache.get(sess.guildId);
        const role = await guild.roles.fetch(BROADCAST_ROLE_ID).catch(() => null);
        const targets = role ? role.members.filter(m => !m.user.bot) : [];

        if (!targets.size) return message.reply("❌ لا يوجد أعضاء في الرتبة المحددة.");
        
        sessions.delete(message.author.id);
        await message.reply(`⏳ جاري بدء الإرسال لـ ${targets.size} عضو...`);

        const targetArray = Array.from(targets.values());
        for (let i = 0; i < targetArray.length; i++) {
            try {
                await targetArray[i].send(`📢 **تحديث جديد من ${guild.name}**\n\n${message.content}`);
            } catch (e) { console.log(`فشل الإرسال للعضو: ${targetArray[i].user.tag}`); }
            if (i < targetArray.length - 1) await wait(10000); // فاصل 10 ثوانٍ
        }
        return message.author.send("✅ تم الانتهاء من عملية الإرسال الجماعي بنجاح.");
    }
});

client.login(process.env.DISCORD_TOKEN);
