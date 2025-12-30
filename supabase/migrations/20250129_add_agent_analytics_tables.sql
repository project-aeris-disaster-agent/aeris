-- Migration: Add analytics tables for agent mode engagement tracking
-- Date: 2025-01-29
-- Description: Creates tables to track engagement metrics and history

-- 1. Agent Engagement Metrics Table
-- Tracks performance metrics for agent actions
CREATE TABLE IF NOT EXISTS agent_engagement_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('retweet', 'like', 'comment')),
  target_account TEXT NOT NULL,
  target_tweet_id TEXT,
  scheduled_post_id UUID REFERENCES scheduled_posts(id) ON DELETE SET NULL,
  
  -- Engagement received on our actions
  likes_received INTEGER DEFAULT 0,
  replies_received INTEGER DEFAULT 0,
  retweets_received INTEGER DEFAULT 0,
  
  -- Performance tracking
  engagement_score DECIMAL(10, 2) DEFAULT 0, -- Calculated score based on engagement
  quality_score DECIMAL(5, 2), -- AI-generated quality score (0-100)
  
  -- Metadata
  metrics_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_agent_metrics_user_id ON agent_engagement_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_target_account ON agent_engagement_metrics(target_account);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_created_at ON agent_engagement_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_action_type ON agent_engagement_metrics(action_type);

-- 2. Agent Engagement History Table
-- Tracks relationship history with target accounts
CREATE TABLE IF NOT EXISTS agent_engagement_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_account TEXT NOT NULL,
  
  -- Engagement counts
  total_engagements INTEGER DEFAULT 0,
  retweets_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  
  -- Timing
  first_engaged_at TIMESTAMPTZ,
  last_engaged_at TIMESTAMPTZ,
  
  -- Balance tracking
  engagements_this_week INTEGER DEFAULT 0,
  engagements_this_month INTEGER DEFAULT 0,
  
  -- Account health
  account_status TEXT DEFAULT 'active' CHECK (account_status IN ('active', 'inactive', 'suspended', 'unknown')),
  last_checked_at TIMESTAMPTZ,
  
  -- Metadata
  history_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one record per user-target pair
  UNIQUE(user_id, target_account)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_agent_history_user_id ON agent_engagement_history(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_history_target_account ON agent_engagement_history(target_account);
CREATE INDEX IF NOT EXISTS idx_agent_history_last_engaged ON agent_engagement_history(last_engaged_at DESC);

-- 3. Agent Rate Limit Tracking Table
-- Tracks daily engagement limits per user and per account
CREATE TABLE IF NOT EXISTS agent_rate_limit_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_account TEXT, -- NULL for global limits
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Counts
  engagements_today INTEGER DEFAULT 0,
  retweets_today INTEGER DEFAULT 0,
  likes_today INTEGER DEFAULT 0,
  comments_today INTEGER DEFAULT 0,
  
  -- Cooldown tracking
  in_cooldown BOOLEAN DEFAULT FALSE,
  cooldown_until TIMESTAMPTZ,
  
  -- Metadata
  tracking_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one record per user-account-date
  UNIQUE(user_id, COALESCE(target_account, ''), date)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_rate_limit_user_date ON agent_rate_limit_tracking(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_cooldown ON agent_rate_limit_tracking(user_id, in_cooldown, cooldown_until) WHERE in_cooldown = TRUE;

-- 4. Update scheduled_posts to track engagement metrics
-- Add foreign key to agent_engagement_metrics if not exists
-- (This is handled by the scheduled_posts table structure)

-- Comments for documentation
COMMENT ON TABLE agent_engagement_metrics IS 'Tracks performance metrics for agent mode engagements';
COMMENT ON TABLE agent_engagement_history IS 'Tracks relationship history and engagement balance with target accounts';
COMMENT ON TABLE agent_rate_limit_tracking IS 'Tracks daily engagement limits and cooldown periods';

