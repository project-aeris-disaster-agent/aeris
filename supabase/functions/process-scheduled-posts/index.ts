// Supabase Edge Function: Process scheduled posts and publish when due
// Triggered via Vercel Cron or an external cron hitting this endpoint.
// Supports: tweet, reply, thread, retweet, like, comment actions
// Includes automatic token refresh when expired.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CRON_SECRET = Deno.env.get('CRON_SECRET');
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

// Extended post types including engagement actions
type ScheduledPostType = 'tweet' | 'reply' | 'thread' | 'retweet' | 'like' | 'comment';

interface ScheduledPostRow {
  id: string;
  user_id: string;
  content: string;
  post_type: ScheduledPostType;
  scheduled_for: string;
  posted_at: string | null;
  status: 'pending' | 'posted' | 'failed' | 'cancelled';
  error_message: string | null;
  post_metadata: Record<string, unknown> | null;
  target_tweet_id: string | null; // For retweet, like, comment actions
}

interface UserProfile {
  twitter_access_token: string | null;
  twitter_refresh_token: string | null;
  twitter_user_id: string | null;
}

interface ProcessResult {
  id: string;
  platform: string;
  action: ScheduledPostType;
  status: 'posted' | 'failed' | 'skipped';
  error?: string;
  post_id?: string;
}

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function createSupabaseAdmin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Refresh Twitter access token if expired
 * Returns the valid access token (either existing or refreshed)
 */
async function refreshTokenIfNeeded(
  supabaseAdmin: SupabaseClient,
  userId: string,
  accessToken: string,
  refreshToken: string | null
): Promise<string> {
  // Test if current token is valid
  const testResponse = await fetch('https://api.twitter.com/2/users/me', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (testResponse.ok) {
    return accessToken; // Token is still valid
  }

  // Token expired or invalid - try to refresh
  console.log(`Token invalid for user ${userId}, attempting refresh...`);

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
    const errorText = await tokenResponse.text();
    console.error('Token refresh failed:', tokenResponse.status, errorText);
    throw new Error(`Token refresh failed: ${tokenResponse.status}`);
  }

  const tokens = await tokenResponse.json();
  const newAccessToken = tokens.access_token;
  const newRefreshToken = tokens.refresh_token || refreshToken;

  // Update tokens in database
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({
      twitter_access_token: newAccessToken,
      twitter_refresh_token: newRefreshToken,
    })
    .eq('id', userId);

  if (updateError) {
    console.error('Failed to update tokens in database:', updateError);
  }

  console.log(`Token refreshed successfully for user ${userId}`);
  return newAccessToken;
}

/**
 * Execute a Twitter action based on post type
 */
async function executeTwitterAction(
  post: ScheduledPostRow,
  accessToken: string,
  twitterUserId: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  };

  let response: Response;

  switch (post.post_type) {
    case 'tweet':
    case 'thread': {
      // Create a new tweet
      response = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: post.content }),
      });
      break;
    }

    case 'reply':
    case 'comment': {
      // Reply to a tweet
      if (!post.target_tweet_id) {
        return { success: false, error: 'Missing target_tweet_id for reply/comment' };
      }
      response = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: post.content,
          reply: { in_reply_to_tweet_id: post.target_tweet_id },
        }),
      });
      break;
    }

    case 'retweet': {
      // Retweet a tweet
      if (!post.target_tweet_id) {
        return { success: false, error: 'Missing target_tweet_id for retweet' };
      }
      response = await fetch(
        `https://api.twitter.com/2/users/${twitterUserId}/retweets`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ tweet_id: post.target_tweet_id }),
        }
      );
      break;
    }

    case 'like': {
      // Like a tweet
      if (!post.target_tweet_id) {
        return { success: false, error: 'Missing target_tweet_id for like' };
      }
      response = await fetch(
        `https://api.twitter.com/2/users/${twitterUserId}/likes`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ tweet_id: post.target_tweet_id }),
        }
      );
      break;
    }

    default:
      return { success: false, error: `Unsupported post type: ${post.post_type}` };
  }

  if (!response.ok) {
    const errorText = await response.text();
    let errorDetails = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorDetails = errorJson.detail || errorJson.title || errorJson.error || errorText;
    } catch {
      // Keep as text if not JSON
    }
    console.error(`Twitter API error for ${post.post_type}:`, response.status, errorDetails);
    return {
      success: false,
      error: `Twitter API ${response.status}: ${errorDetails.substring(0, 200)}`,
    };
  }

  const data = await response.json();
  
  // Extract post ID based on action type
  let postId: string | undefined;
  if (post.post_type === 'tweet' || post.post_type === 'reply' || 
      post.post_type === 'comment' || post.post_type === 'thread') {
    postId = data.data?.id;
  } else if (post.post_type === 'retweet') {
    postId = data.data?.id || post.target_tweet_id;
  } else if (post.post_type === 'like') {
    postId = post.target_tweet_id; // Likes don't return a new ID
  }

  return { success: true, postId };
}

/**
 * Process a single scheduled post
 */
