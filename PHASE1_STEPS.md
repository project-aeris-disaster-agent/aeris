# Phase 1: Step-by-Step Setup Guide
# Follow these steps in order to complete Phase 1 setup

## Prerequisites Checklist
- [ ] Python 3.11+ installed
- [ ] Git installed
- [ ] Node.js installed (for Supabase CLI)
- [ ] Telegram account
- [ ] Supabase account (free tier works)
- [ ] Vercel account (free tier works)

---

## Step 1: Create Telegram Bot and Obtain Tokens

### 1.1 Create Bot via BotFather
1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` command
3. Follow prompts:
   - Choose a name for your bot (e.g., "Disaster Response Bot")
   - Choose a username (must end in 'bot', e.g., "disaster_response_bot")
4. **Save the bot token** - You'll need this for `TELEGRAM_BOT_TOKEN`

### 1.2 Get Telegram API Credentials
1. Go to [https://my.telegram.org](https://my.telegram.org)
2. Log in with your phone number
3. Go to "API development tools"
4. Create a new application:
   - App title: "Disaster Response Bot"
   - Short name: "disaster-bot"
   - Platform: Desktop
   - Description: (optional)
5. **Save the API ID and API Hash** - You'll need these for `TELEGRAM_API_ID` and `TELEGRAM_API_HASH`

### 1.3 Configure Environment Variables
1. Copy `env.example` to `.env`:
   ```bash
   cp env.example .env
   ```

2. Edit `.env` and fill in:
   ```bash
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   TELEGRAM_API_ID=your_api_id_here
   TELEGRAM_API_HASH=your_api_hash_here
   ```

---

## Step 2: Set Up Supabase Project

### 2.1 Create Supabase Project
1. Go to [https://supabase.com](https://supabase.com)
2. Sign up/Log in
3. Click "New Project"
4. Fill in:
   - Project name: "disaster-response-bot"
   - Database password: (choose a strong password - **SAVE THIS**)
   - Region: Choose closest to you
5. Wait for project to be created (2-3 minutes)

### 2.2 Get Supabase Credentials
1. In your Supabase project dashboard:
   - Go to Settings → API
   - **Copy the Project URL** → `SUPABASE_URL`
   - **Copy the service_role key** (secret) → `SUPABASE_SERVICE_ROLE_KEY`
   - **Copy the anon key** → `SUPABASE_ANON_KEY`

2. Update `.env`:
   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   SUPABASE_ANON_KEY=your_anon_key
   ```

### 2.3 Install Supabase CLI
```bash
npm install -g supabase
```

### 2.4 Initialize Supabase Locally
```bash
# Initialize Supabase in project
supabase init

# Link to your remote project
supabase link --project-ref your-project-ref
# (Find project-ref in Supabase dashboard URL: https://app.supabase.com/project/[project-ref])
```

### 2.5 Run Database Migrations
```bash
# Apply migrations to create tables
supabase db push

# Or apply manually via Supabase dashboard:
# 1. Go to SQL Editor
# 2. Copy contents of supabase/migrations/20240101000000_create_family_finder_tables.sql
# 3. Run the SQL
# 4. Copy contents of supabase/migrations/20240101000001_create_rls_policies.sql
# 5. Run the SQL
```

---

## Step 3: Install Python Dependencies

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

---

## Step 4: Test Bot Locally

### 4.1 Test Basic Functionality
```bash
# Make sure .env is configured
python main.py
```

You should see:
```
INFO - Initializing Disaster Response Bot...
INFO - Telethon client initialized
INFO - Bot started successfully
INFO - Bot running as @your_bot_username
Bot is running. Press Ctrl+C to stop.
```

### 4.2 Test Bot Commands
1. Open Telegram and find your bot
2. Send `/start` - Should receive welcome message
3. Send `/help` - Should see available commands
4. Send a regular message - Should receive acknowledgment

### 4.3 Verify Session Management
- Send multiple messages - Bot should maintain context
- Send `/reset` - Session should reset

---

## Step 5: Deploy to Vercel

### 5.1 Install Vercel CLI
```bash
npm install -g vercel
```

### 5.2 Deploy Project
```bash
# Login to Vercel
vercel login

# Deploy (from project root)
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? (your account)
# - Link to existing project? No
# - Project name? disaster-response-bot
# - Directory? ./
# - Override settings? No
```

### 5.3 Set Environment Variables in Vercel
1. Go to Vercel dashboard → Your project → Settings → Environment Variables
2. Add all variables from `.env`:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_API_ID`
   - `TELEGRAM_API_HASH`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`
   - `ENVIRONMENT=production`

### 5.4 Redeploy with Environment Variables
```bash
vercel --prod
```

---

## Step 6: Configure Telegram Webhook

After deployment, configure Telegram to send updates to your Vercel endpoint:

```bash
# Replace YOUR_BOT_TOKEN and YOUR_VERCEL_URL
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<YOUR_VERCEL_URL>/api/telegram/webhook"
```

Or use this Python script:
```python
import requests
import os
from dotenv import load_dotenv

load_dotenv()

bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
vercel_url = "https://your-app.vercel.app"  # Replace with your Vercel URL

response = requests.post(
    f"https://api.telegram.org/bot{bot_token}/setWebhook",
    json={"url": f"{vercel_url}/api/telegram/webhook"}
)

print(response.json())
```

### 6.1 Verify Webhook
```bash
# Check webhook status
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

---

## Step 7: Test Deployed Bot

1. Send a message to your bot on Telegram
2. Check Vercel logs:
   ```bash
   vercel logs
   ```
3. Verify webhook receives updates:
   - Go to Vercel dashboard → Your project → Functions
   - Check `/api/telegram/webhook` logs

---

## Step 8: Verify Phase 1 Completion

### Checklist:
- [ ] Bot responds to `/start` command
- [ ] Bot responds to `/help` command
- [ ] Bot responds to regular messages
- [ ] Session management works (context maintained)
- [ ] Webhook receives updates
- [ ] Supabase connection works (test with database query)
- [ ] Error handling works (try invalid command)
- [ ] Logging works (check logs)

### Test Supabase Connection
Create a test script `test_supabase.py`:
```python
from family_finder.database import get_supabase

supabase = get_supabase()
if supabase.test_connection():
    print("✅ Supabase connection successful!")
else:
    print("❌ Supabase connection failed!")
```

Run: `python test_supabase.py`

---

## Troubleshooting

### Bot Not Responding Locally
- Check `.env` file exists and has correct values
- Verify bot token is correct
- Check internet connection
- Review logs for errors

### Webhook Not Working
- Verify webhook URL is correct
- Check Vercel deployment is successful
- Verify environment variables are set in Vercel
- Check Vercel function logs

### Supabase Connection Issues
- Verify credentials in `.env`
- Check Supabase project is active
- Verify migrations ran successfully
- Test connection via Supabase dashboard SQL editor

---

## Next Steps: Phase 2

Once Phase 1 is complete:
- [ ] LLM Integration (OpenRouter API)
- [ ] Enhanced message processing
- [ ] Context-aware responses

See SPEC.md Section 8 for Phase 2 details.

