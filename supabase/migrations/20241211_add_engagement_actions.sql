-- Migration: Add engagement action types (retweet, like, comment) to scheduled_posts
-- Date: 2024-12-11
-- Description: Extends the scheduled_posts table to support Twitter engagement actions

-- 1. Drop existing constraint on post_type (if exists)
ALTER TABLE scheduled_posts 
DROP CONSTRAINT IF EXISTS scheduled_posts_post_type_check;

-- 2. Add new constraint with extended post_type values
-- Supports: tweet, reply, thread (existing) + retweet, like, comment (new)
ALTER TABLE scheduled_posts 
ADD CONSTRAINT scheduled_posts_post_type_check 
CHECK (post_type IN ('tweet', 'reply', 'thread', 'retweet', 'like', 'comment'));

-- 3. Add target_tweet_id column for engagement actions (retweet, like, comment)
-- This stores the tweet ID that the action targets
ALTER TABLE scheduled_posts 
ADD COLUMN IF NOT EXISTS target_tweet_id TEXT;

-- 4. Add index for faster queries on pending posts by scheduled_for
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_pending_scheduled 
ON scheduled_posts(status, scheduled_for) 
WHERE status = 'pending';

-- 5. Add index for faster queries by user and status
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user_status 
ON scheduled_posts(user_id, status);

-- 6. Comment on new column
COMMENT ON COLUMN scheduled_posts.target_tweet_id IS 'Target tweet ID for engagement actions (retweet, like, comment). NULL for original tweets.';

