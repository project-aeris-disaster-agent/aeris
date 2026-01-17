// Live test script: evaluate real tweets and decide whether to reply
// Uses agent settings + character card from Supabase (decision gate removed)

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { type CharacterCard } from '../supabase/functions/_shared/generateResponse.ts';

// Try to load from .env.local if it exists
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
        }
      }
    });
  }
} catch {
  // Ignore errors loading .env.local
}

// Map VITE_ vars to server-side equivalents when needed
if (!process.env.GROK_API_KEY && process.env.VITE_GROK_API_KEY) {
  process.env.GROK_API_KEY = process.env.VITE_GROK_API_KEY;
}
if (!process.env.SUPABASE_URL && process.env.VITE_SUPABASE_URL) {
  process.env.SUPABASE_URL = process.env.VITE_SUPABASE_URL;
}
if (!process.env.TWITTER_CLIENT_ID && process.env.VITE_TWITTER_CLIENT_ID) {
  process.env.TWITTER_CLIENT_ID = process.env.VITE_TWITTER_CLIENT_ID;
}
if (!process.env.TWITTER_CLIENT_SECRET && process.env.VITE_TWITTER_CLIENT_SECRET) {
  process.env.TWITTER_CLIENT_SECRET = process.env.VITE_TWITTER_CLIENT_SECRET;
}

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '';
const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID || '';
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET || '';

interface TargetAccountConfig {
  username: string;
  actions?: {
    retweet?: boolean;
    like?: boolean;
    mention?: boolean;
  };
}

interface ContentFilterConfig {
  keywords?: string[];
  negativeKeywords?: string[];
  minEngagement?: {
    likes?: number;
    retweets?: number;
  };
  tweetTypes?: Array<'original' | 'reply' | 'retweet'>;
}

interface AgentSettings {
  enabled: boolean;
  targetAccounts: (string | TargetAccountConfig)[];
  actions: {
    retweet: boolean;
    like: boolean;
    mention: boolean;
  };
  contentFilter?: ContentFilterConfig;
  targetAccountCursor?: number;
  targetAccountIdCache?: Record<string, { id: string; cachedAt: string }>;
}

interface TwitterTweet {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  public_metrics?: {
    like_count?: number;
    retweet_count?: number;
    reply_count?: number;
    quote_count?: number;
  };
  in_reply_to_user_id?: string;
  referenced_tweets?: Array<{
    type: 'replied_to' | 'retweeted' | 'quoted';
    id: string;
  }>;
}

const args = process.argv.slice(2);
const argValue = (name: string, fallback?: string): string | undefined => {
  const idx = args.indexOf(name);
  if (idx === -1) return fallback;
  return args[idx + 1] || fallback;
};

const userId = argValue('--user') || argValue('-u') || process.env.TEST_USER_ID;
const targetsArg = argValue('--targets');
const maxPerAccount = Number(argValue('--limit', '2'));
const sinceHours = Number(argValue('--sinceHours', '24'));
const disableFilter = args.includes('--no-filter');
const forceDecision = args.includes('--force');
const fullScan = args.includes('--full');
const batchSizeArg = Number(argValue('--batch', '3'));

