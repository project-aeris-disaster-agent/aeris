// Chat Service - Handles AI clone conversations with character card context
// Uses Supabase Edge Function for Grok API calls and session management

import { supabase } from '@/lib/supabase';
import type { ElizaOSCharacterCard, AgentSessionsRow } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as SupabaseClient<any>;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface ChatSession {
  sessionId: string;
  userId: string;
  characterCard: ElizaOSCharacterCard;
  messages: ChatMessage[];
  isActive: boolean;
}

interface SendMessageResponse {
  success: boolean;
  message: ChatMessage;
  error?: string;
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get or create an active chat session for a user
 */
export async function getOrCreateSession(userId: string): Promise<string> {
  // Check for existing active session
  const { data: existingSession } = await db
    .from('agent_sessions')
    .select('session_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingSession) {
    return existingSession.session_id;
  }

  // Create new session
  const sessionId = generateSessionId();
  const { error } = await db
    .from('agent_sessions')
    .insert({
      user_id: userId,
      session_id: sessionId,
      session_name: `Chat ${new Date().toLocaleDateString()}`,
      is_active: true,
      total_messages: 0,
      total_tokens: 0,
    });

  if (error) {
    console.error('Failed to create session:', error);
    throw new Error('Failed to create chat session');
  }

  return sessionId;
}

/**
 * End a chat session
 */
export async function endSession(sessionId: string): Promise<void> {
  await db
    .from('agent_sessions')
    .update({
      is_active: false,
      ended_at: new Date().toISOString(),
    })
    .eq('session_id', sessionId);
}

/**
 * Get recent messages for a session (for context window)
 */
export async function getSessionMessages(
  sessionId: string,
  limit: number = 20
): Promise<ChatMessage[]> {
  const { data, error } = await db
    .from('chat_messages')
    .select('id, role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch messages:', error);
    return [];
  }

  return (data || []).map((msg) => ({
    id: msg.id as string,
    role: msg.role as 'user' | 'assistant' | 'system',
    content: msg.content as string,
    timestamp: new Date(msg.created_at as string),
  }));
}

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

/**
 * Save a message to the database
 */
async function saveMessage(
  userId: string,
  sessionId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  metadata?: Record<string, unknown>
): Promise<string> {
  const { data, error } = await db
    .from('chat_messages')
    .insert({
      user_id: userId,
      session_id: sessionId,
      role,
      content,
      message_metadata: metadata || {},
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to save message:', error);
    throw new Error('Failed to save message');
  }

  // Update session stats (just last_message_at - counter handled separately to avoid invalid RPC nesting)
  const { error: updateError } = await db
    .from('agent_sessions')
    .update({
      last_message_at: new Date().toISOString(),
    })
    .eq('session_id', sessionId);
  
  if (updateError) {
    console.error('Failed to update session:', updateError);
  }

  return data.id;
}

/**
 * Send a message to the AI clone and get a response
 */
export async function sendMessage(
  userId: string,
  sessionId: string,
  userMessage: string,
  characterCard: ElizaOSCharacterCard
): Promise<SendMessageResponse> {
  try {
    // 1. Save user message
    await saveMessage(userId, sessionId, 'user', userMessage);

    // 2. Get recent conversation history for context
    const recentMessages = await getSessionMessages(sessionId, 15);

    // 3. Call Edge Function for AI response
    const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-with-clone`;
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        user_id: userId,
        session_id: sessionId,
        message: userMessage,
        character_card: characterCard,
        conversation_history: recentMessages.slice(-10).map(m => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to get AI response');
    }

    // 4. Save assistant response
    const assistantMsgId = await saveMessage(
      userId,
      sessionId,
      'assistant',
      data.response,
      { tokens_used: data.tokens_used, model: data.model }
    );

    return {
      success: true,
      message: {
        id: assistantMsgId,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      },
    };
  } catch (error) {
    console.error('Chat error:', error);
    return {
      success: false,
      message: {
        id: 'error',
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your message. Please try again.',
        timestamp: new Date(),
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// CONTEXT BUILDING
// ============================================================================

/**
 * Build system prompt from character card
 * This creates the "personality" context for the AI
 */
export function buildSystemPrompt(card: ElizaOSCharacterCard): string {
  const bio = card.bio.join(' ');
  const lore = card.lore?.join(' ') || '';
  const knowledge = card.knowledge.join(', ');
  const topics = card.topics.join(', ');
  const adjectives = card.adjectives?.join(', ') || '';
  const styleAll = card.style.all.join(', ');
  const styleChat = card.style.chat.join(', ');

  // Use message examples to demonstrate the voice
  const exampleConversations = card.messageExamples
    .slice(0, 3)
    .map(convo => {
      return convo
        .map(msg => `${msg.user === '{{user1}}' ? 'User' : card.name}: ${msg.content.text}`)
        .join('\n');
    })
    .join('\n\n');

  return `You are ${card.name}, an AI alter ego with a distinct personality.

## WHO YOU ARE
${bio}

## BACKGROUND
${lore}

## YOUR EXPERTISE
You are knowledgeable about: ${knowledge}

## YOUR INTERESTS
You enjoy discussing: ${topics}

## YOUR PERSONALITY
You can be described as: ${adjectives}

## YOUR COMMUNICATION STYLE
General traits: ${styleAll}
In conversations: ${styleChat}

## EXAMPLE CONVERSATIONS (Match this voice!)
${exampleConversations}

## IMPORTANT GUIDELINES
1. Stay in character as ${card.name} at all times
2. Use the communication style and phrases shown in the examples
3. Be conversational, engaging, and authentic to the personality
4. Draw on your knowledge and interests naturally
5. Keep responses concise but meaningful (2-4 sentences typically)
6. Show personality through word choice, tone, and perspective
7. Never break character or acknowledge being an AI clone

Remember: You ARE ${card.name}. Respond as they would, with their unique voice and perspective.`;
}

/**
 * Build conversation context with recent messages
 */
export function buildConversationContext(
  messages: ChatMessage[],
  maxMessages: number = 10
): Array<{ role: string; content: string }> {
  return messages
    .slice(-maxMessages)
    .map(m => ({
      role: m.role,
      content: m.content,
    }));
}

// ============================================================================
// SESSION HISTORY
// ============================================================================

/**
 * Get all sessions for a user
 */
export async function getUserSessions(userId: string): Promise<AgentSessionsRow[]> {
  const { data, error } = await db
    .from('agent_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(20);

  if (error) {
    console.error('Failed to fetch sessions:', error);
    return [];
  }

  return data || [];
}

/**
 * Delete old sessions (cleanup)
 * Keeps sessions from last 7 days
 */
export async function cleanupOldSessions(userId: string): Promise<void> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Get old session IDs
  const { data: oldSessions } = await db
    .from('agent_sessions')
    .select('session_id')
    .eq('user_id', userId)
    .eq('is_active', false)
    .lt('ended_at', sevenDaysAgo.toISOString());

  if (!oldSessions || oldSessions.length === 0) return;

  const sessionIds = oldSessions.map((s: { session_id: string }) => s.session_id);

  // Delete messages from old sessions
  await db
    .from('chat_messages')
    .delete()
    .in('session_id', sessionIds);

  // Delete old sessions
  await db
    .from('agent_sessions')
    .delete()
    .in('session_id', sessionIds);
}

