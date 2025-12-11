// Automation Service - Handles AI-generated post recommendations and scheduling
// Uses character card and conversation history to generate authentic posts

import { supabase } from '@/lib/supabase';
import type { ElizaOSCharacterCard, ScheduledPostsInsert, ScheduledPostType } from '@/types/database';
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
  sessionId: string,
  customTags?: string[]
): Promise<RecommendedPost> {
  try {
    // Build context from character card
    const bio = characterCard.bio.join(' ');
    const postStyle = characterCard.style.post.join(', ');
    const postExamples = characterCard.postExamples.slice(0, 5).join('\n---\n');
    
    // Get recent conversation context
    const recentContext = conversationHistory
      .slice(-10)
      .map(m => `${m.role === 'user' ? 'User' : characterCard.name}: ${m.content}`)
      .join('\n');

    // Call Edge Function to generate post
    const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-post`;
    
    const requestBody: Record<string, unknown> = {
      user_id: userId,
      session_id: sessionId,
      character_card: characterCard,
      conversation_context: recentContext,
      bio,
      post_style: postStyle,
      post_examples: postExamples,
    };

    // Only include custom_tags if provided and not empty
    if (customTags && customTags.length > 0) {
      requestBody.custom_tags = customTags;
      console.log('Sending custom_tags to edge function:', customTags);
    } else {
      console.log('No custom tags provided, using character card topics');
    }

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to generate post');
    }

    // Use custom tags if provided, otherwise use suggested topics from API or character card
    const finalTopics = customTags && customTags.length > 0 
      ? customTags 
      : (data.suggested_topics || characterCard.topics.slice(0, 3));

    return {
      content: data.post_content,
      suggestedTopics: finalTopics,
      estimatedEngagement: data.estimated_engagement,
    };
  } catch (error) {
    console.error('Error generating recommended post:', error);
    
    // Fallback: Generate a simple post based on character card
    const fallbackTopic = characterCard.topics[0] || 'thoughts';
    const fallbackStyle = characterCard.postExamples[0] || `Just thinking about ${fallbackTopic}...`;
    
    // Use custom tags if provided in fallback scenario
    const fallbackTopics = customTags && customTags.length > 0 
      ? customTags 
      : characterCard.topics.slice(0, 3);

    return {
      content: fallbackStyle,
      suggestedTopics: fallbackTopics,
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
  postType: ScheduledPostType = 'tweet',
  targetTweetId?: string
): Promise<string> {
  const posts: ScheduledPostsInsert[] = platforms.map(platform => ({
    user_id: userId,
    content,
    post_type: postType,
    scheduled_for: scheduledFor.toISOString(),
    posted_at: null,
    status: 'pending',
    error_message: null,
    target_tweet_id: targetTweetId || null,
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
 * Schedule a retweet action
 * @param userId - The user's ID
 * @param targetTweetId - The tweet ID to retweet
 * @param scheduledFor - When to execute the retweet
 * @param platform - The platform (default: 'twitter')
 */
export async function scheduleRetweet(
  userId: string,
  targetTweetId: string,
  scheduledFor: Date,
  platform: string = 'twitter'
): Promise<string> {
  return schedulePost(
    userId,
    '', // No content needed for retweets
    scheduledFor,
    [platform],
    'retweet',
    targetTweetId
  );
}

/**
 * Schedule a like action
 * @param userId - The user's ID
 * @param targetTweetId - The tweet ID to like
 * @param scheduledFor - When to execute the like
 * @param platform - The platform (default: 'twitter')
 */
export async function scheduleLike(
  userId: string,
  targetTweetId: string,
  scheduledFor: Date,
  platform: string = 'twitter'
): Promise<string> {
  return schedulePost(
    userId,
    '', // No content needed for likes
    scheduledFor,
    [platform],
    'like',
    targetTweetId
  );
}

/**
 * Schedule a comment/reply action
 * @param userId - The user's ID
 * @param targetTweetId - The tweet ID to reply to
 * @param content - The reply content
 * @param scheduledFor - When to execute the reply
 * @param platform - The platform (default: 'twitter')
 */
export async function scheduleComment(
  userId: string,
  targetTweetId: string,
  content: string,
  scheduledFor: Date,
  platform: string = 'twitter'
): Promise<string> {
  return schedulePost(
    userId,
    content,
    scheduledFor,
    [platform],
    'comment',
    targetTweetId
  );
}

/**
 * Schedule multiple engagement actions at once (for bulk operations)
 * @param userId - The user's ID
 * @param actions - Array of actions to schedule
 */
export async function scheduleEngagementActions(
  userId: string,
  actions: Array<{
    type: 'retweet' | 'like' | 'comment';
    targetTweetId: string;
    content?: string;
    scheduledFor: Date;
    platform?: string;
  }>
): Promise<string[]> {
  const results: string[] = [];

  for (const action of actions) {
    try {
      let id: string;
      switch (action.type) {
        case 'retweet':
          id = await scheduleRetweet(
            userId,
            action.targetTweetId,
            action.scheduledFor,
            action.platform
          );
          break;
        case 'like':
          id = await scheduleLike(
            userId,
            action.targetTweetId,
            action.scheduledFor,
            action.platform
          );
          break;
        case 'comment':
          if (!action.content) {
            throw new Error('Content is required for comment actions');
          }
          id = await scheduleComment(
            userId,
            action.targetTweetId,
            action.content,
            action.scheduledFor,
            action.platform
          );
          break;
      }
      results.push(id);
    } catch (error) {
      console.error(`Failed to schedule ${action.type} action:`, error);
      // Continue with other actions even if one fails
    }
  }

  return results;
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

