// Supabase Edge Function: Generate Character Card
// Fetches user tweets via Twitter API and uses Grok for deep personality analysis

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TwitterTweet {
  id: string;
  text: string;
  created_at: string;
  public_metrics?: {
    retweet_count: number;
    like_count: number;
    reply_count: number;
    quote_count?: number;
  };
  in_reply_to_user_id?: string;
}

interface TwitterUser {
  id: string;
  name: string;
  username: string;
  description?: string;
  profile_image_url?: string;
  created_at?: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count?: number;
  };
  verified?: boolean;
  location?: string;
  url?: string;
}

interface DeepPersonalityAnalysis {
  // Voice & Writing Patterns
  signaturePhrases: string[];
  vocabularyLevel: string;
  sentenceStructure: string;
  punctuationStyle: string;
  capitalizationHabits: string;
  emojiPatterns: string[];
  hashtagUsage: string;
  
  // Personality Traits (evidenced by tweets)
  coreTraits: Array<{ trait: string; evidence: string }>;
  emotionalPatterns: string[];
  humorStyle: string;
  
  // Content & Interests
  primaryTopics: string[];
  expertiseAreas: string[];
  passionateAbout: string[];
  
  // Engagement Style
  interactionStyle: string;
  responsePatterns: string;
  communityRole: string;
  
  // For Character Card
  bio: string[];
  lore: string[];
  knowledge: string[];
  adjectives: string[];
  styleTraits: {
    all: string[];
    chat: string[];
    post: string[];
  };
}

interface CharacterCardGeneration {
  messageExamples: Array<Array<{ user: string; content: { text: string } }>>;
  postExamples: string[];
  topics: string[];
}

interface ElizaOSCharacterCard {
  name: string;
  clients: string[];
  modelProvider: string;
  settings: {
    voice: {
      model: string;
    };
  };
  plugins: string[];
  bio: string[];
  lore: string[];
  knowledge: string[];
  messageExamples: Array<Array<{
    user: string;
    content: { text: string };
  }>>;
  postExamples: string[];
  topics: string[];
  style: {
    all: string[];
    chat: string[];
    post: string[];
  };
  adjectives: string[];
  schedule: {
    intervalMinutes: number;
    enabled: boolean;
  };
  commenting: {
    enabled: boolean;
  };
}

// ============================================================================
// CONFIGURATION
// ============================================================================

// Enable Twitter API for richer context (uses 2 API calls per generation)
const USE_TWITTER_API_FOR_TWEETS = true;

// Number of tweets to fetch (keep low to conserve rate limits)
// Free tier: 1,500 tweets/month read limit
// At 20 tweets per generation = 75 generations/month
const TWEETS_TO_FETCH = 20;

// ============================================================================
// SCORING SYSTEM
// ============================================================================

type LetterGrade = 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D';

interface ProfileScores {
  finalRating: LetterGrade;
  engagement: LetterGrade;
  reach: LetterGrade;
  content: LetterGrade;
}

// Calculate engagement score based on likes/retweets per follower
function calculateEngagementScore(
  tweets: TwitterTweet[],
  followersCount: number
): LetterGrade {
  if (tweets.length === 0 || followersCount === 0) return 'C';
  
  const totalLikes = tweets.reduce((sum, t) => sum + (t.public_metrics?.like_count || 0), 0);
  const totalRetweets = tweets.reduce((sum, t) => sum + (t.public_metrics?.retweet_count || 0), 0);
  const avgEngagement = (totalLikes + totalRetweets * 2) / tweets.length;
  
  // Engagement rate = avg engagement per tweet / followers
  const engagementRate = avgEngagement / followersCount;
  
  // Scoring thresholds (industry standard engagement rate ~1-3%)
  if (engagementRate >= 0.05) return 'A+';  // 5%+ exceptional
  if (engagementRate >= 0.03) return 'A';   // 3-5% excellent
  if (engagementRate >= 0.02) return 'B+';  // 2-3% great
  if (engagementRate >= 0.01) return 'B';   // 1-2% good
  if (engagementRate >= 0.005) return 'C+'; // 0.5-1% average
  if (engagementRate >= 0.002) return 'C';  // 0.2-0.5% below average
  return 'D';
}

// Calculate reach score based on follower count
function calculateReachScore(followersCount: number): LetterGrade {
  if (followersCount >= 100000) return 'A+';  // 100K+ major influencer
  if (followersCount >= 50000) return 'A';    // 50-100K influencer
  if (followersCount >= 10000) return 'B+';   // 10-50K micro-influencer
  if (followersCount >= 5000) return 'B';     // 5-10K growing
  if (followersCount >= 1000) return 'C+';    // 1-5K established
  if (followersCount >= 500) return 'C';      // 500-1K building
  return 'D';                                  // <500 starting
}

