const { Client, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  entersState,
  VoiceConnectionStatus,
} = require("@discordjs/voice");
const path = require("path");

// ===== الإعدادات =====
const TARGET_VOICE_CHANNEL_ID = "1466581684290850984"; // آيدي الروم الصوتي
const AUDIO_FILE = path.join(__dirname, "3rmot_welcome.mp3");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

let voiceConnection = null;
let audioPlayer = null;

// ===== دالة دخول البوت للروم =====
async function connectToVoiceChannel(channel) {
  if (!channel || !channel.guild) return null;

  try {
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 15000);

    if (!audioPlayer) {
      audioPlayer = createAudioPlayer({
        behaviors: {
          noSubscriber: NoSubscriberBehavior.Play,
        },
      });
    }

    connection.subscribe(audioPlayer);
    voiceConnection = connection;

    console.log("✅ Bot joined voice channel");
    return connection;
  } catch (error) {
    console.error("❌ Voice connection error:", error);
    return null;
  }
}

// ===== تشغيل الصوت من البداية =====
function playWelcomeSound() {
  try {
    if (!audioPlayer) return;

    const resource = createAudioResource(AUDIO_FILE);
    audioPlayer.stop(true); // يوقف أي صوت شغال ويعيد من البداية
    audioPlayer.play(resource);

    console.log("🔊 Welcome sound started from beginning");
  } catch (error) {
    console.error("❌ Play sound error:", error);
  }
}

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  try {
    for (const [, guild] of client.guilds.cache) {
      const channel = guild.channels.cache.get(TARGET_VOICE_CHANNEL_ID);
      if (channel && channel.isVoiceBased()) {
        await connectToVoiceChannel(channel);
        break;
      }
    }
  } catch (error) {
    console.error("❌ Ready connect error:", error);
  }
});

// ===== إذا صار فصل من الروم يرجع يدخل =====
client.on("voiceStateUpdate", async (oldState, newState) => {
  try {
    // لو دخل شخص جديد للروم المحدد
    if (
      newState.channelId === TARGET_VOICE_CHANNEL_ID &&
      oldState.channelId !== TARGET_VOICE_CHANNEL_ID &&
      !newState.member.user.bot
    ) {
      if (!voiceConnection || voiceConnection.state.status !== VoiceConnectionStatus.Ready) {
        const channel = newState.guild.channels.cache.get(TARGET_VOICE_CHANNEL_ID);
        if (channel) {
          await connectToVoiceChannel(channel);
        }
      }

      playWelcomeSound();
    }

    // لو البوت نفسه طلع من الروم لأي سبب يرجع يدخل
    if (
      oldState.member?.id === client.user.id &&
      oldState.channelId === TARGET_VOICE_CHANNEL_ID &&
      newState.channelId !== TARGET_VOICE_CHANNEL_ID
    ) {
      const channel = oldState.guild.channels.cache.get(TARGET_VOICE_CHANNEL_ID);
      if (channel) {
        setTimeout(async () => {
          await connectToVoiceChannel(channel);
        }, 2000);
      }
    }
  } catch (error) {
    console.error("❌ voiceStateUpdate error:", error);
  }
});

if (!audioPlayer) {
  audioPlayer = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Play,
    },
  });

  audioPlayer.on(AudioPlayerStatus.Idle, () => {
    console.log("⏹️ Audio finished");
  });

  audioPlayer.on("error", (error) => {
    console.error("❌ Audio player error:", error);
  });
}

client.login(process.env.DISCORD_TOKEN);
