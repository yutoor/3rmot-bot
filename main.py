# ==============================================================================
# المشروع: بوت RMOT الصوتي - الإصدار الرابع (Modal & Admin System)
# الوصف: لوحة تحكم إدارية بنظام النوافذ المنبثقة لإرسال التحذيرات والإعلانات في الخاص
# المميزات: صوت 24/7، منشن إدارة، نوافذ إدخال بيانات، إرسال تلقائي للخاص
# ==============================================================================

import os
import discord
from discord.ext import commands, tasks
from discord.ui import View, Modal, TextInput
from dotenv import load_dotenv

# ------------------------------------------------------------------------------
# [1] تحميل التوكن من متغيرات البيئة
# ------------------------------------------------------------------------------
load_dotenv()
TOKEN = os.getenv("TOKEN")

if not TOKEN:
    raise ValueError("TOKEN not found in environment variables")

# ------------------------------------------------------------------------------
# [2] إعدادات الربط والتشغيل (Configuration)
# ------------------------------------------------------------------------------
VOICE_ID = 1466581684290850984          # آيدي روم الانتظار الصوتي
STAFF_CHANNEL_ID = 1467779526351392880  # روم تنبيه الإدارة
STAFF_ROLE_ID = 1466572944166883461     # رتبة الإدارة
AUDIO_FILE = "support.mp3"              # ملف الصوت
PANEL_IMAGE = "POT.png"                 # صورة البنل

# ------------------------------------------------------------------------------
# [3] إعدادات البوت
# ------------------------------------------------------------------------------
intents = discord.Intents.default()
intents.message_content = True
intents.voice_states = True
intents.guilds = True
intents.members = True

bot = commands.Bot(command_prefix='!', intents=intents, help_command=None)

# ------------------------------------------------------------------------------
# [4] نوافذ إدخال البيانات (Modals)
# ------------------------------------------------------------------------------
class WarningModal(Modal, title="إصدار تحذير رسمي"):
    user_id = TextInput(
        label="آيدي العضو المعني",
        placeholder="أدخل ID العضو هنا...",
        min_length=15
    )
    reason = TextInput(
        label="سبب التحذير",
        style=discord.TextStyle.paragraph,
        placeholder="اكتب السبب بوضوح..."
    )

    async def on_submit(self, interaction: discord.Interaction):
        try:
            user = await bot.fetch_user(int(self.user_id.value))
            embed = discord.Embed(
                title="⚠️ تحذير رسمي من الإدارة",
                description=f"تم إصدار تحذير بحقك بسبب:\n**{self.reason.value}**",
                color=0xff0000
            )
            await user.send(embed=embed)
            await interaction.response.send_message(
                f"✅ تم إرسال التحذير للعضو {user.name} في الخاص.",
                ephemeral=True
            )
        except Exception as e:
            print(f"WarningModal error: {e}")
            await interaction.response.send_message(
                "❌ فشل الإرسال! تأكد من الآيدي أو أن العضو مغلق الخاص.",
                ephemeral=True
            )


class AnnouncementModal(Modal, title="نشر إعلان رتبة"):
    role_id = TextInput(
        label="آيدي الرتبة المستهدفة",
        placeholder="أدخل ID الرتبة هنا...",
        min_length=15
    )
    message = TextInput(
        label="نص الإعلان",
        style=discord.TextStyle.paragraph,
        placeholder="اكتب الإعلان الذي سيصلهم في الخاص..."
    )

    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.send_message(
            "⏳ جاري البدء في عملية النشر التلقائي للرتبة...",
            ephemeral=True
        )

        try:
            role = interaction.guild.get_role(int(self.role_id.value))
            if not role:
                await interaction.followup.send("❌ آيدي الرتبة غير صحيح!", ephemeral=True)
                return

            count = 0
            for member in role.members:
                try:
                    embed = discord.Embed(
                        title="📢 إعلان هام",
                        description=self.message.value,
                        color=0x00ff00
                    )
                    await member.send(embed=embed)
                    count += 1
                except Exception:
                    continue

            await interaction.followup.send(
                f"✅ تم الانتهاء! وصل الإعلان لـ {count} عضو في الخاص.",
                ephemeral=True
            )
        except Exception as e:
            print(f"AnnouncementModal error: {e}")
            await interaction.followup.send("❌ صار خطأ أثناء الإرسال.", ephemeral=True)


