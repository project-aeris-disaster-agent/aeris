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

    // Fetch user profile
    const userResponse = await fetch('https://api.twitter.com/2/users/me?user.fields=description,profile_image_url,verified,public_metrics', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
      },
    });

    let userData = null;
    if (userResponse.ok) {
      const userResult = await userResponse.json();
      userData = userResult.data;
    }

    // Create or get Supabase user using admin API (bypasses email validation)
    let supabaseUser = null;
    let userPassword = null;
    if (userData && supabaseUrl && supabaseServiceKey) {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      // Check if user exists by Twitter ID
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, email')
        .eq('twitter_user_id', userData.id)
        .maybeSingle();

      if (existingProfile) {
        // User exists - get their auth user
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(existingProfile.id);
        supabaseUser = user;
      } else {
        // Create new user with admin API (bypasses email validation)
        // Use a valid email format: {twitter_id}@twitter.localhost (localhost is valid)
        const email = `${userData.id.replace(/[^a-zA-Z0-9]/g, '_')}@twitter.localhost`;
        const password = `Twitter_${crypto.randomUUID().replace(/-/g, '')}${Math.random().toString(36).slice(2, 8)}!`;
        
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
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
          // Continue anyway - return error in response
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
          userPassword = password; // Return password so frontend can sign in
        } else {
          console.error('User creation returned no user:', newUser);
        }
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
          password: userPassword, // Temporary password for sign-in
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

