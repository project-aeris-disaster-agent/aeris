// Agent Service - Handles Agent Mode settings and automated engagement
// Manages target accounts, action types, and frequency settings

import { supabase } from '@/lib/supabase';
import type { AgentSettings, AgentFrequency } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as SupabaseClient<any>;

// Default agent settings
export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  enabled: false,
  targetAccounts: [],
  actions: {
    retweet: false,
    like: false,
    mention: false,
  },
  frequency: 'daily',
  lastRunAt: null,
};

/**
 * Get agent settings for a user
 */
export async function getAgentSettings(userId: string): Promise<AgentSettings> {
  const { data, error } = await db
    .from('profiles')
    .select('agent_settings')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Failed to fetch agent settings:', error);
    return DEFAULT_AGENT_SETTINGS;
  }

  return data?.agent_settings || DEFAULT_AGENT_SETTINGS;
}

/**
 * Update agent settings for a user
 */
export async function updateAgentSettings(
  userId: string,
  settings: Partial<AgentSettings>
): Promise<AgentSettings> {
  // First get current settings
  const currentSettings = await getAgentSettings(userId);
  
  // Merge with new settings
  const updatedSettings: AgentSettings = {
    ...currentSettings,
    ...settings,
    actions: {
      ...currentSettings.actions,
      ...(settings.actions || {}),
    },
  };

  const { error } = await db
    .from('profiles')
    .update({ agent_settings: updatedSettings })
    .eq('id', userId);

  if (error) {
    console.error('Failed to update agent settings:', error);
    throw new Error('Failed to update agent settings');
  }

  return updatedSettings;
}

/**
 * Toggle agent mode enabled/disabled
 * When enabling Agent Mode, clears lastRunAt to trigger first-run optimization (1-4 hours)
 */
export async function toggleAgentMode(
  userId: string,
  enabled: boolean
): Promise<AgentSettings> {
  // Get current settings to check if we're enabling from disabled state
  const currentSettings = await getAgentSettings(userId);
  const wasDisabled = !currentSettings.enabled;
  
  // If enabling Agent Mode (from disabled state), clear lastRunAt to trigger first-run optimization
  const updateData: Partial<AgentSettings> = { enabled };
  if (enabled && wasDisabled) {
    updateData.lastRunAt = null;
  }
  
  const updated = await updateAgentSettings(userId, updateData);
  return updated;
}

/**
 * Calculate randomized schedule time based on frequency
 * Adds jitter to avoid detection by Twitter/X
 * First run optimization: schedules 1-4 hours in future for immediate feedback
 */
export function calculateRandomizedScheduleTime(
  frequency: AgentFrequency,
  lastRunAt: Date | null
): Date {
  const now = new Date();
  
  // First run optimization: schedule 1-4 hours in future for immediate feedback
  if (!lastRunAt) {
    const minHours = 1;
    const maxHours = 4;
    const randomHours = minHours + Math.random() * (maxHours - minHours);
    const scheduledTime = new Date(now.getTime() + randomHours * 60 * 60 * 1000);
    
    // Ensure within active hours (9 AM - 9 PM)
    const hour = scheduledTime.getHours();
    if (hour < 9) {
      scheduledTime.setHours(9, Math.floor(Math.random() * 60), 0);
    }
    if (hour >= 21) {
      scheduledTime.setHours(20, Math.floor(Math.random() * 60), 0);
    }
    
    return scheduledTime;
  }

  // Subsequent runs - use normal frequency-based delays
  const base = lastRunAt;

  // Define min/max hours for each frequency with jitter
  let minHours: number, maxHours: number;
  switch (frequency) {
    case 'daily':
      minHours = 20;
      maxHours = 28;
      break;
    case '3days':
      minHours = 66;
      maxHours = 78;
      break;
    case 'weekly':
      minHours = 144;
      maxHours = 192; // 6-8 days
      break;
    default:
      minHours = 20;
      maxHours = 28;
  }

  const randomHours = minHours + Math.random() * (maxHours - minHours);
  const scheduledTime = new Date(base.getTime() + randomHours * 60 * 60 * 1000);

  // Ensure within active hours (9 AM - 9 PM)
  const hour = scheduledTime.getHours();
  if (hour < 9) {
    scheduledTime.setHours(9, Math.floor(Math.random() * 60), 0);
  }
  if (hour >= 21) {
    scheduledTime.setHours(20, Math.floor(Math.random() * 60), 0);
  }

  return scheduledTime;
}

