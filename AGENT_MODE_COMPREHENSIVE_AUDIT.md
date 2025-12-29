# Agent Mode Comprehensive Audit

**Date:** 2025-01-28  
**Status:** System is functional but has timing and visibility challenges

---

## Executive Summary

Your Agent Mode system is **architecturally sound and working**, but has several operational challenges:

1. **Long initial delay** (30-36 hours from enabling to first action)
2. **Limited visibility** into agent status and execution history
3. **Dual scheduling systems** (Vercel cron + pg_cron) creating confusion
4. **No immediate feedback** when agent mode is enabled

**Current Success Rate:** ✅ System executes actions correctly when scheduled  
**Main Issue:** ⚠️ User experience and timing expectations

---

## How Agent Mode Works: Complete Flow

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGENT MODE ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PHASE 1: DISCOVERY & SCHEDULING                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Vercel Cron (9 AM daily)                                  │ │
│  │   → /api/cron/process-agent                                │ │
│  │   → process-agent-actions Edge Function                    │ │
│  │   • Finds users with agent_settings.enabled = true        │ │
│  │   • Checks frequency & lastRunAt (20+ hours for daily)    │ │
│  │   • Fetches tweets from target accounts                   │ │
│  │   • Generates AI replies (Grok) if mention enabled        │ │
│  │   • Schedules actions in scheduled_posts table             │ │
│  │   • Actions scheduled 20-28 hours in future (daily)        │ │
│  └──────────────────────────────────────────────────────────┘ │
│                          ↓                                       │
│  PHASE 2: EXECUTION                                             │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ pg_cron (Every 5 minutes)                                 │ │
│  │   → process-scheduled-posts Edge Function                  │ │
│  │   • Queries: status='pending' AND scheduled_for <= NOW()  │ │
│  │   • Processes up to 20 posts per run                      │ │
│  │   • Executes Twitter actions (retweet, like, comment)     │ │
│  │   • Updates status to 'posted' or 'failed'                │ │
│  └──────────────────────────────────────────────────────────┘ │
│                          ↓                                       │
│  PHASE 3: INSTANT TESTING (Easter Egg)                          │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Google Calendar Button (Manual)                           │ │
│  │   → execute-agent-actions-instant Edge Function           │ │
│  │   • Bypasses scheduling, executes immediately              │ │
│  │   • For testing purposes only                             │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Component Breakdown

### 1. Agent Discovery (Scheduling Phase)

**Trigger:** Vercel Cron  
**Schedule:** `0 9 * * *` (9 AM UTC daily)  
**Location:** `api/cron/process-agent.ts` → `supabase/functions/process-agent-actions/index.ts`

**What It Does:**
1. Finds all users with `agent_settings.enabled = true`
2. Checks if it's time to run based on:
   - `lastRunAt` timestamp
   - Frequency setting (daily = 20+ hours, 3days = 66+ hours, weekly = 144+ hours)
3. For each eligible user:
   - Refreshes Twitter token if expired
   - Fetches character card (for AI replies)
   - For each target account:
     - Gets Twitter user ID by username
     - Fetches recent tweets (last 48 hours)
     - Processes 1-2 most recent tweets
   - Schedules actions with randomized timing:
     - Base time: 20-28 hours in future (daily frequency)
     - Staggered delays: 0-15min, 15-45min, 30-90min between actions
     - Constrained to 9 AM - 9 PM active hours
4. Updates `lastRunAt` timestamp

**Key Code:**
```144:184:supabase/functions/process-agent-actions/index.ts
function calculateRandomizedScheduleTime(
  frequency: 'daily' | '3days' | 'weekly',
  lastRunAt: Date | null
): Date {
  const now = new Date();
  const base = lastRunAt || now;

  // Define min/max hours for each frequency with jitter
  let minHours: number, maxHours: number;
  switch (frequency) {
    case 'daily':
      minHours = 20;  // ⚠️ 20 hours minimum
      maxHours = 28;  // ⚠️ 28 hours maximum
      break;
    case '3days':
      minHours = 66;
      maxHours = 78;
      break;
    case 'weekly':
      minHours = 144;
      maxHours = 192; // 6-8 days
      break;
    default:
      minHours = 20;
      maxHours = 28;
  }
```

### 2. Action Execution (Processing Phase)

