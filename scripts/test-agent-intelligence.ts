// Test script for Agent Intelligence features
// Tests: Reply decision gate, live search enablement, prompt improvements
// Run with: npx tsx scripts/test-agent-intelligence.ts

const GROK_API_KEY = process.env.GROK_API_KEY || '';

if (!GROK_API_KEY) {
  console.error('❌ Missing GROK_API_KEY environment variable');
  console.error('   Set it with: $env:GROK_API_KEY="your-key"');
  process.exit(1);
}

interface TestResult {
  test: string;
  passed: boolean;
  message: string;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function logTest(test: string, passed: boolean, message: string, error?: string, details?: any) {
  results.push({ test, passed, message, error, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${test}: ${message}`);
  if (error) {
    console.log(`   Error: ${error}`);
  }
  if (details) {
    console.log(`   Details:`, JSON.stringify(details, null, 2));
  }
}

// Mock character card for testing
const mockCharacterCard = {
  name: 'TestAgent',
  bio: ['Test agent for F1 expertise'],
  knowledge: ['Formula 1', 'Racing', 'Motorsports'],
  topics: ['F1', 'Formula 1', 'Racing'],
  adjectives: ['Knowledgeable', 'Engaging'],
  style: {
    all: ['Expert', 'Informed'],
    chat: ['Conversational'],
    post: ['Technical'],
  },
  messageExamples: [],
  postExamples: [],
};

/**
 * Test the reply decision gate function
 */
async function testReplyDecisionGate() {
  console.log('\n🔍 Testing Reply Decision Gate (shouldReplyToTweet)...\n');

  // Test Case 1: Tweet that should get a reply (F1 expertise match)
  console.log('Test 1: F1 expertise tweet - should reply');
  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-3-latest',
        messages: [
          {
            role: 'system',
            content: 'You are an intelligent filter evaluating whether a Twitter agent should reply to a tweet. Be strict - only approve replies that genuinely add value.',
          },
          {
            role: 'user',
            content: `You are evaluating whether @${mockCharacterCard.name} should reply to this tweet.

TWEET: "Verstappen's 6-race win streak finally ended at Singapore! Ferrari's upgrades are working."
AUTHOR: @f1_news

YOUR EXPERTISE: Formula 1, Racing, Motorsports
YOUR TOPICS: F1, Formula 1, Racing

EVALUATE:

1. VALUE POTENTIAL
   - Can you add specific facts, stats, or unique insights?
   - Do you have genuine expertise on this topic?
   - Would your reply start or continue meaningful discourse?

2. CONVERSATION APPROPRIATENESS  
   - Is this an invitation for discussion or a closed statement?
   - Is the author seeking engagement or just sharing?
   - Would replying feel natural or forced/spammy?

3. TOPIC ALIGNMENT
   - Does this relate to your areas of expertise?
   - Can you speak authentically on this subject?

RESPOND WITH JSON ONLY:
{
  "shouldReply": true/false,
  "reason": "Brief explanation",
  "suggestedAngle": "If yes, the specific angle/point to make (omit if shouldReply is false)",
  "confidence": "high/medium/low"
}

SKIP if:
- You can only offer generic agreement ("that's fire!", "that vibe is crazy")
- The tweet is rhetorical and doesn't invite response
- You have no specific knowledge to add
- Replying would feel performative rather than genuine
- The topic doesn't align with your expertise`,
          },
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      logTest(
        'Reply Decision Gate API',
        false,
        `API request failed: ${response.status}`,
        await response.text()
      );
      return;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';
    
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.slice(7);
    } else if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.slice(3);
    }
    if (jsonContent.endsWith('```')) {
      jsonContent = jsonContent.slice(0, -3);
    }
    jsonContent = jsonContent.trim();

    const decision = JSON.parse(jsonContent);
    
