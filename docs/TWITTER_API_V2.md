# Twitter API v2 Native Integration

## Overview

SONA.BIO uses **Twitter API v2** to natively fetch user tweets without manual scraping. This ensures compliance with Twitter's Terms of Service and provides reliable, structured data access.

## Why Twitter API v2?

- **Official & Compliant**: Uses Twitter's official API, compliant with ToS
- **Structured Data**: Returns clean, structured JSON responses
- **Rate Limits**: Clear rate limit policies
- **OAuth 2.0**: Secure authentication flow
- **Rich Metadata**: Access to engagement metrics, timestamps, etc.

## Authentication Flow

### 1. OAuth 2.0 Setup

```typescript
// services/twitterOAuth.ts
interface TwitterOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[]; // ['tweet.read', 'users.read', 'offline.access']
}

class TwitterOAuthService {
  private config: TwitterOAuthConfig;

  constructor(config: TwitterOAuthConfig) {
    this.config = config;
  }

  // Step 1: Generate OAuth URL
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(' '),
      state: state, // CSRF protection
      code_challenge: this.generateCodeChallenge(),
      code_challenge_method: 'S256'
    });

    return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
  }

  // Step 2: Exchange code for tokens
  async exchangeCodeForTokens(code: string, codeVerifier: string): Promise<TwitterTokens> {
    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${this.getBasicAuth()}` // Base64(clientId:clientSecret)
      },
      body: new URLSearchParams({
        code: code,
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        redirect_uri: this.config.redirectUri,
        code_verifier: codeVerifier
      })
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type
    };
  }

  // Step 3: Refresh tokens
  async refreshAccessToken(refreshToken: string): Promise<TwitterTokens> {
    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${this.getBasicAuth()}`
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        client_id: this.config.clientId
      })
    });

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in
    };
  }
}
```

## Fetching User Tweets

### Twitter API v2 Endpoints

```typescript
// services/twitterApi.ts
interface TwitterApiConfig {
  accessToken: string;
  apiBaseUrl?: string; // Default: https://api.twitter.com/2
}

interface FetchTweetsOptions {
  maxResults?: number; // 5-100 (default: 10)
  excludeReplies?: boolean;
  includeRetweets?: boolean;
  startTime?: string; // ISO 8601 format
  endTime?: string; // ISO 8601 format
  tweetFields?: string[]; // ['created_at', 'author_id', 'public_metrics', etc.]
  expansions?: string[]; // ['author_id', 'referenced_tweets.author_id']
}

class TwitterApiService {
  private accessToken: string;
  private apiBaseUrl: string;

  constructor(config: TwitterApiConfig) {
    this.accessToken = config.accessToken;
    this.apiBaseUrl = config.apiBaseUrl || 'https://api.twitter.com/2';
  }

  // Get authenticated user's profile
  async getMe(): Promise<TwitterUser> {
    const response = await fetch(`${this.apiBaseUrl}/users/me`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    const data = await response.json();
    return data.data;
  }

  // Fetch user's tweets (authenticated user)
  async fetchMyTweets(options: FetchTweetsOptions = {}): Promise<Tweet[]> {
    const userId = (await this.getMe()).id;
    return this.fetchUserTweets(userId, options);
  }

  // Fetch tweets by user ID
  async fetchUserTweets(userId: string, options: FetchTweetsOptions = {}): Promise<Tweet[]> {
    const params = new URLSearchParams({
      max_results: String(options.maxResults || 100),
      'tweet.fields': (options.tweetFields || [
        'created_at',
        'author_id',
        'public_metrics',
        'text',
        'lang',
        'context_annotations'
      ]).join(','),
      expansions: (options.expansions || ['author_id']).join(',')
    });

    if (options.excludeReplies) {
      params.append('exclude', 'replies');
    }
    if (!options.includeRetweets) {
      params.append('exclude', 'retweets');
    }
    if (options.startTime) {
      params.append('start_time', options.startTime);
    }
    if (options.endTime) {
      params.append('end_time', options.endTime);
    }

    const allTweets: Tweet[] = [];
    let nextToken: string | undefined;

    do {
      if (nextToken) {
        params.set('pagination_token', nextToken);
      }

      const response = await fetch(
        `${this.apiBaseUrl}/users/${userId}/tweets?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limit - wait and retry
          await this.handleRateLimit(response);
          continue;
        }
        throw new Error(`Twitter API error: ${response.statusText}`);
      }

      const data = await response.json();
      allTweets.push(...(data.data || []));
      nextToken = data.meta?.next_token;

      // Respect rate limits - wait between requests
      await this.rateLimitDelay();
    } while (nextToken && allTweets.length < (options.maxResults || 500));

    return allTweets;
  }

  // Fetch tweets with pagination (for large datasets)
  async fetchAllUserTweets(
    userId: string,
    maxTweets: number = 500
  ): Promise<Tweet[]> {
    const tweets: Tweet[] = [];
    let nextToken: string | undefined;
    const maxResults = 100; // API max per request

    do {
      const batch = await this.fetchUserTweets(userId, {
        maxResults,
        excludeReplies: false,
        includeRetweets: false,
        tweetFields: ['created_at', 'author_id', 'public_metrics', 'text', 'lang']
      });

      tweets.push(...batch);
      
      if (tweets.length >= maxTweets) {
        break;
      }

      // Get next token from last request
      // (Implementation depends on how you track pagination)
      
    } while (tweets.length < maxTweets);

    return tweets.slice(0, maxTweets);
  }

  private async handleRateLimit(response: Response): Promise<void> {
    const resetTime = response.headers.get('x-rate-limit-reset');
    if (resetTime) {
      const waitTime = (parseInt(resetTime) * 1000) - Date.now();
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    } else {
      // Default wait time if header not available
      await new Promise(resolve => setTimeout(resolve, 900000)); // 15 minutes
    }
  }

  private async rateLimitDelay(): Promise<void> {
    // Small delay between requests to avoid hitting rate limits
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second
  }
}
```

## Rate Limits

Twitter API v2 has different rate limits based on your access level:

### Essential (Free) Tier
- **User Tweet Timeline**: 1,500 requests/15 minutes
- **User Lookup**: 300 requests/15 minutes

### Basic Tier ($100/month)
- **User Tweet Timeline**: 3,000 requests/15 minutes
- **User Lookup**: 300 requests/15 minutes

### Pro Tier ($5,000/month)
- **User Tweet Timeline**: 15,000 requests/15 minutes
- **User Lookup**: 300 requests/15 minutes

### Implementation Strategy

```typescript
// services/rateLimitManager.ts
class RateLimitManager {
  private requests: Map<string, number[]> = new Map();

