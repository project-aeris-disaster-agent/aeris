# PowerShell script to automatically fix Vercel environment variables
# This script removes quotes, newlines, and fixes common issues

param(
    [string]$TwitterClientId = "",
    [string]$ProductionUrl = ""
)

Write-Host "`n🔧 Vercel Environment Variable Auto-Fix Script`n" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan

# Step 1: Pull current environment variables
Write-Host "`n📥 Step 1: Pulling current environment variables from Vercel..." -ForegroundColor Yellow
npx vercel env pull .env.vercel-temp 2>&1 | Out-Null

if (-not (Test-Path ".env.vercel-temp")) {
    Write-Host "❌ Failed to pull environment variables. Please check Vercel CLI access." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Environment variables pulled successfully`n" -ForegroundColor Green

# Step 2: Read and clean variables
Write-Host "🧹 Step 2: Cleaning environment variables..." -ForegroundColor Yellow

$envVars = @{}
$lines = Get-Content ".env.vercel-temp"

foreach ($line in $lines) {
    if ($line -match "^([^#=]+)=(.*)$") {
        $varName = $matches[1].Trim()
        $rawValue = $matches[2]
        
        if ($varName -like "VITE_*") {
            # Clean the value: remove quotes, newlines, whitespace
            $cleaned = $rawValue.Trim()
            # Remove leading quotes (both single and double)
            $cleaned = $cleaned -replace '^["'']+', ''
            # Remove trailing quotes (both single and double)  
            $cleaned = $cleaned -replace '["'']+$', ''
            # Remove newlines
            $cleaned = $cleaned -replace '\\r\\n', ''
            $cleaned = $cleaned -replace '\\n', ''
            $cleaned = $cleaned -replace '\\r', ''
            # Final trim
            $cleaned = $cleaned.Trim()
            
            $envVars[$varName] = @{
                Original = $rawValue
                Cleaned = $cleaned
                NeedsFix = ($cleaned -ne $rawValue.Trim())
            }
        }
    }
}

# Step 3: Apply fixes for specific variables
Write-Host "`n🔧 Step 3: Applying specific fixes..." -ForegroundColor Yellow

# Fix VITE_SUPABASE_URL
if ($envVars.ContainsKey("VITE_SUPABASE_URL")) {
    $url = $envVars["VITE_SUPABASE_URL"].Cleaned
    if ($url -notmatch "^https://.*\.supabase\.co$") {
        Write-Host "⚠️  VITE_SUPABASE_URL doesn't match expected pattern, using cleaned value" -ForegroundColor Yellow
    }
}

# Fix VITE_TWITTER_REDIRECT_URI
if ($envVars.ContainsKey("VITE_TWITTER_REDIRECT_URI")) {
    $redirectUri = $envVars["VITE_TWITTER_REDIRECT_URI"].Cleaned
    
    # If it's localhost or empty, prompt for production URL
    if ($redirectUri -match "localhost" -or $redirectUri -eq "") {
        if ($ProductionUrl -eq "") {
            Write-Host "`n⚠️  VITE_TWITTER_REDIRECT_URI is set to localhost or empty." -ForegroundColor Yellow
            Write-Host "Please provide your production URL (e.g., https://your-app.vercel.app)" -ForegroundColor Yellow
            $ProductionUrl = Read-Host "Production URL"
        }
        
        if ($ProductionUrl -ne "") {
            $envVars["VITE_TWITTER_REDIRECT_URI"].Cleaned = "$ProductionUrl/auth/twitter/callback"
            Write-Host "✅ Updated VITE_TWITTER_REDIRECT_URI to: $($envVars["VITE_TWITTER_REDIRECT_URI"].Cleaned)" -ForegroundColor Green
        }
    }
}

# Fix VITE_TWITTER_CLIENT_ID
if ($envVars.ContainsKey("VITE_TWITTER_CLIENT_ID")) {
    $clientId = $envVars["VITE_TWITTER_CLIENT_ID"].Cleaned
    
    # Check if it's obviously wrong (too short, just "y", etc.)
    if ($clientId.Length -lt 10 -or $clientId -eq "y") {
        if ($TwitterClientId -eq "") {
            Write-Host "`n⚠️  VITE_TWITTER_CLIENT_ID appears to be incorrect (current: '$clientId')" -ForegroundColor Yellow
            Write-Host "Please provide your actual Twitter Client ID" -ForegroundColor Yellow
            $TwitterClientId = Read-Host "Twitter Client ID"
        }
        
        if ($TwitterClientId -ne "") {
            $envVars["VITE_TWITTER_CLIENT_ID"].Cleaned = $TwitterClientId
            Write-Host "✅ Updated VITE_TWITTER_CLIENT_ID" -ForegroundColor Green
        }
    }
}

# Step 4: Display what will be fixed
Write-Host "`n📋 Step 4: Variables that will be updated:" -ForegroundColor Yellow
Write-Host "=" * 80 -ForegroundColor Cyan

$varsToFix = $envVars.GetEnumerator() | Where-Object { $_.Value.NeedsFix -or $_.Value.Cleaned -match "localhost" -or ($_.Key -eq "VITE_TWITTER_CLIENT_ID" -and $_.Value.Cleaned.Length -lt 10) }

if ($varsToFix.Count -eq 0) {
    Write-Host "✅ All variables are already clean!" -ForegroundColor Green
    Remove-Item ".env.vercel-temp" -Force
    exit 0
}

foreach ($var in $varsToFix) {
    Write-Host "`n  $($var.Key):" -ForegroundColor Yellow
    Write-Host "    Before: $($var.Value.Original.Substring(0, [Math]::Min(60, $var.Value.Original.Length)))..." -ForegroundColor Red
    Write-Host "    After:  $($var.Value.Cleaned.Substring(0, [Math]::Min(60, $var.Value.Cleaned.Length)))..." -ForegroundColor Green
}

# Step 5: Confirm before updating
Write-Host "`n" + ("=" * 80) -ForegroundColor Cyan
$confirm = Read-Host "`nDo you want to update these variables in Vercel? (y/N)"

if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "`n❌ Cancelled. No changes made." -ForegroundColor Yellow
    Remove-Item ".env.vercel-temp" -Force
    exit 0
}

