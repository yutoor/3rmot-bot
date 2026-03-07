const { Client, GatewayIntentBits, ChannelType } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  entersState,
  VoiceConnectionStatus,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  getVoiceConnection,
} = require("@discordjs/voice");

const path = require("path");
const fs = require("fs");

const GUILD_ID = "1466567253733670976";
const VOICE_CHANNEL_ID = "1466581684290850984";
const AUDIO_FILE = path.join(__dirname, "3rmot_welcome.ogg");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
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
    console.error("Audio Player Error:", error);
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

function playLoop() {
  if (!fs.existsSync(AUDIO_FILE)) {
    console.log("ملف الصوت غير موجود:", AUDIO_FILE);
    return;
  }

  const resource = createAudioResource(AUDIO_FILE, {
    inputType: StreamType.OggOpus,
  });

  getPlayer().play(resource);
}

async function connectToVoice() {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const channel = await client.channels.fetch(VOICE_CHANNEL_ID);

    if (!guild) {
      console.log("السيرفر غير موجود");
      return null;
    }

    if (!channel) {
      console.log("الروم الصوتي غير موجود");
      return null;
    }

    if (
      channel.type !== ChannelType.GuildVoice &&
      channel.type !== ChannelType.GuildStageVoice
    ) {
      console.log("القناة ليست صوتية");
      return null;
    }

    console.log("اسم السيرفر:", guild.name);
    console.log("اسم الروم:", channel.name);

    const permissions = channel.permissionsFor(guild.members.me);
    console.log("ViewChannel:", permissions?.has("ViewChannel"));
    console.log("Connect:", permissions?.has("Connect"));
    console.log("Speak:", permissions?.has("Speak"));

    let connection = getVoiceConnection(guild.id);

    if (connection) {
      try {
        connection.destroy();
      } catch {}
    }

    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });

    connection.on("stateChange", (oldState, newState) => {
      console.log(`Voice state: ${oldState.status} -> ${newState.status}`);
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 30000);

    connection.subscribe(getPlayer());

    console.log("البوت دخل الروم الصوتي بنجاح");
    return connection;
  } catch (error) {
    console.error("فشل دخول الروم الصوتي:", error);
    return null;
  }
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log("هل الملف موجود؟", fs.existsSync(AUDIO_FILE));
  console.log("مسار الملف:", AUDIO_FILE);

  const connection = await connectToVoice();
  if (connection) {
    playLoop();
  }
});

client.on("voiceStateUpdate", async () => {
  const connection = getVoiceConnection(GUILD_ID);
  if (!connection) {
    console.log("ما فيه اتصال صوتي، محاولة إعادة الدخول...");
    const newConnection = await connectToVoice();
    if (newConnection) {
      playLoop();
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
