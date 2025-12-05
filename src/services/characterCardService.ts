// Character Card Service
// Handles character card generation via Edge Function and Supabase CRUD operations

import { supabase } from '@/lib/supabase';
import type { ElizaOSCharacterCard, CharacterCardsRow } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

// Get untyped supabase client for operations that need flexibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as SupabaseClient<any>;

import type { LetterGrade, ProfileScores, TwitterMetrics } from '@/types/database';

interface GenerateCharacterCardResponse {
  success: boolean;
  character_card: ElizaOSCharacterCard;
  twitter_profile: {
    id: string;
    username: string;
    name: string;
    profile_image_url?: string;
    followers_count?: number;
    following_count?: number;
    tweet_count?: number;
    listed_count?: number;
  };
  profile_scores: ProfileScores;
  analysis_metadata: {
    method: string;
    tweets_analyzed: number;
    generated_at: string;
    analysis_summary?: {
      primary_topics: string[];
      core_traits: string[];
      vocabulary_level: string;
      humor_style: string;
    };
  };
}

export type { ProfileScores, LetterGrade, TwitterMetrics };

// Re-export for convenience
export type CharacterCardRecord = CharacterCardsRow;

/**
 * Generate a character card by analyzing user's Twitter data
 * Calls the Edge Function which fetches tweets and uses Grok API
 */
export async function generateCharacterCard(
  userId: string,
  accessToken: string,
  twitterUserId?: string
): Promise<GenerateCharacterCardResponse> {
  const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-character-card`;
  
  const response = await fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      user_id: userId,
      access_token: accessToken,
      twitter_user_id: twitterUserId,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    // Create error with full details
    const error: any = new Error(data.error || 'Failed to generate character card');
    error.error = data.error;
    error.error_code = data.error_code;
    error.error_details = data.error_details;
    error.suggestion = data.suggestion;
    throw error;
  }

  return data;
}

/**
 * Save a character card to the database
 */
export async function saveCharacterCard(
  userId: string,
  cardData: ElizaOSCharacterCard,
  metadata?: {
    generatedBy?: string;
    generationPrompt?: string;
    generationMetadata?: Record<string, any>;
  }
): Promise<CharacterCardRecord> {
  // Check if user already has an active character card
  const { data: existingCard } = await db
    .from('character_cards')
    .select('id, version')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  const existingCardTyped = existingCard as { id: string; version: number } | null;
  const nextVersion = existingCardTyped ? existingCardTyped.version + 1 : 1;

  // If there's an existing card, deactivate it
  if (existingCardTyped) {
    await db
      .from('character_cards')
      .update({ is_active: false })
      .eq('id', existingCardTyped.id);
  }

  // Insert new character card
  const { data, error } = await db
    .from('character_cards')
    .insert({
      user_id: userId,
      card_data: cardData,
      version: nextVersion,
      is_active: true,
      generated_by: metadata?.generatedBy || 'grok_api',
      generation_prompt: metadata?.generationPrompt || null,
      generation_metadata: metadata?.generationMetadata || {},
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save character card: ${error.message}`);
  }

  // Update profile to mark character card as generated
  await db
    .from('profiles')
    .update({
      character_card_generated: true,
      character_card_generated_at: new Date().toISOString(),
      character_card_version: nextVersion,
    })
    .eq('id', userId);

  return data as CharacterCardRecord;
}

/**
 * Get the active character card for a user
 */
export async function getCharacterCard(userId: string): Promise<CharacterCardRecord | null> {
  const { data, error } = await db
    .from('character_cards')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch character card: ${error.message}`);
  }

  return data as CharacterCardRecord | null;
}

/**
 * Get all character cards for a user (including inactive/previous versions)
 */
export async function getAllCharacterCards(userId: string): Promise<CharacterCardRecord[]> {
  const { data, error } = await db
    .from('character_cards')
    .select('*')
    .eq('user_id', userId)
    .order('version', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch character cards: ${error.message}`);
  }

  return (data || []) as CharacterCardRecord[];
}

/**
 * Update an existing character card
 */
export async function updateCharacterCard(
  cardId: string,
  cardData: Partial<ElizaOSCharacterCard>
): Promise<CharacterCardRecord> {
  // First get the existing card
  const { data: existingCard, error: fetchError } = await db
    .from('character_cards')
    .select('*')
    .eq('id', cardId)
    .single();

  if (fetchError || !existingCard) {
    throw new Error('Character card not found');
  }

  const existingCardTyped = existingCard as CharacterCardRecord;

  // Merge the updates with existing card data
  const updatedCardData = {
    ...existingCardTyped.card_data,
    ...cardData,
  };

  const { data, error } = await db
    .from('character_cards')
    .update({
      card_data: updatedCardData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', cardId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update character card: ${error.message}`);
  }

  return data as CharacterCardRecord;
}

/**
 * Delete a character card
 */
export async function deleteCharacterCard(cardId: string): Promise<void> {
  const { error } = await db
    .from('character_cards')
    .delete()
    .eq('id', cardId);

  if (error) {
    throw new Error(`Failed to delete character card: ${error.message}`);
  }
}

/**
 * Check if user has a character card
 */
export async function hasCharacterCard(userId: string): Promise<boolean> {
  const { count, error } = await db
    .from('character_cards')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) {
    console.error('Failed to check character card:', error);
    return false;
  }

  return (count || 0) > 0;
}

/**
 * Get user's Twitter access token from profile
 */
export async function getTwitterAccessToken(userId: string): Promise<string | null> {
  const { data, error } = await db
    .from('profiles')
    .select('twitter_access_token')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return (data as { twitter_access_token: string | null }).twitter_access_token;
}

/**
 * Export character card as JSON file
 */
export function exportCharacterCardAsJSON(cardData: ElizaOSCharacterCard): void {
  const dataStr = JSON.stringify(cardData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${cardData.name || 'character'}_card.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

