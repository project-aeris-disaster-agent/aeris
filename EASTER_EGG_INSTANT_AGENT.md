# Easter Egg: Instant Agent Actions

## 🎯 Overview

The "Connect Google Calendar" button has a **secret easter egg** that triggers instant execution of Agent Mode features. This allows you to test agent functionality immediately without waiting for cron jobs.

## 🚀 How It Works

When you click the **"Connect Google Calendar"** button (currently in the Google Calendar Widget), it:

1. ✅ **Auto Retweet** - Retweets the most recent tweet from each target account
2. ✅ **Auto Like** - Likes the most recent tweet from each target account  
3. ✅ **Auto Mention/Reply** - Generates and posts a reply to the most recent tweet

**Note:** This feature will be moved to a dedicated button later when Google Calendar integration is officially implemented.

## 📋 Requirements

Before using this feature, ensure:

- ✅ Agent Mode is **enabled** in your settings
- ✅ At least **one target account** is configured
- ✅ At least **one action** (retweet/like/mention) is enabled
- ✅ Twitter account is **connected**
- ✅ Character card is **generated** (required for mention/reply)

## 🎮 How to Use

1. **Navigate to Home Page**
2. **Scroll to Google Calendar Widget** (right panel)
3. **Expand the widget** (click the header)
4. **Click "Connect Google Calendar"** button
5. **Wait for execution** (shows "Executing Agent Actions..." with spinner)
6. **Check results** - You'll see a notification with success/failure counts

## 📊 What Happens

### Execution Flow:

1. **Fetches your agent settings** from database
2. **Gets most recent tweets** from each target account (last 24 hours)
3. **Executes actions immediately:**
   - Retweet (if enabled)
   - Like (if enabled)
   - Comment/Reply (if enabled, generates reply using Grok AI)
4. **Returns results** with success/failure status for each action

### Limits:

- Processes **up to 3 target accounts** per execution (to avoid rate limits)
- Uses **most recent tweet** from each account
- Adds **1 second delay** between actions to avoid rate limits

## 🔍 Verification

### Check Results:

1. **Notification popup** - Shows success/failure counts
2. **Browser console** - Detailed results logged
3. **Twitter account** - Check for retweets, likes, and replies
4. **Automation Queue** - Actions won't appear here (they execute immediately)

### Example Console Output:

```json
{
  "success": true,
  "executed": 6,
  "succeeded": 5,
  "failed": 1,
  "results": [
    {
      "action": "retweet",
      "tweetId": "1234567890",
      "targetAccount": "lordsedano",
      "success": true
    },
    {
      "action": "like",
      "tweetId": "1234567890",
      "targetAccount": "lordsedano",
      "success": true
    },
    {
      "action": "comment",
      "tweetId": "1234567890",
      "targetAccount": "lordsedano",
      "success": true,
      "postId": "9876543210"
    }
  ]
}
```

## ⚠️ Important Notes

### Rate Limits:
- Twitter API has rate limits for retweets, likes, and replies
- If you hit rate limits, some actions will fail
- Wait a few minutes before trying again

### Token Refresh:
- Automatically refreshes Twitter access token if expired
- If refresh fails, execution will fail with error message

### Character Card:
- Required for mention/reply actions
- Uses character's personality and style to generate replies
- If character card is missing, mention actions will be skipped

### No Scheduling:
- Actions execute **immediately** (no delay)
- Not stored in `scheduled_posts` table
- Results are only in the response and console logs

## 🐛 Troubleshooting

### "Agent mode not enabled"
- **Solution:** Enable Agent Mode in the AUTOMATE dropdown

### "No target accounts configured"
- **Solution:** Add target accounts in Agent Settings

### "Twitter not connected"
- **Solution:** Connect your Twitter account via Auth page

### "No recent tweets from target accounts"
- **Solution:** Target accounts haven't posted in last 24 hours

### Actions failing with "429" error
- **Solution:** Rate limit exceeded. Wait a few minutes and try again.

### Mention/reply not executing
- **Solution:** Ensure character card is generated and mention action is enabled

## 🔧 Technical Details

### Edge Function:
- **Location:** `supabase/functions/execute-agent-actions-instant/index.ts`
- **Endpoint:** `/functions/v1/execute-agent-actions-instant`
- **Method:** POST
- **Body:** `{ userId: string }`

### Service Function:
- **Location:** `src/services/agentService.ts`
- **Function:** `executeAgentActionsInstant(userId: string)`

### UI Integration:
- **Component:** `src/components/GoogleCalendarWidget.tsx`
- **Button:** "Connect Google Calendar" (temporary easter egg)

## 🚧 Future Plans

1. **Move to dedicated button** - Create a separate "Test Agent Mode" button
2. **Add action preview** - Show which tweets will be engaged before execution
3. **Add execution history** - Store results in database for review
4. **Add retry mechanism** - Automatically retry failed actions
5. **Add batch processing** - Process more accounts with better rate limit handling

## 📝 Code References

- Edge Function: `supabase/functions/execute-agent-actions-instant/index.ts`
- Service: `src/services/agentService.ts` (line ~276)
- Component: `src/components/GoogleCalendarWidget.tsx` (line ~92)

