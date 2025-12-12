// Supabase Edge Function: Process Agent Mode actions
// Triggered via Vercel Cron or an external cron hitting this endpoint.
// Fetches target account tweets and schedules engagement actions (retweet, like, mention/reply)
// Includes randomized timing to avoid detection by Twitter/X

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
const GROK_API_KEY = Deno.env.get('GROK_API_KEY') ?? '';

// Agent settings type
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

interface UserWithAgentSettings {
  id: string;
  twitter_access_token: string | null;
  twitter_refresh_token: string | null;
  twitter_user_id: string | null;
  agent_settings: AgentSettings;
}

interface TwitterTweet {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
}

interface ProcessResult {
  userId: string;
  status: 'processed' | 'skipped' | 'failed';
  actionsScheduled: number;
  error?: string;
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
    return accessToken;
  }

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
  await supabaseAdmin
    .from('profiles')
    .update({
      twitter_access_token: newAccessToken,
      twitter_refresh_token: newRefreshToken,
    })
    .eq('id', userId);

  console.log(`Token refreshed successfully for user ${userId}`);
  return newAccessToken;
}

/**
 * Calculate randomized schedule time based on frequency
 * Adds jitter to avoid detection by Twitter/X
 */
function calculateRandomizedScheduleTime(
  frequency: 'daily' | '3days' | 'weekly',
  lastRunAt: Date | null
): Date {
  const now = new Date();
  const base = lastRunAt || now;

  // Define min/max hours for each frequency with jitter
  let minHours: number, maxHours: number;
  switch (frequency) {
    case 'daily':
      minHours = 20;
      maxHours = 28;
      break;
    case '3days':
      minHours = 66;
      maxHours = 78;
      break;
    case 'weekly':
      minHours = 144;
      maxHours = 192; // 6-8 days
      break;
    default:
      minHours = 20;
      maxHours = 28;
  }

  const randomHours = minHours + Math.random() * (maxHours - minHours);
  const scheduledTime = new Date(base.getTime() + randomHours * 60 * 60 * 1000);

  // Ensure within active hours (9 AM - 9 PM)
  const hour = scheduledTime.getHours();
  if (hour < 9) {
    scheduledTime.setHours(9, Math.floor(Math.random() * 60), 0);
  }
  if (hour >= 21) {
    scheduledTime.setHours(20, Math.floor(Math.random() * 60), 0);
  }

  return scheduledTime;
}

/**
 * Add staggered delay for multiple actions
 */
function addActionDelay(baseTime: Date, actionIndex: number): Date {
  const delayRanges = [
    { min: 0, max: 15 },
    { min: 15, max: 45 },
    { min: 30, max: 90 },
  ];

  const range = delayRanges[actionIndex] || delayRanges[2];
  const randomMinutes = range.min + Math.random() * (range.max - range.min);

  return new Date(baseTime.getTime() + randomMinutes * 60 * 1000);
}

/**
 * Check if it's time to run agent actions based on frequency
 */
function shouldRunAgent(settings: AgentSettings): boolean {
  if (!settings.enabled) return false;
  if (!settings.lastRunAt) return true;

  const lastRun = new Date(settings.lastRunAt);
  const now = new Date();

  // Calculate minimum hours based on frequency (use minimum of the range)
  let minHours: number;
  switch (settings.frequency) {
    case 'daily':
      minHours = 20;
      break;
    case '3days':
      minHours = 66;
      break;
    case 'weekly':
      minHours = 144;
      break;
    default:
      minHours = 20;
  }

  const hoursSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);
  return hoursSinceLastRun >= minHours;
}

/**
 * Fetch user ID by username from Twitter API
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
    console.error(`Failed to fetch user ID for @${username}:`, response.status);
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
  sinceHours: number = 48
): Promise<TwitterTweet[]> {
  const sinceTime = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  const params = new URLSearchParams({
    max_results: '10',
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
    console.error(`Failed to fetch tweets for user ${targetUserId}:`, response.status);
    return [];
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Generate a reply tweet using Grok API
 */
