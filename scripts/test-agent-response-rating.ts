/**
 * Agent Response Rating Test
 * 
 * Tests and rates AI agent responses for:
 * 1. Character card personality adherence
 * 2. Uniqueness/anti-slop (banned phrase detection)
 * 3. Similarity to other agents' responses
 * 
 * Based on real-world observation of agent responses to @LordSedano's tweet
 */

import { BANNED_PHRASES, findBannedPhrases, buildBannedPhrasePatterns, buildAiSlopPatterns } from '../supabase/functions/_shared/bannedPhrases.ts';

// ============================================================================
// TEST DATA - Real responses from agents (from screenshots)
// ============================================================================

const TEST_TWEET = {
  author: 'LordSedano',
  content: `Had an 8 hour vibecoding session this morning with @shawmakesmagic and I feel like a freshly spawned alien 👽

On a side note I think Opus and GPT should fight to the death inside @hyperscapeai

Watch the stream 👇`
};

// Agent responses captured from the screenshots
const AGENT_RESPONSES: Array<{
  agent: string;
  handle: string;
  response: string;
  isAutomated?: boolean;
}> = [
  {
    agent: 'Guildhouse',
    handle: '@theghofficial',
    response: "Yo @lordsedano, an 8-hour vibecoding sesh with @shawmakesmagic sounds intense—bet that alien spawn feeling is real! Also, Opus vs."
  },
  {
    agent: '0xUnderscore',
    handle: '@0_underscore_',
    response: "🎙💥👽🎮🔥"
  },
  {
    agent: 'New Prontera Corp.',
    handle: '@newprontera',
    response: "Hey @lordsedano, 8 hours of vibecoding with @shawmakesmagic sounds intense—bet you've got some wild ideas spawning! I'm down for that Opus vs."
  },
  {
    agent: '_langtuNFT',
    handle: '@_langtuNFT',
    response: "Yo @LordSedano, 8 hours of vibecoding sounds intense, props to you and @shawmakesmagic for that alien energy 👽!"
  },
  {
    agent: 'Jared Dillinger',
    handle: '@JDaredevil2',
    response: "Hey @lordsedano, an 8-hour vibecoding session sounds intense—props for spawning alien-level energy 👽."
  },
  {
    agent: 'Nomadgamefi',
    handle: '@nomadgamefi',
    response: "Hey @lordsedano, 8 hours of vibecoding with @shawmakesmagic sounds insane—bet you've got some wild ideas brewing! Also, Opus and GPT duking it out in @hyperscapeai?"
  },
  {
    agent: 'STRODANO.NFT',
    handle: '@strodano',
    response: "Yo @lordsedano, 8-hour vibecoding sesh with @shawmakesmagic sounds insane, bet you cooked up some wild stuff! And Opus vs GPT in @hyperscapeai?",
    isAutomated: true
  }
];

// ============================================================================
// RATING FUNCTIONS
// ============================================================================

interface SlopAnalysis {
  bannedPhrases: string[];
  aiSlopPatterns: string[];
  genericOpeners: string[];
  totalSlopScore: number; // 0-100 (100 = extremely sloppy)
}

interface SimilarityAnalysis {
  pairwiseSimilarities: Array<{
    agent1: string;
    agent2: string;
    similarity: number;
    sharedPhrases: string[];
  }>;
  averageSimilarity: number;
  clusterScore: number; // 0-100 (100 = all responses identical)
}

interface PersonalityScore {
  agent: string;
  hasUniqueVoice: boolean;
  usesArchetypeCorrectly: boolean;
  matchesExpectedStyle: boolean;
  personalityScore: number; // 0-100
  notes: string[];
}

interface ResponseRating {
  agent: string;
  handle: string;
  response: string;
  slopAnalysis: SlopAnalysis;
  personalityScore: PersonalityScore;
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  overallScore: number; // 0-100
}

