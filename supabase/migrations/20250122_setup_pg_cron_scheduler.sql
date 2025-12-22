-- Migration: Set up pg_cron for processing scheduled posts
-- This enables automatic execution of scheduled posts every 5 minutes
-- Replaces Vercel cron which only runs once per day on free tier

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing cron job if it exists (idempotent)
SELECT cron.unschedule('process-scheduled-posts') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-scheduled-posts'
);

-- Schedule cron job to run every 5 minutes
-- This calls the Supabase Edge Function directly via HTTP
SELECT cron.schedule(
  'process-scheduled-posts',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://wqwhlbmsafgjlsjujuel.supabase.co/functions/v1/process-scheduled-posts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer Sonara2026!'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Verify the cron job was created
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  database
FROM cron.job 
WHERE jobname = 'process-scheduled-posts';

