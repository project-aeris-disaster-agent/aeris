// src/pages/TwitterCallbackPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getTwitterOAuthService } from '@/services/twitterOAuth';
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

        // Exchange code for tokens (via backend API)
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
        const response = await fetch(`${apiBaseUrl}/auth/twitter/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code,
            codeVerifier,
            state,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Failed to exchange authorization code' }));
          throw new Error(errorData.message || 'Failed to exchange authorization code');
        }

        const data = await response.json();
        
        // Clear stored OAuth data
        oauthService.clearStoredData();

        // Store tokens (you might want to store in httpOnly cookies instead)
        // For now, storing access token in localStorage (refresh token should be httpOnly cookie)
        if (data.accessToken) {
          localStorage.setItem('twitter_access_token', data.accessToken);
        }

        setStatus('success');
        setMessage('Successfully connected to Twitter! Redirecting...');

        // Redirect to dashboard or next step
        setTimeout(() => {
          navigate('/dashboard'); // or wherever you want to redirect
        }, 2000);

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

