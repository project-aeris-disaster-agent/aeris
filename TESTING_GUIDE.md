# Local Testing Guide - Phase 1

## Bot is Running! 🚀

Your Disaster Response Telegram Bot is now running locally.

### How to Test

1. **Open Telegram** on your phone or desktop
2. **Search for your bot**: @AgentAeries_bot
3. **Start a conversation** by clicking "Start" or sending `/start`

### Test Commands

Try these commands in order:

#### 1. `/start` Command
**Expected Response:**
```
👋 Welcome to the Disaster Response Bot!

I'm here to help during disaster situations. I can provide:
• Emergency announcements and updates
• Latest news and information
• Accurate data from trusted sources
• Emergency assistance guidance
• Emotional support and de-escalation
• Financial assistance navigation
• Family finder services

Type /help for more information or just start chatting!
```

#### 2. `/help` Command
**Expected Response:**
```
📋 Available Commands:

/start - Start the bot
/help - Show this help message
/news - Get latest disaster-related news
/reset - Reset your session

You can also chat with me naturally, and I'll do my best to help!
```

#### 3. Regular Message
Send any regular message like: "Hello" or "What can you do?"

**Expected Response:**
```
I received your message: "Hello"

I'm currently in Phase 1 setup. In Phase 2, I'll be able to 
provide intelligent responses using AI. For now, I can help with 
basic commands. Type /help to see what I can do!
```

#### 4. `/reset` Command
**Expected Response:**
```
✅ Your session has been reset. How can I help you?
```

#### 5. `/news` Command
**Expected Response:**
```
📰 News feature coming soon!

In Phase 2, I'll be able to fetch real-time disaster news 
from multiple sources including Twitter/X via GROK API.
```

### What to Check

✅ **Bot responds immediately** (within 1-2 seconds)
✅ **Commands work correctly**
✅ **Session persists** (send multiple messages, bot remembers context)
✅ **Error handling** (try sending an invalid command)

### Troubleshooting

**Bot not responding?**
- Check the terminal/console for error messages
- Verify bot is still running (should see "Bot is running" message)
- Make sure you're messaging the correct bot (@AgentAeries_bot)

**Want to stop the bot?**
- Press `Ctrl+C` in the terminal where the bot is running

### Next Steps After Testing

Once you've verified everything works:
1. ✅ Local testing complete
2. → Proceed to Vercel deployment (Step 5)
3. → Set up Supabase (Step 2) - Optional for Phase 1

