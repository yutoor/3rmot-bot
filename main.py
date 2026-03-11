# ==============================================================================
# المشروع: بوت RMOT الصوتي - الإصدار الرابع (Support Queue + Points System)
# الوصف: نسخة محسنة مع نظام قبول/رفض الطلبات + نقاط للدعم الفني + تصعيد للإدارة بعد 5 دقائق
# ==============================================================================

import os
import json
import asyncio
import time
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
# [2] إعدادات الربط والتشغيل
# ------------------------------------------------------------------------------
VOICE_ID = 1466581684290850984               # آيدي روم الانتظار الصوتي
STAFF_CHANNEL_ID = 1467779526351392880       # روم تنبيه الإدارة / الدعم
ADMIN_ROLE_ID = 1466572944166883461          # رتبة الإدارة
SUPPORT_ROLE_ID = 1467515919046541494        # رتبة الدعم الفني
AUDIO_FILE = "support.mp3"                   # ملف الصوت
PANEL_IMAGE = "POT.png"                      # صورة البنل
POINTS_FILE = "support_points.json"          # ملف حفظ النقاط
ESCALATION_SECONDS = 300                     # 5 دقائق

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
# [4] متغيرات عامة
# ------------------------------------------------------------------------------
voice_lock = asyncio.Lock()
last_voice_refresh = 0

# pending_requests:
# member_id -> {
#   "claimed": bool,
#   "claimed_by": int | None,
#   "message_id": int | None,
#   "created_at": float,
#   "staff_channel_id": int,
#   "guild_id": int
# }
pending_requests = {}

