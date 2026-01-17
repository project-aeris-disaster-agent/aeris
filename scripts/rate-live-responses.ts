/**
 * Rate the live responses from the edge function test
 */

import { findBannedPhrases, BANNED_PHRASES } from '../supabase/functions/_shared/bannedPhrases.ts';

// Live responses from the edge function test (AFTER FIXES)
const LIVE_RESPONSES = [
  {
    agent: 'newprontera',
    handle: '@newprontera',
    response: '@LordSedano, an Opus vs GPT showdown in @hyperscapeai sounds like the ultimate AI battle! Considering Opus edges out in reasoning tasks while GPT dominates coding speed, it\'d be a close fight.'
  },
  {
    agent: 'ArcherPerezz',
    handle: '@ArcherPerezz',
    response: 'Nah, @LordSedano, an Opus vs. GPT showdown in @hyperscapeai would be pure chaos in the best way!'
  },
  {
    agent: '_langtuNFT',
    handle: '@_langtuNFT',
    response: '@LordSedano, an 8-hour coding session sounds intense! I\'m totally down for seeing Opus and GPT battle it out in @hyperscapeai.'
  },
  {
    agent: 'LordSedano',
    handle: '@LordSedano',
    response: '@LordSedano, that 8-hour coding sesh with @shawmakesmagic sounds intense!'
  },
  {
    agent: 'agent_hellracer',
    handle: '@agent_hellracer',
    response: 'Nah, @LordSedano, an 8-hour coding sesh sounding like a marathon pit stop—insane stamina!'
  }
];

// Baseline from screenshots
const BASELINE_STATS = {
  avgScore: 46.3,
  bannedPhrases: 8,
  genericOpeners: 6, // out of 7
  avgSimilarity: 18.2
};

// Slop patterns
const GENERIC_OPENERS = [
  /^(yo|hey|hi|hello)\s+@/i,
];

const SLOP_PATTERNS = [
  /sounds\s+(intense|insane|wild|crazy)/i,
  /bet\s+(you|that)/i,
  /\b(energy|vibes?)\b/i,
  /props\s+(to|for)/i,
  /wild\s+(stuff|ideas)/i,
];

interface RatingResult {
  agent: string;
  response: string;
  bannedPhrases: string[];
  hasGenericOpener: boolean;
  slopPatternCount: number;
  antiSlopScore: number;
  personalityIndicators: string[];
  grade: string;
}

function rateResponse(agent: string, response: string): RatingResult {
  const bannedPhrases = findBannedPhrases(response);
  const hasGenericOpener = GENERIC_OPENERS.some(p => p.test(response));
  
  let slopPatternCount = 0;
  for (const pattern of SLOP_PATTERNS) {
    if (pattern.test(response.toLowerCase())) {
      slopPatternCount++;
    }
  }
  
  // Calculate score
  let antiSlopScore = 100;
  antiSlopScore -= bannedPhrases.length * 15;
  antiSlopScore -= hasGenericOpener ? 20 : 0;
  antiSlopScore -= slopPatternCount * 10;
  antiSlopScore = Math.max(0, antiSlopScore);
  
  // Personality indicators
  const personalityIndicators: string[] = [];
  if (/^(nah|wait|actually|hmm|counterpoint)/i.test(response)) personalityIndicators.push('unique opener');
  if (/\?$/.test(response.trim())) personalityIndicators.push('ends with question');
  if (/@\w+.*@\w+/.test(response)) personalityIndicators.push('multiple mentions');
  if (/\b(I think|personally|hot take|disagree)\b/i.test(response)) personalityIndicators.push('opinion marker');
  if (/—/.test(response)) personalityIndicators.push('uses em-dash');
  if (/!/.test(response)) personalityIndicators.push('uses exclamation');
  if (/chaos|epic|battle|showdown|trash talk/i.test(response)) personalityIndicators.push('engaging language');
  
  const grade = antiSlopScore >= 80 ? 'A' :
                antiSlopScore >= 60 ? 'B' :
                antiSlopScore >= 40 ? 'C' :
                antiSlopScore >= 20 ? 'D' : 'F';
  
  return {
    agent,
    response,
    bannedPhrases,
    hasGenericOpener,
    slopPatternCount,
    antiSlopScore,
    personalityIndicators,
    grade
  };
}

