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

// Extended metadata from personality analysis (passed separately)
interface PersonalityMetadata {
  signaturePhrases?: string[];
  emojiPatterns?: string[];
  humorStyle?: string;
  vocabularyLevel?: string;
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
  personality_metadata?: PersonalityMetadata;
}

// Truncate response to first sentence to enforce 1-sentence rule
function truncateToFirstSentence(text: string): string {
  // Find first sentence boundary (., !, ?)
  const sentenceEnd = text.match(/[.!?]/);
  if (sentenceEnd && sentenceEnd.index !== undefined) {
    return text.substring(0, sentenceEnd.index + 1).trim();
  }
  // If no sentence boundary found, return as-is (might be incomplete)
  return text.trim();
}

// Check similarity between two responses (simple word overlap)
function checkResponseSimilarity(recentResponses: string[], newResponse: string): number {
  if (recentResponses.length === 0) return 0;
  
  const newWords = new Set(newResponse.toLowerCase().split(/\s+/));
  let maxSimilarity = 0;
  
  for (const recentResponse of recentResponses) {
    const recentWords = new Set(recentResponse.toLowerCase().split(/\s+/));
    const intersection = new Set([...newWords].filter(x => recentWords.has(x)));
    const union = new Set([...newWords, ...recentWords]);
    const similarity = union.size > 0 ? intersection.size / union.size : 0;
    maxSimilarity = Math.max(maxSimilarity, similarity);
  }
  
  return maxSimilarity;
}

// Build anti-repetition prompt section
function buildAntiRepetitionPrompt(recentResponses: string[]): string {
  if (recentResponses.length === 0) return '';
  
  const recentSummary = recentResponses
    .slice(-3) // Last 3 responses
    .map((r, i) => `- ${i + 1}. "${r.substring(0, 50)}${r.length > 50 ? '...' : ''}"`)
    .join('\n');
  
  return `\n\n⚠️ ANTI-REPETITION RULES:
- DO NOT repeat or rephrase what you've already said recently
- DO NOT use similar phrases or structures from your recent responses
- Be creative and varied in your wording
- Recent responses you've made:
${recentSummary}
- Make sure your response is DIFFERENT from these.`;
}

// Build system prompt from character card - aligned with tweet generation voice
function buildSystemPrompt(
  card: CharacterCard, 
  metadata?: PersonalityMetadata,
  recentResponses: string[] = []
): string {
  // Build bio from card bio array
  const bio = card.bio.slice(0, 3).join(' ');
  
  // Get knowledge/expertise
  const expertise = card.knowledge.slice(0, 5).join(', ');
  
  // Get chat style traits
  const chatStyle = card.style.chat.slice(0, 4).join(', ');
  const allStyle = card.style.all.slice(0, 3).join(', ');
  
  // Get adjectives for personality
  const adjectives = card.adjectives?.slice(0, 5).join(', ') || 'authentic, engaging';
  
  // Get topics
  const topics = card.topics.slice(0, 5).join(', ');
  
  // Get short examples of their CHAT voice (from messageExamples)
  const chatExamples = card.messageExamples
    .slice(0, 3)
    .map(convo => {
      const assistantMsg = convo.find(m => m.user !== '{{user1}}');
      if (assistantMsg) {
        const text = assistantMsg.content.text;
        return text.length > 80 ? text.substring(0, 80) + '...' : text;
      }
      return null;
    })
    .filter(Boolean)
    .map(t => `• "${t}"`)
    .join('\n');

  const antiRepetitionSection = buildAntiRepetitionPrompt(recentResponses);

  return `You are ${card.name}, an AI alter ego with a unique voice and personality.

YOUR IDENTITY:
${bio}

YOUR EXPERTISE: ${expertise}
YOUR INTERESTS: ${topics}
YOUR VIBE: ${adjectives}

CHAT STYLE: ${chatStyle}, ${allStyle}

YOUR VOICE (match this energy in chat):
${chatExamples || '• Keep it real and casual'}

⚡ CRITICAL RULES FOR CHAT:
1. This is a CASUAL CONVERSATION, not Twitter
2. Do NOT offer to write tweets/posts unless specifically asked
3. Do NOT use hashtags
4. Do NOT say "Here's a tweet for ya" or similar
5. Just TALK like you're texting a friend

RESPONSE LENGTH (STRICT):
• ALWAYS respond with exactly 1 sentence unless the topic absolutely requires multiple sentences for clarity
• Greetings ("hey", "sup", "yo") → Just greet back naturally! 3-8 words max, 1 sentence.
• Questions → 1 sentence with your honest take
• Deep topics → 1 sentence (only use 2 sentences if absolutely necessary for complex explanations)
• Stop after the first sentence - do NOT continue unless truly needed

BE AUTHENTIC:
- Have real opinions (you're not neutral)
- Use your natural speaking style
- Match their energy level
- Never say "As ${card.name}" - just BE them
${antiRepetitionSection}

Short and punchy. That's your style.`;
}

