client.on("messageCreate", async (message) => {
  try {
    if (!message.guild || message.author.bot) return;

    // --- إضافة: حذف رسالة العضو إذا بدأت ببريفيكس البوت أو كانت رد على منيو ---
    const isCommand = message.content.startsWith(PREFIX);
    const hasActiveSession = sessions.has(message.author.id);
    
    if (isCommand || hasActiveSession) {
        // حذف رسالة الشخص بعد 1 ثانية عشان ما تخرب شكل الشات
        setTimeout(() => message.delete().catch(() => null), 1000);
    }
    // -------------------------------------------------------

    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
    const canUse = hasCommandPermission(member);
    const content = message.content.trim();

    if (content === `${PREFIX}مساعدة` || content === `${PREFIX}اوامر`) {
      if (!canUse) return;

      sessions.set(message.author.id, {
        step: "choose_action",
        createdAt: Date.now(),
        channelId: message.channel.id,
      });

      const reply = await message.reply("✨ **لوحة تحكم البوت جارية...** (سيتم حذف هذه الرسالة تلقائياً)");
      
      // حذف رد البوت بعد 10 ثواني إذا ما تفاعل المستخدم
      setTimeout(() => reply.delete().catch(() => null), 10000);
      return;
    }

    // في جزء التنفيذ النهائي (بعد اكتمال الإرسال):
    if (sess && sess.step === "ask_body") {
        // ... كود الإرسال اللي سويناه ...
        const finalMsg = await message.channel.send("✅ **اكتملت العملية بنجاح!**");
        
        // حذف رسالة النجاح بعد 5 ثواني
        setTimeout(() => finalMsg.delete().catch(() => null), 5000);
        cleanupSession(message.author.id);
    }

  } catch (err) {
    console.error(err);
  }
});
