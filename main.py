# ==============================================================================
# المشروع: بوت RMOT الصوتي - الإصدار الرابع المطور
# التعديل: حل مشكلة الثبات في الروم الصوتي 24/7
# ==============================================================================

import os
import discord
from discord.ext import commands, tasks
from discord.ui import View, Modal, TextInput
from dotenv import load_dotenv
import asyncio

# ------------------------------------------------------------------------------
# [1] إعدادات الربط والتشغيل
# ------------------------------------------------------------------------------
load_dotenv()
TOKEN = os.getenv("TOKEN")

VOICE_ID = 1466581684290850984          # آيدي روم الانتظار الصوتي
STAFF_CHANNEL_ID = 1467779526351392880  # روم تنبيه الإدارة
STAFF_ROLE_ID = 1466572944166883461     # رتبة الإدارة
AUDIO_FILE = "support.mp3"              # ملف الصوت
PANEL_IMAGE = "POT.png"                 # صورة البنل

# ------------------------------------------------------------------------------
# [2] إعدادات البوت
# ------------------------------------------------------------------------------
intents = discord.Intents.default()
intents.message_content = True
intents.voice_states = True
intents.guilds = True
intents.members = True

bot = commands.Bot(command_prefix='!', intents=intents, help_command=None)

# ------------------------------------------------------------------------------
# [3] نوافذ إدخال البيانات (Modals)
# ------------------------------------------------------------------------------
class WarningModal(Modal, title="إصدار تحذير رسمي"):
    user_id = TextInput(label="آيدي العضو المعني", placeholder="أدخل ID العضو هنا...", min_length=15)
    reason = TextInput(label="سبب التحذير", style=discord.TextStyle.paragraph, placeholder="اكتب السبب بوضوح...")

    async def on_submit(self, interaction: discord.Interaction):
        try:
            user = await bot.fetch_user(int(self.user_id.value))
            embed = discord.Embed(title="⚠️ تحذير رسمي من الإدارة", description=f"تم إصدار تحذير بحقك بسبب:\n**{self.reason.value}**", color=0xff0000)
            await user.send(embed=embed)
            await interaction.response.send_message(f"✅ تم إرسال التحذير للعضو {user.name} في الخاص.", ephemeral=True)
        except Exception as e:
            await interaction.response.send_message("❌ فشل الإرسال! تأكد من الآيدي أو أن الخاص مغلق.", ephemeral=True)

class AnnouncementModal(Modal, title="نشر إعلان رتبة"):
    role_id = TextInput(label="آيدي الرتبة المستهدفة", placeholder="أدخل ID الرتبة هنا...", min_length=15)
    message = TextInput(label="نص الإعلان", style=discord.TextStyle.paragraph, placeholder="اكتب الإعلان...")

    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.send_message("⏳ جاري البدء في عملية النشر التلقائي...", ephemeral=True)
        try:
            role = interaction.guild.get_role(int(self.role_id.value))
            if not role:
                await interaction.followup.send("❌ آيدي الرتبة غير صحيح!", ephemeral=True)
                return
            count = 0
            for member in role.members:
                try:
                    embed = discord.Embed(title="📢 إعلان هام", description=self.message.value, color=0x00ff00)
                    await member.send(embed=embed)
                    count += 1
                except: continue
            await interaction.followup.send(f"✅ تم الانتهاء! وصل الإعلان لـ {count} عضو.", ephemeral=True)
        except:
            await interaction.followup.send("❌ حدث خطأ أثناء الإرسال.", ephemeral=True)