// Calculate content score based on Grok's analysis
function calculateContentScore(analysis: DeepPersonalityAnalysis): LetterGrade {
  let score = 0;
  
  // Evaluate expertise depth
  if (analysis.expertiseAreas.length >= 3) score += 2;
  else if (analysis.expertiseAreas.length >= 1) score += 1;
  
  // Evaluate vocabulary sophistication
  if (analysis.vocabularyLevel === 'technical' || analysis.vocabularyLevel === 'academic') score += 2;
  else if (analysis.vocabularyLevel === 'mixed') score += 1;
  
  // Evaluate core traits (evidence-based)
  if (analysis.coreTraits.length >= 4) score += 2;
  else if (analysis.coreTraits.length >= 2) score += 1;
  
  // Evaluate community role
  if (analysis.communityRole === 'thought-leader' || analysis.communityRole === 'creator') score += 2;
  else if (analysis.communityRole === 'entertainer') score += 1;
  
  // Evaluate signature phrases (voice uniqueness)
  if (analysis.signaturePhrases.length >= 3) score += 1;
  
  // Convert score to grade
  if (score >= 8) return 'A+';
  if (score >= 6) return 'A';
  if (score >= 5) return 'B+';
  if (score >= 4) return 'B';
  if (score >= 3) return 'C+';
  if (score >= 2) return 'C';
  return 'D';
}

// Calculate final rating as weighted average
function calculateFinalRating(
  engagement: LetterGrade,
  reach: LetterGrade,
  content: LetterGrade
): LetterGrade {
  const gradeToNum: Record<LetterGrade, number> = {
    'A+': 7, 'A': 6, 'B+': 5, 'B': 4, 'C+': 3, 'C': 2, 'D': 1
  };
  const numToGrade: LetterGrade[] = ['D', 'D', 'C', 'C+', 'B', 'B+', 'A', 'A+'];
  
  // Weighted: Engagement 40%, Content 35%, Reach 25%
  const weighted = 
    gradeToNum[engagement] * 0.4 +
    gradeToNum[content] * 0.35 +
    gradeToNum[reach] * 0.25;
  
  const index = Math.min(Math.round(weighted), 7);
  return numToGrade[index];
}

function calculateProfileScores(
  tweets: TwitterTweet[],
  userProfile: TwitterUser,
  analysis: DeepPersonalityAnalysis
): ProfileScores {
  const followersCount = userProfile.public_metrics?.followers_count || 0;
  
  const engagement = calculateEngagementScore(tweets, followersCount);
  const reach = calculateReachScore(followersCount);
  const content = calculateContentScore(analysis);
  const finalRating = calculateFinalRating(engagement, reach, content);
  
  console.log(`Scores - Final: ${finalRating}, Engagement: ${engagement}, Reach: ${reach}, Content: ${content}`);
  
  return { finalRating, engagement, reach, content };
}

// ============================================================================
// TWITTER API FUNCTIONS (Optimized for minimal API calls)
// ============================================================================

interface TwitterProfileWithPinned extends TwitterUser {
  pinned_tweet?: TwitterTweet;
}

// API CALL 1: Fetch user profile + pinned tweet in ONE call
async function fetchUserProfileWithPinnedTweet(accessToken: string): Promise<TwitterProfileWithPinned> {
  console.log('API Call 1/2: Fetching user profile + pinned tweet...');
  
  // Request profile with pinned_tweet_id expansion to get pinned tweet in same call
  const params = new URLSearchParams({
    'user.fields': 'description,profile_image_url,public_metrics,created_at,location,url,verified,pinned_tweet_id',
    'expansions': 'pinned_tweet_id',
    'tweet.fields': 'created_at,public_metrics,text',
  });

  const response = await fetch(
    `https://api.twitter.com/2/users/me?${params.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Twitter profile API error:', response.status, errorText);
    throw new Error(`Failed to fetch profile: ${response.status}`);
  }

  const data = await response.json();
  const profile = data.data;
  
  // Extract pinned tweet from includes if present
  let pinnedTweet: TwitterTweet | undefined;
  if (data.includes?.tweets?.length > 0) {
    pinnedTweet = data.includes.tweets[0];
    console.log('Found pinned tweet');
  }

  console.log(`Fetched profile for @${profile.username}`);
  
  return {
    ...profile,
    pinned_tweet: pinnedTweet,
  };
}

// API CALL 2: Fetch recent tweets (limited count to save rate limits)
async function fetchUserTweets(
  accessToken: string, 
  userId: string, 
  maxResults: number = TWEETS_TO_FETCH
): Promise<TwitterTweet[]> {
  console.log(`API Call 2/2: Fetching ${maxResults} recent tweets...`);
  
  const params = new URLSearchParams({
    max_results: Math.min(maxResults, 100).toString(),
    'tweet.fields': 'created_at,public_metrics,in_reply_to_user_id',
    exclude: 'retweets',
  });

  const response = await fetch(
    `https://api.twitter.com/2/users/${userId}/tweets?${params.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Twitter API error:', response.status, errorText);
    
    try {
      const error = JSON.parse(errorText);
      throw new Error(error.detail || error.title || `Twitter API error: ${response.status}`);
    } catch {
      throw new Error(`Failed to fetch tweets: ${response.status}`);
    }
  }

  const data = await response.json();
  const tweets = data.data || [];
  console.log(`Fetched ${tweets.length} tweets`);
  return tweets;
}

