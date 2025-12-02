// src/pages/TwitterCallbackPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getTwitterOAuthService } from '@/services/twitterOAuth';
import { exchangeCodeForTokens } from '@/services/twitterApi';
import { AuthService } from '@/services/auth';
import { supabase } from '@/lib/supabase';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export function TwitterCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const oauthService = getTwitterOAuthService();
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        // Check for error from Twitter
        if (error) {
          setStatus('error');
          setMessage(`Twitter authorization failed: ${error}`);
          setTimeout(() => navigate('/auth'), 3000);
          return;
        }

        // Validate state
        const storedState = oauthService.getStoredState();
        if (!state || state !== storedState) {
          setStatus('error');
          setMessage('Invalid state parameter. Please try again.');
          setTimeout(() => navigate('/auth'), 3000);
          return;
        }

        // Get code verifier
        const codeVerifier = oauthService.getStoredCodeVerifier();
        if (!codeVerifier) {
          setStatus('error');
          setMessage('Code verifier not found. Please try again.');
          setTimeout(() => navigate('/auth'), 3000);
          return;
        }

        if (!code) {
          setStatus('error');
          setMessage('Authorization code not found.');
          setTimeout(() => navigate('/auth'), 3000);
          return;
        }

        // Exchange code for tokens via Supabase Edge Function
        // The Edge Function also fetches user profile (avoids CORS issues)
        const redirectUri = import.meta.env.VITE_TWITTER_REDIRECT_URI || `${window.location.origin}/auth/twitter/callback`;
        const tokenData = await exchangeCodeForTokens(code, codeVerifier, redirectUri);
        
        // User profile is already included in tokenData from Edge Function
        if (!tokenData.user) {
          throw new Error('Failed to fetch Twitter user profile');
        }
        
        const twitterUser = tokenData.user;

        // Clear stored OAuth data
        oauthService.clearStoredData();

        // Edge Function creates user with admin privileges (bypasses email validation)
        let user;
        if (tokenData.supabase_user) {
          // User was created by Edge Function - verify we have the user
          const { data: { user: currentUser }, error: getUserError } = await supabase.auth.getUser();
          
          if (getUserError || !currentUser || currentUser.id !== tokenData.supabase_user.id) {
            // User not signed in - we need to sign them in
            // Since Edge Function created user, we'll use a workaround:
            // Check if profile exists, if so user is already created
            const { data: profile } = await supabase
              .from('profiles')
              .select('id')
              .eq('id', tokenData.supabase_user.id)
              .single();
            
            if (profile) {
              // User exists but not signed in - this shouldn't happen but handle it
              throw new Error('User created but session not established. Please refresh the page.');
            } else {
              throw new Error('Failed to authenticate user. Please try again.');
            }
          } else {
            user = currentUser;
          }
        } else {
          // Fallback: Check if user exists and sign them in
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id, email')
            .eq('twitter_user_id', twitterUser.id)
            .maybeSingle();

          if (existingProfile) {
            const { data: { user: existingUser } } = await supabase.auth.getUser();
            if (existingUser && existingUser.id === existingProfile.id) {
              user = existingUser;
            } else {
              throw new Error('Failed to sign in. Please try again.');
            }
          } else {
            throw new Error('Failed to create account. Please try again.');
          }
        }

        if (!user) {
          throw new Error('Failed to authenticate user. Please try again.');
        }

        // Store Twitter tokens and profile in Supabase
        const { error: linkError } = await AuthService.linkTwitterAccount({
          twitter_user_id: twitterUser.id,
          twitter_username: twitterUser.username,
          twitter_access_token: tokenData.access_token,
          twitter_refresh_token: tokenData.refresh_token,
        });

        if (linkError) {
          throw new Error('Failed to save Twitter connection. Please try again.');
        }

        // Update profile with Twitter info
        await AuthService.updateProfile({
          full_name: twitterUser.name || user.user_metadata?.full_name,
          profile_photo_url: twitterUser.profile_image_url || null,
        });

        setStatus('success');
        setMessage(`Successfully connected to Twitter as @${twitterUser.username}! Redirecting...`);

        // Redirect to home/dashboard immediately (no delay)
        navigate('/home', { replace: true });

      } catch (error) {
        console.error('Twitter callback error:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'An error occurred during authentication');
        setTimeout(() => navigate('/auth'), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-black/40 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-4 p-8"
      >
        {status === 'loading' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-white mx-auto" />
            <p className="text-white/80">Completing Twitter authentication...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <p className="text-white/80">{message}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="h-12 w-12 text-red-500 mx-auto" />
            <p className="text-white/80">{message}</p>
            <p className="text-white/60 text-sm mt-2">Redirecting to login...</p>
          </>
        )}
      </motion.div>
    </div>
  );
}