# ------------------------------------------------------------------------------
# [4] لوحة التحكم RMOT
# ------------------------------------------------------------------------------
class ControlPanel(View):
    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(label="إعلان 📢", style=discord.ButtonStyle.green, custom_id="m_ann")
    async def announcement(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not any(role.id == STAFF_ROLE_ID for role in interaction.user.roles):
            return await interaction.response.send_message("❌ للإدارة فقط!", ephemeral=True)
        await interaction.response.send_modal(AnnouncementModal())

    @discord.ui.button(label="تحذير ⚠️", style=discord.ButtonStyle.red, custom_id="m_warn")
    async def warning(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not any(role.id == STAFF_ROLE_ID for role in interaction.user.roles):
            return await interaction.response.send_message("❌ للإدارة فقط!", ephemeral=True)
        await interaction.response.send_modal(WarningModal())

    @discord.ui.button(label="إعادة اتصال صوتي 🔄", style=discord.ButtonStyle.blurple, custom_id="m_recon")
    async def reconnect(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message("🔄 جاري تحديث اتصال البوت الصوتي...", ephemeral=True)
        await ensure_voice_connected(force=True)

# ------------------------------------------------------------------------------
# [5] دوال الصوت (تم تحسين الاستقرار هنا)
# ------------------------------------------------------------------------------
async def ensure_voice_connected(force=False):
    """دالة لفرض بقاء البوت في الروم الصوتي المكتوب في الإعدادات"""
    channel = bot.get_channel(VOICE_ID)
    if not channel or not isinstance(channel, discord.VoiceChannel):
        print("❌ خطأ: الروم الصوتي غير موجود أو الآيدي خطأ.")
        return

    vc = discord.utils.get(bot.voice_clients, guild=channel.guild)

    # إذا كان البوت متصلاً بالفعل وفي الروم الصحيح، لا تفعل شيئاً إلا إذا طلبت "فرض الاتصال"
    if vc and vc.is_connected():
        if vc.channel.id != channel.id or force:
            try:
                await vc.move_to(channel)
                print(f"🔄 تم نقل البوت إلى الروم الصحيح: {channel.name}")
            except Exception as e:
                print(f"❌ خطأ أثناء النقل: {e}")
        return

    # الاتصال بالروم في حال عدم وجود اتصال سابق
    try:
        await channel.connect(reconnect=True, timeout=20.0)
        print(f"✅ تم دخول الروم الصوتي بنجاح: {channel.name}")
    except Exception as e:
        print(f"❌ فشل الاتصال بالروم الصوتي: {e}")

def play_welcome_sound(guild: discord.Guild):
    """تشغيل ملف support.mp3"""
    vc = discord.utils.get(bot.voice_clients, guild=guild)
    if vc and vc.is_connected() and os.path.exists(AUDIO_FILE):
        try:
            if vc.is_playing(): vc.stop()
            vc.play(discord.FFmpegPCMAudio(AUDIO_FILE))
        except Exception as e:
            print(f"❌ خطأ تشغيل الصوت: {e}")

# ------------------------------------------------------------------------------
# [6] أحداث البوت والمهام التلقائية
# ------------------------------------------------------------------------------
@bot.event
async def on_ready():
    print(f"✅ {bot.user} متصل وجاهز للعمل")
    bot.add_view(ControlPanel())
    if not stay_in_voice.is_running():
        stay_in_voice.start()
    await ensure_voice_connected()

@tasks.loop(seconds=15) # تقليل الوقت لضمان سرعة العودة
async def stay_in_voice():
    await ensure_voice_connected()

@bot.event
async def on_voice_state_update(member, before, after):
    if member.bot: return

    # تنبيه الإدارة وتشغيل الصوت عند دخول شخص للروم المحدد
    if after.channel and after.channel.id == VOICE_ID:
        if before.channel is None or before.channel.id != VOICE_ID:
            staff_ch = bot.get_channel(STAFF_CHANNEL_ID)
            if staff_ch:
                await staff_ch.send(f"🚨 <@&{STAFF_ROLE_ID}>، العضو **{member.name}** دخل الانتظار!")
            
            await ensure_voice_connected()
            play_welcome_sound(member.guild)

# ------------------------------------------------------------------------------
# [7] الأوامر
# ------------------------------------------------------------------------------
@bot.command(name='مساعدة')
async def show_panel(ctx):
    if any(role.id == STAFF_ROLE_ID for role in ctx.author.roles):
        embed = discord.Embed(title="🛡️ لوحة التحكم الإدارية الكبرى", description="**نظام RMOT المستقر**\nتم تحسين نظام البقاء الصوتي 24/7.", color=0x2b2d31)
        if os.path.exists(PANEL_IMAGE):
            file = discord.File(PANEL_IMAGE, filename="p.png")
            embed.set_image(url="attachment://p.png")
            await ctx.send(file=file, embed=embed, view=ControlPanel())
        else:
            await ctx.send(embed=embed, view=ControlPanel())
    else:
        await ctx.send("❌ للإدارة فقط!")

bot.run(TOKEN)
