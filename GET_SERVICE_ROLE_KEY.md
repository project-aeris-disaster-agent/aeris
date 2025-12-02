# Get Service Role Key for Edge Functions

## Problem
Edge Function is getting "Invalid API key" error because `SERVICE_ROLE_KEY` is incorrect.

## Solution: Get the Actual Service Role Key

The `supabase secrets list` command shows **digests (hashes)**, not the actual keys. We need the **actual service role key** from Supabase Dashboard.

### Steps:

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard/project/wqwhlbmsafgjlsjujuel/settings/api

2. **Find the Service Role Key:**
   - Scroll to **"Project API keys"** section
   - Look for **"service_role"** key (NOT "anon" key)
   - It should be a long JWT token starting with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Click **"Reveal"** or **"Copy"** to get the full key

3. **Set it as a secret:**
   ```bash
   supabase secrets set SERVICE_ROLE_KEY=your_actual_service_role_key_here
   ```

4. **Verify it's set:**
   ```bash
   supabase secrets list
   ```
   (You'll see a digest, which is fine - it means the key is stored)

5. **Test again:**
   - Try Twitter OAuth login
   - Should work now!

## Important Notes

- ⚠️ **Never expose the service role key** in frontend code
- ✅ It's safe to use in Edge Functions (server-side only)
- ✅ The key should be a JWT token (starts with `eyJ...`)

## Alternative: Check Current Key

If you're not sure which key to use, you can check what's currently set:
- The digest shown by `supabase secrets list` is just a hash
- You need the actual JWT token from the Dashboard

---

**After setting the correct key, the "Invalid API key" error should be resolved!** 🔑

