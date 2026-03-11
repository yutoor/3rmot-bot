# ==============================================================================
# المشروع: بوت RMOT الصوتي - الإصدار الرابع (Stable Voice + Support Points)
# الوصف: نسخة محسنة مع نظام قبول/رفض الطلبات + نقاط للدعم الفني + تصعيد للإدارة
#        وتم تعديل نظام الصوت بالكامل ليشتغل بشكل ثابت مع ملف mp3 محلي
# ==============================================================================

import os
import json
import time
import asyncio
import discord
from discord.ext import commands, tasks
from discord.ui import View, Modal, TextInput
from dotenv import load_dotenv

# ------------------------------------------------------------------------------
# [1] تحميل التوكن
# ------------------------------------------------------------------------------
load_dotenv()
TOKEN = os.getenv("TOKEN")

if not TOKEN:
    raise ValueError("TOKEN not found in environment variables")

# ------------------------------------------------------------------------------
# [2] الإعدادات
# ------------------------------------------------------------------------------
VOICE_ID = 1466581684290850984
STAFF_CHANNEL_ID = 1467779526351392880
ADMIN_ROLE_ID = 1466572944166883461
SUPPORT_ROLE_ID = 1467515919046541494

AUDIO_FILE = "support.mp3"
PANEL_IMAGE = "POT.png"
POINTS_FILE = "support_points.json"

ESCALATION_SECONDS = 300  # 5 دقائق
VOICE_REFRESH_HOURS = 1   # كل ساعة

# إذا عندك ffmpeg في مسار معين حطه في .env باسم FFMPEG_PATH
FFMPEG_EXECUTABLE = os.getenv("FFMPEG_PATH", "ffmpeg")

# ------------------------------------------------------------------------------
# [3] إعدادات البوت
# ------------------------------------------------------------------------------
intents = discord.Intents.default()
intents.message_content = True
intents.voice_states = True
intents.guilds = True
intents.members = True

bot = commands.Bot(command_prefix="!", intents=intents, help_command=None)

# ------------------------------------------------------------------------------
# [4] متغيرات عامة
# ------------------------------------------------------------------------------
voice_lock = asyncio.Lock()

# member_id -> request data
pending_requests = {}

# ------------------------------------------------------------------------------
# [5] وظائف مساعدة
# ------------------------------------------------------------------------------
def has_role(member: discord.Member, role_id: int) -> bool:
    return any(role.id == role_id for role in getattr(member, "roles", []))

def get_audio_path() -> str:
    # نفس مجلد الكود الحالي
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_dir, AUDIO_FILE)

