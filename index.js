const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField,
} = require("discord.js");

const path = require("path");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  entersState,
  VoiceConnectionStatus,
} = require("@discordjs/voice");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

// ===== الإعدادات =====
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID || "1466572944166883461";
const ANNOUNCE_CHANNEL_ID = process.env.ANNOUNCE_CHANNEL_ID || null;

// ===== إعدادات الترحيب الصوتي =====
const TARGET_VOICE_CHANNEL_ID = "1466581684290850984";
const AUDIO_FILE = path.join(__dirname, "3rmot_welcome.mp3");
let isPlayingWelcome = false;

const txt = {
  helpTitle: "🛡️ لوحة التحكم الإدارية الكبرى",
  helpDesc: "# اختر العملية المطلوبة\nكل العمليات تتم من البنل مباشرة.",
  aiReply:
    "أنا المساعد الخاص بهذا البوت 🤖. إذا احتجت شيء من الإدارة، تواصل معهم داخل السيرفر.",
  forbidden: "عذراً، هذا الأمر مخصص للإدارة فقط.",
};

function isAdminMember(member) {
  if (!member) return false;
  if (member.permissions?.has(PermissionsBitField.Flags.Administrator)) return true;
  if (ADMIN_ROLE_ID && member.roles?.cache?.has(ADMIN_ROLE_ID)) return true;
  return false;
}

function cleanId(input) {
  return String(input || "").replace(/[<@!@&>#]/g, "").trim();
}

client.on("ready", () => {
  console.log(`✅ Bot Started: ${client.user.tag}`);
});

// ===================== [1] استدعاء البنل =====================
client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot || !message.guild) return;

    const content = message.content.trim();
    if (content !== "مساعدة" && content !== "مساعده") return;

    if (!isAdminMember(message.member)) return;

    setTimeout(() => message.delete().catch(() => null), 500);

    const mainEmbed = new EmbedBuilder()
      .setColor(0x000000)
      .setTitle(txt.helpTitle)
      .setDescription(txt.helpDesc)
      .setThumbnail(client.user.displayAvatarURL());

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("op_announce")
        .setLabel("إعلان عام")
        .setStyle(ButtonStyle.Success)
        .setEmoji("📢"),
      new ButtonBuilder()
        .setCustomId("op_warn")
        .setLabel("تحذير")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("⚠️"),
      new ButtonBuilder()
        .setCustomId("op_kick")
        .setLabel("فصل")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("👢")
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("op_alert")
        .setLabel("تنبيه خاص")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🔔"),
      new ButtonBuilder()
        .setCustomId("op_role")
        .setLabel("إعطاء رتبة")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("🎖️")
    );

    await message.channel.send({
      embeds: [mainEmbed],
      components: [row1, row2],
    });
  } catch (err) {
    console.error(err);
  }
});

