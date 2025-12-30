// Supabase Edge Function: Chat with AI Clone
// Handles conversations using character card personality context
// Now uses shared response generation for consistent intelligence

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '../_shared/rateLimit.ts';
import { generateResponse, type CharacterCard, type PersonalityMetadata, type ConversationMessage } from '../_shared/generateResponse.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatRequest {
  user_id: string;
  session_id: string;
  message: string;
  character_card: CharacterCard;
  conversation_history: ConversationMessage[];
  personality_metadata?: PersonalityMetadata;
}

// Main handler
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { user_id, session_id, message, character_card, conversation_history, personality_metadata } = await req.json() as ChatRequest;

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
    console.log(`Has personality metadata: ${!!personality_metadata}`);

    // Extract recent assistant responses for repetition detection
    const recentResponses = (conversation_history || [])
      .filter(m => m.role === 'assistant')
      .slice(-5) // Last 5 assistant responses
      .map(m => m.content);

    // Use shared response generation function
    const result = await generateResponse({
      characterCard: character_card,
      userMessage: message,
      personalityMetadata: personality_metadata,
      conversationHistory: conversation_history || [],
      recentResponses,
      enforceOneSentence: true, // Chat mode: enforce 1 sentence
      mode: 'chat',
      grokApiKey,
    });

    if (!result) {
      throw new Error('Failed to generate response');
    }

    const { response, tokens_used } = result;

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

