# Agent Mode Features Testing Guide

## Quick Test

Run the automated test suite:

```bash
# Set your Supabase service role key (PowerShell)
$env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run tests
npm run test:agent
```

## Manual Testing Steps

### 1. Test AgentSettings Type Structure

**Test:** Verify new settings fields are accepted

```typescript
// In browser console or TypeScript file
import { AgentSettings } from '@/types/database';

const testSettings: AgentSettings = {
  enabled: true,
  targetAccounts: [
    'username1',
    {
      username: 'username2',
      priority: 'high',
      actions: { retweet: true, like: false, mention: true }
    }
  ],
  actions: { retweet: true, like: true, mention: true },
  frequency: 'daily',
  lastRunAt: null,
  contentFilter: {
    keywords: ['AI', 'tech'],
    negativeKeywords: ['spam'],
    minEngagement: { likes: 5, retweets: 2 },
    tweetTypes: ['original', 'reply']
  },
  rateLimits: {
    maxPerAccountPerDay: 3,
    maxGlobalPerDay: 20
  },
  scheduling: {
    timezone: 'America/New_York',
    activeHours: { start: 9, end: 21 }
  }
};
```

### 2. Test Content Filtering

**Test:** Verify tweets are filtered correctly

1. Enable agent mode with content filter:
   ```json
   {
     "contentFilter": {
       "keywords": ["AI", "tech"],
       "negativeKeywords": ["spam", "ads"],
       "minEngagement": {
         "likes": 5,
         "retweets": 2
       },
       "tweetTypes": ["original"]
     }
   }
   ```

2. Add a target account that posts frequently
3. Wait for cron to run (or trigger manually)
4. Check scheduled_posts table - only filtered tweets should be scheduled

**SQL Query:**
```sql
SELECT 
  id,
  target_tweet_id,
  post_type,
  scheduled_for,
  post_metadata
FROM scheduled_posts
WHERE post_metadata->>'generated_by' = 'agent_mode'
ORDER BY created_at DESC
LIMIT 10;
```

### 3. Test Rate Limiting

**Test:** Verify daily limits are enforced

1. Set rate limits:
   ```json
   {
     "rateLimits": {
       "maxPerAccountPerDay": 2,
       "maxGlobalPerDay": 5
     }
   }
   ```

2. Enable agent mode with multiple target accounts
3. Trigger agent processing (manually or wait for cron)
4. Check `agent_rate_limit_tracking` table:
   ```sql
   SELECT 
     user_id,
     target_account,
     date,
     engagements_today,
     in_cooldown,
     cooldown_until
   FROM agent_rate_limit_tracking
   WHERE user_id = 'your-user-id'
   ORDER BY date DESC;
   ```

5. Verify no more than 2 engagements per account per day
6. Verify no more than 5 total engagements per day

### 4. Test Timezone-Aware Scheduling

**Test:** Verify scheduling respects timezone and active hours

1. Set scheduling config:
   ```json
   {
     "scheduling": {
       "timezone": "America/New_York",
       "activeHours": {
         "start": 9,
         "end": 21
       },
       "quietHours": {
         "start": 2,
         "end": 6
       }
     }
   }
   ```

2. Enable agent mode
3. Check scheduled times are within active hours (9 AM - 9 PM ET)
4. Verify no actions scheduled during quiet hours (2 AM - 6 AM ET)

**SQL Query:**
```sql
SELECT 
  id,
  scheduled_for,
  post_type,
  -- Convert to user timezone to verify
  scheduled_for AT TIME ZONE 'America/New_York' as scheduled_et
FROM scheduled_posts
WHERE post_metadata->>'generated_by' = 'agent_mode'
  AND status = 'pending'
ORDER BY scheduled_for ASC;
```

### 5. Test Thread Context Analysis

**Test:** Verify replies consider thread context

1. Enable agent mode with mention/comment action
2. Add a target account that posts threads
3. Wait for agent to generate replies
4. Check generated replies in `scheduled_posts.content`
5. Replies should reference thread context when available

**SQL Query:**
```sql
SELECT 
  id,
  content,
  target_tweet_id,
  post_metadata->>'thread_context' as has_thread_context
FROM scheduled_posts
WHERE post_type = 'comment'
  AND post_metadata->>'generated_by' = 'agent_mode'
ORDER BY created_at DESC
LIMIT 5;
```

### 6. Test Analytics Tables

**Test:** Verify analytics data is tracked

1. After agent actions execute, check metrics:
   ```sql
   SELECT 
     action_type,
     target_account,
     likes_received,
     replies_received,
     engagement_score
   FROM agent_engagement_metrics
   WHERE user_id = 'your-user-id'
   ORDER BY created_at DESC
   LIMIT 10;
   ```

2. Check engagement history:
   ```sql
   SELECT 
     target_account,
     total_engagements,
     last_engaged_at,
     engagements_this_week
   FROM agent_engagement_history
   WHERE user_id = 'your-user-id'
   ORDER BY last_engaged_at DESC;
   ```

### 7. Test Retry Logic

**Test:** Verify failed actions are retried

1. Schedule an action that will fail (e.g., invalid tweet ID)
2. Wait for execution
3. Check retry count:
   ```sql
   SELECT 
     id,
     status,
     retry_count,
     last_retry_at,
     error_message
   FROM scheduled_posts
   WHERE status = 'failed'
   ORDER BY last_retry_at DESC;
   ```

4. Verify retry is scheduled with exponential backoff (1h, 2h, 4h)

## Edge Function Testing

### Test process-agent-actions Edge Function

```bash
# PowerShell
$env:CRON_SECRET="your-cron-secret"
$response = Invoke-WebRequest -Uri "https://your-project.supabase.co/functions/v1/process-agent-actions" `
  -Method POST `
  -Headers @{
    "Authorization" = "Bearer $env:CRON_SECRET"
    "Content-Type" = "application/json"
  }

$response.Content | ConvertFrom-Json
```

## Expected Results

### ✅ Success Indicators

- Content filtering: Only tweets matching criteria are scheduled
- Rate limiting: Daily limits are respected, cooldowns activate
- Timezone: Actions scheduled within active hours in user's timezone
- Thread context: Replies reference conversation context
- Analytics: Metrics and history tables populate after actions
- Retry: Failed actions retry up to 3 times with exponential backoff

### ❌ Common Issues

1. **Migrations not run**: Run `supabase migration up` or apply migrations manually
2. **Missing env vars**: Ensure `SUPABASE_SERVICE_ROLE_KEY` is set
3. **Type errors**: Verify TypeScript compilation passes
4. **No actions scheduled**: Check rate limits, content filters, and target accounts

## Database Migrations

Before testing, ensure migrations are applied:

```bash
# If using Supabase CLI
supabase migration up

# Or apply manually via Supabase Dashboard SQL Editor
# Run: supabase/migrations/20250129_add_agent_analytics_tables.sql
```

## Next Steps

After successful testing:

1. ✅ Verify all features work as expected
2. ✅ Check database tables are populated correctly
3. ✅ Monitor edge function logs for errors
4. ✅ Test with real Twitter accounts (carefully!)
5. ✅ Review analytics data for insights

