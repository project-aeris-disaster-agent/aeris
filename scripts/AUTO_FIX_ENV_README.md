# Automated Vercel Environment Variable Fix

This directory contains scripts to automatically fix all Vercel environment variable issues:
- Remove quotes (single and double)
- Remove newlines (`\n`, `\r\n`)
- Remove whitespace
- Fix localhost URLs
- Validate and correct values

## 🚀 Quick Start

### Option 1: Interactive Script (Recommended)

**Windows (PowerShell):**
```powershell
.\scripts\fix-vercel-env.ps1
```

**Mac/Linux (Bash):**
```bash
chmod +x scripts/fix-vercel-env.sh
./scripts/fix-vercel-env.sh
```

This will:
1. Pull your current env vars from Vercel
2. Show you what will be fixed
3. Ask for confirmation
4. Update all variables automatically

### Option 2: Fully Automated (No Prompts)

**Windows (PowerShell):**
```powershell
.\scripts\fix-vercel-env-auto.ps1 -TwitterClientId "YOUR_CLIENT_ID" -ProductionUrl "https://your-app.vercel.app"
```

**Mac/Linux (Bash):**
```bash
./scripts/fix-vercel-env.sh --twitter-client-id "YOUR_CLIENT_ID" --production-url "https://your-app.vercel.app"
```

### Option 3: Node.js (Cross-platform)

```bash
node scripts/fix-vercel-env.js --twitter-client-id "YOUR_CLIENT_ID" --production-url "https://your-app.vercel.app"
```

## 📋 What Gets Fixed

### Automatic Fixes (No Input Required):
- ✅ `VITE_SUPABASE_URL` - Removes quotes, newlines, whitespace
- ✅ `VITE_SUPABASE_ANON_KEY` - Removes quotes, newlines, whitespace
- ✅ `VITE_TWITTER_SCOPES` - Removes quotes, newlines, whitespace

### Fixes That May Need Input:
- ⚠️ `VITE_TWITTER_CLIENT_ID` - If value is obviously wrong (like "y"), you'll be prompted
- ⚠️ `VITE_TWITTER_REDIRECT_URI` - If set to localhost, you'll be prompted for production URL

## 🔧 Prerequisites

1. **Vercel CLI installed and logged in:**
   ```bash
   npm install -g vercel
   vercel login
   ```

2. **Project linked:**
   ```bash
   vercel link
   ```

## 📝 Step-by-Step Usage

### Step 1: Run the Script

Choose one of the scripts above based on your platform.

### Step 2: Provide Missing Information (if prompted)

If the script detects issues that need manual input:
- **Twitter Client ID**: Get from [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
- **Production URL**: Your Vercel deployment URL (e.g., `https://your-app.vercel.app`)

### Step 3: Review Changes

The script will show you:
- What variables will be updated
- Before/after values
- Ask for confirmation

### Step 4: Confirm

Type `y` to proceed with updates, or `N` to cancel.

### Step 5: Redeploy

After the script completes:
```bash
npx vercel --prod
```

## 🎯 Example Output

```
🔧 Vercel Environment Variable Auto-Fix Script

================================================================================

📥 Step 1: Pulling current environment variables from Vercel...
✅ Environment variables pulled successfully

🧹 Step 2: Cleaning environment variables...
  🔧 VITE_SUPABASE_URL needs cleaning
  🔧 VITE_SUPABASE_ANON_KEY needs cleaning
  🔧 VITE_TWITTER_CLIENT_ID needs cleaning
  🔧 VITE_TWITTER_REDIRECT_URI needs cleaning

🔧 Step 3: Applying specific fixes...
✅ Updated VITE_TWITTER_REDIRECT_URI

📋 Step 4: Variables that will be updated:
================================================================================

  VITE_SUPABASE_URL:
    Before: "https://wqwhlbmsafgjlsjujuel.supabase.co \n"
    After:  https://wqwhlbmsafgjlsjujuel.supabase.co

  VITE_TWITTER_CLIENT_ID:
    Before: ""y" \r\n"
    After:  TGtVM2pMb3M0WFlnY3gyekdpa1I6MTpjaQ

Do you want to update these variables in Vercel? (y/N): y

🚀 Step 5: Updating variables in Vercel...
  Updating VITE_SUPABASE_URL for production...
    ✅ production updated
  Updating VITE_SUPABASE_URL for preview...
    ✅ preview updated
  Updating VITE_SUPABASE_URL for development...
    ✅ development updated

================================================================================

📊 Summary:
  ✅ Updated: 12 variables

✨ Done! Variables have been updated in Vercel.
💡 Next step: Redeploy your project with: npx vercel --prod
```

## 🔍 Verification

After running the script, verify the fixes:

1. **Check in Vercel Dashboard:**
   - Go to Settings → Environment Variables
   - Verify values don't have quotes
   - Verify URLs are correct

2. **Or pull and check:**
   ```bash
   vercel env pull .env.check
   cat .env.check | grep VITE_
   ```

## 🐛 Troubleshooting

### Script fails to pull environment variables
- Make sure you're logged in: `vercel login`
- Make sure project is linked: `vercel link`
- Check you have permissions for the project

### Script fails to update variables
- Check Vercel CLI version: `vercel --version`
- Update if needed: `npm install -g vercel@latest`
- Try updating one variable manually first to test permissions

### Variables still have issues after running
- Some variables might need manual fixes in Vercel Dashboard
- Check the `VERCEL_ENV_ISSUES.md` file for detailed instructions

## 📚 Related Files

- `VERCEL_ENV_ISSUES.md` - Detailed list of all issues found
- `docs/VERCEL_ENV_VARIABLES.md` - Environment variable documentation

## ⚠️ Important Notes

1. **Backup First**: The script modifies production environment variables. Make sure you have backups or can restore if needed.

2. **Twitter Client ID**: If your `VITE_TWITTER_CLIENT_ID` is wrong, you'll need to provide the correct one. Get it from Twitter Developer Portal.

3. **Production URL**: Make sure the production URL matches your actual Vercel deployment URL.

4. **All Environments**: The script updates Production, Preview, and Development environments. If you only want to update one, modify the script.

## 🎉 Success!

After running the script and redeploying, your app should:
- ✅ Load without configuration errors
- ✅ Connect to Supabase properly
- ✅ Work with Twitter OAuth
- ✅ Have all environment variables properly formatted

