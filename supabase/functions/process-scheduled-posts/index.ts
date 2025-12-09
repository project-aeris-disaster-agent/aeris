// Supabase Edge Function: Process scheduled posts and publish when due
// Triggered via Supabase Scheduled Functions (cron) or an external cron hitting this endpoint.
// Uses service role key to read/write scheduled_posts and fetch user tokens.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CRON_SECRET = Deno.env.get('CRON_SECRET'); // optional shared secret for cron invocations
// Use names that do not start with SUPABASE_ to satisfy Supabase secret rules, but still
// allow backward compatibility if those were set previously.
const SUPABASE_URL =
  Deno.env.get('PROJECT_URL') ??
  Deno.env.get('SUPABASE_URL') ??
  '';
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SERVICE_ROLE_KEY') ??
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  '';

interface ScheduledPostRow {
  id: string;
  user_id: string;
  content: string;
  post_type: 'tweet' | 'reply' | 'thread';
  scheduled_for: string;
  posted_at: string | null;
  status: 'pending' | 'posted' | 'failed' | 'cancelled' | 'processing';
  error_message: string | null;
  post_metadata: Record<string, any> | null;
}

interface ProcessResult {
  id: string;
  platform: string;
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

function createSupabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

async function processPost(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  post: ScheduledPostRow
): Promise<ProcessResult> {
  const platform = post.post_metadata?.platform ?? 'twitter';
  const now = new Date().toISOString();
  // Note: status enum does not include "processing", so we avoid a claim step.
  // We guard final updates with status='pending' to prevent double-processing.

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

    return { id: post.id, platform, status: 'failed', error: 'unsupported_platform' };
  }

  // Fetch user tokens
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('twitter_access_token')
    .eq('id', post.user_id)
    .single();

  if (profileError || !profile?.twitter_access_token) {
    await supabaseAdmin
      .from('scheduled_posts')
      .update({
        status: 'failed',
        error_message: 'Missing Twitter access token',
      })
      .eq('id', post.id)
      .eq('status', 'pending');

    return { id: post.id, platform, status: 'failed', error: 'missing_twitter_token' };
  }

  try {
    // Try Twitter API v2 first
    const twitterResponse = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${profile.twitter_access_token}`,
      },
      body: JSON.stringify({ text: post.content }),
    });
    
    // If v2 fails with 403, log full error for debugging
    if (!twitterResponse.ok) {
      const errorText = await twitterResponse.text();
      console.error('Twitter API v2 error:', {
        status: twitterResponse.status,
        statusText: twitterResponse.statusText,
        error: errorText,
        tokenLength: profile.twitter_access_token?.length,
      });
    }

    if (!twitterResponse.ok) {
      const errorText = await twitterResponse.text();
      let errorDetails = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorDetails = errorJson.detail || errorJson.title || errorText;
      } catch {
        // Keep as text if not JSON
      }
      console.error('Twitter API error:', twitterResponse.status, errorDetails);

      await supabaseAdmin
        .from('scheduled_posts')
        .update({
          status: 'failed',
          error_message: `Twitter API error: ${twitterResponse.status} - ${errorDetails.substring(0, 200)}`,
        })
      .eq('id', post.id);

      return {
        id: post.id,
        platform,
        status: 'failed',
        error: `twitter_api_${twitterResponse.status}`,
      };
    }

    const twitterData = await twitterResponse.json();
    const postId = twitterData.data?.id as string | undefined;

    await supabaseAdmin
      .from('scheduled_posts')
      .update({
        status: 'posted',
        posted_at: now,
        post_metadata: {
          ...(post.post_metadata || {}),
          posted_via: 'scheduled-worker',
          twitter_post_id: postId,
        },
        error_message: null,
      })
      .eq('id', post.id)
      .eq('status', 'pending');

    return { id: post.id, platform, status: 'posted', post_id: postId };
  } catch (error) {
    console.error('Unexpected error posting to Twitter:', error);

    await supabaseAdmin
      .from('scheduled_posts')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', post.id)
      .eq('status', 'pending');

    return {
      id: post.id,
      platform,
      status: 'failed',
      error: error instanceof Error ? error.message : 'unknown_error',
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
    return new Response(JSON.stringify({ ok: true }), {
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

    const { data: pendingPosts, error: fetchError } = await supabaseAdmin
      .from('scheduled_posts')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', nowIso)
      .order('scheduled_for', { ascending: true })
      .limit(20);

    if (fetchError) {
      console.error('Failed to fetch scheduled posts:', fetchError);
      return new Response(JSON.stringify({ error: 'fetch_failed' }), {
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

    const results: ProcessResult[] = [];

    for (const post of pendingPosts as ScheduledPostRow[]) {
      const result = await processPost(supabaseAdmin, post);
      results.push(result);
    }

    return new Response(
      JSON.stringify({
        processed: results.length,
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