function calculateSimilarity(r1: string, r2: string): number {
  const words1 = new Set(r1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(r2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

function runRating() {
  console.log('═'.repeat(80));
  console.log('🔬 LIVE RESPONSE RATING');
  console.log('═'.repeat(80));
  console.log();

  const results: RatingResult[] = [];
  
  for (const item of LIVE_RESPONSES) {
    const result = rateResponse(item.agent, item.response);
    results.push(result);
    
    console.log(`   ${result.grade} | ${item.agent} (${item.handle})`);
    console.log(`   ${'─'.repeat(60)}`);
    console.log(`   Response: "${result.response}"`);
    console.log(`   Anti-Slop Score: ${result.antiSlopScore}/100`);
    
    if (result.bannedPhrases.length > 0) {
      console.log(`   ❌ Banned phrases: ${result.bannedPhrases.join(', ')}`);
    }
    if (result.hasGenericOpener) {
      console.log(`   ❌ Generic opener`);
    }
    if (result.personalityIndicators.length > 0) {
      console.log(`   ✅ Personality: ${result.personalityIndicators.join(', ')}`);
    }
    console.log();
  }

  // Calculate similarity
  const similarities: number[] = [];
  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      similarities.push(calculateSimilarity(results[i].response, results[j].response));
    }
  }
  const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length * 100;

  // Summary
  console.log('═'.repeat(80));
  console.log('📊 COMPARISON: LIVE vs BASELINE');
  console.log('═'.repeat(80));
  console.log();

  const avgScore = results.reduce((sum, r) => sum + r.antiSlopScore, 0) / results.length;
  const totalBannedPhrases = results.reduce((sum, r) => sum + r.bannedPhrases.length, 0);
  const genericOpenerCount = results.filter(r => r.hasGenericOpener).length;
  const gradeDistribution = results.reduce((acc, r) => { acc[r.grade] = (acc[r.grade] || 0) + 1; return acc; }, {} as Record<string, number>);

  console.log('   METRIC                 | BASELINE (Screenshots) | LIVE TEST    | STATUS');
  console.log('   ' + '─'.repeat(74));
  console.log(`   Average Score          | ${BASELINE_STATS.avgScore.toFixed(1)}/100              | ${avgScore.toFixed(1)}/100      | ${avgScore > BASELINE_STATS.avgScore ? '✅ IMPROVED' : '❌ WORSE'}`);
  console.log(`   Banned Phrases         | ${BASELINE_STATS.bannedPhrases} total                | ${totalBannedPhrases} total       | ${totalBannedPhrases < BASELINE_STATS.bannedPhrases ? '✅ IMPROVED' : '❌ WORSE'}`);
  console.log(`   Generic Openers        | ${BASELINE_STATS.genericOpeners}/7 (${Math.round(BASELINE_STATS.genericOpeners/7*100)}%)             | ${genericOpenerCount}/${results.length} (${Math.round(genericOpenerCount/results.length*100)}%)      | ${genericOpenerCount/results.length < BASELINE_STATS.genericOpeners/7 ? '✅ IMPROVED' : '❌ WORSE'}`);
  console.log(`   Avg Similarity         | ${BASELINE_STATS.avgSimilarity.toFixed(1)}%                | ${avgSimilarity.toFixed(1)}%       | ${avgSimilarity < BASELINE_STATS.avgSimilarity ? '✅ IMPROVED' : avgSimilarity < 25 ? '⚡ SIMILAR' : '❌ WORSE'}`);
  console.log();
  console.log(`   Grade Distribution: ${Object.entries(gradeDistribution).map(([g, c]) => `${g}:${c}`).join(' | ')}`);
  console.log();

  // Remaining issues
  const issues: string[] = [];
  if (totalBannedPhrases > 0) {
    const phrases = results.flatMap(r => r.bannedPhrases);
    const uniquePhrases = [...new Set(phrases)];
    issues.push(`Still using banned phrases: ${uniquePhrases.join(', ')}`);
  }
  if (genericOpenerCount > 0) {
    issues.push(`${genericOpenerCount} agent(s) still using generic openers`);
  }

  if (issues.length > 0) {
    console.log('   ⚠️  REMAINING ISSUES:');
    for (const issue of issues) {
      console.log(`      • ${issue}`);
    }
    console.log();
  }

  // Overall verdict
  const overallImproved = avgScore > BASELINE_STATS.avgScore && 
                          totalBannedPhrases <= BASELINE_STATS.bannedPhrases &&
                          avgSimilarity <= BASELINE_STATS.avgSimilarity;

  console.log('═'.repeat(80));
  if (overallImproved) {
    console.log('🎉 VERDICT: SYSTEM HAS IMPROVED vs BASELINE');
  } else if (avgScore > BASELINE_STATS.avgScore) {
    console.log('⚡ VERDICT: PARTIAL IMPROVEMENT - Some issues remain');
  } else {
    console.log('❌ VERDICT: NO IMPROVEMENT - System needs more fixes');
  }
  console.log('═'.repeat(80));
}

runRating();
