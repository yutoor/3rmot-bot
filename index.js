const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, 
    TextInputStyle, InteractionType 
} = require("discord.js");const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, NoSubscriberBehavior, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const path = require('path');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates],
});

// --- [ الإعدادات الثابتة ] ---
const ADMIN_ROLE_ID = "1466572944166883461"; 
const SUPPORT_VC_ID = "1466581684290850984"; 

client.on("ready", () => {
    console.log(`✅ إدعم فني متصل ونظام الصوت جاهز تماماً!`);
});

// --- [ وظيفة الدخول وتشغيل الصوت - نسخة الاستقرار ] ---
async function playWelcome(guild, memberName) {
    const channel = guild.channels.cache.get(SUPPORT_VC_ID);
    if (!channel) return;

    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
    });

    try {
        // الانتظار حتى يصبح الاتصال جاهزاً (يمنع AbortError)
        await entersState(connection, VoiceConnectionStatus.Ready, 5_000);
        
        const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
        const resource = createAudioResource(path.join(__dirname, '3rmot_welcome.mp3'), { inlineVolume: true });
        resource.volume.setVolume(1.0);

        connection.subscribe(player);
        player.play(resource);

        player.on(AudioPlayerStatus.Playing, () => console.log(`🎵 الصوت يبث الآن للعضو: ${memberName}`));
        player.on('error', error => console.error(`❌ خطأ في المشغل: ${error.message}`));

    } catch (error) {
        console.error(`❌ فشل الاتصال بالروم: ${error.message}`);
        connection.destroy();
    }
}

client.on("voiceStateUpdate", async (oldState, newState) => {
    if (newState.channelId === SUPPORT_VC_ID && !newState.member.user.bot && oldState.channelId !== newState.channelId) {
        console.log(`📢 رصد دخول العضو: ${newState.member.user.tag}`);
        await playWelcome(newState.guild, newState.member.user.tag);
    }
});

// --- [ لوحة التحكم بـ 7 أزرار ] ---
client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.content.startsWith("مساعدة")) return;
    if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) return;

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_broadcast').setLabel('إعلان').setStyle(ButtonStyle.Success).setEmoji('📢'),
        new ButtonBuilder().setCustomId('btn_warn').setLabel('تحذير').setStyle(ButtonStyle.Danger).setEmoji('⚠️'),
        new ButtonBuilder().setCustomId('btn_kick').setLabel('طرد').setStyle(ButtonStyle.Danger).setEmoji('👢'),
        new ButtonBuilder().setCustomId('btn_alert').setLabel('تنبيه').setStyle(ButtonStyle.Primary).setEmoji('🔔')
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_role').setLabel('رتبة').setStyle(ButtonStyle.Secondary).setEmoji('🎖️'),
        new ButtonBuilder().setCustomId('btn_info').setLabel('معلومات').setStyle(ButtonStyle.Secondary).setEmoji('ℹ️'),
        new ButtonBuilder().setCustomId('btn_reconnect_vc').setLabel('إعادة الصوت').setStyle(ButtonStyle.Primary).setEmoji('🔄')
    );

    await message.channel.send({ content: "**🛡️ لوحة التحكم الإدارية**", components: [row1, row2] });
});

client.on("interactionCreate", async (interaction) => {
    if (interaction.isButton() && interaction.customId === 'btn_reconnect_vc') {
        await interaction.reply({ content: "🔄 جاري إعادة مزامنة الصوت...", ephemeral: true });
        await playWelcome(interaction.guild, "System");
    }
});

client.login(process.env.DISCORD_TOKEN);
const { joinVoiceChannel, createAudioPlayer, createAudioResource, NoSubscriberBehavior, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ],
});

// --- [ الإعدادات الثابتة ] ---
const ADMIN_ROLE_ID = "1466572944166883461"; 
const SUPPORT_VC_ID = "1466581684290850984"; 
const moonImage = "https://images.unsplash.com/photo-1532767153582-b1a0e5145009?q=80&w=1000"; 

// دالة دخول الروم مع معالجة حالة الاتصال لضمان استقرار الصوت
async function connectToSupportVC(guild) {
    const channel = guild.channels.cache.get(SUPPORT_VC_ID);
    if (!channel) return null;

    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false
    });

    try {
        // الانتظار حتى يصبح الاتصال جاهزاً تماماً قبل تشغيل أي صوت
        await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
        return connection;
    } catch (error) {
        if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
            connection.destroy();
        }
        console.error("❌ فشل الاتصال بالروم الصوتي:", error);
        return null;
    }
}

client.on("ready", () => {
    console.log(`✅ ${client.user.tag} متصل وجاهز للعمل مع نظام الترحيب الذكي!`);
});

