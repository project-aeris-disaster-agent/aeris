# Fully automated script - fixes all issues without prompts
# Usage: .\scripts\fix-vercel-env-auto.ps1 -TwitterClientId "YOUR_ID" -ProductionUrl "https://your-app.vercel.app"

param(
    [Parameter(Mandatory=$false)]
    [string]$TwitterClientId = "",
    
    [Parameter(Mandatory=$false)]
    [string]$ProductionUrl = "https://sonara-4psnws748-agent-aeris-projects.vercel.app"
)

Write-Host "`n🤖 Automated Vercel Environment Variable Fix`n" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan

# Pull environment variables
Write-Host "`n📥 Pulling environment variables..." -ForegroundColor Yellow
npx vercel env pull .env.vercel-temp 2>&1 | Out-Null

if (-not (Test-Path ".env.vercel-temp")) {
    Write-Host "❌ Failed to pull environment variables" -ForegroundColor Red
    exit 1
}

# Read and process variables
$fixes = @{}
$lines = Get-Content ".env.vercel-temp"

foreach ($line in $lines) {
    if ($line -match "^([^#=]+)=(.*)$") {
        $varName = $matches[1].Trim()
        $rawValue = $matches[2]
        
        if ($varName -like "VITE_*") {
            # Clean value
            $cleaned = $rawValue.Trim() -replace '^["'']+', '' -replace '["'']+$', '' -replace '\\r\\n', '' -replace '\\n', '' -replace '\\r', ''
            $cleaned = $cleaned.Trim()
            
            # Apply specific fixes
            switch ($varName) {
                "VITE_TWITTER_REDIRECT_URI" {
                    if ($cleaned -match "localhost" -or $cleaned -eq "") {
                        $cleaned = "$ProductionUrl/auth/twitter/callback"
                    }
                }
                "VITE_TWITTER_CLIENT_ID" {
                    if ($cleaned.Length -lt 10 -or $cleaned -eq "y") {
                        if ($TwitterClientId -ne "") {
                            $cleaned = $TwitterClientId
                        } else {
                            Write-Host "⚠️  VITE_TWITTER_CLIENT_ID needs manual update - skipping" -ForegroundColor Yellow
                            continue
                        }
                    }
                }
            }
            
            if ($cleaned -ne $rawValue.Trim()) {
                $fixes[$varName] = $cleaned
            }
        }
    }
}

if ($fixes.Count -eq 0) {
    Write-Host "✅ All variables are clean!" -ForegroundColor Green
    Remove-Item ".env.vercel-temp" -Force
    exit 0
}

Write-Host "`n🔧 Found $($fixes.Count) variables to fix`n" -ForegroundColor Yellow

# Update variables
$environments = @("production", "preview", "development")
$updated = 0
$failed = 0

foreach ($varName in $fixes.Keys) {
    $newValue = $fixes[$varName]
    
    Write-Host "Updating $varName..." -ForegroundColor Cyan
    
    foreach ($env in $environments) {
        # Remove old
        npx vercel env rm $varName $env --yes 2>&1 | Out-Null
        
        # Add new
        $result = echo $newValue | npx vercel env add $varName $env 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ $env" -ForegroundColor Green
            $updated++
        } else {
            Write-Host "  ❌ $env failed" -ForegroundColor Red
            $failed++
        }
    }
}

# Summary
Write-Host "`n" + ("=" * 80) -ForegroundColor Cyan
Write-Host "📊 Summary: $updated updated, $failed failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Yellow" })

Remove-Item ".env.vercel-temp" -Force

Write-Host "`n✨ Done! Redeploy with: npx vercel --prod`n" -ForegroundColor Green