/**
 * Add staggered delay for multiple actions to avoid detection
 * @param baseTime - Base scheduled time
 * @param actionIndex - Index of action (0, 1, 2)
 * @returns Date with added random delay
 */
export function addActionDelay(baseTime: Date, actionIndex: number): Date {
  // Stagger delays: Action 0 = 0-15 min, Action 1 = 15-45 min, Action 2 = 30-90 min
  const delayRanges = [
    { min: 0, max: 15 },
    { min: 15, max: 45 },
    { min: 30, max: 90 },
  ];

  const range = delayRanges[actionIndex] || delayRanges[2];
  const randomMinutes = range.min + Math.random() * (range.max - range.min);

  return new Date(baseTime.getTime() + randomMinutes * 60 * 1000);
}

/**
 * Check if it's time to run agent actions based on frequency
 */
export function shouldRunAgent(settings: AgentSettings): boolean {
  if (!settings.enabled) return false;
  if (!settings.lastRunAt) return true;

  const lastRun = new Date(settings.lastRunAt);
  const now = new Date();

  // Calculate minimum hours based on frequency (use minimum of the range)
  let minHours: number;
  switch (settings.frequency) {
    case 'daily':
      minHours = 20;
      break;
    case '3days':
      minHours = 66;
      break;
    case 'weekly':
      minHours = 144;
      break;
    default:
      minHours = 20;
  }

  const hoursSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);
  return hoursSinceLastRun >= minHours;
}

/**
 * Update lastRunAt timestamp after successful agent run
 */
export async function updateLastRunAt(userId: string): Promise<void> {
  const { error } = await db
    .from('profiles')
    .update({
      agent_settings: db.rpc('jsonb_set', {
        target: 'agent_settings',
        path: '{lastRunAt}',
        new_value: JSON.stringify(new Date().toISOString()),
      }),
    })
    .eq('id', userId);

  // Alternative approach if RPC doesn't work
  if (error) {
    const currentSettings = await getAgentSettings(userId);
    await updateAgentSettings(userId, {
      ...currentSettings,
      lastRunAt: new Date().toISOString(),
    });
  }
}

/**
 * Validate target accounts (remove @ if present, trim whitespace)
 */
export function normalizeTargetAccounts(accounts: string[]): string[] {
  return accounts
    .map((account) => account.trim().replace(/^@/, ''))
    .filter((account) => account.length > 0);
}

/**
 * Add target accounts to agent settings
 */
export async function addTargetAccounts(
  userId: string,
  accounts: string[]
): Promise<AgentSettings> {
  const currentSettings = await getAgentSettings(userId);
  const normalizedAccounts = normalizeTargetAccounts(accounts);
  
  // Merge with existing accounts (avoid duplicates)
  const allAccounts = [
    ...new Set([...currentSettings.targetAccounts, ...normalizedAccounts]),
  ];

  return updateAgentSettings(userId, { targetAccounts: allAccounts });
}

/**
 * Remove target account from agent settings
 */
export async function removeTargetAccount(
  userId: string,
  account: string
): Promise<AgentSettings> {
  const currentSettings = await getAgentSettings(userId);
  const normalizedAccount = account.trim().replace(/^@/, '');
  
  const filteredAccounts = currentSettings.targetAccounts.filter(
    (a) => a.toLowerCase() !== normalizedAccount.toLowerCase()
  );

  return updateAgentSettings(userId, { targetAccounts: filteredAccounts });
}

/**
 * Update action settings
 */
export async function updateActionSettings(
  userId: string,
  actions: Partial<AgentSettings['actions']>
): Promise<AgentSettings> {
  // Get current settings to merge
  const currentSettings = await getAgentSettings(userId);
  const mergedActions = {
    ...currentSettings.actions,
    ...actions,
  };
  return updateAgentSettings(userId, { actions: mergedActions });
}

/**
 * Update frequency setting
 */
export async function updateFrequency(
  userId: string,
  frequency: AgentFrequency
): Promise<AgentSettings> {
  return updateAgentSettings(userId, { frequency });
}

/**
 * Execute agent actions instantly (Easter Egg feature)
 * Bypasses scheduling and executes actions immediately
 */
export interface InstantExecutionResult {
  action: 'retweet' | 'like' | 'comment';
  tweetId: string;
  targetAccount: string;
  success: boolean;
  error?: string;
  postId?: string;
  alreadyDone?: boolean;
}

