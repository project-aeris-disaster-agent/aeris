// Twitter API v2 Service
// Handles Twitter API calls after OAuth authentication

export interface TwitterTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
  user?: TwitterUser; // User profile included from Edge Function
  supabase_user?: {
    id: string;
    email: string;
    password?: string; // Temporary password for sign-in (for both new and existing users)
    is_existing?: boolean; // Whether this is an existing user
  }; // Supabase user created/found by Edge Function
}

export interface TwitterUser {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
  description?: string;
  verified?: boolean;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
  };
}

export interface TwitterTweet {
  id: string;
  text: string;
  created_at: string;
  public_metrics?: {
    retweet_count: number;
    like_count: number;
    reply_count: number;
  };
}

/**
 * Exchange authorization code for access/refresh tokens
 * NOTE: This requires client_secret, so should be called via Supabase Edge Function
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<TwitterTokens> {
  // This should be called via Supabase Edge Function
  // The Edge Function will have access to client_secret
  const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twitter-oauth-callback`;
  
  const response = await fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Token exchange failed', message: 'Token exchange failed' }));
    const errorMessage = error.error || error.message || 'Failed to exchange authorization code';
    
    // Handle error details properly (stringify if it's an object)
    let errorDetails = '';
    if (error.details) {
      if (typeof error.details === 'string') {
        errorDetails = ` ${error.details}`;
      } else {
        errorDetails = ` ${JSON.stringify(error.details)}`;
      }
    }
    
    // Special message for rate limit errors
    if (response.status === 429 || error.status === 429) {
      const retryAfter = error.retryAfter ? ` Please try again in ${error.retryAfter} seconds.` : ' Please wait a few minutes and try again.';
      throw new Error(`Twitter API rate limit exceeded.${retryAfter}`);
    }
    
    throw new Error(`${errorMessage}${errorDetails}`);
  }

  const result = await response.json();
  
  // Check if the response contains an error field (even if status is 200)
  if (result.error) {
    throw new Error(result.error);
  }
  
  return result;
}

/**
 * Fetch user tweets
 * NOTE: This function directly calls Twitter API and will cause CORS issues if called from frontend.
 * Should be moved to an Edge Function when implementing tweet fetching functionality.
 */
export async function getUserTweets(
  accessToken: string,
  userId: string,
  options?: {
    maxResults?: number;
    sinceId?: string;
    untilId?: string;
  }
): Promise<TwitterTweet[]> {
  const maxResults = options?.maxResults || 100;
  const params = new URLSearchParams({
    max_results: maxResults.toString(),
    'tweet.fields': 'created_at,public_metrics',
  });

  if (options?.sinceId) {
    params.append('since_id', options.sinceId);
  }
  if (options?.untilId) {
    params.append('until_id', options.untilId);
  }

  const response = await fetch(
    `https://api.twitter.com/2/users/${userId}/tweets?${params.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch tweets' }));
    throw new Error(error.message || 'Failed to fetch tweets');
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string
): Promise<TwitterTokens> {
  // This should also be called via Edge Function
  const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twitter-refresh-token`;
  
  const response = await fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      refresh_token: refreshToken,
      client_id: clientId,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Token refresh failed' }));
    throw new Error(error.message || 'Failed to refresh access token');
  }

  return await response.json();
}

