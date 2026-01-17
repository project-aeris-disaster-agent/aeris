// Supabase Edge Function: Twitter OAuth Callback
// Handles token exchange securely (has access to client_secret)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { code, code_verifier, redirect_uri } = await req.json();

    if (!code || !code_verifier || !redirect_uri) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get environment variables
    const clientId = Deno.env.get('TWITTER_CLIENT_ID');
    const clientSecret = Deno.env.get('TWITTER_CLIENT_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://wqwhlbmsafgjlsjujuel.supabase.co';
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY');

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'Twitter credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: clientId,
        redirect_uri: redirect_uri,
        code_verifier: code_verifier,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json().catch(() => ({ error_description: 'Token exchange failed' }));
      return new Response(
        JSON.stringify({ error: error.error_description || 'Failed to exchange tokens' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokens = await tokenResponse.json();

    // CRITICAL: Log what Twitter actually returned
    console.log('🔑 Twitter token exchange result:', {
      hasAccessToken: !!tokens.access_token,
      tokenType: tokens.token_type,
      expiresIn: tokens.expires_in,
      scopeReturned: tokens.scope, // <-- What scopes did Twitter ACTUALLY grant?
      tokenPrefix: tokens.access_token?.substring(0, 20) + '...',
      tokenLength: tokens.access_token?.length,
    });
    
    // Verify the token includes required scopes
    const grantedScopes = tokens.scope?.split(' ') || [];
    const hasWriteScope = grantedScopes.includes('tweet.write');
    console.log('📝 Scope analysis:', {
      grantedScopes,
      hasWriteScope,
      requestedScopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    });
    
    if (!hasWriteScope) {
      console.warn('⚠️ WARNING: Twitter did NOT grant tweet.write scope! Posts will fail.');
    }

    // Fetch user profile with retry logic for rate limits
    console.log('Fetching Twitter user profile with access token...');
    
    let userResponse;
    let retryCount = 0;
    const maxRetries = 1; // Only retry once to reduce API calls
    const baseDelay = 60000; // Wait 60 seconds instead of 2 seconds
    let lastErrorResponse = null;
    
    while (retryCount <= maxRetries) {
      userResponse = await fetch('https://api.twitter.com/2/users/me?user.fields=description,profile_image_url,verified,public_metrics', {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
        },
      });

      console.log(`Twitter user profile response status (attempt ${retryCount + 1}):`, userResponse.status, userResponse.statusText);

      // If successful, break
      if (userResponse.ok) {
        break;
      }

      // Handle 429 rate limit - wait longer and only retry once
      if (userResponse.status === 429 && retryCount < maxRetries) {
        // Store error response before retrying
        lastErrorResponse = userResponse;
        const retryAfter = userResponse.headers.get('Retry-After');
        // Use Retry-After header if available, otherwise wait 60 seconds
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : baseDelay;
        
        console.warn(`Rate limited by Twitter API. Waiting ${delay/1000}s before single retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        retryCount++;
        continue;
      }
      
      // If it's not a 429 or we've exhausted retries, break
      lastErrorResponse = userResponse;
      break;
    }
    
    // If we exhausted retries and still have a 429, use the last error response
    if (!userResponse.ok && lastErrorResponse && lastErrorResponse.status === 429) {
      userResponse = lastErrorResponse;
    }

    let userData = null;
    if (userResponse.ok) {
      try {
        const responseText = await userResponse.text();
        console.log('Twitter API response text:', responseText.substring(0, 500)); // Log first 500 chars
        
        const userResult = JSON.parse(responseText);
        console.log('Parsed Twitter API response:', JSON.stringify(userResult).substring(0, 500));
        
        userData = userResult.data;
        
        // Log if data structure is unexpected
        if (!userData && userResult) {
          console.warn('Twitter API response structure unexpected:', JSON.stringify(userResult));
          // Try to use the result directly if it's not wrapped in 'data'
          if (userResult.id && userResult.username) {
            console.log('Using userResult directly as userData');
            userData = userResult;
          } else if (userResult.errors) {
            console.error('Twitter API returned errors:', userResult.errors);
            return new Response(
              JSON.stringify({ 
                error: 'Twitter API returned errors',
                details: userResult.errors,
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else if (userData) {
          console.log('Successfully extracted userData:', { id: userData.id, username: userData.username });
        }
      } catch (parseError) {
        console.error('Failed to parse Twitter user profile response:', parseError);
        // Response already read above, can't read again - use error message
        return new Response(
          JSON.stringify({ 
            error: 'Failed to parse Twitter user profile response',
            details: parseError.message || 'Unknown parsing error',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Log error details for debugging
      const errorText = await userResponse.text();
      let errorJson = null;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        // Not JSON, use as text
      }
      
      console.error('Failed to fetch Twitter user profile:', {
        status: userResponse.status,
        statusText: userResponse.statusText,
        error: errorJson || errorText,
        retryCount,
      });
      
      // Special handling for 429 rate limit errors
      if (userResponse.status === 429) {
        const retryAfter = userResponse.headers.get('Retry-After');
        const errorDetails = errorJson ? JSON.stringify(errorJson) : errorText;
        
        return new Response(
          JSON.stringify({ 
            error: 'Twitter API rate limit exceeded. Please wait a few minutes and try again.',
            details: errorDetails,
            retryAfter: retryAfter || null,
            status: 429,
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Return error response with details for other errors
      const errorDetails = errorJson ? JSON.stringify(errorJson) : errorText;
      return new Response(
        JSON.stringify({ 
          error: `Failed to fetch Twitter user profile: ${userResponse.status} ${userResponse.statusText}`,
          details: errorDetails,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure we have userData before proceeding
    if (!userData || !userData.id || !userData.username) {
      return new Response(
        JSON.stringify({ 
          error: 'Twitter user profile data is missing or incomplete',
          received: userData ? 'Partial data received' : 'No data received',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure we have valid userData before proceeding
    if (!userData || !userData.id || !userData.username) {
      console.error('User data validation failed:', { userData, hasId: !!userData?.id, hasUsername: !!userData?.username });
      return new Response(
        JSON.stringify({ 
          error: 'Twitter user profile data is missing or incomplete',
          received: userData ? 'Partial data received' : 'No data received',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create or get Supabase user using admin API (bypasses email validation)
    let supabaseUser = null;
    let userPassword = null;
    let isExistingUser = false;

    if (supabaseUrl && supabaseServiceKey) {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      // Generate the email format we use for Twitter users
      const twitterEmail = `${userData.id.replace(/[^a-zA-Z0-9]/g, '_')}@twitter.localhost`;

      // Check if user exists by Twitter ID in profiles
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, email')
        .eq('twitter_user_id', userData.id)
        .maybeSingle();

      // Also check if user exists by generated email (in case profile twitter_user_id wasn't set yet)
      let existingAuthUser = null;
      if (!existingProfile) {
        const { data: usersList } = await supabaseAdmin.auth.admin.listUsers();
        existingAuthUser = usersList?.users?.find(u => u.email === twitterEmail);
      }

      if (existingProfile) {
        // User exists in profiles - get their auth user
        console.log('Found existing user by twitter_user_id:', existingProfile.id);
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(existingProfile.id);
        supabaseUser = user;
        isExistingUser = true;

        // Generate a new temporary password for this session
        const tempPassword = `Twitter_${crypto.randomUUID().replace(/-/g, '')}${Math.random().toString(36).slice(2, 8)}!`;
        
        // Update user's password temporarily for this sign-in
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingProfile.id, {
          password: tempPassword,
        });

        if (!updateError) {
          userPassword = tempPassword;
        } else {
          console.error('Failed to update password for existing user:', updateError);
        }

      } else if (existingAuthUser) {
        // User exists by email but profile doesn't have twitter_user_id set
        console.log('Found existing user by email:', existingAuthUser.id);
        supabaseUser = existingAuthUser;
        isExistingUser = true;

        // Generate a new temporary password for this session
        const tempPassword = `Twitter_${crypto.randomUUID().replace(/-/g, '')}${Math.random().toString(36).slice(2, 8)}!`;
        
        // Update user's password temporarily for this sign-in
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, {
          password: tempPassword,
        });

        if (!updateError) {
          userPassword = tempPassword;
        } else {
          console.error('Failed to update password for existing user:', updateError);
        }

        // Update the profile with twitter_user_id
        await supabaseAdmin
          .from('profiles')
          .update({
            twitter_user_id: userData.id,
            twitter_username: userData.username,
          })
          .eq('id', existingAuthUser.id);

      } else {
        // Create new user with admin API (bypasses email validation)
        console.log('Creating new user for Twitter ID:', userData.id);
        const password = `Twitter_${crypto.randomUUID().replace(/-/g, '')}${Math.random().toString(36).slice(2, 8)}!`;
        
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: twitterEmail,
          password: password,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            full_name: userData.name,
            twitter_user_id: userData.id,
            twitter_username: userData.username,
          },
        });

        if (createError) {
          console.error('Failed to create user:', createError);
          return new Response(
            JSON.stringify({
              error: `Failed to create user: ${createError.message}`,
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
              expires_in: tokens.expires_in,
              token_type: tokens.token_type,
              scope: tokens.scope,
              user: userData,
              supabase_user: null,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (newUser && newUser.user) {
          supabaseUser = newUser.user;
          userPassword = password;
          isExistingUser = false;
        } else {
          console.error('User creation returned no user:', newUser);
        }
      }
    } else {
      console.error('Missing Supabase configuration:', {
        hasSupabaseUrl: !!supabaseUrl,
        hasSupabaseServiceKey: !!supabaseServiceKey,
      });
      return new Response(
        JSON.stringify({ 
          error: 'Server configuration error: Missing Supabase credentials',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Final validation before returning
    if (!userData || !userData.id || !userData.username) {
      console.error('User data missing at final return:', { userData });
      return new Response(
        JSON.stringify({ 
          error: 'Failed to retrieve Twitter user profile',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully processed Twitter OAuth:', {
      twitterUserId: userData.id,
      twitterUsername: userData.username,
      supabaseUserId: supabaseUser?.id,
      isExistingUser,
    });

    // Cache the user profile data for reuse in character card generation
    if (supabaseUrl && supabaseServiceKey && supabaseUser) {
      try {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { persistSession: false, autoRefreshToken: false }
        });

        // Store user profile in cache for character card generation
        await supabaseAdmin
          .from('twitter_data_cache')
          .upsert({
            user_id: supabaseUser.id,
            profile_data: userData, // Full profile from Twitter
            cached_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
          }, { onConflict: 'user_id' });

        console.log('Cached Twitter user profile for reuse');
      } catch (cacheError) {
        console.error('Failed to cache user profile:', cacheError);
        // Non-fatal, continue
      }
    }

    return new Response(
      JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        token_type: tokens.token_type,
        scope: tokens.scope,
        user: userData,
        supabase_user: supabaseUser ? {
          id: supabaseUser.id,
          email: supabaseUser.email,
          password: userPassword, // Temporary password for sign-in (works for both new and existing users now)
          is_existing: isExistingUser,
        } : null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