// ===================== [2] الأزرار تفتح Modals =====================
client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isButton()) return;
    if (!interaction.inGuild()) {
      return interaction.reply({ content: txt.forbidden, ephemeral: true });
    }

    const member = interaction.member;
    if (!isAdminMember(member)) {
      return interaction.reply({ content: txt.forbidden, ephemeral: true });
    }

    if (interaction.customId === "op_announce") {
      const modal = new ModalBuilder()
        .setCustomId("modal_announce")
        .setTitle("إعلان عام");

      const messageInput = new TextInputBuilder()
        .setCustomId("announce_text")
        .setLabel("نص الإعلان")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1800)
        .setPlaceholder("اكتب الإعلان هنا...");

      modal.addComponents(new ActionRowBuilder().addComponents(messageInput));
      return interaction.showModal(modal);
    }

    if (interaction.customId === "op_warn") {
      const modal = new ModalBuilder()
        .setCustomId("modal_warn")
        .setTitle("تحذير عضو");

      const idInput = new TextInputBuilder()
        .setCustomId("target_id")
        .setLabel("آيدي العضو")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder("اكتب ID العضو");

      const reasonInput = new TextInputBuilder()
        .setCustomId("reason")
        .setLabel("سبب التحذير")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

      modal.addComponents(
        new ActionRowBuilder().addComponents(idInput),
        new ActionRowBuilder().addComponents(reasonInput)
      );
      return interaction.showModal(modal);
    }

    if (interaction.customId === "op_kick") {
      const modal = new ModalBuilder()
        .setCustomId("modal_kick")
        .setTitle("فصل عضو");

      const idInput = new TextInputBuilder()
        .setCustomId("target_id")
        .setLabel("آيدي العضو")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const reasonInput = new TextInputBuilder()
        .setCustomId("reason")
        .setLabel("سبب الفصل")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

      modal.addComponents(
        new ActionRowBuilder().addComponents(idInput),
        new ActionRowBuilder().addComponents(reasonInput)
      );
      return interaction.showModal(modal);
    }

    if (interaction.customId === "op_alert") {
      const modal = new ModalBuilder()
        .setCustomId("modal_alert")
        .setTitle("تنبيه خاص");

      const idInput = new TextInputBuilder()
        .setCustomId("target_id")
        .setLabel("آيدي العضو")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const textInput = new TextInputBuilder()
        .setCustomId("alert_text")
        .setLabel("نص التنبيه")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1500);

      modal.addComponents(
        new ActionRowBuilder().addComponents(idInput),
        new ActionRowBuilder().addComponents(textInput)
      );
      return interaction.showModal(modal);
    }

    if (interaction.customId === "op_role") {
      const modal = new ModalBuilder()
        .setCustomId("modal_role")
        .setTitle("إعطاء رتبة");

      const userIdInput = new TextInputBuilder()
        .setCustomId("target_id")
        .setLabel("آيدي العضو")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const roleIdInput = new TextInputBuilder()
        .setCustomId("role_id")
        .setLabel("آيدي الرتبة")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(userIdInput),
        new ActionRowBuilder().addComponents(roleIdInput)
      );
      return interaction.showModal(modal);
    }
  } catch (err) {
    console.error(err);
  }
});

