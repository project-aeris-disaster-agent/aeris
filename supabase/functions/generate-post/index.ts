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
  post_style: string;
  post_examples: string;
  custom_tags?: string[];
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
      post_style,
      post_examples,
      custom_tags,
    }: GeneratePostRequest = await req.json();

    // Debug logging
    console.log('Received custom_tags:', custom_tags);
    console.log('Custom tags length:', custom_tags?.length || 0);

    // Determine which topics to use: custom tags take priority, otherwise use character card topics
    const topicsToFocus = custom_tags && custom_tags.length > 0 
      ? custom_tags 
      : character_card.topics.slice(0, 5);
    
    console.log('Topics to focus on:', topicsToFocus);
    
    const topicsText = topicsToFocus.join(', ');

    // Build system prompt - straightforward and clear
    const systemPrompt = `You are ${character_card.name}, an AI alter ego with a unique voice and personality.

YOUR IDENTITY:
${bio}

Expertise: ${character_card.knowledge.join(', ')}

${custom_tags && custom_tags.length > 0 
  ? `REQUIRED FOCUS TOPICS (the post MUST be about these):\n${custom_tags.map((tag, idx) => `- ${tag}`).join('\n')}`
  : `Interests: ${topicsText}`}

POSTING STYLE:
${post_style}

Example posts matching your voice:
${post_examples}

${conversation_context ? `Recent conversation context:\n${conversation_context}` : ''}

Generate a social media post (50-280 characters) that:
- Matches your authentic voice from the examples
- ${custom_tags && custom_tags.length > 0 
    ? `Is DIRECTLY about these topics: ${topicsText}` 
    : `Relates to your interests: ${topicsText}`}
- Sounds natural and authentic, not generic
- No hashtags unless that's your style
- No emojis unless that's your style

Return ONLY the post text, nothing else.`;

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
            content: custom_tags && custom_tags.length > 0
              ? `Write a post about these topics: ${custom_tags.join(', ')}. Make it engaging and true to my voice.`
              : 'Write a post that I would naturally share on social media right now.',
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

    // Extract suggested topics - use custom tags if provided, otherwise use character card topics
    const suggestedTopics = custom_tags && custom_tags.length > 0 
      ? custom_tags 
      : character_card.topics.slice(0, 3);

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

