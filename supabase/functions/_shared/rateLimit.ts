// Rate Limiting Utility for Supabase Edge Functions
// Uses in-memory sliding window with fallback to simple counter

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface RateLimitConfig {
  /** Unique identifier for the rate limit (e.g., 'chat', 'post-gen') */
  key: string;
  /** Maximum requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number; // seconds until reset
}

// In-memory rate limit store (per Edge Function instance)
// Note: This is per-instance, so actual limits may be higher across distributed instances
// For stricter limits, use database-backed rate limiting
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

/**
 * Check rate limit for a user/action combination
 * Uses sliding window algorithm with in-memory storage
 */
export function checkRateLimit(
  userId: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const storeKey = `${config.key}:${userId}`;
  
  const entry = rateLimitStore.get(storeKey);
  
  if (!entry || now - entry.windowStart >= windowMs) {
    // New window or expired - reset
    rateLimitStore.set(storeKey, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: config.limit - 1,
      resetIn: config.windowSeconds,
    };
  }
  
  if (entry.count >= config.limit) {
    // Rate limit exceeded
    const resetIn = Math.ceil((entry.windowStart + windowMs - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetIn,
    };
  }
  
  // Increment counter
  entry.count++;
  const resetIn = Math.ceil((entry.windowStart + windowMs - now) / 1000);
  
  return {
    allowed: true,
    remaining: config.limit - entry.count,
    resetIn,
  };
}

/**
 * Database-backed rate limiting for stricter enforcement
 * Uses Supabase to persist rate limit counts across instances
 */
export async function checkRateLimitDB(
  userId: string,
  config: RateLimitConfig,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<RateLimitResult> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });
  
  const now = new Date();
  const windowStart = new Date(now.getTime() - config.windowSeconds * 1000);
  
  // Count requests in the current window
  const { count, error } = await supabase
    .from('rate_limit_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action_key', config.key)
    .gte('created_at', windowStart.toISOString());
  
  if (error) {
    console.error('Rate limit check failed:', error);
    // Fail open - allow request but log error
    return { allowed: true, remaining: config.limit, resetIn: config.windowSeconds };
  }
  
  const requestCount = count || 0;
  
  if (requestCount >= config.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: config.windowSeconds,
    };
  }
  
  // Log this request
  await supabase
    .from('rate_limit_log')
    .insert({ user_id: userId, action_key: config.key });
  
  return {
    allowed: true,
    remaining: config.limit - requestCount - 1,
    resetIn: config.windowSeconds,
  };
}

// Default rate limit configurations
export const RATE_LIMITS = {
  chat: {
    key: 'chat',
    limit: 30, // 30 messages per minute
    windowSeconds: 60,
  },
  postGeneration: {
    key: 'post-gen',
    limit: 10, // 10 post generations per minute
    windowSeconds: 60,
  },
  characterCard: {
    key: 'char-card',
    limit: 3, // 3 character card generations per hour
    windowSeconds: 3600,
  },
  socialPost: {
    key: 'social-post',
    limit: 10, // 10 social posts per hour
    windowSeconds: 3600,
  },
} as const;

/**
 * Create rate limit exceeded response
 */
export function rateLimitResponse(result: RateLimitResult, corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: `Too many requests. Please try again in ${result.resetIn} seconds.`,
      retryAfter: result.resetIn,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': result.resetIn.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
      },
    }
  );
}