# ------------------------------------------------------------------------------
# [5] إدارة النقاط
# ------------------------------------------------------------------------------
def load_points():
    if not os.path.exists(POINTS_FILE):
        return {}

    try:
        with open(POINTS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return {int(k): int(v) for k, v in data.items()}
    except Exception as e:
        print(f"❌ Failed to load points file: {e}")
        return {}

def save_points():
    try:
        serializable = {str(k): v for k, v in support_points.items()}
        with open(POINTS_FILE, "w", encoding="utf-8") as f:
            json.dump(serializable, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"❌ Failed to save points file: {e}")

support_points = load_points()

def add_point(user_id: int):
    support_points[user_id] = support_points.get(user_id, 0) + 1
    save_points()

def reset_all_points():
    support_points.clear()
    save_points()

def has_role(member: discord.Member, role_id: int) -> bool:
    return any(role.id == role_id for role in getattr(member, "roles", []))

# ------------------------------------------------------------------------------
# [6] النوافذ المنبثقة
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
# [7] أزرار الطلبات (قبول / رفض)
# ------------------------------------------------------------------------------
class SupportRequestView(View):
    def __init__(self, member_id: int):
        super().__init__(timeout=None)
        self.member_id = member_id

    @discord.ui.button(
        label="قبول الطلب ✅",
        style=discord.ButtonStyle.green,
        custom_id="support_accept_request"
    )
    async def accept_request(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not isinstance(interaction.user, discord.Member):
            await interaction.response.send_message("❌ تعذر التحقق من العضو.", ephemeral=True)
            return

        if not has_role(interaction.user, SUPPORT_ROLE_ID):
            await interaction.response.send_message("❌ هذا الزر مخصص للدعم الفني فقط.", ephemeral=True)
            return

        request_data = pending_requests.get(self.member_id)
        if not request_data:
            await interaction.response.send_message("⚠️ هذا الطلب غير موجود أو انتهى.", ephemeral=True)
            return

        if request_data["claimed"]:
            claimer_id = request_data.get("claimed_by")
            claimer_text = f"<@{claimer_id}>" if claimer_id else "موظف آخر"
            await interaction.response.send_message(
                f"⚠️ تم قبول هذا الطلب مسبقًا بواسطة {claimer_text}.",
                ephemeral=True
            )
            return

        request_data["claimed"] = True
        request_data["claimed_by"] = interaction.user.id
        add_point(interaction.user.id)

        member = interaction.guild.get_member(self.member_id)
        member_mention = member.mention if member else f"`{self.member_id}`"

        embed = discord.Embed(
            title="✅ تم قبول الطلب",
            description=(
                f"تم استلام طلب العضو {member_mention}\n"
                f"بواسطة {interaction.user.mention}\n\n"
                f"🏅 مجموع نقاطه الآن: **{support_points.get(interaction.user.id, 0)}**"
            ),
            color=0x00ff00
        )

        await interaction.response.edit_message(embed=embed, view=None)

    @discord.ui.button(
        label="رفض الطلب ❌",
        style=discord.ButtonStyle.red,
        custom_id="support_reject_request"
    )
    async def reject_request(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not isinstance(interaction.user, discord.Member):
            await interaction.response.send_message("❌ تعذر التحقق من العضو.", ephemeral=True)
            return

        if not has_role(interaction.user, SUPPORT_ROLE_ID):
            await interaction.response.send_message("❌ هذا الزر مخصص للدعم الفني فقط.", ephemeral=True)
            return

        request_data = pending_requests.get(self.member_id)
        if not request_data:
            await interaction.response.send_message("⚠️ هذا الطلب غير موجود أو انتهى.", ephemeral=True)
            return

        if request_data["claimed"]:
            await interaction.response.send_message(
                "⚠️ هذا الطلب تم قبوله مسبقًا ولا يمكن رفضه الآن.",
                ephemeral=True
            )
            return

        member = interaction.guild.get_member(self.member_id)
        member_mention = member.mention if member else f"`{self.member_id}`"

        await interaction.response.send_message(
            f"❌ {interaction.user.mention} رفض طلب العضو {member_mention}.",
            ephemeral=False
        )

# ------------------------------------------------------------------------------
# [8] لوحة التحكم
# ------------------------------------------------------------------------------
class ControlPanel(View):
    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(label="إعلان 📢", style=discord.ButtonStyle.green, custom_id="m_ann")
    async def announcement(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not has_role(interaction.user, ADMIN_ROLE_ID):
            await interaction.response.send_message("❌ للإدارة فقط!", ephemeral=True)
            return
        await interaction.response.send_modal(AnnouncementModal())

    @discord.ui.button(label="تحذير ⚠️", style=discord.ButtonStyle.red, custom_id="m_warn")
    async def warning(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not has_role(interaction.user, ADMIN_ROLE_ID):
            await interaction.response.send_message("❌ للإدارة فقط!", ephemeral=True)
            return
        await interaction.response.send_modal(WarningModal())

    @discord.ui.button(label="طرد 👢", style=discord.ButtonStyle.red, custom_id="m_kick")
    async def kick(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not has_role(interaction.user, ADMIN_ROLE_ID):
            await interaction.response.send_message("❌ للإدارة فقط!", ephemeral=True)
            return

        await interaction.response.send_message(
            "👢 نظام الطرد اليدوي: يرجى استخدام الأمر الإداري المباشر.",
            ephemeral=True
        )

    @discord.ui.button(label="تنبيه 🔔", style=discord.ButtonStyle.blurple, custom_id="m_alert")
    async def alert(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not has_role(interaction.user, ADMIN_ROLE_ID):
            await interaction.response.send_message("❌ للإدارة فقط!", ephemeral=True)
            return

        await interaction.response.send_message(
            "🔔 تم تفعيل نظام التنبيهات السريع.",
            ephemeral=True
        )

    @discord.ui.button(label="رتبة 🏅", style=discord.ButtonStyle.grey, custom_id="m_role")
    async def role(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not has_role(interaction.user, ADMIN_ROLE_ID):
            await interaction.response.send_message("❌ للإدارة فقط!", ephemeral=True)
            return

        await interaction.response.send_message(
            "🏅 يرجى الانتظار في الروم الصوتي ليتم تسليمك الرتبة.",
            ephemeral=True
        )

    @discord.ui.button(label="معلومات ℹ️", style=discord.ButtonStyle.blurple, custom_id="m_info")
    async def info(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not has_role(interaction.user, ADMIN_ROLE_ID):
            await interaction.response.send_message("❌ للإدارة فقط!", ephemeral=True)
            return

        await interaction.response.send_message(
            "ℹ️ RMOT V4: نظام التحكم الصوتي والإداري المتكامل مع نقاط الدعم الفني.",
            ephemeral=True
        )

    @discord.ui.button(label="إعادة اتصال صوتي 🔄", style=discord.ButtonStyle.blurple, custom_id="m_recon")
    async def reconnect(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not has_role(interaction.user, ADMIN_ROLE_ID):
            await interaction.response.send_message("❌ للإدارة فقط!", ephemeral=True)
            return

        await interaction.response.send_message(
            "🔄 جاري تحديث اتصال البوت الصوتي...",
            ephemeral=True
        )

        try:
            await reconnect_voice()
        except Exception as e:
            print(f"Reconnect button error: {e}")

    @discord.ui.button(label="كشف النقاط 📊", style=discord.ButtonStyle.green, custom_id="m_points")
    async def show_points(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not has_role(interaction.user, ADMIN_ROLE_ID):
            await interaction.response.send_message("❌ للإدارة فقط!", ephemeral=True)
            return

        if not support_points:
            await interaction.response.send_message("لا توجد نقاط مسجلة حالياً.", ephemeral=True)
            return

        sorted_points = sorted(support_points.items(), key=lambda x: x[1], reverse=True)

        lines = []
        rank = 1
        for user_id, points in sorted_points:
            lines.append(f"**{rank}.** <@{user_id}> — **{points}** نقطة")
            rank += 1

        embed = discord.Embed(
            title="📊 كشف نقاط الدعم الفني",
            description="\n".join(lines),
            color=0x00ff00
        )

        await interaction.response.send_message(embed=embed, ephemeral=True)

    @discord.ui.button(label="تصفير النقاط ♻️", style=discord.ButtonStyle.red, custom_id="m_reset_points")
    async def reset_points_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not has_role(interaction.user, ADMIN_ROLE_ID):
            await interaction.response.send_message("❌ للإدارة فقط!", ephemeral=True)
            return

        reset_all_points()
        await interaction.response.send_message("✅ تم تصفير جميع نقاط الدعم الفني.", ephemeral=True)

# ------------------------------------------------------------------------------
# [9] دوال الصوت
# ------------------------------------------------------------------------------
async def ensure_voice_connected():
    global last_voice_refresh

    async with voice_lock:
        try:
            channel = await bot.fetch_channel(VOICE_ID)
        except Exception as e:
            print(f"❌ fetch_channel failed for VOICE_ID={VOICE_ID}: {e}")
            return

        if not isinstance(channel, discord.VoiceChannel):
            print(f"❌ VOICE_ID ليس روم صوتي: {VOICE_ID}")
            return

        vc = discord.utils.get(bot.voice_clients, guild=channel.guild)

        if vc and vc.is_connected():
            try:
                if vc.channel and vc.channel.id == channel.id:
                    return
                await vc.move_to(channel)
                print(f"🔄 Moved to voice channel: {channel.name}")
                return
            except Exception as e:
                print(f"❌ move_to error: {e}")
                try:
                    await vc.disconnect(force=True)
                except Exception:
                    pass

        try:
            print("🔄 Trying to connect to voice channel...")
            await channel.connect(timeout=20, reconnect=True)
            last_voice_refresh = time.time()
            print(f"✅ Connected to voice channel: {channel.name}")
        except discord.Forbidden:
            print("❌ Missing permissions: View Channel + Connect + Speak")
        except discord.ClientException as e:
            if "Already connected" in str(e):
                print("✅ البوت متصل بالفعل في الروم الصوتي")
            else:
                print(f"❌ ClientException while connecting: {e}")
        except asyncio.TimeoutError:
            print("❌ Voice connection timed out")
        except Exception as e:
            print(f"❌ Unexpected voice connect error: {type(e).__name__}: {e}")

async def reconnect_voice():
    try:
        guild = bot.guilds[0] if bot.guilds else None
        if not guild:
            return

        vc = discord.utils.get(bot.voice_clients, guild=guild)
        if vc:
            try:
                await vc.disconnect(force=True)
                await asyncio.sleep(2)
            except Exception as e:
                print(f"❌ Failed to disconnect old voice client: {e}")

        await ensure_voice_connected()
    except Exception as e:
        print(f"❌ reconnect_voice error: {e}")

async def play_welcome_sound(guild: discord.Guild):
    async with voice_lock:
        vc = discord.utils.get(bot.voice_clients, guild=guild)

        if not vc or not vc.is_connected():
            print("❌ البوت غير متصل صوتياً وقت تشغيل الصوت")
            await ensure_voice_connected()
            vc = discord.utils.get(bot.voice_clients, guild=guild)

        if not vc or not vc.is_connected():
            print("❌ تعذر تشغيل الصوت لأن الاتصال الصوتي غير موجود")
            return

        if not os.path.exists(AUDIO_FILE):
            print(f"❌ ملف الصوت غير موجود: {AUDIO_FILE}")
            return

        try:
            if vc.is_playing() or vc.is_paused():
                vc.stop()
                await asyncio.sleep(0.5)

            source = discord.FFmpegPCMAudio(
                executable="ffmpeg",
                source=AUDIO_FILE,
                before_options="-nostdin -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5",
                options="-vn"
            )
            vc.play(source)
            print(f"🔊 تم تشغيل الصوت: {AUDIO_FILE}")
        except Exception as e:
            print(f"❌ FFmpeg/Play error: {e}")
            try:
                if vc.is_connected():
                    await vc.disconnect(force=True)
            except Exception:
                pass

            await asyncio.sleep(2)
            await ensure_voice_connected()

# ------------------------------------------------------------------------------
# [10] نظام الطلبات
# ------------------------------------------------------------------------------
async def escalate_if_needed(member: discord.Member):
    await asyncio.sleep(ESCALATION_SECONDS)

    request_data = pending_requests.get(member.id)
    if not request_data:
        return

    if request_data["claimed"]:
        return

    guild = bot.get_guild(request_data["guild_id"])
    if not guild:
        return

    staff_channel = guild.get_channel(request_data["staff_channel_id"])
    if not staff_channel:
        return

    try:
        await staff_channel.send(
            f"🚨 <@&{ADMIN_ROLE_ID}> لم يتم قبول طلب العضو {member.mention} خلال 5 دقائق."
        )
    except Exception as e:
        print(f"❌ Failed to escalate to admin: {e}")

# ------------------------------------------------------------------------------
# [11] أحداث البوت
# ------------------------------------------------------------------------------
@bot.event
async def on_ready():
    print(f"✅ {bot.user} متصل وجاهز")
    print(f"✅ Logged in as {bot.user} | id={bot.user.id}")

    for guild in bot.guilds:
        print(f"📌 Guild: {guild.name} | id={guild.id}")

    bot.add_view(ControlPanel())
    bot.add_view(SupportRequestView(0))  # تسجيل الـ custom_id للأزرار

    if not stay_in_voice.is_running():
        stay_in_voice.start()

    if not voice_health_check.is_running():
        voice_health_check.start()

    if not periodic_voice_refresh.is_running():
        periodic_voice_refresh.start()

    await ensure_voice_connected()

@tasks.loop(seconds=20)
async def stay_in_voice():
    await ensure_voice_connected()

@stay_in_voice.before_loop
async def before_stay_in_voice():
    await bot.wait_until_ready()

@tasks.loop(minutes=2)
async def voice_health_check():
    try:
        for vc in bot.voice_clients:
            if not vc.is_connected():
                print("⚠️ Voice client غير متصل، جاري إعادة الاتصال...")
                await reconnect_voice()
            elif vc.channel is None:
                print("⚠️ Voice client بدون قناة، جاري إعادة الاتصال...")
                await reconnect_voice()
    except Exception as e:
        print(f"❌ voice_health_check error: {e}")

@voice_health_check.before_loop
async def before_voice_health_check():
    await bot.wait_until_ready()

@tasks.loop(hours=3)
async def periodic_voice_refresh():
    print("🔄 إعادة تهيئة صوتية دورية لمنع التعليق...")
    await reconnect_voice()

@periodic_voice_refresh.before_loop
async def before_periodic_voice_refresh():
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
                    request_embed = discord.Embed(
                        title="🎧 طلب جديد في روم الانتظار",
                        description=(
                            f"العضو {member.mention} دخل روم الانتظار.\n\n"
                            f"الدعم الفني: <@&{SUPPORT_ROLE_ID}>\n"
                            f"إذا لم يتم قبول الطلب خلال **5 دقائق** سيتم تصعيده للإدارة."
                        ),
                        color=0x2b2d31
                    )

                    msg = await staff_ch.send(
                        content=f"<@&{SUPPORT_ROLE_ID}>",
                        embed=request_embed,
                        view=SupportRequestView(member.id)
                    )

                    pending_requests[member.id] = {
                        "claimed": False,
                        "claimed_by": None,
                        "message_id": msg.id,
                        "created_at": time.time(),
                        "staff_channel_id": staff_ch.id,
                        "guild_id": member.guild.id
                    }

                    asyncio.create_task(escalate_if_needed(member))

            except Exception as e:
                print(f"❌ Staff alert error: {e}")

            try:
                await ensure_voice_connected()
                await asyncio.sleep(2)
                await play_welcome_sound(member.guild)
            except Exception as e:
                print(f"❌ Voice welcome error: {e}")

# ------------------------------------------------------------------------------
# [12] الأوامر
# ------------------------------------------------------------------------------
@bot.command(name='مساعدة')
async def show_panel(ctx):
    if has_role(ctx.author, ADMIN_ROLE_ID):
        embed = discord.Embed(
            title="🛡️ لوحة التحكم الإدارية الكبرى",
            description=(
                "**الصوتي RMOT نظام 4**\n\n"
                "اضغط على الأزرار لفتح نوافذ التحكم والإرسال التلقائي للخاص.\n"
                "وإدارة نقاط الدعم الفني."
            ),
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
        name="❓ نظام الانتظار",
        value="عند دخول عضو لروم الانتظار يتم إرسال طلب للدعم الفني مع زر قبول وزر رفض، وإذا لم يتم قبول الطلب خلال 5 دقائق يتم تصعيده للإدارة.",
        inline=False
    )
    guide.add_field(
        name="❓ نقاط الدعم الفني",
        value="كل موظف دعم فني يقبل طلبًا يحصل على نقطة، ويمكن للإدارة عرض النقاط أو تصفيرها من لوحة التحكم.",
        inline=False
    )
    guide.add_field(
        name="❓ النظام الصوتي",
        value="البوت يدخل الروم 24/7 ويشغل الصوت الترحيبي مع إعادة اتصال دورية لمنع التعليق.",
        inline=False
    )
    await ctx.send(embed=guide)

@bot.command(name='تجربة')
async def test_sound(ctx):
    await play_welcome_sound(ctx.guild)
    await ctx.send("✅ حاولت أشغل الصوت")

@bot.command(name='نقاط')
async def points_command(ctx):
    if not has_role(ctx.author, ADMIN_ROLE_ID):
        await ctx.send("❌ للإدارة فقط!")
        return

    if not support_points:
        await ctx.send("لا توجد نقاط حالياً.")
        return

    sorted_points = sorted(support_points.items(), key=lambda x: x[1], reverse=True)

    lines = []
    rank = 1
    for user_id, points in sorted_points:
        lines.append(f"**{rank}.** <@{user_id}> — **{points}** نقطة")
        rank += 1

    embed = discord.Embed(
        title="📊 كشف نقاط الدعم الفني",
        description="\n".join(lines),
        color=0x00ff00
    )
    await ctx.send(embed=embed)

@bot.command(name='تصفير_النقاط')
async def reset_points_command(ctx):
    if not has_role(ctx.author, ADMIN_ROLE_ID):
        await ctx.send("❌ للإدارة فقط!")
        return

    reset_all_points()
    await ctx.send("✅ تم تصفير نقاط الدعم الفني.")

# ------------------------------------------------------------------------------
# [13] تشغيل البوت
# ------------------------------------------------------------------------------
bot.run(TOKEN)
