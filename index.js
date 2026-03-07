const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, 
    TextInputStyle, InteractionType 
} = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior } = require('@discordjs/voice');

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

// وظيفة لدخول الروم الصوتي
function connectToSupportVC(guild) {
    const channel = guild.channels.cache.get(SUPPORT_VC_ID);
    if (channel) {
        return joinVoiceChannel({
            channelId: channel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: false
        });
    }
    return null;
}

// --- [ 1. تشغيل البوت ] ---
client.on("ready", () => {
    console.log(`✅ ${client.user.tag} أونلاين ونظام الترحيب الفوري جاهز!`);
    client.guilds.cache.forEach(guild => connectToSupportVC(guild));
});

// --- [ 2. نظام الترحيب الصوتي الفوري (أول ما يدخل العضو) ] ---
client.on("voiceStateUpdate", async (oldState, newState) => {
    // إذا دخل عضو جديد للروم ولم يكن بوت
    if (newState.channelId === SUPPORT_VC_ID && !newState.member.user.bot && oldState.channelId !== newState.channelId) {
        
        console.log(`📢 دخول عضو: ${newState.member.user.tag} - جاري الترحيب...`);
        
        const connection = connectToSupportVC(newState.guild);
        if (connection) {
            const player = createAudioPlayer({
                behaviors: { noSubscriber: NoSubscriberBehavior.Play }
            });
            
            // الملف اللي أنت رفعته باسم 3rmot_welcome.mp3
            const resource = createAudioResource('./3rmot_welcome.mp3'); 

            player.play(resource);
            connection.subscribe(player);

            player.on('error', error => console.error(`❌ خطأ صوتي: ${error.message}`));
        }
    }
});

// --- [ 3. لوحة التحكم (7 أزرار كاملة) ] ---
client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;
    if (message.content === "مساعدة" || message.content === "مساعده") {
        if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) return;
        setTimeout(() => message.delete().catch(() => null), 200);

        const mainEmbed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle("🛡️ لوحة التحكم الإدارية الكبرى")
            .setDescription("# نظام 3RMOT الصوتي\nالبوت سيتكلم تلقائياً عند دخول أي عضو لروم الدعم.")
            .setImage(moonImage);

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('modal_broadcast').setLabel('إعلان').setStyle(ButtonStyle.Success).setEmoji('📢'),
            new ButtonBuilder().setCustomId('modal_warn').setLabel('تحذير').setStyle(ButtonStyle.Danger).setEmoji('⚠️'),
            new ButtonBuilder().setCustomId('modal_kick').setLabel('طرد').setStyle(ButtonStyle.Danger).setEmoji('👢'),
            new ButtonBuilder().setCustomId('modal_alert').setLabel('تنبيه').setStyle(ButtonStyle.Primary).setEmoji('🔔')
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('modal_role').setLabel('رتبة').setStyle(ButtonStyle.Secondary).setEmoji('🎖️'),
            new ButtonBuilder().setCustomId('modal_info').setLabel('معلومات').setStyle(ButtonStyle.Secondary).setEmoji('ℹ️'),
            new ButtonBuilder().setCustomId('btn_reconnect_vc').setLabel('إعادة اتصال صوتي').setStyle(ButtonStyle.Primary).setEmoji('🔄')
        );

        await message.channel.send({ embeds: [mainEmbed], components: [row1, row2] });
    }
});

// --- [ 4. معالجة الأزرار والمودال ] ---
client.on("interactionCreate", async (interaction) => {
    if (!interaction.guild || !interaction.member.roles.cache.has(ADMIN_ROLE_ID)) return;

    if (interaction.isButton()) {
        const op = interaction.customId;

        if (op === 'btn_reconnect_vc') {
            connectToSupportVC(interaction.guild);
            return interaction.reply({ content: "✅ تم إعادة إدخال البوت للروم الصوتي!", ephemeral: true });
        }

        // إظهار رسالة التجهيز للمودالز كما في صورتك الأخيرة
        if (op.startsWith('modal_')) {
            return interaction.reply({ content: "🛠️ هذه الميزة قيد التجهيز في المودال.", ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
