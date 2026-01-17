# Twitter Scheduler Environment Setup

This document outlines the environment variables required for the Twitter automation scheduler to work.

## Required Environment Variables

### 1. CRON_SECRET

A shared secret used to authenticate cron job requests. This prevents unauthorized access to the scheduler endpoint.

**Generate a secure secret:**
```bash
# Using OpenSSL
openssl rand -hex 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Set in Vercel:**
```bash
vercel env add CRON_SECRET
# Enter your generated secret when prompted
```

**Set in Supabase Edge Functions:**
1. Go to your Supabase project dashboard
2. Navigate to **Project Settings** → **Edge Functions**
3. Add secret: `CRON_SECRET` with the same value as Vercel

### 2. TWITTER_CLIENT_ID & TWITTER_CLIENT_SECRET

Required for automatic token refresh when user tokens expire.

**Set in Supabase Edge Functions:**
```
TWITTER_CLIENT_ID = <your Twitter app client ID>
TWITTER_CLIENT_SECRET = <your Twitter app client secret>
```

These should already be set from your initial Twitter OAuth setup.

### 3. SUPABASE_URL (or PROJECT_URL)

The Edge Function reads this from environment. Usually auto-provided by Supabase.

### 4. SUPABASE_SERVICE_ROLE_KEY (or SERVICE_ROLE_KEY)

The Edge Function needs this to bypass RLS and update posts. Usually auto-provided by Supabase.

---

## Vercel Configuration

**Note:** Post execution is handled by Supabase pg_cron (every 5 minutes), not Vercel cron.

Your `vercel.json` only needs the agent discovery cron:

```json
{
  "crons": [
    {
      "path": "/api/cron/process-agent",
      "schedule": "0 9 * * *"
    }
  ]
}
```

Post execution runs automatically via pg_cron every 5 minutes (configured in Supabase migrations).

---

## Supabase Edge Function Secrets

Required secrets for `process-scheduled-posts`:

| Secret Name | Description |
|-------------|-------------|
| `CRON_SECRET` | Shared auth secret with Vercel cron |
| `TWITTER_CLIENT_ID` | Twitter OAuth client ID |
| `TWITTER_CLIENT_SECRET` | Twitter OAuth client secret |
| `PROJECT_URL` or `SUPABASE_URL` | Auto-provided |
| `SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_ROLE_KEY` | Auto-provided |

---

## Deployment Steps

1. **Generate CRON_SECRET:**
   ```bash
   openssl rand -hex 32
   ```

2. **Add to Vercel:**
   ```bash
   vercel env add CRON_SECRET
   # Paste the generated secret
   ```

3. **Add to Supabase:**
   - Go to Project Settings → Edge Functions
   - Add `CRON_SECRET` with the same value

4. **Deploy Vercel:**
   ```bash
   vercel --prod
   ```

5. **Deploy Edge Function:**
   ```bash
   supabase functions deploy process-scheduled-posts
   ```

---

## Testing

### Manual Test
```bash
# Test the Edge Function directly (replace with your values)
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/process-scheduled-posts" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

**Note:** The Vercel API route wrapper has been removed. Use the Edge Function directly for manual testing.

### Vercel Cron Logs
- Go to Vercel Dashboard → Your Project → Logs
- Filter by "Cron" to see scheduled job executions

### Supabase Edge Function Logs
- Go to Supabase Dashboard → Edge Functions → `process-scheduled-posts` → Logs

---

## Troubleshooting

### "Unauthorized" errors
- Verify `CRON_SECRET` matches in both Vercel and Supabase
- Check the Authorization header format: `Bearer <secret>`

### Token refresh failures
- Verify `TWITTER_CLIENT_ID` and `TWITTER_CLIENT_SECRET` are set in Supabase
- Check if refresh token is still valid (Twitter tokens can be revoked)

### Posts not executing
- Check if posts have `status: 'pending'` and `scheduled_for` is in the past
- Verify cron job is running (check Vercel logs)
- Check Edge Function logs for errors

---

## Quick Commands

```bash
# Check Vercel env vars
vercel env ls

# Deploy to Vercel
vercel --prod

# Deploy Edge Function
supabase functions deploy process-scheduled-posts

# View Edge Function logs
supabase functions logs process-scheduled-posts --project-ref YOUR_PROJECT_REF
```