// Legacy function for compatibility
async function fetchUserProfile(accessToken: string): Promise<TwitterUser> {
  const result = await fetchUserProfileWithPinnedTweet(accessToken);
  return result;
}

// ============================================================================
// GROK API FUNCTIONS
// ============================================================================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Build prompt for Grok-only analysis (uses Grok's native X/Twitter access)
function buildGrokNativeAnalysisPrompt(
  username: string,
  displayName: string,
  bio?: string,
  followersCount?: number
): string {
  return `You are an expert personality analyst with access to X/Twitter data. Analyze the Twitter/X user @${username} and create a detailed personality profile.

=== USER INFO ===
Username: @${username}
Display Name: ${displayName}
${bio ? `Bio: "${bio}"` : ''}
${followersCount ? `Followers: ${followersCount}` : ''}

=== YOUR TASK ===
Using your access to X/Twitter data, analyze @${username}'s recent tweets, replies, and interactions. Look at their ACTUAL content to identify:

1. **Signature Phrases**: Words or expressions they use repeatedly
2. **Writing Style**: Punctuation habits, capitalization, emoji usage, sentence length
3. **Personality Traits**: Based on how they express themselves (provide evidence)
4. **Topics & Expertise**: What they genuinely care about and know well
5. **Humor Style**: How (or if) they use humor
6. **Interaction Style**: How they engage with others

Respond with this exact JSON structure:
{
  "signaturePhrases": ["phrases they actually use"],
  "vocabularyLevel": "technical|casual|mixed|academic",
  "sentenceStructure": "description of their sentence patterns",
  "punctuationStyle": "their punctuation habits",
  "capitalizationHabits": "ALL CAPS emphasis? lowercase? Standard?",
  "emojiPatterns": ["emojis they use, or empty if none"],
  "hashtagUsage": "how they use hashtags",
  
  "coreTraits": [
    {"trait": "specific trait", "evidence": "example from their tweets"}
  ],
  "emotionalPatterns": ["observed emotional expressions"],
  "humorStyle": "description of humor style or 'minimal/none'",
  
  "primaryTopics": ["topics they tweet about frequently"],
  "expertiseAreas": ["areas where they show knowledge"],
  "passionateAbout": ["things they show enthusiasm for"],
  
  "interactionStyle": "how they engage with others",
  "responsePatterns": "how they typically respond",
  "communityRole": "observer|commenter|creator|thought-leader|entertainer",
  
  "bio": [
    "3-5 sentences capturing their authentic voice",
    "Written in a way that reflects their actual style"
  ],
  "lore": ["background inferred from their tweets"],
  "knowledge": ["specific knowledge areas"],
  "adjectives": ["adjectives describing their persona"],
  "styleTraits": {
    "all": ["general style traits"],
    "chat": ["conversation style traits"],
    "post": ["posting style traits"]
  }
}

CRITICAL: Be specific to @${username}. Analyze their ACTUAL tweets. Don't generate generic descriptions.`;
}

// Build prompt for generating examples using Grok's native access
function buildGrokNativeExamplesPrompt(
  username: string,
  analysis: DeepPersonalityAnalysis
): string {
  return `Based on your analysis of @${username}, generate authentic examples that match their exact voice.

=== PERSONALITY ANALYSIS ===
Signature Phrases: ${analysis.signaturePhrases.join(', ')}
Vocabulary: ${analysis.vocabularyLevel}
Sentence Style: ${analysis.sentenceStructure}
Emoji Usage: ${analysis.emojiPatterns.join(', ') || 'None'}
Humor Style: ${analysis.humorStyle}
Topics: ${analysis.primaryTopics.join(', ')}
Core Traits: ${analysis.coreTraits.map(t => t.trait).join(', ')}

=== TASK ===
Generate examples that would be INDISTINGUISHABLE from the real @${username}.

Respond with this JSON:
{
  "messageExamples": [
    [
      {"user": "{{user1}}", "content": {"text": "natural conversation starter"}},
      {"user": "${username}_alterego", "content": {"text": "response in EXACTLY their style"}}
    ]
  ],
  "postExamples": [
    "Tweet matching their exact voice, phrases, and patterns",
    "Another authentic tweet example",
    "Use their actual style - punctuation, emojis, tone"
  ],
  "topics": ["refined topic list based on analysis"]
}

REQUIREMENTS:
- Generate 7-10 postExamples matching their voice
- Generate 5 messageExamples showing conversation style
- Use their signature phrases naturally
- Match their exact punctuation and emoji patterns
- Capture what makes them UNIQUE`;
}

