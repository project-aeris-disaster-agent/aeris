// Supabase Edge Function: Execute Agent Mode actions instantly (Easter Egg)
// Triggered manually to test agent functionality immediately
// Executes retweet, like, and mention/reply actions without scheduling

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateResponse, type CharacterCard } from '../_shared/generateResponse.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL =
  Deno.env.get('PROJECT_URL') ??
  Deno.env.get('SUPABASE_URL') ??
  '';
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SERVICE_ROLE_KEY') ??
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  '';
const TWITTER_CLIENT_ID = Deno.env.get('TWITTER_CLIENT_ID') ?? '';
const TWITTER_CLIENT_SECRET = Deno.env.get('TWITTER_CLIENT_SECRET') ?? '';
const GROK_API_KEY = Deno.env.get('GROK_API_KEY') ?? '';

interface AgentSettings {
  enabled: boolean;
  targetAccounts: string[];
  actions: {
    retweet: boolean;
    like: boolean;
    mention: boolean;
  };
  frequency: 'daily' | '3days' | 'weekly';
  lastRunAt: string | null;
}

interface TwitterTweet {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
}

interface ExecutionResult {
  action: 'retweet' | 'like' | 'comment';
  tweetId: string;
  targetAccount: string;
  success: boolean;
  error?: string;
  postId?: string;
  alreadyDone?: boolean;
}

function createSupabaseAdmin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Refresh Twitter access token if expired
 */
async function refreshTokenIfNeeded(
  supabaseAdmin: SupabaseClient,
  userId: string,
  accessToken: string,
  refreshToken: string | null
): Promise<string> {
  const testResponse = await fetch('https://api.twitter.com/2/users/me', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (testResponse.ok) {
    return accessToken;
  }

  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  if (!TWITTER_CLIENT_ID || !TWITTER_CLIENT_SECRET) {
    throw new Error('Twitter client credentials not configured');
  }

  const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`)}`,
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      client_id: TWITTER_CLIENT_ID,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Token refresh failed: ${tokenResponse.status}`);
  }

  const tokens = await tokenResponse.json();
  const newAccessToken = tokens.access_token;
  const newRefreshToken = tokens.refresh_token || refreshToken;

  await supabaseAdmin
    .from('profiles')
    .update({
      twitter_access_token: newAccessToken,
      twitter_refresh_token: newRefreshToken,
    })
    .eq('id', userId);

  return newAccessToken;
}

/**
 * Get Twitter user ID by username
 */
async function getTwitterUserIdByUsername(
  username: string,
  accessToken: string
): Promise<string | null> {
  const response = await fetch(
    `https://api.twitter.com/2/users/by/username/${username}`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data.data?.id || null;
}

/**
 * Fetch recent tweets from a target account
 */
async function fetchTargetAccountTweets(
  targetUserId: string,
  accessToken: string,
  sinceHours: number = 24
): Promise<TwitterTweet[]> {
  const sinceTime = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  const params = new URLSearchParams({
    max_results: '5',
    'tweet.fields': 'created_at,author_id',
    start_time: sinceTime.toISOString(),
  });

  const response = await fetch(
    `https://api.twitter.com/2/users/${targetUserId}/tweets?${params}`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Generate a reply using shared response generation (now with same intelligence as chat)
 */
async function generateMentionReply(
  targetTweet: TwitterTweet,
  targetUsername: string,
  characterCard: CharacterCard
): Promise<string | null> {
  if (!GROK_API_KEY) {
    return null;
  }

  try {
    // Use shared response generation with Twitter mode
    const result = await generateResponse({
      characterCard,
      userMessage: targetTweet.text,
      recentResponses: [], // Could be enhanced to fetch from DB
      maxLength: 280, // Twitter character limit
      enforceOneSentence: false, // Twitter replies can be longer if needed
      mode: 'twitter',
      grokApiKey: GROK_API_KEY,
    });

    if (!result) {
      return null;
    }

    return result.response;
  } catch (error) {
    console.error('Error generating mention reply:', error);
    return null;
  }
}

/**
 * Check if user has already retweeted a tweet
 */
async function hasRetweeted(
  accessToken: string,
  twitterUserId: string,
  tweetId: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.twitter.com/2/users/${twitterUserId}/retweets?ids=${tweetId}`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    );
    
    if (!response.ok) return false;
    
    const data = await response.json();
    return (data.data?.length || 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Check if user has already liked a tweet
 */
async function hasLiked(
  accessToken: string,
  twitterUserId: string,
  tweetId: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.twitter.com/2/users/${twitterUserId}/likes?ids=${tweetId}`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    );
    
    if (!response.ok) return false;
    
    const data = await response.json();
    return (data.data?.length || 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Execute retweet action
 */
async function executeRetweet(
  accessToken: string,
  twitterUserId: string,
  tweetId: string
): Promise<{ success: boolean; error?: string; alreadyDone?: boolean }> {
  // Check if already retweeted
  const alreadyRetweeted = await hasRetweeted(accessToken, twitterUserId, tweetId);
  if (alreadyRetweeted) {
    return { success: true, alreadyDone: true };
  }

  const response = await fetch(
    `https://api.twitter.com/2/users/${twitterUserId}/retweets`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ tweet_id: tweetId }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = errorText;
    
    // Try to parse JSON error for better message
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.errors && errorJson.errors.length > 0) {
        errorMessage = errorJson.errors[0].message || errorText;
      } else if (errorJson.detail) {
        errorMessage = errorJson.detail;
      } else if (errorJson.title) {
        errorMessage = errorJson.title;
      }
    } catch {
      // Keep original error text if not JSON
    }
    
    // Check for "already retweeted" type errors
    const lowerError = errorMessage.toLowerCase();
    if (lowerError.includes('already') || lowerError.includes('duplicate') || 
        lowerError.includes('cannot retweet')) {
      return { success: true, alreadyDone: true };
    }
    
    return { success: false, error: `Twitter API ${response.status}: ${errorMessage.substring(0, 200)}` };
  }

  return { success: true };
}

/**
 * Execute like action
 */
async function executeLike(
  accessToken: string,
  twitterUserId: string,
  tweetId: string
): Promise<{ success: boolean; error?: string; alreadyDone?: boolean }> {
  // Check if already liked
  const alreadyLiked = await hasLiked(accessToken, twitterUserId, tweetId);
  if (alreadyLiked) {
    return { success: true, alreadyDone: true };
  }

  const response = await fetch(
    `https://api.twitter.com/2/users/${twitterUserId}/likes`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ tweet_id: tweetId }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = errorText;
    
    // Try to parse JSON error for better message
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.errors && errorJson.errors.length > 0) {
        errorMessage = errorJson.errors[0].message || errorText;
      } else if (errorJson.detail) {
        errorMessage = errorJson.detail;
      } else if (errorJson.title) {
        errorMessage = errorJson.title;
      }
    } catch {
      // Keep original error text if not JSON
    }
    
    // Check for "already liked" type errors
    const lowerError = errorMessage.toLowerCase();
    if (lowerError.includes('already') || lowerError.includes('duplicate') || 
        lowerError.includes('cannot like')) {
      return { success: true, alreadyDone: true };
    }
    
    return { success: false, error: `Twitter API ${response.status}: ${errorMessage.substring(0, 200)}` };
  }

  return { success: true };
}

