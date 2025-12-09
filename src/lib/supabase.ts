import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Helper function to validate URL
function isValidUrl(url: string | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const urlObj = new URL(trimmed);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

// Get and trim environment variables
const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabaseUrl = rawSupabaseUrl?.trim();
const supabaseAnonKey = rawSupabaseAnonKey?.trim();

// Validate URL format
const isValidSupabaseUrl = isValidUrl(supabaseUrl);
const hasValidKey = supabaseAnonKey && supabaseAnonKey.length > 0;

// Log environment variable status (helpful for debugging)
if (typeof window !== 'undefined') {
  console.log('🔧 Environment Check:', {
    hasSupabaseUrl: !!supabaseUrl,
    isValidSupabaseUrl,
    hasSupabaseKey: !!supabaseAnonKey,
    hasValidKey,
    urlPreview: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'missing',
    urlLength: supabaseUrl?.length || 0,
    allViteEnvKeys: Object.keys(import.meta.env).filter(key => key.startsWith('VITE_')),
  });
}

if (!isValidSupabaseUrl || !hasValidKey) {
  const errorMsg = `Invalid or missing Supabase environment variables. 
    VITE_SUPABASE_URL: ${isValidSupabaseUrl ? '✓ Valid' : '✗ Invalid/Missing'} (${rawSupabaseUrl ? `"${rawSupabaseUrl.substring(0, 50)}"` : 'undefined'})
    VITE_SUPABASE_ANON_KEY: ${hasValidKey ? '✓ Set' : '✗ Missing'}
    
    Please ensure these are set correctly in your Vercel project settings.
    URL must be a valid HTTP or HTTPS URL.`;
  console.error('❌', errorMsg);
  // Don't throw - let the app render so we can show a proper error UI
}

// Only create client if we have valid credentials
// This prevents runtime errors when env vars are missing or invalid
let supabase: ReturnType<typeof createClient<Database>>;

try {
  if (isValidSupabaseUrl && hasValidKey && supabaseUrl && supabaseAnonKey) {
    supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } else {
    // Create a dummy client that won't be used but prevents import errors
    // The app will show an error page instead
    supabase = createClient<Database>('https://placeholder.supabase.co', 'placeholder-key', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    console.warn('⚠️ Using placeholder Supabase client - app will show error page');
  }
} catch (error) {
  console.error('❌ Failed to create Supabase client:', error);
  // Create a dummy client to prevent app crash
  supabase = createClient<Database>('https://placeholder.supabase.co', 'placeholder-key', {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export { supabase };

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

