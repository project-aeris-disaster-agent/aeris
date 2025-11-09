# Testing Guide - AERIS Bot & Streamlit Admin

## Services Status

✅ **Telegram Bot**: Running (check logs for status)
✅ **Streamlit Admin**: Running at http://localhost:8501

## How to Test

### 1. Test Telegram Bot

**Option A: Direct Message**
1. Open Telegram
2. Search for your bot: `@AgentAeries_bot` or `@agent_aeris`
3. Send test message: `/start`
4. Send emergency test: `"no, im in an abandooned building, with no electricity, its flooded outside and water is rising. i need rescue"`

**Option B: Group Chat**
1. Add `@agent_aeris` to a group
2. Mention the bot: `@agent_aeris help me`
3. Send emergency message

### 2. Test Streamlit Admin

1. Open browser: http://localhost:8501
2. Enter admin password (from `.env` file, default: `6666`)
3. Navigate to "Knowledge Base" section
4. Upload a PDF or add a URL
5. Verify it appears in the knowledge base

### 3. Monitor Logs

**Bot Logs**: Check terminal where `main.py` is running
- Look for: "Building prompt for query"
- Look for: "✅ RAG context injected"
- Look for: "LLM response received"
- Watch for: "⚠️ HALLUCINATION DETECTED" (should retry automatically)

**Streamlit Logs**: Check terminal where `run_admin.py` is running
- Look for: "You can now view your Streamlit app"
- Check for any errors

## What to Check

### ✅ Good Response Indicators:
- Response addresses the emergency
- Asks for location
- Provides actionable steps
- Uses RAG knowledge naturally
- No repetitive content
- No reference markers (`[REFERENCE X]`)

### ❌ Bad Response Indicators:
- Repetitive content ("house on the moon" repeated)
- Completely unrelated to query
- Contains reference markers
- Generic lists without action
- Too short or nonsensical

## Troubleshooting

### Bot Not Responding?
1. Check if bot process is running: `Get-Process python`
2. Check logs for errors
3. Verify `.env` has correct `TELEGRAM_BOT_TOKEN`
4. Check `OPENROUTER_API_KEY` is set

### Streamlit Not Loading?
1. Check if process is running
2. Try: http://localhost:8502 (if 8501 is busy)
3. Check logs for port conflicts
4. Verify `ADMIN_SECRET_KEY` is set in `.env`

### Hallucination Still Happening?
1. Check prompt length in logs (should be <3000 chars)
2. Verify RAG context is being injected
3. Check if emergency detection is working
4. Look for retry messages in logs

## Quick Commands

**Stop Both Services:**
```powershell
Get-Process python | Where-Object {$_.Path -like "*06 AERIS*"} | Stop-Process
```

**Restart Both:**
```powershell
python run_all.py
```

**Check Logs:**
- Bot: Look at terminal output
- Streamlit: Check browser console (F12)

## Test Scenarios

### Scenario 1: Emergency Rescue
**Message**: "no, im in an abandooned building, with no electricity, its flooded outside and water is rising. i need rescue"

**Expected Response:**
- Empathetic opening
- Asks for exact location
- Provides immediate safety steps
- Uses RAG knowledge about floods
- Collects contact information
- Stays hopeful and supportive

### Scenario 2: General Question
**Message**: "What's the weather like?"

**Expected Response:**
- Acknowledges question
- Uses RAG knowledge if available
- Asks about location if needed
- Provides helpful information

### Scenario 3: Panic/De-escalation
**Message**: "I'm panicking! Everything is falling apart!"

**Expected Response:**
- Calming, empathetic tone
- Grounding techniques
- Asks what's happening
- Provides reassurance
