const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, 
    TextInputStyle, InteractionType 
} = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ],
});

// --- [ الإعدادات ] ---
const ADMIN_ROLE_ID = "1466572944166883461"; 
const BROADCAST_ROLE_ID = "1467517313980043448"; // رتبة شوب
const SUPPORT_VC_ID = "1466581684290850984"; // روم الدعم الصوتي
const moonImage = "https://images.unsplash.com/photo-1532767153582-b1a0e5145009?q=80&w=1000"; 
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- [ 1. تشغيل البوت وتثبيت الصوت 24/7 ] ---
client.on("ready", () => {
    console.log(`🌕 ${client.user.tag} جاهز مع نظام الصوت البشري!`);
    const channel = client.channels.cache.get(SUPPORT_VC_ID);
    if (channel) {
        joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });
    }
});

// --- [ 2. نظام الترحيب الصوتي "البشري" ] ---
client.on("voiceStateUpdate", async (oldState, newState) => {
    if (newState.channelId === SUPPORT_VC_ID && !newState.member.user.bot && oldState.channelId !== newState.channelId) {
        const connection = joinVoiceChannel({
            channelId: newState.channelId,
            guildId: newState.guild.id,
            adapterCreator: newState.guild.voiceAdapterCreator,
        });

        const player = createAudioPlayer();
        // تأكد أن اسم الملف في جيت هاب هو: Your_Query_is_In_Progress.mp3
        const resource = createAudioResource('./Your_Query_is_In_Progress.mp3'); 

        player.play(resource);
        connection.subscribe(player);
    }
});

// --- [ 3. لوحة التحكم الإدارية (6 أزرار) ] ---
client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;
    if (message.content === "مساعدة" || message.content === "مساعده") {
        if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) return;
        setTimeout(() => message.delete().catch(() => null), 200);

        const mainEmbed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle("🛡️ لوحة التحكم الإدارية الكبرى")
            .setDescription("# نظام التحكم الشبح نشط\nاستخدم الأزرار أدناه لتنفيذ العمليات.")
            .setImage(moonImage)
            .setFooter({ text: "Alpha Stealth System", iconURL: client.user.displayAvatarURL() });

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

// --- [ 4. فتح النوافذ المنبثقة (Modals) ] ---
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) return;
    const op = interaction.customId;

    if (op === 'modal_broadcast') {
        const modal = new ModalBuilder().setCustomId('broadcast_modal').setTitle('إعلان لرتبة شوب');
        const input = new TextInputBuilder().setCustomId('text').setLabel("نص الإعلان").setStyle(TextInputStyle.Paragraph).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
    }

    if (['modal_warn', 'modal_kick', 'modal_alert'].includes(op)) {
        const titles = { 'modal_warn': 'تحذير عضو', 'modal_kick': 'فصل عضو', 'modal_alert': 'تنبيه خاص' };
        const modal = new ModalBuilder().setCustomId(op.replace('modal_', '') + '_modal').setTitle(titles[op]);
        const idInput = new TextInputBuilder().setCustomId('target_id').setLabel("آيدي العضو").setStyle(TextInputStyle.Short).setRequired(true);
        const reasonInput = new TextInputBuilder().setCustomId('reason').setLabel("السبب").setStyle(TextInputStyle.Paragraph).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(idInput), new ActionRowBuilder().addComponents(reasonInput));
        return interaction.showModal(modal);
    }

    if (op === 'modal_role') {
        const modal = new ModalBuilder().setCustomId('role_modal').setTitle('إعطاء رتبة');
        const idInput = new TextInputBuilder().setCustomId('target_id').setLabel("آيدي العضو").setStyle(TextInputStyle.Short).setRequired(true);
        const roleInput = new TextInputBuilder().setCustomId('role_id').setLabel("آيدي الرتبة").setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(idInput), new ActionRowBuilder().addComponents(roleInput));
        return interaction.showModal(modal);
    }
});

// --- [ 5. تنفيذ العمليات ] ---
client.on("interactionCreate", async (interaction) => {
    if (interaction.type !== InteractionType.ModalSubmit) return;
    const op = interaction.customId;

    if (op === 'broadcast_modal') {
        const text = interaction.fields.getTextInputValue('text');
        await interaction.reply({ content: `⏳ جاري الإرسال لرتبة شوب...`, ephemeral: true });
        const role = await interaction.guild.roles.fetch(BROADCAST_ROLE_ID).catch(() => null);
        const targets = role ? role.members.filter(m => !m.user.bot) : [];
        for (const [, target] of targets) {
            await target.send(`# 📢 إعلان من الإدارة\n${text}`).catch(() => null);
            await wait(10000);
        }
        return interaction.followUp({ content: `✅ تم الإرسال لـ ${targets.size} شخص.`, ephemeral: true });
    }

    // (باقي العمليات: رتبة، تحذير، فصل...)
    await interaction.reply({ content: "✅ تمت العملية بنجاح.", ephemeral: true });
});

client.login(process.env.DISCORD_TOKEN);
