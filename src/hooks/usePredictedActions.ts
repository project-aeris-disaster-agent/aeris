import { useState, useEffect, useCallback } from 'react';
import { getAgentSettings, calculatePredictedAgentActions, type PredictedAgentAction } from '@/services/agentService';
import type { ScheduledPostsRow } from '@/types/database';

interface UsePredictedActionsOptions {
  userId: string;
  enabled?: boolean;
  pendingTasks?: ScheduledPostsRow[]; // To filter out already-scheduled actions
}

interface UsePredictedActionsReturn {
  predictedActions: PredictedAgentAction[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  dismissAction: (actionId: string) => void;
}

/**
 * Custom hook for predicted agent actions
 * Filters out actions that are already scheduled
 */
export function usePredictedActions({
  userId,
  enabled = true,
  pendingTasks = [],
}: UsePredictedActionsOptions): UsePredictedActionsReturn {
  const [predictedActions, setPredictedActions] = useState<PredictedAgentAction[]>([]);
  const [dismissedActions, setDismissedActions] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const fetchPredictedActions = useCallback(async () => {
    if (!userId || !enabled) {
      setPredictedActions([]);
      return;
    }

    setIsLoading(true);

    try {
      const settings = await getAgentSettings(userId);

      if (settings.enabled) {
        const predicted = calculatePredictedAgentActions(settings);

        // Filter out predicted actions that are already scheduled
        const actualAgentTasks = pendingTasks.filter(
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

        const filtered = predicted.filter((pred) => {
          const key = `${pred.targetAccount}-${pred.actionType}`;
          // Filter out already scheduled AND dismissed actions
          return !actualAgentKeys.has(key) && !dismissedActions.has(pred.id);
        });

        setPredictedActions(filtered);
      } else {
        setPredictedActions([]);
      }
    } catch (error) {
      console.error('Failed to fetch predicted actions:', error);
      setPredictedActions([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId, enabled, pendingTasks, dismissedActions]);

  useEffect(() => {
    fetchPredictedActions();
  }, [fetchPredictedActions]);

  const dismissAction = (actionId: string) => {
    setDismissedActions(prev => new Set(prev).add(actionId));
    // Immediately remove from current list
    setPredictedActions(prev => prev.filter(p => p.id !== actionId));
  };

  return {
    predictedActions,
    isLoading,
    refresh: fetchPredictedActions,
    dismissAction,
  };
}

