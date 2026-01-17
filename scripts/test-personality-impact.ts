/**
 * Personality Impact Test
 * 
 * Tests how character card personality actually affects responses
 * Uses a different test tweet and analyzes personality expression
 */

// Different test tweet for variety
const TEST_TWEETS = [
  {
    id: 'hot_take',
    author: 'elikiaa',
    content: `Hot take: AI agents are just bots with extra steps. The "personality" is just a bunch of prompt engineering. Change my mind.`
  },
  {
    id: 'question',
    author: 'cryptodev',
    content: `What's everyone building this weekend? Need some inspiration for my next project 🛠️`
  },
  {
    id: 'announcement',
    author: 'web3news',
    content: `BREAKING: Major gaming studio announces partnership with @virtikiAI for AI-powered NPCs. This could change how we play games forever.`
  }
];

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wqwhlbmsafgjlsjujuel.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

interface AgentResponse {
  name: string;
  reply: string;
  length: number;
  error?: string;
}

interface TestResult {
  testTweet: string;
  targetUsername: string;
  results: AgentResponse[];
  similarities: Array<{ agent1: string; agent2: string; similarity: number }>;
  averageSimilarity: number;
}

async function runTest(tweet: typeof TEST_TWEETS[0]): Promise<TestResult | null> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/test-agent-diversity`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        testTweet: tweet.content,
        targetUsername: tweet.author
      })
    });

    if (!response.ok) {
      console.error(`Error: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Fetch error:', error);
    return null;
  }
}

