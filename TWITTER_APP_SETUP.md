# Twitter Developer App Setup Guide

## Critical: Redirect URI Configuration

The **redirect URI must match EXACTLY** between:
1. Your `.env` file
2. Twitter Developer Portal settings
3. What your app sends to Twitter

## Step-by-Step Twitter App Configuration

### 1. Go to Twitter Developer Portal

Visit: https://developer.twitter.com/en/portal/dashboard

### 2. Select or Create Your App

- If creating new app: Click "Create App" or "Add App"
- If using existing app: Select it from the list

### 3. Configure OAuth 2.0 Settings

1. Go to **Settings** tab
2. Scroll to **User authentication settings**
3. Click **Set up** or **Edit**

### 4. Configure App Settings

**App permissions:**
- Select: **Read** (required for `tweet.read`, `users.read`)
- Or: **Read and write** (if you need posting later)

**Type of App:**
- Select: **Web App, Automated App or Bot**

**App info:**
- **Callback URI / Redirect URL:** 
  ```
  http://localhost:3000/auth/twitter/callback
  ```
  ⚠️ **MUST MATCH EXACTLY** - no trailing slashes, exact port, exact path

- **Website URL:**
  ```
  http://localhost:3000
  ```
  (Can be your production URL later)

### 5. Save Settings

- Click **Save** at the bottom
- **Wait a few minutes** for changes to propagate

### 6. Get Your Credentials

1. Go to **Keys and tokens** tab
2. Copy **Client ID** → Use as `VITE_TWITTER_CLIENT_ID`
3. Copy **Client Secret** → Use in Supabase Edge Function secrets (NOT in frontend!)

## Common Mistakes

### ❌ Wrong Redirect URI Format
- ❌ `http://localhost:3000/auth/twitter/callback/` (trailing slash)
- ❌ `http://localhost:5173/auth/twitter/callback` (wrong port)
- ❌ `localhost:3000/auth/twitter/callback` (missing http://)
- ✅ `http://localhost:3000/auth/twitter/callback` (CORRECT)

### ❌ App Type Mismatch
- Must be "Web App, Automated App or Bot" for OAuth 2.0
- Not "Native App" or "Single Page App"

### ❌ Missing Permissions
- App must have "Read" permission for `tweet.read` and `users.read` scopes

## Verification Checklist

- [ ] App type is "Web App, Automated App or Bot"
- [ ] OAuth 2.0 is enabled
- [ ] Callback URI is exactly: `http://localhost:3000/auth/twitter/callback`
- [ ] No trailing slashes in callback URI
- [ ] Port matches your dev server (3000)
- [ ] App has "Read" permissions
- [ ] Saved settings and waited a few minutes
- [ ] Client ID matches your `.env` file

## Testing

After configuring:

1. **Clear browser cache/cookies** for Twitter
2. **Restart dev server:** `npm run dev`
3. **Check browser console** for redirect URI being used
4. **Try OAuth flow again**

## Production Setup

When deploying to production:

1. Add production callback URI in Twitter Portal:
   ```
   https://yourdomain.com/auth/twitter/callback
   ```

2. Update `.env`:
   ```env
   VITE_TWITTER_REDIRECT_URI=https://yourdomain.com/auth/twitter/callback
   ```

3. You can have **multiple callback URIs** in Twitter Portal (one per environment)

---

**Most Common Issue:** Redirect URI mismatch - make sure it matches EXACTLY! 🔍

