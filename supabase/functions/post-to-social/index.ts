// Supabase Edge Function: Post to Social Media Platforms
// Posts content to connected social media accounts (Twitter, Farcaster, BASEapp)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    // Use service role key to bypass RLS and access user tokens
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? '',
    );

    const { user_id, content, platforms }: PostRequest = await req.json();

    if (!content || content.trim().length === 0) {
      throw new Error('Post content cannot be empty');
    }

    if (!platforms || platforms.length === 0) {
      throw new Error('At least one platform must be specified');
    }

    // Get user's profile with social media tokens (using admin client to bypass RLS)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('twitter_access_token, twitter_user_id, twitter_username')
      .eq('id', user_id)
      .single();

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      throw new Error(`User profile not found: ${profileError?.message || 'No profile data'}`);
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

          // First, verify token can read (to confirm it's valid)
          const verifyResponse = await fetch('https://api.twitter.com/2/users/me', {
            headers: {
              'Authorization': `Bearer ${profile.twitter_access_token}`,
            },
          });
          
          if (!verifyResponse.ok) {
            const verifyError = await verifyResponse.text();
            console.error('Token verification failed:', verifyResponse.status, verifyError);
            results.push({
              success: false,
              platform: 'twitter',
              error: `Token invalid: ${verifyResponse.status}`,
            });
            continue;
          }

          // Token is valid, try to post
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
            let errorMessage = `Twitter API error: ${twitterResponse.status}`;
            let fullErrorDetails = errorData;
            
            try {
              const errorJson = JSON.parse(errorData);
              // Extract ALL error info for debugging
              fullErrorDetails = JSON.stringify(errorJson, null, 2);
              
              // Common Twitter API v2 error formats
              if (errorJson.detail) {
                errorMessage = errorJson.detail;
              } else if (errorJson.title) {
                errorMessage = `${errorJson.title}: ${errorJson.detail || ''}`;
              } else if (errorJson.errors && Array.isArray(errorJson.errors)) {
                errorMessage = errorJson.errors.map((e: any) => e.message || e.detail || JSON.stringify(e)).join('; ');
              } else if (errorJson.error_description) {
                errorMessage = errorJson.error_description;
              }
              
              console.error('🚫 Twitter API POST error:', {
                status: twitterResponse.status,
                statusText: twitterResponse.statusText,
                fullError: errorJson,
                tokenPrefix: profile.twitter_access_token?.substring(0, 20) + '...',
                tokenLength: profile.twitter_access_token?.length,
                contentLength: content.length,
              });
            } catch {
              console.error('Twitter API error (raw text):', errorData);
            }
            
            results.push({
              success: false,
              platform: 'twitter',
              error: `${errorMessage} (Status: ${twitterResponse.status}). Full details: ${fullErrorDetails}`,
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
          await supabaseAdmin.from('scheduled_posts').insert({
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

