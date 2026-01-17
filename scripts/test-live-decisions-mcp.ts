// Simplified live decision test using MCP-fetched data
// Tests decision gate with real tweets from Twitter API

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { type CharacterCard } from '../supabase/functions/_shared/generateResponse.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from .env.local or .env
const envFiles = ['.env.local', '.env'];
for (const envFile of envFiles) {
  try {
    const envPath = path.join(__dirname, '..', envFile);
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
      break; // Use first file found
    }
  } catch {}
}

if (!process.env.GROK_API_KEY && process.env.VITE_GROK_API_KEY) {
  process.env.GROK_API_KEY = process.env.VITE_GROK_API_KEY;
}
if (!process.env.TWITTER_CLIENT_ID && process.env.VITE_TWITTER_CLIENT_ID) {
  process.env.TWITTER_CLIENT_ID = process.env.VITE_TWITTER_CLIENT_ID;
}
if (!process.env.TWITTER_CLIENT_SECRET && process.env.VITE_TWITTER_CLIENT_SECRET) {
  process.env.TWITTER_CLIENT_SECRET = process.env.VITE_TWITTER_CLIENT_SECRET;
}

const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID || '';
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET || '';

// Data fetched via MCP (you'll pass this in)
interface TestData {
  profile: {
    twitter_access_token: string;
    twitter_refresh_token: string;
    agent_settings: any;
  };
  characterCard: CharacterCard;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getTwitterUserIdByUsername(username: string, accessToken: string): Promise<string | null> {
  await delay(750);
  const response = await fetch(
    `https://api.twitter.com/2/users/by/username/${username}`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    if (response.status === 429) {
      console.warn(`Rate limited fetching user ID for @${username}`);
      return null;
    }
    return null;
  }

  const data = await response.json();
  return data.data?.id || null;
}

async function fetchTargetAccountTweets(
  targetUserId: string,
  accessToken: string,
  sinceHours: number = 24
): Promise<any[]> {
  await delay(750);
  const sinceTime = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  const params = new URLSearchParams({
    max_results: '5',
    'tweet.fields': 'created_at,author_id,public_metrics,in_reply_to_user_id,referenced_tweets',
    start_time: sinceTime.toISOString(),
  });

  const response = await fetch(
    `https://api.twitter.com/2/users/${targetUserId}/tweets?${params}`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    if (response.status === 429) {
      console.warn(`Rate limited fetching tweets for user ${targetUserId}`);
      return [];
    }
    return [];
  }

  const data = await response.json();
  return data.data || [];
}

async function runTest(testData: TestData) {
  console.log('🧪 Live Agent Decision Test (MCP Data)');
  console.log('='.repeat(70));
  console.log(`Character: ${testData.characterCard.name}`);
  
  const agentSettings = testData.profile.agent_settings;
  const targetAccounts = agentSettings.targetAccounts || [];
  const cursor = agentSettings.targetAccountCursor || 0;
  const batchSize = 3;
  const totalTargets = targetAccounts.length;
  
  const targetAccountsToProcess = Array.from({ length: Math.min(batchSize, totalTargets) }, (_, idx) => {
    return targetAccounts[(cursor + idx) % totalTargets];
  });

  console.log(`Targets: ${targetAccountsToProcess.join(', ')} (batch ${Math.floor(cursor / batchSize) + 1}/${Math.ceil(totalTargets / batchSize)})`);
  console.log(`Window: last 24 hours`);
  console.log('='.repeat(70));

  let totalTweets = 0;
  let shouldReplyCount = 0;
  let skipCount = 0;

  for (const targetUsername of targetAccountsToProcess) {
    console.log(`\n📌 Target: @${targetUsername}`);
    
    const targetUserId = await getTwitterUserIdByUsername(targetUsername, testData.profile.twitter_access_token);
    if (!targetUserId) {
      console.log('   ❌ Could not fetch user id, skipping.');
      continue;
    }

    const tweets = await fetchTargetAccountTweets(targetUserId, testData.profile.twitter_access_token, 24);
    if (!tweets.length) {
      console.log('   No recent tweets found.');
      continue;
    }

    const tweetsToProcess = tweets.slice(0, 2);
    for (const tweet of tweetsToProcess) {
      totalTweets++;
      const metrics = tweet.public_metrics || {};
      console.log('\n— Tweet');
      console.log(`  id: ${tweet.id}`);
      console.log(`  created_at: ${tweet.created_at}`);
      console.log(`  metrics: likes=${metrics.like_count || 0}, retweets=${metrics.retweet_count || 0}, replies=${metrics.reply_count || 0}`);
      console.log(`  text: ${tweet.text}`);

      const decision = {
        shouldReply: true,
        reason: 'Decision gate removed',
        confidence: 'low' as const,
      };

      console.log('  decision:');
      console.log(`  ${JSON.stringify(decision, null, 2).split('\n').join('\n  ')}`);

      if (decision.shouldReply) {
        shouldReplyCount++;
        console.log(`  ✅ REPLY (${decision.confidence} confidence): ${decision.reason}`);
      } else {
        skipCount++;
        console.log(`  ❌ SKIP (${decision.confidence} confidence): ${decision.reason}`);
      }
    }

    await delay(1500);
  }

  console.log('\n' + '='.repeat(70));
  console.log('Summary');
  console.log(`Total tweets evaluated: ${totalTweets}`);
  console.log(`Should reply: ${shouldReplyCount}`);
  console.log(`Skip: ${skipCount}`);
  console.log('Done.');
}

// Load test data from file
const testDataPath = path.join(__dirname, 'test-data.json');
let testData: TestData;

try {
  const dataContent = fs.readFileSync(testDataPath, 'utf-8');
  testData = JSON.parse(dataContent);
} catch (error) {
  console.error(`❌ Failed to load test data from ${testDataPath}:`, error);
  process.exit(1);
}

if (!testData.profile.twitter_access_token || !testData.characterCard.name) {
  console.error('❌ Invalid test data. Missing twitter_access_token or characterCard.name');
  process.exit(1);
}

runTest(testData).catch((error) => {
  console.error(`\n❌ Test failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
