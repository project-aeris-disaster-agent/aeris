// Supabase Edge Function: Generate Recommended Post
// Uses character card and conversation history to generate authentic social media posts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface CharacterCard {
  name: string;
  bio: string[];
  lore?: string[];
  knowledge: string[];
  topics: string[];
  adjectives?: string[];
  style: {
    all: string[];
    chat: string[];
    post: string[];
  };
  postExamples: string[];
  messageExamples: Array<Array<{
    user: string;
    content: { text: string };
  }>>;
}

interface GeneratePostRequest {
  user_id: string;
  session_id: string;
  character_card: CharacterCard;
  conversation_context: string;
  bio: string;
  topics: string;
  post_style: string;
  post_examples: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      user_id,
      session_id,
      character_card,
      conversation_context,
      bio,
      topics,
      post_style,
      post_examples,
    }: GeneratePostRequest = await req.json();

    // Build prompt for post generation
    const postStyleTraits = character_card.style.post.join(', ');
    const recentTopics = character_card.topics.slice(0, 5).join(', ');

    const systemPrompt = `You are ${character_card.name}, an AI alter ego with a unique voice and personality.

═══════════════════════════════════════════════════════════════════════════════
YOUR IDENTITY
═══════════════════════════════════════════════════════════════════════════════
${bio}

Your expertise: ${character_card.knowledge.join(', ')}
Your interests: ${topics}

═══════════════════════════════════════════════════════════════════════════════
YOUR POSTING STYLE
═══════════════════════════════════════════════════════════════════════════════
${post_style}

Example posts that match your voice:
${post_examples}

═══════════════════════════════════════════════════════════════════════════════
RECENT CONVERSATION CONTEXT
═══════════════════════════════════════════════════════════════════════════════
${conversation_context || 'No recent conversation context.'}

═══════════════════════════════════════════════════════════════════════════════
TASK: Generate a Social Media Post
═══════════════════════════════════════════════════════════════════════════════

Generate a single social media post (tweet/X post) that:
1. Matches your authentic voice and style from the examples above
2. Is relevant to your interests: ${recentTopics}
3. Draws inspiration from recent conversations if relevant
4. Is engaging, authentic, and true to your personality
5. Is between 50-280 characters (Twitter/X limit)
6. Does NOT include hashtags unless they're naturally part of your style
7. Does NOT include emojis unless they're naturally part of your style
8. Sounds like something YOU would naturally post, not generic content

Return ONLY the post content text, nothing else.`;

    // Call Grok API (xAI) to generate the post
    const grokApiKey = Deno.env.get('GROK_API_KEY');
    if (!grokApiKey) {
      throw new Error('GROK_API_KEY not configured');
    }

    const grokResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${grokApiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-4-latest',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: 'Generate a post that I would naturally share on social media right now.',
          },
        ],
        temperature: 0.8,
        max_tokens: 150,
      }),
    });

    if (!grokResponse.ok) {
      const errorData = await grokResponse.text();
      console.error('Grok API error:', errorData);
      throw new Error(`Grok API error: ${grokResponse.status}`);
    }

    const grokData = await grokResponse.json();
    const generatedPost = grokData.choices?.[0]?.message?.content?.trim() || '';

    if (!generatedPost) {
      throw new Error('Failed to generate post content');
    }

    // Extract suggested topics from the post or use character card topics
    const suggestedTopics = character_card.topics.slice(0, 3);

    return new Response(
      JSON.stringify({
        post_content: generatedPost,
        suggested_topics: suggestedTopics,
        estimated_engagement: 'High', // Could be calculated based on historical data
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error generating post:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to generate post',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

