const { Client, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  entersState,
  VoiceConnectionStatus,
  getVoiceConnection,
  StreamType
} = require("@discordjs/voice");

const path = require("path");
const fs = require("fs");

const VOICE_CHANNEL_ID = "1466581684290850984";
const AUDIO_FILE = path.join(__dirname, "3rmot_welcome.ogg");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

let player;

function getPlayer() {
  if (player) return player;

  player = createAudioPlayer();

  player.on("error", (error) => {
    console.log("Audio Error:", error);
  });

  return player;
}

async function joinVoice(guild) {

  const channel = guild.channels.cache.get(VOICE_CHANNEL_ID);
  if (!channel) {
    console.log("الروم الصوتي غير موجود");
    return;
  }

  let connection = getVoiceConnection(guild.id);

  if (!connection) {
    connection = joinVoiceChannel({
      channelId: VOICE_CHANNEL_ID,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 20000);

    connection.subscribe(getPlayer());

    console.log("البوت دخل الصوتية");
  }

  return connection;
}

function playSound() {

  if (!fs.existsSync(AUDIO_FILE)) {
    console.log("ملف الصوت غير موجود");
    return;
  }

  const resource = createAudioResource(AUDIO_FILE, {
    inputType: StreamType.OggOpus
  });

  const p = getPlayer();

  p.stop();
  p.play(resource);

  console.log("تم تشغيل الصوت");
}

client.once("ready", async () => {

  console.log(`Logged in as ${client.user.tag}`);

  const guild = client.guilds.cache.first();
  if (!guild) return;

  await joinVoice(guild);

});

client.on("voiceStateUpdate", async (oldState, newState) => {

  if (!newState.member || newState.member.user.bot) return;

  if (
    oldState.channelId !== VOICE_CHANNEL_ID &&
    newState.channelId === VOICE_CHANNEL_ID
  ) {

    console.log("دخل عضو جديد");

    let connection = getVoiceConnection(newState.guild.id);

    if (!connection) {
      connection = await joinVoice(newState.guild);
    }

    if (connection) {
      playSound();
    }

  }

});

client.login(process.env.DISCORD_TOKEN);
