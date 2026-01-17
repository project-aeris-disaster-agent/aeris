# CRON & Edge Functions Architecture

**Last Updated:** 2025-01-28  
**Status:** Optimized for Free Tier (Vercel + Supabase)

---

## Overview

This document explains how CRON jobs and Edge Functions work together in the SONA Agent Mode system, optimized for free tier limitations.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGENT MODE SCHEDULING SYSTEM                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PHASE 1: AGENT DISCOVERY & SCHEDULING                         │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Vercel Cron (9 AM UTC daily)                             │ │
│  │   → /api/cron/process-agent                               │ │
│  │   → process-agent-actions Edge Function                   │ │
│  │   • Finds users with agent_settings.enabled = true        │ │
│  │   • Checks frequency & lastRunAt                          │ │
│  │   • Fetches tweets from target accounts                   │ │
│  │   • Generates AI replies (Grok API)                       │ │
│  │   • Schedules actions in scheduled_posts table            │ │
│  └──────────────────────────────────────────────────────────┘ │
│                          ↓                                       │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ pg_cron (Every 6 hours) - SUPPLEMENTAL                   │ │
│  │   → process-agent-actions Edge Function                   │ │
│  │   • Same as above, but runs more frequently              │ │
│  │   • Reduces discovery delay from 24h to 6h max            │ │
│  └──────────────────────────────────────────────────────────┘ │
│                          ↓                                       │
│  PHASE 2: ACTION EXECUTION                                     │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ pg_cron (Every 5 minutes) - PRIMARY                       │ │
│  │   → process-scheduled-posts Edge Function                  │ │
│  │   • Queries: status='pending' AND scheduled_for <= NOW()  │ │
│  │   • Processes up to 20 posts per run                     │ │
│  │   • Executes Twitter actions (retweet, like, comment)    │ │
│  │   • Updates status to 'posted' or 'failed'                │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components Breakdown

### 1. Vercel CRON Jobs

**Location:** `vercel.json`

**Current Configuration:**
- **`/api/cron/process-agent`**: Runs daily at 9 AM UTC
  - Purpose: Agent discovery and scheduling
  - Calls: `process-agent-actions` Edge Function
  - Status: ✅ Active (Primary)

**Removed:**
- ~~`/api/cron/process-posts`~~: Removed (redundant)
  - Reason: pg_cron handles this every 5 minutes (more frequent)

**Vercel Free Tier Limitation:**
- ⚠️ **Maximum frequency: Once per day**
- Cannot run every 5 minutes or every 6 hours
- This is why we use Supabase pg_cron for frequent tasks

---

### 2. Supabase pg_cron (Database-Level Scheduling)

**Location:** `supabase/migrations/`

**Active Jobs:**

#### A. `process-scheduled-posts` (PRIMARY)
- **Schedule:** `*/5 * * * *` (Every 5 minutes)
- **Migration:** `20250122_setup_pg_cron_scheduler.sql`
- **Purpose:** Execute scheduled posts
- **Calls:** `process-scheduled-posts` Edge Function
- **Status:** ✅ Active (Primary execution method)

