# PowerShell script to check Vercel environment variables for common issues
# Run: .\scripts\check-env-issues.ps1

Write-Host "`n🔍 Checking Vercel Environment Variables for Issues...`n" -ForegroundColor Cyan

# Check if .env.vercel-check exists
if (-not (Test-Path ".env.vercel-check")) {
    Write-Host "⚠️  .env.vercel-check not found. Pulling from Vercel..." -ForegroundColor Yellow
    npx vercel env pull .env.vercel-check
}

if (-not (Test-Path ".env.vercel-check")) {
    Write-Host "❌ Failed to pull environment variables. Please check Vercel CLI access." -ForegroundColor Red
    exit 1
}

Write-Host "📄 Reading .env.vercel-check...`n" -ForegroundColor Green

$issues = @()
$valid = @()

# Required variables with validation rules
$requiredVars = @{
    "VITE_SUPABASE_URL" = @{
        Type = "URL"
        Pattern = "^https://.*\.supabase\.co$"
        Example = "https://wqwhlbmsafgjlsjujuel.supabase.co"
    }
    "VITE_SUPABASE_ANON_KEY" = @{
        Type = "JWT"
        Pattern = "^eyJ"
        MinLength = 50
        Example = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
    "VITE_TWITTER_CLIENT_ID" = @{
        Type = "String"
        MinLength = 10
        Example = "TGtVM2pMb3M0WFlnY3gyekdpa1I6MTpjaQ"
    }
    "VITE_TWITTER_REDIRECT_URI" = @{
        Type = "URL"
        Pattern = ".*/auth/twitter/callback$"
        Example = "https://your-app.vercel.app/auth/twitter/callback"
    }
    "VITE_TWITTER_SCOPES" = @{
        Type = "CSV"
        RequiredValues = @("tweet.read", "tweet.write", "users.read", "offline.access")
        Example = "tweet.read,users.read,offline.access,tweet.write"
    }
}

# Read and parse .env file
$envContent = Get-Content ".env.vercel-check" -Raw
$lines = $envContent -split "`n"

foreach ($line in $lines) {
    if ($line -match "^([^#=]+)=(.*)$") {
        $varName = $matches[1].Trim()
        $varValue = $matches[2].Trim()
        
        if ($varName -like "VITE_*") {
            $config = $requiredVars[$varName]
            
            if ($null -eq $config) {
                continue
            }
            
            $hasQuotes = $varValue -match '^["'']|["'']$'
            $hasWhitespace = $varValue -ne $varValue.Trim()
            $cleanedValue = $varValue.Trim() -replace '^["'']|["'']$', ''
            
            $issue = @{
                Name = $varName
                Value = $varValue
                Cleaned = $cleanedValue
                HasQuotes = $hasQuotes
                HasWhitespace = $hasWhitespace
                Issues = @()
            }
            
            # Check for quotes
            if ($hasQuotes) {
                $issue.Issues += "Contains quotes (single or double)"
            }
            
            # Check for whitespace
            if ($hasWhitespace) {
                $issue.Issues += "Has leading/trailing whitespace"
            }
            
            # Type-specific validation
            if ($config.Type -eq "URL") {
                try {
                    $uri = [System.Uri]$cleanedValue
                    if ($uri.Scheme -notmatch "^https?$") {
                        $issue.Issues += "Invalid URL scheme (must be http:// or https://)"
                    }
                    if ($config.Pattern -and $cleanedValue -notmatch $config.Pattern) {
                        $issue.Issues += "URL doesn't match expected pattern"
                    }
                } catch {
                    $issue.Issues += "Invalid URL format: $_"
                }
            }
            
            if ($config.Type -eq "JWT") {
                if ($cleanedValue.Length -lt $config.MinLength) {
                    $issue.Issues += "JWT seems too short (minimum $($config.MinLength) characters)"
                }
                if ($config.Pattern -and $cleanedValue -notmatch $config.Pattern) {
                    $issue.Issues += "JWT doesn't start with expected pattern ($($config.Pattern))"
                }
            }
            
            if ($config.Type -eq "String" -and $config.MinLength) {
                if ($cleanedValue.Length -lt $config.MinLength) {
                    $issue.Issues += "Value too short (minimum $($config.MinLength) characters)"
                }
            }
            
            if ($config.Type -eq "CSV") {
                $scopes = $cleanedValue -split "," | ForEach-Object { $_.Trim() } | Where-Object { $_ }
                $missing = $config.RequiredValues | Where-Object { $scopes -notcontains $_ }
                if ($missing.Count -gt 0) {
                    $issue.Issues += "Missing required scopes: $($missing -join ', ')"
                }
            }
            
            # Check for newlines
            if ($varValue -match "`r|`n") {
                $issue.Issues += "Contains newline characters"
            }
            
            if ($issue.Issues.Count -gt 0) {
                $issues += $issue
            } else {
                $valid += $varName
            }
        }
    }
}

# Print report
Write-Host "=" * 80 -ForegroundColor Cyan

if ($valid.Count -gt 0) {
    Write-Host "`n✅ VALID VARIABLES ($($valid.Count)):" -ForegroundColor Green
    foreach ($var in $valid) {
        Write-Host "   ✓ $var" -ForegroundColor Green
    }
}

if ($issues.Count -gt 0) {
    Write-Host "`n❌ ISSUES FOUND ($($issues.Count)):" -ForegroundColor Red
    foreach ($issue in $issues) {
        Write-Host "`n   $($issue.Name):" -ForegroundColor Yellow
        Write-Host "   Current value: $($issue.Value.Substring(0, [Math]::Min(60, $issue.Value.Length)))..." -ForegroundColor Gray
        foreach ($issueDetail in $issue.Issues) {
            Write-Host "   ⚠️  $issueDetail" -ForegroundColor Red
        }
        if ($issue.Cleaned -ne $issue.Value) {
            Write-Host "   Should be: $($issue.Cleaned.Substring(0, [Math]::Min(60, $issue.Cleaned.Length)))..." -ForegroundColor Green
        }
        Write-Host "   Example: $($requiredVars[$issue.Name].Example)" -ForegroundColor Cyan
    }
} else {
    Write-Host "`n✅ All environment variables are valid!" -ForegroundColor Green
}

Write-Host "`n" + ("=" * 80) -ForegroundColor Cyan

if ($issues.Count -gt 0) {
    Write-Host "`n📝 TO FIX:" -ForegroundColor Yellow
    Write-Host "1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables"
    Write-Host "2. For each variable with issues:"
    Write-Host "   - Click to edit"
    Write-Host "   - Remove ALL quotes (single and double)"
    Write-Host "   - Remove leading/trailing whitespace"
    Write-Host "   - Remove any newline characters"
    Write-Host "   - Save"
    Write-Host "3. Redeploy your project`n"
}

# Cleanup
if (Test-Path ".env.vercel-check") {
    Write-Host "🧹 Cleaning up .env.vercel-check..." -ForegroundColor Gray
    Remove-Item ".env.vercel-check" -Force
}

Write-Host ""

