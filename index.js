const { 
    Client, GatewayIntentBits, Partials, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle 
} = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
});

// --- إعدادات القوة ---
const ADMIN_ROLE_ID = "1466572944166883461";
const BROADCAST_ROLE_ID = process.env.BROADCAST_ROLE_ID;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

client.on("ready", () => {
    console.log(`🔥 The Alpha Bot is Online: ${client.user.tag}`);
});

// ===================== [1] استدعاء اللوحة المخفية =====================
client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;

    if (message.content === "مساعدة" || message.content === "مساعده") {
        if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) return;

        setTimeout(() => message.delete().catch(() => null), 200);

        const mainEmbed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle("🛡️ غرفة العمليات السرية")
            .setDescription("# نظام التحكم الشبح نشط\nاستخدم الأوامر أدناه. جميع الردود ستكون مخفية عن الأعضاء.")
            .setThumbnail(client.user.displayAvatarURL())
            .setImage("https://i.imgur.com/3607a7.png"); // رابط لوحة التحكم حقك

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('go_broadcast').setLabel('إعلان جماعي').setStyle(ButtonStyle.Success).setEmoji('📢'),
            new ButtonBuilder().setCustomId('go_warn').setLabel('تحذير').setStyle(ButtonStyle.Danger).setEmoji('⚠️'),
            new ButtonBuilder().setCustomId('go_kick').setLabel('فصل (Kick)').setStyle(ButtonStyle.Danger).setEmoji('👢')
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('go_alert').setLabel('تنبيه خاص').setStyle(ButtonStyle.Primary).setEmoji('🔔'),
            new ButtonBuilder().setCustomId('go_role').setLabel('إعطاء رتبة').setStyle(ButtonStyle.Secondary).setEmoji('🎖️')
        );

        await message.channel.send({ embeds: [mainEmbed], components: [row1, row2] });
    }
});

// ===================== [2] معالجة التفاعل المخفي (Ephemeral) =====================
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) return;

    const op = interaction.customId;
    let responseText = "";

    if (op === 'go_broadcast') responseText = "📢 **للإعلان:** اكتب `!اعلان [نصك]`";
    if (op === 'go_warn') responseText = "⚠️ **للتحذير:** اكتب `!تحذير @العضو [السبب]`";
    if (op === 'go_kick') responseText = "👢 **للصل:** اكتب `!فصل @العضو [السبب]`";
    if (op === 'go_alert') responseText = "🔔 **للتنبيه:** اكتب `!تنبيه @العضو [الرسالة]`";
    if (op === 'go_role') responseText = "🎖️ **للرتبة:** اكتب `!رتبة @العضو [آيدي الرتبة]`";

    await interaction.reply({ content: `### ${responseText}\n*سيتم حذف رسالتك فوراً بعد الإرسال للحفاظ على السرية.*`, ephemeral: true });
});

// ===================== [3] تنفيذ الأوامر "الشبح" =====================
client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild || !message.member.roles.cache.has(ADMIN_ROLE_ID)) return;

    const args = message.content.split(" ");
    const cmd = args[0];

    // --- الإعلان الجماعي ---
    if (cmd === "!اعلان") {
        setTimeout(() => message.delete().catch(() => null), 100);
        const text = args.slice(1).join(" ");
        const role = await message.guild.roles.fetch(BROADCAST_ROLE_ID).catch(() => null);
        const targets = role ? role.members.filter(m => !m.user.bot) : [];

        for (const [, target] of targets) {
            await target.send(`# 📢 إعلان من الإدارة\n━━━━━━━━━━━━━\n${text}`).catch(() => null);
            await wait(10000);
        }
        await message.author.send(`✅ تم الإعلان لـ ${targets.size} عضو.`);
    }

    // --- التحذير ---
    if (cmd === "!تحذير") {
        setTimeout(() => message.delete().catch(() => null), 100);
        const member = message.mentions.members.first();
        const reason = args.slice(2).join(" ") || "سلوك غير لائق";
        if (member) {
            await member.send(`# ⚠️ تحذير رسمي\nتم تسجيل تحذير ضدك.\n**السبب:** ${reason}`).catch(() => null);
            await message.author.send(`✅ تم تحذير ${member.user.tag}`);
        }
    }

    // --- الفصل ---
    if (cmd === "!فصل") {
        setTimeout(() => message.delete().catch(() => null), 100);
        const member = message.mentions.members.first();
        const reason = args.slice(2).join(" ") || "مخالفة القوانين";
        if (member) {
            await member.send(`# 👢 قرار فصل\nتم فصلك من السيرفر.\n**السبب:** ${reason}`).catch(() => null);
            await member.kick(reason).catch(() => null);
            await message.author.send(`✅ تم فصل ${member.user.tag}`);
        }
    }
});

// ===================== [4] نظام الـ AI في الخاص =====================
client.on("messageCreate", async (message) => {
    if (message.guild || message.author.bot) return;
    
    // إذا كان العضو ليس آدمن، البوت يرد بذكاء اصطناعي
    if (message.author.id !== "آيدي_حسابك_هنا") {
        return message.reply("مرحباً! أنا المساعد الذكي الخاص بالسيرفر 🤖. طلباتك قيد المعالجة، يرجى الانتظار أو التواصل مع الدعم الفني.");
    }
});

client.login(process.env.DISCORD_TOKEN);
