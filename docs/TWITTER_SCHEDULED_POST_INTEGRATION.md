# Twitter Social Media Automation + Scheduled Post Integration Overview

## Executive Summary

This document outlines how to integrate the **Twitter Social Media Automation** feature with the **Schedule Post** automation system. The integration enables users to schedule AI-generated posts that automatically publish to Twitter at specified times.

---

## Current System Architecture

### ✅ What's Already Built

#### 1. **Post Generation System**
- **Service**: `src/services/automationService.ts`
  - `generateRecommendedPost()` - Uses character card + conversation history
  - Calls Edge Function: `generate-post` (uses Grok API)
  
- **Edge Function**: `supabase/functions/generate-post/index.ts`
  - Generates authentic posts based on character card
  - Uses Grok API (xAI) for content generation

#### 2. **Scheduling System**
- **Service**: `src/services/automationService.ts`
  - `schedulePost()` - Saves posts to `scheduled_posts` table
  - `calculateNextScheduleTime()` - Calculates future post times
  - `getScheduledPosts()` - Retrieves scheduled posts
  
- **Database Table**: `scheduled_posts`
  ```typescript
  {
    id: string;
    user_id: string;
    content: string;
    post_type: 'tweet' | 'reply' | 'thread';
    scheduled_for: string;  // ISO timestamp
    posted_at: string | null;
    status: 'pending' | 'posted' | 'failed' | 'cancelled';
    error_message: string | null;
    post_metadata: {
      platform: 'twitter' | 'farcaster' | 'baseapp';
      generated_by: 'ai';
      scheduled_at: string;
    };
  }
  ```

#### 3. **Twitter OAuth & API Integration**
- **OAuth Service**: `src/services/twitterOAuth.ts`
  - PKCE-based OAuth 2.0 flow
  - Token management
  
- **Edge Function**: `supabase/functions/twitter-oauth-callback/index.ts`
  - Handles OAuth callback
  - Stores tokens in `profiles` table
  
- **API Service**: `src/services/twitterApi.ts`
  - Token refresh logic
  - User profile fetching

#### 4. **Post Publishing System**
- **Service**: `src/services/automationService.ts`
  - `postImmediately()` - Posts to platforms immediately
  
- **Edge Function**: `supabase/functions/post-to-social/index.ts`
  - Posts to Twitter API v2
  - Supports multiple platforms (Twitter, Farcaster, BASEapp)
  - Saves posted content to `scheduled_posts` table

#### 5. **UI Components**
- **Component**: `src/components/AutomationDropdown.tsx`
  - Post generation UI
  - Scheduling options (instant, 24hrs, 48hrs, 72hrs, daily, weekly, custom)
  - Platform selection
  - Post status feedback

---

## ❌ What's Missing (Critical Gap)

### **Scheduled Post Execution System**

Currently, posts are **saved** to the database but **never automatically executed** when their `scheduled_for` time arrives. You need:

1. **Cron Job / Scheduled Task System**
   - Periodically check for posts where `scheduled_for <= now()` AND `status = 'pending'`
   - Execute these posts via the `post-to-social` Edge Function
   - Update post status to 'posted' or 'failed'

2. **Options for Implementation**:
   - **Option A**: Supabase Database Webhooks + Edge Function (Recommended)
   - **Option B**: Supabase pg_cron extension (PostgreSQL cron)
   - **Option C**: External cron service (Vercel Cron, GitHub Actions, etc.)

---

## Integration Architecture

### Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER INTERACTION FLOW                        │
└─────────────────────────────────────────────────────────────────┘

1. User Opens Automation Dropdown
   └─> AutomationDropdown.tsx
       └─> Auto-generates post via generateRecommendedPost()

2. User Selects:
   - Platforms: [Twitter]
   - Schedule: [Instant | 24hrs | 48hrs | 72hrs | Daily | Weekly | Custom]
   └─> Calls schedulePost() or postImmediately()

3a. INSTANT POST:
    └─> postImmediately()
        └─> Calls Edge Function: post-to-social
            └─> Posts to Twitter API v2
            └─> Saves to scheduled_posts (status: 'posted')

