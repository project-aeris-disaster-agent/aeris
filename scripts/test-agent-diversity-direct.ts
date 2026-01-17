// Direct test of agent diversity by calling the edge function
// This script calls the deployed or local edge function

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wqwhlbmsafgjlsjujuel.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const LOCAL_MODE = process.argv.includes('--local');

const FUNCTION_URL = LOCAL_MODE
  ? 'http://localhost:54321/functions/v1/test-agent-diversity'
  : `${SUPABASE_URL}/functions/v1/test-agent-diversity`;

async function runTest() {
  if (!SUPABASE_ANON_KEY) {
    console.error('❌ VITE_SUPABASE_ANON_KEY not set');
    console.error('   Set it with: $env:VITE_SUPABASE_ANON_KEY="your-key"');
    process.exit(1);
  }

  console.log('🧪 Testing Agent Reply Diversity\n');
  console.log(`📡 Calling: ${FUNCTION_URL}\n`);
  console.log('⏳ Generating replies from 5 different agents...\n');
  console.log('='.repeat(80) + '\n');

  try {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Function returned error: ${response.status}`);
      console.error(errorText);
      process.exit(1);
    }

    const data = await response.json();

    if (data.error) {
      console.error(`❌ Error: ${data.error}`);
      process.exit(1);
    }

    // Display results
    console.log('📝 TEST TWEET:');
    console.log(`"${data.testTweet.substring(0, 100)}..."\n`);
    console.log(`👤 Replying to: @${data.targetUsername}\n`);
    console.log('='.repeat(80) + '\n');

    console.log('🤖 AGENT REPLIES:\n');
    data.results.forEach((result: any, index: number) => {
      if (result.error) {
        console.log(`${index + 1}. ❌ @${result.name}: ${result.error}\n`);
      } else {
        console.log(`${index + 1}. ✅ @${result.name} (${result.length} chars):`);
        console.log(`   "${result.reply}"\n`);
      }
    });

    console.log('='.repeat(80) + '\n');
    console.log('🔍 SIMILARITY ANALYSIS:\n');

    if (data.similarities && data.similarities.length > 0) {
      data.similarities.forEach((sim: any) => {
        const similarity = (sim.similarity * 100).toFixed(1);
        const emoji = sim.similarity > 0.5 ? '⚠️' : sim.similarity > 0.3 ? '⚡' : '✅';
        console.log(`${emoji} @${sim.agent1} vs @${sim.agent2}: ${similarity}% similar`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📊 SUMMARY:\n');
    console.log(`   Generated: ${data.results.filter((r: any) => r.reply).length}/${data.results.length} replies`);
    console.log(`   Average Similarity: ${(data.averageSimilarity * 100).toFixed(1)}%`);
    console.log(`   Diversity Score: ${data.diversityScore}\n`);

    if (data.diversityScore === 'EXCELLENT') {
      console.log('✅ EXCELLENT: Agents are generating highly diverse replies!');
    } else if (data.diversityScore === 'GOOD') {
      console.log('⚡ GOOD: Agents show decent diversity');
    } else {
      console.log('⚠️ WARNING: Replies are too similar - may need more differentiation');
    }

    console.log('\n' + '='.repeat(80));
  } catch (error) {
    console.error('❌ Error calling function:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
    process.exit(1);
  }
}

runTest();
