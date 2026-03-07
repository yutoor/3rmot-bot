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

// --- [ الإعدادات الثابتة - تأكد من صحتها ] ---
const ADMIN_ROLE_ID = "1466572944166883461"; 
const BROADCAST_ROLE_ID = "1467517313980043448"; 
const SUPPORT_VC_ID = "1466581684290850984"; 
const moonImage = "https://images.unsplash.com/photo-1532767153582-b1a0e5145009?q=80&w=1000"; 

// --- [ 1. تشغيل البوت وتثبيت الصوت ] ---
client.on("ready", () => {
    console.log(`✅ ${client.user.tag} أونلاين ونظام الصوت شغال!`);
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

// --- [ 3. لوحة التحكم (7 أزرار) ] ---
client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;
    if (message.content === "مساعدة" || message.content === "مساعده") {
        if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) return;
        setTimeout(() => message.delete().catch(() => null), 200);

        const mainEmbed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle("🛡️ لوحة التحكم الإدارية")
            .setDescription("# نظام 3RMOT نشط\nاستخدم الأزرار أدناه للتحكم.")
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
            new ButtonBuilder().setCustomId('btn_restart').setLabel('ريستارت').setStyle(ButtonStyle.Danger).setEmoji('🔄')
        );

        await message.channel.send({ embeds: [mainEmbed], components: [row1, row2] });
    }
});

// --- [ 4. معالجة الأزرار والريستارت ] ---
client.on("interactionCreate", async (interaction) => {
    if (!interaction.guild || !interaction.member.roles.cache.has(ADMIN_ROLE_ID)) return;

    if (interaction.isButton()) {
        if (interaction.customId === 'btn_restart') {
            await interaction.reply({ content: "🔄 جاري عمل ريستارت للبوت... انتظر ثواني.", ephemeral: true });
            process.exit(); // هذا بيقفل البوت والاستضافة بتشغله تلقائي
        }
        
        // هنا تفتح النوافذ (Modals) للأزرار الثانية
        if (interaction.customId.startsWith('modal_')) {
            await interaction.reply({ content: "🛠️ هذه الميزة قيد التجهيز في المودال.", ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
