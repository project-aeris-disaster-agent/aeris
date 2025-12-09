#!/bin/bash
# Bash script to set up Vercel environment variables
# Usage: ./scripts/setup-vercel-env.sh

echo "🚀 Vercel Environment Variables Setup"
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Install with: npm install -g vercel"
    exit 1
fi

echo "✅ Vercel CLI found: $(vercel --version)"

# Check if logged in
if ! vercel whoami &> /dev/null; then
    echo "❌ Not logged in. Please run: vercel login"
    exit 1
fi

echo "✅ Logged in to Vercel"

# Check if project is linked
if [ ! -d ".vercel" ]; then
    echo "📦 Linking to Vercel project..."
    vercel link
fi

echo ""
echo "📝 Setting up environment variables:"
echo ""

# Function to set environment variable
set_env_var() {
    local name=$1
    local value=$2
    local env=$3
    
    echo "  Setting $name for $env..."
    echo "$value" | vercel env add "$name" "$env" 2>&1
    if [ $? -eq 0 ]; then
        echo "  ✅ Set for $env"
    else
        echo "  ⚠️  May already exist for $env"
    fi
}

# Read environment variables
read -p "Enter VITE_SUPABASE_URL [https://wqwhlbmsafgjlsjujuel.supabase.co]: " supabase_url
supabase_url=${supabase_url:-https://wqwhlbmsafgjlsjujuel.supabase.co}

read -p "Enter VITE_SUPABASE_ANON_KEY: " supabase_key

read -p "Enter VITE_TWITTER_CLIENT_ID: " twitter_client_id

read -p "Enter VITE_TWITTER_REDIRECT_URI (update after deployment): " twitter_redirect

read -p "Enter VITE_TWITTER_SCOPES [tweet.read,users.read,offline.access,tweet.write]: " twitter_scopes
twitter_scopes=${twitter_scopes:-tweet.read,users.read,offline.access,tweet.write}

environments=("production" "preview" "development")

# Set Supabase variables
if [ -n "$supabase_url" ]; then
    for env in "${environments[@]}"; do
        set_env_var "VITE_SUPABASE_URL" "$supabase_url" "$env"
    done
fi

if [ -n "$supabase_key" ]; then
    for env in "${environments[@]}"; do
        set_env_var "VITE_SUPABASE_ANON_KEY" "$supabase_key" "$env"
    done
fi

# Set Twitter variables
if [ -n "$twitter_client_id" ]; then
    for env in "${environments[@]}"; do
        set_env_var "VITE_TWITTER_CLIENT_ID" "$twitter_client_id" "$env"
    done
fi

if [ -n "$twitter_redirect" ]; then
    for env in "${environments[@]}"; do
        set_env_var "VITE_TWITTER_REDIRECT_URI" "$twitter_redirect" "$env"
    done
fi

if [ -n "$twitter_scopes" ]; then
    for env in "${environments[@]}"; do
        set_env_var "VITE_TWITTER_SCOPES" "$twitter_scopes" "$env"
    done
fi

echo ""
echo "✅ Environment variables setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Deploy your project: vercel --prod"
echo "2. Update VITE_TWITTER_REDIRECT_URI with your production URL"
echo "3. Add the callback URL to your Twitter App settings"
echo ""

