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

// --- الإعدادات (تأكد من صحة الآيدي) ---
const ADMIN_ROLE_ID = "1466572944166883461"; 
const BROADCAST_ROLE_ID = process.env.BROADCAST_ROLE_ID; 

const sessions = new Map();
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// نصوص لتجنب أخطاء الترميز (UTF-8 safe)
const txt = {
    helpTitle: "🛡️ لوحة التحكم الإدارية الكبرى",
    helpDesc: "# اختر العملية المطلوبة\nسيتم نقلك للخاص لتكملة الإجراءات بسرية تامة.",
    aiReply: "أنا المساعد الذكي الخاص بهذا البوت 🤖. لا يمكنني تنفيذ أوامر إدارية لك، ولكن يمكنني الدردشة معك! إذا كنت بحاجة لمساعدة حقيقية، تواصل مع الإدارة في السيرفر.",
    forbidden: "عذراً، هذا الأمر مخصص للإدارة فقط."
};

client.on("ready", () => {
    console.log(`✅ Bot Started: ${client.user.tag}`);
});

// ===================== [1] استدعاء البوت (مساعدة) =====================
client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;

    const content = message.content.trim();
    if (content === "مساعدة" || content === "مساعده") {
        
        // التحقق من الرتبة المحددة
        if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) return;

        setTimeout(() => message.delete().catch(() => null), 500);

        const mainEmbed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle(txt.helpTitle)
            .setDescription(txt.helpDesc)
            .setThumbnail(client.user.displayAvatarURL());

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('op_broadcast').setLabel('إعلان جماعي').setStyle(ButtonStyle.Success).setEmoji('📢'),
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

// ===================== [2] الأزرار والـ AI في الخاص =====================
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) return interaction.reply({ content: txt.forbidden, ephemeral: true });

    const op = interaction.customId;
    sessions.set(interaction.user.id, { step: "init", action: op, guildId: interaction.guild.id });

    await interaction.user.send(`🚀 **بدأت العملية: ${op}**\nأرسل الآن (ID العضو) أو قم بعمل (منشن) له لبدء الإجراء.`).catch(() => null);
    await interaction.reply({ content: "افتح الخاص الآن 🔒", ephemeral: true });
});

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    // --- نظام الرد في الخاص ---
    if (!message.guild) {
        const sess = sessions.get(message.author.id);
        
        // [نظام الـ AI للرد على الأعضاء]
        if (!sess) {
            return message.reply(txt.aiReply);
        }

        // [نظام الإدارة للمشرفين]
        const guild = client.guilds.cache.get(sess.guildId);
        if (!guild) return;

        // 1. الإعلان الجماعي (فخم)
        if (sess.action === 'op_broadcast') {
            const role = await guild.roles.fetch(BROADCAST_ROLE_ID).catch(() => null);
            const targets = role ? role.members.filter(m => !m.user.bot) : [];
            sessions.delete(message.author.id);
            await message.reply(`⏳ جاري الإرسال لـ ${targets.size} عضو...`);

            for (const [, target] of targets) {
                await target.send(`# 📢 إعـلان هـام\n━━━━━━━━━━━━━━\n${message.content}\n━━━━━━━━━━━━━━`).catch(() => null);
                await wait(10000);
            }
            return message.author.send("✅ اكتمل الإرسال بنجاح.");
        }

        // 2. التحذير / الفصل / التنبيه
        if (sess.step === "init") {
            const targetId = message.content.replace(/[<@!>]/g, "");
            sess.targetId = targetId;
            sess.step = "ask_reason";
            return message.reply("✍️ أرسل الآن **السبب** أو نص الرسالة التي ستصل للعضو:");
        }

        if (sess.step === "ask_reason") {
            const member = await guild.members.fetch(sess.targetId).catch(() => null);
            if (!member) return message.reply("❌ لم أجد العضو، تأكد من الآيدي.");

            const reason = message.content;
            sessions.delete(message.author.id);

            if (sess.action === 'op_warn') {
                await member.send(`# ⚠️ تحذير رسمي\nلقد تلقيت تحذيراً من إدارة السيرفر.\n**السبب:** ${reason}`).catch(() => null);
                return message.reply("✅ تم إرسال التحذير.");
            }
            
            if (sess.action === 'op_kick') {
                await member.send(`# 👢 قرار فصل\nتم فصلك من السيرفر.\n**السبب:** ${reason}`).catch(() => null);
                await member.kick(reason);
                return message.reply("✅ تم فصل العضو بنجاح.");
            }

            if (sess.action === 'op_alert') {
                await member.send(`# 🔔 تنبيه إداري\nمرحباً بك، لديك رسالة من الإدارة:\n${reason}`).catch(() => null);
                return message.reply("✅ تم إرسال التنبيه.");
            }
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
