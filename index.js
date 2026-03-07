const { Client, GatewayIntentBits, Partials } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, 
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

// ====== Settings ======
const PREFIX = "!";
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID || null;     
const SUPPORT_ROLE_ID = process.env.SUPPORT_ROLE_ID || null; 
const BROADCAST_ROLE_ID = process.env.BROADCAST_ROLE_ID || null;     

const sessions = new Map(); 
const SESSION_TTL_MS = 5 * 60 * 1000;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function hasCommandPermission(member) {
  if (!member) return false;
  if (member.permissions.has("Administrator")) return true;
  if (ADMIN_ROLE_ID && member.roles.cache.has(ADMIN_ROLE_ID)) return true;
  if (SUPPORT_ROLE_ID && member.roles.cache.has(SUPPORT_ROLE_ID)) return true;
  return false;
}

client.on("ready", () => {
  console.log("🚀 Bot is Online and ready!");
});

client.on("messageCreate", async (message) => {
  try {
    if (!message.guild || message.author.bot) return;

    const content = message.content.trim();
    const hasActiveSession = sessions.has(message.author.id);

    // Auto-delete user messages for cleaner chat
    if (content.startsWith(PREFIX) || hasActiveSession) {
        setTimeout(() => message.delete().catch(() => null), 500);
    }

    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
    if (!hasCommandPermission(member)) return;

    // --- Help Command ---
    if (content === PREFIX + "help" || content === PREFIX + "commands" || content === PREFIX + "اوامر") {
      sessions.set(message.author.id, {
        step: "choose_action",
        createdAt: Date.now(),
      });

      const menuMsg = await message.reply("⚙️ Dashboard: Send (3) to start Safe Broadcast.");
      setTimeout(() => menuMsg.delete().catch(() => null), 10000);
      return;
    }

    const sess = sessions.get(message.author.id);
    if (sess && (Date.now() - sess.createdAt < SESSION_TTL_MS)) {
      
      if (content === "cancel" || content === "الغاء") {
        sessions.delete(message.author.id);
        const cancelMsg = await message.channel.send("Done: Session Cancelled.");
        setTimeout(() => cancelMsg.delete().catch(() => null), 3000);
        return;
      }

      // Step 1: Choose Action
      if (sess.step === "choose_action") {
        if (content === "3") {
            sess.action = "promo_dm";
            sess.step = "ask_body";
            const msg = await message.channel.send("📝 Write your Promo message now:");
            setTimeout(() => msg.delete().catch(() => null), 5000);
            return;
        }
      }

      // Step 2: Execute Safe Broadcast (10s Delay)
      if (sess.step === "ask_body" && sess.action === "promo_dm") {
        const body = content;
        const role = await message.guild.roles.fetch(BROADCAST_ROLE_ID).catch(() => null);
        
        if (!role) return message.channel.send("Error: BROADCAST_ROLE_ID not found.");
        
        const targets = role.members.filter(m => !m.user.bot);
        if (targets.size === 0) return message.channel.send("Error: No members in this role.");

        sessions.delete(message.author.id);
        let statusMsg = await message.channel.send("⏳ Sending to " + targets.size + " members... (10s delay)");

        let count = 0;
        const targetArray = Array.from(targets.values());

        for (let i = 0; i < targetArray.length; i++) {
            try {
                await targetArray[i].send("📢 **Broadcast Message**\n----------\n" + body);
                count++;
            } catch (e) {
                console.log("Failed to send to: " + targetArray[i].user.tag);
            }

            if (i < targetArray.length - 1) await wait(10000);
        }

        await statusMsg.edit("✅ Success! Sent to " + count + " members.");
        setTimeout(() => statusMsg.delete().catch(() => null), 10000);
      }
    }
  } catch (err) {
    console.error("Internal Error:", err);
  }
});

client.login(process.env.DISCORD_TOKEN);
