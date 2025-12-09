# Twitter OAuth Production Fix Guide

## 🔴 Critical Issue: Redirect URI Mismatch

When Twitter OAuth works on localhost but fails in production, it's almost always because:

1. **The redirect URI in Twitter Developer Portal doesn't match production**
2. **Environment variables still have quotes/newlines** (even after "fixing")

## ✅ Step-by-Step Fix

### Step 1: Verify Environment Variables Are Actually Clean

Run this to check:
```bash
npx vercel env pull .env.check
cat .env.check | grep VITE_TWITTER
```

**Expected (CORRECT):**
```
VITE_TWITTER_CLIENT_ID=xdN4iDV4VUIz1V5dAUBJvfNR2
VITE_TWITTER_REDIRECT_URI=https://sonara-4psnws748-agent-aeris-projects.vercel.app/auth/twitter/callback
```

**If you see quotes or newlines (WRONG):**
```
VITE_TWITTER_CLIENT_ID=""xdN4iDV4VUIz1V5dAUBJvfNR2" \r\n"
```

**Fix:** Run the fix script again:
```bash
node scripts/fix-vercel-env.js --twitter-client-id "xdN4iDV4VUIz1V5dAUBJvfNR2"
```

### Step 2: Register Redirect URI in Twitter Developer Portal

**This is the most critical step!**

1. Go to: https://developer.twitter.com/en/portal/dashboard
2. Select your app
3. Go to **Settings** → **User authentication settings**
4. Under **Callback URI / Redirect URL**, add:
   ```
   https://sonara-4psnws748-agent-aeris-projects.vercel.app/auth/twitter/callback
   ```
5. **IMPORTANT:** The URL must match EXACTLY:
   - ✅ Must be `https://` (not `http://`)
   - ✅ Must include the full path `/auth/twitter/callback`
   - ✅ No trailing slash
   - ✅ Must match your Vercel deployment URL exactly

6. Also add your localhost for development:
   ```
   http://localhost:3000/auth/twitter/callback
   ```

7. **Save changes**

### Step 3: Verify Client ID and Secret Match

1. In Twitter Developer Portal → **Keys and tokens**
2. Copy your **Client ID** - should be: `xdN4iDV4VUIz1V5dAUBJvfNR2`
3. Verify it matches `VITE_TWITTER_CLIENT_ID` in Vercel (without quotes)

### Step 4: Check Supabase Edge Function Secrets

Your Edge Function also needs Twitter credentials:

1. Go to Supabase Dashboard → **Project Settings** → **Edge Functions** → **Secrets**
2. Verify these are set:
   - `TWITTER_CLIENT_ID` = `xdN4iDV4VUIz1V5dAUBJvfNR2`
   - `TWITTER_CLIENT_SECRET` = Your actual client secret

### Step 5: Redeploy After Changes

After fixing environment variables or Twitter settings:
```bash
npx vercel --prod
```

## 🔍 Debugging Checklist

- [ ] Environment variables have no quotes or newlines
- [ ] `VITE_TWITTER_REDIRECT_URI` is exactly: `https://sonara-4psnws748-agent-aeris-projects.vercel.app/auth/twitter/callback`
- [ ] Redirect URI is registered in Twitter Developer Portal (exact match)
- [ ] Client ID in Vercel matches Twitter Developer Portal
- [ ] Supabase Edge Function has `TWITTER_CLIENT_ID` and `TWITTER_CLIENT_SECRET` secrets
- [ ] App has been redeployed after making changes

## 🐛 Common Errors

### Error: "Something went wrong" on Twitter
- **Cause:** Redirect URI mismatch
- **Fix:** Ensure redirect URI in Twitter Developer Portal matches exactly

### Error: 400 Bad Request
- **Cause:** Invalid client_id or redirect_uri format
- **Fix:** Check environment variables don't have quotes/newlines

### Error: "Invalid client"
- **Cause:** Client ID doesn't match
- **Fix:** Verify Client ID in Vercel matches Twitter Developer Portal

## 📝 Quick Fix Command

If environment variables still have issues:
```bash
# Fix all variables (replace with your actual client ID)
node scripts/fix-vercel-env.js --twitter-client-id "xdN4iDV4VUIz1V5dAUBJvfNR2" --production-url "https://sonara-4psnws748-agent-aeris-projects.vercel.app"

# Then redeploy
npx vercel --prod
```

## ✅ Verification

After fixing, test:
1. Open your production app
2. Click "Sign in with X"
3. Should redirect to Twitter authorization
4. After authorizing, should redirect back to your app
5. Check browser console for any errors

