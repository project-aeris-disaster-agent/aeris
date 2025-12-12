# Quick Setup: External Cron (Copy-Paste Ready)

## 🚀 5-Minute Setup

### Step 1: Go to cron-job.org
https://cron-job.org/en/signup/

### Step 2: Create Cron Job

Click **"Create cronjob"** and paste these values:

#### Basic Information
```
Title: Twitter Scheduler
```

#### Request Settings
```
URL: https://wqwhlbmsafgjlsjujuel.supabase.co/functions/v1/process-scheduled-posts
Method: POST
```

#### Request Headers
Click **"Add Header"** and add:

**Header 1:**
```
Name: Authorization
Value: Bearer Sonara2026!
```

**Header 2:**
```
Name: Content-Type
Value: application/json
```

#### Schedule
```
Every: 5 minutes
```

Or use cron expression:
```
*/5 * * * *
```

#### Advanced (Optional)
```
Timeout: 30 seconds
Retry on failure: Yes
```

### Step 3: Test

1. Click **"Run now"** button
2. Check execution log
3. Should see `200 OK` status

### Step 4: Verify

Check your database:
```sql
SELECT id, content, scheduled_for, status, posted_at 
FROM scheduled_posts 
WHERE status = 'posted' 
ORDER BY posted_at DESC 
LIMIT 5;
```

## ✅ Done!

Your scheduler will now run every 5 minutes and process posts within 5 minutes of their scheduled time.

---

## 🔍 Monitoring

**Check cron-job.org:**
- Dashboard → Your cron job → Execution log

**Check Supabase:**
- Edge Functions → `process-scheduled-posts` → Logs

**Check Database:**
- Query `scheduled_posts` table to see status changes

