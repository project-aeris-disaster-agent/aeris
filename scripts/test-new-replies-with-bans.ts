// Test NEW reply generation with banned phrase detection
// Generates fresh replies and checks if banned phrases are avoided
import { BANNED_PHRASES } from '../supabase/functions/_shared/bannedPhrases.ts';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wqwhlbmsafgjlsjujuel.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/test-agent-diversity`;

// Test tweets that previously triggered banned phrases
const TEST_TWEETS = [
  {
    name: 'Heat/Energy Tweet',
    tweet: `The heat between @agent_daredevil and @elizaOS is off the charts!`,
    author: 'newprontera',
    description: 'Tweet that previously generated replies with "fire", "energy", "vibe", "chaos"'
  },
  {
    name: 'Vibecoding Session',
    tweet: `Had an 8 hour vibecoding session this morning with @shawmakesmagic and I feel like a freshly spawned alien 👽`,
    author: 'LordSedano',
    description: 'Tweet that previously generated replies with "vibe", "energy"'
  },
  {
    name: 'Hot Take',
    tweet: `Hot take: Most Web3 games are just traditional games with NFTs slapped on. Prove me wrong.`,
    author: 'CryptoCritic',
    description: 'Tweet that previously generated "I get why you\'d say" pattern'
  }
];

const BANNED_PHRASES_LOWER = BANNED_PHRASES.map((phrase) => phrase.toLowerCase());

function checkBannedPhrases(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  
  BANNED_PHRASES_LOWER.forEach(phrase => {
    // Handle both straight and curly apostrophes
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const normalized = escaped.replace(/'/g, "['’]");
    const pattern = new RegExp(`\\b${normalized}\\b`, 'i');
    if (pattern.test(lower)) {
      found.push(phrase);
    }
  });
  
  return found;
}

async function testNewReplies() {
  if (!SUPABASE_ANON_KEY) {
    console.error('❌ VITE_SUPABASE_ANON_KEY not set');
    process.exit(1);
  }

  console.log('🧪 TESTING NEW REPLY GENERATION WITH BANNED PHRASE DETECTION\n');
  console.log('='.repeat(80));
  console.log('Generating FRESH replies to test if banned phrases are avoided\n');
  console.log('='.repeat(80) + '\n');

  const allResults: Array<{
    testName: string;
    results: Array<{
      agent: string;
      reply: string;
      length: number;
      bannedPhrases: string[];
      hasBanned: boolean;
    }>;
    totalBanned: number;
    bannedRate: number;
  }> = [];

  for (let i = 0; i < TEST_TWEETS.length; i++) {
    const tweet = TEST_TWEETS[i];
    console.log(`\n[${i + 1}/${TEST_TWEETS.length}] ${tweet.name}`);
    console.log(`📝 Tweet: "${tweet.tweet}"`);
    console.log(`👤 Author: @${tweet.author}`);
    console.log(`📋 ${tweet.description}\n`);

    try {
      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testTweet: tweet.tweet,
          targetUsername: tweet.author
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Function error: ${response.status} - ${errorText}`);
        continue;
      }

      const data = await response.json();

      // Debug: always show what we got
      console.log('📡 Function Response:', JSON.stringify(data, null, 2).substring(0, 500));

      if (data.error) {
        console.error(`❌ Error: ${data.error}`);
        continue;
      }

      // Debug: show raw results
      if (!data.results || data.results.length === 0) {
        console.log('⚠️  No replies generated. Checking data structure...');
        console.log('   Results array:', data.results);
        console.log('   Full response keys:', Object.keys(data));
        continue;
      }

      // Check each reply for banned phrases
      const checkedResults = (data.results || []).map((result: any) => {
        if (!result.reply) {
          return {
            agent: result.name,
            reply: '',
            length: 0,
            bannedPhrases: [],
            hasBanned: false
          };
        }

        const bannedPhrases = checkBannedPhrases(result.reply);
        return {
          agent: result.name,
          reply: result.reply,
          length: result.length,
          bannedPhrases,
          hasBanned: bannedPhrases.length > 0
        };
      });

      const totalBanned = checkedResults.filter(r => r.hasBanned).length;
      const bannedRate = checkedResults.length > 0 
        ? (totalBanned / checkedResults.length) * 100 
        : 0;

      allResults.push({
        testName: tweet.name,
        results: checkedResults,
        totalBanned,
        bannedRate
      });

      // Display results
      console.log('🤖 GENERATED REPLIES:\n');
      checkedResults.forEach((result, idx) => {
        if (result.reply) {
          const status = result.hasBanned ? '❌' : '✅';
          console.log(`${idx + 1}. ${status} @${result.agent} (${result.length} chars):`);
          console.log(`   "${result.reply}"`);
          if (result.hasBanned) {
            console.log(`   ⚠️  BANNED PHRASES: ${result.bannedPhrases.join(', ')}`);
          }
          console.log('');
        }
      });

      console.log(`📊 Banned Phrase Detection:`);
      console.log(`   Total Replies: ${checkedResults.filter(r => r.reply).length}`);
      console.log(`   With Banned Phrases: ${totalBanned}`);
      console.log(`   Banned Rate: ${bannedRate.toFixed(1)}%\n`);

      if (bannedRate > 0) {
        console.log(`⚠️  WARNING: ${bannedRate.toFixed(1)}% of replies still contain banned phrases!`);
        console.log(`   The detection may need to be more aggressive or the prompts need adjustment.\n`);
      } else {
        console.log(`✅ SUCCESS: No banned phrases detected in new replies!\n`);
      }

      // Wait between tests
      if (i < TEST_TWEETS.length - 1) {
        console.log('⏳ Waiting 3 seconds before next test...\n');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } catch (error) {
      console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Final summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 FINAL SUMMARY\n');

  const totalReplies = allResults.reduce((sum, r) => sum + r.results.filter(res => res.reply).length, 0);
  const totalBanned = allResults.reduce((sum, r) => sum + r.totalBanned, 0);
  const overallBannedRate = totalReplies > 0 ? (totalBanned / totalReplies) * 100 : 0;

  console.log(`Tests Run: ${allResults.length}`);
  console.log(`Total Replies Generated: ${totalReplies}`);
  console.log(`Replies with Banned Phrases: ${totalBanned}`);
  console.log(`Overall Banned Rate: ${overallBannedRate.toFixed(1)}%\n`);

  console.log('📋 BREAKDOWN BY TEST:\n');
  allResults.forEach(result => {
    const repliesCount = result.results.filter(r => r.reply).length;
    console.log(`${result.testName}:`);
    console.log(`   Replies: ${repliesCount} | Banned: ${result.totalBanned} | Rate: ${result.bannedRate.toFixed(1)}%`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('💡 ANALYSIS:\n');

  if (overallBannedRate === 0) {
    console.log('✅ PERFECT: No banned phrases detected in any new replies!');
    console.log('   The banned phrase detection is working correctly.\n');
  } else if (overallBannedRate < 20) {
    console.log('⚡ GOOD: Most replies avoid banned phrases.');
    console.log(`   ${overallBannedRate.toFixed(1)}% still contain them - may need slight tuning.\n`);
  } else if (overallBannedRate < 50) {
    console.log('⚠️  NEEDS IMPROVEMENT: Too many replies contain banned phrases.');
    console.log('   Consider:');
    console.log('   - Increasing antiSlopStrictness in settings');
    console.log('   - Adding more retry attempts');
    console.log('   - Strengthening prompt guidance\n');
  } else {
    console.log('❌ CRITICAL: Over half of replies contain banned phrases!');
    console.log('   The detection system needs immediate attention.\n');
  }

  // Show which phrases are still appearing
  const allBannedPhrases = new Map<string, number>();
  allResults.forEach(result => {
    result.results.forEach(res => {
      res.bannedPhrases.forEach(phrase => {
        allBannedPhrases.set(phrase, (allBannedPhrases.get(phrase) || 0) + 1);
      });
    });
  });

  if (allBannedPhrases.size > 0) {
    console.log('🔍 MOST COMMON BANNED PHRASES:\n');
    Array.from(allBannedPhrases.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([phrase, count]) => {
        console.log(`   "${phrase}": ${count} occurrence(s)`);
      });
    console.log('');
  }

  console.log('='.repeat(80));
}

testNewReplies().catch(console.error);
