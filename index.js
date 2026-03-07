const { Client, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  entersState,
  VoiceConnectionStatus,
  NoSubscriberBehavior,
} = require("@discordjs/voice");
const path = require("path");
const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

const TARGET_VOICE_CHANNEL_ID = "1466581684290850984";
const AUDIO_FILE = path.join(__dirname, "3rmot_welcome.wav");

let connection = null;
let player = null;

async function connectToTargetChannel(guild) {
  const channel = guild.channels.cache.get(TARGET_VOICE_CHANNEL_ID);
  if (!channel || !channel.isVoiceBased()) {
    console.log("❌ الروم الصوتي غير موجود أو ليس روم صوتي");
    return;
  }

  connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false,
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 15000);
    console.log("✅ البوت دخل الروم الصوتي");
  } catch (err) {
    console.error("❌ فشل دخول الروم:", err);
    connection.destroy();
    connection = null;
    return;
  }

  player = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Play,
    },
  });

  connection.subscribe(player);

  player.on(AudioPlayerStatus.Playing, () => {
    console.log("🔊 الصوت اشتغل");
  });

  player.on(AudioPlayerStatus.Idle, () => {
    console.log("⏹️ انتهى الصوت");
  });

  player.on("error", (error) => {
    console.error("❌ خطأ في الصوت:", error);
  });
}

function playWelcome() {
  if (!player) {
    console.log("❌ player غير جاهز");
    return;
  }

  if (!fs.existsSync(AUDIO_FILE)) {
    console.log("❌ ملف الصوت غير موجود:", AUDIO_FILE);
    return;
  }

  const resource = createAudioResource(AUDIO_FILE);
  player.stop();
  player.play(resource);
}

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  const guild = client.guilds.cache.first();
  if (!guild) {
    console.log("❌ ما لقيت سيرفر");
    return;
  }

  await connectToTargetChannel(guild);
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  try {
    if (newState.member?.user?.bot) return;

    const joinedTarget =
      oldState.channelId !== TARGET_VOICE_CHANNEL_ID &&
      newState.channelId === TARGET_VOICE_CHANNEL_ID;

    if (joinedTarget) {
      console.log(`👤 دخل عضو جديد: ${newState.member.user.tag}`);

      if (!connection || connection.state.status !== VoiceConnectionStatus.Ready) {
        await connectToTargetChannel(newState.guild);
      }

      playWelcome();
    }

    const botMovedOut =
      oldState.member?.id === client.user.id &&
      oldState.channelId === TARGET_VOICE_CHANNEL_ID &&
      newState.channelId !== TARGET_VOICE_CHANNEL_ID;

    if (botMovedOut) {
      console.log("⚠️ البوت طلع من الروم، بيرجع يدخل");
      setTimeout(async () => {
        await connectToTargetChannel(oldState.guild);
      }, 2000);
    }
  } catch (err) {
    console.error("❌ خطأ voiceStateUpdate:", err);
  }
});

client.login(process.env.DISCORD_TOKEN);
