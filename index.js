const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error("❌ Missing DISCORD_TOKEN environment variable");
  process.exit(1);
}

client.login(token);
