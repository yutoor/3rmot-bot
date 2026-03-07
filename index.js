const { Client, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  entersState,
  VoiceConnectionStatus
} = require("@discordjs/voice");

const path = require("path");

// ===== إعدادات =====
const TARGET_VOICE_CHANNEL_ID = "1466581684290850984"; // آيدي الروم الصوتي
const AUDIO_FILE = path.join(__dirname, "3rmot_welcome.mp3"); // اسم ملف الصوت

let isPlaying = false;

// ===== إنشاء البوت =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ===== تشغيل الصوت عند دخول الروم =====
client.on("voiceStateUpdate", async (oldState, newState) => {
  try {

    // لو ما تغيرت القناة
    if (oldState.channelId === newState.channelId) return;

    // تجاهل البوتات
    if (newState.member?.user?.bot) return;

    // تأكد أنه دخل الروم المحدد
    if (newState.channelId !== TARGET_VOICE_CHANNEL_ID) return;

    // منع التكرار
    if (isPlaying) return;
    isPlaying = true;

    const channel = newState.channel;

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 15000);
    } catch (error) {
      console.error("Voice connection error:", error);
      connection.destroy();
      isPlaying = false;
      return;
    }

    const player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play
      }
    });

    const resource = createAudioResource(AUDIO_FILE);

    connection.subscribe(player);
    player.play(resource);

    console.log("🔊 Playing welcome sound");

    player.on(AudioPlayerStatus.Idle, () => {
      setTimeout(() => {
        connection.destroy();
        isPlaying = false;
      }, 1000);
    });

    player.on("error", (error) => {
      console.error("Player error:", error);
      connection.destroy();
      isPlaying = false;
    });

  } catch (err) {
    console.error("voiceStateUpdate error:", err);
    isPlaying = false;
  }
});

// ===== تشغيل البوت =====
client.login(process.env.DISCORD_TOKEN);