// Personality trait indicators
const PERSONALITY_INDICATORS = {
  // Openers indicate personality style
  contrarian: /^(nah|actually|disagree|counterpoint|but|however)/i,
  analytical: /^(the data|statistically|technically|looking at|based on)/i,
  conversational: /^(wait|ok but|lowkey|ngl|tbh|fr|hmm)/i,
  punchy: /^(wild|facts|this|same|honestly)\./i,
  enthusiastic: /^(oh|omg|yes|love|amazing|incredible)/i,
  sarcastic: /^(lol|lmao|imagine|sure|right)/i,
  
  // Content patterns
  usesQuestion: /\?$/,
  usesExclamation: /!/,
  usesEmDash: /—/,
  usesEmoji: /[\u{1F300}-\u{1F9FF}]/u,
  hasOpinion: /\b(I think|I believe|personally|imo|hot take)\b/i,
  hasChallenge: /\b(but|however|actually|disagree|wrong)\b/i,
  hasHumor: /\b(lol|lmao|haha|imagine|bruh)\b/i,
  isRobotic: /\b(system|update|processing|analyzing)\b/i,
  
  // Style markers
  usesCaps: /[A-Z]{3,}/,
  usesSlang: /\b(gonna|wanna|kinda|sorta|gotta|vibin|slaps)\b/i,
  usesContractions: /\b(don't|can't|won't|it's|that's|I'm|you're)\b/i,
};

function analyzePersonality(response: string): Record<string, boolean> {
  const results: Record<string, boolean> = {};
  for (const [key, pattern] of Object.entries(PERSONALITY_INDICATORS)) {
    results[key] = pattern.test(response);
  }
  return results;
}

function getPersonalityProfile(traits: Record<string, boolean>): string[] {
  const profile: string[] = [];
  
  // Determine opener style
  if (traits.contrarian) profile.push('Contrarian opener');
  if (traits.analytical) profile.push('Analytical opener');
  if (traits.conversational) profile.push('Conversational opener');
  if (traits.punchy) profile.push('Punchy opener');
  if (traits.enthusiastic) profile.push('Enthusiastic opener');
  if (traits.sarcastic) profile.push('Sarcastic opener');
  
  // Content characteristics
  if (traits.hasOpinion) profile.push('Expresses opinion');
  if (traits.hasChallenge) profile.push('Challenges/debates');
  if (traits.hasHumor) profile.push('Uses humor');
  if (traits.isRobotic) profile.push('Robotic style');
  
  // Style markers
  if (traits.usesSlang) profile.push('Uses slang');
  if (traits.usesEmoji) profile.push('Uses emoji');
  if (traits.usesCaps) profile.push('Uses emphasis caps');
  
  return profile;
}

// Expected personality traits based on character cards
const EXPECTED_PERSONALITIES: Record<string, string[]> = {
  'newprontera': ['Robotic style', 'Analytical opener', 'direct', 'tech-oriented'],
  'ArcherPerezz': ['Enthusiastic opener', 'Uses emoji', 'Uses emphasis caps', 'hype-driven'],
  '_langtuNFT': ['Conversational opener', 'friendly', 'Uses slang'],
  'LordSedano': ['Uses emoji', 'Uses slang', 'Expresses opinion', 'bold'],
  'agent_hellracer': ['Sarcastic opener', 'Uses humor', 'provocative', 'Contrarian opener'],
};

async function main() {
  if (!SUPABASE_ANON_KEY) {
    console.error('❌ VITE_SUPABASE_ANON_KEY not set');
    process.exit(1);
  }

  console.log('═'.repeat(80));
  console.log('🧪 PERSONALITY IMPACT TEST');
  console.log('═'.repeat(80));
  console.log();

  const allResults: Array<{
    tweetId: string;
    responses: Array<{
      agent: string;
      response: string;
      traits: Record<string, boolean>;
      profile: string[];
    }>;
  }> = [];

  for (const tweet of TEST_TWEETS) {
    console.log(`\n📝 Testing: "${tweet.content.substring(0, 60)}..."`);
    console.log(`   From: @${tweet.author}`);
    console.log('   ⏳ Generating responses...');
    
    const result = await runTest(tweet);
    
    if (!result) {
      console.log('   ❌ Failed to get responses');
      continue;
    }

    const tweetResults: typeof allResults[0] = {
      tweetId: tweet.id,
      responses: []
    };

    console.log();
    for (const agentResult of result.results) {
      if (agentResult.error || !agentResult.reply) {
        console.log(`   ❌ ${agentResult.name}: ${agentResult.error || 'Empty response'}`);
        continue;
      }

      const traits = analyzePersonality(agentResult.reply);
      const profile = getPersonalityProfile(traits);
      
      tweetResults.responses.push({
        agent: agentResult.name,
        response: agentResult.reply,
        traits,
        profile
      });

      const expected = EXPECTED_PERSONALITIES[agentResult.name] || [];
      const matchedExpected = profile.filter(p => 
        expected.some(e => p.toLowerCase().includes(e.toLowerCase()))
      );

      console.log(`   🤖 ${agentResult.name}:`);
      console.log(`      "${agentResult.reply}"`);
      console.log(`      Detected: ${profile.length > 0 ? profile.join(', ') : 'No distinct markers'}`);
      if (matchedExpected.length > 0) {
        console.log(`      ✅ Matches expected: ${matchedExpected.join(', ')}`);
      } else if (expected.length > 0) {
        console.log(`      ⚠️  Expected: ${expected.slice(0, 3).join(', ')}`);
      }
      console.log();
    }

    console.log(`   📊 Similarity: ${(result.averageSimilarity * 100).toFixed(1)}%`);
    allResults.push(tweetResults);

    // Delay between tweets
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Summary analysis
  console.log('\n' + '═'.repeat(80));
  console.log('📊 PERSONALITY EXPRESSION ANALYSIS');
  console.log('═'.repeat(80));
  console.log();

  // Count personality consistency across tweets
  const agentConsistency: Record<string, {
    totalResponses: number;
    matchedExpected: number;
    detectedProfiles: string[];
  }> = {};

  for (const result of allResults) {
    for (const response of result.responses) {
      if (!agentConsistency[response.agent]) {
        agentConsistency[response.agent] = {
          totalResponses: 0,
          matchedExpected: 0,
          detectedProfiles: []
        };
      }
      
      agentConsistency[response.agent].totalResponses++;
      agentConsistency[response.agent].detectedProfiles.push(...response.profile);
      
      const expected = EXPECTED_PERSONALITIES[response.agent] || [];
      if (response.profile.some(p => expected.some(e => p.toLowerCase().includes(e.toLowerCase())))) {
        agentConsistency[response.agent].matchedExpected++;
      }
    }
  }

  console.log('   AGENT PERSONALITY CONSISTENCY:');
  console.log('   ' + '─'.repeat(60));
  
  for (const [agent, data] of Object.entries(agentConsistency)) {
    const consistencyRate = data.totalResponses > 0 
      ? (data.matchedExpected / data.totalResponses * 100).toFixed(0)
      : '0';
    
    // Find most common traits
    const traitCounts = data.detectedProfiles.reduce((acc, t) => {
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topTraits = Object.entries(traitCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t]) => t);

    console.log(`   ${agent}:`);
    console.log(`      Personality match: ${consistencyRate}% (${data.matchedExpected}/${data.totalResponses})`);
    console.log(`      Common traits: ${topTraits.length > 0 ? topTraits.join(', ') : 'None detected'}`);
    console.log(`      Expected: ${(EXPECTED_PERSONALITIES[agent] || ['Not defined']).slice(0, 3).join(', ')}`);
    console.log();
  }

  // Recommendations
  console.log('═'.repeat(80));
  console.log('💡 OBSERVATIONS');
  console.log('═'.repeat(80));
  console.log();

  const avgConsistency = Object.values(agentConsistency).reduce((sum, d) => 
    sum + (d.totalResponses > 0 ? d.matchedExpected / d.totalResponses : 0), 0
  ) / Object.keys(agentConsistency).length * 100;

  if (avgConsistency < 30) {
    console.log('   ⚠️  LOW PERSONALITY EXPRESSION');
    console.log('      Character cards are not strongly influencing responses.');
    console.log('      Recommendations:');
    console.log('      1. Add more postExamples to character cards');
    console.log('      2. Increase signaturePhraseFrequency in advancedSettings');
    console.log('      3. Add stronger style directives in the character card');
  } else if (avgConsistency < 60) {
    console.log('   ⚡ MODERATE PERSONALITY EXPRESSION');
    console.log('      Some personality traits are coming through, but inconsistently.');
    console.log('      Recommendations:');
    console.log('      1. Review archetype selection logic');
    console.log('      2. Ensure metadata.signaturePhrases are being used');
  } else {
    console.log('   ✅ GOOD PERSONALITY EXPRESSION');
    console.log('      Character cards are influencing responses appropriately.');
  }

  console.log();
  console.log('═'.repeat(80));
  console.log('🏁 TEST COMPLETE');
  console.log('═'.repeat(80));
}

main().catch(console.error);
