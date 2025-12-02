# Grok API Integration for Personality Analysis

## Overview

SONA.BIO uses **Grok API (xAI)** to analyze user tweets and generate personality profiles for character card creation. This document outlines the technical implementation approach.

## Why Grok API?

- **Advanced NLP Capabilities**: Grok excels at understanding context, personality traits, and writing style
- **Twitter-Native**: Grok is built by xAI (X/Twitter), making it particularly well-suited for analyzing Twitter content
- **Personality Analysis**: Can extract nuanced personality traits from text patterns
- **Efficient Processing**: Handles large volumes of tweets efficiently

## Architecture Flow

```
User Connects Twitter
    ↓
Fetch Tweets via Twitter API v2 (native)
    ↓
Prepare Tweet Data (last 200-500 tweets)
    ↓
Send to Grok API for Analysis
    ↓
Grok Returns Personality Insights
    ↓
Generate ElizaOS Character Card
    ↓
Store & Display to User
```

## Grok API Integration

### 1. API Setup

```typescript
// services/grokApi.ts
interface GrokApiConfig {
  apiKey: string;
  baseUrl: string; // https://api.x.ai/v1
}

class GrokApiService {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: GrokApiConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
  }

  async analyzePersonality(tweets: Tweet[]): Promise<PersonalityAnalysis> {
    // Prepare tweet data for analysis
    const tweetTexts = tweets.map(t => t.text).join('\n\n');
    
    // Create analysis prompt
    const prompt = this.buildPersonalityAnalysisPrompt(tweetTexts);
    
    // Call Grok API
    const response = await this.callGrokAPI(prompt);
    
    return this.parsePersonalityResponse(response);
  }

  private buildPersonalityAnalysisPrompt(tweetTexts: string): string {
    return `Analyze the following Twitter posts and extract personality traits, writing style, interests, and communication patterns.

Tweets:
${tweetTexts}

Please provide a detailed analysis in JSON format with the following structure:
{
  "personalityTraits": ["trait1", "trait2", ...],
  "writingStyle": {
    "formality": "casual|formal|mixed",
    "tone": "humorous|serious|enthusiastic|...",
    "length": "short|medium|long",
    "emojiUsage": "frequent|occasional|rare",
    "punctuation": "casual|formal"
  },
  "topics": ["topic1", "topic2", ...],
  "interests": ["interest1", "interest2", ...],
  "communicationStyle": {
    "directness": "direct|indirect",
    "engagement": "high|medium|low",
    "controversy": "high|medium|low"
  },
  "bio": ["sentence1", "sentence2", ...],
  "lore": ["background1", "background2", ...],
  "knowledge": ["expertise1", "expertise2", ...],
  "adjectives": ["adjective1", "adjective2", ...]
}`;
  }

  private async callGrokAPI(prompt: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-beta', // or latest Grok model
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing social media content to extract personality traits and communication patterns. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3, // Lower temperature for more consistent analysis
        response_format: { type: 'json_object' } // Ensure JSON response
      })
    });

    if (!response.ok) {
      throw new Error(`Grok API error: ${response.statusText}`);
    }

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  }

  private parsePersonalityResponse(response: any): PersonalityAnalysis {
    return {
      personalityTraits: response.personalityTraits || [],
      writingStyle: response.writingStyle || {},
      topics: response.topics || [],
      interests: response.interests || [],
      communicationStyle: response.communicationStyle || {},
      bio: response.bio || [],
      lore: response.lore || [],
      knowledge: response.knowledge || [],
      adjectives: response.adjectives || []
    };
  }
}
```

### 2. Character Card Generation

