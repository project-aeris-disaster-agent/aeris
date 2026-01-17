/**
 * Test Production Replies
 * 
 * Tests the deployed edge functions with real tweet scenarios
 * Uses the test-agent-diversity function to generate and rate replies
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wqwhlbmsafgjlsjujuel.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

// Test tweets to verify our fixes work across different scenarios
const TEST_SCENARIOS = [
  {
    name: 'Hot Take',
    tweet: 'Hot take: Web3 gaming will never go mainstream until they stop making everything about tokens and just focus on fun gameplay.',
    author: 'cryptodev',
    expectedBehavior: 'Should trigger contrarian archetype, avoid generic "I hear ya" responses'
  },
  {
    name: 'Question/Inspiration',
    tweet: 'What are the most underrated AI tools you\'ve been using lately? Looking for hidden gems 💎',
    author: 'techbuilder',
    expectedBehavior: 'Should trigger conversational archetype, provide specific recommendations'
  },
  {
    name: 'Announcement',
    tweet: 'Just shipped a major update to our AI agent framework! Now with 50% faster response times and better memory management. Check it out 🚀',
    author: 'aidev',
    expectedBehavior: 'Should trigger analytical or enthusiastic response, not generic praise'
  },
  {
    name: 'Provocative Statement',
    tweet: 'GPT is dead. Claude is the future. Change my mind.',
    author: 'aimaxi',
    expectedBehavior: 'Should trigger contrarian archetype, take a stance'
  }
];

// Banned phrases to check
const BANNED_PHRASES = [
  'sounds intense',
  'sounds insane',
  'sounds wild',
  'sounds crazy',
  'bet you',
  'bet that',
  'i hear ya',
  'i hear you',
  'props to',
  'props for',
  'wild ideas',
  'wild stuff',
  'cooked up',
  'chaos',
  'pure chaos',
  'is huge',
  'is epic',
  'game-changer',
  'next level',
  'energy',
  'vibes',
];

const GENERIC_OPENERS = [
  /^yo\s+@/i,
  /^hey\s+@/i,
  /^hi\s+@/i,
];

interface TestResult {
  scenario: string;
  tweet: string;
  responses: Array<{
    agent: string;
    reply: string;
    bannedPhrases: string[];
    hasGenericOpener: boolean;
    score: number;
  }>;
  avgSimilarity: number;
  avgScore: number;
  passed: boolean;
}

function findBannedPhrases(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_PHRASES.filter(phrase => lower.includes(phrase));
}

function hasGenericOpener(text: string): boolean {
  return GENERIC_OPENERS.some(p => p.test(text));
}

function calculateSimilarity(r1: string, r2: string): number {
  const words1 = new Set(r1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(r2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

async function testScenario(scenario: typeof TEST_SCENARIOS[0]): Promise<TestResult> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/test-agent-diversity`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      testTweet: scenario.tweet,
      targetUsername: scenario.author
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to test scenario: ${response.status}`);
  }

  const data = await response.json();
  
  const ratedResponses = data.results
    .filter((r: any) => r.reply && !r.error)
    .map((r: any) => {
      const banned = findBannedPhrases(r.reply);
      const genericOpener = hasGenericOpener(r.reply);
      
      // Calculate score (100 base, minus penalties)
      let score = 100;
      score -= banned.length * 15;
      score -= genericOpener ? 20 : 0;
      score = Math.max(0, score);
      
      return {
        agent: r.name,
        reply: r.reply,
        bannedPhrases: banned,
        hasGenericOpener: genericOpener,
        score
      };
    });

  const avgScore = ratedResponses.reduce((sum: number, r: any) => sum + r.score, 0) / ratedResponses.length;
  
  // Calculate avg similarity between all responses
  const similarities: number[] = [];
  for (let i = 0; i < ratedResponses.length; i++) {
    for (let j = i + 1; j < ratedResponses.length; j++) {
      similarities.push(calculateSimilarity(ratedResponses[i].reply, ratedResponses[j].reply));
    }
  }
  const avgSimilarity = similarities.length > 0 
    ? similarities.reduce((a, b) => a + b, 0) / similarities.length * 100
    : 0;

  // Pass criteria: avg score > 70, avg similarity < 25%, no more than 2 banned phrases total
  const totalBannedPhrases = ratedResponses.reduce((sum: number, r: any) => sum + r.bannedPhrases.length, 0);
  const passed = avgScore >= 70 && avgSimilarity < 25 && totalBannedPhrases <= 2;

  return {
    scenario: scenario.name,
    tweet: scenario.tweet,
    responses: ratedResponses,
    avgSimilarity,
    avgScore,
    passed
  };
}

async function main() {
  if (!SUPABASE_ANON_KEY) {
    console.error('❌ VITE_SUPABASE_ANON_KEY not set');
    process.exit(1);
  }

  console.log('═'.repeat(80));
  console.log('🧪 PRODUCTION REPLY TEST');
  console.log('═'.repeat(80));
  console.log();
  console.log('Testing deployed edge functions with multiple tweet scenarios...');
  console.log();

  const results: TestResult[] = [];

  for (const scenario of TEST_SCENARIOS) {
    console.log(`📝 Testing: ${scenario.name}`);
    console.log(`   Tweet: "${scenario.tweet.substring(0, 60)}..."`);
    console.log(`   From: @${scenario.author}`);
    console.log('   ⏳ Generating responses...');
    
    try {
      const result = await testScenario(scenario);
      results.push(result);
      
      console.log(`   ${result.passed ? '✅' : '⚠️'} Score: ${result.avgScore.toFixed(1)}/100 | Similarity: ${result.avgSimilarity.toFixed(1)}%`);
      
      // Show sample responses
      console.log('   Sample responses:');
      for (const r of result.responses.slice(0, 3)) {
        const status = r.score >= 80 ? '✅' : r.score >= 60 ? '⚡' : '❌';
        console.log(`     ${status} @${r.agent}: "${r.reply.substring(0, 70)}..."`);
        if (r.bannedPhrases.length > 0) {
          console.log(`        ⚠️ Banned: ${r.bannedPhrases.join(', ')}`);
        }
      }
      console.log();
      
    } catch (error) {
      console.log(`   ❌ Error: ${error}`);
      console.log();
    }

    // Delay between scenarios
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Summary
  console.log('═'.repeat(80));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(80));
  console.log();

  const passed = results.filter(r => r.passed).length;
  const avgOverallScore = results.reduce((sum, r) => sum + r.avgScore, 0) / results.length;
  const avgOverallSimilarity = results.reduce((sum, r) => sum + r.avgSimilarity, 0) / results.length;
  
  console.log(`   Scenarios Passed: ${passed}/${results.length}`);
  console.log(`   Average Score: ${avgOverallScore.toFixed(1)}/100`);
  console.log(`   Average Similarity: ${avgOverallSimilarity.toFixed(1)}%`);
  console.log();

  // Per-scenario breakdown
  console.log('   PER-SCENARIO RESULTS:');
  for (const result of results) {
    const emoji = result.passed ? '✅' : '⚠️';
    console.log(`   ${emoji} ${result.scenario}: ${result.avgScore.toFixed(1)}/100 (${result.avgSimilarity.toFixed(1)}% similarity)`);
  }
  console.log();

  // Overall verdict
  console.log('═'.repeat(80));
  if (passed === results.length) {
    console.log('🎉 ALL SCENARIOS PASSED - Production system is working well!');
  } else if (passed >= results.length * 0.75) {
    console.log('⚡ MOSTLY PASSING - Some edge cases need attention');
  } else {
    console.log('⚠️ NEEDS IMPROVEMENT - Multiple scenarios failing');
  }
  console.log('═'.repeat(80));
}

main().catch(console.error);
