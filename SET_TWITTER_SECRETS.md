# Setting Twitter Secrets for Edge Functions

## ✅ Edge Functions Deployed!

Both Edge Functions are now deployed and active:
- ✅ `twitter-oauth-callback` (Version 1, ACTIVE)
- ✅ `twitter-refresh-token` (Version 1, ACTIVE)

## 🔐 Set Twitter Credentials as Secrets

The Edge Functions need access to your Twitter Client ID and Client Secret. Set them using Supabase CLI:

### Option 1: Using Supabase CLI (Recommended)

```bash
# Make sure you're logged in and linked
supabase login
supabase link --project-ref wqwhlbmsafgjlsjujuel

# Set Twitter credentials as secrets
supabase secrets set TWITTER_CLIENT_ID=your_new_oauth2_client_id
supabase secrets set TWITTER_CLIENT_SECRET=your_new_oauth2_client_secret
```

### Option 2: Via Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/wqwhlbmsafgjlsjujuel/settings/functions
2. Find your Edge Functions
3. Click on each function → **Settings** → **Secrets**
4. Add:
   - `TWITTER_CLIENT_ID` = your_new_oauth2_client_id
   - `TWITTER_CLIENT_SECRET` = your_new_oauth2_client_secret

### Verify Secrets Are Set

```bash
supabase secrets list
```

You should see:
- `TWITTER_CLIENT_ID`
- `TWITTER_CLIENT_SECRET`

## 📝 Update Frontend .env File

Make sure your `.env` file has:

```env
# Twitter OAuth 2.0
VITE_TWITTER_CLIENT_ID=your_new_oauth2_client_id
VITE_TWITTER_REDIRECT_URI=http://localhost:3000/auth/twitter/callback

# Supabase
VITE_SUPABASE_URL=https://wqwhlbmsafgjlsjujuel.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## ✅ Edge Function Endpoints

Your Edge Functions are now available at:

1. **Twitter OAuth Callback:**
   ```
   https://wqwhlbmsafgjlsjujuel.supabase.co/functions/v1/twitter-oauth-callback
   ```

2. **Twitter Token Refresh:**
   ```
   https://wqwhlbmsafgjlsjujuel.supabase.co/functions/v1/twitter-refresh-token
   ```

## 🧪 Testing

After setting secrets:

1. **Restart dev server:**
   ```bash
   npm run dev
   ```

2. **Test OAuth flow:**
   - Sign in with email/password
   - Click "Sign in with X"
   - Complete Twitter authorization
   - Should redirect to `/home`

3. **Check browser console** for any errors

4. **Verify in Supabase Dashboard:**
   - Table Editor → `profiles`
   - Check `twitter_user_id`, `twitter_username` are populated

---

**Next:** Set the secrets using CLI or Dashboard, then test the OAuth flow! 🚀