**Trigger:** pg_cron (PostgreSQL extension)  
**Schedule:** `*/5 * * * *` (Every 5 minutes)  
**Location:** `supabase/migrations/20250122_setup_pg_cron_scheduler.sql` → `supabase/functions/process-scheduled-posts/index.ts`

**What It Does:**
1. Queries `scheduled_posts` table for:
   - `status = 'pending'`
   - `scheduled_for <= NOW()`
   - Limits to 20 posts per run
2. For each post:
   - Loads user's Twitter tokens
   - Refreshes token if expired
   - Executes action based on `post_type`:
     - `retweet`: POST `/users/{id}/retweets`
     - `like`: POST `/users/{id}/likes`
     - `comment`: POST `/tweets` (reply)
   - Updates status: `posted` or `failed`
   - Stores error message if failed

**Key Code:**
```14:29:supabase/migrations/20250122_setup_pg_cron_scheduler.sql
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
```

### 3. Instant Execution (Testing/Easter Egg)

**Trigger:** Manual (Google Calendar button)  
**Location:** `src/components/GoogleCalendarWidget.tsx` → `supabase/functions/execute-agent-actions-instant/index.ts`

**What It Does:**
- Bypasses scheduling entirely
- Executes actions immediately
- Useful for testing and instant feedback
- Does NOT create entries in `scheduled_posts` table

---

## Current Configuration

### Cron Schedules

**Vercel Cron (`vercel.json`):**
```13:17:vercel.json
"crons": [
  {
    "path": "/api/cron/process-agent",
    "schedule": "0 9 * * *"
  }
]
```

**Note:** The `process-posts` cron was removed from Vercel as it's redundant. pg_cron handles post execution every 5 minutes, which is more frequent and reliable.

### Database Schema

**Agent Settings (stored in `profiles.agent_settings` JSONB):**
```typescript
{
  enabled: boolean
  targetAccounts: string[]
  actions: {
    retweet: boolean
    like: boolean
    mention: boolean
  }
  frequency: 'daily' | '3days' | 'weekly'
  lastRunAt: string | null
}
```

**Scheduled Posts (`scheduled_posts` table):**
- `status`: 'pending' | 'posted' | 'failed' | 'cancelled'
- `post_type`: 'retweet' | 'like' | 'comment' | 'tweet' | 'reply' | 'thread'
- `post_metadata->generated_by`: 'agent_mode' | 'ai' | 'manual'
- `scheduled_for`: ISO timestamp
- `posted_at`: ISO timestamp (when executed)

---

## What's Working ✅

