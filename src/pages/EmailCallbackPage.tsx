import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export function EmailCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleEmailCallback = async () => {
      try {
        // Get the hash fragment from URL (Supabase uses hash for email callbacks)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const error = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');

        // Also check query params (some flows use query params)
        const queryError = searchParams.get('error');
        const queryErrorDescription = searchParams.get('error_description');

        if (error || queryError) {
          const errorMsg = errorDescription || queryErrorDescription || error || queryError;
          setStatus('error');
          setMessage(`Email verification failed: ${errorMsg}`);
          setTimeout(() => navigate('/auth'), 5000);
          return;
        }

        if (accessToken) {
          // Token is in the URL, Supabase should handle it automatically
          // But we'll verify the session
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError || !session) {
            throw new Error('Failed to establish session after email verification');
          }

          setStatus('success');
          setMessage('Email verified successfully! Redirecting...');
          setTimeout(() => navigate('/home'), 2000);
        } else {
          // No token found, might be expired or invalid
          setStatus('error');
          setMessage('Email verification link is invalid or has expired. Please request a new verification email.');
          setTimeout(() => navigate('/auth'), 5000);
        }
      } catch (error) {
        console.error('Email callback error:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'An error occurred during email verification');
        setTimeout(() => navigate('/auth'), 5000);
      }
    };

    handleEmailCallback();
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
            <p className="text-white/80">Verifying email...</p>
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

