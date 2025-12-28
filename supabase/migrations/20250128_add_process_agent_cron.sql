-- Migration: Add pg_cron for process-agent-actions
-- This enables automatic agent discovery/scheduling every 6 hours
-- Supplements Vercel cron which only runs once per day on free tier

-- Remove existing cron job if it exists (idempotent)
SELECT cron.unschedule('process-agent-actions') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-agent-actions'
);

-- Schedule cron job to run every 6 hours
-- This calls the Supabase Edge Function directly via HTTP
SELECT cron.schedule(
  'process-agent-actions',
  '0 */6 * * *', -- Every 6 hours (0:00, 6:00, 12:00, 18:00)
  $$
  SELECT net.http_post(
    url := 'https://wqwhlbmsafgjlsjujuel.supabase.co/functions/v1/process-agent-actions',
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
WHERE jobname = 'process-agent-actions';