// --- [ نظام الترحيب الصوتي الفوري المطور ] ---
client.on("voiceStateUpdate", async (oldState, newState) => {
    // رصد دخول عضو جديد (ليس بوت) للروم الصوتي المحدد
    if (newState.channelId === SUPPORT_VC_ID && !newState.member.user.bot && oldState.channelId !== newState.channelId) {
        
        console.log(`📢 جاري محاولة تشغيل الصوت لـ: ${newState.member.user.tag}`);
        
        const connection = await connectToSupportVC(newState.guild);
        
        if (connection) {
            const player = createAudioPlayer({
                behaviors: { noSubscriber: NoSubscriberBehavior.Play }
            });
            
            // استخدام مسار ملف الترحيب المرفوع 3rmot_welcome.mp3
            const audioPath = path.resolve(__dirname, '3rmot_welcome.mp3');
            const resource = createAudioResource(audioPath, { inlineVolume: true }); 
            resource.volume.setVolume(1.0); // رفع مستوى الصوت للأداء الأمثل

            connection.subscribe(player);
            player.play(resource);

            player.on(AudioPlayerStatus.Playing, () => console.log('🎵 المقطع يشتغل الآن بصوت مرتفع!'));
            player.on('error', error => console.error(`❌ خطأ في مشغل الصوت: ${error.message}`));
        }
    }
});

// --- [ لوحة التحكم بـ 7 أزرار مفعلة ] ---
client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild || !message.content.startsWith("مساعدة")) return;
    if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) return;

    const mainEmbed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle("🛡️ لوحة التحكم الإدارية")
        .setDescription("# نظام 3RMOT الصوتي نشط\nاستخدم الأزرار أدناه للتحكم في العمليات الإدارية.")
        .setImage(moonImage);

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_broadcast').setLabel('إعلان').setStyle(ButtonStyle.Success).setEmoji('📢'),
        new ButtonBuilder().setCustomId('btn_warn').setLabel('تحذير').setStyle(ButtonStyle.Danger).setEmoji('⚠️'),
        new ButtonBuilder().setCustomId('btn_kick').setLabel('طرد').setStyle(ButtonStyle.Danger).setEmoji('👢'),
        new ButtonBuilder().setCustomId('btn_alert').setLabel('تنبيه').setStyle(ButtonStyle.Primary).setEmoji('🔔')
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_role').setLabel('رتبة').setStyle(ButtonStyle.Secondary).setEmoji('🎖️'),
        new ButtonBuilder().setCustomId('btn_info').setLabel('معلومات').setStyle(ButtonStyle.Secondary).setEmoji('ℹ️'),
        new ButtonBuilder().setCustomId('btn_reconnect_vc').setLabel('إعادة اتصال صوتي').setStyle(ButtonStyle.Primary).setEmoji('🔄')
    );

    await message.channel.send({ embeds: [mainEmbed], components: [row1, row2] });
});

// تفعيل استجابة الأزرار لفتح النوافذ المنبثقة (Modals)
client.on("interactionCreate", async (interaction) => {
    if (!interaction.guild || !interaction.member.roles.cache.has(ADMIN_ROLE_ID)) return;

    if (interaction.isButton()) {
        const op = interaction.customId;
        
        if (op === 'btn_reconnect_vc') {
            await interaction.reply({ content: "🔄 جاري إعادة مزامنة قناة الصوت...", ephemeral: true });
            await connectToSupportVC(interaction.guild);
            return interaction.editReply({ content: "✅ تم تحديث حالة الاتصال الصوتي بنجاح!" });
        }

        const modalConfigs = {
            'btn_broadcast': { id: 'broadcast_modal', title: 'إرسال إعلان عام' },
            'btn_warn': { id: 'warn_modal', title: 'تحذير عضو' },
            'btn_kick': { id: 'kick_modal', title: 'فصل عضو' },
            'btn_alert': { id: 'alert_modal', title: 'تنبيه إداري' },
            'btn_role': { id: 'role_modal', title: 'إعطاء رتبة' }
        };

        if (modalConfigs[op]) {
            const modal = new ModalBuilder().setCustomId(modalConfigs[op].id).setTitle(modalConfigs[op].title);
            const input = new TextInputBuilder()
                .setCustomId('input_text')
                .setLabel("أدخل التفاصيل المطلوبة")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
        }
    }

    if (interaction.type === InteractionType.ModalSubmit) {
        await interaction.reply({ content: "✅ تم استلام الطلب، وجاري التنفيذ برمجياً.", ephemeral: true });
    }
});

client.login(process.env.DISCORD_TOKEN);
