// Supabase Edge Function: Generate Character Card
// Fetches user tweets and uses Grok API to analyze personality and generate ElizaOS character card

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
  };
}

interface TwitterUser {
  id: string;
  name: string;
  username: string;
  description?: string;
  profile_image_url?: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
  };
}

interface PersonalityAnalysis {
  personalityTraits: string[];
  writingStyle: {
    formality: string;
    tone: string;
    length: string;
    emojiUsage: string;
  };
  topics: string[];
  interests: string[];
  communicationStyle: {
    directness: string;
    engagement: string;
  };
  bio: string[];
  lore: string[];
  knowledge: string[];
  adjectives: string[];
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

// Fetch user tweets from Twitter API v2
async function fetchUserTweets(accessToken: string, userId: string, maxResults: number = 100): Promise<TwitterTweet[]> {
  const params = new URLSearchParams({
    max_results: Math.min(maxResults, 100).toString(),
    'tweet.fields': 'created_at,public_metrics',
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
    const error = await response.json().catch(() => ({ detail: 'Failed to fetch tweets' }));
    throw new Error(error.detail || error.title || 'Failed to fetch tweets');
  }

  const data = await response.json();
  return data.data || [];
}

// Fetch user profile from Twitter API v2
async function fetchUserProfile(accessToken: string): Promise<TwitterUser> {
  const response = await fetch(
    'https://api.twitter.com/2/users/me?user.fields=description,profile_image_url,public_metrics',
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to fetch profile' }));
    throw new Error(error.detail || error.title || 'Failed to fetch profile');
  }

  const data = await response.json();
  return data.data;
}

// Build a simple prompt asking Grok to analyze the Twitter user directly
// Grok has native X/Twitter access, so we don't need to provide tweets
function buildSimpleGrokPrompt(username: string, bio?: string): string {
  return `You have access to X/Twitter data. Please analyze the Twitter/X user @${username} and create a personality profile.

${bio ? `Their bio says: "${bio}"` : ''}

Based on their tweets, interactions, and online presence, provide a detailed analysis in JSON format:
{
  "personalityTraits": ["trait1", "trait2", ...],
  "writingStyle": {
    "formality": "casual|formal|mixed",
    "tone": "humorous|serious|enthusiastic|thoughtful",
    "length": "short|medium|long",
    "emojiUsage": "frequent|occasional|rare|none"
  },
  "topics": ["topic1", "topic2", ...],
  "interests": ["interest1", "interest2", ...],
  "communicationStyle": {
    "directness": "direct|indirect|balanced",
    "engagement": "high|medium|low"
  },
  "bio": ["sentence1", "sentence2", ...],
  "lore": ["background1", "background2", ...],
  "knowledge": ["expertise1", "expertise2", ...],
  "adjectives": ["adjective1", "adjective2", ...]
}

Be specific to this user's actual content and voice. Avoid generic descriptions.`;
}

// Helper function to delay execution
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Call Grok API for personality analysis with retry logic
async function analyzeWithGrok(prompt: string, grokApiKey: string, maxRetries: number = 3): Promise<PersonalityAnalysis> {
  console.log('Calling Grok API...');
  
  const requestBody = {
    model: 'grok-4-latest', // Official model name from xAI docs
    messages: [
      {
        role: 'system',
        content: 'You are an expert at analyzing social media content. Always respond with valid JSON only.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    stream: false,
    temperature: 0,
  };

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      // Longer backoff for rate limits: 15s, 30s, 45s
      const waitTime = (attempt * 15) * 1000;
      console.log(`Rate limited, waiting ${waitTime / 1000}s before retry ${attempt + 1}/${maxRetries}...`);
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
      // Success - parse and return
      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('Empty response from Grok API');
      }

      // Parse the JSON response, handling potential markdown code blocks
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
        console.error('Failed to parse Grok response:', content);
        throw new Error('Failed to parse Grok API response as JSON');
      }
    }

    // Handle errors
    const errorText = await response.text();
    console.error(`Grok API error (attempt ${attempt + 1}):`, response.status, errorText);
    
    // If rate limited (429), retry
    if (response.status === 429 && attempt < maxRetries - 1) {
      lastError = new Error('Too Many Requests');
      continue;
    }

    // Other errors - throw immediately
    let errorMessage = `Grok API error: ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
    } catch {
      // Use status code message
    }
    throw new Error(errorMessage);
  }

  // All retries exhausted
  throw lastError || new Error('Failed after multiple retries');
}

// Generate message examples from Grok analysis (no tweets needed)
function generateMessageExamples(analysis: PersonalityAnalysis, username: string): Array<Array<{ user: string; content: { text: string } }>> {
  const prompts = [
    "What's on your mind today?",
    "What do you think about this?",
    "Can you share your thoughts?",
    "What's your take on current trends?",
    "How do you see things going?"
  ];

  // Generate example responses based on personality traits and style
  const generateResponse = (prompt: string): string => {
    const tone = analysis.writingStyle.tone || 'thoughtful';
    const formality = analysis.writingStyle.formality || 'casual';
    const style = formality === 'formal' ? 'professional' : 'conversational';
    
    // Create example responses based on personality
    const responses = [
      `I've been thinking about ${analysis.topics[0] || 'recent developments'}. ${analysis.communicationStyle.directness === 'direct' ? 'Here\'s my take:' : 'It\'s interesting to consider...'}`,
      `That's a great question! ${analysis.topics[1] ? `From my perspective on ${analysis.topics[1]},` : 'Personally,'} I think it depends on the context.`,
      `Hmm, ${analysis.writingStyle.length === 'short' ? 'interesting point.' : 'that\'s something worth exploring further.'} ${analysis.communicationStyle.engagement === 'high' ? 'What do you think?' : ''}`,
      `I'm ${analysis.writingStyle.tone === 'enthusiastic' ? 'excited' : 'curious'} about this. ${analysis.topics[2] || 'There are many angles to consider.'}`,
      `${analysis.communicationStyle.directness === 'direct' ? 'Here\'s my honest take:' : 'Well, it\'s complex, but'} ${analysis.topics[0] || 'I see it this way...'}`
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  };

  return prompts.slice(0, 5).map((prompt, index) => [
    {
      user: '{{user1}}',
      content: { text: prompt }
    },
    {
      user: username,
      content: { text: generateResponse(prompt) }
    }
  ]);
}

