-- Migration: Add retry mechanism for failed scheduled posts
-- Enables automatic retry with exponential backoff (max 3 attempts)

-- Add retry tracking columns
ALTER TABLE scheduled_posts 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;

-- Create index for efficient retry queries
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_retry 
ON scheduled_posts(status, retry_count, last_retry_at) 
WHERE status = 'failed' AND retry_count < 3;

-- Add comment for documentation
COMMENT ON COLUMN scheduled_posts.retry_count IS 'Number of retry attempts (max 3)';
COMMENT ON COLUMN scheduled_posts.last_retry_at IS 'Timestamp of last retry attempt';

