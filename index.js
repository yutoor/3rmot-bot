const { Client, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  entersState,
  VoiceConnectionStatus,
  getVoiceConnection,
} = require("@discordjs/voice");
const path = require("path");
const fs = require("fs");

const VOICE_CHANNEL_ID = "1466581684290850984";
const AUDIO_FILE = path.join(__dirname, "3rmot_welcome.wav");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

let player = null;
let currentGuildId = null;

function getPlayer() {
  if (player) return player;

  player = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Play,
    },
  });

  player.on(AudioPlayerStatus.Playing, () => {
    console.log("🔊 الصوت اشتغل");
  });

  player.on(AudioPlayerStatus.Idle, () => {
    console.log("⏹️ انتهى الصوت");
  });

  player.on("error", (error) => {
    console.error("❌ خطأ بالمشغل:", error);
  });

  return player;
}

async function connectToVoice(guild) {
  try {
    const channel = guild.channels.cache.get(VOICE_CHANNEL_ID);

    if (!channel) {
      console.log("❌ الروم الصوتي غير موجود");
      return null;
    }

    if (!channel.isVoiceBased()) {
      console.log("❌ هذا مو روم صوتي");
      return null;
    }

    let connection = getVoiceConnection(guild.id);

    if (connection) return connection;

    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 15000);
    connection.subscribe(getPlayer());
    currentGuildId = guild.id;

    console.log("✅ البوت دخل الروم الصوتي");
    return connection;
  } catch (error) {
    console.error("❌ خطأ دخول الروم:", error);
    return null;
  }
}

function playWelcome() {
  try {
    console.log("📁 Audio path:", AUDIO_FILE);
    console.log("📁 Audio exists:", fs.existsSync(AUDIO_FILE));

    if (!fs.existsSync(AUDIO_FILE)) {
      console.log("❌ ملف الصوت غير موجود");
      return;
    }

    const resource = createAudioResource(AUDIO_FILE);
    const p = getPlayer();

    p.stop(true);
    p.play(resource);

    console.log("🎵 تم تشغيل الصوت من البداية");
  } catch (error) {
    console.error("❌ خطأ تشغيل الصوت:", error);
  }
}

async function keepBotInVoice() {
  try {
    if (!currentGuildId) return;

    const guild = client.guilds.cache.get(currentGuildId);
    if (!guild) return;

    const connection = getVoiceConnection(guild.id);
    if (!connection) {
      console.log("♻️ البوت مو داخل الروم، جاري إرجاعه...");
      await connectToVoice(guild);
    }
  } catch (error) {
    console.error("❌ خطأ التثبيت:", error);
  }
}

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const guild = client.guilds.cache.first();
  if (!guild) {
    console.log("❌ ما فيه سيرفر");
    return;
  }

  await connectToVoice(guild);

  setInterval(async () => {
    await keepBotInVoice();
  }, 20000);
});

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
        connection = await connectToVoice(newState.guild);
      }

      if (connection) {
        playWelcome();
      }
    }

    if (
      oldState.member?.id === client.user.id &&
      oldState.channelId === VOICE_CHANNEL_ID &&
      newState.channelId !== VOICE_CHANNEL_ID
    ) {
      console.log("⚠️ البوت طلع من الروم، بيرجع يدخل");
      setTimeout(async () => {
        await connectToVoice(oldState.guild);
      }, 3000);
    }
  } catch (error) {
    console.error("❌ خطأ voiceStateUpdate:", error);
  }
});

client.login(process.env.DISCORD_TOKEN);
