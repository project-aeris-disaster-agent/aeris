// Automation Service - Handles AI-generated post recommendations and scheduling
// Uses character card and conversation history to generate authentic posts

import { supabase } from '@/lib/supabase';
import type { ElizaOSCharacterCard, ScheduledPostsInsert } from '@/types/database';
import type { ChatMessage } from './chatService';
import type { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as SupabaseClient<any>;

export interface RecommendedPost {
  content: string;
  suggestedTopics: string[];
  estimatedEngagement?: string;
}

export interface ScheduleOption {
  type: 'instant' | '24hrs' | '48hrs' | '72hrs' | 'daily' | 'weekly' | 'custom';
  label: string;
  scheduledFor?: Date;
}

/**
 * Generate a recommended post based on character card and conversation history
 */
export async function generateRecommendedPost(
  userId: string,
  characterCard: ElizaOSCharacterCard,
  conversationHistory: ChatMessage[],
  sessionId: string
): Promise<RecommendedPost> {
  try {
    // Build context from character card
    const bio = characterCard.bio.join(' ');
    const topics = characterCard.topics.join(', ');
    const postStyle = characterCard.style.post.join(', ');
    const postExamples = characterCard.postExamples.slice(0, 5).join('\n---\n');
    
    // Get recent conversation context
    const recentContext = conversationHistory
      .slice(-10)
      .map(m => `${m.role === 'user' ? 'User' : characterCard.name}: ${m.content}`)
      .join('\n');

    // Call Edge Function to generate post (we'll create this)
    const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-post`;
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        user_id: userId,
        session_id: sessionId,
        character_card: characterCard,
        conversation_context: recentContext,
        bio,
        topics,
        post_style: postStyle,
        post_examples: postExamples,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to generate post');
    }

    return {
      content: data.post_content,
      suggestedTopics: data.suggested_topics || characterCard.topics.slice(0, 3),
      estimatedEngagement: data.estimated_engagement,
    };
  } catch (error) {
    console.error('Error generating recommended post:', error);
    
    // Fallback: Generate a simple post based on character card
    const fallbackTopic = characterCard.topics[0] || 'thoughts';
    const fallbackStyle = characterCard.postExamples[0] || `Just thinking about ${fallbackTopic}...`;
    
    return {
      content: fallbackStyle,
      suggestedTopics: characterCard.topics.slice(0, 3),
    };
  }
}

/**
 * Schedule a post for later
 */
export async function schedulePost(
  userId: string,
  content: string,
  scheduledFor: Date,
  platforms: string[],
  postType: 'tweet' | 'reply' | 'thread' = 'tweet'
): Promise<string> {
  const posts: ScheduledPostsInsert[] = platforms.map(platform => ({
    user_id: userId,
    content,
    post_type: postType,
    scheduled_for: scheduledFor.toISOString(),
    posted_at: null,
    status: 'pending',
    error_message: null,
    post_metadata: {
      platform,
      generated_by: 'ai',
      scheduled_at: new Date().toISOString(),
    },
  }));

  const { data, error } = await db
    .from('scheduled_posts')
    .insert(posts)
    .select('id')
    .single();

  if (error) {
    console.error('Failed to schedule post:', error);
    throw new Error('Failed to schedule post');
  }

  return data.id;
}

/**
 * Post immediately to connected platforms
 */
export async function postImmediately(
  userId: string,
  content: string,
  platforms: string[]
): Promise<{ success: boolean; platform: string; error?: string }[]> {
  // This will call an Edge Function to post to Twitter/other platforms
  const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/post-to-social`;
  
  try {
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        user_id: userId,
        content,
        platforms,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to post');
    }

    return data.results || [];
  } catch (error) {
    console.error('Error posting immediately:', error);
    return platforms.map(platform => ({
      success: false,
      platform,
      error: error instanceof Error ? error.message : 'Unknown error',
    }));
  }
}

/**
 * Calculate next scheduled time based on interval
 */
export function calculateNextScheduleTime(
  interval: '24hrs' | '48hrs' | '72hrs' | 'daily' | 'weekly'
): Date {
  const now = new Date();
  const next = new Date(now);

  switch (interval) {
    case '24hrs':
      next.setHours(next.getHours() + 24);
      break;
    case '48hrs':
      next.setHours(next.getHours() + 48);
      break;
    case '72hrs':
      next.setHours(next.getHours() + 72);
      break;
    case 'daily':
      next.setDate(next.getDate() + 1);
      next.setHours(9, 0, 0, 0); // 9 AM next day
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      next.setHours(9, 0, 0, 0); // 9 AM next week
      break;
  }

  return next;
}

/**
 * Get scheduled posts for a user
 */
export async function getScheduledPosts(userId: string) {
  const { data, error } = await db
    .from('scheduled_posts')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['pending', 'posted'])
    .order('scheduled_for', { ascending: true });

  if (error) {
    console.error('Failed to fetch scheduled posts:', error);
    return [];
  }

  return data || [];
}