async function generateMentionReply(
  targetTweet: TwitterTweet,
  targetUsername: string,
  characterCardName: string,
  characterBio: string[],
  postStyle: string[]
): Promise<string | null> {
  if (!GROK_API_KEY) {
    console.error('GROK_API_KEY not configured');
    return null;
  }

  const systemPrompt = `You are ${characterCardName}. Your personality: ${characterBio.slice(0, 2).join(' ')}. 
Your communication style: ${postStyle.slice(0, 3).join(', ')}.
Generate a short, authentic reply (max 200 characters) to the following tweet. Be engaging but not spammy.`;

  const userPrompt = `Tweet from @${targetUsername}: "${targetTweet.text}"

Generate a reply that sounds natural and adds value to the conversation.`;

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-3-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 100,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      console.error('Grok API error:', response.status);
      return null;
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    
    // Ensure reply is not too long
    if (reply && reply.length > 280) {
      return reply.substring(0, 277) + '...';
    }
    
    return reply || null;
  } catch (error) {
    console.error('Error generating mention reply:', error);
    return null;
  }
}

/**
 * Check if we've already engaged with a tweet
 */
async function hasAlreadyEngaged(
  supabaseAdmin: SupabaseClient,
  userId: string,
  tweetId: string,
  actionType: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('scheduled_posts')
    .select('id')
    .eq('user_id', userId)
    .eq('target_tweet_id', tweetId)
    .eq('post_type', actionType)
    .in('status', ['pending', 'posted'])
    .limit(1);

  return (data?.length || 0) > 0;
}

/**
 * Schedule an engagement action
 */
async function scheduleAction(
  supabaseAdmin: SupabaseClient,
  userId: string,
  tweetId: string,
  actionType: 'retweet' | 'like' | 'comment',
  content: string,
  scheduledFor: Date
): Promise<boolean> {
  const { error } = await supabaseAdmin.from('scheduled_posts').insert({
    user_id: userId,
    content: content,
    post_type: actionType,
    scheduled_for: scheduledFor.toISOString(),
    posted_at: null,
    status: 'pending',
    error_message: null,
    target_tweet_id: tweetId,
    post_metadata: {
      platform: 'twitter',
      generated_by: 'agent_mode',
      scheduled_at: new Date().toISOString(),
    },
  });

  if (error) {
    console.error(`Failed to schedule ${actionType}:`, error);
    return false;
  }

  return true;
}

/**
 * Process a single user's agent actions
 */
