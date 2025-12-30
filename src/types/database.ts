// Database types for Supabase
// Generated based on our schema

// Letter grade type for scoring system
export type LetterGrade = 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D';

// Profile scores calculated during clone generation
export interface ProfileScores {
  finalRating: LetterGrade;
  engagement: LetterGrade;  // Based on likes/retweets per follower
  reach: LetterGrade;       // Based on follower count and growth potential
  content: LetterGrade;     // Based on content quality analysis
}

// Twitter metrics from cached data
export interface TwitterMetrics {
  followers_count: number;
  following_count: number;
  tweet_count: number;
  listed_count?: number;
}

// Agent Mode settings for automated Twitter engagement
export type AgentFrequency = 'daily' | '3days' | 'weekly';

// Target account configuration with priority and per-account settings
export interface TargetAccountConfig {
  username: string;
  priority?: 'high' | 'medium' | 'low';
  actions?: {
    retweet?: boolean;
    like?: boolean;
    mention?: boolean;
  };
  lastEngagedAt?: string | null;
}

// Content filtering configuration
export interface ContentFilterConfig {
  keywords?: string[]; // Only engage if tweet contains these keywords
  negativeKeywords?: string[]; // Skip tweets with these words/phrases
  minEngagement?: {
    likes?: number;
    retweets?: number;
  };
  sentimentFilter?: 'positive' | 'neutral' | 'all';
  tweetTypes?: ('original' | 'reply' | 'retweet')[];
  topicMatching?: boolean; // Match against character's interests/knowledge
}

// Rate limiting configuration
export interface RateLimitConfig {
  maxPerAccountPerDay?: number; // Max engagements per target account per day
  maxGlobalPerDay?: number; // Max total engagements per day
  cooldownAfterHighEngagement?: {
    threshold: number; // Number of engagements
    pauseHours: number; // Hours to pause after threshold
  };
  safeMode?: boolean; // Automatically reduce frequency
}

// Timezone and scheduling configuration
export interface SchedulingConfig {
  timezone?: string; // User's timezone (e.g., 'America/New_York')
  activeHours?: {
    start: number; // Hour of day (0-23)
    end: number; // Hour of day (0-23)
  };
  quietHours?: {
    start: number;
    end: number;
  };
}

// Action probability configuration
export interface ActionProbability {
  retweet?: number; // 0-100, probability of retweeting
  like?: number; // 0-100, probability of liking
  mention?: number; // 0-100, probability of commenting
}

export interface AgentSettings {
  enabled: boolean;
  targetAccounts: (string | TargetAccountConfig)[]; // Support both old format (string[]) and new format
  actions: {
    retweet: boolean;
    like: boolean;
    mention: boolean;
  };
  frequency: AgentFrequency;
  lastRunAt: string | null;
  // New fields
  contentFilter?: ContentFilterConfig;
  rateLimits?: RateLimitConfig;
  scheduling?: SchedulingConfig;
  actionProbabilities?: ActionProbability;
  manualApproval?: boolean; // Review actions before executing
  pausedUntil?: string | null; // Pause agent until this date
}

// ElizaOS Character Card Type (from CHARACTER_CARD_STRUCTURE.md)
// Defined first since it's used by other types
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

// Profile types
export type ProfilesRow = {
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
  agent_settings: AgentSettings | null;
  created_at: string;
  updated_at: string;
};

export type ProfilesInsert = Partial<Omit<ProfilesRow, 'created_at' | 'updated_at'>>;
export type ProfilesUpdate = Partial<Omit<ProfilesRow, 'id' | 'created_at' | 'updated_at'>>;

// Character Cards types
export type CharacterCardsRow = {
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

export type CharacterCardsInsert = {
  user_id: string;
  card_data: ElizaOSCharacterCard;
  version?: number;
  is_active?: boolean;
  generated_by?: string;
  generation_prompt?: string | null;
  generation_metadata?: Record<string, any>;
};

export type CharacterCardsUpdate = Partial<Omit<CharacterCardsRow, 'id' | 'user_id' | 'created_at'>>;

// Chat Messages types
export type ChatMessagesRow = {
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

export type ChatMessagesInsert = Omit<ChatMessagesRow, 'id' | 'created_at'>;
export type ChatMessagesUpdate = Partial<Omit<ChatMessagesRow, 'id' | 'created_at'>>;

// Twitter Data Cache types
export type TwitterDataCacheRow = {
  id: string;
  user_id: string;
  profile_data: Record<string, any> | null;
  tweets_data: Record<string, any> | null;
  engagement_stats: Record<string, any> | null;
  cached_at: string;
  expires_at: string | null;
};

export type TwitterDataCacheInsert = Omit<TwitterDataCacheRow, 'id' | 'cached_at'>;
export type TwitterDataCacheUpdate = Partial<Omit<TwitterDataCacheRow, 'id' | 'cached_at'>>;

// Agent Sessions types
export type AgentSessionsRow = {
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

export type AgentSessionsInsert = Omit<AgentSessionsRow, 'id' | 'started_at'>;
export type AgentSessionsUpdate = Partial<Omit<AgentSessionsRow, 'id' | 'started_at'>>;

// Scheduled Posts types
// Supports: tweet, reply, thread (content posts) + retweet, like, comment (engagement actions)
export type ScheduledPostType = 'tweet' | 'reply' | 'thread' | 'retweet' | 'like' | 'comment';

export type ScheduledPostsRow = {
  id: string;
  user_id: string;
  content: string;
  post_type: ScheduledPostType;
  scheduled_for: string;
  posted_at: string | null;
  status: 'pending' | 'posted' | 'failed' | 'cancelled';
  error_message: string | null;
  post_metadata: Record<string, any>;
  target_tweet_id: string | null; // For engagement actions (retweet, like, comment)
  created_at: string;
};

export type ScheduledPostsInsert = Omit<ScheduledPostsRow, 'id' | 'created_at'>;
export type ScheduledPostsUpdate = Partial<Omit<ScheduledPostsRow, 'id' | 'created_at'>>;

// Database interface for Supabase client
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfilesRow;
        Insert: ProfilesInsert;
        Update: ProfilesUpdate;
      };
      character_cards: {
        Row: CharacterCardsRow;
        Insert: CharacterCardsInsert;
        Update: CharacterCardsUpdate;
      };
      chat_messages: {
        Row: ChatMessagesRow;
        Insert: ChatMessagesInsert;
        Update: ChatMessagesUpdate;
      };
      twitter_data_cache: {
        Row: TwitterDataCacheRow;
        Insert: TwitterDataCacheInsert;
        Update: TwitterDataCacheUpdate;
      };
      agent_sessions: {
        Row: AgentSessionsRow;
        Insert: AgentSessionsInsert;
        Update: AgentSessionsUpdate;
      };
      scheduled_posts: {
        Row: ScheduledPostsRow;
        Insert: ScheduledPostsInsert;
        Update: ScheduledPostsUpdate;
      };
    };
  };
}
