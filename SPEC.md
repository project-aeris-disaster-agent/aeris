# SONA.BIO - Project Specification

## Project Overview

**SONA.BIO** is a web application that enables users to create their "AI Agent Twin" or Alter Ego by connecting their Twitter profile. The application leverages the ElizaOS framework to create autonomous AI agents with unique personalities based on user's social media presence.

## Core Features

### 1. Authentication & Twitter Integration
- **Login/Registration System**
  - Email/password authentication for first-time users
  - OAuth integration with Twitter/X for account linking
  - Session management and user profile creation

- **Twitter Account Linking**
  - Secure OAuth 2.0 flow for Twitter authentication
  - Fetch user's Twitter profile data (bio, tweets, engagement patterns)
  - Store Twitter credentials securely for API access

### 2. Character Creation (ElizaOS Format)
- **Character Card Generation**
  - Fetch user tweets natively via Twitter API v2 (no scraping)
  - Analyze tweets using Grok API (xAI) for personality extraction
  - Generate `charactercard.json` following ElizaOS format:
    - `name`: User's handle or chosen name
    - `bio`: Array of personality descriptions (from Grok analysis)
    - `lore`: Background and context (from Grok analysis)
    - `knowledge`: Areas of expertise based on user's content (from Grok analysis)
    - `messageExamples`: Conversation examples (generated from tweet patterns)
    - `postExamples`: Sample post styles (from actual tweets)
    - `topics`: Key topics of interest (extracted by Grok)
    - `style`: Communication style (chat/post) (analyzed by Grok)
    - `adjectives`: Personality descriptors (from Grok analysis)
    - `settings`: Voice and model configurations
    - `schedule`: Posting schedule preferences (calculated from posting frequency)
    - `commenting`: Comment behavior settings

- **Personality Analysis with Grok API**
  - Fetch last 200-500 tweets via Twitter API v2
  - Send tweet data to Grok API for comprehensive analysis:
    - Writing style and tone extraction
    - Personality trait identification
    - Topic and interest detection
    - Communication pattern analysis
    - Engagement style assessment
  - Grok API returns structured personality profile
  - Map Grok analysis results to ElizaOS character card format
  - Generate message and post examples based on analyzed patterns

### 3. Chat Interface
- **Real-time Chat**
  - WebSocket or SSE connection for real-time messaging
  - Chat history persistence
  - Message threading and context management
  - Integration with ElizaOS agent runtime

- **Agent Interaction**
  - Users chat with their AI alter ego
  - Agent maintains personality consistency
  - Context-aware responses based on user's Twitter presence
  - Memory and state management via ElizaOS

### 4. Content Management & Scheduling
- **Auto-Posting**
  - Request agent to create and post content
  - Natural language commands: "Post about AI trends"
  - Content approval workflow (optional)

- **Post Scheduling**
  - Schedule posts for specific times
  - Recurring post patterns
  - Content calendar view
  - Post preview before publishing

- **Multi-Platform Support (Future)**
  - Twitter (primary)
  - Discord, Telegram, LinkedIn (planned)

## Technical Architecture

### Frontend (React)
- **Framework**: React 18+ with TypeScript
- **State Management**: React Context API or Zustand
- **Routing**: React Router v6
- **UI Components**: Custom components (no template libraries)
- **Styling**: CSS Modules or Tailwind CSS
- **Real-time**: WebSocket client or Server-Sent Events

### Backend Requirements
- **API Server**: Node.js/Express or Next.js API routes
- **Database**: PostgreSQL or MongoDB for user data and chat history
- **ElizaOS Integration**: 
  - Character card storage
  - Agent runtime management
  - Plugin system integration
- **Twitter API**: 
  - OAuth 2.0 authentication
  - Twitter API v2 for native tweet fetching (no scraping)
  - Twitter API v2 for profile and posting
- **Grok API (xAI)**: 
  - Personality analysis from tweet data
  - Character trait extraction
  - Writing style analysis
- **Authentication**: JWT tokens or session-based

### Data Models

#### User
```typescript
{
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### TwitterConnection
```typescript
{
  userId: string;
  twitterUserId: string;
  twitterUsername: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  profileData: TwitterProfile;
}
```

#### CharacterCard
```typescript
{
  userId: string;
  characterCard: ElizaOSCharacterCard;
  createdAt: Date;
  updatedAt: Date;
}
```

#### ChatMessage
```typescript
{
  id: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sessionId: string;
}
```

#### ScheduledPost
```typescript
{
  id: string;
  userId: string;
  content: string;
  scheduledAt: Date;
  platform: 'twitter' | 'discord' | 'telegram';
  status: 'pending' | 'posted' | 'failed';
  agentGenerated: boolean;
}
```

## User Flow

### First-Time User
1. Visit SONA.BIO homepage
2. Click "Get Started" or "Create Your Alter Ego"
3. Register with email/password
4. Connect Twitter account via OAuth
5. System analyzes Twitter profile
6. Character card is generated automatically
7. User reviews and can customize character card
8. Redirected to chat interface
9. First conversation with alter ego

### Returning User
1. Login with credentials
2. View dashboard with alter ego status
3. Access chat interface
4. Manage scheduled posts
5. Update character card if needed

## ElizaOS Integration Points

1. **Character Card Format**: Follow ElizaOS character card JSON structure
2. **Agent Runtime**: Use ElizaOS agent runtime for chat interactions
3. **Plugin System**: Leverage ElizaOS plugins for:
   - Twitter posting
   - Content generation
   - Memory management
4. **Model Providers**: Support multiple LLM providers through ElizaOS

## Security Considerations

- Secure OAuth token storage (encrypted)
- API rate limiting
- User data privacy compliance
- Content moderation for generated posts
- Secure WebSocket connections
- Input sanitization for user-generated content

## Future Enhancements

- Multi-platform social media support
- Advanced personality customization
- Analytics dashboard for alter ego performance
- Collaborative features (multiple users, shared agents)
- Voice interaction capabilities
- Mobile app (React Native)

## Development Phases

### Phase 1: Foundation
- Project setup and structure
- Authentication system
- Twitter OAuth integration
- Basic UI components

### Phase 2: Character Creation
- Twitter API v2 integration for native tweet fetching
- Grok API integration for personality analysis
- Character card generation from Grok analysis
- Character card editor UI
- Storage and retrieval

### Phase 3: Chat Interface
- Chat UI components
- ElizaOS integration
- Real-time messaging
- Chat history

### Phase 4: Content Management
- Post creation interface
- Scheduling system
- Twitter API integration for posting
- Content calendar

### Phase 5: Polish & Optimization
- UI/UX improvements
- Performance optimization
- Error handling
- Testing and bug fixes

## Success Metrics

- User registration and Twitter connection rate
- Character card generation accuracy
- Chat engagement (messages per session)
- Scheduled post success rate
- User retention and return rate