// Build the deep analysis prompt with actual tweet content (for Twitter API mode)
function buildDeepAnalysisPrompt(
  userProfile: TwitterProfileWithPinned,
  tweets: TwitterTweet[]
): string {
  // Categorize tweets
  const originalTweets = tweets.filter(t => !t.in_reply_to_user_id);
  const replies = tweets.filter(t => t.in_reply_to_user_id);
  
  // Sort by engagement for analysis
  const sortedByEngagement = [...tweets].sort((a, b) => {
    const aScore = (a.public_metrics?.like_count || 0) + (a.public_metrics?.retweet_count || 0) * 2;
    const bScore = (b.public_metrics?.like_count || 0) + (b.public_metrics?.retweet_count || 0) * 2;
    return bScore - aScore;
  });
  
  // Format tweets for analysis
  const formatTweet = (t: TwitterTweet, includeMetrics: boolean = true): string => {
    const metrics = t.public_metrics;
    const metricsStr = includeMetrics && metrics 
      ? ` [❤️${metrics.like_count} 🔁${metrics.retweet_count}]`
      : '';
    return `"${t.text}"${metricsStr}`;
  };

  // Calculate account age
  const accountAge = userProfile.created_at 
    ? Math.floor((Date.now() - new Date(userProfile.created_at).getTime()) / (1000 * 60 * 60 * 24 * 365))
    : null;

  const topTweets = sortedByEngagement.slice(0, 5).map(t => formatTweet(t)).join('\n\n');
  const recentOriginal = originalTweets.slice(0, 10).map(t => formatTweet(t, false)).join('\n\n');
  const replySample = replies.slice(0, 5).map(t => formatTweet(t, false)).join('\n\n');

  return `Analyze this Twitter user to create an ACCURATE personality clone. Use ALL the context below.

══════════════════════════════════════════════════════════════
📋 PROFILE (THIS IS KEY IDENTITY CONTEXT)
══════════════════════════════════════════════════════════════
Username: @${userProfile.username}
Display Name: ${userProfile.name}
${userProfile.verified ? '✓ Verified Account' : ''}

📝 BIO (User's self-description - VERY IMPORTANT):
"${userProfile.description || 'No bio set'}"

📍 Location: ${userProfile.location || 'Not specified'}
🔗 Website: ${userProfile.url || 'None'}
📅 Account Age: ${accountAge ? `${accountAge} years on Twitter` : 'Unknown'}
👥 Followers: ${userProfile.public_metrics?.followers_count?.toLocaleString() || 0}
👤 Following: ${userProfile.public_metrics?.following_count?.toLocaleString() || 0}
📊 Total Tweets: ${userProfile.public_metrics?.tweet_count?.toLocaleString() || 0}

${userProfile.pinned_tweet ? `══════════════════════════════════════════════════════════════
📌 PINNED TWEET (What they want people to see FIRST)
══════════════════════════════════════════════════════════════
"${userProfile.pinned_tweet.text}"
${userProfile.pinned_tweet.public_metrics ? `[❤️${userProfile.pinned_tweet.public_metrics.like_count} 🔁${userProfile.pinned_tweet.public_metrics.retweet_count}]` : ''}
` : ''}
══════════════════════════════════════════════════════════════
🏆 TOP TWEETS BY ENGAGEMENT (Their best content)
══════════════════════════════════════════════════════════════
${topTweets}

══════════════════════════════════════════════════════════════
📝 RECENT ORIGINAL TWEETS (Their current voice)
══════════════════════════════════════════════════════════════
${recentOriginal}

${replies.length > 0 ? `══════════════════════════════════════════════════════════════
💬 REPLY SAMPLES (How they interact)
══════════════════════════════════════════════════════════════
${replySample}` : ''}

══════════════════════════════════════════════════════════════
🎯 YOUR TASK
══════════════════════════════════════════════════════════════
Create a personality profile that captures THIS SPECIFIC PERSON. Use:
- Their BIO to understand how they see themselves
- Their PINNED TWEET to understand what they prioritize
- Their TOP TWEETS to understand their strengths
- Their RECENT TWEETS to understand their current voice
- Their REPLIES to understand how they interact

Respond with this JSON (every field MUST reference actual content above):
{
  "signaturePhrases": ["exact phrases they use"],
  "vocabularyLevel": "technical|casual|mixed|academic",
  "sentenceStructure": "their sentence patterns",
  "punctuationStyle": "their punctuation habits",
  "capitalizationHabits": "their capitalization style",
  "emojiPatterns": ["emojis they use"],
  "hashtagUsage": "their hashtag patterns",
  
  "coreTraits": [
    {"trait": "trait name", "evidence": "quote proving it"}
  ],
  "emotionalPatterns": ["how they express emotions"],
  "humorStyle": "their humor approach",
  
  "primaryTopics": ["what they actually tweet about"],
  "expertiseAreas": ["what they know well"],
  "passionateAbout": ["what excites them"],
  
  "interactionStyle": "how they engage",
  "responsePatterns": "reply style",
  "communityRole": "their role in community",
  
  "bio": [
    "Sentence 1 capturing their voice",
    "Sentence 2 about their focus",
    "Sentence 3 about their style"
  ],
  "lore": ["background from their content"],
  "knowledge": ["expertise areas"],
  "adjectives": ["words describing them"],
  "styleTraits": {
    "all": ["overall traits"],
    "chat": ["conversation traits"],
    "post": ["posting traits"]
  }
}`;
}

