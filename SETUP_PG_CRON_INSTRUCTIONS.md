# Setup pg_cron for Agent Mode Execution

## 🔍 Problem Identified

**Root Cause:** Vercel free tier only allows cron jobs to run **once per day**, not every 5 minutes. This causes scheduled Agent Mode actions to wait up to 24 hours before execution.

**Solution:** Use Supabase's built-in `pg_cron` extension to run the scheduler every 5 minutes directly from the database.

## ✅ Quick Setup (5 minutes)

### Step 1: Run the Migration

1. **Go to Supabase Dashboard:**
   - Navigate to: **SQL Editor**

2. **Run the migration:**
   - Copy the contents of `supabase/migrations/20250122_setup_pg_cron_scheduler.sql`
   - Paste into SQL Editor
   - Click **Run**

3. **Verify it worked:**
   - You should see a result showing the cron job was created
   - Check for: `jobid`, `jobname: 'process-scheduled-posts'`, `schedule: '*/5 * * * *'`

### Step 2: Verify CRON_SECRET

1. **Check Supabase Secrets:**
   - Go to: **Project Settings** → **Edge Functions** → **Secrets**
   - Verify `CRON_SECRET` is set to: `Sonara2026!`
   - If not set, add it now

### Step 3: Test the Setup

1. **Check cron job status:**
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'process-scheduled-posts';
   ```

2. **Check recent executions:**
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-scheduled-posts')
   ORDER BY start_time DESC 
   LIMIT 10;
   ```

3. **Check HTTP responses:**
   ```sql
   SELECT * FROM net._http_response 
   ORDER BY created DESC 
   LIMIT 10;
   ```

### Step 4: Schedule a Test Post

1. **Create a test scheduled post** for 10 minutes in the future
2. **Wait 10 minutes**
3. **Check:**
   - Automation Queue (post should change to "posted")
   - Supabase Edge Function logs
   - Database: `SELECT * FROM scheduled_posts WHERE status = 'posted' ORDER BY posted_at DESC LIMIT 5;`

## 🔧 What Changed

### Files Modified:
1. **`vercel.json`**
   - ✅ Removed `/api/cron/process-posts` (replaced by pg_cron)
   - ✅ Kept `/api/cron/process-agent` (runs daily at 9 AM UTC for agent discovery)
   - ✅ pg_cron also runs `process-agent-actions` every 6 hours (supplemental)

2. **New Migration:**
   - ✅ `supabase/migrations/20250122_setup_pg_cron_scheduler.sql`
   - Sets up pg_cron to run every 5 minutes

### How It Works:

```
┌─────────────────────────────────────────┐
│ pg_cron (PostgreSQL)                    │
│ Runs every 5 minutes                    │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ pg_net (HTTP Request)                   │
│ POST to Edge Function                   │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ process-scheduled-posts Edge Function   │
│ Executes pending posts                  │
└─────────────────────────────────────────┘
```

## 📊 Benefits

- ✅ **Runs every 5 minutes** (not once per day)
- ✅ **No external dependencies** (runs in Supabase)
- ✅ **Free tier compatible** (pg_cron is free with Supabase)
- ✅ **More reliable** than external cron services
- ✅ **Better monitoring** (check cron.job_run_details)

## ⚠️ Important Notes

1. **CRON_SECRET:** Must match in both:
   - Supabase Edge Function secret: `Sonara2026!`
   - SQL migration: `Bearer Sonara2026!`

2. **Free Tier Limits:**
   - Supabase: 500k Edge Function invocations/month
   - Every 5 minutes = ~8,640 calls/month (well within limit)

3. **Monitoring:**
   - Check `cron.job_run_details` for execution history
   - Check `net._http_response` for HTTP call results
   - Check Supabase Edge Function logs

## 🐛 Troubleshooting

### Cron job not running:
```sql
-- Check if cron job exists
SELECT * FROM cron.job WHERE jobname = 'process-scheduled-posts';

-- Check if extensions are enabled
SELECT * FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');

-- Check recent runs
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

### Edge Function returns 401:
- Verify `CRON_SECRET` in Supabase secrets matches the SQL migration
- Check Edge Function logs for auth errors

### Posts not executing:
- Verify posts have `scheduled_for <= NOW()`
- Check Edge Function logs for errors
- Verify user has valid Twitter tokens

## 📝 Next Steps

After setup:
1. ✅ Monitor for 24 hours to ensure reliability
2. ✅ Check cron execution logs daily
3. ✅ Verify scheduled posts are executing on time
4. ✅ Remove old Vercel cron route (already done in vercel.json)

## 🎯 Expected Results

**Before:**
- Actions scheduled 20-28 hours in future
- Executed once per day at 9 AM UTC
- Total delay: 30-36 hours minimum

**After:**
- Actions scheduled 20-28 hours in future (same)
- Executed every 5 minutes
- Total delay: ~5 minutes maximum after scheduled time