def load_points():
    if not os.path.exists(POINTS_FILE):
        return {}

    try:
        with open(POINTS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return {int(k): int(v) for k, v in data.items()}
    except Exception as e:
        print(f"❌ Failed to load points: {e}")
        return {}

def save_points():
    try:
        with open(POINTS_FILE, "w", encoding="utf-8") as f:
            json.dump({str(k): v for k, v in support_points.items()}, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"❌ Failed to save points: {e}")

def add_point(user_id: int):
    support_points[user_id] = support_points.get(user_id, 0) + 1
    save_points()

def reset_all_points():
    support_points.clear()
    save_points()

support_points = load_points()

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
# [7] أزرار طلبات الدعم
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
            await interaction.response.send_message("❌ هذا الزر للدعم الفني فقط.", ephemeral=True)
            return

        request_data = pending_requests.get(self.member_id)
        if not request_data:
            await interaction.response.send_message("⚠️ الطلب هذا غير موجود أو انتهى.", ephemeral=True)
            return

        if request_data["claimed"]:
            claimer_id = request_data.get("claimed_by")
            await interaction.response.send_message(
                f"⚠️ تم قبول الطلب مسبقًا بواسطة <@{claimer_id}>.",
                ephemeral=True
            )
            return

        request_data["claimed"] = True
        request_data["claimed_by"] = interaction.user.id
        request_data["claimed_at"] = time.time()

        add_point(interaction.user.id)

        member = interaction.guild.get_member(self.member_id)
        member_mention = member.mention if member else f"`{self.member_id}`"

        embed = discord.Embed(
            title="✅ تم قبول الطلب",
            description=(
                f"العضو: {member_mention}\n"
                f"الموظف: {interaction.user.mention}\n"
                f"النقاط الحالية: **{support_points.get(interaction.user.id, 0)}**"
            ),
            color=0x00ff00
        )

        await interaction.response.edit_message(content=None, embed=embed, view=None)

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
            await interaction.response.send_message("❌ هذا الزر للدعم الفني فقط.", ephemeral=True)
            return

        request_data = pending_requests.get(self.member_id)
        if not request_data:
            await interaction.response.send_message("⚠️ الطلب هذا غير موجود أو انتهى.", ephemeral=True)
            return

        if request_data["claimed"]:
            await interaction.response.send_message("⚠️ هذا الطلب تم قبوله مسبقًا.", ephemeral=True)
            return

        member = interaction.guild.get_member(self.member_id)
        member_mention = member.mention if member else f"`{self.member_id}`"

        embed = discord.Embed(
            title="❌ تم رفض الطلب",
            description=(
                f"العضو: {member_mention}\n"
                f"بواسطة: {interaction.user.mention}\n"
                f"الطلب ما زال بانتظار موظف آخر أو تصعيد الإدارة."
            ),
            color=0xff0000
        )

        await interaction.response.edit_message(content=None, embed=embed, view=SupportRequestView(self.member_id))

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
    async def reconnect_voice_btn(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not has_role(interaction.user, ADMIN_ROLE_ID):
            await interaction.response.send_message("❌ للإدارة فقط!", ephemeral=True)
            return

        await interaction.response.send_message("🔄 جاري إعادة الاتصال الصوتي...", ephemeral=True)
        await reconnect_voice()

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
        for i, (user_id, points) in enumerate(sorted_points, start=1):
            lines.append(f"**{i}.** <@{user_id}> — **{points}** نقطة")

        embed = discord.Embed(
            title="📊 كشف نقاط الدعم الفني",
            description="\n".join(lines),
            color=0x00ff00
        )
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @discord.ui.button(label="تصفير النقاط ♻️", style=discord.ButtonStyle.red, custom_id="m_reset_points")
    async def reset_points_btn(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not has_role(interaction.user, ADMIN_ROLE_ID):
            await interaction.response.send_message("❌ للإدارة فقط!", ephemeral=True)
            return

        reset_all_points()
        await interaction.response.send_message("✅ تم تصفير نقاط الدعم الفني.", ephemeral=True)

# ------------------------------------------------------------------------------
# [9] نظام الصوت
# ------------------------------------------------------------------------------
async def ensure_voice_connected():
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
            if vc.channel and vc.channel.id == channel.id:
                return
            try:
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
            print(f"✅ Connected to voice channel: {channel.name}")
        except discord.Forbidden:
            print("❌ Missing permissions: View Channel + Connect + Speak")
        except discord.ClientException as e:
            print(f"❌ ClientException while connecting: {e}")
        except asyncio.TimeoutError:
            print("❌ Voice connection timed out")
        except Exception as e:
            print(f"❌ Unexpected voice connect error: {type(e).__name__}: {e}")

async def reconnect_voice():
    async with voice_lock:
        try:
            for vc in list(bot.voice_clients):
                try:
                    await vc.disconnect(force=True)
                except Exception as e:
                    print(f"❌ Failed to disconnect voice client: {e}")

            await asyncio.sleep(2)
        except Exception as e:
            print(f"❌ reconnect disconnect phase error: {e}")

    await ensure_voice_connected()

async def play_welcome_sound(guild: discord.Guild):
    audio_path = get_audio_path()

    if not os.path.isfile(audio_path):
        print(f"❌ ملف الصوت غير موجود: {audio_path}")
        return

    async with voice_lock:
        vc = discord.utils.get(bot.voice_clients, guild=guild)

        if not vc or not vc.is_connected():
            print("❌ البوت غير متصل صوتياً وقت تشغيل الصوت")
            await ensure_voice_connected()
            await asyncio.sleep(1)
            vc = discord.utils.get(bot.voice_clients, guild=guild)

        if not vc or not vc.is_connected():
            print("❌ تعذر تشغيل الصوت لأن الاتصال الصوتي غير موجود")
            return

        try:
            if vc.is_playing() or vc.is_paused():
                vc.stop()
                await asyncio.sleep(0.7)

            print(f"🎵 تشغيل الملف: {audio_path}")
            print(f"🎵 ffmpeg executable: {FFMPEG_EXECUTABLE}")

            source = discord.FFmpegPCMAudio(
                source=audio_path,
                executable=FFMPEG_EXECUTABLE,
                options="-vn"
            )

            def after_play(error):
                if error:
                    print(f"❌ Audio after callback error: {error}")
                else:
                    print("✅ انتهى تشغيل الصوت بنجاح")

            vc.play(source, after=after_play)
            print(f"🔊 تم تشغيل الصوت: {audio_path}")

        except Exception as e:
            print(f"❌ FFmpeg/Play error: {type(e).__name__}: {e}")
            try:
                await vc.disconnect(force=True)
            except Exception:
                pass

# ------------------------------------------------------------------------------
# [10] التصعيد للإدارة بعد 5 دقائق
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
        print(f"❌ Failed to escalate request: {e}")

# ------------------------------------------------------------------------------
# [11] الأحداث
# ------------------------------------------------------------------------------
@bot.event
async def on_ready():
    print(f"✅ Logged in as {bot.user} | id={bot.user.id}")
    print(f"🎵 Audio file absolute path: {get_audio_path()}")
    print(f"🎵 FFmpeg executable: {FFMPEG_EXECUTABLE}")

    bot.add_view(ControlPanel())
    bot.add_view(SupportRequestView(0))

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
                print("⚠️ Voice client disconnected, reconnecting...")
                await reconnect_voice()
                return

            if vc.channel is None:
                print("⚠️ Voice client has no channel, reconnecting...")
                await reconnect_voice()
                return
    except Exception as e:
        print(f"❌ voice_health_check error: {e}")

@voice_health_check.before_loop
async def before_voice_health_check():
    await bot.wait_until_ready()

@tasks.loop(hours=VOICE_REFRESH_HOURS)
async def periodic_voice_refresh():
    print("🔄 إعادة تهيئة صوتية دورية كل ساعة...")
    await reconnect_voice()

@periodic_voice_refresh.before_loop
async def before_periodic_voice_refresh():
    await bot.wait_until_ready()

@bot.event
async def on_voice_state_update(member, before, after):
    if member.bot:
        return

    # دخل روم الانتظار
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
                await asyncio.sleep(1.5)
                await play_welcome_sound(member.guild)
            except Exception as e:
                print(f"❌ Voice welcome error: {e}")

    # إذا طلع العضو من روم الانتظار نحذف طلبه لو ما انقبل
    if before.channel and before.channel.id == VOICE_ID and (after.channel is None or after.channel.id != VOICE_ID):
        if member.id in pending_requests and not pending_requests[member.id]["claimed"]:
            del pending_requests[member.id]
            print(f"🗑️ تم حذف الطلب المعلق للعضو {member} لأنه خرج من روم الانتظار")

# ------------------------------------------------------------------------------
# [12] الأوامر
# ------------------------------------------------------------------------------
@bot.command(name="مساعدة")
async def show_panel(ctx):
    if not has_role(ctx.author, ADMIN_ROLE_ID):
        await ctx.send("❌ للإدارة فقط!")
        return

    embed = discord.Embed(
        title="🛡️ لوحة التحكم الإدارية الكبرى",
        description="**الصوتي RMOT نظام 4**\n\nاضغط على الأزرار للتحكم الكامل وإدارة نقاط الدعم الفني.",
        color=0x2b2d31
    )

    if os.path.exists(PANEL_IMAGE):
        file = discord.File(PANEL_IMAGE, filename="p.png")
        embed.set_image(url="attachment://p.png")
        await ctx.send(file=file, embed=embed, view=ControlPanel())
    else:
        await ctx.send(embed=embed, view=ControlPanel())

@bot.command(name="هيلب")
async def manual(ctx):
    embed = discord.Embed(title="📚 دليل تشغيل بوت RMOT V4", color=0x00ff00)
    embed.add_field(name="زر التحذير", value="يرسل تحذير للعضو في الخاص.", inline=False)
    embed.add_field(name="زر الإعلان", value="يرسل إعلان لكل أعضاء رتبة معينة في الخاص.", inline=False)
    embed.add_field(name="نظام الانتظار", value="يرسل تنبيه للدعم الفني مع أزرار قبول ورفض.", inline=False)
    embed.add_field(name="نظام النقاط", value="كل قبول طلب = نقطة للداعم.", inline=False)
    embed.add_field(name="النظام الصوتي", value="يدخل الروم 24/7 ويعيد الاتصال كل ساعة.", inline=False)
    await ctx.send(embed=embed)

@bot.command(name="تجربة")
async def test_sound(ctx):
    await play_welcome_sound(ctx.guild)
    await ctx.send("✅ حاولت أشغل الصوت، شيك اللوق.")

@bot.command(name="نقاط")
async def points_command(ctx):
    if not has_role(ctx.author, ADMIN_ROLE_ID):
        await ctx.send("❌ للإدارة فقط!")
        return

    if not support_points:
        await ctx.send("لا توجد نقاط حالياً.")
        return

    sorted_points = sorted(support_points.items(), key=lambda x: x[1], reverse=True)
    lines = [f"**{i}.** <@{uid}> — **{pts}** نقطة" for i, (uid, pts) in enumerate(sorted_points, start=1)]

    embed = discord.Embed(
        title="📊 كشف نقاط الدعم الفني",
        description="\n".join(lines),
        color=0x00ff00
    )
    await ctx.send(embed=embed)

@bot.command(name="تصفير_النقاط")
async def reset_points_command(ctx):
    if not has_role(ctx.author, ADMIN_ROLE_ID):
        await ctx.send("❌ للإدارة فقط!")
        return

    reset_all_points()
    await ctx.send("✅ تم تصفير النقاط.")

# ------------------------------------------------------------------------------
# [13] التشغيل
# ------------------------------------------------------------------------------
bot.run(TOKEN)
