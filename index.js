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
        GatewayIntentBits.GuildVoiceStates // ضروري جداً لرصد دخول الأعضاء للروم
    ],
});

// --- [ الإعدادات الثابتة ] ---
const ADMIN_ROLE_ID = "1466572944166883461"; 
const BROADCAST_ROLE_ID = "1467517313980043448"; 
const SUPPORT_VC_ID = "1466581684290850984"; // آيدي الروم الصوتي الخاص بك
const moonImage = "https://images.unsplash.com/photo-1532767153582-b1a0e5145009?q=80&w=1000"; 
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- [ 1. تثبيت البوت في الروم 24/7 ] ---
client.on("ready", () => {
    console.log(`✅ إدعم فني #1578 متصل وجاهز للترحيب!`);
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
    // التحقق: إذا دخل شخص للروم، ولم يكن هو البوت نفسه، وكان الروم هو روم الدعم
    if (newState.channelId === SUPPORT_VC_ID && newState.member.id !== client.user.id && oldState.channelId !== newState.channelId) {
        
        console.log(`📢 عضو دخل الروم: ${newState.member.user.tag} - جاري الترحيب...`);

        const connection = joinVoiceChannel({
            channelId: newState.channelId,
            guildId: newState.guild.id,
            adapterCreator: newState.guild.voiceAdapterCreator,
        });

        const player = createAudioPlayer();
        const resource = createAudioResource('./3rmot_welcome.mp3'); // الملف اللي رفعته أنت

        player.play(resource);
        connection.subscribe(player);

        // تنبيه الإدارة في الشات (اختياري)
        const logChannel = newState.guild.channels.cache.find(c => c.name === "logs");
        if (logChannel) logChannel.send(`🔔 **تنبيه:** ${newState.member} دخل روم الدعم الفني الآن.`);
    }
});

// --- [ 3. لوحة التحكم الإدارية (مساعدة) ] ---
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
            .setFooter({ text: "3RMOT System", iconURL: client.user.displayAvatarURL() });

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

// باقي معالجة الـ Modals والتنفيذ (كما في الكود السابق)
// ...

client.login(process.env.DISCORD_TOKEN);