if (!userId) {
  console.error('❌ Missing user id. Usage: npm run test:live-decisions -- --user <uuid>');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const RATE_LIMIT_RETRY_DELAY_MS = 5000;
const RATE_LIMIT_MAX_WAIT_MS = 30000;
const TARGET_ID_CACHE_TTL_HOURS = 168;

async function waitForRateLimitReset(response: Response): Promise<void> {
  const resetHeader = response.headers.get('x-rate-limit-reset');
  if (resetHeader) {
    const resetEpochMs = parseInt(resetHeader, 10) * 1000;
    const waitMs = resetEpochMs - Date.now();
    if (waitMs > 0) {
      await delay(Math.min(waitMs, RATE_LIMIT_MAX_WAIT_MS));
      return;
    }
  }
  await delay(RATE_LIMIT_RETRY_DELAY_MS);
}

function getCachedTargetUserId(
  cache: Record<string, { id: string; cachedAt: string }> | undefined,
  username: string
): string | null {
  if (!cache || !cache[username]) return null;
  const cached = cache[username];
  const cachedAt = new Date(cached.cachedAt).getTime();
  const ageHours = (Date.now() - cachedAt) / (1000 * 60 * 60);
  if (Number.isNaN(ageHours) || ageHours > TARGET_ID_CACHE_TTL_HOURS) {
    return null;
  }
  return cached.id;
}

async function refreshTokenIfNeeded(
  userId: string,
  accessToken: string,
  refreshToken: string | null
): Promise<string> {
  const testResponse = await fetch('https://api.twitter.com/2/users/me', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (testResponse.ok) return accessToken;

  if (!refreshToken) {
    throw new Error('No refresh token available.');
  }
  if (!TWITTER_CLIENT_ID || !TWITTER_CLIENT_SECRET) {
    throw new Error('Twitter client credentials not configured for refresh.');
  }

  const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      client_id: TWITTER_CLIENT_ID,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Token refresh failed: ${tokenResponse.status} ${errorText.substring(0, 200)}`);
  }

  const tokens = await tokenResponse.json();
  const newAccessToken = tokens.access_token as string;
  const newRefreshToken = (tokens.refresh_token as string) || refreshToken;

  await supabase
    .from('profiles')
    .update({
      twitter_access_token: newAccessToken,
      twitter_refresh_token: newRefreshToken,
    })
    .eq('id', userId);

  console.log('✅ Twitter token refreshed.');
  return newAccessToken;
}

async function getTwitterUserIdByUsername(
  username: string,
  accessToken: string
): Promise<{ id: string | null; rateLimited: boolean }> {
  await delay(750);
  const response = await fetch(
    `https://api.twitter.com/2/users/by/username/${username}`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    if (response.status === 429) {
      console.warn(`Rate limited fetching user ID for @${username} - retrying once...`);
      await waitForRateLimitReset(response);
      const retry = await fetch(
        `https://api.twitter.com/2/users/by/username/${username}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      if (!retry.ok) {
        console.error(`Retry failed fetching user ID for @${username}: ${retry.status}`);
        return { id: null, rateLimited: retry.status === 429 };
      }
      const retryData = await retry.json();
      return { id: retryData.data?.id || null, rateLimited: false };
    }
    console.error(`Failed to fetch user ID for @${username}: ${response.status}`);
    return { id: null, rateLimited: false };
  }

  const data = await response.json();
  return { id: data.data?.id || null, rateLimited: false };
}

async function fetchTargetAccountTweets(
  targetUserId: string,
  accessToken: string,
  sinceHours: number
): Promise<{ tweets: TwitterTweet[]; rateLimited: boolean }> {
  await delay(750);
  const sinceTime = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  const params = new URLSearchParams({
    max_results: '10',
    'tweet.fields': 'created_at,author_id,public_metrics,in_reply_to_user_id,referenced_tweets',
    start_time: sinceTime.toISOString(),
  });

  const response = await fetch(
    `https://api.twitter.com/2/users/${targetUserId}/tweets?${params}`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    if (response.status === 429) {
      console.warn(`Rate limited fetching tweets for user ${targetUserId} - retrying once...`);
      await waitForRateLimitReset(response);
      const retry = await fetch(
        `https://api.twitter.com/2/users/${targetUserId}/tweets?${params}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      if (!retry.ok) {
        console.error(`Retry failed fetching tweets for user ${targetUserId}: ${retry.status}`);
        return { tweets: [], rateLimited: retry.status === 429 };
      }
      const retryData = await retry.json();
      return { tweets: retryData.data || [], rateLimited: false };
    }
    console.error(`Failed to fetch tweets for user ${targetUserId}: ${response.status}`);
    return { tweets: [], rateLimited: false };
  }

  const data = await response.json();
  return { tweets: data.data || [], rateLimited: false };
}

function filterTweets(
  tweets: TwitterTweet[],
  filterConfig?: ContentFilterConfig
): TwitterTweet[] {
  if (!filterConfig) return tweets;
  let filtered = [...tweets];

  if (filterConfig.keywords?.length) {
    const keywordsLower = filterConfig.keywords.map((k) => k.toLowerCase());
    filtered = filtered.filter((tweet) =>
      keywordsLower.some((keyword) => tweet.text.toLowerCase().includes(keyword))
    );
  }

  if (filterConfig.negativeKeywords?.length) {
    const negativeLower = filterConfig.negativeKeywords.map((k) => k.toLowerCase());
    filtered = filtered.filter(
      (tweet) => !negativeLower.some((keyword) => tweet.text.toLowerCase().includes(keyword))
    );
  }

  if (filterConfig.minEngagement) {
    filtered = filtered.filter((tweet) => {
      const metrics = tweet.public_metrics || {};
      const likes = metrics.like_count || 0;
      const retweets = metrics.retweet_count || 0;

      if (filterConfig.minEngagement?.likes !== undefined && likes < filterConfig.minEngagement.likes) {
        return false;
      }
      if (filterConfig.minEngagement?.retweets !== undefined && retweets < filterConfig.minEngagement.retweets) {
        return false;
      }
      return true;
    });
  }

  if (filterConfig.tweetTypes?.length) {
    filtered = filtered.filter((tweet) => {
      const isReply = !!tweet.in_reply_to_user_id;
      const isRetweet = tweet.referenced_tweets?.some((ref) => ref.type === 'retweeted') || false;
      const isOriginal = !isReply && !isRetweet;

      if (isOriginal && filterConfig.tweetTypes?.includes('original')) return true;
      if (isReply && filterConfig.tweetTypes?.includes('reply')) return true;
      if (isRetweet && filterConfig.tweetTypes?.includes('retweet')) return true;
      return false;
    });
  }

  return filtered;
}

async function fetchThreadContext(
  tweetId: string,
  accessToken: string
): Promise<{ conversationId: string; threadTweets: TwitterTweet[] } | null> {
  try {
    const tweetResponse = await fetch(
      `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=conversation_id,author_id,public_metrics,in_reply_to_user_id,referenced_tweets`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!tweetResponse.ok) return null;
    const tweetData = await tweetResponse.json();
    const conversationId = tweetData.data?.conversation_id;
    if (!conversationId) return null;

    const threadResponse = await fetch(
      `https://api.twitter.com/2/tweets/search/recent?query=conversation_id:${conversationId}&tweet.fields=created_at,author_id,public_metrics,in_reply_to_user_id,referenced_tweets&max_results=10`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!threadResponse.ok) return null;
    const threadData = await threadResponse.json();
    return { conversationId, threadTweets: threadData.data || [] };
  } catch (error) {
    console.error('Error fetching thread context:', error);
    return null;
  }
}

function formatThreadContext(threadTweets: TwitterTweet[]): string {
  if (!threadTweets.length) return '';
  const threadTexts = threadTweets
    .slice(0, 3)
    .map((t) => `"${t.text}"`)
    .join('\n\n');
  return `Previous tweets in this conversation:\n${threadTexts}`;
}

function normalizeTargetAccounts(targetAccounts: (string | TargetAccountConfig)[]): string[] {
  return targetAccounts.map((account) => (typeof account === 'string' ? account : account.username));
}

async function run() {
  console.log('🧪 Live Agent Decision Test');
  console.log('='.repeat(70));

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, twitter_access_token, twitter_refresh_token, twitter_user_id, agent_settings')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    throw new Error(profileError?.message || 'Profile not found');
  }

  const agentSettings = profile.agent_settings as AgentSettings | null;
  if (!agentSettings || !agentSettings.enabled) {
    throw new Error('Agent mode not enabled for this user.');
  }

  if (!agentSettings.actions.mention) {
    const message = 'Agent mention/reply action is disabled in settings.';
    if (!forceDecision) {
      throw new Error(`${message} Re-run with --force to evaluate decisions anyway.`);
    }
    console.warn(`⚠️  ${message} Proceeding because --force was provided.`);
  }

  if (!profile.twitter_access_token) {
    throw new Error('Twitter not connected for this user.');
  }

  const { data: cardData, error: cardError } = await supabase
    .from('character_cards')
    .select('card_data')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (cardError || !cardData?.card_data) {
    throw new Error('Active character card not found.');
  }

  const characterCard = cardData.card_data as CharacterCard;
  let accessToken = profile.twitter_access_token as string;

  try {
    accessToken = await refreshTokenIfNeeded(userId, accessToken, profile.twitter_refresh_token);
  } catch (error) {
    console.warn(`⚠️  Token refresh skipped: ${error instanceof Error ? error.message : String(error)}`);
  }

  const targetAccounts = targetsArg
    ? targetsArg.split(',').map((t) => t.trim()).filter(Boolean)
    : normalizeTargetAccounts(agentSettings.targetAccounts);

  if (targetAccounts.length === 0) {
    throw new Error('No target accounts configured (or provided via --targets).');
  }

  const totalTargets = targetAccounts.length;
  const batchSize = fullScan ? totalTargets : Math.min(batchSizeArg, totalTargets);
  const cursor = agentSettings.targetAccountCursor ?? 0;
  const targetAccountsToProcess = fullScan
    ? targetAccounts
    : Array.from({ length: batchSize }, (_, idx) => {
        return targetAccounts[(cursor + idx) % totalTargets];
      });
  const nextCursor = (cursor + batchSize) % totalTargets;
  const targetIdCache = { ...(agentSettings.targetAccountIdCache || {}) };
  let cacheDirty = false;

  console.log(`User: ${userId}`);
  console.log(`Character: ${characterCard.name}`);
  console.log(
    `Targets: ${targetAccountsToProcess.join(', ')}${fullScan ? '' : ` (batch ${batchSize}/${totalTargets})`}`
  );
  console.log(`Window: last ${sinceHours} hours`);
  console.log(`Limit per account: ${maxPerAccount}`);
  console.log(`Content filter: ${disableFilter ? 'DISABLED' : 'ENABLED'}`);
  console.log('='.repeat(70));

  let totalTweets = 0;
  let shouldReplyCount = 0;
  let skipCount = 0;

  for (const targetUsername of targetAccountsToProcess) {
    console.log(`\n📌 Target: @${targetUsername}`);
    let targetUserId = getCachedTargetUserId(targetIdCache, targetUsername);
    if (!targetUserId) {
      const userIdResult = await getTwitterUserIdByUsername(targetUsername, accessToken);
      if (userIdResult.rateLimited) {
        console.warn(`Rate limit reached while resolving @${targetUsername}. Stopping early.`);
        break;
      }
      targetUserId = userIdResult.id;
      if (targetUserId) {
        targetIdCache[targetUsername] = { id: targetUserId, cachedAt: new Date().toISOString() };
        cacheDirty = true;
      }
    }
    if (!targetUserId) {
      console.log('   ❌ Could not fetch user id, skipping.');
      continue;
    }

    const tweetResult = await fetchTargetAccountTweets(targetUserId, accessToken, sinceHours);
    if (tweetResult.rateLimited) {
      console.warn(`Rate limit reached while fetching tweets for @${targetUsername}. Stopping early.`);
      break;
    }
    const tweets = tweetResult.tweets;
    if (!tweets.length) {
      console.log('   No recent tweets found.');
      continue;
    }

    const filteredTweets = disableFilter ? tweets : filterTweets(tweets, agentSettings.contentFilter);
    if (!filteredTweets.length) {
      console.log('   No tweets passed content filters.');
      continue;
    }

    const tweetsToProcess = filteredTweets.slice(0, Math.max(1, maxPerAccount));
    for (const tweet of tweetsToProcess) {
      totalTweets++;
      const metrics = tweet.public_metrics || {};
      console.log('\n— Tweet');
      console.log(`  id: ${tweet.id}`);
      console.log(`  created_at: ${tweet.created_at}`);
      console.log(`  metrics: likes=${metrics.like_count || 0}, retweets=${metrics.retweet_count || 0}, replies=${metrics.reply_count || 0}`);
      console.log(`  text: ${tweet.text}`);

      let threadContext = '';
      if (tweet.in_reply_to_user_id) {
        const context = await fetchThreadContext(tweet.id, accessToken);
        if (context?.threadTweets?.length) {
          threadContext = formatThreadContext(context.threadTweets);
          console.log('  thread_context:');
          console.log(`  ${threadContext.split('\n').join('\n  ')}`);
        }
      }

      const decision = {
        shouldReply: true,
        reason: 'Decision gate removed',
        confidence: 'low',
      };

      console.log('  decision:');
      console.log(`  ${JSON.stringify(decision, null, 2).split('\n').join('\n  ')}`);

      if (decision.shouldReply) {
        shouldReplyCount++;
      } else {
        skipCount++;
      }
    }

    // Delay between accounts to reduce rate limit risk
    await delay(1500);
  }

  if (cacheDirty || (!fullScan && nextCursor !== cursor)) {
    await supabase
      .from('profiles')
      .update({
        agent_settings: {
          ...agentSettings,
          targetAccountCursor: fullScan ? cursor : nextCursor,
          targetAccountIdCache: targetIdCache,
        },
      })
      .eq('id', userId);
  }

  console.log('\n='.repeat(70));
  console.log('Summary');
  console.log(`Total tweets evaluated: ${totalTweets}`);
  console.log(`Should reply: ${shouldReplyCount}`);
  console.log(`Skip: ${skipCount}`);
  console.log('Done.');
}

run().catch((error) => {
  console.error(`\n❌ Test failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
