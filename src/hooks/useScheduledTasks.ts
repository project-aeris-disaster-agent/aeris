import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { ScheduledPostsRow } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as SupabaseClient<any>;

interface UseScheduledTasksOptions {
  userId: string;
  enabled?: boolean;
  refreshInterval?: number; // in milliseconds, default 30000 (30 seconds)
  pendingLimit?: number; // default 50
  completedLimit?: number; // default undefined (no limit)
}

interface UseScheduledTasksReturn {
  pending: ScheduledPostsRow[];
  completed: ScheduledPostsRow[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

// Shared refresh interval - all instances use the same interval
let globalRefreshInterval: NodeJS.Timeout | null = null;
let globalRefreshCallbacks: Set<() => Promise<void>> = new Set();
const DEFAULT_REFRESH_INTERVAL = 30000; // 30 seconds

/**
 * Custom hook for fetching scheduled tasks (pending and completed)
 * All instances share the same refresh cycle to avoid duplicate queries
 */
export function useScheduledTasks({
  userId,
  enabled = true,
  refreshInterval = DEFAULT_REFRESH_INTERVAL,
  pendingLimit = 50,
  completedLimit, // No default - unlimited if not specified
}: UseScheduledTasksOptions): UseScheduledTasksReturn {
  const [pending, setPending] = useState<ScheduledPostsRow[]>([]);
  const [completed, setCompleted] = useState<ScheduledPostsRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!userId || !enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch pending tasks
      const { data: pendingData, error: pendingError } = await db
        .from('scheduled_posts')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('scheduled_for', { ascending: true })
        .limit(pendingLimit);

      if (pendingError) throw pendingError;

      // Fetch completed tasks (posted + failed)
      let completedQuery = db
        .from('scheduled_posts')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['posted', 'failed'])
        .order('posted_at', { ascending: false, nullsFirst: false })
        .order('scheduled_for', { ascending: false });
      
      // Only apply limit if specified
      if (completedLimit !== undefined) {
        completedQuery = completedQuery.limit(completedLimit);
      }
      
      const { data: completedData, error: completedError } = await completedQuery;

      if (completedError) throw completedError;

      setPending(pendingData || []);
      setCompleted(completedData || []);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch tasks');
      setError(error);
      console.error('Failed to fetch tasks:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, enabled, pendingLimit, completedLimit]);

  // Register this instance's refresh callback for shared refresh cycle
  useEffect(() => {
    if (!enabled) return;

    // Add this instance's fetch function to global callbacks
    globalRefreshCallbacks.add(fetchTasks);

    // Set up global refresh interval if not already set
    if (!globalRefreshInterval) {
      globalRefreshInterval = setInterval(() => {
        // Call all registered callbacks
        globalRefreshCallbacks.forEach((callback) => {
          callback().catch((err) => {
            console.error('Error in scheduled task refresh:', err);
          });
        });
      }, refreshInterval);
    }

    // Initial fetch
    fetchTasks();

    // Cleanup
    return () => {
      globalRefreshCallbacks.delete(fetchTasks);
      
      // Clear global interval if no more callbacks
      if (globalRefreshCallbacks.size === 0 && globalRefreshInterval) {
        clearInterval(globalRefreshInterval);
        globalRefreshInterval = null;
      }
    };
  }, [fetchTasks, enabled, refreshInterval]);

  return {
    pending,
    completed,
    isLoading,
    error,
    refresh: fetchTasks,
  };
}