#### B. `process-agent-actions` (SUPPLEMENTAL)
- **Schedule:** `0 */6 * * *` (Every 6 hours: 0:00, 6:00, 12:00, 18:00)
- **Migration:** `20250128_add_process_agent_cron.sql`
- **Purpose:** Agent discovery (supplements Vercel's daily cron)
- **Calls:** `process-agent-actions` Edge Function
- **Status:** ✅ Active (Reduces discovery delay)

**How pg_cron Works:**
1. PostgreSQL extension (`pg_cron`) runs scheduled SQL
2. Uses `pg_net` extension to make HTTP requests
3. Calls Supabase Edge Functions directly
4. Runs within Supabase infrastructure (no external dependencies)

---

### 3. Supabase Edge Functions

**Location:** `supabase/functions/`

#### A. `process-agent-actions`
- **Triggered by:**
  - Vercel CRON (daily at 9 AM)
  - pg_cron (every 6 hours)
- **Purpose:**
  - Find users with Agent Mode enabled
  - Check if it's time to run (based on frequency & lastRunAt)
  - Fetch tweets from target accounts
  - Generate AI replies (Grok API)
  - Schedule actions in `scheduled_posts` table
- **Output:** Creates entries in `scheduled_posts` table

#### B. `process-scheduled-posts`
- **Triggered by:** pg_cron (every 5 minutes)
- **Purpose:**
  - Query pending posts: `status='pending' AND scheduled_for <= NOW()`
  - Execute Twitter actions (retweet, like, comment)
  - Update status to 'posted' or 'failed'
- **Output:** Updates `scheduled_posts` table

---

## How They Work Together

### Agent Discovery Flow:
```
1. Vercel Cron (9 AM daily) OR pg_cron (every 6 hours)
   ↓
2. Calls process-agent-actions Edge Function
   ↓
3. Edge Function queries profiles table
   ↓
4. For each eligible user:
   - Fetches tweets from target accounts
   - Generates AI replies
   - Creates entries in scheduled_posts table
   ↓
5. Actions scheduled 20-28 hours in future (daily frequency)
```

### Action Execution Flow:
```
1. pg_cron (every 5 minutes)
   ↓
2. Calls process-scheduled-posts Edge Function
   ↓
3. Edge Function queries scheduled_posts table
   ↓
4. For each due post:
   - Loads user's Twitter tokens
   - Refreshes token if expired
   - Executes Twitter API call
   ↓
5. Updates status: 'posted' or 'failed'
```

---

## Free Tier Limitations & Solutions

### Vercel Free Tier

**Limitations:**
- ❌ CRON jobs: Maximum once per day
- ❌ Cannot run every 5 minutes
- ❌ Cannot run every 6 hours

**Impact:**
- Agent discovery limited to once daily
- Post execution cannot use Vercel CRON for frequent runs

**Solution:**
- ✅ Use Supabase pg_cron for frequent execution (every 5 minutes)
- ✅ Use pg_cron for more frequent agent discovery (every 6 hours)
- ✅ Keep Vercel CRON as primary daily backup

### Supabase Free Tier

**Limitations:**
- Edge Function invocations: 500,000/month
- Database size: 500 MB
- Bandwidth: 5 GB/month

**Current Usage:**
- pg_cron every 5 minutes = ~8,640 calls/month (1.7% of limit)
- pg_cron every 6 hours = ~120 calls/month (negligible)
- Vercel CRON daily = ~30 calls/month (negligible)
- **Total: ~8,790 Edge Function calls/month (1.76% of limit)** ✅

**Status:** Well within free tier limits, can scale significantly

---

## Current Configuration Summary

| Component | Type | Frequency | Purpose | Status |
|-----------|------|-----------|---------|--------|
| Vercel `/api/cron/process-agent` | Vercel CRON | Daily (9 AM UTC) | Agent discovery | ✅ Primary |
| pg_cron `process-agent-actions` | Supabase pg_cron | Every 6 hours | Agent discovery | ✅ Supplemental |
| pg_cron `process-scheduled-posts` | Supabase pg_cron | Every 5 minutes | Execute posts | ✅ Primary |
| ~~Vercel `/api/cron/process-posts`~~ | ~~Vercel CRON~~ | ~~Daily (10 AM UTC)~~ | ~~Execute posts~~ | ❌ Removed (redundant) |

---

## Key Files

### Configuration:
- `vercel.json` - Vercel CRON configuration
- `supabase/migrations/20250122_setup_pg_cron_scheduler.sql` - Post execution scheduler
- `supabase/migrations/20250128_add_process_agent_cron.sql` - Agent discovery scheduler

### API Routes:
- `api/cron/process-agent.ts` - Vercel CRON handler for agent discovery
- ~~`api/cron/process-posts.ts`~~ - **Removed** (redundant - pg_cron handles execution every 5 minutes)
  - For manual testing, call Edge Function directly: `POST /functions/v1/process-scheduled-posts`

### Edge Functions:
- `supabase/functions/process-agent-actions/index.ts` - Agent discovery logic
- `supabase/functions/process-scheduled-posts/index.ts` - Post execution logic

---

## Monitoring & Verification

### Check pg_cron Status:
```sql
-- Verify cron jobs exist
SELECT * FROM cron.job 
WHERE jobname IN ('process-scheduled-posts', 'process-agent-actions');

-- Check recent executions
SELECT 
  j.jobname,
  jrd.status,
  jrd.return_message,
  jrd.start_time,
  jrd.end_time
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname IN ('process-scheduled-posts', 'process-agent-actions')
ORDER BY jrd.start_time DESC
LIMIT 20;
```

### Check HTTP Responses:
```sql
-- View HTTP calls made by pg_cron
SELECT 
  url,
  status_code,
  content,
  created
FROM net._http_response
WHERE url LIKE '%process-scheduled-posts%' 
   OR url LIKE '%process-agent-actions%'
ORDER BY created DESC
LIMIT 10;
```

### Check Scheduled Posts:
```sql
-- Pending posts waiting for execution
SELECT 
  id,
  post_type,
  status,
  scheduled_for,
  post_metadata->>'generated_by' as source
FROM scheduled_posts
WHERE status = 'pending'
AND scheduled_for <= NOW()
ORDER BY scheduled_for ASC;
```

---

## Troubleshooting

### Issue: Posts not executing
1. Check pg_cron is running: `SELECT * FROM cron.job WHERE jobname = 'process-scheduled-posts';`
2. Check recent executions: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;`
3. Check Edge Function logs in Supabase Dashboard
4. Verify `CRON_SECRET` matches in Supabase secrets and SQL migrations

### Issue: Agent discovery not running
1. Check Vercel CRON logs (Vercel Dashboard → Cron Jobs)
2. Check pg_cron executions: `SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-agent-actions');`
3. Verify Edge Function is accessible: `GET https://YOUR_SUPABASE_URL/functions/v1/process-agent-actions`

### Issue: Edge Function returns 401
- Verify `CRON_SECRET` in Supabase Edge Function secrets matches the value in SQL migrations
- Check authorization header format: `Bearer YOUR_SECRET`

---

## Benefits of Current Architecture

✅ **Optimized for Free Tier:**
- Uses Supabase pg_cron (free) for frequent tasks
- Uses Vercel CRON (free) for daily backup
- Well within invocation limits

✅ **Reliable:**
- Multiple triggers (Vercel + pg_cron) for agent discovery
- Frequent execution (every 5 minutes) for posts
- No external dependencies

✅ **Scalable:**
- Current usage: 1.76% of free tier limit
- Can handle ~57x current usage before hitting limits
- Easy to monitor via database queries

✅ **Maintainable:**
- Clear separation of concerns
- Database-level scheduling (pg_cron) is industry standard
- Easy to debug via Supabase logs

---

## Future Improvements

1. **Increase Agent Discovery Frequency:**
   - Currently: Daily (Vercel) + Every 6 hours (pg_cron)
   - Could add: More frequent pg_cron (every 3 hours) if needed

2. **Add Monitoring Dashboard:**
   - Track cron execution success rates
   - Alert on failures
   - Show execution history

3. **Optimize First-Run Delay:**
   - Currently: 20-28 hours after discovery
   - Could add: Shorter delay for first run (1-4 hours)

---

**Last Updated:** 2025-01-28