  canMakeRequest(endpoint: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const requests = this.requests.get(endpoint) || [];
    
    // Remove old requests outside the window
    const recentRequests = requests.filter(time => now - time < windowMs);
    
    if (recentRequests.length >= limit) {
      return false;
    }
    
    recentRequests.push(now);
    this.requests.set(endpoint, recentRequests);
    return true;
  }

  getWaitTime(endpoint: string, limit: number, windowMs: number): number {
    const requests = this.requests.get(endpoint) || [];
    if (requests.length === 0) return 0;
    
    const oldestRequest = Math.min(...requests);
    const elapsed = Date.now() - oldestRequest;
    return Math.max(0, windowMs - elapsed);
  }
}
```

## Data Models

```typescript
// types/twitter.ts
interface Tweet {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
  public_metrics: {
    retweet_count: number;
    like_count: number;
    reply_count: number;
    quote_count: number;
  };
  lang?: string;
  context_annotations?: ContextAnnotation[];
}

interface TwitterUser {
  id: string;
  name: string;
  username: string;
  description?: string;
  profile_image_url?: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
  };
  created_at?: string;
}

interface TwitterTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}
```

## Error Handling

```typescript
// Handle common Twitter API errors
try {
  const tweets = await twitterApi.fetchUserTweets(userId);
} catch (error) {
  if (error.status === 401) {
    // Token expired - refresh and retry
    const newTokens = await oauthService.refreshAccessToken(refreshToken);
    // Retry with new token
  } else if (error.status === 429) {
    // Rate limit exceeded
    await rateLimitManager.waitForRateLimit();
    // Retry
  } else if (error.status === 403) {
    // Forbidden - user may have revoked access
    // Prompt user to reconnect
  } else {
    // Other error - log and handle
    console.error('Twitter API error:', error);
  }
}
```

## Environment Variables

```env
# Twitter OAuth 2.0
TWITTER_CLIENT_ID=your_client_id
TWITTER_CLIENT_SECRET=your_client_secret
TWITTER_REDIRECT_URI=http://localhost:3000/auth/twitter/callback

# Twitter API
TWITTER_API_V2_URL=https://api.twitter.com/2
```

## Complete Integration Example

```typescript
// Example: Full flow from OAuth to fetching tweets
async function connectTwitterAndFetchTweets() {
  // 1. Initiate OAuth flow
  const oauthService = new TwitterOAuthService({
    clientId: process.env.TWITTER_CLIENT_ID!,
    clientSecret: process.env.TWITTER_CLIENT_SECRET!,
    redirectUri: process.env.TWITTER_REDIRECT_URI!,
    scopes: ['tweet.read', 'users.read', 'offline.access']
  });

  // 2. User authorizes, get code from callback
  const code = 'authorization_code_from_callback';
  const codeVerifier = 'stored_code_verifier';
  
  // 3. Exchange code for tokens
  const tokens = await oauthService.exchangeCodeForTokens(code, codeVerifier);
  
  // 4. Store tokens securely
  await storeUserTokens(userId, tokens);
  
  // 5. Fetch tweets
  const twitterApi = new TwitterApiService({
    accessToken: tokens.accessToken
  });
  
  const tweets = await twitterApi.fetchAllUserTweets(userId, 200);
  
  // 6. Send to Grok for analysis
  const grokApi = new GrokApiService({
    apiKey: process.env.GROK_API_KEY!,
    baseUrl: 'https://api.x.ai/v1'
  });
  
  const analysis = await grokApi.analyzePersonality(tweets);
  
  return analysis;
}
```

## Best Practices

1. **Token Storage**: Encrypt tokens at rest, use secure environment variables
2. **Token Refresh**: Implement automatic token refresh before expiry
3. **Rate Limiting**: Always respect rate limits, implement queuing
4. **Error Handling**: Handle all error cases gracefully
5. **Data Privacy**: Only fetch necessary data, respect user privacy
6. **Caching**: Cache tweet data to reduce API calls
7. **Pagination**: Handle pagination properly for large datasets

## Next Steps

1. Set up Twitter Developer Account
2. Create Twitter App and get OAuth credentials
3. Implement OAuth flow
4. Test tweet fetching
5. Integrate with Grok API for analysis

