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

// --- الإعدادات (تأكد من صحة الرتبة) ---
const ADMIN_ROLE_ID = "1466572944166883461"; 
const BROADCAST_ROLE_ID = process.env.BROADCAST_ROLE_ID; 

const sessions = new Map();
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

client.on("ready", () => {
    console.log(`✅ البوت العملاق متصل: ${client.user.tag}`);
});

// ===================== [1] استدعاء البوت (مساعدة) =====================
client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;

    const content = message.content.trim();
    if (content === "مساعدة" || content === "مساعده") {
        if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) return;

        setTimeout(() => message.delete().catch(() => null), 500);

        const mainEmbed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle("🛡️ لوحة التحكم الإدارية")
            .setDescription("# اختر العملية المطلوبة\nسيتم نقلك للخاص لتكملة الإجراءات بسرية.")
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

// ===================== [2] معالجة الأزرار والخاص =====================
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) return interaction.reply({ content: "لا تملك الصلاحية.", ephemeral: true });

    const op = interaction.customId;
    sessions.set(interaction.user.id, { step: "init", action: op, guildId: interaction.guild.id });

    let instruction = "أرسل الآن (ID العضو) أو قم بعمل (منشن) له.";
    if (op === 'op_broadcast') instruction = "أرسل نص **الإعلان الفخم** الآن مباشرة:";

    await interaction.user.send(`🚀 **بدأت عملية: ${op}**\n${instruction}`).catch(() => null);
    await interaction.reply({ content: "افتح الخاص الآن 🔒", ephemeral: true });
});

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    if (!message.guild) {
        const sess = sessions.get(message.author.id);
        
        // --- نظام الرد الذكي AI للأعضاء العاديين ---
        if (!sess) {
            return message.reply("أهلاً بك! أنا المساعد الذكي 🤖. كيف يمكنني مساعدتك اليوم؟ (ملاحظة: لا يمكنك استخدام الأوامر الإدارية هنا).");
        }

        const guild = client.guilds.cache.get(sess.guildId);
        if (!guild) return;

        // تنفيذ الإعلان الجماعي
        if (sess.action === 'op_broadcast') {
            const role = await guild.roles.fetch(BROADCAST_ROLE_ID).catch(() => null);
            const targets = role ? role.members.filter(m => !m.user.bot) : [];
            sessions.delete(message.author.id);
            await message.reply(`⏳ جاري الإرسال لـ ${targets.size} عضو...`);

            for (const [, target] of targets) {
                await target.send(`# 📢 إعـلان هـام\n━━━━━━━━━━━━━━\n${message.content}\n━━━━━━━━━━━━━━`).catch(() => null);
                await wait(10000);
            }
            return message.reply("✅ اكتمل الإرسال بنجاح.");
        }

        // معالجة الخطوات (تحذير، فصل، تنبيه، رتبة)
        if (sess.step === "init") {
            sess.targetId = message.content.replace(/[<@!>]/g, "");
            
            if (sess.action === 'op_role') {
                sess.step = "ask_role_id";
                return message.reply("✍️ أرسل الآن **آيدي الرتبة** (ID) التي تريد إعطاءها لهذا العضو:");
            }
            
            sess.step = "ask_reason";
            return message.reply("✍️ أرسل الآن **السبب** أو نص الرسالة:");
        }

        if (sess.step === "ask_role_id") {
            const member = await guild.members.fetch(sess.targetId).catch(() => null);
            const roleId = message.content.trim();
            if (member) {
                await member.roles.add(roleId).then(() => message.reply("✅ تم إعطاء الرتبة.")).catch(e => message.reply("❌ فشل: تأكد من صلاحيات البوت وآيدي الرتبة."));
            } else { message.reply("❌ لم أجد العضو."); }
            return sessions.delete(message.author.id);
        }

        if (sess.step === "ask_reason") {
            const member = await guild.members.fetch(sess.targetId).catch(() => null);
            if (!member) return message.reply("❌ لم أجد العضو.");

            const reason = message.content;
            sessions.delete(message.author.id);

            if (sess.action === 'op_warn') {
                await member.send(`# ⚠️ تحذير رسمي\n**السبب:** ${reason}`).catch(() => null);
                return message.reply("✅ تم التحذير.");
            }
            if (sess.action === 'op_kick') {
                await member.send(`# 👢 قرار فصل\n**السبب:** ${reason}`).catch(() => null);
                await member.kick(reason);
                return message.reply("✅ تم الفصل.");
            }
            if (sess.action === 'op_alert') {
                await member.send(`# 🔔 تنبيه إداري\n${reason}`).catch(() => null);
                return message.reply("✅ تم التنبيه.");
            }
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
