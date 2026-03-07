const { Client, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  NoSubscriberBehavior,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState,
} = require("@discordjs/voice");
const play = require("play-dl");

// ===== الإعدادات =====
const VOICE_CHANNEL_ID = "1466581684290850984";
const YOUTUBE_URL = "https://youtu.be/zC0kbNRUWLM";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

let player = createAudioPlayer({
  behaviors: {
    noSubscriber: NoSubscriberBehavior.Play,
  },
});

let currentGuildId = null;

// دخول الروم
async function joinChannel(guild) {
  try {
    const channel = guild.channels.cache.get(VOICE_CHANNEL_ID);

    if (!channel) {
      console.log("❌ الروم الصوتي غير موجود");
      return null;
    }

    if (!channel.isVoiceBased()) {
      console.log("❌ هذا ليس روم صوتي");
      return null;
    }

    let connection = getVoiceConnection(guild.id);

    if (connection) {
      return connection;
    }

    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 15000);

    connection.subscribe(player);
    currentGuildId = guild.id;

    console.log("✅ البوت دخل الروم الصوتي");

    return connection;
  } catch (err) {
    console.log("❌ خطأ دخول الروم:", err);
    return null;
  }
}

// تشغيل الصوت من يوتيوب
async function playSound() {
  try {
    const stream = await play.stream(YOUTUBE_URL);

    const resource = createAudioResource(stream.stream, {
      inputType: stream.type,
    });

    player.stop(true);
    player.play(resource);

    console.log("🔊 تشغيل الصوت من يوتيوب");
  } catch (err) {
    console.log("❌ خطأ تشغيل الصوت:", err);
  }
}

// إذا البوت طلع من الروم يرجع يدخل
async function ensureBotInVoice() {
  try {
    if (!currentGuildId) return;

    const guild = client.guilds.cache.get(currentGuildId);
    if (!guild) return;

    const connection = getVoiceConnection(guild.id);
    if (!connection) {
      await joinChannel(guild);
    }
  } catch (err) {
    console.log("❌ خطأ التثبيت في الروم:", err);
  }
}

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const guild = client.guilds.cache.first();
  if (!guild) {
    console.log("❌ ما فيه سيرفر");
    return;
  }

  await joinChannel(guild);

  // فحص كل 20 ثانية
  setInterval(async () => {
    await ensureBotInVoice();
  }, 20000);
});

// كل ما دخل عضو جديد يشغل الصوت من البداية
client.on("voiceStateUpdate", async (oldState, newState) => {
  try {
    if (newState.member?.user?.bot) return;

    const joinedTarget =
      oldState.channelId !== VOICE_CHANNEL_ID &&
      newState.channelId === VOICE_CHANNEL_ID;

    if (joinedTarget) {
      console.log(`👤 دخل عضو جديد: ${newState.member.user.tag}`);

      let connection = getVoiceConnection(newState.guild.id);
      if (!connection) {
        connection = await joinChannel(newState.guild);
      }

      if (connection) {
        await playSound();
      }
    }
  } catch (err) {
    console.log("❌ خطأ voiceStateUpdate:", err);
  }
});

client.login(process.env.DISCORD_TOKEN);
