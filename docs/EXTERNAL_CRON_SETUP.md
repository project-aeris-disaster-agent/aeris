# External Cron Service Setup (DEPRECATED)

> ⚠️ **NOTE**: This approach has been superseded by **Supabase pg_cron + pg_net**, which is the industry-standard solution and is now implemented. See below for details.

## Current Implementation: pg_cron (Recommended ✅)

The scheduler now uses Supabase's built-in `pg_cron` and `pg_net` extensions:

```sql
-- Runs every 5 minutes automatically within Postgres
SELECT cron.schedule(
  'process-scheduled-posts',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wqwhlbmsafgjlsjujuel.supabase.co/functions/v1/process-scheduled-posts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer Sonara2026!'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**Benefits:**
- ✅ No external dependencies
- ✅ Runs within Supabase infrastructure
- ✅ No HTTP header issues (like cron-job.org's query param behavior)
- ✅ Reliable and industry-standard
- ✅ Free with Supabase

---

# Legacy: External Cron Service (cron-job.org)

> This section is kept for reference. Use only if pg_cron is not available.

This guide sets up a free external cron service to trigger the scheduler every 5 minutes, bypassing Vercel's daily cron limitation.

## Why External Cron?

- **Vercel Hobby Plan**: Only allows daily cron jobs (once per day)
- **External Cron**: Free services can run every 5 minutes
- **Result**: Posts execute within 5 minutes of their scheduled time

> ⚠️ **Known Issue**: cron-job.org sends headers as URL query parameters, not HTTP headers, which causes authentication issues with Supabase Edge Functions.

## Setup Steps

### 1. Create Account on cron-job.org

1. Go to https://cron-job.org
2. Sign up for a free account (no credit card required)
3. Verify your email

### 2. Create New Cron Job

1. Click **"Create cronjob"** button
2. Fill in the details:

**Basic Settings:**
- **Title**: `Twitter Scheduler - Process Posts`
- **Address (URL)**: 
  ```
  https://wqwhlbmsafgjlsjujuel.supabase.co/functions/v1/process-scheduled-posts
  ```
- **Request Method**: `POST`
- **Request Headers**: 
  ```
  Authorization: Bearer Sonara2026!
  Content-Type: application/json
  ```

**Schedule:**
- **Execution Schedule**: `Every 5 minutes`
- Or use cron expression: `*/5 * * * *`

**Advanced Settings:**
- **Timeout**: `30 seconds`
- **Retry on failure**: `Yes` (optional)
- **Notification on failure**: `Yes` (optional, add your email)

### 3. Test the Cron Job

1. After creating, click **"Run now"** to test
2. Check the execution log
3. Verify it returns `200 OK` status

### 4. Verify It's Working

Check your scheduled posts in the database:
```sql
SELECT id, content, scheduled_for, status, posted_at 
FROM scheduled_posts 
WHERE status IN ('pending', 'posted')
ORDER BY scheduled_for DESC;
```

## Alternative: Use Vercel API Route (If Protection Disabled)

If you disable Vercel deployment protection, you can also use:
```
https://sonara-r2983k6bv-agent-aeris-projects.vercel.app/api/cron/process-posts
```

But the Supabase Edge Function URL is recommended as it's more reliable.

## Security Notes

- The `CRON_SECRET` protects your endpoint
- Only cron-job.org will have the secret
- The secret is stored securely in cron-job.org's system
- You can rotate the secret anytime by updating both:
  - Supabase Edge Function secret
  - cron-job.org header value

## Monitoring

### Check cron-job.org Dashboard
- View execution history
- See success/failure rates
- Get notified of failures

### Check Supabase Logs
- Go to Supabase Dashboard
- Edge Functions → `process-scheduled-posts` → Logs
- See detailed execution logs

## Troubleshooting

### Cron job returns 401 Unauthorized
- Verify `CRON_SECRET` matches in both places
- Check header format: `Authorization: Bearer <secret>`

### Posts not executing
- Verify cron job is running (check execution log)
- Check if posts have `scheduled_for <= NOW()`
- Verify user has valid Twitter tokens

### Cron job times out
- Increase timeout to 60 seconds
- Check Edge Function logs for slow queries

## Cost

**cron-job.org Free Tier:**
- ✅ Up to 2 cron jobs
- ✅ Unlimited executions
- ✅ 5-minute minimum interval
- ✅ Email notifications
- ✅ Execution history

Perfect for this use case!

## Quick Setup Checklist

- [ ] Create cron-job.org account
- [ ] Create new cron job
- [ ] Set URL to Supabase Edge Function
- [ ] Add Authorization header with CRON_SECRET
- [ ] Set schedule to every 5 minutes
- [ ] Test with "Run now"
- [ ] Verify posts are being processed
- [ ] Monitor for 24 hours

---

**Note**: You can keep the Vercel cron as a backup (runs daily), but the external cron will handle most executions.

