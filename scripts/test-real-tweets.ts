// Test agent diversity using real tweets from the database
// Fetches tweets that multiple agents have replied to and tests diversity

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wqwhlbmsafgjlsjujuel.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

if (!SUPABASE_ANON_KEY) {
  console.error('❌ VITE_SUPABASE_ANON_KEY not set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/test-agent-diversity`;

interface RealTweet {
  tweet_id: string;
  tweet_text: string;
  author_username: string;
  reply_count: number;
  actual_replies: Array<{
    agent: string;
    reply: string;
    length: number;
  }>;
}

async function fetchRealTweetsWithReplies(): Promise<RealTweet[]> {
  console.log('📊 Fetching real tweets from database...\n');

  // Get tweets that have multiple replies
  const { data: tweetData, error: tweetError } = await supabase
    .from('scheduled_posts')
    .select('target_tweet_id, content, user_id, profiles!inner(twitter_username)')
    .eq('post_type', 'comment')
    .eq('status', 'posted')
    .not('target_tweet_id', 'is', null)
    .order('posted_at', { ascending: false })
    .limit(100);

  if (tweetError) {
    console.error('Error fetching tweets:', tweetError);
    return [];
  }

  // Group by target_tweet_id
  const tweetMap = new Map<string, RealTweet>();

  for (const post of tweetData || []) {
    const tweetId = post.target_tweet_id;
    if (!tweetId) continue;

    if (!tweetMap.has(tweetId)) {
      tweetMap.set(tweetId, {
        tweet_id: tweetId,
        tweet_text: '', // We'll need to fetch this from Twitter API or cache
        author_username: 'unknown',
        reply_count: 0,
        actual_replies: []
      });
    }

    const tweet = tweetMap.get(tweetId)!;
    tweet.reply_count++;
    tweet.actual_replies.push({
      agent: (post.profiles as any)?.twitter_username || 'unknown',
      reply: post.content,
      length: post.content.length
    });
  }

  // Filter to tweets with at least 2 replies
  const tweets = Array.from(tweetMap.values())
    .filter(t => t.reply_count >= 2)
    .sort((a, b) => b.reply_count - a.reply_count)
    .slice(0, 5); // Top 5 most replied-to tweets

  console.log(`Found ${tweets.length} tweets with multiple replies\n`);

  // For now, we'll use the actual replies as reference
  // In a real scenario, we'd fetch the original tweet text from Twitter API
  // For testing, we'll simulate by using a generic tweet text
  // and testing with our test agents

  return tweets;
}

async function testWithRealTweetData() {
  console.log('🧪 TESTING WITH REAL USER TWEETS\n');
  console.log('='.repeat(80) + '\n');

  const realTweets = await fetchRealTweetsWithReplies();

  if (realTweets.length === 0) {
    console.log('❌ No tweets with multiple replies found');
    return;
  }

  // For each tweet, show the actual replies and analyze diversity
  for (let i = 0; i < realTweets.length; i++) {
    const tweet = realTweets[i];
    
    console.log(`\n[${i + 1}/${realTweets.length}] Tweet ID: ${tweet.tweet_id}`);
    console.log(`📊 Actual Replies: ${tweet.reply_count}`);
    console.log('='.repeat(80) + '\n');

    // Show actual replies
    console.log('📝 ACTUAL REPLIES FROM DATABASE:\n');
    tweet.actual_replies.forEach((reply, idx) => {
      console.log(`${idx + 1}. @${reply.agent} (${reply.length} chars):`);
      console.log(`   "${reply.reply}"\n`);
    });

    // Calculate similarity of actual replies
    const replies = tweet.actual_replies.map(r => r.reply.toLowerCase());
    const similarities: Array<{ agent1: string; agent2: string; similarity: number }> = [];

    for (let i = 0; i < replies.length; i++) {
      for (let j = i + 1; j < replies.length; j++) {
        const words1 = new Set(replies[i].split(/\s+/));
        const words2 = new Set(replies[j].split(/\s+/));
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);
        const similarity = union.size > 0 ? intersection.size / union.size : 0;
        
        similarities.push({
          agent1: tweet.actual_replies[i].agent,
          agent2: tweet.actual_replies[j].agent,
          similarity: similarity
        });
      }
    }

    if (similarities.length > 0) {
      const avgSimilarity = similarities.reduce((sum, s) => sum + s.similarity, 0) / similarities.length;
      
      console.log('🔍 SIMILARITY ANALYSIS (ACTUAL REPLIES):\n');
      similarities
        .sort((a, b) => b.similarity - a.similarity)
        .forEach(sim => {
          const similarity = (sim.similarity * 100).toFixed(1);
          const emoji = sim.similarity > 0.5 ? '⚠️' : sim.similarity > 0.3 ? '⚡' : '✅';
          console.log(`${emoji} @${sim.agent1} vs @${sim.agent2}: ${similarity}%`);
        });

      console.log(`\n📊 Average Similarity: ${(avgSimilarity * 100).toFixed(1)}%`);
      const score = avgSimilarity < 0.3 ? 'EXCELLENT' : avgSimilarity < 0.5 ? 'GOOD' : 'NEEDS_IMPROVEMENT';
      console.log(`🎯 Score: ${score}\n`);

      if (avgSimilarity > 0.5) {
        console.log('⚠️  WARNING: High similarity detected in actual production replies!');
        console.log('   This indicates the diversity improvements are needed.\n');
      }
    }

    // Analyze common patterns
    const allWords = replies.flatMap(r => r.split(/\s+/));
    const wordCounts = new Map<string, number>();
    allWords.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });

    const commonWords = Array.from(wordCounts.entries())
      .filter(([word, count]) => count >= tweet.reply_count * 0.6 && word.length > 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (commonWords.length > 0) {
      console.log('🔍 COMMON WORDS (appearing in 60%+ of replies):\n');
      commonWords.forEach(([word, count]) => {
        console.log(`   "${word}": ${count} times`);
      });
      console.log('');
    }

    // Check for banned phrases
    const bannedPhrases = ['vibe', 'vibes', 'fire', 'energy', 'chaos', 'i get why you'];
    const foundBanned = bannedPhrases.filter(phrase => 
      replies.some(r => r.includes(phrase))
    );

    if (foundBanned.length > 0) {
      console.log('⚠️  BANNED PHRASES DETECTED:\n');
      foundBanned.forEach(phrase => {
        console.log(`   - "${phrase}"`);
      });
      console.log('');
    }

    console.log('='.repeat(80));
    
    if (i < realTweets.length - 1) {
      console.log('\n⏳ Waiting 2 seconds before next tweet...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Final summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 FINAL SUMMARY\n');

  const allSimilarities = realTweets.flatMap(tweet => {
    const replies = tweet.actual_replies.map(r => r.reply.toLowerCase());
    const similarities: number[] = [];
    for (let i = 0; i < replies.length; i++) {
      for (let j = i + 1; j < replies.length; j++) {
        const words1 = new Set(replies[i].split(/\s+/));
        const words2 = new Set(replies[j].split(/\s+/));
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);
        const similarity = union.size > 0 ? intersection.size / union.size : 0;
        similarities.push(similarity);
      }
    }
    return similarities.length > 0 
      ? similarities.reduce((a, b) => a + b, 0) / similarities.length 
      : 0;
  });

  const overallAvg = allSimilarities.length > 0
    ? allSimilarities.reduce((a, b) => a + b, 0) / allSimilarities.length
    : 0;

  console.log(`Tweets Analyzed: ${realTweets.length}`);
  console.log(`Overall Average Similarity: ${(overallAvg * 100).toFixed(1)}%`);
  console.log(`Score: ${overallAvg < 0.3 ? 'EXCELLENT' : overallAvg < 0.5 ? 'GOOD' : 'NEEDS_IMPROVEMENT'}\n`);

  if (overallAvg > 0.5) {
    console.log('⚠️  ACTION REQUIRED:');
    console.log('   Production replies show high similarity. The diversity improvements');
    console.log('   should help reduce this. Monitor new replies after deployment.\n');
  } else if (overallAvg < 0.3) {
    console.log('✅ EXCELLENT: Production replies already show good diversity!\n');
  } else {
    console.log('⚡ GOOD: Production replies show acceptable diversity.\n');
  }

  console.log('='.repeat(80));
}

testWithRealTweetData().catch(console.error);