async function processPost(
  supabaseAdmin: SupabaseClient,
  post: ScheduledPostRow
): Promise<ProcessResult> {
  const platform = (post.post_metadata?.platform as string) ?? 'twitter';
  const now = new Date().toISOString();

  // Only Twitter implemented currently
  if (platform !== 'twitter') {
    await supabaseAdmin
      .from('scheduled_posts')
      .update({
        status: 'failed',
        error_message: `Platform not supported: ${platform}`,
      })
      .eq('id', post.id)
      .eq('status', 'pending');

    return { id: post.id, platform, action: post.post_type, status: 'failed', error: 'unsupported_platform' };
  }

  // Fetch user tokens and Twitter user ID
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('twitter_access_token, twitter_refresh_token, twitter_user_id')
    .eq('id', post.user_id)
    .single();

  if (profileError || !profile) {
    await supabaseAdmin
      .from('scheduled_posts')
      .update({
        status: 'failed',
        error_message: 'User profile not found',
      })
      .eq('id', post.id)
      .eq('status', 'pending');

    return { id: post.id, platform, action: post.post_type, status: 'failed', error: 'profile_not_found' };
  }

  const userProfile = profile as UserProfile;

  if (!userProfile.twitter_access_token) {
    await supabaseAdmin
      .from('scheduled_posts')
      .update({
        status: 'failed',
        error_message: 'Missing Twitter access token',
      })
      .eq('id', post.id)
      .eq('status', 'pending');

    return { id: post.id, platform, action: post.post_type, status: 'failed', error: 'missing_twitter_token' };
  }

  // For retweet/like actions, we need the Twitter user ID
  if ((post.post_type === 'retweet' || post.post_type === 'like') && !userProfile.twitter_user_id) {
    await supabaseAdmin
      .from('scheduled_posts')
      .update({
        status: 'failed',
        error_message: 'Missing Twitter user ID for engagement action',
      })
      .eq('id', post.id)
      .eq('status', 'pending');

    return { id: post.id, platform, action: post.post_type, status: 'failed', error: 'missing_twitter_user_id' };
  }

  try {
    // Refresh token if needed
    const accessToken = await refreshTokenIfNeeded(
      supabaseAdmin,
      post.user_id,
      userProfile.twitter_access_token,
      userProfile.twitter_refresh_token
    );

    // Execute the Twitter action
    const result = await executeTwitterAction(
      post,
      accessToken,
      userProfile.twitter_user_id || ''
    );

    if (!result.success) {
      await supabaseAdmin
        .from('scheduled_posts')
        .update({
          status: 'failed',
          error_message: result.error || 'Unknown error',
        })
        .eq('id', post.id)
        .eq('status', 'pending');

      return {
        id: post.id,
        platform,
        action: post.post_type,
        status: 'failed',
        error: result.error,
      };
    }

    // Success - update post status
    await supabaseAdmin
      .from('scheduled_posts')
      .update({
        status: 'posted',
        posted_at: now,
        post_metadata: {
          ...(post.post_metadata || {}),
          posted_via: 'scheduled-worker',
          twitter_post_id: result.postId,
          action_executed: post.post_type,
        },
        error_message: null,
      })
      .eq('id', post.id)
      .eq('status', 'pending');

    return {
      id: post.id,
      platform,
      action: post.post_type,
      status: 'posted',
      post_id: result.postId,
    };
  } catch (error) {
    console.error(`Unexpected error processing ${post.post_type} for post ${post.id}:`, error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await supabaseAdmin
      .from('scheduled_posts')
      .update({
        status: 'failed',
        error_message: errorMessage,
      })
      .eq('id', post.id)
      .eq('status', 'pending');

    return {
      id: post.id,
      platform,
      action: post.post_type,
      status: 'failed',
      error: errorMessage,
    };
  }
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Optional shared-secret auth
  if (CRON_SECRET) {
    const authHeader = req.headers.get('authorization') || '';
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return unauthorized();
    }
  }

  // Health check
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ ok: true, supported_actions: ['tweet', 'reply', 'thread', 'retweet', 'like', 'comment'] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseAdmin = createSupabaseAdmin();
    const nowIso = new Date().toISOString();

    // Fetch all pending posts that are due
    const { data: pendingPosts, error: fetchError } = await supabaseAdmin
      .from('scheduled_posts')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', nowIso)
      .order('scheduled_for', { ascending: true })
      .limit(20);

    if (fetchError) {
      console.error('Failed to fetch scheduled posts:', fetchError);
      return new Response(JSON.stringify({ error: 'fetch_failed', details: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!pendingPosts || pendingPosts.length === 0) {
      return new Response(JSON.stringify({ processed: 0, results: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${pendingPosts.length} scheduled posts...`);

    const results: ProcessResult[] = [];

    for (const post of pendingPosts as ScheduledPostRow[]) {
      console.log(`Processing post ${post.id} (${post.post_type})...`);
      const result = await processPost(supabaseAdmin, post);
      results.push(result);
      console.log(`Post ${post.id} result: ${result.status}`);
    }

    const successCount = results.filter(r => r.status === 'posted').length;
    const failCount = results.filter(r => r.status === 'failed').length;

    console.log(`Processed ${results.length} posts: ${successCount} succeeded, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        processed: results.length,
        succeeded: successCount,
        failed: failCount,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Worker error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'unknown_error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
