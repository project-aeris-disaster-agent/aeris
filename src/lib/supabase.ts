import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Log environment variable status (helpful for debugging)
if (typeof window !== 'undefined') {
  console.log('🔧 Environment Check:', {
    hasSupabaseUrl: !!supabaseUrl,
    hasSupabaseKey: !!supabaseAnonKey,
    urlPreview: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'missing',
    allViteEnvKeys: Object.keys(import.meta.env).filter(key => key.startsWith('VITE_')),
  });
}

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = `Missing Supabase environment variables. 
    VITE_SUPABASE_URL: ${supabaseUrl ? '✓' : '✗'}
    VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✓' : '✗'}
    
    Please ensure these are set in your Vercel project settings.`;
  console.error('❌', errorMsg);
  // Don't throw - let the app render so we can show a proper error UI
}

export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

// Helper function to get current user
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
};

// Helper function to get user profile
export const getUserProfile = async (userId?: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  const targetUserId = userId || user?.id;
  
  if (!targetUserId) return null;
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', targetUserId)
    .single();
    
  if (error) throw error;
  return data;
};