export async function executeAgentActionsInstant(userId: string): Promise<{
  success: boolean;
  executed: number;
  succeeded: number;
  failed: number;
  results: InstantExecutionResult[];
  error?: string;
}> {
  try {
    const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/execute-agent-actions-instant`;
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ userId }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to execute agent actions');
    }

    return data;
  } catch (error) {
    console.error('Error executing instant agent actions:', error);
    return {
      success: false,
      executed: 0,
      succeeded: 0,
      failed: 0,
      results: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get agent activity statistics
 */
export interface AgentActivityStats {
  pendingActions: number;
  scheduledToday: number;
  executedToday: number;
  failedToday: number;
  nextScheduledAction: Date | null;
  lastRunAt: Date | null;
}

/**
 * Predicted agent action (preview of what will be scheduled)
 */
export interface PredictedAgentAction {
  id: string; // Generated ID for UI key
  actionType: 'retweet' | 'like' | 'comment';
  targetAccount: string;
  predictedScheduleTime: Date;
  actionIndex: number; // For staggered timing
}

/**
 * Calculate predicted agent actions based on current settings
 * This shows what actions WILL be scheduled on the next cron run
 */
export function calculatePredictedAgentActions(
  settings: AgentSettings
): PredictedAgentAction[] {
  if (!settings.enabled || settings.targetAccounts.length === 0) {
    return [];
  }

  // Count enabled actions
  const enabledActions: Array<'retweet' | 'like' | 'comment'> = [];
  if (settings.actions.retweet) enabledActions.push('retweet');
  if (settings.actions.like) enabledActions.push('like');
  if (settings.actions.mention) enabledActions.push('comment');

  if (enabledActions.length === 0) {
    return [];
  }

  // Calculate base schedule time (when cron would run next)
  const lastRun = settings.lastRunAt ? new Date(settings.lastRunAt) : null;

  // Calculate when next cron run would schedule actions
  // Use the same logic as server-side: first run = 1-4 hours, subsequent = frequency-based
  const baseScheduleTime = calculateRandomizedScheduleTime(settings.frequency, lastRun);

  const predictedActions: PredictedAgentAction[] = [];
  let globalActionIndex = 0;

  // For each target account
  for (const targetAccount of settings.targetAccounts) {
    // For each enabled action type
    for (const actionType of enabledActions) {
      const scheduledTime = addActionDelay(baseScheduleTime, globalActionIndex);
      
      predictedActions.push({
        id: `predicted-${targetAccount}-${actionType}-${globalActionIndex}`,
        actionType,
        targetAccount,
        predictedScheduleTime: scheduledTime,
        actionIndex: globalActionIndex,
      });
      
      globalActionIndex++;
    }
  }

  // Sort by predicted schedule time
  return predictedActions.sort(
    (a, b) => a.predictedScheduleTime.getTime() - b.predictedScheduleTime.getTime()
  );
}

export async function getAgentActivityStats(userId: string): Promise<AgentActivityStats> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  // Get pending actions
  const { data: pendingData } = await db
    .from('scheduled_posts')
    .select('id, scheduled_for')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .eq('post_metadata->>generated_by', 'agent_mode')
    .order('scheduled_for', { ascending: true })
    .limit(1);

  // Get actions scheduled today
  const { data: scheduledTodayData } = await db
    .from('scheduled_posts')
    .select('id')
    .eq('user_id', userId)
    .eq('post_metadata->>generated_by', 'agent_mode')
    .gte('created_at', todayStart.toISOString())
    .lt('created_at', todayEnd.toISOString());

  // Get actions executed today
  const { data: executedTodayData } = await db
    .from('scheduled_posts')
    .select('id, status')
    .eq('user_id', userId)
    .eq('post_metadata->>generated_by', 'agent_mode')
    .eq('status', 'posted')
    .gte('posted_at', todayStart.toISOString())
    .lt('posted_at', todayEnd.toISOString());

  // Get failed actions today
  const { data: failedTodayData } = await db
    .from('scheduled_posts')
    .select('id')
    .eq('user_id', userId)
    .eq('post_metadata->>generated_by', 'agent_mode')
    .eq('status', 'failed')
    .gte('created_at', todayStart.toISOString())
    .lt('created_at', todayEnd.toISOString());

  // Get agent settings for lastRunAt
  const settings = await getAgentSettings(userId);

  return {
    pendingActions: pendingData?.length || 0,
    scheduledToday: scheduledTodayData?.length || 0,
    executedToday: executedTodayData?.length || 0,
    failedToday: failedTodayData?.length || 0,
    nextScheduledAction: pendingData && pendingData.length > 0 
      ? new Date(pendingData[0].scheduled_for) 
      : null,
    lastRunAt: settings.lastRunAt ? new Date(settings.lastRunAt) : null,
  };
}