// Generate post examples from Grok analysis (no tweets needed)
function generatePostExamples(analysis: PersonalityAnalysis, username: string): string[] {
  // Generate example posts based on personality traits, topics, and writing style
  const examples: string[] = [];
  
  const tone = analysis.writingStyle.tone || 'thoughtful';
  const formality = analysis.writingStyle.formality || 'casual';
  const length = analysis.writingStyle.length || 'medium';
  
  // Generate 5-7 example posts
  analysis.topics.slice(0, 3).forEach(topic => {
    if (length === 'short') {
      examples.push(`${topic} is fascinating. What's your take?`);
    } else if (length === 'long') {
      examples.push(`Been thinking a lot about ${topic} lately. There are so many layers to explore, and each perspective adds something valuable to the conversation. What resonates with you?`);
    } else {
      examples.push(`Exploring ${topic} has been really interesting. The nuances matter, and I'm curious about different perspectives on this.`);
    }
  });
  
  // Add personality-specific examples
  if (analysis.personalityTraits.length > 0) {
    const trait = analysis.personalityTraits[0];
    examples.push(`Sometimes ${trait.toLowerCase()} means taking a step back and seeing the bigger picture.`);
  }
  
  // Add interest-based examples
  if (analysis.interests.length > 0) {
    examples.push(`Deep dive into ${analysis.interests[0]} today. Always learning something new.`);
  }
  
  // Ensure we have at least 5 examples
  while (examples.length < 5) {
    examples.push(`Sharing thoughts on ${analysis.topics[examples.length % analysis.topics.length] || 'what matters'}. What's your perspective?`);
  }
  
  return examples.slice(0, 7);
}

// Extract chat style traits from analysis
function extractChatStyle(analysis: PersonalityAnalysis): string[] {
  const traits: string[] = [];
  
  if (analysis.communicationStyle.directness === 'direct') {
    traits.push('Direct');
  } else if (analysis.communicationStyle.directness === 'indirect') {
    traits.push('Subtle');
  }
  
  if (analysis.writingStyle.tone) {
    traits.push(analysis.writingStyle.tone.charAt(0).toUpperCase() + analysis.writingStyle.tone.slice(1));
  }
  
  if (analysis.communicationStyle.engagement === 'high') {
    traits.push('Engaging', 'Interactive');
  }
  
  if (analysis.writingStyle.formality === 'casual') {
    traits.push('Casual', 'Friendly');
  } else if (analysis.writingStyle.formality === 'formal') {
    traits.push('Professional', 'Polished');
  }
  
  return traits.length >= 3 ? traits : [...traits, 'Conversational', 'Responsive'];
}

// Extract post style traits from analysis
function extractPostStyle(analysis: PersonalityAnalysis): string[] {
  const traits: string[] = [];
  
  if (analysis.writingStyle.length === 'short') {
    traits.push('Concise', 'Punchy');
  } else if (analysis.writingStyle.length === 'long') {
    traits.push('Detailed', 'Thorough');
  }
  
  if (analysis.writingStyle.emojiUsage === 'frequent') {
    traits.push('Expressive');
  }
  
  if (analysis.communicationStyle.engagement === 'high') {
    traits.push('Engaging');
  }
  
  return traits.length >= 3 ? traits : [...traits, 'Authentic', 'On-brand'];
}