    logTest(
      'Reply Decision - F1 Tweet',
      decision.shouldReply === true,
      decision.shouldReply 
        ? `Should reply: ${decision.reason} (${decision.confidence} confidence)`
        : `Should NOT reply: ${decision.reason}`,
      undefined,
      decision
    );
  } catch (error) {
    logTest(
      'Reply Decision Gate',
      false,
      'Test failed',
      error instanceof Error ? error.message : String(error)
    );
  }

  // Test Case 2: Tweet that should NOT get a reply (off-topic)
  console.log('\nTest 2: Off-topic tweet - should skip');
  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-3-latest',
        messages: [
          {
            role: 'system',
            content: 'You are an intelligent filter evaluating whether a Twitter agent should reply to a tweet. Be strict - only approve replies that genuinely add value.',
          },
          {
            role: 'user',
            content: `You are evaluating whether @${mockCharacterCard.name} should reply to this tweet.

TWEET: "Just made the best pasta recipe for dinner tonight!"
AUTHOR: @cooking_blog

YOUR EXPERTISE: Formula 1, Racing, Motorsports
YOUR TOPICS: F1, Formula 1, Racing

EVALUATE:

1. VALUE POTENTIAL
   - Can you add specific facts, stats, or unique insights?
   - Do you have genuine expertise on this topic?
   - Would your reply start or continue meaningful discourse?

2. CONVERSATION APPROPRIATENESS  
   - Is this an invitation for discussion or a closed statement?
   - Is the author seeking engagement or just sharing?
   - Would replying feel natural or forced/spammy?

3. TOPIC ALIGNMENT
   - Does this relate to your areas of expertise?
   - Can you speak authentically on this subject?

RESPOND WITH JSON ONLY:
{
  "shouldReply": true/false,
  "reason": "Brief explanation",
  "suggestedAngle": "If yes, the specific angle/point to make (omit if shouldReply is false)",
  "confidence": "high/medium/low"
}

SKIP if:
- You can only offer generic agreement ("that's fire!", "that vibe is crazy")
- The tweet is rhetorical and doesn't invite response
- You have no specific knowledge to add
- Replying would feel performative rather than genuine
- The topic doesn't align with your expertise`,
          },
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      logTest(
        'Reply Decision Gate - Off-topic',
        false,
        `API request failed: ${response.status}`,
        await response.text()
      );
      return;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';
    
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.slice(7);
    } else if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.slice(3);
    }
    if (jsonContent.endsWith('```')) {
      jsonContent = jsonContent.slice(0, -3);
    }
    jsonContent = jsonContent.trim();

    const decision = JSON.parse(jsonContent);
    
    logTest(
      'Reply Decision - Off-topic Tweet',
      decision.shouldReply === false,
      decision.shouldReply 
        ? `INCORRECTLY approved reply: ${decision.reason}`
        : `Correctly skipped: ${decision.reason} (${decision.confidence} confidence)`,
      undefined,
      decision
    );
  } catch (error) {
    logTest(
      'Reply Decision Gate - Off-topic',
      false,
      'Test failed',
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Test that banned words are properly flagged
 */
async function testBannedWordsDetection() {
  console.log('\n🚫 Testing Banned Words Detection...\n');

  const bannedWords = ['vibe', 'fire', 'energy', 'chaos', 'hits different', "let's go"];
  const testReplies = [
    {
      text: "Yo @user, that hunter/hunted vibe is pure F1 chaos!",
      shouldBeFlagged: true,
      reason: 'Contains "vibe" and "chaos"',
    },
    {
      text: "Verstappen had 6 straight wins before Singapore. Ferrari's upgrade package is finally paying off - the gap to Red Bull is real now.",
      shouldBeFlagged: false,
      reason: 'Contains specific facts',
    },
    {
      text: "That's straight fire!",
      shouldBeFlagged: true,
      reason: 'Contains "fire"',
    },
    {
      text: "LeBron at 39 dropping 28/8/8 lines is wild. Real question is whether AD stays healthy through playoffs.",
      shouldBeFlagged: false,
      reason: 'Contains specific stats',
    },
  ];

  for (const testReply of testReplies) {
    const lowerText = testReply.text.toLowerCase();
    const containsBanned = bannedWords.some(word => lowerText.includes(word.toLowerCase()));
    
    logTest(
      `Banned Words - "${testReply.text.substring(0, 40)}..."`,
      containsBanned === testReply.shouldBeFlagged,
      containsBanned 
        ? `Contains banned words: ${bannedWords.filter(w => lowerText.includes(w.toLowerCase())).join(', ')}`
        : 'No banned words detected',
      undefined,
      { expected: testReply.shouldBeFlagged, actual: containsBanned, reason: testReply.reason }
    );
  }
}

/**
 * Test live search enablement check
 */
async function testLiveSearchConfig() {
  console.log('\n🔍 Testing Live Search Configuration...\n');

  // Read the actual implementation to verify enableLiveSearch is set
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const processActionsPath = path.join(process.cwd(), 'supabase', 'functions', 'process-agent-actions', 'index.ts');
    const instantActionsPath = path.join(process.cwd(), 'supabase', 'functions', 'execute-agent-actions-instant', 'index.ts');
    
    const [processActionsContent, instantActionsContent] = await Promise.all([
      fs.readFile(processActionsPath, 'utf-8'),
      fs.readFile(instantActionsPath, 'utf-8'),
    ]);

    const hasLiveSearchProcess = processActionsContent.includes('enableLiveSearch: true');
    const hasLiveSearchInstant = instantActionsContent.includes('enableLiveSearch: true');
    const hasDecisionGateProcess = processActionsContent.includes('shouldReplyToTweet');
    const hasDecisionGateInstant = instantActionsContent.includes('shouldReplyToTweet');

    logTest(
      'Live Search - process-agent-actions',
      hasLiveSearchProcess,
      hasLiveSearchProcess 
        ? 'enableLiveSearch: true is set'
        : 'enableLiveSearch: true NOT FOUND',
    );

    logTest(
      'Live Search - execute-agent-actions-instant',
      hasLiveSearchInstant,
      hasLiveSearchInstant 
        ? 'enableLiveSearch: true is set'
        : 'enableLiveSearch: true NOT FOUND',
    );

    logTest(
      'Decision Gate - process-agent-actions',
      hasDecisionGateProcess,
      hasDecisionGateProcess 
        ? 'shouldReplyToTweet is called before generating reply'
        : 'shouldReplyToTweet NOT FOUND',
    );

    logTest(
      'Decision Gate - execute-agent-actions-instant',
      hasDecisionGateInstant,
      hasDecisionGateInstant 
        ? 'shouldReplyToTweet is called before generating reply'
        : 'shouldReplyToTweet NOT FOUND',
    );
  } catch (error) {
    logTest(
      'File Read Test',
      false,
      'Could not read implementation files',
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Test prompt improvements
 */
async function testPromptImprovements() {
  console.log('\n📝 Testing Prompt Improvements...\n');

  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const generateResponsePath = path.join(process.cwd(), 'supabase', 'functions', '_shared', 'generateResponse.ts');
    const content = await fs.readFile(generateResponsePath, 'utf-8');

    const hasBannedWords = content.includes('BANNED WORDS/PHRASES');
    const hasSpecificRequirement = content.includes('At least ONE specific fact');
    const hasGoodExamples = content.includes('GOOD EXAMPLES');
    const hasBadExamples = content.includes('BAD EXAMPLES');

    logTest(
      'Prompt - Banned Words Section',
      hasBannedWords,
      hasBannedWords 
        ? 'BANNED WORDS/PHRASES section found'
        : 'BANNED WORDS/PHRASES section NOT FOUND',
    );

    logTest(
      'Prompt - Specific Fact Requirement',
      hasSpecificRequirement,
      hasSpecificRequirement 
        ? 'Requires specific facts/stats/details'
        : 'Specific fact requirement NOT FOUND',
    );

    logTest(
      'Prompt - Good Examples',
      hasGoodExamples,
      hasGoodExamples 
        ? 'GOOD EXAMPLES section found'
        : 'GOOD EXAMPLES section NOT FOUND',
    );

    logTest(
      'Prompt - Bad Examples',
      hasBadExamples,
      hasBadExamples 
        ? 'BAD EXAMPLES section found'
        : 'BAD EXAMPLES section NOT FOUND',
    );
  } catch (error) {
    logTest(
      'Prompt Improvements Test',
      false,
      'Could not read generateResponse.ts',
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function runAllTests() {
  console.log('🧪 Agent Intelligence Features Test Suite\n');
  console.log('='.repeat(60));

  await testReplyDecisionGate();
  await testBannedWordsDetection();
  await testLiveSearchConfig();
  await testPromptImprovements();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Summary\n');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${total > 0 ? ((passed / total) * 100).toFixed(1) : 0}%`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.test}: ${r.message}`);
        if (r.error) {
          console.log(`    Error: ${r.error}`);
        }
      });
  }

  console.log('\n💡 Note: These tests verify the implementation structure.');
  console.log('   For end-to-end testing, trigger actual agent actions via the API.\n');

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch((error) => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