3b. SCHEDULED POST:
    └─> schedulePost()
        └─> Saves to scheduled_posts (status: 'pending')
        └─> scheduled_for = future timestamp


┌─────────────────────────────────────────────────────────────────┐
│                  SCHEDULED POST EXECUTION FLOW                   │
└─────────────────────────────────────────────────────────────────┘

4. Cron Job / Scheduled Task (Runs every 1-5 minutes)
   └─> Query: SELECT * FROM scheduled_posts 
       WHERE status = 'pending' 
       AND scheduled_for <= NOW()
       AND post_metadata->>'platform' = 'twitter'

5. For each pending post:
   └─> Call Edge Function: post-to-social
       ├─> Fetch user's Twitter tokens from profiles table
       ├─> Post to Twitter API v2
       ├─> Update scheduled_posts:
       │   ├─> status = 'posted' (or 'failed')
       │   ├─> posted_at = NOW()
       │   └─> post_metadata->twitter_post_id = <tweet_id>
       └─> Return success/error status

6. Error Handling:
   └─> If post fails:
       ├─> status = 'failed'
       ├─> error_message = <error details>
       └─> Optionally: Retry logic or notification
```

---

## Implementation Plan

### Phase 1: Create Scheduled Post Execution Edge Function

**File**: `supabase/functions/execute-scheduled-posts/index.ts`

**Purpose**: 
- Query pending posts that are due
- Execute posts via Twitter API
- Update database status

**Key Features**:
- Query `scheduled_posts` for pending posts where `scheduled_for <= NOW()`
- For each post:
  - Fetch user's Twitter tokens
  - Call Twitter API v2 to post
  - Update status to 'posted' or 'failed'
- Handle rate limits
- Log execution results

### Phase 2: Set Up Cron/Scheduler

#### **Option A: Supabase Database Webhooks (Recommended)**

**How it works**:
- Use Supabase Database Webhooks to trigger on `scheduled_posts` inserts
- Or use a scheduled Edge Function invocation

**Implementation**:
1. Create Edge Function: `execute-scheduled-posts`
2. Set up Supabase Cron (if available) or use external service
3. Configure to run every 1-5 minutes

#### **Option B: Supabase pg_cron Extension**

**How it works**:
- Use PostgreSQL's `pg_cron` extension
- Create a database function that calls the Edge Function via HTTP

**SQL Setup**:
```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create function to execute scheduled posts
CREATE OR REPLACE FUNCTION execute_scheduled_posts()
RETURNS void AS $$
DECLARE
  post_record RECORD;
  edge_function_url TEXT;
  supabase_anon_key TEXT;
