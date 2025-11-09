# Dual-Mode Setup Guide

## Overview

The Disaster Response Bot now supports **dual-mode operation**:

1. **Bot Account** (@AgentAeries_bot): For bot-specific interactions
2. **User Account** (@agent_aeris): For group chats and direct messages as a regular user

## Configuration

### Update Your .env File

Add the following to your `.env` file:

```bash
# User Account Configuration (for group chats and direct messages)
TELEGRAM_PHONE_NUMBER=+639083982018
TELEGRAM_USER_SESSION=agent_aeris_user
```

### Phone Number Format

- **Required format**: `+[country code][phone number]`
- **Example**: `+639083982018` (Philippines)
- **Important**: Include the `+` sign and country code

## How It Works

### Bot Account Mode
- Responds to direct messages sent to @AgentAeries_bot
- Works in any chat where the bot is added
- Uses bot token authentication

### User Account Mode  
- Responds as @agent_aeris in group chats
- Responds to direct messages sent to @agent_aeris
- Only responds when:
  - Bot is mentioned: `@agent_aeris help me`
  - Message is a reply to bot's previous message
- Uses phone number authentication

## First-Time Setup

### 1. Phone Number Authentication

When you first run with user account mode, Telethon will:

1. Send a verification code to your phone number
2. You'll need to enter the code in the terminal
3. If 2FA is enabled, you'll also need to enter your password

**Example:**
```
Please enter the code you received: 12345
```

### 2. Session File

After successful authentication, Telethon creates a session file:
- `agent_aeris_user.session` (or name from `TELEGRAM_USER_SESSION`)
- This file stores your authentication
- **Keep this file secure** - don't commit it to git
- Already added to `.gitignore`

## Running Dual-Mode

### Start Both Clients

```bash
python main.py
```

The system will automatically:
- Start bot account if `TELEGRAM_BOT_TOKEN` is set
- Start user account if `TELEGRAM_PHONE_NUMBER` is set
- Run both simultaneously if both are configured

### Expected Output

```
INFO - Initializing Disaster Response Bot (Dual-Mode)...
INFO - Telethon bot client initialized
INFO - Telethon user account client initialized
INFO - Bot started successfully
INFO - Bot running as @AgentAeries_bot
INFO - User account started successfully
INFO - User account running as @agent_aeris (ID: 123456789)
============================================================
Bot account: Running
User account: Running (group chats enabled)
Press Ctrl+C to stop.
============================================================
```

## Testing

### Test Bot Account
1. Open Telegram
2. Search for @AgentAeries_bot
3. Send `/start`
4. Bot should respond

### Test User Account - Direct Message
1. Open Telegram
2. Search for @agent_aeris
3. Send a direct message
4. Bot should respond as @agent_aeris

### Test User Account - Group Chat
1. Add @agent_aeris to a group
2. Mention the bot: `@agent_aeris help me`
3. Bot should reply in the group
4. Reply to bot's message
5. Bot should respond to your reply

## Group Chat Behavior

The user account will **only respond** in group chats when:
- ✅ Bot is mentioned: `@agent_aeris what's the weather?`
- ✅ Message is a reply to bot's previous message

This prevents spam and ensures the bot only responds when directly addressed.

## Troubleshooting

### "Phone number invalid"
- Check format: Must include `+` and country code
- Example: `+639083982018` not `639083982018`

### "Session password needed"
- Your account has 2FA enabled
- Enter your 2FA password when prompted

### "Code expired"
- Verification codes expire quickly
- Restart and request a new code

### Bot not responding in groups
- Make sure bot is mentioned: `@agent_aeris`
- Or reply to bot's previous message
- Check logs for errors

## Security Notes

⚠️ **Important Security Considerations:**

1. **Session Files**: Never commit `.session` files to git
2. **Phone Number**: Keep your phone number private
3. **2FA**: Enable 2FA on your Telegram account for security
4. **API Credentials**: Keep `.env` file secure

## Next Steps

After setting up dual-mode:
1. ✅ Test bot account
2. ✅ Test user account direct messages
3. ✅ Test user account in group chats
4. → Proceed to Phase 2 (LLM Integration)

