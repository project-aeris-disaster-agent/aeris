# Vercel Environment Variables - Quick Commands

Copy and paste these commands to set up your environment variables in Vercel.

## Prerequisites

```bash
# Make sure you're logged in
vercel login

# Link your project (if not already linked)
vercel link
```

## Set Environment Variables

Replace the placeholder values with your actual values, then run:

```bash
# Supabase Configuration
echo "https://wqwhlbmsafgjlsjujuel.supabase.co" | vercel env add VITE_SUPABASE_URL production
echo "https://wqwhlbmsafgjlsjujuel.supabase.co" | vercel env add VITE_SUPABASE_URL preview
echo "https://wqwhlbmsafgjlsjujuel.supabase.co" | vercel env add VITE_SUPABASE_URL development

echo "YOUR_SUPABASE_ANON_KEY" | vercel env add VITE_SUPABASE_ANON_KEY production
echo "YOUR_SUPABASE_ANON_KEY" | vercel env add VITE_SUPABASE_ANON_KEY preview
echo "YOUR_SUPABASE_ANON_KEY" | vercel env add VITE_SUPABASE_ANON_KEY development

# Twitter Configuration
echo "YOUR_TWITTER_CLIENT_ID" | vercel env add VITE_TWITTER_CLIENT_ID production
echo "YOUR_TWITTER_CLIENT_ID" | vercel env add VITE_TWITTER_CLIENT_ID preview
echo "YOUR_TWITTER_CLIENT_ID" | vercel env add VITE_TWITTER_CLIENT_ID development

echo "https://your-app.vercel.app/auth/twitter/callback" | vercel env add VITE_TWITTER_REDIRECT_URI production
echo "https://your-app.vercel.app/auth/twitter/callback" | vercel env add VITE_TWITTER_REDIRECT_URI preview
echo "https://your-app.vercel.app/auth/twitter/callback" | vercel env add VITE_TWITTER_REDIRECT_URI development

echo "tweet.read,users.read,offline.access,tweet.write" | vercel env add VITE_TWITTER_SCOPES production
echo "tweet.read,users.read,offline.access,tweet.write" | vercel env add VITE_TWITTER_SCOPES preview
echo "tweet.read,users.read,offline.access,tweet.write" | vercel env add VITE_TWITTER_SCOPES development
```

## Alternative: Interactive Setup

If piping doesn't work, use the interactive command:

```bash
vercel env add VITE_SUPABASE_URL production
# Then paste the value when prompted
```

## Verify Environment Variables

```bash
vercel env ls
```

## Pull Environment Variables Locally

To pull development environment variables to a `.env.local` file:

```bash
vercel env pull .env.local
```