BEGIN
  edge_function_url := 'https://<your-project>.supabase.co/functions/v1/execute-scheduled-posts';
  supabase_anon_key := '<your-anon-key>';
  
  -- Query pending posts
  FOR post_record IN 
    SELECT * FROM scheduled_posts
    WHERE status = 'pending'
    AND scheduled_for <= NOW()
    AND post_metadata->>'platform' = 'twitter'
    ORDER BY scheduled_for ASC
    LIMIT 10
  LOOP
    -- Call Edge Function via HTTP (requires http extension)
    PERFORM net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || supabase_anon_key
      ),
      body := jsonb_build_object(
        'post_id', post_record.id,
        'user_id', post_record.user_id,
        'content', post_record.content,
        'platform', post_record.post_metadata->>'platform'
      )
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule to run every 5 minutes
SELECT cron.schedule(
  'execute-scheduled-posts',
  '*/5 * * * *',  -- Every 5 minutes
  $$SELECT execute_scheduled_posts()$$
);
```

#### **Option C: External Cron Service (Vercel Cron, GitHub Actions, etc.)

**Vercel Cron Example** (`vercel.json`):
```json
{
  "crons": [{
    "path": "/api/cron/execute-scheduled-posts",
    "schedule": "*/5 * * * *"
  }]
}
```

**API Route** (`api/cron/execute-scheduled-posts.ts`):
```typescript
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Verify cron secret
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Call Edge Function
  const response = await fetch(
    `${process.env.SUPABASE_URL}/functions/v1/execute-scheduled-posts`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return res.json({ success: response.ok });
}
```

### Phase 3: Enhance Post-to-Social Edge Function

**Current**: `supabase/functions/post-to-social/index.ts`

**Enhancements Needed**:
1. **Token Refresh Logic**
   - Check if access token is expired
   - Automatically refresh using refresh token
   - Update tokens in database

2. **Better Error Handling**
   - Rate limit detection and queuing
   - Retry logic for transient failures
   - Detailed error messages

3. **Support Scheduled Post Updates**
   - Accept `post_id` parameter to update existing scheduled post
   - Update `posted_at` and `status` fields
   - Store Twitter post ID in metadata

### Phase 4: Token Refresh System

**Edge Function**: `supabase/functions/twitter-refresh-token/index.ts` (already exists)

**Enhancements**:
- Integrate automatic token refresh in `post-to-social`
- Handle token expiration gracefully
- Update tokens in `profiles` table

---

## Code Integration Points

### 1. **Frontend → Scheduling**

**File**: `src/components/AutomationDropdown.tsx`

**Current Flow**:
```typescript
// Line 176
await schedulePost(userId, recommendedPost.content, scheduledDate, selectedPlatforms);
```

**What happens**:
- Creates entries in `scheduled_posts` table
- Status: 'pending'
- `scheduled_for`: future timestamp
- `post_metadata.platform`: 'twitter'

### 2. **Database → Execution**

**Missing Link**: No automatic execution when `scheduled_for` time arrives

**Solution**: Implement cron/scheduler as described in Phase 2

### 3. **Execution → Twitter API**

**File**: `supabase/functions/post-to-social/index.ts`

**Current Flow** (for immediate posts):
```typescript
// Line 72-99: Posts to Twitter API v2
const twitterResponse = await fetch('https://api.twitter.com/2/tweets', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${profile.twitter_access_token}`,
  },
  body: JSON.stringify({ text: content }),
});
```

**Enhancement Needed**:
- Add support for updating existing `scheduled_posts` record
- Accept `post_id` parameter
- Update status and `posted_at` after successful post

### 4. **Twitter API → Database Update**

**Current**: Only saves new record (line 102-114)

**Enhancement Needed**:
- If `post_id` provided, update existing record instead of inserting
- Set `status = 'posted'`
- Set `posted_at = NOW()`
- Store `twitter_post_id` in metadata

---

## Database Schema Considerations

### Current `scheduled_posts` Table

✅ **Good**:
- Has `status` field for tracking
- Has `scheduled_for` for timing
- Has `post_metadata` for flexible data storage

⚠️ **Potential Improvements**:
1. **Index for Performance**:
   ```sql
   CREATE INDEX idx_scheduled_posts_pending 
   ON scheduled_posts(status, scheduled_for) 
   WHERE status = 'pending';
   ```

2. **Retry Logic Fields** (optional):
   ```sql
   retry_count INTEGER DEFAULT 0,
   max_retries INTEGER DEFAULT 3,
   last_retry_at TIMESTAMP
   ```

3. **Time Zone Support**:
   - Ensure `scheduled_for` is stored in UTC
   - Consider user timezone in UI

---

## Error Handling & Edge Cases

### 1. **Token Expiration**
- **Problem**: Access token expires before scheduled post time
- **Solution**: Refresh token before posting (in `post-to-social` function)

### 2. **Rate Limiting**
- **Problem**: Twitter API rate limits (300 posts per 3 hours)
- **Solution**: 
  - Queue posts if rate limited
  - Update `status = 'pending'` with delay
  - Add retry logic

### 3. **User Disconnects Twitter**
- **Problem**: User disconnects Twitter after scheduling post
- **Solution**: 
  - Check token validity before posting
  - Set `status = 'failed'` with error message
  - Notify user (optional)

### 4. **Duplicate Execution**
- **Problem**: Cron job might execute same post twice
- **Solution**: 
  - Use database transaction with row locking
  - Update status atomically: `UPDATE ... SET status = 'processing' WHERE status = 'pending' AND id = ?`

### 5. **Content Changes**
- **Problem**: User wants to edit scheduled post
- **Solution**: 
  - Add `updateScheduledPost()` function
  - Allow editing until `status != 'pending'`

---

## Testing Strategy

### 1. **Unit Tests**
- Test `calculateNextScheduleTime()` with different intervals
- Test `schedulePost()` database insertion
- Test post metadata structure

### 2. **Integration Tests**
- Test full flow: Generate → Schedule → Execute → Post
- Test token refresh flow
- Test error handling (expired tokens, rate limits)

### 3. **Manual Testing**
- Schedule post for 1 minute in future
- Verify cron job executes
- Check database status updates
- Verify post appears on Twitter

### 4. **Edge Case Testing**
- Schedule multiple posts at same time
- Test with expired tokens
- Test with disconnected Twitter account
- Test rate limit handling

---

## Future Extensibility (BASEapp, Farcaster, etc.)

### Platform Abstraction Pattern

**Current Structure** (already supports multiple platforms):
```typescript
// post-to-social/index.ts
if (platform === 'twitter') {
  // Twitter logic
} else if (platform === 'farcaster') {
  // Farcaster logic (placeholder)
} else if (platform === 'baseapp') {
  // BASEapp logic (placeholder)
}
```

### Adding New Platforms

1. **Add OAuth/Connection Flow**:
   - Create `src/services/baseappOAuth.ts` (similar to `twitterOAuth.ts`)
   - Create Edge Function: `baseapp-oauth-callback`
   - Store tokens in `profiles` table (e.g., `baseapp_access_token`)

2. **Add Posting Logic**:
   - Extend `post-to-social/index.ts` with new platform case
   - Implement platform-specific API calls

3. **Update UI**:
   - Add platform to `connectedPlatforms` type
   - Add platform selection in `AutomationDropdown.tsx`

4. **Database**:
   - No schema changes needed (uses `post_metadata.platform`)

---

## Security Considerations

### 1. **Token Storage**
- ✅ Tokens stored in `profiles` table (encrypted at rest by Supabase)
- ⚠️ Consider additional encryption for sensitive tokens
- ✅ Use service role key only in Edge Functions (never expose to frontend)

### 2. **Cron Job Security**
- ✅ Use service role key for cron job authentication
- ✅ Add secret token for external cron services
- ✅ Rate limit cron job execution

### 3. **API Rate Limits**
- ✅ Implement rate limiting per user
- ✅ Queue posts if rate limit exceeded
- ✅ Monitor and alert on rate limit violations

### 4. **Content Validation**
- ✅ Validate post content before scheduling
- ✅ Check character limits (280 for Twitter)
- ✅ Sanitize user input

---

## Monitoring & Observability

### Key Metrics to Track

1. **Scheduled Posts**:
   - Total scheduled posts
   - Posts executed successfully
   - Posts failed
   - Average time to execution

2. **Twitter API**:
   - API call success rate
   - Rate limit hits
   - Token refresh frequency

3. **System Health**:
   - Cron job execution frequency
   - Edge Function response times
   - Database query performance

### Logging

- Log all scheduled post executions
- Log Twitter API responses
- Log errors with full context
- Use structured logging (JSON format)

---

## Implementation Checklist

### Phase 1: Core Execution System
- [ ] Create `execute-scheduled-posts` Edge Function
- [ ] Implement query for pending posts
- [ ] Integrate with `post-to-social` function
- [ ] Add database status updates

### Phase 2: Cron/Scheduler Setup
- [ ] Choose cron solution (Option A, B, or C)
- [ ] Set up scheduled task
- [ ] Test cron execution
- [ ] Add error handling and logging

### Phase 3: Token Management
- [ ] Enhance token refresh logic
- [ ] Add automatic token refresh in `post-to-social`
- [ ] Handle expired tokens gracefully
- [ ] Test token refresh flow

### Phase 4: Error Handling
- [ ] Implement rate limit handling
- [ ] Add retry logic
- [ ] Handle disconnected accounts
- [ ] Add user notifications for failures

### Phase 5: Testing & Polish
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Manual testing with real Twitter account
- [ ] Performance testing
- [ ] Documentation updates

---

## Quick Start Implementation

### Step 1: Create Execution Edge Function

```typescript
// supabase/functions/execute-scheduled-posts/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Query pending posts due for execution
  const { data: pendingPosts, error } = await supabase
    .from('scheduled_posts')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(10);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  const results = [];

  for (const post of pendingPosts || []) {
    try {
      // Call post-to-social function
      const postResponse = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/post-to-social`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: post.user_id,
            content: post.content,
            platforms: [post.post_metadata.platform],
            post_id: post.id, // Pass post_id to update existing record
          }),
        }
      );

      const postResult = await postResponse.json();

      if (postResult.success) {
        // Update status to posted
        await supabase
          .from('scheduled_posts')
          .update({
            status: 'posted',
            posted_at: new Date().toISOString(),
            post_metadata: {
              ...post.post_metadata,
              twitter_post_id: postResult.results[0]?.post_id,
            },
          })
          .eq('id', post.id);
      } else {
        // Update status to failed
        await supabase
          .from('scheduled_posts')
          .update({
            status: 'failed',
            error_message: postResult.error || 'Post failed',
          })
          .eq('id', post.id);
      }

      results.push({ post_id: post.id, success: postResult.success });
    } catch (error) {
      console.error(`Error executing post ${post.id}:`, error);
      results.push({ post_id: post.id, success: false, error: error.message });
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

### Step 2: Update `post-to-social` to Handle Updates

```typescript
// In supabase/functions/post-to-social/index.ts
// Add support for updating existing scheduled post

interface PostRequest {
  user_id: string;
  content: string;
  platforms: string[];
  post_id?: string; // Add optional post_id
}

// After successful Twitter post (around line 95):
if (request.post_id) {
  // Update existing scheduled post
  await supabaseClient
    .from('scheduled_posts')
    .update({
      status: 'posted',
      posted_at: new Date().toISOString(),
      post_metadata: {
        ...existingPost.post_metadata,
        twitter_post_id: twitterData.data?.id,
      },
    })
    .eq('id', request.post_id);
} else {
  // Insert new record (existing behavior)
  await supabaseClient.from('scheduled_posts').insert({...});
}
```

### Step 3: Set Up Cron (Example: Vercel Cron)

```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/execute-scheduled-posts",
    "schedule": "*/5 * * * *"
  }]
}
```

```typescript
// api/cron/execute-scheduled-posts.ts
export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const response = await fetch(
    `${process.env.SUPABASE_URL}/functions/v1/execute-scheduled-posts`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );

  return res.json({ success: response.ok });
}
```

---

## Summary

### Current State
✅ Post generation system working
✅ Scheduling UI and database storage working
✅ Twitter OAuth and API integration working
✅ Immediate posting working
❌ **Missing**: Automatic execution of scheduled posts

### Integration Goal
Connect the scheduling system to the posting system via a cron job that:
1. Periodically checks for due posts
2. Executes them via existing `post-to-social` function
3. Updates database status

### Next Steps
1. Implement `execute-scheduled-posts` Edge Function
2. Set up cron/scheduler (choose Option A, B, or C)
3. Enhance `post-to-social` to support updating existing posts
4. Add token refresh logic
5. Test end-to-end flow

---

## References

- Current Codebase:
  - `src/services/automationService.ts` - Scheduling logic
  - `supabase/functions/post-to-social/index.ts` - Posting logic
  - `supabase/functions/generate-post/index.ts` - Post generation
  - `src/components/AutomationDropdown.tsx` - UI component

- Documentation:
  - `docs/TWITTER_OAUTH_IMPLEMENTATION.md` - OAuth setup
  - `docs/TWITTER_API_V2.md` - Twitter API details
  - `PROJECT_OVERVIEW.md` - Overall architecture

- External Resources:
  - [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
  - [Twitter API v2 Documentation](https://developer.twitter.com/en/docs/twitter-api)
  - [Supabase pg_cron](https://supabase.com/docs/guides/database/extensions/pg_cron)

