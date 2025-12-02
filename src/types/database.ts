// Database types for Supabase
// Generated based on our schema

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          phone: string | null;
          username: string | null;
          profile_photo_url: string | null;
          twitter_user_id: string | null;
          twitter_username: string | null;
          twitter_access_token: string | null;
          twitter_refresh_token: string | null;
          twitter_connected_at: string | null;
          wallet_address: string | null;
          wallet_addresses: string[] | null;
          wallet_network: string | null;
          character_card_generated: boolean;
          character_card_generated_at: string | null;
          character_card_version: number;
          onboarding_completed: boolean;
          preferences: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      character_cards: {
        Row: {
          id: string;
          user_id: string;
          card_data: ElizaOSCharacterCard;
          version: number;
          is_active: boolean;
          generated_by: string;
          generation_prompt: string | null;
          generation_metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['character_cards']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['character_cards']['Insert']>;
      };
      chat_messages: {
        Row: {
          id: string;
          user_id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          session_id: string | null;
          message_metadata: Record<string, any>;
          tokens_used: number | null;
          model_used: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['chat_messages']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['chat_messages']['Insert']>;
      };
      twitter_data_cache: {
        Row: {
          id: string;
          user_id: string;
          profile_data: Record<string, any> | null;
          tweets_data: Record<string, any> | null;
          engagement_stats: Record<string, any> | null;
          cached_at: string;
          expires_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['twitter_data_cache']['Row'], 'id' | 'cached_at'>;
        Update: Partial<Database['public']['Tables']['twitter_data_cache']['Insert']>;
      };
      agent_sessions: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          session_name: string | null;
          context_summary: string | null;
          total_messages: number;
          total_tokens: number;
          is_active: boolean;
          started_at: string;
          last_message_at: string | null;
          ended_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['agent_sessions']['Row'], 'id' | 'started_at'>;
        Update: Partial<Database['public']['Tables']['agent_sessions']['Insert']>;
      };
      scheduled_posts: {
        Row: {
          id: string;
          user_id: string;
          content: string;
          post_type: 'tweet' | 'reply' | 'thread';
          scheduled_for: string;
          posted_at: string | null;
          status: 'pending' | 'posted' | 'failed' | 'cancelled';
          error_message: string | null;
          post_metadata: Record<string, any>;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['scheduled_posts']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['scheduled_posts']['Insert']>;
      };
    };
  };
}

// ElizaOS Character Card Type (from CHARACTER_CARD_STRUCTURE.md)
export interface ElizaOSCharacterCard {
  name: string;
  clients?: string[];
  modelProvider?: string;
  settings?: {
    voice?: {
      model?: string;
    };
  };
  plugins?: string[];
  bio: string[];
  lore?: string[];
  knowledge: string[];
  messageExamples: Array<Array<{
    user: string;
    content: { text: string };
  }>>;
  postExamples: string[];
  topics: string[];
  style: {
    all: string[];
    chat: string[];
    post: string[];
  };
  adjectives?: string[];
  twitterSpaces?: Record<string, any>;
  schedule?: {
    intervalMinutes?: number;
    enabled?: boolean;
  };
  commenting?: {
    enabled?: boolean;
  };
}

