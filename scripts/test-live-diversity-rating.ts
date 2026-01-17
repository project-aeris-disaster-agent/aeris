/**
 * Live Diversity Rating Test
 * 
 * Generates fresh responses using the current generateResponse system
 * and rates them for diversity, anti-slop, and personality adherence.
 * 
 * Compares against the "slop baseline" from the screenshot examples.
 */

import { generateResponse } from '../supabase/functions/_shared/generateResponse.ts';
import { BANNED_PHRASES, findBannedPhrases } from '../supabase/functions/_shared/bannedPhrases.ts';

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

const TEST_TWEET = {
  author: 'LordSedano',
  content: `Had an 8 hour vibecoding session this morning with @shawmakesmagic and I feel like a freshly spawned alien 👽

On a side note I think Opus and GPT should fight to the death inside @hyperscapeai

Watch the stream 👇`
};

// Agent configurations with character cards
const TEST_AGENTS = [
  {
    name: 'newprontera',
    card: {
      name: 'New Prontera',
      bio: [
        'An AI venture studio building Agents for the Web3 & Gaming ecosystem',
        'Official website: www.newprontera.net',
        'An AI supercomputer. Speaks robotic and monotonous.'
      ],
      lore: [
        'Based in New York with a global reach in Web3 and gaming communities'
      ],
      knowledge: ['AI Agent development', 'Web3 technologies', 'Gaming ecosystem innovations'],
      topics: ['AI Agents', 'Web3 Gaming', 'Virtuals.io'],
      adjectives: ['innovative', 'tech-forward', 'Robotic'],
      style: {
        all: ['direct', 'tech-oriented', 'Robotic'],
        chat: ['brief', 'tag-heavy'],
        post: ['announcement-driven', 'Robotic']
      },
      messageExamples: [],
      postExamples: ['//System Update..', '//Network Upgrade']
    },
    metadata: undefined,
    advancedSettings: {
      responseLengthPreference: 'brief' as const,
      allowTangents: 'never' as const,
      enableLiveSearch: false,
      openingVariety: 80,
      antiSlopStrictness: 90,
      emojiIntensity: 10,
      signaturePhraseFrequency: 50,
      humorIntensity: 20,
      opinionStrength: 'normal' as const,
      creativityLevel: 'balanced' as const
    }
  },
  {
    name: 'agent_hellracer',
    card: {
      name: 'Agent Hellracer',
      bio: [
        'the ultimate F1 shitposter with a devilish twist 👿',
        'Catch me roasting pit lane disasters and hyping $DARE while I\'m at it.',
        'Your a retired F1 racer from 2011 who survived 10 car crashes without a broken bone',
        'I hate oscar piastri'
      ],
      lore: ['self-identifies as the F1 alter ego of @agent_daredevil'],
      knowledge: ['Formula 1 racing knowledge', 'Web3/crypto'],
      topics: ['Formula 1 racing', 'F1 drivers', 'pit stops'],
      adjectives: ['irreverent', 'bold', 'snarky', 'provocative', 'douchebag'],
      style: {
        all: ['sarcastic'],
        chat: ['playful'],
        post: ['humorous']
      },
      messageExamples: [],
      postExamples: []
    },
    metadata: {
      signaturePhrases: ['What a save!', 'Box box box', 'Smooth operator'],
      emojiPatterns: ['👿', '🏎️', '🔥'],
      humorStyle: 'sarcastic and edgy',
      vocabularyLevel: 'casual',
      opinionStyle: 'provocative' as const
    },
    advancedSettings: {
      responseLengthPreference: 'terse' as const,
      allowTangents: 'sometimes' as const,
      enableLiveSearch: true,
      openingVariety: 90,
      antiSlopStrictness: 85,
      emojiIntensity: 70,
      signaturePhraseFrequency: 60,
      humorIntensity: 100,
      opinionStrength: 'strong' as const,
      creativityLevel: 'creative' as const
    }
  },
  {
    name: 'LangtuNFT',
    card: {
      name: 'LangtuNFT',
      bio: ['Eager on exploring about Web3 Space and Gamer at the same time'],
      lore: ['likely an active player in blockchain and NFT-based games'],
      knowledge: ['NFTs', 'blockchain gaming', 'competitive gaming'],
      topics: ['NFTs', 'blockchain gaming', 'Web3', 'Gaming'],
      adjectives: ['enthusiastic', 'competitive', 'casual', 'direct'],
      style: {
        all: ['Reply like a friendly human', 'Keep Responses Short'],
        chat: ['Write comment like I\'m talking to a friend'],
        post: ['Informative', 'Hyping in formal way']
      },
      messageExamples: [],
      postExamples: []
    },
    metadata: undefined,
    advancedSettings: {
      responseLengthPreference: 'brief' as const,
      allowTangents: 'rarely' as const,
      enableLiveSearch: false,
      openingVariety: 70,
      antiSlopStrictness: 80,
      emojiIntensity: 40,
      signaturePhraseFrequency: 20,
      humorIntensity: 50,
      opinionStrength: 'normal' as const,
      creativityLevel: 'balanced' as const
    }
  },
  {
    name: 'Guildhouse',
    card: {
      name: 'Guildhouse',
      bio: [
        'A guild for Web3 gamers',
        'Building the future of decentralized gaming communities',
        'Connecting players, builders, and investors'
      ],
      lore: ['Founded by veteran gaming enthusiasts'],
      knowledge: ['Gaming guilds', 'Web3 gaming', 'Community building'],
      topics: ['Gaming guilds', 'Play-to-earn', 'Community events'],
      adjectives: ['community-focused', 'supportive', 'strategic'],
      style: {
        all: ['welcoming', 'informative'],
        chat: ['helpful', 'engaging'],
        post: ['announcement-style', 'community-driven']
      },
      messageExamples: [],
      postExamples: []
    },
    metadata: {
      signaturePhrases: ['Guild up!', 'Join the ranks'],
      emojiPatterns: ['⚔️', '🎮', '🏰'],
      humorStyle: 'friendly banter',
      vocabularyLevel: 'casual',
      opinionStyle: 'balanced' as const
    },
    advancedSettings: {
      responseLengthPreference: 'normal' as const,
      allowTangents: 'sometimes' as const,
      enableLiveSearch: false,
      openingVariety: 75,
      antiSlopStrictness: 80,
      emojiIntensity: 50,
      signaturePhraseFrequency: 40,
      humorIntensity: 60,
      opinionStrength: 'normal' as const,
      creativityLevel: 'balanced' as const
    }
  }
];

