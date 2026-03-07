const { Client, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  entersState,
  VoiceConnectionStatus,
  StreamType,
} = require("@discordjs/voice");

const prism = require("prism-media");
const ffmpegPath = require("ffmpeg-static");
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

async function connectToVoiceChannel(guild) {
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

  if (!player) {
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
      console.error("❌ خطأ في الصوت:", error);
    });
  }

  connection.subscribe(player);
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

  if (!ffmpegPath) {
    console.log("❌ ffmpeg-static غير موجود");
    return;
  }

  const transcoder = new prism.FFmpeg({
    args: [
      "-analyzeduration", "0",
      "-loglevel", "0",
      "-i", AUDIO_FILE,
      "-f", "s16le",
      "-ar", "48000",
      "-ac", "2",
    ],
    shell: false,
    executable: ffmpegPath,
  });

  const resource = createAudioResource(transcoder, {
    inputType: StreamType.Raw,
  });

  player.stop(true);
  player.play(resource);
}

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log("Audio file path:", AUDIO_FILE);
  console.log("Audio exists:", fs.existsSync(AUDIO_FILE));
  console.log("ffmpeg path:", ffmpegPath);

  const guild = client.guilds.cache.first();
  if (!guild) {
    console.log("❌ ما لقيت سيرفر");
    return;
  }

  await connectToVoiceChannel(guild);
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
        await connectToVoiceChannel(newState.guild);
      }

      playWelcome();
    }
  } catch (err) {
    console.error("❌ voiceStateUpdate error:", err);
  }
});

client.login(process.env.DISCORD_TOKEN);
