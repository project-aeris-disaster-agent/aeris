// Detailed investigation of the "Hot Take" scenario
// Shows actual replies and analyzes why similarity is high

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wqwhlbmsafgjlsjujuel.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/test-agent-diversity`;

const HOT_TAKE_TWEET = `Hot take: Most Web3 games are just traditional games with NFTs slapped on. Prove me wrong.`;

async function investigateHotTake() {
  if (!SUPABASE_ANON_KEY) {
    console.error('❌ VITE_SUPABASE_ANON_KEY not set');
    process.exit(1);
  }

  console.log('🔍 INVESTIGATING HOT TAKE SCENARIO\n');
  console.log('='.repeat(80));
  console.log(`📝 Tweet: "${HOT_TAKE_TWEET}"`);
  console.log('='.repeat(80) + '\n');

  // Run multiple iterations to see consistency
  const iterations = 3;
  const allResults: any[] = [];

  for (let i = 0; i < iterations; i++) {
    console.log(`\n🔄 Iteration ${i + 1}/${iterations}\n`);

    try {
      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testTweet: HOT_TAKE_TWEET,
          targetUsername: 'CryptoCritic'
        })
      });

      if (!response.ok) {
        throw new Error(`Function error: ${response.status}`);
      }

      const data = await response.json();
      allResults.push(data);

      // Display results
      console.log('🤖 REPLIES:\n');
      data.results.forEach((result: any, index: number) => {
        if (result.reply) {
          console.log(`${index + 1}. @${result.name} (${result.length} chars):`);
          console.log(`   "${result.reply}"\n`);
        }
      });

      console.log(`📊 Similarity: ${(data.averageSimilarity * 100).toFixed(1)}%`);
      console.log(`🎯 Score: ${data.diversityScore}\n`);

      // Show similarity pairs
      if (data.similarities && data.similarities.length > 0) {
        console.log('🔍 Similarity Pairs:\n');
        data.similarities
          .sort((a: any, b: any) => b.similarity - a.similarity)
          .forEach((sim: any) => {
            const similarity = (sim.similarity * 100).toFixed(1);
            const emoji = sim.similarity > 0.5 ? '⚠️' : sim.similarity > 0.3 ? '⚡' : '✅';
            console.log(`${emoji} @${sim.agent1} vs @${sim.agent2}: ${similarity}%`);
          });
      }

      if (i < iterations - 1) {
        console.log('\n⏳ Waiting 3 seconds before next iteration...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } catch (error) {
      console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Analyze patterns across iterations
  console.log('\n' + '='.repeat(80));
  console.log('📊 CROSS-ITERATION ANALYSIS\n');

  const avgSimilarities = allResults.map(r => r.averageSimilarity);
  const avgSimilarity = avgSimilarities.reduce((a, b) => a + b, 0) / avgSimilarities.length;
  const minSimilarity = Math.min(...avgSimilarities);
  const maxSimilarity = Math.max(...avgSimilarities);

  console.log(`Average Similarity Across Iterations: ${(avgSimilarity * 100).toFixed(1)}%`);
  console.log(`Range: ${(minSimilarity * 100).toFixed(1)}% - ${(maxSimilarity * 100).toFixed(1)}%`);

  // Analyze common words/phrases
  console.log('\n🔍 COMMON PATTERNS:\n');

  const allReplies = allResults.flatMap(r => 
    r.results.filter((res: any) => res.reply).map((res: any) => ({
      agent: res.name,
      reply: res.reply.toLowerCase()
    }))
  );

  // Find common opening words
  const openings = allReplies.map(r => {
    const firstWord = r.reply.split(/\s+/)[0];
    return { agent: r.agent, opening: firstWord };
  });

  const openingCounts = new Map<string, number>();
  openings.forEach(o => {
    const key = o.opening;
    openingCounts.set(key, (openingCounts.get(key) || 0) + 1);
  });

  console.log('Common Opening Words:');
  Array.from(openingCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([word, count]) => {
      console.log(`   "${word}": ${count} times`);
    });

  // Find common phrases (2-3 words)
  const phrases = new Map<string, number>();
  allReplies.forEach(r => {
    const words = r.reply.split(/\s+/);
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = `${words[i]} ${words[i + 1]}`;
      phrases.set(phrase, (phrases.get(phrase) || 0) + 1);
    }
  });

  console.log('\nCommon Phrases (2 words):');
  Array.from(phrases.entries())
    .filter(([_, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([phrase, count]) => {
      console.log(`   "${phrase}": ${count} times`);
    });

  // Analyze reply structures
  console.log('\n📐 REPLY STRUCTURES:\n');
  allReplies.forEach(r => {
    const sentences = r.reply.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const hasQuestion = r.reply.includes('?');
    const hasMention = r.reply.includes('@');
    console.log(`@${r.agent}: ${sentences.length} sentence(s), ${hasQuestion ? 'has question' : 'statement'}, ${hasMention ? 'has mention' : 'no mention'}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('💡 RECOMMENDATIONS:\n');

  if (avgSimilarity > 0.5) {
    console.log('⚠️  High similarity detected. Consider:');
    console.log('   1. Adding more contrarian archetype variations');
    console.log('   2. Forcing different response angles (agree vs disagree vs nuanced)');
    console.log('   3. Increasing temperature for provocative tweets');
    console.log('   4. Adding per-agent "stance" preferences (always agree, always challenge, etc.)');
  }

  if (openingCounts.size < 3) {
    console.log('⚠️  Limited opening variety. Consider:');
    console.log('   1. Adding more opening phrase variations per archetype');
    console.log('   2. Seeding opening selection based on agent personality');
  }

  console.log('\n' + '='.repeat(80));
}

investigateHotTake().catch(console.error);