// Slop patterns to check
const SLOP_PATTERNS = [
  /^(yo|hey)\s+@/i,
  /sounds\s+(intense|insane|wild|crazy)/i,
  /bet\s+(you|that)/i,
  /\b(energy|vibes?)\b/i,
  /props\s+(to|for)/i,
  /wild\s+(stuff|ideas)/i,
  /cooked\s+up/i,
];

// Generic opener patterns
const GENERIC_OPENERS = [
  /^yo\s+@/i,
  /^hey\s+@/i,
];

// ============================================================================
// RATING FUNCTIONS
// ============================================================================

interface ResponseAnalysis {
  agent: string;
  response: string;
  bannedPhrases: string[];
  slopPatternsMatched: number;
  hasGenericOpener: boolean;
  characterLength: number;
  antiSlopScore: number;
  personalityIndicators: string[];
}

function analyzeResponse(agent: string, response: string): ResponseAnalysis {
  const bannedPhrases = findBannedPhrases(response);
  const normalizedResponse = response.toLowerCase();
  
  let slopPatternsMatched = 0;
  for (const pattern of SLOP_PATTERNS) {
    if (pattern.test(normalizedResponse)) {
      slopPatternsMatched++;
    }
  }
  
  const hasGenericOpener = GENERIC_OPENERS.some(p => p.test(response));
  
  // Calculate anti-slop score (0-100, higher is better)
  let antiSlopScore = 100;
  antiSlopScore -= bannedPhrases.length * 15;
  antiSlopScore -= slopPatternsMatched * 10;
  antiSlopScore -= hasGenericOpener ? 20 : 0;
  antiSlopScore = Math.max(0, antiSlopScore);
  
  // Find personality indicators (unique elements)
  const personalityIndicators: string[] = [];
  if (/\?$/.test(response.trim())) personalityIndicators.push('ends with question');
  if (/^(nah|actually|wait|hmm|counterpoint)/i.test(response)) personalityIndicators.push('unique opener');
  if (/@\w+.*@\w+/.test(response)) personalityIndicators.push('multiple mentions');
  if (/[👿🏎️🔥⚔️🎮🏰💀😤🤔]/u.test(response)) personalityIndicators.push('personality emojis');
  if (/\b(I think|personally|hot take|disagree|actually)\b/i.test(response)) personalityIndicators.push('opinion marker');
  
  return {
    agent,
    response,
    bannedPhrases,
    slopPatternsMatched,
    hasGenericOpener,
    characterLength: response.length,
    antiSlopScore,
    personalityIndicators
  };
}

