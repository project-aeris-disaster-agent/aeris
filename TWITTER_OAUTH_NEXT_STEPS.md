# Twitter OAuth Callback - Next Steps

## ✅ What's Been Implemented

1. **Twitter API Service** (`src/services/twitterApi.ts`)
   - Token exchange function (calls Edge Function)
   - User profile fetching
   - Tweet fetching
   - Token refresh

2. **Updated Callback Handler** (`src/pages/TwitterCallbackPage.tsx`)
   - Exchanges authorization code for tokens
   - Fetches Twitter user profile
   - Stores tokens in Supabase profiles table
   - Links Twitter account to authenticated user

3. **Supabase Edge Functions**
   - `twitter-oauth-callback` - Handles token exchange securely
   - `twitter-refresh-token` - Handles token refresh

## 🚀 Setup Required

### Step 1: Deploy Supabase Edge Functions

Follow the instructions in `docs/EDGE_FUNCTION_SETUP.md`:

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref wqwhlbmsafgjlsjujuel

# Set Twitter credentials as secrets
supabase secrets set TWITTER_CLIENT_ID=your_twitter_client_id
supabase secrets set TWITTER_CLIENT_SECRET=your_twitter_client_secret

# Deploy Edge Functions
supabase functions deploy twitter-oauth-callback
supabase functions deploy twitter-refresh-token
```

### Step 2: Update Environment Variables

Add to your `.env` file:

```env
# Twitter OAuth (already have these)
VITE_TWITTER_CLIENT_ID=your_twitter_client_id
VITE_TWITTER_REDIRECT_URI=http://localhost:5173/auth/twitter/callback

# Supabase (already have these)
VITE_SUPABASE_URL=https://wqwhlbmsafgjlsjujuel.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### Step 3: Test the Flow

1. **Start your dev server:**
   ```bash
   npm run dev
   ```

2. **Sign in with email/password** (required before connecting Twitter)

3. **Click "Sign in with X"** button

4. **Complete Twitter authorization** (will show login screen first time)

5. **Verify in Supabase Dashboard:**
   - Go to Table Editor → `profiles`
   - Check that `twitter_user_id`, `twitter_username`, and tokens are stored

## 🔍 How It Works

1. User clicks "Sign in with X"
2. Redirects to Twitter OAuth
3. User authorizes app
4. Twitter redirects to `/auth/twitter/callback` with code
5. Callback page:
   - Validates state and code verifier
   - Calls Edge Function to exchange code for tokens
   - Fetches Twitter user profile
   - Stores tokens and profile in Supabase
   - Links Twitter account to user profile
   - Redirects to `/home`

## 📝 Important Notes

- **User must be authenticated** before connecting Twitter
- Tokens are stored securely in Supabase database
- Edge Functions keep client secret secure
- Refresh tokens allow long-term access

## 🐛 Troubleshooting

### "Edge Function not found"
- Deploy the functions: `supabase functions deploy twitter-oauth-callback`
- Check function name matches exactly

### "Twitter credentials not configured"
- Set secrets: `supabase secrets set TWITTER_CLIENT_SECRET=...`
- Verify secrets: `supabase secrets list`

### "User not authenticated"
- User must sign in with email/password first
- Then connect Twitter account

### "Failed to exchange tokens"
- Check Twitter app settings
- Verify redirect URI matches exactly
- Check Twitter client ID and secret are correct

## ✅ Testing Checklist

- [ ] Edge Functions deployed
- [ ] Twitter secrets configured
- [ ] User can sign in with email/password
- [ ] User can click "Sign in with X"
- [ ] Twitter authorization completes
- [ ] Tokens stored in Supabase profiles table
- [ ] Twitter username displayed in profile
- [ ] Redirect to /home works

---

**Ready to test!** Deploy the Edge Functions and try the OAuth flow. 🚀

