# Agent Mode Cron Execution Fix

## 🔍 Root Cause Identified

**Problem:** Scheduled Agent Mode actions are not executing because:
1. **Vercel cron schedule is once daily** (`0 9 * * *` = 9 AM UTC daily)
2. **Vercel free tier limitation:** Only allows cron jobs to run **once per day**, not every 5 minutes
3. **Cron is not executing** during testing (only runs at 9 AM UTC)

## ✅ Solution: External Cron Service

Since Vercel free tier limits cron to once per day, we'll use an **external cron service** (cron-job.org - free) to call the Supabase Edge Function directly every 5 minutes.

### Benefits:
- ✅ Free tier available
- ✅ Can run every 5 minutes (or any frequency)
- ✅ Calls Supabase Edge Function directly (bypasses Vercel)
- ✅ More reliable than Vercel free tier cron

## 🚀 Implementation Steps

### Option 1: Use cron-job.org (Recommended for Free Tier)

1. **Go to cron-job.org** and create a free account
2. **Create a new cron job:**
   - **Title:** `SONA Agent Mode - Process Scheduled Posts`
   - **URL:** `https://wqwhlbmsafgjlsjujuel.supabase.co/functions/v1/process-scheduled-posts`
   - **Method:** `POST`
   - **Headers:**
     ```
     Authorization: Bearer YOUR_CRON_SECRET
     Content-Type: application/json
     ```
   - **Schedule:** `*/5 * * * *` (every 5 minutes)
   - **Timeout:** 30 seconds

3. **Update CRON_SECRET in Supabase:**
   - Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets
   - Ensure `CRON_SECRET` is set (same value as in Vercel)

4. **Test the cron job:**
   - Click "Run now" in cron-job.org
   - Check Supabase Edge Function logs
   - Verify scheduled posts are processed

### Option 2: Use Supabase pg_cron (If Available)

If your Supabase plan supports `pg_cron`, you can schedule directly in the database:

```sql
-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule job to call edge function every 5 minutes
SELECT cron.schedule(
  'process-scheduled-posts',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://wqwhlbmsafgjlsjujuel.supabase.co/functions/v1/process-scheduled-posts',
      headers := jsonb_build_object(
        'Authorization', 'Bearer YOUR_CRON_SECRET',
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
```

**Note:** pg_cron may not be available on all Supabase plans. Check your plan first.

### Option 3: Keep Vercel Cron + Add Manual Trigger

Keep the current Vercel cron for daily processing, but add a **manual trigger button** in the UI for immediate testing:

1. Add a "Process Now" button in the Automation Queue UI
2. Button calls the edge function directly
3. Useful for testing and immediate execution

## 📊 Current vs. Fixed Schedule

**Before:**
- Vercel cron: Once daily at 9 AM UTC
- Actions scheduled 20-28 hours in future
- Total delay: 30-36 hours minimum

**After (with external cron):**
- External cron: Every 5 minutes
- Actions execute within 5 minutes of scheduled time
- Total delay: ~5 minutes maximum

## 🔧 Code Changes Needed

### 1. Update vercel.json (Keep for agent discovery)
```json
{
  "crons": [
    {
      "path": "/api/cron/process-agent",
      "schedule": "0 */6 * * *"  // Every 6 hours for agent discovery
    }
  ]
}
```

**Note:** We can remove `/api/cron/process-posts` from Vercel since external cron will handle it.

### 2. Edge Function Already Supports Direct Calls

The `process-scheduled-posts` edge function already supports:
- ✅ Direct HTTP calls (not just from Vercel)
- ✅ CRON_SECRET authentication
- ✅ CORS headers for external services

No code changes needed! Just set up the external cron service.

## ⚠️ Important Notes

1. **CRON_SECRET Security:**
   - Keep `CRON_SECRET` secure
   - Use the same value in both Vercel and Supabase
   - External cron service will need this secret

2. **Rate Limits:**
   - Supabase Edge Functions: 500k invocations/month (free tier)
   - Every 5 minutes = ~8,640 calls/month (well within limit)

3. **Monitoring:**
   - Check cron-job.org dashboard for execution history
   - Monitor Supabase Edge Function logs
   - Set up alerts for failures

4. **Fallback:**
   - Keep Vercel cron as backup (runs once daily)
   - External cron handles frequent execution

## 🧪 Testing

After setting up external cron:

1. **Schedule a test post** for 10 minutes in the future
2. **Wait 10 minutes**
3. **Check:**
   - Automation Queue (post should change to "posted")
   - Supabase Edge Function logs
   - cron-job.org execution log
   - Twitter account (verify action executed)

## 📝 Next Steps

1. ✅ Set up cron-job.org account
2. ✅ Create cron job pointing to Supabase Edge Function
3. ✅ Test with a scheduled post
4. ✅ Monitor for 24 hours to ensure reliability
5. ✅ Update documentation with new setup