// Build prompt for generating examples based on analysis
function buildExamplesPrompt(
  userProfile: TwitterUser,
  tweets: TwitterTweet[],
  analysis: DeepPersonalityAnalysis
): string {
  // Get highest engagement original tweets for examples
  const originalTweets = tweets.filter(t => !t.in_reply_to_user_id);
  const topOriginal = [...originalTweets]
    .sort((a, b) => {
      const aScore = (a.public_metrics?.like_count || 0) + (a.public_metrics?.retweet_count || 0) * 2;
      const bScore = (b.public_metrics?.like_count || 0) + (b.public_metrics?.retweet_count || 0) * 2;
      return bScore - aScore;
    })
    .slice(0, 15);

  const actualTweets = topOriginal.map(t => `"${t.text}"`).join('\n');
  
  const replies = tweets.filter(t => t.in_reply_to_user_id).slice(0, 10);
  const replyTexts = replies.map(t => `"${t.text}"`).join('\n');

  return `Generate character card examples that perfectly match @${userProfile.username}'s voice.

=== PERSONALITY ANALYSIS ===
Signature Phrases: ${analysis.signaturePhrases.join(', ')}
Vocabulary: ${analysis.vocabularyLevel}
Sentence Style: ${analysis.sentenceStructure}
Emoji Usage: ${analysis.emojiPatterns.join(', ') || 'None'}
Humor Style: ${analysis.humorStyle}
Topics: ${analysis.primaryTopics.join(', ')}

=== THEIR ACTUAL HIGH-PERFORMING TWEETS ===
${actualTweets}

${replies.length > 0 ? `=== THEIR ACTUAL REPLIES ===
${replyTexts}` : ''}

=== TASK ===
Generate examples that would be INDISTINGUISHABLE from the real @${userProfile.username}.

Respond with this JSON:
{
  "messageExamples": [
    [
      {"user": "{{user1}}", "content": {"text": "natural conversation starter"}},
      {"user": "${userProfile.username}_alterego", "content": {"text": "response in EXACTLY their style, using their phrases and patterns"}}
    ]
  ],
  "postExamples": [
    "Tweet that matches their EXACT voice and style",
    "Use their actual phrases and patterns",
    "Match their punctuation, emoji use, and tone"
  ],
  "topics": ["refined list of their actual topics based on tweet analysis"]
}

REQUIREMENTS:
- postExamples: 7-10 tweets that match their authentic voice
- messageExamples: 5 conversation pairs showing how they'd respond
- Use their ACTUAL phrases, topics, and style
- Match their exact punctuation and emoji patterns
- Don't make them sound generic - capture what makes them UNIQUE`;
}

// Call Grok API with retry logic
async function callGrokAPI<T>(
  prompt: string,
  systemPrompt: string,
  grokApiKey: string,
  maxRetries: number = 3
): Promise<T> {
  console.log('Calling Grok API...');
  
  const requestBody = {
    model: 'grok-3-latest',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    stream: false,
    temperature: 0.3,
  };

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      const waitTime = (attempt * 15) * 1000;
      console.log(`Retrying in ${waitTime / 1000}s (attempt ${attempt + 1}/${maxRetries})...`);
      await delay(waitTime);
    }

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${grokApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('Empty response from Grok API');
      }

      // Parse JSON, handling markdown code blocks
      let jsonContent = content.trim();
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.slice(7);
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.slice(3);
      }
      if (jsonContent.endsWith('```')) {
        jsonContent = jsonContent.slice(0, -3);
      }
      
      try {
        return JSON.parse(jsonContent.trim());
      } catch (e) {
        console.error('Failed to parse Grok response:', content.substring(0, 500));
        throw new Error('Failed to parse Grok API response as JSON');
      }
    }

    const errorText = await response.text();
    console.error(`Grok API error (attempt ${attempt + 1}):`, response.status, errorText);
    
    if (response.status === 429 && attempt < maxRetries - 1) {
      lastError = new Error('Rate limited');
      continue;
    }

    let errorMessage = `Grok API error: ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
    } catch {
      // Use status code
    }
    throw new Error(errorMessage);
  }

  throw lastError || new Error('Failed after multiple retries');
}

// ============================================================================
// TWO-PASS ANALYSIS
// ============================================================================

async function performDeepAnalysis(
  userProfile: TwitterProfileWithPinned,
  tweets: TwitterTweet[],
  grokApiKey: string
): Promise<DeepPersonalityAnalysis> {
  console.log('Pass 1: Deep personality analysis...');
  
  const systemPrompt = `You are an expert personality analyst specializing in social media behavior analysis.
