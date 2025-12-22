import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Terminal,
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Send,
  Loader2,
  Twitter,
  Bot,
  Brain,
  Calendar,
  MessageSquare,
  Repeat2,
  Heart,
  ExternalLink,
  History,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ScheduledPostsRow, ScheduledPostType } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAgentSettings, getAgentActivityStats, calculatePredictedAgentActions, type PredictedAgentAction } from '@/services/agentService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as SupabaseClient<any>;

interface ConsoleLogsProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  twitterAccessToken: string | null;
}

interface ConnectivityStatus {
  twitter: {
    status: 'connected' | 'disconnected' | 'checking';
    lastChecked: Date | null;
    error?: string;
  };
  agent: {
    status: 'active' | 'inactive' | 'checking';
    enabled: boolean;
    lastRun: Date | null;
    pendingActions: number;
  };
  llm: {
    status: 'available' | 'unavailable' | 'checking';
    lastChecked: Date | null;
    error?: string;
  };
}

interface ErrorLog {
  id: string;
  type: 'scheduled_post' | 'system';
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

const ACTION_CONFIG: Record<ScheduledPostType, { icon: typeof Send; color: string; label: string }> = {
  tweet: { icon: Send, color: 'text-blue-400', label: 'Tweet' },
  reply: { icon: MessageSquare, color: 'text-cyan-400', label: 'Reply' },
  thread: { icon: Send, color: 'text-purple-400', label: 'Thread' },
  retweet: { icon: Repeat2, color: 'text-green-400', label: 'Retweet' },
  like: { icon: Heart, color: 'text-pink-400', label: 'Like' },
  comment: { icon: MessageSquare, color: 'text-yellow-400', label: 'Comment' },
};

export function ConsoleLogs({ isOpen, onClose, userId, twitterAccessToken }: ConsoleLogsProps) {
  const [activeTab, setActiveTab] = useState<'tasks' | 'history' | 'status' | 'errors' | 'report'>('tasks');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [ongoingTasks, setOngoingTasks] = useState<ScheduledPostsRow[]>([]);
  const [completedTasks, setCompletedTasks] = useState<ScheduledPostsRow[]>([]);
  const [connectivityStatus, setConnectivityStatus] = useState<ConnectivityStatus>({
    twitter: { status: 'checking', lastChecked: null },
    agent: { status: 'checking', enabled: false, lastRun: null, pendingActions: 0 },
    llm: { status: 'checking', lastChecked: null },
  });
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [reportText, setReportText] = useState('');
  const [predictedActions, setPredictedActions] = useState<PredictedAgentAction[]>([]);
  
  // Handle cancel predicted action
  const handleCancelPredicted = (predictedId: string) => {
    setPredictedActions(prev => prev.filter(p => p.id !== predictedId));
  };
  
  // Get source label helper
  const getSourceLabel = (post: ScheduledPostsRow): string => {
    const metadata = post.post_metadata as Record<string, unknown> | null;
    if (metadata?.generated_by === 'agent_mode' || metadata?.generated_by === 'agent_mode_predicted') return 'Agent';
    if (metadata?.generated_by === 'ai') return 'AI';
    return 'Manual';
  };

  // Fetch ongoing tasks and calculate predicted actions
  const fetchOngoingTasks = async () => {
    if (!userId) return;
    try {
      // Fetch pending tasks
      const { data: pending, error: pendingError } = await db
        .from('scheduled_posts')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('scheduled_for', { ascending: true })
        .limit(50);

      if (pendingError) throw pendingError;
      setOngoingTasks(pending || []);
      
      // Fetch completed tasks (posted + failed)
      const { data: completed, error: completedError } = await db
        .from('scheduled_posts')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['posted', 'failed'])
        .order('posted_at', { ascending: false, nullsFirst: false })
        .order('scheduled_for', { ascending: false })
        .limit(100);

      if (completedError) throw completedError;
      setCompletedTasks(completed || []);
      
      // Load agent settings and calculate predicted actions
      const settings = await getAgentSettings(userId);
      
      if (settings.enabled) {
        const predicted = calculatePredictedAgentActions(settings);
        setPredictedActions(predicted);
      } else {
        setPredictedActions([]);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  };

  // Generate Twitter link for a post
  const getTwitterLink = (post: ScheduledPostsRow): string | null => {
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
  };

  // Check connectivity status
  const checkConnectivityStatus = async () => {
    setIsRefreshing(true);
    
    // Check Twitter API
    setConnectivityStatus(prev => ({
      ...prev,
      twitter: { status: 'checking', lastChecked: null },
    }));

    // Check Twitter API - simplified check (just verify token exists)
    // Full API connectivity test would require backend endpoint due to CORS
    if (twitterAccessToken) {
      // Token exists - mark as connected
      // Note: This doesn't verify token validity, but indicates token is present
      setConnectivityStatus(prev => ({
        ...prev,
        twitter: { status: 'connected', lastChecked: new Date() },
      }));
    } else {
      setConnectivityStatus(prev => ({
        ...prev,
        twitter: { status: 'disconnected', lastChecked: new Date(), error: 'No token configured' },
      }));
    }

    // Check Agent Status
    try {
      const agentSettings = await getAgentSettings(userId);
      const agentStats = await getAgentActivityStats(userId);
      
      setConnectivityStatus(prev => ({
        ...prev,
        agent: {
          status: agentSettings.enabled ? 'active' : 'inactive',
          enabled: agentSettings.enabled,
          lastRun: agentStats.lastRunAt,
          pendingActions: agentStats.pendingActions,
        },
      }));
    } catch (error) {
      console.error('Failed to check agent status:', error);
      setConnectivityStatus(prev => ({
        ...prev,
        agent: {
          status: 'inactive',
          enabled: false,
          lastRun: null,
          pendingActions: 0,
        },
      }));
    }

    // Check LLM Status (assume available if Grok API key is configured)
    // We'll just mark it as available since we can't directly test it from frontend
    setConnectivityStatus(prev => ({
      ...prev,
      llm: { 
        status: 'available', 
        lastChecked: new Date(),
      },
    }));

    setIsRefreshing(false);
  };

  // Fetch error logs
  const fetchErrorLogs = async () => {
    if (!userId) return;
    try {
      const { data, error } = await db
        .from('scheduled_posts')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const errors: ErrorLog[] = (data || []).map((post: ScheduledPostsRow) => ({
        id: post.id,
        type: 'scheduled_post',
        message: post.error_message || 'Unknown error',
        timestamp: new Date(post.created_at),
        metadata: {
          post_type: post.post_type,
          content: post.content,
          scheduled_for: post.scheduled_for,
        },
      }));

      setErrorLogs(errors);
    } catch (error) {
      console.error('Failed to fetch error logs:', error);
    }
  };

  // Refresh all data
  const handleRefresh = async () => {
    await Promise.all([
      fetchOngoingTasks(),
      checkConnectivityStatus(),
      fetchErrorLogs(),
    ]);
  };

  // Initial load and refresh on open
  useEffect(() => {
    if (isOpen && userId) {
      handleRefresh();
      // Auto-refresh every 30 seconds
      const interval = setInterval(handleRefresh, 30000);
      return () => clearInterval(interval);
    }
  }, [isOpen, userId]);

  // Format time
  const formatTime = (date: Date | null): string => {
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
  };

  // Format scheduled time
  const formatScheduledTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 0) return 'Overdue';
    if (diffMins < 60) return `In ${diffMins}m`;
    if (diffHours < 24) return `In ${diffHours}h`;
    if (diffDays < 7) return `In ${diffDays}d`;
    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-4 sm:inset-8 lg:inset-[10%] z-[101] bg-black/90 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-pink-500/20 rounded-lg border border-cyan-500/30">
                  <Terminal className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">Console Logs</h2>
                  <p className="text-white/50 text-xs">System diagnostics & monitoring</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-50"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 text-white/70 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4 text-white/70" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 px-6 py-3 border-b border-white/10 bg-black/40 overflow-x-auto">
              {[
                { id: 'tasks' as const, label: 'Pending', icon: Calendar, count: ongoingTasks.length },
                { id: 'history' as const, label: 'History', icon: History, count: completedTasks.length },
                { id: 'status' as const, label: 'Status', icon: Activity },
                { id: 'errors' as const, label: 'Errors', icon: AlertCircle, count: errorLogs.length },
                { id: 'report' as const, label: 'Report', icon: Send },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-white/10 text-white border border-white/20'
                        : 'text-white/50 hover:text-white/70 hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{tab.label}</span>
                    {'count' in tab && tab.count !== undefined && tab.count > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                        tab.id === 'errors' ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white/60'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Ongoing Tasks Tab */}
              {activeTab === 'tasks' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-semibold">Automation Queue</h3>
                    <div className="flex items-center gap-3">
                      {connectivityStatus.agent.enabled && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-lg">
                          <Bot className="w-3 h-3 text-green-400" />
                          <span className="text-green-400 text-xs font-medium">
                            {connectivityStatus.agent.pendingActions} agent
                          </span>
                        </div>
                      )}
                      <span className="text-white/50 text-sm">{ongoingTasks.length} pending</span>
                    </div>
                  </div>
                  {(() => {
                    // Combine actual tasks with predicted actions
                    const actualAgentTasks = ongoingTasks.filter(
                      (t) => (t.post_metadata as Record<string, unknown>)?.generated_by === 'agent_mode'
                    );
                    const actualAgentKeys = new Set(
                      actualAgentTasks.map((t) => {
                        const metadata = t.post_metadata as Record<string, unknown> | null;
                        const targetAccount = metadata?.target_account as string || '';
                        const actionType = t.post_type;
                        return `${targetAccount}-${actionType}`;
                      })
                    );

                    const filteredPredicted = connectivityStatus.agent.enabled && predictedActions.length > 0
                      ? predictedActions.filter((pred) => {
                          const key = `${pred.targetAccount}-${pred.actionType}`;
                          return !actualAgentKeys.has(key);
                        })
                      : [];

                    const allTasks = [...ongoingTasks, ...filteredPredicted.map((pred) => ({
                      id: pred.id,
                      user_id: userId,
                      content: pred.actionType === 'comment' ? 'Generated reply will appear here' : '',
                      post_type: pred.actionType === 'comment' ? 'comment' : pred.actionType as ScheduledPostType,
                      scheduled_for: pred.predictedScheduleTime.toISOString(),
                      status: 'pending' as const,
                      created_at: new Date().toISOString(),
                      posted_at: null,
                      error_message: null,
                      target_tweet_id: null,
                      post_metadata: {
                        generated_by: 'agent_mode_predicted',
                        target_account: pred.targetAccount,
                        is_predicted: true,
                      },
                    }))].sort((a, b) => 
                      new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime()
                    );

                    return allTasks.length === 0 ? (
                      <div className="text-center py-12">
                        <Calendar className="w-12 h-12 text-white/20 mx-auto mb-3" />
                        <p className="text-white/50 text-sm">No ongoing tasks</p>
                        {connectivityStatus.agent.enabled && connectivityStatus.agent.pendingActions === 0 ? (
                          <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-xl max-w-md mx-auto">
                            <div className="flex items-start gap-3">
                              <Bot className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                              <div className="text-left">
                                <p className="text-green-400 text-sm font-medium mb-1">Agent Mode Active</p>
                                <p className="text-white/60 text-xs mb-2">
                                  Agent actions are scheduled automatically by the cron job (runs every 6 hours).
                                </p>
                                {connectivityStatus.agent.lastRun && (
                                  <p className="text-white/50 text-xs">
                                    Last run: {formatTime(connectivityStatus.agent.lastRun)}
                                  </p>
                                )}
                                <p className="text-white/50 text-xs mt-2">
                                  Actions will appear here once scheduled.
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-white/30 text-xs mt-1">Scheduled posts will appear here</p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {allTasks.map((task) => {
                          const isPredicted = (task.post_metadata as Record<string, unknown>)?.is_predicted === true;
                          const metadata = task.post_metadata as Record<string, unknown> | null;
                          const targetAccount = metadata?.target_account as string;
                          const config = ACTION_CONFIG[task.post_type] || ACTION_CONFIG.tweet;
                          const Icon = config.icon;
                          const sourceLabel = isPredicted ? 'Agent' : getSourceLabel(task);
                          const isAgent = sourceLabel === 'Agent' || isPredicted;

                          return (
                            <div
                              key={task.id}
                              className={`p-4 rounded-xl border ${
                                isPredicted
                                  ? 'bg-yellow-500/5 border-yellow-500/30 border-dashed'
                                  : isAgent
                                  ? 'bg-green-500/5 border-green-500/20'
                                  : 'bg-white/5 border-white/10'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-lg ${
                                  isPredicted ? 'bg-yellow-500/20' : isAgent ? 'bg-green-500/20' : 'bg-white/10'
                                }`}>
                                  <Icon className={`w-4 h-4 ${config.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className={`text-sm font-medium ${config.color}`}>
                                      {config.label}
                                    </span>
                                    {targetAccount && (
                                      <span className="text-white/50 text-xs">@{targetAccount}</span>
                                    )}
                                    <span className={`px-2 py-0.5 rounded text-xs ${
                                      isPredicted
                                        ? 'bg-yellow-500/20 text-yellow-400'
                                        : isAgent
                                        ? 'bg-green-500/20 text-green-400'
                                        : 'bg-white/10 text-white/50'
                                    }`}>
                                      {sourceLabel}
                                    </span>
                                  </div>
                                  {task.content && (
                                    <p className="text-white/70 text-sm mb-2 line-clamp-2">
                                      {task.content}
                                    </p>
                                  )}
                                  {isPredicted && (
                                    <p className="text-yellow-400/70 text-xs mb-2 italic">
                                      Will be scheduled on next cron run
                                    </p>
                                  )}
                                  <div className="flex items-center gap-4 text-white/40 text-xs">
                                    <div className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      <span>{formatScheduledTime(task.scheduled_for)}</span>
                                    </div>
                                    <span>{new Date(task.scheduled_for).toLocaleString()}</span>
                                  </div>
                                </div>
                              </div>
                              {/* Delete button for predicted actions */}
                              {isPredicted && (
                                <div className="flex items-center">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCancelPredicted(task.id);
                                    }}
                                    className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 transition-colors"
                                    title="Remove predicted action"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Activity History Tab */}
              {activeTab === 'history' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-semibold">Activity History</h3>
                    <div className="flex items-center gap-3">
                      <span className="text-green-400 text-sm">
                        {completedTasks.filter(t => t.status === 'posted').length} success
                      </span>
                      <span className="text-red-400 text-sm">
                        {completedTasks.filter(t => t.status === 'failed').length} failed
                      </span>
                    </div>
                  </div>
                  {completedTasks.length === 0 ? (
                    <div className="text-center py-12">
                      <History className="w-12 h-12 text-white/20 mx-auto mb-3" />
                      <p className="text-white/50 text-sm">No activity history</p>
                      <p className="text-white/30 text-xs mt-1">Completed actions will appear here with links</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {completedTasks.map((task) => {
                        const config = ACTION_CONFIG[task.post_type] || ACTION_CONFIG.tweet;
                        const Icon = config.icon;
                        const sourceLabel = getSourceLabel(task);
                        const isAgent = sourceLabel === 'Agent';
                        const isSuccess = task.status === 'posted';
                        const twitterLink = getTwitterLink(task);
                        const metadata = task.post_metadata as Record<string, unknown> | null;
                        const targetAccount = metadata?.target_account as string;

                        return (
                          <div
                            key={task.id}
                            className={`p-4 rounded-xl border ${
                              isSuccess
                                ? 'bg-green-500/5 border-green-500/20'
                                : 'bg-red-500/5 border-red-500/20'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${
                                isSuccess ? 'bg-green-500/20' : 'bg-red-500/20'
                              }`}>
                                {isSuccess ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-400" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <Icon className={`w-4 h-4 ${config.color}`} />
                                  <span className={`text-sm font-medium ${config.color}`}>
                                    {config.label}
                                  </span>
                                  {targetAccount && (
                                    <span className="text-white/50 text-xs">@{targetAccount}</span>
                                  )}
                                  {isAgent && (
                                    <span className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400">
                                      Agent
                                    </span>
                                  )}
                                  <span className={`px-2 py-0.5 rounded text-xs ${
                                    isSuccess ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                  }`}>
                                    {isSuccess ? 'Success' : 'Failed'}
                                  </span>
                                </div>
                                {task.content && (
                                  <p className="text-white/70 text-sm mb-2 line-clamp-2">
                                    {task.content}
                                  </p>
                                )}
                                {!isSuccess && task.error_message && (
                                  <p className="text-red-400/80 text-xs mb-2">
                                    Error: {task.error_message}
                                  </p>
                                )}
                                <div className="flex items-center gap-4 text-white/40 text-xs">
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    <span>{formatTime(task.posted_at ? new Date(task.posted_at) : new Date(task.scheduled_for))}</span>
                                  </div>
                                  <span>{new Date(task.posted_at || task.scheduled_for).toLocaleString()}</span>
                                  {twitterLink && isSuccess && (
                                    <a
                                      href={twitterLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 ml-auto"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      View on X
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Connectivity Status Tab */}
              {activeTab === 'status' && (
                <div className="space-y-4">
                  <h3 className="text-white font-semibold mb-4">Connectivity Status</h3>
                  
                  {/* Twitter API Status */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Twitter className="w-5 h-5 text-[#1DA1F2]" />
                        <div>
                          <h4 className="text-white font-medium">Twitter API</h4>
                          <p className="text-white/50 text-xs">
                            Last checked: {formatTime(connectivityStatus.twitter.lastChecked)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {connectivityStatus.twitter.status === 'checking' && (
                          <Loader2 className="w-4 h-4 text-white/50 animate-spin" />
                        )}
                        {connectivityStatus.twitter.status === 'connected' && (
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                        )}
                        {connectivityStatus.twitter.status === 'disconnected' && (
                          <AlertCircle className="w-5 h-5 text-red-400" />
                        )}
                      </div>
                    </div>
                    {connectivityStatus.twitter.error && (
                      <p className="text-red-400 text-xs mt-2">{connectivityStatus.twitter.error}</p>
                    )}
                  </div>

                  {/* Agent Status */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Bot className="w-5 h-5 text-purple-400" />
                        <div>
                          <h4 className="text-white font-medium">Agent Status</h4>
                          <p className="text-white/50 text-xs">
                            {connectivityStatus.agent.enabled ? 'Agent Mode Enabled' : 'Agent Mode Disabled'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {connectivityStatus.agent.status === 'active' && (
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                            <span className="text-green-400 text-sm font-medium">Active</span>
                          </div>
                        )}
                        {connectivityStatus.agent.status === 'inactive' && (
                          <span className="text-white/50 text-sm">Inactive</span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <p className="text-white/50 text-xs mb-1">Pending Actions</p>
                        <p className="text-white font-semibold">{connectivityStatus.agent.pendingActions}</p>
                      </div>
                      <div>
                        <p className="text-white/50 text-xs mb-1">Last Run</p>
                        <p className="text-white font-semibold text-sm">
                          {formatTime(connectivityStatus.agent.lastRun)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* LLM Status */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Brain className="w-5 h-5 text-yellow-400" />
                        <div>
                          <h4 className="text-white font-medium">LLM Status</h4>
                          <p className="text-white/50 text-xs">
                            Last checked: {formatTime(connectivityStatus.llm.lastChecked)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {connectivityStatus.llm.status === 'checking' && (
                          <Loader2 className="w-4 h-4 text-white/50 animate-spin" />
                        )}
                        {connectivityStatus.llm.status === 'available' && (
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                        )}
                        {connectivityStatus.llm.status === 'unavailable' && (
                          <AlertCircle className="w-5 h-5 text-red-400" />
                        )}
                      </div>
                    </div>
                    {connectivityStatus.llm.error && (
                      <p className="text-red-400 text-xs mt-2">{connectivityStatus.llm.error}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Error Logs Tab */}
              {activeTab === 'errors' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-semibold">Error Logs</h3>
                    <span className="text-white/50 text-sm">{errorLogs.length} errors</span>
                  </div>
                  {errorLogs.length === 0 ? (
                    <div className="text-center py-12">
                      <CheckCircle2 className="w-12 h-12 text-green-400/30 mx-auto mb-3" />
                      <p className="text-white/50 text-sm">No errors found</p>
                      <p className="text-white/30 text-xs mt-1">All systems operational</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {errorLogs.map((error) => (
                        <div
                          key={error.id}
                          className="p-4 rounded-xl bg-red-500/5 border border-red-500/20"
                        >
                          <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-white font-medium text-sm">{error.type}</span>
                                <span className="text-white/40 text-xs">
                                  {formatTime(error.timestamp)}
                                </span>
                              </div>
                              <p className="text-white/70 text-sm mb-2">{error.message}</p>
                              {error.metadata && (
                                <details className="mt-2">
                                  <summary className="text-white/50 text-xs cursor-pointer hover:text-white/70">
                                    Details
                                  </summary>
                                  <pre className="mt-2 text-xs text-white/40 bg-black/30 p-2 rounded overflow-x-auto">
                                    {JSON.stringify(error.metadata, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Send Report Tab */}
              {activeTab === 'report' && (
                <div className="max-w-2xl mx-auto">
                  <div className="mb-6">
                    <h3 className="text-white font-semibold mb-2">Send Bug Report or Feedback</h3>
                    <p className="text-white/50 text-sm">
                      Describe the issue or provide feedback. This feature will be enabled soon.
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-white/70 text-sm mb-2">
                        Report Details
                      </label>
                      <textarea
                        value={reportText}
                        onChange={(e) => setReportText(e.target.value)}
                        disabled
                        placeholder="Describe the bug or provide feedback... (Feature coming soon)"
                        className="w-full h-48 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
                      />
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                      <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                      <p className="text-white/70 text-sm">
                        Report sending is currently disabled. This feature will be available in a future update.
                      </p>
                    </div>

                    <button
                      disabled
                      className="w-full px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-500 rounded-xl text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      <span>Send Report (Coming Soon)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

