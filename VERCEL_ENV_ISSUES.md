# Vercel Environment Variable Issues Found

## 🔴 Critical Issues Detected

Based on the environment variables pulled from Vercel, the following issues were found:

### 1. **VITE_SUPABASE_URL** ❌
- **Current Value**: `"https://wqwhlbmsafgjlsjujuel.supabase.co \n"`
- **Issues**:
  - ✅ Has quotes around the value
  - ✅ Has trailing newline character (`\n`)
  - ✅ Has trailing space
- **Should Be**: `https://wqwhlbmsafgjlsjujuel.supabase.co`
- **Status**: Needs fixing

### 2. **VITE_SUPABASE_ANON_KEY** ❌
- **Current Value**: `""eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (truncated)
- **Issues**:
  - ✅ Has double quotes around the value
  - ✅ Has carriage return and newline (`\r\n`)
- **Should Be**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indxd2hsYm1zYWZnamxzanVqdWVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2ODU0MjIsImV4cCI6MjA4MDI2MTQyMn0.yzj6nW3_bkDvACHtNDZKRdNrtE5umpFp0wysvnHXbmI`
- **Status**: Needs fixing

### 3. **VITE_TWITTER_CLIENT_ID** ❌ CRITICAL
- **Current Value**: `""y" \r\n"`
- **Issues**:
  - ✅ **Value is completely wrong** - only contains `"y"` instead of actual client ID
  - ✅ Has double quotes
  - ✅ Has carriage return and newline (`\r\n`)
- **Should Be**: Your actual Twitter Client ID (e.g., `TGtVM2pMb3M0WFlnY3gyekdpa1I6MTpjaQ`)
- **Status**: **CRITICAL - Value is incorrect!**

### 4. **VITE_TWITTER_REDIRECT_URI** ❌
- **Current Value**: `""http://localhost:3000/auth/twitter/callback" \r\n"`
- **Issues**:
  - ✅ Has double quotes
  - ✅ **Wrong URL** - using `localhost:3000` instead of production URL
  - ✅ Has carriage return and newline (`\r\n`)
- **Should Be**: `https://sonara-4psnws748-agent-aeris-projects.vercel.app/auth/twitter/callback` (or your production URL)
- **Status**: Needs fixing

### 5. **VITE_TWITTER_SCOPES** ⚠️
- **Status**: Not checked (need to verify)
- **Should Be**: `tweet.read,users.read,offline.access,tweet.write`

## 📝 How to Fix

### Step 1: Go to Vercel Dashboard
1. Navigate to: https://vercel.com/agent-aeris-projects/sonara/settings/environment-variables
2. Or: Vercel Dashboard → Your Project → Settings → Environment Variables

### Step 2: Fix Each Variable

#### Fix VITE_SUPABASE_URL:
1. Click to edit
2. Remove all quotes
3. Remove trailing space and newline
4. Value should be exactly: `https://wqwhlbmsafgjlsjujuel.supabase.co`
5. Save

#### Fix VITE_SUPABASE_ANON_KEY:
1. Click to edit
2. Remove all quotes (double quotes)
3. Remove `\r\n` characters
4. Value should be the full JWT token starting with `eyJ...`
5. Save

#### Fix VITE_TWITTER_CLIENT_ID: ⚠️ CRITICAL
1. Click to edit
2. **Replace the entire value** with your actual Twitter Client ID
3. Remove all quotes
4. Remove `\r\n` characters
5. Get your Client ID from: Twitter Developer Portal → Your App → Keys and tokens
6. Save

#### Fix VITE_TWITTER_REDIRECT_URI:
1. Click to edit
2. Remove all quotes
3. **Change the URL** from `http://localhost:3000` to your production URL:
   - `https://sonara-4psnws748-agent-aeris-projects.vercel.app/auth/twitter/callback`
   - Or use your custom domain if you have one
4. Remove `\r\n` characters
5. Make sure it's `https://` not `http://`
6. Save

#### Check VITE_TWITTER_SCOPES:
1. Click to edit
2. Remove all quotes
3. Value should be: `tweet.read,users.read,offline.access,tweet.write`
4. No spaces after commas
5. Save

### Step 3: Verify All Environments
Make sure to fix these for **all three environments**:
- ✅ Production
- ✅ Preview
- ✅ Development

### Step 4: Redeploy
After fixing all variables, trigger a new deployment:
```bash
npx vercel --prod
```

## 🔍 Common Issues to Watch For

1. **Quotes**: Never put quotes around values in Vercel
2. **Newlines**: Remove any `\n` or `\r\n` characters
3. **Whitespace**: No leading or trailing spaces
4. **URLs**: Must use `https://` for production, not `http://` or `localhost`
5. **Client IDs**: Must be the actual value, not placeholder text

## ✅ After Fixing

Once all variables are fixed:
1. The app should load without configuration errors
2. Twitter OAuth should work correctly
3. Supabase connection should work properly

## 🛠️ Quick Fix Commands (Alternative)

If you prefer using CLI, you can remove and re-add variables:

```bash
# Remove old variables
vercel env rm VITE_SUPABASE_URL production
vercel env rm VITE_SUPABASE_ANON_KEY production
vercel env rm VITE_TWITTER_CLIENT_ID production
vercel env rm VITE_TWITTER_REDIRECT_URI production

# Add correct values (replace with actual values)
echo "https://wqwhlbmsafgjlsjujuel.supabase.co" | vercel env add VITE_SUPABASE_URL production
echo "YOUR_ACTUAL_ANON_KEY" | vercel env add VITE_SUPABASE_ANON_KEY production
echo "YOUR_ACTUAL_CLIENT_ID" | vercel env add VITE_TWITTER_CLIENT_ID production
echo "https://sonara-4psnws748-agent-aeris-projects.vercel.app/auth/twitter/callback" | vercel env add VITE_TWITTER_REDIRECT_URI production
```

**Note**: Repeat for Preview and Development environments as needed.

