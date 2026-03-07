const { 
    Client, GatewayIntentBits, Partials, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType
} = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent
    ],
});

// --- الإعدادات ---
const ADMIN_ROLE_ID = "1466572944166883461"; 
const BROADCAST_ROLE_ID = process.env.BROADCAST_ROLE_ID; 
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

client.on("ready", () => {
    console.log(`🚀 نظام النوافذ المنبثقة جاهز: ${client.user.tag}`);
});

// ===================== [1] استدعاء اللوحة الرئيسية =====================
client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;

    if (message.content === "مساعدة" || message.content === "مساعده") {
        if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) return;
        setTimeout(() => message.delete().catch(() => null), 200);

        const mainEmbed = new EmbedBuilder()
            .setColor(0x2b2d31)
            .setTitle("🛡️ لوحة التحكم التفاعلية")
            .setDescription("# اختر العملية المطلوبة\nعند الضغط على الزر ستظهر لك نافذة لتعبئة البيانات.")
            .setImage("https://i.imgur.com/3607a7.png"); 

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('modal_broadcast').setLabel('إعلان جماعي').setStyle(ButtonStyle.Success).setEmoji('📢'),
            new ButtonBuilder().setCustomId('modal_kick').setLabel('فصل (Kick)').setStyle(ButtonStyle.Danger).setEmoji('👢')
        );

        await message.channel.send({ embeds: [mainEmbed], components: [row1] });
    }
});

// ===================== [2] فتح النوافذ المنبثقة (Modals) =====================
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) return;

    // نافذة الإعلان الجماعي
    if (interaction.customId === 'modal_broadcast') {
        const modal = new ModalBuilder().setCustomId('broadcast_modal').setTitle('إرسال إعلان للجميع');
        const textInput = new TextInputBuilder()
            .setCustomId('broadcast_text')
            .setLabel("نص الإعلان")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('اكتب هنا ما تريد نشره في الخاص للجميع...')
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(textInput));
        await interaction.showModal(modal);
    }

    // نافذة الفصل
    if (interaction.customId === 'modal_kick') {
        const modal = new ModalBuilder().setCustomId('kick_modal').setTitle('فصل عضو من السيرفر');
        const idInput = new TextInputBuilder().setCustomId('user_id').setLabel("آيدي العضو").setStyle(TextInputStyle.Short).setRequired(true);
        const reasonInput = new TextInputBuilder().setCustomId('kick_reason').setLabel("السبب").setStyle(TextInputStyle.Paragraph).setRequired(false);

        modal.addComponents(new ActionRowBuilder().addComponents(idInput), new ActionRowBuilder().addComponents(reasonInput));
        await interaction.showModal(modal);
    }
});

// ===================== [3] معالجة البيانات المرسلة من النوافذ =====================
client.on("interactionCreate", async (interaction) => {
    if (interaction.type !== InteractionType.ModalSubmit) return;

    // تنفيذ الإعلان
    if (interaction.customId === 'broadcast_modal') {
        const text = interaction.fields.getTextInputValue('broadcast_text');
        await interaction.reply({ content: `⏳ جاري بدء الإرسال لجميع الأعضاء بفاصل 10 ثوانٍ...`, ephemeral: true });

        const role = await interaction.guild.roles.fetch(BROADCAST_ROLE_ID).catch(() => null);
        const targets = role ? role.members.filter(m => !m.user.bot) : [];

        for (const [, target] of targets) {
            await target.send(`# 📢 إعلان هـام\n━━━━━━━━━━━━━\n${text}`).catch(() => null);
            await wait(10000);
        }
        await interaction.followUp({ content: `✅ تم الانتهاء من الإرسال لـ ${targets.size} عضو.`, ephemeral: true });
    }

    // تنفيذ الفصل
    if (interaction.customId === 'kick_modal') {
        const userId = interaction.fields.getTextInputValue('user_id');
        const reason = interaction.fields.getTextInputValue('kick_reason') || "مخالفة القوانين";
        
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (!member) return interaction.reply({ content: "❌ لم يتم العثور على العضو.", ephemeral: true });

        await member.send(`# 👢 قرار فصل\n**السبب:** ${reason}`).catch(() => null);
        await member.kick(reason);
        await interaction.reply({ content: `✅ تم فصل ${member.user.tag} بنجاح.`, ephemeral: true });
    }
});

client.login(process.env.DISCORD_TOKEN);
