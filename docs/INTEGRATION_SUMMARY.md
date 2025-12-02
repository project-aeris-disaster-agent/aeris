# Integration Summary: Grok API + Twitter API v2

## Quick Reference

This document provides a high-level overview of how SONA.BIO integrates Grok API and Twitter API v2 for character card generation.

## Architecture Overview

```
┌─────────────┐
│   User      │
│  Connects   │
│   Twitter   │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│  Twitter OAuth 2.0  │
│  (Get Access Token) │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Twitter API v2     │
│  Fetch User Tweets  │
│  (Last 200-500)     │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Prepare Tweet Data │
│  (Format for Grok) │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│    Grok API         │
│  Analyze Personality│
│  Extract Traits     │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Character Card     │
│  Generator          │
│  (ElizaOS Format)   │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Store & Display   │
│  Character Card     │
└─────────────────────┘
```

## Key Components

### 1. Twitter API v2 Integration
**Purpose**: Fetch user tweets natively (no scraping)

**What it does**:
- Authenticates user via OAuth 2.0
- Fetches user's tweet timeline (last 200-500 tweets)
- Retrieves tweet metadata (timestamps, engagement, etc.)
- Handles rate limiting and pagination

**Key Files**:
- `services/twitterApi.ts` - Twitter API client
- `services/twitterOAuth.ts` - OAuth flow handler

**See**: `docs/TWITTER_API_V2.md` for detailed implementation

### 2. Grok API Integration
**Purpose**: Analyze tweets to extract personality traits

**What it does**:
- Receives formatted tweet data
- Performs deep personality analysis
- Extracts writing style, topics, interests
- Returns structured personality profile

**Key Files**:
- `services/grokApi.ts` - Grok API client
- `services/characterCardGenerator.ts` - Character card builder

**See**: `docs/GROK_API_INTEGRATION.md` for detailed implementation

### 3. Character Card Generator
**Purpose**: Convert Grok analysis into ElizaOS format

**What it does**:
- Maps Grok analysis to ElizaOS character card structure
- Generates message examples from tweet patterns
- Creates post examples from actual tweets
- Calculates posting schedule from frequency data

## Data Flow Example

```typescript
// 1. User connects Twitter
const tokens = await twitterOAuth.exchangeCodeForTokens(code);

// 2. Fetch tweets via Twitter API v2
const twitterApi = new TwitterApiService({ accessToken: tokens.accessToken });
const tweets = await twitterApi.fetchAllUserTweets(userId, 200);
// Returns: Array of Tweet objects with text, timestamps, metrics

// 3. Analyze with Grok API
const grokApi = new GrokApiService({ apiKey: GROK_API_KEY });
const analysis = await grokApi.analyzePersonality(tweets);
// Returns: {
//   personalityTraits: ['enthusiastic', 'knowledgeable'],
//   writingStyle: { formality: 'casual', tone: 'enthusiastic' },
//   topics: ['AI', 'Web Development'],
//   bio: ['...', '...'],
//   ...
// }

// 4. Generate character card
const generator = new CharacterCardGenerator(grokApi, twitterApi);
const characterCard = await generator.generateCharacterCard(userId, tokens.accessToken);
// Returns: ElizaOS-formatted character card JSON

// 5. Store and use
await storeCharacterCard(userId, characterCard);
```

## Why This Approach?

### ✅ Native Twitter API (No Scraping)
- **Compliant**: Follows Twitter's Terms of Service
- **Reliable**: Official API with guaranteed uptime
- **Structured**: Clean JSON responses, no parsing needed
- **Rate Limited**: Clear limits, predictable behavior

### ✅ Grok API for Analysis
- **Twitter-Native**: Built by xAI (X/Twitter), optimized for Twitter content
- **Advanced NLP**: Deep understanding of personality and style
- **Efficient**: Single API call for comprehensive analysis
- **Accurate**: Better personality extraction than basic NLP

## Environment Setup

```env
# Twitter API v2
TWITTER_CLIENT_ID=your_client_id
TWITTER_CLIENT_SECRET=your_client_secret
TWITTER_REDIRECT_URI=http://localhost:3000/auth/twitter/callback

# Grok API (xAI)
GROK_API_KEY=your_grok_api_key
GROK_API_URL=https://api.x.ai/v1
```

## API Costs & Limits

### Twitter API v2
- **Essential (Free)**: 1,500 requests/15 min for timeline
- **Basic ($100/mo)**: 3,000 requests/15 min
- **Pro ($5k/mo)**: 15,000 requests/15 min

### Grok API
- Check current pricing at [x.ai](https://x.ai)
- Typically charged per token/request
- Implement caching to reduce costs

## Error Handling Strategy

1. **Twitter API Errors**:
   - 401: Refresh token, retry
   - 429: Wait for rate limit reset
   - 403: User revoked access, prompt reconnect

2. **Grok API Errors**:
   - 429: Implement exponential backoff
   - 401: Check API key
   - Fallback: Use basic analysis if Grok fails

## Optimization Tips

1. **Caching**: Cache character cards, only regenerate when tweets change significantly
2. **Batch Processing**: Analyze multiple users' tweets in batches
3. **Smart Sampling**: Analyze representative sample instead of all tweets
4. **Incremental Updates**: Only analyze new tweets, merge with existing analysis

## Next Steps

1. ✅ Set up Twitter Developer Account
2. ✅ Get Grok API access
3. ✅ Implement OAuth flow
4. ✅ Build Twitter API client
5. ✅ Build Grok API client
6. ✅ Create character card generator
7. ✅ Test end-to-end flow

## Related Documentation

- `docs/TWITTER_API_V2.md` - Detailed Twitter API implementation
- `docs/GROK_API_INTEGRATION.md` - Detailed Grok API implementation
- `docs/CHARACTER_CARD_STRUCTURE.md` - ElizaOS character card format
- `SPEC.md` - Full project specification