```typescript
// services/characterCardGenerator.ts
import { GrokApiService } from './grokApi';
import { TwitterApiService } from './twitterApi';

class CharacterCardGenerator {
  private grokApi: GrokApiService;
  private twitterApi: TwitterApiService;

  constructor(grokApi: GrokApiService, twitterApi: TwitterApiService) {
    this.grokApi = grokApi;
    this.twitterApi = twitterApi;
  }

  async generateCharacterCard(userId: string, twitterAccessToken: string): Promise<ElizaOSCharacterCard> {
    // 1. Fetch user tweets via Twitter API v2
    const tweets = await this.twitterApi.fetchUserTweets(twitterAccessToken, {
      maxResults: 200, // Last 200 tweets
      excludeReplies: false,
      includeRetweets: false
    });

    // 2. Analyze personality with Grok
    const analysis = await this.grokApi.analyzePersonality(tweets);

    // 3. Generate character card
    const characterCard = this.buildCharacterCard(analysis, tweets);

    return characterCard;
  }

  private buildCharacterCard(analysis: PersonalityAnalysis, tweets: Tweet[]): ElizaOSCharacterCard {
    return {
      name: `user_alterego`, // Will be set from Twitter username
      clients: ['twitter'],
      modelProvider: 'groq', // Can be configured
      settings: {
        voice: {
          model: 'en_US-GuyNeural'
        }
      },
      plugins: [],
      bio: analysis.bio,
      lore: analysis.lore,
      knowledge: analysis.knowledge,
      messageExamples: this.generateMessageExamples(tweets, analysis),
      postExamples: this.generatePostExamples(tweets),
      topics: analysis.topics,
      style: {
        all: analysis.personalityTraits,
        chat: this.extractChatStyle(analysis),
        post: this.extractPostStyle(analysis)
      },
      adjectives: analysis.adjectives,
      schedule: {
        intervalMinutes: this.calculatePostingFrequency(tweets),
        enabled: true
      },
      commenting: {
        enabled: true
      }
    };
  }

  private generateMessageExamples(tweets: Tweet[], analysis: PersonalityAnalysis): any[] {
    // Select representative tweets and create conversation examples
    const sampleTweets = tweets.slice(0, 5);
    return sampleTweets.map(tweet => [
      {
        user: '{{user1}}',
        content: { text: 'What do you think about this topic?' }
      },
      {
        user: 'user_alterego',
        content: { text: tweet.text.substring(0, 200) } // Truncate if needed
      }
    ]);
  }

  private generatePostExamples(tweets: Tweet[]): string[] {
    // Select diverse, representative tweets
    return tweets
      .slice(0, 7)
      .map(t => t.text)
      .filter(text => text.length > 20 && text.length < 280);
  }

  private extractChatStyle(analysis: PersonalityAnalysis): string[] {
    const chatTraits = [];
    if (analysis.communicationStyle.directness === 'direct') {
      chatTraits.push('Direct');
    }
    if (analysis.writingStyle.tone.includes('humorous')) {
      chatTraits.push('Humorous');
    }
    // Add more style extraction logic
    return chatTraits;
  }

  private extractPostStyle(analysis: PersonalityAnalysis): string[] {
    const postTraits = [];
    if (analysis.writingStyle.length === 'short') {
      postTraits.push('Concise');
    }
    if (analysis.communicationStyle.engagement === 'high') {
      postTraits.push('Engaging');
    }
    return postTraits;
  }

  private calculatePostingFrequency(tweets: Tweet[]): number {
    if (tweets.length < 2) return 240; // Default 4 hours

    const timeDiff = new Date(tweets[0].created_at).getTime() - 
                     new Date(tweets[tweets.length - 1].created_at).getTime();
    const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
    const avgPostsPerDay = tweets.length / daysDiff;
    const intervalMinutes = (24 * 60) / avgPostsPerDay;
    
    // Clamp between 30 minutes and 24 hours
    return Math.max(30, Math.min(1440, Math.round(intervalMinutes)));
  }
}
```

## Environment Variables

```env
# Grok API Configuration
GROK_API_KEY=your_grok_api_key
GROK_API_URL=https://api.x.ai/v1

# Twitter API Configuration (for fetching tweets)
TWITTER_CLIENT_ID=your_twitter_client_id
TWITTER_CLIENT_SECRET=your_twitter_client_secret
TWITTER_API_V2_URL=https://api.twitter.com/2
```

## Error Handling

```typescript
// Handle Grok API errors gracefully
try {
  const analysis = await grokApi.analyzePersonality(tweets);
} catch (error) {
  if (error.status === 429) {
    // Rate limit - implement exponential backoff
    await this.handleRateLimit();
  } else if (error.status === 401) {
    // Invalid API key
    throw new Error('Invalid Grok API key');
  } else {
    // Fallback to basic analysis
    return this.fallbackAnalysis(tweets);
  }
}
```

## Rate Limiting

- Grok API has rate limits (check current limits)
- Implement request queuing for batch processing
- Cache analysis results to avoid re-analysis
- Use exponential backoff for retries

## Cost Optimization

1. **Batch Processing**: Analyze multiple tweets in single API call
2. **Caching**: Store analysis results, only re-analyze when tweets change significantly
3. **Incremental Updates**: Only analyze new tweets, merge with existing analysis
4. **Smart Sampling**: Analyze representative sample of tweets instead of all tweets

## Testing

```typescript
// Mock Grok API responses for testing
const mockGrokResponse = {
  personalityTraits: ['enthusiastic', 'knowledgeable', 'engaging'],
  writingStyle: {
    formality: 'casual',
    tone: 'enthusiastic',
    length: 'medium'
  },
  topics: ['AI', 'Web Development', 'Open Source'],
  // ... etc
};
```

## Next Steps

1. Get Grok API access from xAI
2. Set up API key management
3. Implement Twitter API v2 integration (see `TWITTER_API_V2.md`)
4. Build character card generator service
5. Create UI for character card preview and editing