# Step 6: Update variables in Vercel
Write-Host "`n🚀 Step 5: Updating variables in Vercel..." -ForegroundColor Yellow

$environments = @("production", "preview", "development")
$updated = 0
$failed = 0

foreach ($var in $varsToFix) {
    $varName = $var.Key
    $newValue = $var.Value.Cleaned
    
    foreach ($env in $environments) {
        Write-Host "  Updating $varName for $env..." -ForegroundColor Gray
        
        # Remove old variable
        $removeResult = npx vercel env rm $varName $env --yes 2>&1
        
        # Add new variable
        $addResult = echo $newValue | npx vercel env add $varName $env 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "    ✅ $env updated" -ForegroundColor Green
            $updated++
        } else {
            Write-Host "    ❌ $env failed: $addResult" -ForegroundColor Red
            $failed++
        }
    }
}

# Step 7: Summary
Write-Host "`n" + ("=" * 80) -ForegroundColor Cyan
Write-Host "`n📊 Summary:" -ForegroundColor Cyan
Write-Host "  ✅ Updated: $updated variables" -ForegroundColor Green
if ($failed -gt 0) {
    Write-Host "  ❌ Failed: $failed variables" -ForegroundColor Red
}

# Cleanup
Remove-Item ".env.vercel-temp" -Force

Write-Host "`n✨ Done! Variables have been updated in Vercel." -ForegroundColor Green
Write-Host "💡 Next step: Redeploy your project with: npx vercel --prod`n" -ForegroundColor Yellow

