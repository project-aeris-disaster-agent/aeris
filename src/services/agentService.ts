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
 */
export async function toggleAgentMode(
  userId: string,
  enabled: boolean
): Promise<AgentSettings> {
  return updateAgentSettings(userId, { enabled });
}

/**
 * Calculate randomized schedule time based on frequency
 * Adds jitter to avoid detection by Twitter/X
 */
export function calculateRandomizedScheduleTime(
  frequency: AgentFrequency,
  lastRunAt: Date | null
): Date {
  const now = new Date();
  const base = lastRunAt || now;

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
  return updateAgentSettings(userId, { actions });
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

