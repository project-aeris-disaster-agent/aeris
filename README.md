# SONA.BIO

**Create Your AI Agent Twin - Your Alter Ego, Powered by ElizaOS**

SONA.BIO is a web application that allows users to create their "AI Agent Twin" or Alter Ego by connecting their Twitter profile. The application leverages the [ElizaOS](https://docs.elizaos.ai/) framework to create autonomous AI agents with unique personalities based on your social media presence.

## 🎯 Project Purpose

Transform your Twitter presence into an autonomous AI agent that:
- **Chats** with you as your alter ego
- **Learns** from your Twitter activity and style
- **Posts** content on your behalf
- **Schedules** social media content automatically

## 🚀 Features

### Core Functionality
- ✅ User authentication and registration (Supabase Auth)
- ✅ User profiles with Web3 wallet support
- ✅ Twitter/X account linking via OAuth
- ✅ Character card storage (ElizaOS format)
- ✅ Chat history storage for agent context
- ✅ Automatic character card generation (ElizaOS format) - *Coming Soon*
- ✅ Real-time chat interface with your alter ego - *Coming Soon*
- ✅ Content creation and auto-posting - *Coming Soon*
- ✅ Post scheduling and content calendar - *Coming Soon*

### Coming Soon
- 🔄 Multi-platform support (Discord, Telegram, LinkedIn)
- 🔄 Advanced personality customization
- 🔄 Analytics dashboard
- 🔄 Voice interaction

## 🏗️ Architecture

### Tech Stack
- **Frontend**: React 18+ with TypeScript, Vite
- **Backend**: Supabase (Auth, Database, Storage)
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth
- **AI Framework**: ElizaOS
- **Personality Analysis**: Grok API (xAI)
- **Social Integration**: Twitter API v2 (native, no scraping)

### Key Components
1. **Authentication System** - User registration and Twitter OAuth
2. **Character Generator** - Analyzes Twitter profile and creates ElizaOS character card
3. **Chat Interface** - Real-time messaging with AI agent
4. **Content Manager** - Post creation, scheduling, and publishing

## 📋 Project Structure

```
SONA/
├── src/
│   ├── components/        # React components (built step-by-step)
│   ├── pages/            # Page components
│   ├── services/         # API services
│   ├── utils/            # Utility functions
│   ├── types/            # TypeScript types
│   └── hooks/            # Custom React hooks
├── public/               # Static assets
├── docs/                 # Documentation
├── SPEC.md              # Detailed specification
└── README.md            # This file
```

## 🛠️ Development Approach

This project is built **step-by-step** without using pre-existing templates. We will:
1. Set up the project structure
2. Build components incrementally
3. Integrate ElizaOS framework
4. Add features one at a time

## 📚 Documentation

- [Project Specification](./SPEC.md) - Detailed feature and technical specifications
- [Integration Summary](./docs/INTEGRATION_SUMMARY.md) - Grok API + Twitter API v2 overview
- [Twitter API v2 Guide](./docs/TWITTER_API_V2.md) - Native tweet fetching implementation
- [Grok API Integration](./docs/GROK_API_INTEGRATION.md) - Personality analysis implementation
- [Character Card Structure](./docs/CHARACTER_CARD_STRUCTURE.md) - ElizaOS format reference
- [Development Plan](./docs/DEVELOPMENT_PLAN.md) - Step-by-step development guide
- [ElizaOS Documentation](https://docs.elizaos.ai/) - Framework reference
- [ElizaOS Character Examples](https://github.com/elizaOS/characters) - Character card format reference

## 🔐 Environment Variables

```env
# Twitter OAuth & API v2
TWITTER_CLIENT_ID=your_client_id
TWITTER_CLIENT_SECRET=your_client_secret
TWITTER_REDIRECT_URI=http://localhost:3000/auth/twitter/callback

# Grok API (xAI) for personality analysis
GROK_API_KEY=your_grok_api_key
GROK_API_URL=https://api.x.ai/v1

# Database
DATABASE_URL=your_database_url

# ElizaOS
ELIZA_API_KEY=your_eliza_api_key
ELIZA_MODEL_PROVIDER=groq|openai|anthropic

# JWT
JWT_SECRET=your_jwt_secret

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 🚦 Getting Started

### Prerequisites
- Node.js 18+ and npm/yarn
- Twitter Developer Account
- PostgreSQL or MongoDB database
- ElizaOS framework access

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd SONA

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Run development server
npm run dev
```

## 📝 Character Card Format

SONA.BIO generates character cards following the ElizaOS format. Example structure:

```json
{
  "name": "UserHandle",
  "bio": ["Personality description 1", "Personality description 2"],
  "lore": ["Background context"],
  "knowledge": ["Areas of expertise"],
  "messageExamples": [...],
  "postExamples": [...],
  "topics": ["Topic1", "Topic2"],
  "style": {
    "all": ["Trait1", "Trait2"],
    "chat": ["Chat style traits"],
    "post": ["Post style traits"]
  },
  "settings": {
    "voice": {...},
    "modelProvider": "groq"
  },
  "schedule": {
    "intervalMinutes": 60,
    "enabled": true
  }
}
```

## 🤝 Contributing

This is a step-by-step development project. Components and features are added incrementally without templates.

## 📄 License

[To be determined]

## 🔗 Resources

- [ElizaOS Documentation](https://docs.elizaos.ai/)
- [ElizaOS GitHub](https://github.com/elizaos/eliza)
- [ElizaOS Characters](https://github.com/elizaOS/characters)
- [Twitter API v2 Documentation](https://developer.twitter.com/en/docs/twitter-api)

---

**Built with ❤️ using ElizaOS**

