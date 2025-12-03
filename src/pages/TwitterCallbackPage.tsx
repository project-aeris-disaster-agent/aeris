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
        
        // Check for error from Edge Function
        if ((tokenData as any).error) {
          console.error('Edge Function returned error:', (tokenData as any).error);
          const errorDetails = (tokenData as any).details ? ` Details: ${(tokenData as any).details}` : '';
          throw new Error(`${(tokenData as any).error}${errorDetails}`);
        }
        
        // User profile is already included in tokenData from Edge Function
        if (!tokenData.user) {
          console.error('Token data received but no user:', tokenData);
          throw new Error('Failed to fetch Twitter user profile. The Twitter API did not return user information.');
        }
        
        const twitterUser = tokenData.user;
        
        // Log for debugging
        console.log('Token data received:', {
          hasUser: !!tokenData.user,
          hasSupabaseUser: !!tokenData.supabase_user,
          supabaseUser: tokenData.supabase_user,
          twitterUser: twitterUser.username,
        });
        
        // If no supabase_user, Edge Function failed to create user
        if (!tokenData.supabase_user) {
          console.error('Edge Function did not create user. Response:', tokenData);
          throw new Error('Failed to create account. The server could not create your user account. Please try again or contact support.');
        }

        // Clear stored OAuth data
        oauthService.clearStoredData();

        // Edge Function creates/finds user with admin privileges (bypasses email validation)
        let user;
        if (tokenData.supabase_user) {
          const isExistingUser = tokenData.supabase_user.is_existing;
          console.log(`${isExistingUser ? 'Existing' : 'New'} user detected:`, tokenData.supabase_user.email);

          // Both new and existing users now get a temporary password from Edge Function
          if (tokenData.supabase_user.password) {
            const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
              email: tokenData.supabase_user.email,
              password: tokenData.supabase_user.password,
            });

            if (signInError || !authData.user) {
              console.error('Sign in failed:', signInError);
              throw new Error(`Failed to sign in: ${signInError?.message || 'Unknown error'}`);
            }

            user = authData.user;
            console.log('Successfully signed in user:', user.id);
          } else {
            // Fallback: Edge Function couldn't set password, check if already signed in
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            
            if (currentUser && currentUser.id === tokenData.supabase_user.id) {
              user = currentUser;
            } else {
              throw new Error('Authentication failed. Please try again.');
            }
          }
        } else {
          throw new Error('Server did not return user information. Please try again.');
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
          full_name: twitterUser.name || user.user_metadata?.full_name || undefined,
          profile_photo_url: twitterUser.profile_image_url ?? undefined,
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

