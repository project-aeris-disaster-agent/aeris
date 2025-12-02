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
    password?: string; // Temporary password for sign-in (only for new users)
  }; // Supabase user created by Edge Function
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
    const error = await response.json().catch(() => ({ message: 'Token exchange failed' }));
    throw new Error(error.message || 'Failed to exchange authorization code');
  }

  return await response.json();
}

/**
 * Fetch Twitter user profile
 */
export async function getTwitterUserProfile(accessToken: string): Promise<TwitterUser> {
  const response = await fetch('https://api.twitter.com/2/users/me?user.fields=description,profile_image_url,verified,public_metrics', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch user profile' }));
    throw new Error(error.message || 'Failed to fetch Twitter user profile');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Fetch user tweets
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

