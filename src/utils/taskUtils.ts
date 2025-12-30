import type { ScheduledPostsRow } from '@/types/database';

/**
 * Get the source label for a scheduled post (Agent, AI, or Manual)
 */
export function getSourceLabel(post: ScheduledPostsRow): string {
  const metadata = post.post_metadata as Record<string, unknown> | null;
  if (metadata?.generated_by === 'agent_mode' || metadata?.generated_by === 'agent_mode_predicted') return 'Agent';
  if (metadata?.generated_by === 'ai') return 'AI';
  return 'Manual';
}

/**
 * Generate a Twitter/X link for a post
 */
export function getTwitterLink(post: ScheduledPostsRow): string | null {
  const metadata = post.post_metadata as Record<string, unknown> | null;
  const twitterPostId = metadata?.twitter_post_id as string;
  
  if (twitterPostId) {
    return `https://x.com/i/status/${twitterPostId}`;
  }
  
  // For retweet/like, link to the target tweet
  if (post.target_tweet_id && (post.post_type === 'retweet' || post.post_type === 'like')) {
    return `https://x.com/i/status/${post.target_tweet_id}`;
  }
  
  return null;
}

/**
 * Format a scheduled time as relative time (e.g., "In 2h", "Overdue")
 */
export function formatScheduledTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 0) return 'Overdue';
  if (diffMins < 60) return `In ${diffMins}m`;
  if (diffHours < 24) return `In ${diffHours}h ${diffMins % 60}m`;
  if (diffDays < 7) return `In ${diffDays}d ${diffHours % 24}h`;
  return date.toLocaleDateString();
}

/**
 * Format a past time as relative time (e.g., "2h ago", "Just now")
 */
export function formatTime(date: Date | null): string {
  if (!date) return 'Never';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

/**
 * Format a past time from a string (same as formatTime but accepts string)
 */
export function formatPastTime(dateStr: string | null): string {
  if (!dateStr) return 'Unknown';
  return formatTime(new Date(dateStr));
}

