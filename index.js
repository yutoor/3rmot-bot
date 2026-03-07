const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, 
    TextInputStyle, InteractionType 
} = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior } = require('@discordjs/voice');
const path = require('path'); // مبرمج لضبط مسار ملف الصوت

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

// وظيفة دخول الروم
function connectToSupportVC(guild) {
    const channel = guild.channels.cache.get(SUPPORT_VC_ID);
    if (channel) {
        return joinVoiceChannel({
            channelId: channel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
        });
    }
}

client.on("ready", () => {
    console.log(`✅ ${client.user.tag} متصل ونظام الترحيب جاهز!`);
    client.guilds.cache.forEach(guild => connectToSupportVC(guild));
});

// --- [ نظام الترحيب الصوتي الفوري ] ---
client.on("voiceStateUpdate", async (oldState, newState) => {
    // إذا دخل عضو (ليس بوت) للروم الصوتي
    if (newState.channelId === SUPPORT_VC_ID && !newState.member.user.bot && oldState.channelId !== newState.channelId) {
        
        console.log(`📢 ترحيب بالعضو: ${newState.member.user.tag}`);

        const connection = connectToSupportVC(newState.guild);
        if (connection) {
            const player = createAudioPlayer({
                behaviors: { noSubscriber: NoSubscriberBehavior.Play }
            });
            
            // ضبط المسار ليعمل في الاستضافة 
            const audioPath = path.join(__dirname, '3rmot_welcome.mp3');
            const resource = createAudioResource(audioPath); 

            player.play(resource);
            connection.subscribe(player);

            player.on('error', error => console.error(`❌ خطأ صوتي: ${error.message}`));
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
        .setDescription("# نظام 3RMOT الصوتي\nاستخدم الزر الأزرق لإرجاع البوت إذا طرد.")
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
        await interaction.reply({ content: "✅ تم إعادة البوت للروم الصوتي!", ephemeral: true });
    }
});

client.login(process.env.DISCORD_TOKEN);
