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

let guildId = null;

// دخول الروم الصوتي
async function joinVoice(guild) {
  const channel = guild.channels.cache.get(VOICE_CHANNEL_ID);

  if (!channel) {
    console.log("❌ الروم الصوتي غير موجود");
    return;
  }

  let connection = getVoiceConnection(guild.id);

  if (!connection) {
    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 15000);

    connection.subscribe(player);
    guildId = guild.id;

    console.log("✅ البوت دخل الروم الصوتي");
  }

  return connection;
}

// تشغيل الصوت
async function playSound() {
  try {
    const stream = await play.stream(YOUTUBE_URL);

    const resource = createAudioResource(stream.stream, {
      inputType: stream.type,
    });

    player.stop();
    player.play(resource);

    console.log("🔊 تشغيل الصوت");
  } catch (err) {
    console.log("❌ خطأ تشغيل الصوت:", err);
  }
}

// تثبيت البوت في الصوتية
async function keepBotInVoice() {
  if (!guildId) return;

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const connection = getVoiceConnection(guild.id);

  if (!connection) {
    console.log("♻️ إعادة دخول الصوتية...");
    await joinVoice(guild);
  }
}

// جاهزية البوت
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const guild = client.guilds.cache.first();

  if (!guild) {
    console.log("❌ لا يوجد سيرفر");
    return;
  }

  await joinVoice(guild);

  setInterval(() => {
    keepBotInVoice();
  }, 20000);
});

// دخول عضو جديد
client.on("voiceStateUpdate", async (oldState, newState) => {
  if (newState.member.user.bot) return;

  const joined =
    oldState.channelId !== VOICE_CHANNEL_ID &&
    newState.channelId === VOICE_CHANNEL_ID;

  if (joined) {
    console.log(`👤 دخل عضو: ${newState.member.user.tag}`);

    const connection = getVoiceConnection(newState.guild.id);

    if (!connection) {
      await joinVoice(newState.guild);
    }

    playSound();
  }
});

client.login(process.env.DISCORD_TOKEN);
