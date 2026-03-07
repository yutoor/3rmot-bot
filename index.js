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

// --- [ الإعدادات الثابتة ] ---
const ADMIN_ROLE_ID = "1466572944166883461"; 
const BROADCAST_ROLE_ID = "1467517313980043448"; 
const SUPPORT_VC_ID = "1466581684290850984"; 
const moonImage = "https://images.unsplash.com/photo-1532767153582-b1a0e5145009?q=80&w=1000"; 

// وظيفة مخصصة لإدخال البوت للروم الصوتي
function connectToSupportVC(guild) {
    const channel = guild.channels.cache.get(SUPPORT_VC_ID);
    if (channel) {
        joinVoiceChannel({
            channelId: channel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
        });
        return true;
    }
    return false;
}

// --- [ 1. تشغيل البوت وتثبيت الصوت ] ---
client.on("ready", () => {
    console.log(`✅ ${client.user.tag} متصل وجاهز للعمل!`);
    client.guilds.cache.forEach(guild => connectToSupportVC(guild));
});

// --- [ 2. نظام الترحيب الصوتي الفوري (بمجرد دخول العضو) ] ---
client.on("voiceStateUpdate", async (oldState, newState) => {
    // التحقق: إذا دخل شخص للروم، ولم يكن هو البوت، وكان الروم هو روم الدعم
    if (newState.channelId === SUPPORT_VC_ID && !newState.member.user.bot && oldState.channelId !== newState.channelId) {
        
        console.log(`📢 ترحيب فوري بالعضو: ${newState.member.user.tag}`);

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

// --- [ 3. لوحة التحكم الإدارية (7 أزرار) ] ---
client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;
    if (message.content === "مساعدة" || message.content === "مساعده") {
        if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) return;
        setTimeout(() => message.delete().catch(() => null), 200);

        const mainEmbed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle("🛡️ لوحة التحكم الإدارية الكبرى")
            .setDescription("# نظام 3RMOT نشط\nاستخدم الأزرار أدناه للتحكم في البوت والعمليات الإدارية.")
            .setImage(moonImage)
            .setFooter({ text: "3RMOT System", iconURL: client.user.displayAvatarURL() });

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

// --- [ 4. معالجة التفاعلات ] ---
client.on("interactionCreate", async (interaction) => {
    if (!interaction.guild || !interaction.member.roles.cache.has(ADMIN_ROLE_ID)) return;

    if (interaction.isButton()) {
        const op = interaction.customId;

        // زر إعادة الاتصال الصوتي (في حال طُرد البوت)
        if (op === 'btn_reconnect_vc') {
            const success = connectToSupportVC(interaction.guild);
            return interaction.reply({ 
                content: success ? "✅ تم إعادة البوت للروم الصوتي بنجاح!" : "❌ فشل الاتصال، تأكد من وجود الروم.", 
                ephemeral: true 
            });
        }

        // فتح المودالز (النوافذ المنبثقة)
        if (op === 'modal_broadcast') {
            const modal = new ModalBuilder().setCustomId('broadcast_modal').setTitle('إعلان جماعي');
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

        if (op === 'modal_info') {
            return interaction.reply({ content: "ℹ️ نظام 3RMOT الإصدار 2.1.0\nتم ضبط نظام الترحيب الصوتي الفوري.", ephemeral: true });
        }
    }

    if (interaction.type === InteractionType.ModalSubmit) {
        await interaction.reply({ content: "✅ تم استلام الطلب وجاري التنفيذ.", ephemeral: true });
    }
});

client.login(process.env.DISCORD_TOKEN);
