# Twitter Scheduler Test Results

## ✅ Setup Complete

All components have been successfully deployed and configured:

1. **Vercel Cron API Route**: `/api/cron/process-posts` ✓
2. **Supabase Edge Function**: `process-scheduled-posts` ✓
3. **Database Migration**: Applied successfully ✓
4. **Environment Variables**: All set ✓
   - `CRON_SECRET` in Vercel (all environments)
   - `CRON_SECRET` in Supabase Edge Functions
   - `TWITTER_CLIENT_ID` and `TWITTER_CLIENT_SECRET` in Supabase

## 🧪 Testing Status

### Automated Tests
- ❌ Cannot test Vercel endpoint directly (deployment protection enabled)
- ❌ Cannot test Edge Function directly (requires service role key)

### Manual Testing Steps

#### Option 1: Test via UI (Recommended)
1. Log into your app
2. Connect your Twitter account
3. Use the Automation Dropdown to schedule a test post for a few minutes in the future
4. Wait for the scheduled time
5. Check if the post appears on Twitter

#### Option 2: Test Edge Function Directly
```bash
# Get your service role key from Supabase Dashboard
# Project Settings → API → service_role key

# Test the Edge Function
curl -X POST "https://wqwhlbmsafgjlsjujuel.supabase.co/functions/v1/process-scheduled-posts" \
  -H "Authorization: Bearer Sonara2026!" \
  -H "Content-Type: application/json"
```

#### Option 3: Check Scheduled Posts in Database
```sql
-- View pending posts
SELECT id, user_id, content, post_type, scheduled_for, status 
FROM scheduled_posts 
WHERE status = 'pending' 
ORDER BY scheduled_for ASC;

-- View recently processed posts
SELECT id, user_id, post_type, status, posted_at, error_message 
FROM scheduled_posts 
WHERE status IN ('posted', 'failed')
ORDER BY posted_at DESC 
LIMIT 10;
```

## 📊 Expected Behavior

### When Cron Runs (Daily at 9 AM UTC)
1. Vercel cron triggers `/api/cron/process-posts`
2. API route calls Supabase Edge Function `process-scheduled-posts`
3. Edge Function queries for pending posts where `scheduled_for <= NOW()`
4. For each post:
   - Checks if token is valid (refreshes if needed)
   - Executes the action (tweet, retweet, like, comment)
   - Updates post status to 'posted' or 'failed'

### Supported Actions
- ✅ `tweet` - Post a new tweet
- ✅ `reply` / `comment` - Reply to a tweet
- ✅ `thread` - Post a thread
- ✅ `retweet` - Retweet a tweet
- ✅ `like` - Like a tweet

## 🔍 Monitoring

### Check Vercel Cron Logs
1. Go to Vercel Dashboard
2. Navigate to your project → **Logs**
3. Filter by "Cron" to see scheduled executions

### Check Supabase Edge Function Logs
1. Go to Supabase Dashboard
2. Navigate to **Edge Functions** → `process-scheduled-posts`
3. Click **Logs** to see execution history

### Check Database
```sql
-- Count posts by status
SELECT status, COUNT(*) 
FROM scheduled_posts 
GROUP BY status;

-- Recent activity
SELECT 
  post_type,
  status,
  COUNT(*) as count,
  MAX(posted_at) as last_execution
FROM scheduled_posts
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY post_type, status;
```

## ⚠️ Known Limitations

1. **Vercel Hobby Plan**: Cron runs only once per day (9 AM UTC)
   - For more frequent execution, upgrade to Pro or use external cron service

2. **Deployment Protection**: Vercel deployment has protection enabled
   - Cron jobs will still work (Vercel handles auth internally)
   - Manual testing requires bypass token

3. **Token Refresh**: Requires `TWITTER_CLIENT_ID` and `TWITTER_CLIENT_SECRET`
   - Already configured in Supabase Edge Functions ✓

## 🚀 Next Steps

1. **Schedule a test post** via the UI
2. **Wait for cron execution** (or trigger manually if you have service role key)
3. **Verify post appears** on Twitter
4. **Check logs** for any errors

## 📝 Test Checklist

- [ ] Schedule a test tweet for 5 minutes in future
- [ ] Verify post appears in `scheduled_posts` table with `status: 'pending'`
- [ ] Wait for scheduled time OR trigger Edge Function manually
- [ ] Verify post appears on Twitter
- [ ] Check `scheduled_posts` table - status should be 'posted'
- [ ] Test retweet action
- [ ] Test like action
- [ ] Test comment/reply action
- [ ] Verify token refresh works (if token expires)

## 🐛 Troubleshooting

### Posts not executing
- Check if `scheduled_for` is in the past
- Verify `status = 'pending'`
- Check Edge Function logs for errors
- Verify user has valid Twitter tokens

### Token refresh failures
- Verify `TWITTER_CLIENT_ID` and `TWITTER_CLIENT_SECRET` are set
- Check if refresh token is still valid
- Review Edge Function logs

### Cron not running
- Verify cron is configured in `vercel.json`
- Check Vercel project settings for cron configuration
- Review Vercel logs for cron execution

