# Fix: Invalid API Key Error

## Problem
Edge Function is returning "Invalid API key" when trying to create users with admin API.

## Solution
The `SERVICE_ROLE_KEY` secret needs to be the **actual service role key** from Supabase Dashboard, not a hash.

## Steps to Fix

1. **Get your Service Role Key from Supabase Dashboard:**
   - Go to: https://supabase.com/dashboard/project/wqwhlbmsafgjlsjujuel/settings/api
   - Scroll to **Project API keys**
   - Copy the **`service_role`** key (NOT the `anon` key)
   - It should start with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

2. **Set the secret with the actual key:**
   ```bash
   supabase secrets set SERVICE_ROLE_KEY=your_actual_service_role_key_here
   ```

3. **Redeploy the Edge Function** (if needed):
   ```bash
   supabase functions deploy twitter-oauth-callback
   ```

## Important Notes

- The service role key is **secret** - never expose it in frontend code
- Only use it in Edge Functions (server-side)
- The key should be a JWT token (starts with `eyJ...`)

## Verify

After setting the correct key, try Twitter OAuth again. The "Invalid API key" error should be resolved.