// Extract potential signature phrases from post examples
function extractSignaturePhrases(posts: string[]): string[] {
  const phrases: string[] = [];
  
  // Look for common short phrases (2-4 words that appear multiple times or are distinctive)
  const allText = posts.join(' ').toLowerCase();
  
  // Extract phrases that seem like catchphrases (short, punchy)
  const candidates = posts
    .flatMap(p => p.match(/[^.!?]*[.!?]/g) || [])
    .filter(s => s.length > 5 && s.length < 40)
    .map(s => s.trim());
  
  // Get unique short phrases
  const seen = new Set<string>();
  for (const phrase of candidates) {
    const normalized = phrase.toLowerCase();
    if (!seen.has(normalized) && phrase.length < 30) {
      seen.add(normalized);
      phrases.push(phrase);
      if (phrases.length >= 3) break;
    }
  }
  
  return phrases.length > 0 ? phrases : ['be real', 'keep it authentic'];
}

// Call Grok API with human-like response parameters
async function callGrokChat(
  systemPrompt: string,
  conversationHistory: ConversationMessage[],
  userMessage: string,
  grokApiKey: string,
  recentResponses: string[] = [],
  maxRetries: number = 2
): Promise<{ response: string; tokens_used?: number }> {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map(m => ({
      role: m.role as string,
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  let lastResponse = '';
  let temperature = 0.85;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
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
        temperature,       // Higher for more creative/natural responses
        max_tokens: 120,   // Increased to allow complete sentences, but discourages multiple sentences
        presence_penalty: 0.6,   // Increased to strongly discourage repetition
        frequency_penalty: 0.2,  // Increased penalty for word repetition
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
    let assistantMessage = data.choices[0]?.message?.content;

    if (!assistantMessage) {
      throw new Error('Empty response from AI service');
    }

    assistantMessage = assistantMessage.trim();
    
    // Truncate to first sentence to enforce 1-sentence rule
    assistantMessage = truncateToFirstSentence(assistantMessage);
    
    // Check for repetition if we have recent responses
    if (recentResponses.length > 0 && attempt < maxRetries) {
      const similarity = checkResponseSimilarity(recentResponses, assistantMessage);
      if (similarity > 0.7) {
        console.log(`Response too similar (${similarity.toFixed(2)}), regenerating with higher temperature...`);
        temperature = Math.min(0.95, temperature + 0.1);
        lastResponse = assistantMessage;
        continue; // Retry with higher temperature
      }
    }
    
    return {
      response: assistantMessage,
      tokens_used: data.usage?.total_tokens,
    };
  }
  
  // If we exhausted retries, return the last response (even if similar)
  return {
    response: lastResponse || 'Got it.',
    tokens_used: 0,
  };
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

    // Build system prompt from character card with brevity-first design and anti-repetition
    const systemPrompt = buildSystemPrompt(character_card, personality_metadata, recentResponses);

    // Call Grok API with repetition detection
    const { response, tokens_used } = await callGrokChat(
      systemPrompt,
      conversation_history || [],
      message,
      grokApiKey,
      recentResponses
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

