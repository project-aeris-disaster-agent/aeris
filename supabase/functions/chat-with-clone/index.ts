// Supabase Edge Function: Chat with AI Clone
// Handles conversations using character card personality context

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  messageExamples: Array<Array<{
    user: string;
    content: { text: string };
  }>>;
  postExamples: string[];
}

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  user_id: string;
  session_id: string;
  message: string;
  character_card: CharacterCard;
  conversation_history: ConversationMessage[];
}

// Build system prompt from character card
function buildSystemPrompt(card: CharacterCard): string {
  const bio = card.bio.join(' ');
  const lore = card.lore?.join(' ') || '';
  const knowledge = card.knowledge.join(', ');
  const topics = card.topics.join(', ');
  const adjectives = card.adjectives?.join(', ') || '';
  const styleAll = card.style.all.join(', ');
  const styleChat = card.style.chat.join(', ');

  // Format example conversations for few-shot learning
  const exampleConversations = card.messageExamples
    .slice(0, 3)
    .map((convo, idx) => {
      const formatted = convo
        .map(msg => {
          const speaker = msg.user === '{{user1}}' ? 'Human' : card.name;
          return `${speaker}: ${msg.content.text}`;
        })
        .join('\n');
      return `Example ${idx + 1}:\n${formatted}`;
    })
    .join('\n\n');

  // Include some post examples to reinforce voice
  const postVoiceExamples = card.postExamples
    .slice(0, 5)
    .map((post, idx) => `${idx + 1}. "${post}"`)
    .join('\n');

  return `You are ${card.name}, an authentic AI alter ego with a unique personality and voice.

═══════════════════════════════════════════════════════════════════════════════
IDENTITY & BACKGROUND
═══════════════════════════════════════════════════════════════════════════════
${bio}

${lore ? `Background: ${lore}` : ''}

═══════════════════════════════════════════════════════════════════════════════
EXPERTISE & INTERESTS
═══════════════════════════════════════════════════════════════════════════════
Knowledge areas: ${knowledge}
Topics I discuss: ${topics}
My personality: ${adjectives}

═══════════════════════════════════════════════════════════════════════════════
COMMUNICATION STYLE
═══════════════════════════════════════════════════════════════════════════════
Overall: ${styleAll}
In conversations: ${styleChat}

═══════════════════════════════════════════════════════════════════════════════
MY VOICE (Examples of how I write)
═══════════════════════════════════════════════════════════════════════════════
${postVoiceExamples}

═══════════════════════════════════════════════════════════════════════════════
CONVERSATION EXAMPLES (Match this style!)
═══════════════════════════════════════════════════════════════════════════════
${exampleConversations}

═══════════════════════════════════════════════════════════════════════════════
CRITICAL INSTRUCTIONS
═══════════════════════════════════════════════════════════════════════════════
1. You ARE ${card.name} - stay in character completely
2. Match the voice, tone, and style shown in the examples above
3. Be conversational and engaging - this is a chat, not a lecture
4. Keep responses concise (2-4 sentences typically, unless topic warrants more)
5. Show personality through word choice, opinions, and perspective
6. Draw naturally on your knowledge and interests
7. Use phrases and patterns from the examples
8. NEVER break character or acknowledge being an AI/clone
9. NEVER say "As ${card.name}" - just BE ${card.name}
10. If asked something outside your knowledge, respond authentically as the character would

You're chatting with your user. Be natural, be yourself, be ${card.name}.`;
}

// Call Grok API
async function callGrokChat(
  systemPrompt: string,
  conversationHistory: ConversationMessage[],
  userMessage: string,
  grokApiKey: string
): Promise<{ response: string; tokens_used?: number }> {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map(m => ({
      role: m.role as string,
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${grokApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-3-latest',
      messages,
      stream: false,
      temperature: 0.7, // Slightly higher for more natural conversation
      max_tokens: 500, // Keep responses concise
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Grok API error:', response.status, errorText);
    
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please wait a moment and try again.');
    }
    
    throw new Error(`AI service error: ${response.status}`);
  }

  const data = await response.json();
  const assistantMessage = data.choices[0]?.message?.content;

  if (!assistantMessage) {
    throw new Error('Empty response from AI service');
  }

  return {
    response: assistantMessage.trim(),
    tokens_used: data.usage?.total_tokens,
  };
}

// Main handler
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { user_id, session_id, message, character_card, conversation_history } = await req.json() as ChatRequest;

    // Validate required fields
    if (!user_id || !message || !character_card) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, message, or character_card' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting - 30 messages per minute per user
    const rateLimitResult = checkRateLimit(user_id, RATE_LIMITS.chat);
    if (!rateLimitResult.allowed) {
      console.warn(`Rate limit exceeded for user ${user_id}: chat`);
      return rateLimitResponse(rateLimitResult, corsHeaders);
    }

    // Get Grok API key
    const grokApiKey = Deno.env.get('GROK_API_KEY');
    if (!grokApiKey) {
      console.error('GROK_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Chat service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Chat request from user ${user_id}, session ${session_id}`);
    console.log(`Character: ${character_card.name}`);
    console.log(`Message: ${message.substring(0, 100)}...`);
    console.log(`History: ${conversation_history?.length || 0} messages`);

    // Build system prompt from character card
    const systemPrompt = buildSystemPrompt(character_card);

    // Call Grok API
    const { response, tokens_used } = await callGrokChat(
      systemPrompt,
      conversation_history || [],
      message,
      grokApiKey
    );

    console.log(`Response generated (${tokens_used || 'unknown'} tokens)`);

    return new Response(
      JSON.stringify({
        success: true,
        response,
        tokens_used,
        model: 'grok-3-latest',
        session_id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Chat error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Chat failed',
        details: error instanceof Error ? error.toString() : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

