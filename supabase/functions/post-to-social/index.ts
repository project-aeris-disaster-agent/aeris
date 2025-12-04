// Supabase Edge Function: Post to Social Media Platforms
// Posts content to connected social media accounts (Twitter, Farcaster, BASEapp)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PostRequest {
  user_id: string;
  content: string;
  platforms: string[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { user_id, content, platforms }: PostRequest = await req.json();

    if (!content || content.trim().length === 0) {
      throw new Error('Post content cannot be empty');
    }

    if (!platforms || platforms.length === 0) {
      throw new Error('At least one platform must be specified');
    }

    // Get user's profile with social media tokens
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('twitter_access_token, twitter_user_id, twitter_username')
      .eq('id', user_id)
      .single();

    if (profileError || !profile) {
      throw new Error('User profile not found');
    }

    const results: Array<{ success: boolean; platform: string; error?: string; post_id?: string }> = [];

    // Post to each platform
    for (const platform of platforms) {
      try {
        if (platform === 'twitter') {
          // Post to Twitter/X
          if (!profile.twitter_access_token) {
            results.push({
              success: false,
              platform: 'twitter',
              error: 'Twitter access token not found',
            });
            continue;
          }

          const twitterResponse = await fetch('https://api.twitter.com/2/tweets', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${profile.twitter_access_token}`,
            },
            body: JSON.stringify({
              text: content,
            }),
          });

          if (!twitterResponse.ok) {
            const errorData = await twitterResponse.text();
            console.error('Twitter API error:', errorData);
            results.push({
              success: false,
              platform: 'twitter',
              error: `Twitter API error: ${twitterResponse.status}`,
            });
            continue;
          }

          const twitterData = await twitterResponse.json();
          results.push({
            success: true,
            platform: 'twitter',
            post_id: twitterData.data?.id,
          });

          // Save to scheduled_posts table as "posted"
          await supabaseClient.from('scheduled_posts').insert({
            user_id,
            content,
            post_type: 'tweet',
            scheduled_for: new Date().toISOString(),
            posted_at: new Date().toISOString(),
            status: 'posted',
            post_metadata: {
              platform: 'twitter',
              twitter_post_id: twitterData.data?.id,
              posted_via: 'automation',
            },
          });
        } else if (platform === 'farcaster') {
          // Farcaster integration (placeholder - implement when API is available)
          results.push({
            success: false,
            platform: 'farcaster',
            error: 'Farcaster integration coming soon',
          });
        } else if (platform === 'baseapp') {
          // BASEapp integration (placeholder - implement when API is available)
          results.push({
            success: false,
            platform: 'baseapp',
            error: 'BASEapp integration coming soon',
          });
        } else {
          results.push({
            success: false,
            platform,
            error: `Unknown platform: ${platform}`,
          });
        }
      } catch (platformError) {
        console.error(`Error posting to ${platform}:`, platformError);
        results.push({
          success: false,
          platform,
          error: platformError instanceof Error ? platformError.message : 'Unknown error',
        });
      }
    }

    return new Response(
      JSON.stringify({
        results,
        success: results.some(r => r.success),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error posting to social media:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to post to social media',
        results: [],
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

