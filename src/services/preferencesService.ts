// Preferences Service - Handles user preferences management
// Manages user settings like emoji mode and other preferences

import { supabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as SupabaseClient<any>;

/**
 * Get user preferences
 */
export async function getUserPreferences(userId: string): Promise<Record<string, any>> {
  const { data, error } = await db
    .from('profiles')
    .select('preferences')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Failed to fetch user preferences:', error.message || error);
    return {};
  }

  return data?.preferences || {};
}

/**
 * Update user preferences (merges with existing preferences)
 */
export async function updateUserPreferences(
  userId: string,
  preferences: Partial<Record<string, any>>
): Promise<void> {
  // Get current preferences
  const currentPreferences = await getUserPreferences(userId);
  
  // Merge with new preferences
  const updatedPreferences = {
    ...currentPreferences,
    ...preferences,
  };

  const { error } = await db
    .from('profiles')
    .update({ preferences: updatedPreferences })
    .eq('id', userId);

  if (error) {
    console.error('Failed to update user preferences:', error);
    throw new Error('Failed to update user preferences');
  }
}

/**
 * Get emoji mode setting for a user
 */
export async function getEmojiMode(userId: string): Promise<boolean> {
  const preferences = await getUserPreferences(userId);
  return preferences.emoji_mode === true;
}

/**
 * Set emoji mode setting for a user
 */
export async function setEmojiMode(userId: string, enabled: boolean): Promise<void> {
  await updateUserPreferences(userId, { emoji_mode: enabled });
}