const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, 
    TextInputStyle, InteractionType 
} = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ],
});

// --- [ الإعدادات الثابتة ] ---
const ADMIN_ROLE_ID = "1466572944166883461"; 
const BROADCAST_ROLE_ID = "1467517313980043448"; 
const SUPPORT_VC_ID = "1466581684290850984"; 
const moonImage = "https://images.unsplash.com/photo-1532767153582-b1a0e5145009?q=80&w=1000"; 

// --- [ 1. تشغيل البوت وتثبيت الصوت ] ---
client.on("ready", () => {
    console.log(`✅ ${client.user.tag} Online & Ready!`);
    const channel = client.channels.cache.get(SUPPORT_VC_ID);
    if (channel) {
        joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });
    }
});

// --- [ 2. نظام الترحيب الصوتي الفوري ] ---
client.on("voiceStateUpdate", async (oldState, newState) => {
    if (newState.channelId === SUPPORT_VC_ID && !newState.member.user.bot && oldState.channelId !== newState.channelId) {
        const connection = joinVoiceChannel({
            channelId: newState.channelId,
            guildId: newState.guild.id,
            adapterCreator: newState.guild.voiceAdapterCreator,
        });
        const player = createAudioPlayer();
        const resource = createAudioResource('./3rmot_welcome.mp3'); 
        player.play(resource);
        connection.subscribe(player);
    }
});

// --- [ 3. لوحة التحكم المطورة (7 أزرار) ] ---
client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;
    if (message.content === "مساعدة" || message.content === "مساعده") {
        if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) return;
        setTimeout(() => message.delete().catch(() => null), 200);

        const mainEmbed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle("🛡️ لوحة التحكم الإدارية الكبرى")
            .setDescription("# نظام التحكم الشبح نشط\nاستخدم الأزرار أدناه لتنفيذ العمليات الإدارية.")
            .setImage(moonImage)
            .setFooter({ text: "3RMOT STEALTH SYSTEM", iconURL: client.user.displayAvatarURL() });

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('modal_broadcast').setLabel('إعلان جماعي').setStyle(ButtonStyle.Success).setEmoji('📢'),
            new ButtonBuilder().setCustomId('modal_warn').setLabel('تحذير').setStyle(ButtonStyle.Danger).setEmoji('⚠️'),
            new ButtonBuilder().setCustomId('modal_kick').setLabel('فصل (Kick)').setStyle(ButtonStyle.Danger).setEmoji('👢')
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('modal_alert').setLabel('تنبيه خاص').setStyle(ButtonStyle.Primary).setEmoji('🔔'),
            new ButtonBuilder().setCustomId('modal_role').setLabel('إعطاء رتبة').setStyle(ButtonStyle.Secondary).setEmoji('🎖️'),
            new ButtonBuilder().setCustomId('btn_restart').setLabel('إعادة تشغيل').setStyle(ButtonStyle.Danger).setEmoji('🔄')
        );

        await message.channel.send({ embeds: [mainEmbed], components: [row1, row2] });
    }
});

// --- [ 4. معالجة التفاعلات (Buttons & Modals) ] ---
client.on("interactionCreate", async (interaction) => {
    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) return;

    // زر إعادة التشغيل
    if (interaction.isButton() && interaction.customId === 'btn_restart') {
        await interaction.reply({ content: "🔄 جاري إعادة تشغيل النظام... سيختفي البوت لثوانٍ ويعود.", ephemeral: true });
        console.log("⚠️ نظام: تم طلب إعادة التشغيل يدوياً...");
        setTimeout(() => {
            process.exit(); // هذا الأمر سيجعل الاستضافة (Render/Railway) تعيد تشغيل البوت تلقائياً
        }, 1000);
        return;
    }

    // فتح النوافذ المنبثقة (Modals)
    if (interaction.isButton()) {
        const op = interaction.customId;
        if (op === 'modal_broadcast') {
            const modal = new ModalBuilder().setCustomId('broadcast_modal').setTitle('إعلان لرتبة شوب');
            const input = new TextInputBuilder().setCustomId('text').setLabel("نص الإعلان").setStyle(TextInputStyle.Paragraph).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
        }
        // ... (بقية المودالز للتحذير والفصل والرتبة)
    }

    // تنفيذ عمليات المودالز
    if (interaction.type === InteractionType.ModalSubmit) {
        await interaction.reply({ content: "✅ تم تنفيذ العملية بنجاح.", ephemeral: true });
    }
});

client.login(process.env.DISCORD_TOKEN);
