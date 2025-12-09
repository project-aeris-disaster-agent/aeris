# Twitter OAuth Troubleshooting Summary

## ✅ Completed Steps

### Step 1: Fixed Environment Variables
- ✅ Removed and re-added all Vercel environment variables
- ✅ Cleaned quotes and newlines
- ✅ Set correct values for all 3 environments (production, preview, development)

### Step 2: Verified Configuration
- ✅ Client ID: `xdN4iDV4VUIz1V5dAUBJvfNR2`
- ✅ Redirect URI: `https://sonara-4psnws748-agent-aeris-projects.vercel.app/auth/twitter/callback`
- ✅ Supabase URL: `https://wqwhlbmsafgjlsjujuel.supabase.co`

## 🔴 Critical Next Steps (Manual)

### 1. Register Redirect URI in Twitter Developer Portal ⚠️

**This is the #1 reason OAuth fails in production!**

1. Go to: https://developer.twitter.com/en/portal/dashboard
2. Select your app
3. Go to **Settings** → **User authentication settings**
4. Under **Callback URI / Redirect URL**, add:
   ```
   https://sonara-4psnws748-agent-aeris-projects.vercel.app/auth/twitter/callback
   ```
5. **CRITICAL:** The URL must match EXACTLY:
   - ✅ Must be `https://` (not `http://`)
   - ✅ Must include `/auth/twitter/callback`
   - ✅ No trailing slash
   - ✅ Case-sensitive match

6. Also keep localhost for development:
   ```
   http://localhost:3000/auth/twitter/callback
   ```

7. **Save changes** (this is critical!)

### 2. Verify Supabase Edge Function Secrets ✅ COMPLETED

Your Edge Function needs Twitter credentials:

**✅ Status:**
- ✅ `TWITTER_CLIENT_ID` = `xdN4iDV4VUIz1V5dAUBJvfNR2` (updated to match Vercel)
- ✅ `TWITTER_CLIENT_SECRET` = Set (verified)

**Verified via CLI:**
```bash
supabase secrets list
# Shows: TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET are both set
```

**If you need to update in the future:**
```bash
# Update Client ID
supabase secrets set TWITTER_CLIENT_ID=xdN4iDV4VUIz1V5dAUBJvfNR2

# Update Client Secret (if needed)
supabase secrets set TWITTER_CLIENT_SECRET=YOUR_ACTUAL_SECRET
```

**Or via Supabase Dashboard:**
1. Go to: https://supabase.com/dashboard/project/wqwhlbmsafgjlsjujuel/settings/functions
2. Scroll to **Edge Function Secrets**
3. View/edit secrets there

### 3. Redeploy Application

After fixing Twitter Developer Portal settings:
```bash
npx vercel --prod
```

## 🔍 Verification Checklist

- [x] Environment variables cleaned (quotes/newlines removed)
- [x] Client ID set correctly: `xdN4iDV4VUIz1V5dAUBJvfNR2`
- [x] Redirect URI set correctly: `https://sonara-4psnws748-agent-aeris-projects.vercel.app/auth/twitter/callback`
- [x] Supabase Edge Function secrets verified and updated
- [x] Supabase `TWITTER_CLIENT_ID` matches Vercel `VITE_TWITTER_CLIENT_ID`
- [ ] **Redirect URI registered in Twitter Developer Portal** ⚠️ CRITICAL - MANUAL STEP REQUIRED
- [ ] Application redeployed after changes

## 🐛 If Still Not Working

### Check Browser Console
1. Open production app
2. Open browser DevTools (F12)
3. Go to Console tab
4. Click "Sign in with X"
5. Look for errors - they will tell you exactly what's wrong

### Common Error Messages

**"Something went wrong" on Twitter page:**
- ✅ Redirect URI not registered in Twitter Developer Portal
- ✅ Redirect URI doesn't match exactly

**400 Bad Request:**
- ✅ Environment variables still have quotes/newlines
- ✅ Client ID format is wrong

**"Invalid client":**
- ✅ Client ID doesn't match Twitter Developer Portal

## 📝 Quick Reference

**Production URL:**
```
https://sonara-4psnws748-agent-aeris-projects.vercel.app
```

**Redirect URI to register:**
```
https://sonara-4psnws748-agent-aeris-projects.vercel.app/auth/twitter/callback
```

**Client ID:**
```
xdN4iDV4VUIz1V5dAUBJvfNR2
```

**Twitter Developer Portal:**
```
https://developer.twitter.com/en/portal/dashboard
```

**Supabase Dashboard:**
```
https://supabase.com/dashboard/project/wqwhlbmsafgjlsjujuel
```