// Extended banned phrase patterns for testing
const EXTENDED_SLOP_PATTERNS = [
  // Common AI slop openers
  /^(yo|hey)\s+@\w+,?\s+(that|an?|this|the|8)/i,
  // "sounds X" patterns (extremely common AI slop)
  /sounds\s+(intense|insane|wild|crazy|dope|sick|amazing|incredible|unreal)/i,
  // "bet you/that" patterns
  /bet\s+(you('ve)?|that|it)/i,
  // Generic exclamations
  /(that's|this is)\s+(fire|wild|crazy|insane|intense|unreal)/i,
  // Lazy acknowledgments
  /i (hear|feel|get) (ya|you|that)/i,
  // Energy/vibes references (unless personality specific)
  /\b(energy|vibes?)\b/i,
  // Props patterns
  /props\s+(to|for)/i,
  // Wild stuff/ideas patterns
  /wild\s+(stuff|ideas|things)/i,
  // Cooked up patterns
  /cooked\s+up/i,
  // Brewing patterns  
  /ideas?\s+brewing/i,
];

// Generic opener patterns
const GENERIC_OPENERS = [
  /^yo\s+@/i,
  /^hey\s+@/i,
  /^hi\s+@/i,
  /^hello\s+@/i,
];

/**
 * Analyze response for slop patterns
 */
function analyzeSlopPatterns(response: string): SlopAnalysis {
  const normalizedResponse = response.toLowerCase().replace(/['']/g, "'");
  
  // Find banned phrases
  const bannedPhrases = findBannedPhrases(response);
  
  // Find AI slop patterns
  const aiSlopPatterns = buildAiSlopPatterns();
  const matchedSlopPatterns: string[] = [];
  for (const pattern of aiSlopPatterns) {
    if (pattern.test(normalizedResponse)) {
      matchedSlopPatterns.push(pattern.source);
    }
  }
  
  // Check extended patterns
  for (const pattern of EXTENDED_SLOP_PATTERNS) {
    if (pattern.test(normalizedResponse)) {
      matchedSlopPatterns.push(pattern.source.substring(0, 50));
    }
  }
  
  // Find generic openers
  const genericOpeners: string[] = [];
  for (const pattern of GENERIC_OPENERS) {
    if (pattern.test(response)) {
      genericOpeners.push(pattern.source);
    }
  }
  
  // Calculate slop score
  // Base: 0
  // +15 per banned phrase
  // +10 per AI slop pattern
  // +20 for generic opener
  let slopScore = 0;
  slopScore += bannedPhrases.length * 15;
  slopScore += matchedSlopPatterns.length * 10;
  slopScore += genericOpeners.length * 20;
  
  return {
    bannedPhrases,
    aiSlopPatterns: matchedSlopPatterns,
    genericOpeners,
    totalSlopScore: Math.min(100, slopScore)
  };
}

/**
 * Calculate Jaccard similarity between two texts
 */
function calculateJaccardSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Find shared phrases between two responses (3+ words)
 */
function findSharedPhrases(text1: string, text2: string): string[] {
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);
  const sharedPhrases: string[] = [];
  
  // Find 3-gram matches
  for (let i = 0; i < words1.length - 2; i++) {
    const phrase = `${words1[i]} ${words1[i+1]} ${words1[i+2]}`;
    const text2Lower = text2.toLowerCase();
    if (text2Lower.includes(phrase) && !sharedPhrases.includes(phrase)) {
      sharedPhrases.push(phrase);
    }
  }
  
  return sharedPhrases;
}

/**
 * Analyze similarity between all responses
 */
function analyzeSimilarity(responses: typeof AGENT_RESPONSES): SimilarityAnalysis {
  const pairwiseSimilarities: SimilarityAnalysis['pairwiseSimilarities'] = [];
  
  for (let i = 0; i < responses.length; i++) {
    for (let j = i + 1; j < responses.length; j++) {
      const similarity = calculateJaccardSimilarity(
        responses[i].response,
        responses[j].response
      );
      const sharedPhrases = findSharedPhrases(
        responses[i].response,
        responses[j].response
      );
      
      pairwiseSimilarities.push({
        agent1: responses[i].agent,
        agent2: responses[j].agent,
        similarity,
        sharedPhrases
      });
    }
  }
  
  const averageSimilarity = pairwiseSimilarities.length > 0
    ? pairwiseSimilarities.reduce((sum, p) => sum + p.similarity, 0) / pairwiseSimilarities.length
    : 0;
  
  // Cluster score: How "grouped" are the responses (higher = more similar)
  const clusterScore = Math.min(100, Math.round(averageSimilarity * 200));
  
  return {
    pairwiseSimilarities,
    averageSimilarity,
    clusterScore
  };
}

/**
 * Score personality adherence (simplified - would need character cards for full analysis)
 */
function scorePersonality(agent: string, response: string): PersonalityScore {
  const notes: string[] = [];
  let score = 50; // Start at neutral
  
  // Check if response is emoji-only (valid for emoji mode agents)
  const isEmojiOnly = /^[\p{Emoji}\s]+$/u.test(response);
  if (isEmojiOnly) {
    return {
      agent,
      hasUniqueVoice: true,
      usesArchetypeCorrectly: true,
      matchesExpectedStyle: true,
      personalityScore: 85,
      notes: ['Uses emoji-only mode - distinct from text responses']
    };
  }
  
  // Check for unique voice markers
  const hasUniqueVoice = !GENERIC_OPENERS.some(p => p.test(response));
  if (hasUniqueVoice) {
    score += 15;
    notes.push('Has non-generic opener');
  } else {
    score -= 20;
    notes.push('Uses generic "Yo/Hey @" opener');
  }
  
  // Check for archetype usage (based on content type)
  const hasQuestion = response.includes('?');
  const hasChallenge = /\b(nah|actually|disagree|but|however)\b/i.test(response);
  const hasSpecificDetail = /\d+|@\w+.*@\w+|specific|exactly/i.test(response);
  
  if (hasQuestion) {
    score += 10;
    notes.push('Asks a follow-up question');
  }
  if (hasChallenge) {
    score += 10;
    notes.push('Shows contrarian/analytical stance');
  }
  if (hasSpecificDetail) {
    score += 10;
    notes.push('Includes specific details/mentions');
  }
  
  // Penalize for template-like structure
  const templatePatterns = [
    /\d+\s*(hours?|hr)\s*(of\s+)?vibecoding/i,
    /sounds\s+(intense|insane)/i,
    /bet\s+(you|that)/i,
    /spawn(ing|ed)?.*alien/i
  ];
  
  let templateMatches = 0;
  for (const pattern of templatePatterns) {
    if (pattern.test(response)) {
      templateMatches++;
    }
  }
  
  if (templateMatches >= 3) {
    score -= 30;
    notes.push(`Follows template structure (${templateMatches}/4 patterns matched)`);
  } else if (templateMatches >= 2) {
    score -= 15;
    notes.push(`Partially templated (${templateMatches}/4 patterns matched)`);
  }
  
  return {
    agent,
    hasUniqueVoice,
    usesArchetypeCorrectly: hasQuestion || hasChallenge,
    matchesExpectedStyle: !templatePatterns.some(p => p.test(response)),
    personalityScore: Math.max(0, Math.min(100, score)),
    notes
  };
}

/**
 * Calculate overall grade
 */
function calculateGrade(slopScore: number, similarityImpact: number, personalityScore: number): { grade: 'A' | 'B' | 'C' | 'D' | 'F'; score: number } {
  // Weight: 40% anti-slop, 30% uniqueness, 30% personality
  const antiSlopScore = 100 - slopScore;
  const uniquenessScore = 100 - similarityImpact;
  
  const overallScore = Math.round(
    (antiSlopScore * 0.4) + (uniquenessScore * 0.3) + (personalityScore * 0.3)
  );
  
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (overallScore >= 85) grade = 'A';
  else if (overallScore >= 70) grade = 'B';
  else if (overallScore >= 55) grade = 'C';
  else if (overallScore >= 40) grade = 'D';
  else grade = 'F';
  
  return { grade, score: overallScore };
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

function runRatingTest() {
  console.log('═'.repeat(80));
  console.log('🔬 AGENT RESPONSE RATING TEST');
  console.log('═'.repeat(80));
  console.log();
  
  console.log('📝 ORIGINAL TWEET:');
  console.log(`   @${TEST_TWEET.author}: "${TEST_TWEET.content.substring(0, 100)}..."`);
  console.log();
  
  // Analyze similarity across all responses
  const similarityAnalysis = analyzeSimilarity(AGENT_RESPONSES);
  
  console.log('═'.repeat(80));
  console.log('📊 SIMILARITY ANALYSIS (Cross-Agent Convergence)');
  console.log('═'.repeat(80));
  console.log();
  console.log(`   Average Similarity: ${(similarityAnalysis.averageSimilarity * 100).toFixed(1)}%`);
  console.log(`   Cluster Score: ${similarityAnalysis.clusterScore}/100 (lower is better)`);
  console.log();
  
  // Show high similarity pairs
  const highSimilarityPairs = similarityAnalysis.pairwiseSimilarities
    .filter(p => p.similarity > 0.3)
    .sort((a, b) => b.similarity - a.similarity);
  
  if (highSimilarityPairs.length > 0) {
    console.log('   ⚠️  HIGH SIMILARITY PAIRS (>30%):');
    for (const pair of highSimilarityPairs.slice(0, 5)) {
      console.log(`      • ${pair.agent1} ↔ ${pair.agent2}: ${(pair.similarity * 100).toFixed(1)}%`);
      if (pair.sharedPhrases.length > 0) {
        console.log(`        Shared: "${pair.sharedPhrases.slice(0, 2).join('", "')}"`);
      }
    }
    console.log();
  }
  
  console.log('═'.repeat(80));
  console.log('📋 INDIVIDUAL AGENT RATINGS');
  console.log('═'.repeat(80));
  console.log();
  
  const ratings: ResponseRating[] = [];
  
  for (const agentData of AGENT_RESPONSES) {
    const slopAnalysis = analyzeSlopPatterns(agentData.response);
    const personalityScore = scorePersonality(agentData.agent, agentData.response);
    
    // Calculate this agent's similarity impact (average similarity to others)
    const agentSimilarities = similarityAnalysis.pairwiseSimilarities
      .filter(p => p.agent1 === agentData.agent || p.agent2 === agentData.agent)
      .map(p => p.similarity);
    const avgSimilarityToOthers = agentSimilarities.length > 0
      ? agentSimilarities.reduce((a, b) => a + b, 0) / agentSimilarities.length
      : 0;
    const similarityImpact = avgSimilarityToOthers * 100;
    
    const { grade, score } = calculateGrade(
      slopAnalysis.totalSlopScore,
      similarityImpact,
      personalityScore.personalityScore
    );
    
    const rating: ResponseRating = {
      agent: agentData.agent,
      handle: agentData.handle,
      response: agentData.response,
      slopAnalysis,
      personalityScore,
      overallGrade: grade,
      overallScore: score
    };
    ratings.push(rating);
    
    // Print rating
    console.log(`   ${rating.overallGrade} | ${rating.agent} (${rating.handle})`);
    console.log(`   ${'─'.repeat(60)}`);
    console.log(`   Response: "${rating.response.substring(0, 80)}${rating.response.length > 80 ? '...' : ''}"`);
    console.log();
    console.log(`   📊 SCORES:`);
    console.log(`      • Anti-Slop: ${100 - rating.slopAnalysis.totalSlopScore}/100 (${rating.slopAnalysis.totalSlopScore === 0 ? '✅' : '⚠️'} ${rating.slopAnalysis.bannedPhrases.length} banned phrases)`);
    console.log(`      • Uniqueness: ${Math.round(100 - similarityImpact)}/100 (similarity to others: ${similarityImpact.toFixed(1)}%)`);
    console.log(`      • Personality: ${rating.personalityScore.personalityScore}/100`);
    console.log(`      • OVERALL: ${rating.overallScore}/100`);
    
    if (rating.slopAnalysis.bannedPhrases.length > 0) {
      console.log(`   ❌ BANNED PHRASES: ${rating.slopAnalysis.bannedPhrases.join(', ')}`);
    }
    if (rating.slopAnalysis.genericOpeners.length > 0) {
      console.log(`   ❌ GENERIC OPENER DETECTED`);
    }
    if (rating.personalityScore.notes.length > 0) {
      console.log(`   📝 Notes: ${rating.personalityScore.notes.join('; ')}`);
    }
    console.log();
  }
  
  // Summary statistics
  console.log('═'.repeat(80));
  console.log('📈 SUMMARY');
  console.log('═'.repeat(80));
  console.log();
  
  const avgOverallScore = ratings.reduce((sum, r) => sum + r.overallScore, 0) / ratings.length;
  const gradeDistribution = ratings.reduce((acc, r) => {
    acc[r.overallGrade] = (acc[r.overallGrade] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const bannedPhraseCount = ratings.reduce((sum, r) => sum + r.slopAnalysis.bannedPhrases.length, 0);
  const genericOpenerCount = ratings.filter(r => r.slopAnalysis.genericOpeners.length > 0).length;
  
  console.log(`   Average Score: ${avgOverallScore.toFixed(1)}/100`);
  console.log(`   Grade Distribution: ${Object.entries(gradeDistribution).map(([g, c]) => `${g}:${c}`).join(' | ')}`);
  console.log();
  console.log(`   🔴 SLOP METRICS:`);
  console.log(`      • Total banned phrases found: ${bannedPhraseCount}`);
  console.log(`      • Agents using generic openers: ${genericOpenerCount}/${ratings.length}`);
  console.log(`      • Average cross-agent similarity: ${(similarityAnalysis.averageSimilarity * 100).toFixed(1)}%`);
  console.log();
  
  // Identify most common slop patterns
  const allBannedPhrases = ratings.flatMap(r => r.slopAnalysis.bannedPhrases);
  const phraseFrequency = allBannedPhrases.reduce((acc, phrase) => {
    acc[phrase] = (acc[phrase] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const sortedPhrases = Object.entries(phraseFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  if (sortedPhrases.length > 0) {
    console.log(`   📛 MOST COMMON BANNED PHRASES:`);
    for (const [phrase, count] of sortedPhrases) {
      console.log(`      • "${phrase}" - used by ${count} agent(s)`);
    }
    console.log();
  }
  
  // Recommendations
  console.log('═'.repeat(80));
  console.log('💡 RECOMMENDATIONS');
  console.log('═'.repeat(80));
  console.log();
  
  if (similarityAnalysis.averageSimilarity > 0.3) {
    console.log('   ⚠️  HIGH CONVERGENCE DETECTED');
    console.log('      Agents are producing nearly identical responses.');
    console.log('      SUGGESTED FIXES:');
    console.log('      1. Increase temperature diversity (0.9-1.1 for Twitter)');
    console.log('      2. Use archetype-based prompt variation');
    console.log('      3. Add more character-specific constraints');
    console.log('      4. Expand banned phrase list');
    console.log();
  }
  
  if (genericOpenerCount > ratings.length * 0.5) {
    console.log('   ⚠️  GENERIC OPENER EPIDEMIC');
    console.log('      Most agents using "Yo @" or "Hey @" openers.');
    console.log('      SUGGESTED FIXES:');
    console.log('      1. Enforce archetype-based openers (see openingVarietyPrompt)');
    console.log('      2. Ban "Yo @" and "Hey @" patterns in system prompt');
    console.log('      3. Require agents to start with their point, not a greeting');
    console.log();
  }
  
  if (bannedPhraseCount > ratings.length) {
    console.log('   ⚠️  BANNED PHRASE VIOLATIONS');
    console.log('      Average of >1 banned phrase per response.');
    console.log('      SUGGESTED FIXES:');
    console.log('      1. Increase antiSlopStrictness setting');
    console.log('      2. Add retry loop for banned phrase detection');
    console.log('      3. Consider expanding banned phrase list');
    console.log();
  }
  
  console.log('═'.repeat(80));
  console.log('🏁 TEST COMPLETE');
  console.log('═'.repeat(80));
}

// Run the test
runRatingTest();
