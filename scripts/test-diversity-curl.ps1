# Test agent diversity by calling the edge function
# Usage: .\scripts\test-diversity-curl.ps1

# Get the project URL and anon key from Supabase
$PROJECT_URL = if ($env:SUPABASE_URL) { $env:SUPABASE_URL } else { "https://wqwhlbmsafgjlsjujuel.supabase.co" }
$ANON_KEY = $env:SUPABASE_ANON_KEY

if (-not $ANON_KEY) {
  Write-Host "❌ SUPABASE_ANON_KEY not set. Please set it in your environment or .env file" -ForegroundColor Red
  exit 1
}

Write-Host "🧪 Testing Agent Reply Diversity" -ForegroundColor Cyan
Write-Host "📡 Calling edge function: test-agent-diversity" -ForegroundColor Cyan
Write-Host ""

$response = Invoke-RestMethod -Uri "${PROJECT_URL}/functions/v1/test-agent-diversity" `
  -Method POST `
  -Headers @{
    "Authorization" = "Bearer ${ANON_KEY}"
    "Content-Type" = "application/json"
  }

$response | ConvertTo-Json -Depth 10

Write-Host ""
Write-Host "✅ Test complete!" -ForegroundColor Green