### 1. Core Functionality
- ✅ Agent discovery finds enabled users correctly
- ✅ Frequency checking works (20+ hours for daily)
- ✅ Tweet fetching from target accounts
- ✅ AI reply generation (Grok API)
- ✅ Action scheduling with randomized timing
- ✅ Token refresh on expiration
- ✅ Duplicate detection (won't retweet/like same tweet twice)
- ✅ Execution via pg_cron every 5 minutes
- ✅ Status updates (pending → posted/failed)
- ✅ Smart logout behavior (preserves tokens if Agent Mode enabled)

### 2. Safety Features
- ✅ Randomized timing (20-28 hour jitter) to avoid detection
- ✅ Staggered delays between actions (0-90 minutes)
- ✅ Active hours constraint (9 AM - 9 PM)
- ✅ Duplicate prevention (checks before scheduling)
- ✅ Token auto-refresh
- ✅ Error handling and logging

### 3. User Interface
- ✅ AutomationQueue shows pending actions
- ✅ History tab shows completed actions
- ✅ Predicted actions preview (shows what will be scheduled)
- ✅ Agent badge on agent-generated actions
- ✅ Auto-refresh every 30 seconds
- ✅ Overdue task cleanup on mount

### 4. Logout Behavior (Updated)
- ✅ **Smart token preservation:** If Agent Mode is enabled, Twitter tokens are preserved on logout
- ✅ **Autonomous operation:** Scheduled actions continue executing even when user is logged out
- ✅ **Account switching support:** Users can log out to switch accounts without breaking scheduled actions
- ✅ **Conditional cleanup:** If Agent Mode is disabled, tokens are cleared and tasks are cancelled (as before)

**Implementation Details:**
- Logout checks `agent_settings.enabled` before clearing tokens
- If enabled: preserves tokens, clears only session data
- If disabled: cancels pending tasks and clears tokens (original behavior)
- This allows Agent Mode to work autonomously while supporting account switching

---

## Challenges & Issues ⚠️

### 🔴 Critical: Long Initial Delay

**Problem:** 30-36 hours from enabling Agent Mode to first action execution

**Breakdown:**
1. **Discovery Delay:** Up to 24 hours (cron runs at 9 AM daily)
   - If enabled at 10 AM → waits until 9 AM next day (23 hours)
   - If enabled at 8 AM → waits until 9 AM same day (1 hour)
2. **Scheduling Delay:** 20-28 hours after discovery
   - Actions scheduled 20-28 hours in future
3. **Total:** 30-36 hours minimum

**Impact:**
- Users expect immediate or near-immediate action
- No feedback that system is working
- Appears "broken" to new users

**Evidence:**
```154:156:supabase/functions/process-agent-actions/index.ts
    case 'daily':
      minHours = 20;  // ⚠️ 20 hours minimum
      maxHours = 28;  // ⚠️ 28 hours maximum
```

### 🟡 Medium: Limited Visibility

**Problem:** Users can't see:
- When last agent run occurred
- How many actions were scheduled in last run
- When next run will happen
- Execution success/failure rates
- Detailed error messages

**Current State:**
- AutomationQueue shows pending/completed actions ✅
- But doesn't show agent run statistics ❌
- No "Last run: 2 hours ago" indicator ❌
- No "Next scheduled run: 6 hours" indicator ❌

**Code Reference:**
```439:504:src/services/agentService.ts
export async function getAgentActivityStats(userId: string): Promise<AgentActivityStats> {
  // ... fetches stats but not displayed prominently in UI
  return {
    pendingActions: pendingData?.length || 0,
    scheduledToday: scheduledTodayData?.length || 0,
    executedToday: executedTodayData?.length || 0,
    failedToday: failedTodayData?.length || 0,
    nextScheduledAction: pendingData && pendingData.length > 0 
      ? new Date(pendingData[0].scheduled_for) 
      : null,
    lastRunAt: settings.lastRunAt ? new Date(settings.lastRunAt) : null,
  };
}
```

### 🟡 Medium: Dual Scheduling Systems

**Problem:** Both Vercel cron and pg_cron exist, creating confusion

**Current State:**
- `process-agent` cron: Vercel (9 AM daily) ✅ Primary
- `process-posts` cron: pg_cron (every 5 min) ✅ Primary
- `process-posts` cron: Vercel (10 AM daily) ⚠️ Redundant backup

**Impact:**
- Unclear which system is actually running
- Potential for conflicts (though unlikely)
- Maintenance overhead

### 🟡 Medium: No First-Run Optimization

**Problem:** First-time runs use same 20-28 hour delay as subsequent runs

**Impact:**
- New users wait 30-36 hours for first action
- No way to "test" agent mode quickly (except easter egg)

**Potential Fix:**
```typescript
// In calculateRandomizedScheduleTime
if (!lastRunAt) {
  // First run - schedule sooner
  minHours = 1;
  maxHours = 4;
} else {
  // Subsequent runs - use normal delay
  // ... existing logic
}
```

### 🟢 Low: Error Visibility

**Problem:** Failed actions show error messages, but not prominently

**Current State:**
- Error messages stored in `error_message` column ✅
- Shown in History tab ✅
- But truncated to 50 characters ❌
- No retry mechanism ❌

**Code Reference:**
```635:639:src/components/AutomationQueue.tsx
                                  {!isSuccess && post.error_message && (
                                    <p className="text-red-400/80 text-[10px] mb-1">
                                      Error: {post.error_message.slice(0, 50)}...
                                    </p>
                                  )}
```

---

## Improvement Recommendations

### 🚀 Priority 1: Reduce Initial Delay

#### Option A: Increase Discovery Frequency
**Change:** Run agent discovery every 6 hours instead of daily

**Implementation:**
```json
// vercel.json
{
  "path": "/api/cron/process-agent",
  "schedule": "0 */6 * * *"  // Every 6 hours
}
```

**Impact:** Reduces max wait from 24 hours to 6 hours

#### Option B: First-Run Optimization
**Change:** Schedule first run 1-4 hours instead of 20-28 hours

**Implementation:**
```typescript
// In calculateRandomizedScheduleTime
if (!lastRunAt) {
  // First run - schedule sooner for immediate feedback
  minHours = 1;
  maxHours = 4;
} else {
  // Subsequent runs - use normal delay
  minHours = 20;
  maxHours = 28;
}
```

**Impact:** First action executes within 7-10 hours (6h discovery + 1-4h scheduling)

#### Option C: Manual Trigger Button
**Change:** Add "Run Agent Now" button in UI

**Implementation:**
- Add button to AutomationDropdown
- Calls `process-agent-actions` Edge Function directly
- Shows immediate feedback

**Impact:** Users can trigger immediately for testing

**Recommended:** Implement all three options for best UX

---

### 🚀 Priority 2: Enhanced Visibility

#### 2.1 Agent Status Dashboard
**Add to AutomationDropdown or HomePage:**

**Display:**
- Last run timestamp: "Last run: 2 hours ago"
- Next scheduled run: "Next run: 4 hours"
- Actions scheduled today: "5 actions scheduled"
- Actions executed today: "3 executed, 1 failed"
- Success rate: "75% success rate"

**Implementation:**
```typescript
// Use existing getAgentActivityStats function
const stats = await getAgentActivityStats(userId);
// Display in UI component
```

#### 2.2 Execution History View
**Enhance History tab:**

**Add:**
- Filters: All / Success / Failed / Agent Only
- Full error messages (not truncated)
- Retry button for failed actions
- Links to Twitter posts
- Group by date

#### 2.3 Real-time Updates
**Add Supabase Realtime subscription:**

**Implementation:**
```typescript
// Subscribe to scheduled_posts changes
supabase
  .channel('scheduled_posts_changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'scheduled_posts',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    // Update UI immediately
  })
  .subscribe();
```

**Impact:** UI updates instantly when actions are scheduled/executed

---

### 🚀 Priority 3: Better User Experience

#### 3.1 Onboarding Flow
**When Agent Mode is first enabled:**

**Show:**
- Explanation: "Actions will be scheduled within 6 hours"
- Example: "You'll retweet @account1's latest tweet"
- Timeline: "First action: ~6 hours, then every 24 hours"
- Link to AutomationQueue: "View scheduled actions"

#### 3.2 Action Preview
**Before scheduling (optional):**

**Show:**
- Which tweets will be engaged
- Preview of generated replies
- Allow approve/reject before scheduling

**Note:** This adds complexity, may not be necessary

#### 3.3 Status Indicators
**Add visual indicators:**

**In HomePage:**
- Green dot: "Agent Mode Active"
- Yellow dot: "Waiting for next run"
- Red dot: "Agent Mode Error"

**In AutomationDropdown:**
- Show last run time prominently
- Show next scheduled action count

---

### 🚀 Priority 4: Reliability Improvements

#### 4.1 Retry Mechanism
**For failed actions:**

**Implementation:**
- Add `retry_count` column to `scheduled_posts`
- Auto-retry failed actions (max 3 times)
- Exponential backoff (1h, 4h, 12h)

#### 4.2 Better Error Handling
**Improve error messages:**

**Current:**
```
Error: Twitter API 400: {'errors': [{'message': 'You cannot...'}]}
```

**Improved:**
```
Error: Already retweeted this tweet (Twitter API 400)
```

**Implementation:**
```typescript
// Parse Twitter API errors better
function parseTwitterError(error: any): string {
  if (error.errors?.[0]?.message) {
    return error.errors[0].message;
  }
  return error.message || 'Unknown error';
}
```

#### 4.3 Monitoring & Alerts
**Add monitoring:**

**Track:**
- Agent processing success rate
- Average time to first action
- Token refresh failures
- Execution failures

**Alerts:**
- No actions scheduled for 24+ hours
- High failure rate (>20%)
- Token refresh failures

---

## Implementation Plan

### Phase 1: Quick Wins (1-2 days)
1. ✅ Increase discovery frequency to every 6 hours
2. ✅ Add first-run optimization (1-4 hour delay)
3. ✅ Add agent status display to AutomationDropdown
4. ✅ Add "Run Agent Now" manual trigger button

### Phase 2: Enhanced Visibility (3-5 days)
1. ✅ Create AgentStatusDashboard component
2. ✅ Enhance History tab with filters
3. ✅ Add real-time updates via Supabase Realtime
4. ✅ Improve error message display

### Phase 3: Advanced Features (1-2 weeks)
1. ✅ Add retry mechanism for failed actions
2. ✅ Add onboarding flow for new users
3. ✅ Add monitoring dashboard
4. ✅ Add email/SMS notifications for failures

---

## Testing Checklist

### Manual Testing:
- [ ] Enable Agent Mode
- [ ] Verify settings saved to database
- [ ] Wait for cron execution (or trigger manually)
- [ ] Verify actions scheduled in `scheduled_posts`
- [ ] Verify actions appear in AutomationQueue
- [ ] Wait for scheduled time
- [ ] Verify actions executed
- [ ] Check Twitter for retweets/likes/replies
- [ ] Verify execution history in UI
- [ ] Test logout (should cancel pending tasks)
- [ ] Test instant execution (easter egg)

### Automated Testing:
- [ ] Unit tests for `shouldRunAgent()` logic
- [ ] Unit tests for `calculateRandomizedScheduleTime()`
- [ ] Integration tests for scheduling flow
- [ ] E2E tests for full agent cycle
- [ ] Load tests for cron execution

---

## Monitoring & Metrics

### Key Metrics to Track:

1. **Agent Processing:**
   - Users with agent mode enabled
   - Actions scheduled per run
   - Actions executed per day
   - Success/failure rates
   - Average time to first action

2. **Performance:**
   - Cron execution time
   - Edge function latency
   - Database query performance
   - Token refresh success rate

3. **Errors:**
   - Failed token refreshes
   - Twitter API errors (by type)
   - Scheduling failures
   - Execution failures

### Alerts to Set Up:
- Cron job failures
- High error rate (>10%)
- No actions scheduled for 24+ hours
- Token refresh failures
- pg_cron job not running

---

## Database Queries for Monitoring

### Check Agent Mode Status:
```sql
-- Users with agent mode enabled
SELECT 
  id,
  agent_settings->>'enabled' as enabled,
  agent_settings->>'lastRunAt' as last_run,
  agent_settings->'targetAccounts' as targets,
  agent_settings->>'frequency' as frequency
FROM profiles 
WHERE agent_settings->>'enabled' = 'true';
```

### Check Scheduled Actions:
```sql
-- Pending agent actions
SELECT 
  post_type,
  status,
  scheduled_for,
  created_at,
  post_metadata->>'target_account' as target_account
FROM scheduled_posts
WHERE post_metadata->>'generated_by' = 'agent_mode'
AND status = 'pending'
ORDER BY scheduled_for ASC;
```

### Check Execution History:
```sql
-- Recent agent executions
SELECT 
  post_type,
  status,
  posted_at,
  error_message,
  post_metadata->>'target_account' as target_account
FROM scheduled_posts
WHERE post_metadata->>'generated_by' = 'agent_mode'
AND status IN ('posted', 'failed')
ORDER BY posted_at DESC
LIMIT 50;
```

### Check pg_cron Status:
```sql
-- Verify pg_cron is running
SELECT 
  runid,
  jobid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-scheduled-posts')
ORDER BY start_time DESC
LIMIT 20;
```

---

## Conclusion

**Agent Mode is working correctly** from a technical standpoint, but has significant UX challenges:

1. ⚠️ **30-36 hour delay** from enabling to first action
2. ⚠️ **Limited visibility** into agent status
3. ⚠️ **No immediate feedback** when enabled

**Recommended Immediate Actions:**
1. Increase discovery frequency to every 6 hours
2. Add first-run optimization (1-4 hour delay)
3. Add agent status dashboard
4. Add manual trigger button

**Expected Impact:**
- First action within 7-10 hours (down from 30-36)
- Better user understanding of system status
- Ability to test immediately

---

## Quick Reference

### Manual Cron Trigger (for testing):
```bash
# Trigger agent processing manually
curl -X POST https://YOUR_VERCEL_URL/api/cron/process-agent \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Trigger scheduled posts processing
curl -X POST https://YOUR_SUPABASE_URL/functions/v1/process-scheduled-posts \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Key Files:
- **Agent Discovery:** `api/cron/process-agent.ts` → `supabase/functions/process-agent-actions/index.ts`
- **Action Execution:** `supabase/functions/process-scheduled-posts/index.ts`
- **Instant Execution:** `supabase/functions/execute-agent-actions-instant/index.ts`
- **UI Components:** `src/components/AutomationQueue.tsx`, `src/components/AutomationDropdown.tsx`
- **Services:** `src/services/agentService.ts`, `src/services/automationService.ts`
- **Cron Config:** `vercel.json`, `supabase/migrations/20250122_setup_pg_cron_scheduler.sql`

---

**Last Updated:** 2025-01-28

