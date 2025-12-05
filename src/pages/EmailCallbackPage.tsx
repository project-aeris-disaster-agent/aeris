import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { DitheringShader } from '@/components/ui/dithering-shader';

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
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden">
      {/* Background Shader - Full screen fixed - matching AuthPage */}
      <DitheringShader 
        shape="wave"
        type="8x8"
        colorBack="#001122"
        colorFront="#ff0088"
        pxSize={3}
        speed={0.6}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 0,
        }}
      />
      
      {/* Floating Content Container - matching AuthPage style */}
      <div className="fixed inset-0 z-20 flex items-center justify-center p-4 sm:p-6 md:p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="relative w-full max-w-md"
        >
          {/* Card Container - matching NewAuthCard style */}
          <div className="relative bg-black/60 backdrop-blur-xl rounded-2xl border border-cyan-400/30 p-8 shadow-2xl shadow-cyan-500/10">
            {/* Decorative gradient border effect */}
            <div className="absolute -inset-[1px] rounded-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-pink-600/20 via-cyan-500/20 to-pink-600/20 opacity-0 transition-opacity duration-300" />
            </div>
            
            <div className="relative z-10 flex flex-col items-center justify-center space-y-6 text-center">
              {status === 'loading' && (
                <>
                  <div className="relative">
                    <div className="p-4 rounded-full bg-gradient-to-r from-pink-600/20 to-cyan-500/20 border border-white/10">
                      <Loader2 className="h-12 w-12 animate-spin text-cyan-400" />
                    </div>
                    <motion.div
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-cyan-400"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold text-white">Verifying email...</h2>
                    <p className="text-white/60 text-sm">Please wait while we confirm your email address</p>
                  </div>
                  <div className="flex gap-1 mt-4">
                    <motion.div
                      className="w-2 h-2 rounded-full bg-cyan-400"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                    />
                    <motion.div
                      className="w-2 h-2 rounded-full bg-pink-500"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                    />
                    <motion.div
                      className="w-2 h-2 rounded-full bg-cyan-400"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
                    />
                  </div>
                </>
              )}
              {status === 'success' && (
                <>
                  <div className="relative">
                    <div className="p-4 rounded-full bg-gradient-to-r from-green-500/20 to-cyan-500/20 border border-green-500/30">
                      <CheckCircle2 className="h-12 w-12 text-green-400" />
                    </div>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring" }}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold text-white">Email Verified!</h2>
                    <p className="text-white/80 text-sm">{message}</p>
                  </div>
                </>
              )}
              {status === 'error' && (
                <>
                  <div className="relative">
                    <div className="p-4 rounded-full bg-gradient-to-r from-red-500/20 to-pink-500/20 border border-red-500/30">
                      <XCircle className="h-12 w-12 text-red-400" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold text-white">Verification Failed</h2>
                    <p className="text-white/80 text-sm">{message}</p>
                    <p className="text-white/60 text-xs mt-4">Redirecting to login...</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