// ===================== [3] استقبال الـ Modals =====================
client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isModalSubmit()) return;
    if (!interaction.inGuild()) {
      return interaction.reply({ content: txt.forbidden, ephemeral: true });
    }

    const member = interaction.member;
    if (!isAdminMember(member)) {
      return interaction.reply({ content: txt.forbidden, ephemeral: true });
    }

    const guild = interaction.guild;

    if (interaction.customId === "modal_announce") {
      const text = interaction.fields.getTextInputValue("announce_text");

      if (!ANNOUNCE_CHANNEL_ID) {
        return interaction.reply({
          content: "❌ لازم تضيف ANNOUNCE_CHANNEL_ID في Variables.",
          ephemeral: true,
        });
      }

      const ch = await guild.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null);
      if (!ch || !ch.isTextBased()) {
        return interaction.reply({
          content: "❌ قناة الإعلانات غير صحيحة.",
          ephemeral: true,
        });
      }

      await ch.send(`@everyone\n📢 **إعلان**\n${text}`);
      return interaction.reply({
        content: "✅ تم نشر الإعلان في قناة الإعلانات.",
        ephemeral: true,
      });
    }

    if (interaction.customId === "modal_warn") {
      const targetId = cleanId(interaction.fields.getTextInputValue("target_id"));
      const reason = interaction.fields.getTextInputValue("reason");

      const target = await guild.members.fetch(targetId).catch(() => null);
      if (!target) {
        return interaction.reply({
          content: "❌ ما لقيت العضو.",
          ephemeral: true,
        });
      }

      await target.send(
        `# ⚠️ تحذير رسمي\nلقد تلقيت تحذيراً من إدارة السيرفر.\n**السبب:** ${reason}`
      ).catch(() => null);

      await interaction.reply({
        content: `✅ تم إرسال التحذير إلى ${target.user.tag}`,
        ephemeral: true,
      });
      return;
    }

    if (interaction.customId === "modal_kick") {
      const targetId = cleanId(interaction.fields.getTextInputValue("target_id"));
      const reason = interaction.fields.getTextInputValue("reason");

      const target = await guild.members.fetch(targetId).catch(() => null);
      if (!target) {
        return interaction.reply({
          content: "❌ ما لقيت العضو.",
          ephemeral: true,
        });
      }

      await target.send(
        `# 👢 قرار فصل\nتم فصلك من السيرفر.\n**السبب:** ${reason}`
      ).catch(() => null);

      await target.kick(reason).catch(() => null);

      return interaction.reply({
        content: `✅ تم فصل ${target.user.tag}`,
        ephemeral: true,
      });
    }

    if (interaction.customId === "modal_alert") {
      const targetId = cleanId(interaction.fields.getTextInputValue("target_id"));
      const text = interaction.fields.getTextInputValue("alert_text");

      const target = await guild.members.fetch(targetId).catch(() => null);
      if (!target) {
        return interaction.reply({
          content: "❌ ما لقيت العضو.",
          ephemeral: true,
        });
      }

      await target.send(
        `# 🔔 تنبيه إداري\nمرحباً بك، لديك رسالة من الإدارة:\n${text}`
      ).catch(() => null);

      return interaction.reply({
        content: `✅ تم إرسال التنبيه إلى ${target.user.tag}`,
        ephemeral: true,
      });
    }

    if (interaction.customId === "modal_role") {
      const targetId = cleanId(interaction.fields.getTextInputValue("target_id"));
      const roleId = cleanId(interaction.fields.getTextInputValue("role_id"));

      const target = await guild.members.fetch(targetId).catch(() => null);
      if (!target) {
        return interaction.reply({
          content: "❌ ما لقيت العضو.",
          ephemeral: true,
        });
      }

      const role = await guild.roles.fetch(roleId).catch(() => null);
      if (!role) {
        return interaction.reply({
          content: "❌ ما لقيت الرتبة.",
          ephemeral: true,
        });
      }

      await target.roles.add(role).catch(() => null);

      return interaction.reply({
        content: `✅ تم إعطاء رتبة ${role.name} إلى ${target.user.tag}`,
        ephemeral: true,
      });
    }
  } catch (err) {
    console.error(err);
    if (interaction.replied || interaction.deferred) return;
    return interaction.reply({
      content: "❌ صار خطأ أثناء التنفيذ.",
      ephemeral: true,
    });
  }
});

// ===================== [4] الترحيب الصوتي =====================
client.on("voiceStateUpdate", async (oldState, newState) => {
  try {
    if (oldState.channelId === newState.channelId) return;
    if (newState.member?.user?.bot) return;
    if (newState.channelId !== TARGET_VOICE_CHANNEL_ID) return;
    if (isPlayingWelcome) return;

    isPlayingWelcome = true;

    const channel = newState.channel;
    if (!channel || !channel.guild) {
      isPlayingWelcome = false;
      return;
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 15000);
    } catch (error) {
      console.error("Voice connection error:", error);
      connection.destroy();
      isPlayingWelcome = false;
      return;
    }

    const player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play,
      },
    });

    const resource = createAudioResource(AUDIO_FILE, {
      inlineVolume: true,
    });

    if (resource.volume) {
      resource.volume.setVolume(1);
    }

    connection.subscribe(player);
    player.play(resource);

    player.on(AudioPlayerStatus.Idle, () => {
      setTimeout(() => {
        connection.destroy();
        isPlayingWelcome = false;
      }, 1000);
    });

    player.on("error", (error) => {
      console.error("Voice player error:", error);
      connection.destroy();
      isPlayingWelcome = false;
    });
  } catch (err) {
    console.error("voiceStateUpdate error:", err);
    isPlayingWelcome = false;
  }
});

// ===================== [5] الرد في الخاص =====================
client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (message.guild) return;

    return message.reply(txt.aiReply);
  } catch (err) {
    console.error(err);
  }
});

client.login(process.env.DISCORD_TOKEN);
