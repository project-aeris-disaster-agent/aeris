# How to View Detailed Agent Execution Logs

## 🔍 Console Logs (Browser)

### Step 1: Open Browser Console
1. Press `F12` or `Right-click → Inspect`
2. Go to **Console** tab
3. Clear console (optional): Click the 🚫 icon or press `Ctrl+L`

### Step 2: Trigger Agent Actions
1. Click "Connect Google Calendar" button
2. Wait for execution to complete

### Step 3: View Detailed Logs
You should now see a **collapsible group** in the console:

```
🤖 Instant Agent Execution Results
  Summary: {success: true, executed: 9, succeeded: 3, failed: 6}
  
  📋 Detailed Results:
  ✅ [1] RETWEET @lordsedano - Success {tweetId: "...", postId: "..."}
  ✅ [2] LIKE @lordsedano - Success {tweetId: "...", postId: "..."}
  ❌ [3] COMMENT @lordsedano - Failed {tweetId: "...", error: "..."}
  ...
  
  ❌ Failed Actions Details
    1. RETWEET for @account1: {tweetId: "...", error: "Twitter API 403: ..."}
    2. LIKE for @account2: {tweetId: "...", error: "Twitter API 429: ..."}
```

**Click the arrow (▶)** next to each log entry to expand and see details!

### Step 4: Expand the Results Array
In the console, you'll see:
```
Instant agent execution results: {success: true, executed: 9, succeeded: 3, failed: 6, results: Array(9)}
```

**Click on `Array(9)`** to expand and see all 9 results with their error messages.

---

## 📊 Supabase Edge Function Logs

### Method 1: Supabase Dashboard
1. Go to **Supabase Dashboard**
2. Navigate to: **Edge Functions** → `execute-agent-actions-instant`
3. Click **Logs** tab
4. Look for recent executions (should show your test)

### Method 2: Using MCP Tools
The logs show:
- ✅ Function executed successfully (status 200)
- ⏱️ Execution time: ~25-26 seconds
- 📝 Recent execution: `POST | 200 | execute-agent-actions-instant`

**Note:** Supabase logs show HTTP status but not detailed error messages. Use browser console for detailed errors.

---

## 🔍 Understanding the Results

### Success Example:
```javascript
{
  action: 'retweet',
  tweetId: '1234567890',
  targetAccount: 'lordsedano',
  success: true
}
```

### Failure Example:
```javascript
{
  action: 'like',
  tweetId: '1234567890',
  targetAccount: 'lordsedano',
  success: false,
  error: 'Twitter API 403: You are not authorized to like this tweet'
}
```

### Common Error Messages:

1. **"Twitter API 403"** - Authorization error
   - Token might be expired
   - Missing required permissions
   - Tweet might be protected/private

2. **"Twitter API 429"** - Rate limit exceeded
   - Too many requests too quickly
   - Wait a few minutes and try again

3. **"Twitter API 404"** - Tweet not found
   - Tweet might have been deleted
   - Tweet ID is invalid

4. **"No recent tweets from @username"** - No tweets found
   - Account hasn't posted in last 24 hours
   - Account might be private

5. **"GROK_API_KEY not configured"** - Missing API key
   - Grok API key not set in Supabase
   - Comment/reply generation will fail

---

## 🛠️ Quick Debugging Steps

### 1. Check Console Logs (Most Detailed)
- Open browser console (F12)
- Look for the grouped logs
- Expand failed actions to see error messages

### 2. Check Supabase Logs
- Dashboard → Edge Functions → `execute-agent-actions-instant` → Logs
- Verify function executed (status 200)
- Check execution time

### 3. Check Twitter Account
- Go to your Twitter account
- Check if retweets/likes/replies actually happened
- Sometimes API returns error but action succeeds

### 4. Check Agent Settings
```sql
SELECT agent_settings 
FROM profiles 
WHERE id = 'YOUR_USER_ID';
```

Verify:
- ✅ `enabled: true`
- ✅ `targetAccounts: [...]` (not empty)
- ✅ `actions.retweet: true` (or like/mention)
- ✅ Twitter tokens are present

---

## 📝 What the New Logging Shows

### Before (Old):
```
Instant agent execution results: {success: true, executed: 9, succeeded: 3, failed: 6, results: Array(9)}
```

### After (New):
```
🤖 Instant Agent Execution Results
  Summary: {success: true, executed: 9, succeeded: 3, failed: 6}
  
  📋 Detailed Results:
  ✅ [1] RETWEET @lordsedano - Success
  ✅ [2] LIKE @lordsedano - Success  
  ❌ [3] COMMENT @lordsedano - Failed
     Error: Twitter API 403: You are not authorized...
  
  ❌ Failed Actions Details
    1. RETWEET for @account1
       Error: Twitter API 429: Rate limit exceeded
    2. LIKE for @account2
       Error: Twitter API 404: Tweet not found
```

---

## 🎯 Next Steps

1. **Try the button again** - The new logging will show detailed errors
2. **Expand console logs** - Click on the grouped logs to see details
3. **Check specific errors** - Look for patterns (rate limits, auth errors, etc.)
4. **Fix common issues**:
   - Rate limits → Wait a few minutes
   - Auth errors → Reconnect Twitter
   - Missing tweets → Check if accounts posted recently

---

## 💡 Pro Tips

### Filter Console Logs
- Type `agent` in console filter to see only agent-related logs
- Type `error` to see only errors
- Type `❌` to see only failed actions

### Export Logs
- Right-click on console log → "Save as..."
- Or copy/paste to a text file for analysis

### Check Network Tab
- Go to **Network** tab in DevTools
- Filter by `execute-agent-actions-instant`
- Click on the request → **Response** tab
- See the full JSON response with all error details

