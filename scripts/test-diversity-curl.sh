#!/bin/bash
# Test agent diversity by calling the edge function
# Usage: ./scripts/test-diversity-curl.sh

# Get the project URL and anon key from Supabase
PROJECT_URL="${SUPABASE_URL:-https://wqwhlbmsafgjlsjujuel.supabase.co}"
ANON_KEY="${SUPABASE_ANON_KEY}"

if [ -z "$ANON_KEY" ]; then
  echo "❌ SUPABASE_ANON_KEY not set. Please set it in your environment or .env file"
  exit 1
fi

echo "🧪 Testing Agent Reply Diversity"
echo "📡 Calling edge function: test-agent-diversity"
echo ""

curl -X POST \
  "${PROJECT_URL}/functions/v1/test-agent-diversity" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  | jq '.'

echo ""
echo "✅ Test complete!"