async function processUserAgentActions(
  supabaseAdmin: SupabaseClient,
  user: UserWithAgentSettings
): Promise<ProcessResult> {
  const settings = user.agent_settings;

  // Check if it's time to run
  if (!shouldRunAgent(settings)) {
    return {
      userId: user.id,
      status: 'skipped',
      actionsScheduled: 0,
      error: 'Not time to run yet',
    };
  }

  // Check if user has Twitter connected
  if (!user.twitter_access_token) {
    return {
      userId: user.id,
      status: 'skipped',
      actionsScheduled: 0,
      error: 'Twitter not connected',
    };
  }

  // Check if any actions are enabled
  if (!settings.actions.retweet && !settings.actions.like && !settings.actions.mention) {
    return {
      userId: user.id,
      status: 'skipped',
      actionsScheduled: 0,
      error: 'No actions enabled',
    };
  }

  // Check if there are target accounts
  if (settings.targetAccounts.length === 0) {
    return {
      userId: user.id,
      status: 'skipped',
      actionsScheduled: 0,
      error: 'No target accounts configured',
    };
  }

  try {
    // Refresh token if needed
    const accessToken = await refreshTokenIfNeeded(
      supabaseAdmin,
      user.id,
      user.twitter_access_token,
      user.twitter_refresh_token
    );

    // Fetch character card for mention generation
    let characterCard: { name: string; bio: string[]; style: { post: string[] } } | null = null;
    if (settings.actions.mention) {
      const { data: cardData } = await supabaseAdmin
        .from('character_cards')
        .select('card_data')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (cardData?.card_data) {
        characterCard = cardData.card_data as typeof characterCard;
      }
    }

    let totalActionsScheduled = 0;
    const baseScheduleTime = calculateRandomizedScheduleTime(settings.frequency, null);

    // Process each target account
    for (const targetUsername of settings.targetAccounts) {
      // Get target user ID
      const targetUserId = await getTwitterUserIdByUsername(targetUsername, accessToken);
      if (!targetUserId) {
        console.log(`Could not find Twitter user: @${targetUsername}`);
        continue;
      }

      // Fetch recent tweets
      const tweets = await fetchTargetAccountTweets(targetUserId, accessToken);
      if (tweets.length === 0) {
        console.log(`No recent tweets from @${targetUsername}`);
        continue;
      }

      // Process the most recent tweet(s) - limit to 1-2 per account per run
      const tweetsToProcess = tweets.slice(0, 2);
      let actionIndex = 0;

      for (const tweet of tweetsToProcess) {
        // Schedule retweet
        if (settings.actions.retweet) {
          const alreadyRetweeted = await hasAlreadyEngaged(
            supabaseAdmin,
            user.id,
            tweet.id,
            'retweet'
          );

          if (!alreadyRetweeted) {
            const scheduledTime = addActionDelay(baseScheduleTime, actionIndex);
            const success = await scheduleAction(
              supabaseAdmin,
              user.id,
              tweet.id,
              'retweet',
              '',
              scheduledTime
            );
            if (success) {
              totalActionsScheduled++;
              actionIndex++;
            }
          }
        }

        // Schedule like
        if (settings.actions.like) {
          const alreadyLiked = await hasAlreadyEngaged(
            supabaseAdmin,
            user.id,
            tweet.id,
            'like'
          );

          if (!alreadyLiked) {
            const scheduledTime = addActionDelay(baseScheduleTime, actionIndex);
            const success = await scheduleAction(
              supabaseAdmin,
              user.id,
              tweet.id,
              'like',
              '',
              scheduledTime
            );
            if (success) {
              totalActionsScheduled++;
              actionIndex++;
            }
          }
        }

        // Schedule mention/reply
        if (settings.actions.mention && characterCard) {
          const alreadyReplied = await hasAlreadyEngaged(
            supabaseAdmin,
            user.id,
            tweet.id,
            'comment'
          );

          if (!alreadyReplied) {
            // Generate reply content
            const replyContent = await generateMentionReply(
              tweet,
              targetUsername,
              characterCard.name,
              characterCard.bio,
              characterCard.style.post
            );

            if (replyContent) {
              const scheduledTime = addActionDelay(baseScheduleTime, actionIndex);
              const success = await scheduleAction(
                supabaseAdmin,
                user.id,
                tweet.id,
                'comment',
                replyContent,
                scheduledTime
              );
              if (success) {
                totalActionsScheduled++;
                actionIndex++;
              }
            }
          }
        }
      }
    }

    // Update lastRunAt
    const updatedSettings: AgentSettings = {
      ...settings,
      lastRunAt: new Date().toISOString(),
    };

    await supabaseAdmin
      .from('profiles')
      .update({ agent_settings: updatedSettings })
      .eq('id', user.id);

    return {
      userId: user.id,
      status: 'processed',
      actionsScheduled: totalActionsScheduled,
    };
  } catch (error) {
    console.error(`Error processing agent actions for user ${user.id}:`, error);
    return {
      userId: user.id,
      status: 'failed',
      actionsScheduled: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
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
    let authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';

    if (!authHeader) {
      const url = new URL(req.url);
      const authParam = url.searchParams.get('Authorization');
      if (authParam) {
        authHeader = decodeURIComponent(authParam.replace(/\+/g, ' '));
      }
    }

    const expectedHeader = `Bearer ${CRON_SECRET}`;

    if (authHeader.trim() !== expectedHeader.trim()) {
      console.error('Auth mismatch');
      return unauthorized();
    }
  }

  // Health check
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ ok: true, service: 'process-agent-actions' }),
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
    const supabaseAdmin = createSupabaseAdmin();

    // Fetch all users with agent mode enabled
    const { data: users, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, twitter_access_token, twitter_refresh_token, twitter_user_id, agent_settings')
      .not('agent_settings', 'is', null)
      .eq('agent_settings->>enabled', 'true');

    if (fetchError) {
      console.error('Failed to fetch users with agent mode:', fetchError);
      return new Response(
        JSON.stringify({ error: 'fetch_failed', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, results: [], message: 'No users with agent mode enabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing agent actions for ${users.length} users...`);

    const results: ProcessResult[] = [];

    for (const user of users as UserWithAgentSettings[]) {
      console.log(`Processing user ${user.id}...`);
      const result = await processUserAgentActions(supabaseAdmin, user);
      results.push(result);
      console.log(`User ${user.id} result: ${result.status}, actions: ${result.actionsScheduled}`);
    }

    const processedCount = results.filter((r) => r.status === 'processed').length;
    const skippedCount = results.filter((r) => r.status === 'skipped').length;
    const failedCount = results.filter((r) => r.status === 'failed').length;
    const totalActions = results.reduce((sum, r) => sum + r.actionsScheduled, 0);

    console.log(
      `Agent processing complete: ${processedCount} processed, ${skippedCount} skipped, ${failedCount} failed, ${totalActions} actions scheduled`
    );

    return new Response(
      JSON.stringify({
        processed: processedCount,
        skipped: skippedCount,
        failed: failedCount,
        totalActionsScheduled: totalActions,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Agent processing error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'unknown_error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