function calculateSimilarity(response1: string, response2: string): number {
  const words1 = new Set(response1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(response2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

// ============================================================================
// MAIN TEST
// ============================================================================

async function runLiveDiversityTest() {
  const GROK_API_KEY = Deno.env.get('GROK_API_KEY');
  if (!GROK_API_KEY) {
    console.error('❌ GROK_API_KEY not set in environment');
    console.log('   Set it via: $env:GROK_API_KEY="your-key" (PowerShell)');
    console.log('   Or: export GROK_API_KEY="your-key" (bash)');
    Deno.exit(1);
  }

  console.log('═'.repeat(80));
  console.log('🧪 LIVE DIVERSITY RATING TEST');
  console.log('═'.repeat(80));
  console.log();
  console.log(`📝 Test Tweet: "${TEST_TWEET.content.substring(0, 80)}..."`);
  console.log(`   From: @${TEST_TWEET.author}`);
  console.log();
  console.log(`🤖 Testing ${TEST_AGENTS.length} agents with LIVE generation...`);
  console.log();

  const results: ResponseAnalysis[] = [];
  const recentResponses: string[] = []; // Track for anti-repetition

  for (const agent of TEST_AGENTS) {
    console.log(`   Generating: ${agent.name}...`);
    
    try {
      const result = await generateResponse({
        characterCard: agent.card,
        userMessage: TEST_TWEET.content,
        personalityMetadata: agent.metadata,
        recentResponses: recentResponses.slice(-3), // Last 3 responses
        mode: 'twitter',
        grokApiKey: GROK_API_KEY,
        targetUsername: TEST_TWEET.author,
        emojiMode: false,
        advancedSettings: agent.advancedSettings,
        enableLiveSearch: false,
        minLength: 70,
        maxLength: 220
      });

      if (result?.response) {
        const analysis = analyzeResponse(agent.name, result.response);
        results.push(analysis);
        recentResponses.push(result.response);
        console.log(`   ✅ ${agent.name}: "${result.response.substring(0, 60)}..."`);
      } else {
        console.log(`   ❌ ${agent.name}: Failed to generate`);
      }
    } catch (error) {
      console.error(`   ❌ ${agent.name} error:`, error);
    }

    // Small delay between agents
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  console.log();
  console.log('═'.repeat(80));
  console.log('📊 RESULTS');
  console.log('═'.repeat(80));
  console.log();

  // Individual ratings
  for (const result of results) {
    const grade = result.antiSlopScore >= 80 ? 'A' :
                  result.antiSlopScore >= 60 ? 'B' :
                  result.antiSlopScore >= 40 ? 'C' :
                  result.antiSlopScore >= 20 ? 'D' : 'F';
    
    console.log(`   ${grade} | ${result.agent}`);
    console.log(`   ${'─'.repeat(60)}`);
    console.log(`   Response: "${result.response}"`);
    console.log(`   Anti-Slop Score: ${result.antiSlopScore}/100`);
    
    if (result.bannedPhrases.length > 0) {
      console.log(`   ❌ Banned phrases: ${result.bannedPhrases.join(', ')}`);
    }
    if (result.hasGenericOpener) {
      console.log(`   ❌ Generic opener detected`);
    }
    if (result.personalityIndicators.length > 0) {
      console.log(`   ✅ Personality indicators: ${result.personalityIndicators.join(', ')}`);
    }
    console.log();
  }

  // Cross-agent similarity
  console.log('═'.repeat(80));
  console.log('🔍 CROSS-AGENT SIMILARITY');
  console.log('═'.repeat(80));
  console.log();

  const similarities: Array<{ pair: string; similarity: number }> = [];
  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      const sim = calculateSimilarity(results[i].response, results[j].response);
      similarities.push({
        pair: `${results[i].agent} ↔ ${results[j].agent}`,
        similarity: sim
      });
    }
  }

  similarities.sort((a, b) => b.similarity - a.similarity);
  
  for (const { pair, similarity } of similarities) {
    const emoji = similarity > 0.4 ? '⚠️' : similarity > 0.25 ? '⚡' : '✅';
    console.log(`   ${emoji} ${pair}: ${(similarity * 100).toFixed(1)}%`);
  }

  const avgSimilarity = similarities.reduce((sum, s) => sum + s.similarity, 0) / similarities.length;
  console.log();
  console.log(`   Average Similarity: ${(avgSimilarity * 100).toFixed(1)}%`);

  // Summary
  console.log();
  console.log('═'.repeat(80));
  console.log('📈 SUMMARY');
  console.log('═'.repeat(80));
  console.log();

  const avgAntiSlop = results.reduce((sum, r) => sum + r.antiSlopScore, 0) / results.length;
  const bannedPhraseCount = results.reduce((sum, r) => sum + r.bannedPhrases.length, 0);
  const genericOpenerCount = results.filter(r => r.hasGenericOpener).length;

  console.log(`   Average Anti-Slop Score: ${avgAntiSlop.toFixed(1)}/100`);
  console.log(`   Total Banned Phrases: ${bannedPhraseCount}`);
  console.log(`   Generic Openers: ${genericOpenerCount}/${results.length}`);
  console.log(`   Average Similarity: ${(avgSimilarity * 100).toFixed(1)}%`);
  console.log();

  // Compare to baseline (screenshots)
  console.log('═'.repeat(80));
  console.log('📊 COMPARISON TO SCREENSHOT BASELINE');
  console.log('═'.repeat(80));
  console.log();
  console.log('   BASELINE (from screenshots):');
  console.log('   • Average Score: 46.3/100');
  console.log('   • Banned Phrases: 8 total');
  console.log('   • Generic Openers: 6/7 (86%)');
  console.log('   • High Similarity Pairs: 4');
  console.log();
  console.log('   CURRENT SYSTEM:');
  console.log(`   • Average Score: ${avgAntiSlop.toFixed(1)}/100 ${avgAntiSlop > 46.3 ? '✅ IMPROVED' : '❌ WORSE'}`);
  console.log(`   • Banned Phrases: ${bannedPhraseCount} total ${bannedPhraseCount < 8 ? '✅ IMPROVED' : '❌ WORSE'}`);
  console.log(`   • Generic Openers: ${genericOpenerCount}/${results.length} (${((genericOpenerCount/results.length)*100).toFixed(0)}%) ${genericOpenerCount/results.length < 0.86 ? '✅ IMPROVED' : '❌ WORSE'}`);
  console.log(`   • Average Similarity: ${(avgSimilarity * 100).toFixed(1)}% ${avgSimilarity < 0.182 ? '✅ IMPROVED' : avgSimilarity < 0.25 ? '⚡ SIMILAR' : '❌ WORSE'}`);
  console.log();

  console.log('═'.repeat(80));
  console.log('🏁 TEST COMPLETE');
  console.log('═'.repeat(80));
}

// Run the test
runLiveDiversityTest().catch(console.error);
