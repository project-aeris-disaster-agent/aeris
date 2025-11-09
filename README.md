# Disaster Response Telegram Bot

An intelligent Telegram-based chatbot that provides critical support during disaster situations. This bot offers real-time information, emotional support, and practical guidance to individuals and communities affected by emergencies.

## 📋 Project Overview

See [SPEC.md](./SPEC.md) for complete project specification and architecture details.

### Key Features

- **Emergency Announcements**: Broadcast critical information to all users
- **Latest News & Updates**: Real-time disaster-related news aggregation
- **Accurate Data Provision**: Verified information from trusted sources
- **Emergency Assistance**: Guidance to appropriate emergency services
- **De-escalation**: Help users manage panic and anxiety
- **Emotional Support**: Trauma-informed counseling and support
- **Financial Assistance Navigation**: Help with assistance applications
- **Family Finder**: AI-assisted service to locate missing family members

## 🏗️ Architecture

- **Telegram Bot**: Telethon client for message handling
- **LLM Integration**: OpenRouter (testing) and GROK (production) APIs
- **Database**: Supabase PostgreSQL for persistent data
- **Admin Interface**: Streamlit app for content management
- **Deployment**: Vercel serverless functions

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- Telegram API ID and API Hash (from [my.telegram.org](https://my.telegram.org))
- Supabase project (create at [supabase.com](https://supabase.com))
- Vercel account (for deployment)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd disaster-response-bot
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

5. **Configure Supabase**
   ```bash
   # Install Supabase CLI (if not already installed)
   npm install -g supabase
   
   # Initialize Supabase (if needed)
   supabase init
   
   # Link to your project
   supabase link --project-ref your-project-ref
   ```

### Local Development

For local development, you'll need to run the Telethon client directly:

```bash
python -m bot.telethon_client
```

**Note**: For production deployment on Vercel, the bot will use webhooks. Local development with Telethon requires a long-running process.

### Deployment to Vercel

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   vercel
   ```

3. **Set environment variables in Vercel dashboard**
   - Go to your project settings
   - Add all variables from `.env.example`

4. **Configure Telegram webhook** (after deployment)
   ```bash
   curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-app.vercel.app/api/telegram/webhook"
   ```

## 📁 Project Structure

```
disaster-response-bot/
├── api/                    # Vercel serverless functions
│   ├── telegram/          # Telegram webhook handler
│   ├── llm/               # LLM integration endpoints
│   └── admin/             # Admin API endpoints
├── bot/                   # Telegram bot implementation
│   ├── telethon_client.py
│   ├── session_manager.py
│   └── message_handler.py
├── llm/                   # LLM integration (Phase 2)
├── data/                  # Data sources integration (Phase 3)
├── family_finder/         # Family Finder system (Phase 3)
├── admin/                 # Streamlit admin interface (Phase 4)
├── utils/                 # Utility functions
├── supabase/             # Database migrations
├── vercel.json           # Vercel configuration
├── requirements.txt      # Python dependencies
└── SPEC.md              # Complete specification
```

## 🔄 Implementation Phases

### Phase 1: Core Bot Setup ✅ (Current)
- [x] Set up Telegram bot with Telethon
- [x] Basic message receiving and sending
- [x] Webhook configuration
- [x] Vercel deployment setup
- [x] Supabase project initialization
- [x] Basic error handling
- [x] Logging infrastructure

### Phase 2: LLM Integration (Next)
- [ ] Integrate OpenRouter API
- [ ] Implement session management
- [ ] Basic context handling
- [ ] Response formatting

### Phase 3: Feature Implementation
- [ ] Emergency assistance routing
- [ ] De-escalation capabilities
- [ ] Emotional support features
- [ ] News and updates functionality
- [ ] Financial assistance navigation
- [ ] Family Finder system

### Phase 4: Admin Interface
- [ ] Streamlit admin app
- [ ] Announcement creation and management
- [ ] Broadcast scheduler
- [ ] User analytics

### Phase 5: Testing & Deployment
- [ ] Comprehensive testing
- [ ] Performance optimization
- [ ] Security audit
- [ ] Production deployment
- [ ] GROK API migration

## 🔐 Security & Privacy

- Environment variables stored securely in Vercel
- Session data expires after 24 hours
- Sensitive conversations not retained
- Family Finder data encrypted at rest
- GDPR/CCPA compliance considerations

See [SPEC.md](./SPEC.md) Section 6 for detailed security and privacy information.

## 📚 Documentation

- **Complete Specification**: [SPEC.md](./SPEC.md)
- **Telethon Docs**: https://docs.telethon.dev/
- **Supabase Docs**: https://supabase.com/docs
- **Vercel Docs**: https://vercel.com/docs

## 🤝 Contributing

This project follows the specification in SPEC.md. All decisions should reference the spec for consistency.

## 📝 License

[Add your license here]

## 🆘 Support

For issues or questions, please refer to the specification document or create an issue in the repository.

