const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, 
    TextInputStyle, InteractionType 
} = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, NoSubscriberBehavior } = require('@discordjs/voice');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ],
});

// --- [ الإعدادات ] ---
const ADMIN_ROLE_ID = "1466572944166883461"; 
const SUPPORT_VC_ID = "1466581684290850984"; 
const moonImage = "https://images.unsplash.com/photo-1532767153582-b1a0e5145009?q=80&w=1000"; 

// دالة الدخول بدون ديفن (selfDeaf: false)
function connectToSupportVC(guild) {
    const channel = guild.channels.cache.get(SUPPORT_VC_ID);
    if (channel) {
        return joinVoiceChannel({
            channelId: channel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: false, // هذي هي اللي تشيل علامة السماعة المصلوبة
            selfMute: false
        });
    }
}

client.on("ready", () => {
    console.log(`✅ ${client.user.tag} متصل وجاهز للترحيب بدون ديفن!`);
    client.guilds.cache.forEach(guild => connectToSupportVC(guild));
});

// --- [ نظام الترحيب الصوتي الفوري ] ---
client.on("voiceStateUpdate", async (oldState, newState) => {
    if (newState.channelId === SUPPORT_VC_ID && !newState.member.user.bot && oldState.channelId !== newState.channelId) {
        
        const connection = connectToSupportVC(newState.guild);
        if (connection) {
            const player = createAudioPlayer({
                behaviors: { noSubscriber: NoSubscriberBehavior.Play }
            });
            
            const audioPath = path.join(__dirname, '3rmot_welcome.mp3');
            const resource = createAudioResource(audioPath); 

            player.play(resource);
            connection.subscribe(player);
        }
    }
});

// --- [ لوحة التحكم بـ 7 أزرار ] ---
client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild || !message.content.startsWith("مساعدة")) return;
    if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) return;

    const mainEmbed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle("🛡️ لوحة التحكم الإدارية")
        .setDescription("# نظام 3RMOT الصوتي\nتم حل مشكلة الـ Deafen.")
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
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.guild || !interaction.member.roles.cache.has(ADMIN_ROLE_ID)) return;
    if (interaction.isButton() && interaction.customId === 'btn_reconnect_vc') {
        connectToSupportVC(interaction.guild);
        await interaction.reply({ content: "✅ تم إعادة دخول البوت للروم الصوتي بدون ديفن!", ephemeral: true });
    }
});

client.login(process.env.DISCORD_TOKEN);
