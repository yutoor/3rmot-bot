const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, 
    TextInputStyle, InteractionType 
} = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, NoSubscriberBehavior, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ],
});

const ADMIN_ROLE_ID = "1466572944166883461"; 
const SUPPORT_VC_ID = "1466581684290850984"; 
const moonImage = "https://images.unsplash.com/photo-1532767153582-b1a0e5145009?q=80&w=1000"; 

// دالة دخول الروم مع معالجة حالة الاتصال
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
        // الانتظار حتى يصبح الاتصال جاهزاً تماماً قبل أي إجراء
        await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
        return connection;
    } catch (error) {
        connection.destroy();
        console.error("❌ فشل الاتصال بالروم الصوتي في الوقت المحدد:", error);
        return null;
    }
}

client.on("ready", () => {
    console.log(`✅ ${client.user.tag} متصل وجاهز للعمل!`);
});

// --- [ نظام الترحيب الصوتي المطور والمضمون ] ---
client.on("voiceStateUpdate", async (oldState, newState) => {
    if (newState.channelId === SUPPORT_VC_ID && !newState.member.user.bot && oldState.channelId !== newState.channelId) {
        
        console.log(`📢 رصد دخول العضو: ${newState.member.user.tag}`);
        
        const connection = await connectToSupportVC(newState.guild);
        
        if (connection) {
            const player = createAudioPlayer({
                behaviors: { noSubscriber: NoSubscriberBehavior.Play }
            });
            
            const audioPath = path.resolve(__dirname, '3rmot_welcome.mp3');
            const resource = createAudioResource(audioPath, { inlineVolume: true }); 
            resource.volume.setVolume(1.0); 

            // ربط المشغل بالاتصال
            connection.subscribe(player);
            
            // تشغيل المقطع
            player.play(resource);

            player.on(AudioPlayerStatus.Playing, () => console.log('🎵 الصوت يبث الآن في الروم!'));
            player.on('error', error => console.error(`❌ خطأ صوتي: ${error.message}`));
        }
    }
});

// لوحة التحكم بالأزرار (كما هي في طلبك السابق)
client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild || !message.content.startsWith("مساعدة")) return;
    if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) return;

    const mainEmbed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle("🛡️ لوحة التحكم الإدارية الكبرى")
        .setDescription("# نظام 3RMOT الصوتي\nتم تفعيل نظام الانتظار الذكي لضمان خروج الصوت.")
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
        new ButtonBuilder().setCustomId('btn_reconnect_vc').setLabel('إعادة مزامنة الصوت').setStyle(ButtonStyle.Primary).setEmoji('🔄')
    );

    await message.channel.send({ embeds: [mainEmbed], components: [row1, row2] });
});

// تفعيل الأزرار لفتح المودالز
client.on("interactionCreate", async (interaction) => {
    if (!interaction.guild || !interaction.member.roles.cache.has(ADMIN_ROLE_ID)) return;

    if (interaction.isButton()) {
        const op = interaction.customId;
        if (op === 'btn_reconnect_vc') {
            await interaction.reply({ content: "🔄 جاري إعادة الاتصال بالروم...", ephemeral: true });
            await connectToSupportVC(interaction.guild);
            return interaction.editReply({ content: "✅ تم إعادة الاتصال بنجاح!" });
        }

        const modalConfigs = {
            'btn_broadcast': { id: 'broadcast_modal', title: 'إرسال إعلان' },
            'btn_warn': { id: 'warn_modal', title: 'تحذير عضو' },
            'btn_kick': { id: 'kick_modal', title: 'طرد عضو' },
            'btn_alert': { id: 'alert_modal', title: 'تنبيه خاص' },
            'btn_role': { id: 'role_modal', title: 'إعطاء رتبة' }
        };

        if (modalConfigs[op]) {
            const modal = new ModalBuilder().setCustomId(modalConfigs[op].id).setTitle(modalConfigs[op].title);
            const input = new TextInputBuilder().setCustomId('input_data').setLabel("اكتب التفاصيل هنا").setStyle(TextInputStyle.Paragraph).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
        }
    }
    
    if (interaction.type === InteractionType.ModalSubmit) {
        await interaction.reply({ content: "✅ تم استلام الطلب بنجاح.", ephemeral: true });
    }
});

client.login(process.env.DISCORD_TOKEN);
