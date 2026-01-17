// Comprehensive test suite for agent diversity
// Tests multiple tweets and scenarios

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wqwhlbmsafgjlsjujuel.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/test-agent-diversity`;

// Multiple test tweets covering different scenarios
const TEST_TWEETS = [
  {
    name: 'Vibecoding Session',
    tweet: `Had an 8 hour vibecoding session this morning with @shawmakesmagic and I feel like a freshly spawned alien 👽

On a side note I think Opus and GPT should fight to the death inside @hyperscapeai

Watch the stream 👇`,
    author: 'LordSedano',
    description: 'Long tweet about coding session and AI models'
  },
  {
    name: 'F1 Race Discussion',
    tweet: `Ferrari's strategy today was questionable. Leclerc had the pace but the pit stop timing cost him the podium.`,
    author: 'F1Fan',
    description: 'Short tweet about F1 racing'
  },
  {
    name: 'Web3 Gaming Announcement',
    tweet: `Just launched our new Web3 game on @ImmutableX. Early access for holders starts tomorrow! 🎮🚀`,
    author: 'GameDev',
    description: 'Announcement tweet with emojis'
  },
  {
    name: 'Question Tweet',
    tweet: `What's everyone's take on AI agents in gaming? Are we ready for NPCs that actually think?`,
    author: 'TechCurious',
    description: 'Question that invites discussion'
  },
  {
    name: 'Hot Take',
    tweet: `Hot take: Most Web3 games are just traditional games with NFTs slapped on. Prove me wrong.`,
    author: 'CryptoCritic',
    description: 'Provocative statement'
  }
];

interface TestResult {
  testName: string;
  tweet: string;
  author: string;
  results: any[];
  similarities: any[];
  averageSimilarity: number;
  diversityScore: string;
  duplicateCount: number;
}

async function runSingleTest(tweet: any): Promise<TestResult> {
  console.log(`\n🧪 Testing: ${tweet.name}`);
  console.log(`📝 Tweet: "${tweet.tweet.substring(0, 80)}..."`);
  console.log(`👤 Author: @${tweet.author}\n`);

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
      throw new Error(`Function error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Count duplicates (100% similar pairs)
    const duplicates = data.similarities?.filter((s: any) => s.similarity >= 0.99).length || 0;

    return {
      testName: tweet.name,
      tweet: tweet.tweet,
      author: tweet.author,
      results: data.results || [],
      similarities: data.similarities || [],
      averageSimilarity: data.averageSimilarity || 0,
      diversityScore: data.diversityScore || 'UNKNOWN',
      duplicateCount: duplicates
    };
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

async function runComprehensiveTests() {
  if (!SUPABASE_ANON_KEY) {
    console.error('❌ VITE_SUPABASE_ANON_KEY not set');
    console.error('   Set it with: $env:VITE_SUPABASE_ANON_KEY="your-key"');
    process.exit(1);
  }

  console.log('🧪 COMPREHENSIVE AGENT DIVERSITY TEST SUITE\n');
  console.log('='.repeat(80));
  console.log(`Testing ${TEST_TWEETS.length} different tweet scenarios`);
  console.log('='.repeat(80));

  const allResults: TestResult[] = [];

  for (let i = 0; i < TEST_TWEETS.length; i++) {
    const tweet = TEST_TWEETS[i];
    console.log(`\n[${i + 1}/${TEST_TWEETS.length}] ${tweet.description}`);

    try {
      const result = await runSingleTest(tweet);
      allResults.push(result);

      // Display quick summary
      const successCount = result.results.filter((r: any) => r.reply && !r.error).length;
      console.log(`   ✅ Generated: ${successCount}/${result.results.length} replies`);
      console.log(`   📊 Similarity: ${(result.averageSimilarity * 100).toFixed(1)}%`);
      console.log(`   🎯 Score: ${result.diversityScore}`);
      if (result.duplicateCount > 0) {
        console.log(`   ⚠️  Duplicates: ${result.duplicateCount} pair(s)`);
      }

      // Wait between tests to avoid rate limits
      if (i < TEST_TWEETS.length - 1) {
        console.log('   ⏳ Waiting 3 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } catch (error) {
      console.error(`   ❌ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Final summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 FINAL SUMMARY\n');

  const avgSimilarity = allResults.reduce((sum, r) => sum + r.averageSimilarity, 0) / allResults.length;
  const totalDuplicates = allResults.reduce((sum, r) => sum + r.duplicateCount, 0);
  const excellentCount = allResults.filter(r => r.diversityScore === 'EXCELLENT').length;
  const goodCount = allResults.filter(r => r.diversityScore === 'GOOD').length;
  const needsImprovementCount = allResults.filter(r => r.diversityScore === 'NEEDS_IMPROVEMENT').length;

  console.log(`Tests Run: ${allResults.length}/${TEST_TWEETS.length}`);
  console.log(`Overall Average Similarity: ${(avgSimilarity * 100).toFixed(1)}%`);
  console.log(`Total Duplicate Pairs: ${totalDuplicates}`);
  console.log(`\nScore Distribution:`);
  console.log(`   ✅ EXCELLENT: ${excellentCount}`);
  console.log(`   ⚡ GOOD: ${goodCount}`);
  console.log(`   ⚠️  NEEDS_IMPROVEMENT: ${needsImprovementCount}`);

  console.log('\n' + '='.repeat(80));
  console.log('📝 DETAILED RESULTS BY TEST:\n');

  allResults.forEach((result, index) => {
    console.log(`${index + 1}. ${result.testName} (@${result.author})`);
    console.log(`   Similarity: ${(result.averageSimilarity * 100).toFixed(1)}% | Score: ${result.diversityScore}`);
    
    if (result.duplicateCount > 0) {
      const duplicates = result.similarities.filter((s: any) => s.similarity >= 0.99);
      console.log(`   ⚠️  Duplicates found:`);
      duplicates.forEach((d: any) => {
        console.log(`      - @${d.agent1} vs @${d.agent2} (${(d.similarity * 100).toFixed(1)}% similar)`);
      });
    }

    // Show reply lengths for diversity check
    const lengths = result.results
      .filter((r: any) => r.reply)
      .map((r: any) => r.length);
    if (lengths.length > 0) {
      const minLen = Math.min(...lengths);
      const maxLen = Math.max(...lengths);
      const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      console.log(`   Length range: ${minLen}-${maxLen} chars (avg: ${avgLen.toFixed(0)})`);
    }
    console.log('');
  });

  // Recommendations
  console.log('='.repeat(80));
  console.log('💡 RECOMMENDATIONS:\n');

  if (avgSimilarity < 0.25) {
    console.log('✅ Excellent diversity! The system is working well.');
  } else if (avgSimilarity < 0.35) {
    console.log('⚡ Good diversity, but could be improved.');
  } else {
    console.log('⚠️  Diversity needs improvement. Consider:');
    console.log('   - Adding more entropy to archetype selection');
    console.log('   - Implementing cross-agent anti-repetition');
    console.log('   - Increasing temperature variance');
  }

  if (totalDuplicates > 0) {
    console.log(`\n⚠️  Found ${totalDuplicates} duplicate pair(s). Consider:`);
    console.log('   - Adding user_id to seed calculation');
    console.log('   - Forcing different archetypes for similar cards');
    console.log('   - Adding per-agent style variations');
  }

  console.log('\n' + '='.repeat(80));
}

runComprehensiveTests().catch(console.error);