// Calculate posting frequency from engagement level (no tweets needed)
function calculatePostingFrequency(analysis: PersonalityAnalysis): number {
  // Base frequency on engagement level from analysis
  const engagement = analysis.communicationStyle.engagement || 'medium';
  
  if (engagement === 'high') {
    return 120; // 2 hours for highly engaged users
  } else if (engagement === 'low') {
    return 480; // 8 hours for less engaged users
  } else {
    return 240; // 4 hours default for medium engagement
  }
}

// Build the complete character card
function buildCharacterCard(
  analysis: PersonalityAnalysis,
  tweets: TwitterTweet[],
  userProfile: TwitterUser
): ElizaOSCharacterCard {
  const username = userProfile.username || 'user';
  const name = `${username}_alterego`;

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
      `A unique voice on Twitter known as @${username}.`,
      'Engages authentically with their community.',
      'Shares thoughts and insights on topics they care about.'
    ],
    lore: analysis.lore.length >= 1 ? analysis.lore : [
      `Active Twitter user with ${userProfile.public_metrics?.followers_count || 'many'} followers.`,
      userProfile.description || 'Building an online presence.'
    ],
    knowledge: analysis.knowledge.length >= 3 ? analysis.knowledge : [
      ...analysis.topics.slice(0, 3),
      'Social media engagement',
      'Online community building'
    ],
    messageExamples: generateMessageExamples(analysis, name),
    postExamples: generatePostExamples(analysis, username),
    topics: analysis.topics.length >= 3 ? analysis.topics : ['Technology', 'Culture', 'Current Events'],
    style: {
      all: analysis.personalityTraits.length >= 3 ? analysis.personalityTraits : ['Authentic', 'Engaging', 'Thoughtful'],
      chat: extractChatStyle(analysis),
      post: extractPostStyle(analysis)
    },
    adjectives: analysis.adjectives.length >= 3 ? analysis.adjectives : ['Unique', 'Creative', 'Insightful', 'Genuine'],
    schedule: {
      intervalMinutes: calculatePostingFrequency(analysis),
      enabled: true
    },
    commenting: {
      enabled: true
    }
  };
}

serve(async (req) => {
  // Handle CORS preflight
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

    console.log('Starting character card generation (using Grok only, no Twitter API calls)...');

    // Step 1: Get Twitter username from database (stored during login)
    // NO Twitter API calls - we only use data already stored
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('twitter_username, twitter_user_id, full_name, profile_photo_url')
      .eq('id', user_id)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found. Please connect Twitter account first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile.twitter_username) {
      return new Response(
        JSON.stringify({ error: 'Twitter username not found. Please connect Twitter account first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const twitterUsername = profile.twitter_username;
    console.log(`Generating character card for @${twitterUsername} using Grok API only`);

    // Step 2: Ask Grok to analyze the user directly (Grok has native X/Twitter access!)
    // NO Twitter API calls - Grok accesses Twitter data natively
    console.log('Asking Grok to analyze user directly...');
    const prompt = buildSimpleGrokPrompt(twitterUsername, null); // Grok will get bio from Twitter itself
    const analysis = await analyzeWithGrok(prompt, grokApiKey);
    console.log('Got personality analysis from Grok');

    // Step 3: Build character card WITHOUT fetching tweets
    // Grok has already analyzed the user's content, we don't need individual tweets
    const tweets: TwitterTweet[] = []; // Empty - Grok provides all analysis
    console.log('Building character card from Grok analysis (no tweet fetching needed)...');

    // Step 4: Build character card using minimal user info
    // Create a minimal user profile object from database data
    const userProfile: TwitterUser = {
      id: profile.twitter_user_id || '',
      name: profile.full_name || twitterUsername,
      username: twitterUsername,
      profile_image_url: profile.profile_photo_url || undefined,
    };

    const characterCard = buildCharacterCard(analysis, tweets, userProfile);
    console.log('Character card generated successfully');

    // No need to cache Twitter data - we're not using Twitter API anymore
    // Grok handles all Twitter data access natively

    return new Response(
      JSON.stringify({
        success: true,
        character_card: characterCard,
        twitter_profile: {
          id: userProfile.id,
          username: userProfile.username,
          name: userProfile.name,
          profile_image_url: userProfile.profile_image_url,
        },
        analysis_metadata: {
          method: 'grok_native_analysis',
          generated_at: new Date().toISOString(),
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

