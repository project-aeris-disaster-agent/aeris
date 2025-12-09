#!/bin/bash

# Bash script to automatically fix Vercel environment variables
# Usage: ./scripts/fix-vercel-env.sh [--twitter-client-id ID] [--production-url URL]

TWITTER_CLIENT_ID=""
PRODUCTION_URL=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --twitter-client-id)
            TWITTER_CLIENT_ID="$2"
            shift 2
            ;;
        --production-url)
            PRODUCTION_URL="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo ""
echo "🔧 Vercel Environment Variable Auto-Fix Script"
echo ""
echo "=================================================================================="

# Step 1: Pull current environment variables
echo ""
echo "📥 Step 1: Pulling current environment variables from Vercel..."
npx vercel env pull .env.vercel-temp > /dev/null 2>&1

if [ ! -f ".env.vercel-temp" ]; then
    echo "❌ Failed to pull environment variables. Please check Vercel CLI access."
    exit 1
fi

echo "✅ Environment variables pulled successfully"
echo ""

# Step 2: Clean variables
echo "🧹 Step 2: Cleaning environment variables..."
echo ""

declare -A ENV_VARS

while IFS='=' read -r key value; do
    # Skip comments and empty lines
    [[ "$key" =~ ^#.*$ ]] && continue
    [[ -z "$key" ]] && continue
    
    # Only process VITE_ variables
    if [[ "$key" =~ ^VITE_ ]]; then
        # Clean the value
        cleaned=$(echo "$value" | sed -e 's/^["'\'']*//' -e 's/["'\'']*$//' -e 's/\\r\\n//g' -e 's/\\n//g' -e 's/\\r//g' | xargs)
        
        ENV_VARS["$key"]="$cleaned"
        
        if [ "$cleaned" != "$value" ]; then
            echo "  🔧 $key needs cleaning"
        fi
    fi
done < .env.vercel-temp

# Step 3: Apply specific fixes
echo ""
echo "🔧 Step 3: Applying specific fixes..."
echo ""

# Fix VITE_TWITTER_REDIRECT_URI
if [ -n "${ENV_VARS[VITE_TWITTER_REDIRECT_URI]}" ]; then
    redirect_uri="${ENV_VARS[VITE_TWITTER_REDIRECT_URI]}"
    
    if [[ "$redirect_uri" =~ localhost ]] || [ -z "$redirect_uri" ]; then
        if [ -z "$PRODUCTION_URL" ]; then
            echo "⚠️  VITE_TWITTER_REDIRECT_URI is set to localhost or empty."
            echo "Please provide your production URL (e.g., https://your-app.vercel.app)"
            read -p "Production URL: " PRODUCTION_URL
        fi
        
        if [ -n "$PRODUCTION_URL" ]; then
            ENV_VARS["VITE_TWITTER_REDIRECT_URI"]="${PRODUCTION_URL}/auth/twitter/callback"
            echo "✅ Updated VITE_TWITTER_REDIRECT_URI"
        fi
    fi
fi

# Fix VITE_TWITTER_CLIENT_ID
if [ -n "${ENV_VARS[VITE_TWITTER_CLIENT_ID]}" ]; then
    client_id="${ENV_VARS[VITE_TWITTER_CLIENT_ID]}"
    
    if [ ${#client_id} -lt 10 ] || [ "$client_id" = "y" ]; then
        if [ -z "$TWITTER_CLIENT_ID" ]; then
            echo "⚠️  VITE_TWITTER_CLIENT_ID appears to be incorrect (current: '$client_id')"
            echo "Please provide your actual Twitter Client ID"
            read -p "Twitter Client ID: " TWITTER_CLIENT_ID
        fi
        
        if [ -n "$TWITTER_CLIENT_ID" ]; then
            ENV_VARS["VITE_TWITTER_CLIENT_ID"]="$TWITTER_CLIENT_ID"
            echo "✅ Updated VITE_TWITTER_CLIENT_ID"
        fi
    fi
fi

# Step 4: Display what will be fixed
echo ""
echo "📋 Step 4: Variables that will be updated:"
echo "=================================================================================="
echo ""

# Note: Bash associative arrays are tricky, so we'll process the file directly
VARS_TO_FIX=()

while IFS='=' read -r key value; do
    [[ "$key" =~ ^#.*$ ]] && continue
    [[ -z "$key" ]] && continue
    
    if [[ "$key" =~ ^VITE_ ]]; then
        cleaned=$(echo "$value" | sed -e 's/^["'\'']*//' -e 's/["'\'']*$//' -e 's/\\r\\n//g' -e 's/\\n//g' -e 's/\\r//g' | xargs)
        
        if [ "$cleaned" != "$value" ] || [[ "$cleaned" =~ localhost ]] || ([ "$key" = "VITE_TWITTER_CLIENT_ID" ] && [ ${#cleaned} -lt 10 ]); then
            VARS_TO_FIX+=("$key")
            echo "  $key:"
            echo "    Before: ${value:0:60}..."
            echo "    After:  ${cleaned:0:60}..."
            echo ""
        fi
    fi
done < .env.vercel-temp

if [ ${#VARS_TO_FIX[@]} -eq 0 ]; then
    echo "✅ All variables are already clean!"
    rm -f .env.vercel-temp
    exit 0
fi

# Step 5: Confirm
echo "=================================================================================="
read -p "Do you want to update these variables in Vercel? (y/N): " confirm

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo ""
    echo "❌ Cancelled. No changes made."
    rm -f .env.vercel-temp
    exit 0
fi

# Step 6: Update variables
echo ""
echo "🚀 Step 5: Updating variables in Vercel..."
echo ""

ENVIRONMENTS=("production" "preview" "development")
UPDATED=0
FAILED=0

for var_name in "${VARS_TO_FIX[@]}"; do
    new_value="${ENV_VARS[$var_name]}"
    
    for env in "${ENVIRONMENTS[@]}"; do
        echo "  Updating $var_name for $env..."
        
        # Remove old
        npx vercel env rm "$var_name" "$env" --yes > /dev/null 2>&1
        
        # Add new
        echo "$new_value" | npx vercel env add "$var_name" "$env" > /dev/null 2>&1
        
        if [ $? -eq 0 ]; then
            echo "    ✅ $env updated"
            ((UPDATED++))
        else
            echo "    ❌ $env failed"
            ((FAILED++))
        fi
    done
done

# Step 7: Summary
echo ""
echo "=================================================================================="
echo ""
echo "📊 Summary:"
echo "  ✅ Updated: $UPDATED variables"
if [ $FAILED -gt 0 ]; then
    echo "  ❌ Failed: $FAILED variables"
fi

# Cleanup
rm -f .env.vercel-temp

echo ""
echo "✨ Done! Variables have been updated in Vercel."
echo "💡 Next step: Redeploy your project with: npx vercel --prod"
echo ""

