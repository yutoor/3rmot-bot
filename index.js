const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, 
    TextInputStyle, InteractionType 
} = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent
    ],
});

// --- الإعدادات الثابتة (تم تحديث رتبة الشوب) ---
const ADMIN_ROLE_ID = "1466572944166883461"; 
const BROADCAST_ROLE_ID = "1467517313980043448"; // آيدي رتبة شوب الجديد
const moonImage = "https://i.imgur.com/83pL3Ue.jpg"; 
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

client.on("ready", () => {
    console.log(`🌕 اللوحة جاهزة للإرسال لرتبة شوب: ${client.user.tag}`);
});

// ===================== [1] استدعاء اللوحة الاحترافية =====================
client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;

    if (message.content === "مساعدة" || message.content === "مساعده") {
        if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) return;
        setTimeout(() => message.delete().catch(() => null), 200);

        const mainEmbed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle("🛡️ لوحة التحكم الإدارية الكبرى")
            .setDescription("# نظام الإرسال لرتبة شوب نشط\nاضغط على الزر واكتب الإعلان، وسيصل لكل من يحمل رتبة <@&1467517313980043448>.")
            .setImage(moonImage)
            .setFooter({ text: "Alpha Stealth System • 2026", iconURL: client.user.displayAvatarURL() });

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

// ===================== [2] فتح النوافذ المنبثقة (Modals) =====================
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) return;

    const op = interaction.customId;

    if (op === 'modal_broadcast') {
        const modal = new ModalBuilder().setCustomId('broadcast_modal').setTitle('إرسال إعلان لرتبة شوب');
        const input = new TextInputBuilder().setCustomId('text').setLabel("نص الإعلان").setStyle(TextInputStyle.Paragraph).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
    }
    
    // باقي النوافذ (تحذير، فصل، رتبة)
    if (['modal_warn', 'modal_kick', 'modal_alert'].includes(op)) {
        const titles = { 'modal_warn': 'تحذير عضو', 'modal_kick': 'فصل عضو', 'modal_alert': 'تنبيه خاص' };
        const modal = new ModalBuilder().setCustomId(op.replace('modal_', '') + '_modal').setTitle(titles[op]);
        const idInput = new TextInputBuilder().setCustomId('target_id').setLabel("آيدي العضو").setStyle(TextInputStyle.Short).setRequired(true);
        const reasonInput = new TextInputBuilder().setCustomId('reason').setLabel("السبب / الرسالة").setStyle(TextInputStyle.Paragraph).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(idInput), new ActionRowBuilder().addComponents(reasonInput));
        return interaction.showModal(modal);
    }

    if (op === 'modal_role') {
        const modal = new ModalBuilder().setCustomId('role_modal').setTitle('إعطاء رتبة لعضو');
        const idInput = new TextInputBuilder().setCustomId('target_id').setLabel("آيدي العضو").setStyle(TextInputStyle.Short).setRequired(true);
        const roleInput = new TextInputBuilder().setCustomId('role_id').setLabel("آيدي الرتبة").setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(idInput), new ActionRowBuilder().addComponents(roleInput));
        return interaction.showModal(modal);
    }
});

// ===================== [3] تنفيذ العمليات بعد تعبئة المربعات =====================
client.on("interactionCreate", async (interaction) => {
    if (interaction.type !== InteractionType.ModalSubmit) return;

    const guild = interaction.guild;
    const op = interaction.customId;

    if (op === 'broadcast_modal') {
        const text = interaction.fields.getTextInputValue('text');
        await interaction.reply({ content: `⏳ جاري فحص رتبة شوب وبدء الإرسال...`, ephemeral: true });

        try {
            const role = await guild.roles.fetch(BROADCAST_ROLE_ID);
            if (!role) return interaction.followUp({ content: "❌ خطأ: لم يتم العثور على رتبة شوب في السيرفر.", ephemeral: true });

            const targets = role.members.filter(m => !m.user.bot);
            if (targets.size === 0) return interaction.followUp({ content: "❌ لا يوجد أي عضو يحمل رتبة شوب حالياً.", ephemeral: true });

            let successCount = 0;
            const targetArray = Array.from(targets.values());

            for (let i = 0; i < targetArray.length; i++) {
                try {
                    await targetArray[i].send(`# 📢 إعلان هـام\n━━━━━━━━━━━━━\n${text}\n━━━━━━━━━━━━━`);
                    successCount++;
                } catch (e) {
                    console.log(`فشل الإرسال للعضو: ${targetArray[i].user.tag}`);
                }
                if (i < targetArray.length - 1) await wait(10000); // فاصل 10 ثوانٍ للأمان
            }
            return interaction.followUp({ content: `✅ اكتمل الإرسال! وصل لـ ${successCount} من أصل ${targets.size} شخص في شوب.`, ephemeral: true });
        } catch (err) {
            return interaction.followUp({ content: "❌ حدث خطأ تقني في استدعاء الرتبة.", ephemeral: true });
        }
    }

    // تنفيذ باقي العمليات (فصل، تحذير، رتبة)
    const actionType = op.replace('_modal', '');
    const userId = interaction.fields.getTextInputValue('target_id');
    const member = await guild.members.fetch(userId).catch(() => null);

    if (op === 'role_modal') {
        const roleId = interaction.fields.getTextInputValue('role_id');
        if (member) {
            await member.roles.add(roleId).catch(() => null);
            return interaction.reply({ content: `✅ تم إعطاء الرتبة للعضو ${member.user.tag}`, ephemeral: true });
        }
    } else {
        const reason = interaction.fields.getTextInputValue('reason');
        if (!member) return interaction.reply({ content: "❌ العضو غير موجود.", ephemeral: true });
        if (actionType === 'warn') await member.send(`# ⚠️ تحذير رسمي\n**السبب:** ${reason}`).catch(() => null);
        if (actionType === 'alert') await member.send(`# 🔔 تنبيه إداري\n${reason}`).catch(() => null);
        if (actionType === 'kick') { await member.send(`# 👢 قرار فصل\n**السبب:** ${reason}`).catch(() => null); await member.kick(reason).catch(() => null); }
        await interaction.reply({ content: `✅ تم تنفيذ عملية (${actionType}) بنجاح.`, ephemeral: true });
    }
});

client.login(process.env.DISCORD_TOKEN);
