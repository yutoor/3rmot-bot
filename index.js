const { 
    Client, GatewayIntentBits, Partials, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType
} = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent
    ],
});

// --- الإعدادات ---
const ADMIN_ROLE_ID = "1466572944166883461"; 
const BROADCAST_ROLE_ID = process.env.BROADCAST_ROLE_ID; 
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

client.on("ready", () => {
    console.log(`✅ البوت الأسطوري جاهز بـ 6 أزرار: ${client.user.tag}`);
});

// ===================== [1] اللوحة الرئيسية بـ 6 أزرار =====================
client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;

    if (message.content === "مساعدة" || message.content === "مساعده") {
        if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) return;
        setTimeout(() => message.delete().catch(() => null), 200);

        const mainEmbed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle("🛡️ لوحة التحكم الإدارية الكبرى")
            .setDescription("# اختر العملية المطلوبة\nسيتم فتح نافذة منبثقة لكل عملية لتعبئة البيانات.")
            .setImage("https://i.imgur.com/3607a7.png"); 

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('modal_broadcast').setLabel('إعلان جماعي').setStyle(ButtonStyle.Success).setEmoji('📢'),
            new ButtonBuilder().setCustomId('modal_warn').setLabel('تحذير').setStyle(ButtonStyle.Danger).setEmoji('⚠️'),
            new ButtonBuilder().setCustomId('modal_kick').setLabel('فصل (Kick)').setStyle(ButtonStyle.Danger).setEmoji('👢')
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('modal_alert').setLabel('تنبيه خاص').setStyle(ButtonStyle.Primary).setEmoji('🔔'),
            new ButtonBuilder().setCustomId('modal_role').setLabel('إعطاء رتبة').setStyle(ButtonStyle.Secondary).setEmoji('🎖️'),
            new ButtonBuilder().setCustomId('modal_info').setLabel('معلومات').setStyle(ButtonStyle.Secondary).setEmoji('ℹ️')
        );

        await message.channel.send({ embeds: [mainEmbed], components: [row1, row2] });
    }
});

// ===================== [2] فتح النوافذ (Modals) لكل زر =====================
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) return;

    const op = interaction.customId;

    // نافذة الإعلان
    if (op === 'modal_broadcast') {
        const modal = new ModalBuilder().setCustomId('broadcast_modal').setTitle('إرسال إعلان للجميع');
        const input = new TextInputBuilder().setCustomId('text').setLabel("نص الإعلان").setStyle(TextInputStyle.Paragraph).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
    }

    // نافذة التحذير / التنبيه / الفصل (تطلب آيدي وسبب)
    if (['modal_warn', 'modal_kick', 'modal_alert'].includes(op)) {
        const titles = { 'modal_warn': 'تحذير عضو', 'modal_kick': 'فصل عضو', 'modal_alert': 'تنبيه خاص' };
        const modal = new ModalBuilder().setCustomId(op.replace('modal_', '') + '_modal').setTitle(titles[op]);
        const idInput = new TextInputBuilder().setCustomId('target_id').setLabel("آيدي العضو").setStyle(TextInputStyle.Short).setRequired(true);
        const reasonInput = new TextInputBuilder().setCustomId('reason').setLabel("السبب / الرسالة").setStyle(TextInputStyle.Paragraph).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(idInput), new ActionRowBuilder().addComponents(reasonInput));
        return interaction.showModal(modal);
    }

    // نافذة الرتبة
    if (op === 'modal_role') {
        const modal = new ModalBuilder().setCustomId('role_modal').setTitle('إعطاء رتبة لعضو');
        const idInput = new TextInputBuilder().setCustomId('target_id').setLabel("آيدي العضو").setStyle(TextInputStyle.Short).setRequired(true);
        const roleInput = new TextInputBuilder().setCustomId('role_id').setLabel("آيدي الرتبة").setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(idInput), new ActionRowBuilder().addComponents(roleInput));
        return interaction.showModal(modal);
    }
});

// ===================== [3] تنفيذ العمليات النهائية =====================
client.on("interactionCreate", async (interaction) => {
    if (interaction.type !== InteractionType.ModalSubmit) return;

    const guild = interaction.guild;
    const op = interaction.customId;

    // تنفيذ الإعلان الجماعي
    if (op === 'broadcast_modal') {
        const text = interaction.fields.getTextInputValue('text');
        await interaction.reply({ content: `⏳ جاري الإرسال بفاصل 10 ثوانٍ...`, ephemeral: true });
        const role = await guild.roles.fetch(BROADCAST_ROLE_ID).catch(() => null);
        const targets = role ? role.members.filter(m => !m.user.bot) : [];
        for (const [, target] of targets) {
            await target.send(`# 📢 إعلان هـام\n━━━━━━━━━━━━━\n${text}`).catch(() => null);
            await wait(10000);
        }
        return interaction.followUp({ content: `✅ تم الإرسال لـ ${targets.size} عضو.`, ephemeral: true });
    }

    // تنفيذ الرتبة
    if (op === 'role_modal') {
        const userId = interaction.fields.getTextInputValue('target_id');
        const roleId = interaction.fields.getTextInputValue('role_id');
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member) {
            await member.roles.add(roleId).catch(() => null);
            return interaction.reply({ content: `✅ تم إعطاء الرتبة للعضو ${member.user.tag}`, ephemeral: true });
        }
        return interaction.reply({ content: "❌ لم يتم العثور على العضو.", ephemeral: true });
    }

    // تنفيذ التحذير / الفصل / التنبيه
    const actionType = op.replace('_modal', '');
    const userId = interaction.fields.getTextInputValue('target_id');
    const reason = interaction.fields.getTextInputValue('reason');
    const member = await guild.members.fetch(userId).catch(() => null);

    if (!member) return interaction.reply({ content: "❌ العضو غير موجود.", ephemeral: true });

    if (actionType === 'warn') await member.send(`# ⚠️ تحذير رسمي\n**السبب:** ${reason}`).catch(() => null);
    if (actionType === 'alert') await member.send(`# 🔔 تنبيه إداري\n${reason}`).catch(() => null);
    if (actionType === 'kick') {
        await member.send(`# 👢 قرار فصل\n**السبب:** ${reason}`).catch(() => null);
        await member.kick(reason).catch(() => null);
    }

    await interaction.reply({ content: `✅ تم تنفيذ عملية (${actionType}) بنجاح.`, ephemeral: true });
});

client.login(process.env.DISCORD_TOKEN);