/**
 * Execute comment/reply action
 */
async function executeComment(
  accessToken: string,
  tweetId: string,
  content: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  const response = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      text: content,
      reply: { in_reply_to_tweet_id: tweetId },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { success: false, error: `Twitter API ${response.status}: ${errorText.substring(0, 200)}` };
  }

  const data = await response.json();
  return { success: true, postId: data.data?.id };
}

/**
 * Execute instant agent actions for a user
 */
async function executeInstantAgentActions(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<ExecutionResult[]> {
  // Get user profile with agent settings
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('twitter_access_token, twitter_refresh_token, twitter_user_id, agent_settings')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    throw new Error('User profile not found');
  }

  const agentSettings = profile.agent_settings as AgentSettings | null;
  if (!agentSettings || !agentSettings.enabled) {
    throw new Error('Agent mode not enabled');
  }

  if (!profile.twitter_access_token) {
    throw new Error('Twitter not connected');
  }

  if (agentSettings.targetAccounts.length === 0) {
    throw new Error('No target accounts configured');
  }

  // Refresh token if needed
  const accessToken = await refreshTokenIfNeeded(
    supabaseAdmin,
    userId,
    profile.twitter_access_token,
    profile.twitter_refresh_token
  );

  // Get character card for mention generation
    let characterCard: CharacterCard | null = null;
  if (agentSettings.actions.mention) {
    const { data: cardData } = await supabaseAdmin
      .from('character_cards')
      .select('card_data')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (cardData?.card_data) {
      characterCard = cardData.card_data as typeof characterCard;
    }
  }

  const results: ExecutionResult[] = [];

  // Process each target account
  for (const targetUsername of agentSettings.targetAccounts.slice(0, 3)) { // Limit to 3 accounts for instant execution
    const targetUserId = await getTwitterUserIdByUsername(targetUsername, accessToken);
    if (!targetUserId) {
      continue;
    }

    // Get most recent tweet
    const tweets = await fetchTargetAccountTweets(targetUserId, accessToken, 24);
    if (tweets.length === 0) {
      continue;
    }

    const tweet = tweets[0]; // Use most recent tweet

    // Execute retweet
    if (agentSettings.actions.retweet) {
      const result = await executeRetweet(accessToken, profile.twitter_user_id || '', tweet.id);
      results.push({
        action: 'retweet',
        tweetId: tweet.id,
        targetAccount: targetUsername,
        success: result.success,
        error: result.error,
        alreadyDone: result.alreadyDone,
      });
      
      // Small delay between actions
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Execute like
    if (agentSettings.actions.like) {
      const result = await executeLike(accessToken, profile.twitter_user_id || '', tweet.id);
      results.push({
        action: 'like',
        tweetId: tweet.id,
        targetAccount: targetUsername,
        success: result.success,
        error: result.error,
        alreadyDone: result.alreadyDone,
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Execute mention/reply
    if (agentSettings.actions.mention && characterCard) {
      const replyContent = await generateMentionReply(
        tweet,
        targetUsername,
        characterCard as CharacterCard
      );

      if (replyContent) {
        const result = await executeComment(accessToken, tweet.id, replyContent);
        results.push({
          action: 'comment',
          tweetId: tweet.id,
          targetAccount: targetUsername,
          success: result.success,
          error: result.error,
          postId: result.postId,
        });
      }
    }
  }

  return results;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Health check
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ ok: true, service: 'execute-agent-actions-instant' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createSupabaseAdmin();
    const results = await executeInstantAgentActions(supabaseAdmin, userId);

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        executed: results.length,
        succeeded: successCount,
        failed: failCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Instant agent execution error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'unknown_error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

