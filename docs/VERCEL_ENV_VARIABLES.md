# Vercel Environment Variables Configuration

This document lists all environment variables that need to be configured in Vercel for the SONA application deployment.

## 📋 Required Environment Variables for Vercel

### Supabase Configuration
These are **required** for the application to connect to Supabase:

```env
VITE_SUPABASE_URL=https://wqwhlbmsafgjlsjujuel.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indxd2hsYm1zYWZnamxzanVqdWVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2ODU0MjIsImV4cCI6MjA4MDI2MTQyMn0.yzj6nW3_bkDvACHtNDZKRdNrtE5umpFp0wysvnHXbmI
```

### Twitter OAuth Configuration
These are **required** for Twitter/X authentication and posting:

```env
VITE_TWITTER_CLIENT_ID=your_twitter_client_id_here
VITE_TWITTER_REDIRECT_URI=https://your-vercel-app.vercel.app/auth/twitter/callback
VITE_TWITTER_SCOPES=tweet.read,users.read,offline.access,tweet.write
```

**⚠️ Important Notes:**
- Replace `your_twitter_client_id_here` with your actual Twitter Client ID
- Update `VITE_TWITTER_REDIRECT_URI` to match your production Vercel URL
- The redirect URI must also be added to your Twitter App settings in the Twitter Developer Portal

### Optional Environment Variables

```env
# Grok API (xAI) for personality analysis (if using)
VITE_GROK_API_KEY=your_grok_api_key
VITE_GROK_API_URL=https://api.x.ai/v1

# API Base URL (if using external backend)
VITE_API_BASE_URL=https://your-backend-url.com/api
```

## 🔐 Supabase Edge Function Secrets

These are configured in **Supabase Dashboard**, not Vercel. They are used by Edge Functions that handle secure operations:

### Required Supabase Secrets

1. **Twitter OAuth Secrets** (for `twitter-oauth-callback` and `twitter-refresh-token` functions):
   ```bash
   TWITTER_CLIENT_ID=your_twitter_client_id
   TWITTER_CLIENT_SECRET=your_twitter_client_secret
   ```

2. **Supabase Service Keys** (automatically available, but can be set explicitly):
   ```bash
   SUPABASE_URL=https://wqwhlbmsafgjlsjujuel.supabase.co
   SERVICE_ROLE_KEY=your_service_role_key
   ```

### How to Set Supabase Edge Function Secrets

1. Install Supabase CLI: `npm install -g supabase`
2. Login: `supabase login`
3. Link to project: `supabase link --project-ref wqwhlbmsafgjlsjujuel`
4. Set secrets:
   ```bash
   supabase secrets set TWITTER_CLIENT_ID=your_client_id
   supabase secrets set TWITTER_CLIENT_SECRET=your_client_secret
   ```

Or set them via Supabase Dashboard:
- Go to **Project Settings** → **Edge Functions** → **Secrets**

## 📝 Step-by-Step Vercel Configuration

### Option 1: Using Vercel CLI (Recommended) ⚡

**Quick Setup Script:**

1. **Make sure you're logged in:**
   ```bash
   vercel login
   ```

2. **Link your project (if not already linked):**
   ```bash
   vercel link
   ```

3. **Run the setup script:**
   
   **Windows (PowerShell):**
   ```powershell
   .\scripts\setup-vercel-env.ps1
   ```
   
   **Mac/Linux:**
   ```bash
   chmod +x scripts/setup-vercel-env.sh
   ./scripts/setup-vercel-env.sh
   ```
   
   **Node.js (Cross-platform):**
   ```bash
   node scripts/setup-vercel-env.js
   ```

4. **Or set variables manually using Vercel CLI:**
   ```bash
   # Set for all environments
   echo "your-value" | vercel env add VITE_SUPABASE_URL production
   echo "your-value" | vercel env add VITE_SUPABASE_URL preview
   echo "your-value" | vercel env add VITE_SUPABASE_URL development
   
   # Repeat for each variable
   ```

### Option 2: Using Vercel Dashboard (Manual)

### 1. Navigate to Vercel Project Settings
- Go to your Vercel project dashboard
- Click on **Settings** → **Environment Variables**

### 2. Add Each Environment Variable
For each variable listed above:
- Click **Add New**
- Enter the **Name** (e.g., `VITE_SUPABASE_URL`)
- Enter the **Value** (your actual value)
- Select **Environment(s)**: 
  - ✅ Production
  - ✅ Preview
  - ✅ Development (optional)

### 3. Update Twitter Redirect URI
**Critical Step:** After deploying to Vercel:
1. Get your production URL (e.g., `https://your-app.vercel.app`)
2. Update `VITE_TWITTER_REDIRECT_URI` in Vercel to: `https://your-app.vercel.app/auth/twitter/callback`
3. Add the same URL to your Twitter App's **Callback URLs** in the Twitter Developer Portal

### 4. Redeploy After Adding Variables
- After adding/updating environment variables, trigger a new deployment
- Vercel will automatically use the new variables in the next build

## ✅ Verification Checklist

Before deploying, ensure:

- [ ] `VITE_SUPABASE_URL` is set and correct
- [ ] `VITE_SUPABASE_ANON_KEY` is set and correct
- [ ] `VITE_TWITTER_CLIENT_ID` is set with your actual Twitter Client ID
- [ ] `VITE_TWITTER_REDIRECT_URI` matches your production Vercel URL
- [ ] `VITE_TWITTER_SCOPES` includes `tweet.write` for posting functionality
- [ ] Twitter App callback URLs include your production URL
- [ ] Supabase Edge Function secrets are configured (TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET)
- [ ] All variables are set for **Production** environment

## 🔄 After Deployment

1. Test Twitter OAuth flow:
   - Navigate to your app
   - Click "Sign in with X"
   - Verify redirect works correctly

2. Test Post Automation:
   - Connect Twitter account
   - Generate a recommended post
   - Edit the post content
   - Post to Twitter
   - Verify post appears on Twitter

3. Check Vercel Build Logs:
   - Ensure no environment variable errors
   - Verify all `VITE_` variables are accessible

## 🐛 Troubleshooting

### "VITE_TWITTER_CLIENT_ID is not set"
- Verify the variable is set in Vercel
- Check that it's enabled for the correct environment
- Redeploy after adding the variable

### Twitter OAuth Redirect Mismatch
- Ensure `VITE_TWITTER_REDIRECT_URI` exactly matches the URL in Twitter App settings
- Check for trailing slashes or protocol mismatches (http vs https)

### Edge Function Errors
- Verify Supabase secrets are set correctly
- Check Edge Function logs in Supabase Dashboard
- Ensure `SERVICE_ROLE_KEY` is available to Edge Functions

## 📚 Related Documentation

- [Twitter OAuth Implementation](./TWITTER_OAUTH_IMPLEMENTATION.md)
- [Twitter API v2 Guide](./TWITTER_API_V2.md)
- [Twitter Scheduled Post Integration](./TWITTER_SCHEDULED_POST_INTEGRATION.md)
- [Edge Function Setup](./EDGE_FUNCTION_SETUP.md)