Your task is to create accurate, nuanced personality profiles by analyzing ACTUAL tweet content.
Focus on: voice authenticity, unique phrases, emotional patterns, expertise areas, and communication quirks.
CRITICAL: Never generate generic descriptions. Every trait must be evidenced by the provided tweets.
If something cannot be determined from the tweets, explicitly state that rather than guessing.`;

  const prompt = buildDeepAnalysisPrompt(userProfile, tweets);
  return callGrokAPI<DeepPersonalityAnalysis>(prompt, systemPrompt, grokApiKey);
}

async function generateCharacterExamples(
  userProfile: TwitterUser,
  tweets: TwitterTweet[],
  analysis: DeepPersonalityAnalysis,
  grokApiKey: string
): Promise<CharacterCardGeneration> {
  console.log('Pass 2: Generating authentic examples...');
  
  const systemPrompt = `You are an expert at replicating writing styles and creating authentic voice clones.
Your task is to generate content that perfectly matches a specific Twitter user's voice.
Use their exact phrases, patterns, punctuation style, and topic preferences.
The generated content should be INDISTINGUISHABLE from their real tweets.`;

  const prompt = buildExamplesPrompt(userProfile, tweets, analysis);
  return callGrokAPI<CharacterCardGeneration>(prompt, systemPrompt, grokApiKey);
}

// ============================================================================
// CHARACTER CARD BUILDING
// ============================================================================

function calculatePostingFrequency(tweets: TwitterTweet[]): number {
  if (tweets.length < 2) return 240; // Default 4 hours

  // Sort by date
  const sortedTweets = [...tweets].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const newest = new Date(sortedTweets[0].created_at).getTime();
  const oldest = new Date(sortedTweets[sortedTweets.length - 1].created_at).getTime();
  const daysDiff = (newest - oldest) / (1000 * 60 * 60 * 24);
  
  if (daysDiff < 1) return 120; // Very active, post every 2 hours
  
  const avgPostsPerDay = tweets.length / daysDiff;
  const intervalMinutes = (24 * 60) / avgPostsPerDay;
  
  // Clamp between 1 hour and 12 hours
  return Math.max(60, Math.min(720, Math.round(intervalMinutes)));
}

function buildCharacterCard(
  userProfile: TwitterUser,
  tweets: TwitterTweet[],
  analysis: DeepPersonalityAnalysis,
  examples: CharacterCardGeneration
): ElizaOSCharacterCard {
  const username = userProfile.username || 'user';
  const name = `${username}_alterego`;

  // Use actual high-engagement tweets as fallback post examples
  const topTweets = [...tweets]
    .filter(t => !t.in_reply_to_user_id && t.text.length > 20 && t.text.length < 280)
    .sort((a, b) => {
      const aScore = (a.public_metrics?.like_count || 0) + (a.public_metrics?.retweet_count || 0) * 2;
      const bScore = (b.public_metrics?.like_count || 0) + (b.public_metrics?.retweet_count || 0) * 2;
      return bScore - aScore;
    })
    .slice(0, 7)
    .map(t => t.text);

  // Merge AI-generated examples with actual tweets
  const postExamples = examples.postExamples.length >= 5 
    ? examples.postExamples 
    : [...examples.postExamples, ...topTweets].slice(0, 10);

  return {
    name,
    clients: ['twitter'],
    modelProvider: 'grok',
    settings: {
      voice: {
        model: 'en_US-GuyNeural'
      }
    },
    plugins: [],
    bio: analysis.bio.length >= 2 ? analysis.bio : [
      `Digital alter ego of @${username}.`,
      `${userProfile.description || 'Engaging authentically on Twitter.'}`,
      `Known for insights on ${analysis.primaryTopics.slice(0, 2).join(' and ')}.`
    ],
    lore: analysis.lore.length >= 1 ? analysis.lore : [
      `Active Twitter presence since ${userProfile.created_at ? new Date(userProfile.created_at).getFullYear() : 'years ago'}.`,
      `Built a community of ${userProfile.public_metrics?.followers_count || 'many'} followers.`,
      userProfile.description || 'Building an authentic online presence.'
    ],
    knowledge: analysis.knowledge.length >= 3 
      ? analysis.knowledge 
      : [...analysis.expertiseAreas, ...analysis.primaryTopics.slice(0, 3)],
    messageExamples: examples.messageExamples.length >= 3 
      ? examples.messageExamples 
      : generateFallbackMessageExamples(name, analysis),
    postExamples,
    topics: examples.topics.length >= 3 
      ? examples.topics 
      : analysis.primaryTopics,
    style: {
      all: analysis.styleTraits.all.length >= 3 
        ? analysis.styleTraits.all 
        : analysis.adjectives.slice(0, 5),
      chat: analysis.styleTraits.chat.length >= 3 
        ? analysis.styleTraits.chat 
        : ['Conversational', 'Engaging', 'Authentic'],
      post: analysis.styleTraits.post.length >= 3 
        ? analysis.styleTraits.post 
        : ['On-brand', 'Distinctive', 'Genuine']
    },
    adjectives: analysis.adjectives.length >= 3 
      ? analysis.adjectives 
      : ['Authentic', 'Engaging', 'Thoughtful', 'Distinctive'],
    schedule: {
      intervalMinutes: calculatePostingFrequency(tweets),
      enabled: true
    },
    commenting: {
      enabled: true
    }
  };
}

function generateFallbackMessageExamples(
  name: string, 
  analysis: DeepPersonalityAnalysis
): Array<Array<{ user: string; content: { text: string } }>> {
  const topics = analysis.primaryTopics || ['interesting topics'];
  
  return [
    [
      { user: '{{user1}}', content: { text: "What's been on your mind lately?" } },
      { user: name, content: { text: `Been thinking a lot about ${topics[0] || 'current events'}. It's fascinating how things are evolving.` } }
    ],
    [
      { user: '{{user1}}', content: { text: "Any thoughts on this?" } },
      { user: name, content: { text: `${analysis.interactionStyle === 'direct' ? 'Here\'s my take:' : 'Interesting question.'} I think context matters a lot here.` } }
    ],
    [
      { user: '{{user1}}', content: { text: "What do you think about the latest news?" } },
      { user: name, content: { text: `There's a lot to unpack. My focus is usually on ${topics[1] || topics[0] || 'the bigger picture'}.` } }
    ]
  ];
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { user_id, access_token, twitter_user_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get environment variables
    const grokApiKey = Deno.env.get('GROK_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY');

    if (!grokApiKey) {
      return new Response(
        JSON.stringify({ error: 'Grok API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('=== Starting Character Card Generation ===');

    // Step 1: Get user data from database
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('twitter_username, twitter_user_id, twitter_access_token, full_name, profile_photo_url')
      .eq('id', user_id)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found. Please connect Twitter account first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use provided access_token or fall back to stored one
    const twitterAccessToken = access_token || profile.twitter_access_token;
    const twitterUserId = twitter_user_id || profile.twitter_user_id;

    if (!twitterAccessToken) {
      return new Response(
        JSON.stringify({ error: 'Twitter access token not found. Please reconnect your Twitter account.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!twitterUserId) {
      return new Response(
        JSON.stringify({ error: 'Twitter user ID not found. Please reconnect your Twitter account.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating character card for Twitter user ${twitterUserId}`);
    console.log(`Mode: ${USE_TWITTER_API_FOR_TWEETS ? 'Twitter API + Grok' : 'Grok Native Analysis (rate-limit friendly)'}`);

    let userProfile: TwitterUser;
    let tweets: TwitterTweet[] = [];
    let analysis: DeepPersonalityAnalysis;
    let examples: CharacterCardGeneration;
    let analysisMethod: string;

    if (USE_TWITTER_API_FOR_TWEETS) {
      // ========================================
      // MODE 1: Twitter API + Grok (2 API calls total)
      // ========================================
      let profileWithPinned: TwitterProfileWithPinned;
      
      try {
        // Optimized: 2 API calls only
        // Call 1: Profile + Pinned Tweet (via expansion)
        // Call 2: Recent Tweets (limited to TWEETS_TO_FETCH)
        profileWithPinned = await fetchUserProfileWithPinnedTweet(twitterAccessToken);
        tweets = await fetchUserTweets(twitterAccessToken, profileWithPinned.id, TWEETS_TO_FETCH);
        userProfile = profileWithPinned;
        
        console.log(`✓ Profile: @${profileWithPinned.username}`);
        console.log(`✓ Bio: "${profileWithPinned.description?.substring(0, 50)}..."`);
        console.log(`✓ Pinned: ${profileWithPinned.pinned_tweet ? 'Yes' : 'No'}`);
        console.log(`✓ Tweets: ${tweets.length}`);
      } catch (twitterError) {
        console.error('Twitter API error:', twitterError);
        return new Response(
          JSON.stringify({ 
            error: `Failed to fetch Twitter data: ${twitterError.message}`,
            suggestion: 'Your Twitter token may have expired. Please reconnect your account.'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (tweets.length === 0) {
        return new Response(
          JSON.stringify({ 
            error: 'No tweets found for analysis.',
            suggestion: 'Make sure your account has public tweets and try again.'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        // Pass profile with pinned tweet for richer context
        analysis = await performDeepAnalysis(profileWithPinned, tweets, grokApiKey);
        examples = await generateCharacterExamples(userProfile, tweets, analysis, grokApiKey);
        analysisMethod = 'twitter_api_plus_grok';
      } catch (grokError) {
        console.error('Grok API error:', grokError);
        return new Response(
          JSON.stringify({ 
            error: `AI analysis failed: ${grokError.message}`,
            details: 'The personality analysis service encountered an error.'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // ========================================
      // MODE 2: Grok Native Analysis (no rate limits)
      // ========================================
      // Use stored profile data from database + Grok's native X/Twitter access
      userProfile = {
        id: twitterUserId,
        name: profile.full_name || profile.twitter_username,
        username: profile.twitter_username,
        profile_image_url: profile.profile_photo_url || undefined,
      };

      const systemPrompt = `You are an expert personality analyst with native access to X/Twitter data.
Your task is to analyze Twitter users and create accurate personality profiles.
You can access their tweets, replies, likes, and interactions directly.
Always respond with valid JSON only. Be specific and evidence-based.`;

      try {
        // Pass 1: Deep analysis using Grok's native Twitter access
        console.log('Pass 1: Grok native personality analysis...');
        const analysisPrompt = buildGrokNativeAnalysisPrompt(
          profile.twitter_username,
          profile.full_name || profile.twitter_username,
          undefined, // Bio will be fetched by Grok
          undefined
        );
        analysis = await callGrokAPI<DeepPersonalityAnalysis>(analysisPrompt, systemPrompt, grokApiKey);
        console.log('Completed Grok native analysis');

        // Pass 2: Generate examples using Grok's knowledge
        console.log('Pass 2: Generating authentic examples...');
        const examplesPrompt = buildGrokNativeExamplesPrompt(profile.twitter_username, analysis);
        examples = await callGrokAPI<CharacterCardGeneration>(examplesPrompt, systemPrompt, grokApiKey);
        console.log('Generated character examples');

        analysisMethod = 'grok_native_analysis';
      } catch (grokError) {
        console.error('Grok API error:', grokError);
        return new Response(
          JSON.stringify({ 
            error: `AI analysis failed: ${grokError.message}`,
            details: 'The personality analysis service encountered an error.'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Build the character card
    const characterCard = buildCharacterCard(userProfile, tweets, analysis, examples);
    console.log('Character card built successfully');

    // Cache data if we fetched from Twitter API
    if (USE_TWITTER_API_FOR_TWEETS && tweets.length > 0) {
      try {
        await supabaseAdmin
          .from('twitter_data_cache')
          .upsert({
            user_id,
            profile_data: userProfile,
            tweets_data: { tweets: tweets.slice(0, 50) },
            engagement_stats: {
              total_tweets_analyzed: tweets.length,
              avg_likes: tweets.reduce((sum, t) => sum + (t.public_metrics?.like_count || 0), 0) / tweets.length,
              avg_retweets: tweets.reduce((sum, t) => sum + (t.public_metrics?.retweet_count || 0), 0) / tweets.length,
            },
            cached_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          }, { onConflict: 'user_id' });
      } catch (cacheError) {
        console.warn('Failed to cache Twitter data:', cacheError);
      }
    }

    // Calculate profile scores
    const scores = calculateProfileScores(tweets, userProfile, analysis);
    
    console.log('=== Character Card Generation Complete ===');

    return new Response(
      JSON.stringify({
        success: true,
        character_card: characterCard,
        twitter_profile: {
          id: userProfile.id,
          username: userProfile.username,
          name: userProfile.name,
          profile_image_url: userProfile.profile_image_url,
          followers_count: userProfile.public_metrics?.followers_count,
          following_count: userProfile.public_metrics?.following_count,
          tweet_count: userProfile.public_metrics?.tweet_count,
          listed_count: userProfile.public_metrics?.listed_count,
        },
        profile_scores: scores,
        analysis_metadata: {
          method: analysisMethod,
          tweets_analyzed: tweets.length,
          generated_at: new Date().toISOString(),
          analysis_summary: {
            primary_topics: analysis.primaryTopics,
            core_traits: analysis.coreTraits.map(t => t.trait),
            vocabulary_level: analysis.vocabularyLevel,
            humor_style: analysis.humorStyle,
          }
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating character card:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to generate character card',
        details: error.toString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
