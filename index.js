const { Client, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  entersState,
  VoiceConnectionStatus,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  getVoiceConnection,
  StreamType,
} = require("@discordjs/voice");

const path = require("path");
const fs = require("fs");

const VOICE_CHANNEL_ID = "1466581684290850984";
const AUDIO_FILE = path.join(__dirname, "3rmot_welcome.ogg");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

let player;

function getPlayer() {
  if (player) return player;

  player = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Play,
    },
  });

  player.on("error", (error) => {
    console.error("Audio Player Error:", error.message);
  });

  player.on(AudioPlayerStatus.Playing, () => {
    console.log("الصوت اشتغل");
  });

  player.on(AudioPlayerStatus.Idle, () => {
    console.log("انتهى الصوت، إعادة التشغيل...");
    playLoop();
  });

  return player;
}

function createTrack() {
  if (!fs.existsSync(AUDIO_FILE)) {
    console.log("ملف الصوت غير موجود:", AUDIO_FILE);
    return null;
  }

  return createAudioResource(AUDIO_FILE, {
    inputType: StreamType.OggOpus,
  });
}

function playLoop() {
  const p = getPlayer();
  const resource = createTrack();

  if (!resource) return;

  p.play(resource);
}

async function joinVoice(guild) {
  const channel = guild.channels.cache.get(VOICE_CHANNEL_ID);

  if (!channel) {
    console.log("الروم الصوتي غير موجود");
    return null;
  }

  let connection = getVoiceConnection(guild.id);

  if (!connection) {
    connection = joinVoiceChannel({
      channelId: VOICE_CHANNEL_ID,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });
  }

  connection.on("stateChange", async (_, newState) => {
    if (newState.status === VoiceConnectionStatus.Disconnected) {
      console.log("انقطع الاتصال، جاري محاولة الرجوع...");
      try {
        await entersState(connection, VoiceConnectionStatus.Signalling, 5000);
      } catch {
        try {
          connection.destroy();
        } catch {}
      }
    }
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 20000);
    connection.subscribe(getPlayer());
    console.log("البوت دخل الروم الصوتي");
    return connection;
  } catch (error) {
    console.error("فشل دخول الروم الصوتي:", error.message);
    try {
      connection.destroy();
    } catch {}
    return null;
  }
}

async function start24_7Player() {
  const guild = client.guilds.cache.first();
  if (!guild) {
    console.log("ما لقيت سيرفر");
    return;
  }

  const connection = await joinVoice(guild);
  if (!connection) return;

  const p = getPlayer();
  connection.subscribe(p);

  if (!fs.existsSync(AUDIO_FILE)) {
    console.log("ملف الصوت غير موجود:", AUDIO_FILE);
    return;
  }

  playLoop();
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log("مسار الملف:", AUDIO_FILE);
  console.log("هل الملف موجود؟", fs.existsSync(AUDIO_FILE));

  await start24_7Player();
});

client.on("voiceStateUpdate", async (_, newState) => {
  if (!newState.guild) return;

  const connection = getVoiceConnection(newState.guild.id);
  if (!connection) {
    console.log("ما فيه اتصال صوتي، محاولة إعادة الدخول...");
    await start24_7Player();
  }
});

client.login(process.env.DISCORD_TOKEN);
