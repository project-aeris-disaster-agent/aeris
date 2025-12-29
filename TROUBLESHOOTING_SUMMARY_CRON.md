# CRON Architecture Troubleshooting Summary

**Date:** 2025-01-28  
**Status:** ✅ Optimized for Free Tier

---

## Changes Made

### 1. ✅ Removed Redundant Vercel CRON

**File:** `vercel.json`

**Before:**
```json
"crons": [
  {
    "path": "/api/cron/process-agent",
    "schedule": "0 9 * * *"
  },
  {
    "path": "/api/cron/process-posts",
    "schedule": "0 10 * * *"  // ❌ Redundant
  }
]
```

**After:**
```json
"crons": [
  {
    "path": "/api/cron/process-agent",
    "schedule": "0 9 * * *"  // ✅ Kept as primary
  }
]
```

**Reason:** 
- pg_cron handles post execution every 5 minutes (more frequent than daily)
- Vercel free tier only allows daily cron jobs
- No need for redundant daily backup

---

### 2. ✅ Updated Documentation

**Files Updated:**
- `AGENT_MODE_COMPREHENSIVE_AUDIT.md` - Updated cron configuration section
- `PG_CRON_SETUP_COMPLETE.md` - Clarified current architecture
- `SETUP_PG_CRON_INSTRUCTIONS.md` - Fixed inaccuracies
- `docs/CRON_ARCHITECTURE.md` - **NEW** comprehensive architecture guide

---

## Current Architecture

### Agent Discovery (Scheduling)
- **Vercel CRON:** Daily at 9 AM UTC (Primary)
- **pg_cron:** Every 6 hours (Supplemental - reduces delay)

### Post Execution
- **pg_cron:** Every 5 minutes (Primary)
- **Vercel CRON:** ~~Removed~~ (was redundant)

---

## Free Tier Optimization

### Vercel Free Tier
- ✅ **Limit:** 1 cron job per day maximum
- ✅ **Usage:** 1 cron job (process-agent) - within limit
- ✅ **Removed:** Redundant process-posts cron

### Supabase Free Tier
- ✅ **Limit:** 500,000 Edge Function invocations/month
- ✅ **Current Usage:** ~8,790 calls/month (1.76% of limit)
  - pg_cron every 5 min: ~8,640 calls/month
  - pg_cron every 6 hours: ~120 calls/month
  - Vercel daily: ~30 calls/month
- ✅ **Status:** Well within limits, can scale significantly

---

## Verification Steps

### 1. Check Vercel CRON Configuration
```bash
# Verify vercel.json only has process-agent
cat vercel.json | grep -A 5 "crons"
```

**Expected:** Only `process-agent` cron entry

### 2. Check pg_cron Jobs
```sql
-- Verify both cron jobs exist
SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job 
WHERE jobname IN ('process-scheduled-posts', 'process-agent-actions');
```

**Expected:**
- `process-scheduled-posts`: `*/5 * * * *` (every 5 minutes)
- `process-agent-actions`: `0 */6 * * *` (every 6 hours)

### 3. Check Recent Executions
```sql
-- Check pg_cron execution history
SELECT 
  j.jobname,
  jrd.status,
  jrd.start_time,
  jrd.end_time,
  jrd.return_message
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname IN ('process-scheduled-posts', 'process-agent-actions')
ORDER BY jrd.start_time DESC
LIMIT 20;
```

**Expected:** Recent successful executions for both jobs

### 4. Test Manual Trigger (Optional)
```bash
# Test process-posts endpoint (should still work, just not scheduled)
curl -X POST https://YOUR_SUPABASE_URL/functions/v1/process-scheduled-posts \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

**Expected:** 200 OK response

---

## Benefits

✅ **Cleaner Architecture:**
- No redundant cron jobs
- Clear separation: Vercel for daily, pg_cron for frequent

✅ **Better Performance:**
- Post execution every 5 minutes (not daily)
- Agent discovery every 6 hours (not just daily)

✅ **Free Tier Optimized:**
- Uses Supabase pg_cron (free) for frequent tasks
- Uses Vercel CRON (free) for daily backup
- Well within invocation limits

✅ **More Reliable:**
- Multiple triggers for agent discovery (Vercel + pg_cron)
- Frequent execution for posts (every 5 minutes)
- No external dependencies

---

## Monitoring

### Key Metrics to Watch

1. **pg_cron Execution Success Rate:**
   ```sql
   SELECT 
     jobname,
     COUNT(*) as total_runs,
     SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) as succeeded,
     SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
   FROM cron.job_run_details jrd
   JOIN cron.job j ON j.jobid = jrd.jobid
   WHERE j.jobname IN ('process-scheduled-posts', 'process-agent-actions')
   AND jrd.start_time > NOW() - INTERVAL '24 hours'
   GROUP BY jobname;
   ```

2. **Edge Function Invocation Count:**
   - Check Supabase Dashboard → Edge Functions → Invocations
   - Should be ~8,790/month (well within 500k limit)

3. **Scheduled Posts Execution:**
   ```sql
   SELECT 
     status,
     COUNT(*) as count,
     COUNT(*) FILTER (WHERE posted_at > NOW() - INTERVAL '24 hours') as last_24h
   FROM scheduled_posts
   GROUP BY status;
   ```

---

## Troubleshooting

### Issue: Posts not executing
1. Check pg_cron is running: `SELECT * FROM cron.job WHERE jobname = 'process-scheduled-posts';`
2. Check recent executions: `SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-scheduled-posts') ORDER BY start_time DESC LIMIT 10;`
3. Check Edge Function logs in Supabase Dashboard
4. Verify `CRON_SECRET` matches in Supabase secrets

### Issue: Agent discovery not running
1. Check Vercel CRON logs (Vercel Dashboard → Cron Jobs)
2. Check pg_cron executions: `SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-agent-actions') ORDER BY start_time DESC LIMIT 10;`
3. Verify Edge Function is accessible

### Issue: Edge Function returns 401
- Verify `CRON_SECRET` in Supabase Edge Function secrets matches SQL migrations
- Check authorization header format: `Bearer YOUR_SECRET`

---

## Next Steps

1. ✅ **Monitor for 24 hours** to ensure everything works correctly
2. ✅ **Check execution logs** daily for any errors
3. ✅ **Verify scheduled posts** are executing on time
4. ✅ **Review Edge Function invocations** monthly to ensure within limits

---

## Files Changed

- ✅ `vercel.json` - Removed redundant process-posts cron
- ✅ `AGENT_MODE_COMPREHENSIVE_AUDIT.md` - Updated documentation
- ✅ `PG_CRON_SETUP_COMPLETE.md` - Updated status
- ✅ `SETUP_PG_CRON_INSTRUCTIONS.md` - Fixed inaccuracies
- ✅ `docs/CRON_ARCHITECTURE.md` - **NEW** comprehensive guide

---

**Status:** ✅ Complete - System optimized for free tier with no redundant components