# ------------------------------------------------------------------------------
# [5] لوحة التحكم RMOT
# ------------------------------------------------------------------------------
class ControlPanel(View):
    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(label="إعلان 📢", style=discord.ButtonStyle.green, custom_id="m_ann")
    async def announcement(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not any(role.id == STAFF_ROLE_ID for role in interaction.user.roles):
            await interaction.response.send_message("❌ للإدارة فقط!", ephemeral=True)
            return
        await interaction.response.send_modal(AnnouncementModal())

    @discord.ui.button(label="تحذير ⚠️", style=discord.ButtonStyle.red, custom_id="m_warn")
    async def warning(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not any(role.id == STAFF_ROLE_ID for role in interaction.user.roles):
            await interaction.response.send_message("❌ للإدارة فقط!", ephemeral=True)
            return
        await interaction.response.send_modal(WarningModal())

    @discord.ui.button(label="طرد 👢", style=discord.ButtonStyle.red, custom_id="m_kick")
    async def kick(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message(
            "👢 نظام الطرد اليدوي: يرجى استخدام الأمر الإداري المباشر.",
            ephemeral=True
        )

    @discord.ui.button(label="تنبيه 🔔", style=discord.ButtonStyle.blurple, custom_id="m_alert")
    async def alert(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message(
            "🔔 تم تفعيل نظام التنبيهات السريع.",
            ephemeral=True
        )

    @discord.ui.button(label="رتبة 🏅", style=discord.ButtonStyle.grey, custom_id="m_role")
    async def role(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message(
            "🏅 يرجى الانتظار في الروم الصوتي ليتم تسليمك الرتبة.",
            ephemeral=True
        )

    @discord.ui.button(label="معلومات ℹ️", style=discord.ButtonStyle.blurple, custom_id="m_info")
    async def info(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message(
            "ℹ️ RMOT V4: نظام التحكم الصوتي والإداري المتكامل.",
            ephemeral=True
        )

    @discord.ui.button(label="إعادة اتصال صوتي 🔄", style=discord.ButtonStyle.blurple, custom_id="m_recon")
    async def reconnect(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message(
            "🔄 جاري تحديث اتصال البوت الصوتي...",
            ephemeral=True
        )
        try:
            guild = interaction.guild
            vc = discord.utils.get(bot.voice_clients, guild=guild)
            channel = bot.get_channel(VOICE_ID)

            if vc and vc.is_connected():
                await vc.disconnect(force=True)

            if channel:
                await channel.connect(reconnect=True)
        except Exception as e:
            print(f"Reconnect button error: {e}")


# ------------------------------------------------------------------------------
# [6] دوال الصوت
# ------------------------------------------------------------------------------
async def ensure_voice_connected():
    channel = bot.get_channel(VOICE_ID)

    if channel is None:
        print("❌ Voice channel not found. تأكد من VOICE_ID")
        return

    if not isinstance(channel, discord.VoiceChannel):
        print("❌ VOICE_ID ليس روم صوتي")
        return

    vc = discord.utils.get(bot.voice_clients, guild=channel.guild)

    if vc and vc.is_connected():
        if vc.channel.id != channel.id:
            try:
                await vc.move_to(channel)
                print(f"🔄 تم نقل البوت إلى الروم: {channel.name}")
            except Exception as e:
                print(f"❌ Voice move error: {e}")
        return

    try:
        await channel.connect(reconnect=True)
        print(f"✅ تم دخول الروم الصوتي: {channel.name}")
    except Exception as e:
        print(f"❌ Voice connect error: {e}")


def play_welcome_sound(guild: discord.Guild):
    vc = discord.utils.get(bot.voice_clients, guild=guild)

    if not vc or not vc.is_connected():
        print("❌ البوت غير متصل صوتياً وقت تشغيل الصوت")
        return

    if not os.path.exists(AUDIO_FILE):
        print(f"❌ ملف الصوت غير موجود: {AUDIO_FILE}")
        return

    try:
        if vc.is_playing():
            vc.stop()

        source = discord.FFmpegPCMAudio(AUDIO_FILE)
        vc.play(source)
        print("🔊 تم تشغيل صوت الترحيب")
    except Exception as e:
        print(f"❌ FFmpeg/Play error: {e}")


# ------------------------------------------------------------------------------
# [7] أحداث البوت
# ------------------------------------------------------------------------------
@bot.event
async def on_ready():
    print(f"✅ {bot.user} متصل وجاهز")
    bot.add_view(ControlPanel())

    if not stay_in_voice.is_running():
        stay_in_voice.start()

    await ensure_voice_connected()


@tasks.loop(seconds=20)
async def stay_in_voice():
    await ensure_voice_connected()


@stay_in_voice.before_loop
async def before_stay_in_voice():
    await bot.wait_until_ready()


@bot.event
async def on_voice_state_update(member, before, after):
    if member.bot:
        return

    if after.channel and after.channel.id == VOICE_ID:
        if before.channel is None or before.channel.id != VOICE_ID:
            try:
                staff_ch = bot.get_channel(STAFF_CHANNEL_ID)
                if staff_ch:
                    await staff_ch.send(
                        f"🚨 <@&{STAFF_ROLE_ID}>، العضو **{member.name}** دخل الانتظار!"
                    )
            except Exception as e:
                print(f"❌ Staff alert error: {e}")

            try:
                await ensure_voice_connected()
                play_welcome_sound(member.guild)
            except Exception as e:
                print(f"❌ Voice welcome error: {e}")


# ------------------------------------------------------------------------------
# [8] الأوامر
# ------------------------------------------------------------------------------
@bot.command(name='مساعدة')
async def show_panel(ctx):
    if any(role.id == STAFF_ROLE_ID for role in ctx.author.roles):
        embed = discord.Embed(
            title="🛡️ لوحة التحكم الإدارية الكبرى",
            description="**الصوتي RMOT نظام 4**\n\nاضغط على الأزرار لفتح نوافذ التحكم والإرسال التلقائي للخاص.",
            color=0x2b2d31
        )

        if os.path.exists(PANEL_IMAGE):
            file = discord.File(PANEL_IMAGE, filename="p.png")
            embed.set_image(url="attachment://p.png")
            await ctx.send(file=file, embed=embed, view=ControlPanel())
        else:
            await ctx.send(embed=embed, view=ControlPanel())
    else:
        await ctx.send("❌ للإدارة فقط!")


@bot.command(name='هيلب')
async def manual(ctx):
    guide = discord.Embed(title="📚 دليل تشغيل بوت RMOT V4", color=0x00ff00)
    guide.add_field(
        name="❓ زر التحذير",
        value="يفتح لك نافذة تطلب منك آيدي العضو والسبب، ثم يرسل له البوت في الخاص مباشرة.",
        inline=False
    )
    guide.add_field(
        name="❓ زر الإعلان",
        value="يطلب منك آيدي الرتبة، ويرسل الإعلان لكل أعضاء هذه الرتبة في الخاص تلقائياً.",
        inline=False
    )
    guide.add_field(
        name="❓ النظام الصوتي",
        value="البوت يدخل الروم 24/7 ويشغل صوت ترحيبي ويمنشن الإدارة فور دخول عضو.",
        inline=False
    )
    await ctx.send(embed=guide)


# ------------------------------------------------------------------------------
# [9] تشغيل البوت
# ------------------------------------------------------------------------------
bot.run(TOKEN)
