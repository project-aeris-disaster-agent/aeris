import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  Repeat2,
  Heart,
  MessageSquare,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Send,
  Bot,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ScheduledPostsRow, ScheduledPostType } from '@/types/database';

interface AutomationQueueProps {
  userId: string;
  isVisible?: boolean;
}

// Action type icons and colors
const ACTION_CONFIG: Record<ScheduledPostType, { icon: typeof Send; color: string; label: string }> = {
  tweet: { icon: Send, color: 'text-blue-400', label: 'Tweet' },
  reply: { icon: MessageSquare, color: 'text-cyan-400', label: 'Reply' },
  thread: { icon: Send, color: 'text-purple-400', label: 'Thread' },
  retweet: { icon: Repeat2, color: 'text-green-400', label: 'Retweet' },
  like: { icon: Heart, color: 'text-pink-400', label: 'Like' },
  comment: { icon: MessageSquare, color: 'text-yellow-400', label: 'Comment' },
};

export function AutomationQueue({ userId, isVisible = true }: AutomationQueueProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPostsRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Fetch scheduled posts
  const fetchScheduledPosts = async () => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('scheduled_posts')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('scheduled_for', { ascending: true })
        .limit(20);

      if (error) throw error;
      setScheduledPosts(data || []);
    } catch (error) {
      console.error('Failed to fetch scheduled posts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch on mount and when expanded
  useEffect(() => {
    if (isExpanded) {
      fetchScheduledPosts();
    }
  }, [isExpanded, userId]);

  // Auto-refresh every 30 seconds when expanded
  useEffect(() => {
    if (!isExpanded) return;
    
    const interval = setInterval(fetchScheduledPosts, 30000);
    return () => clearInterval(interval);
  }, [isExpanded, userId]);

  // Cancel a scheduled post
  const handleCancel = async (postId: string) => {
    setCancellingId(postId);
    try {
      const { error } = await supabase
        .from('scheduled_posts')
        .update({ status: 'cancelled' })
        .eq('id', postId)
        .eq('user_id', userId);

      if (error) throw error;
      
      // Remove from local state
      setScheduledPosts(prev => prev.filter(p => p.id !== postId));
    } catch (error) {
      console.error('Failed to cancel post:', error);
    } finally {
      setCancellingId(null);
    }
  };

  // Format scheduled time
  const formatScheduledTime = (dateStr: string) => {
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
  };

  // Get source label (agent mode vs manual)
  const getSourceLabel = (post: ScheduledPostsRow) => {
    const metadata = post.post_metadata as Record<string, unknown> | null;
    if (metadata?.generated_by === 'agent_mode') return 'Agent';
    if (metadata?.generated_by === 'ai') return 'AI';
    return 'Manual';
  };

  const pendingCount = scheduledPosts.length;
  const agentPosts = scheduledPosts.filter(p => 
    (p.post_metadata as Record<string, unknown>)?.generated_by === 'agent_mode'
  ).length;

  if (!isVisible) return null;

  return (
    <div className="mt-2">
      {/* Queue Header Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 hover:border-white/20 transition-all p-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg border border-purple-500/30">
              <Calendar className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-left">
              <span className="text-white font-medium text-sm">Automation Queue</span>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-white/50">
                  {pendingCount} pending
                </span>
                {agentPosts > 0 && (
                  <span className="flex items-center gap-1 text-green-400/70">
                    <Bot className="w-2.5 h-2.5" />
                    {agentPosts} agent
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isLoading && <Loader2 className="w-3 h-3 text-white/40 animate-spin" />}
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-white/50" />
            ) : (
              <ChevronDown className="w-4 h-4 text-white/50" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded Queue List */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 p-3 max-h-64 overflow-y-auto">
              {scheduledPosts.length === 0 ? (
                <div className="text-center py-4">
                  <Calendar className="w-8 h-8 text-white/20 mx-auto mb-2" />
                  <p className="text-white/40 text-xs">No scheduled automations</p>
                  <p className="text-white/30 text-[10px] mt-1">
                    Posts will appear here when scheduled
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {scheduledPosts.map((post) => {
                    const config = ACTION_CONFIG[post.post_type] || ACTION_CONFIG.tweet;
                    const Icon = config.icon;
                    const sourceLabel = getSourceLabel(post);
                    const isAgent = sourceLabel === 'Agent';

                    return (
                      <motion.div
                        key={post.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className={`group relative p-2.5 rounded-lg border transition-all ${
                          isAgent 
                            ? 'bg-green-500/5 border-green-500/20 hover:border-green-500/40' 
                            : 'bg-white/5 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          {/* Action Icon */}
                          <div className={`p-1.5 rounded-lg ${
                            isAgent ? 'bg-green-500/20' : 'bg-white/10'
                          }`}>
                            <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`text-[10px] font-medium ${config.color}`}>
                                {config.label}
                              </span>
                              <span className={`px-1 py-0.5 rounded text-[8px] font-semibold ${
                                isAgent 
                                  ? 'bg-green-500/20 text-green-400' 
                                  : 'bg-white/10 text-white/50'
                              }`}>
                                {sourceLabel}
                              </span>
                            </div>
                            
                            {/* Content preview */}
                            {post.content && (
                              <p className="text-white/70 text-xs line-clamp-2 mb-1.5">
                                {post.content}
                              </p>
                            )}
                            
                            {/* Target tweet (for engagement actions) */}
                            {post.target_tweet_id && !post.content && (
                              <p className="text-white/40 text-[10px] mb-1.5">
                                Target: {post.target_tweet_id.slice(0, 10)}...
                              </p>
                            )}

                            {/* Time */}
                            <div className="flex items-center gap-1 text-white/40">
                              <Clock className="w-2.5 h-2.5" />
                              <span className="text-[10px]">
                                {formatScheduledTime(post.scheduled_for)}
                              </span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancel(post.id);
                              }}
                              disabled={cancellingId === post.id}
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 transition-colors disabled:opacity-50"
                              title="Cancel"
                            >
                              {cancellingId === post.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Refresh hint */}
              {scheduledPosts.length > 0 && (
                <p className="text-center text-white/30 text-[10px] mt-3 pt-2 border-t border-white/5">
                  Auto-refreshes every 30s • Hover to cancel
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

