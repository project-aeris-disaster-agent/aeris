# PowerShell script to set up Vercel environment variables
# Usage: .\scripts\setup-vercel-env.ps1

Write-Host "🚀 Vercel Environment Variables Setup" -ForegroundColor Cyan
Write-Host ""

# Check if Vercel CLI is installed
try {
    $vercelVersion = vercel --version 2>&1
    Write-Host "✅ Vercel CLI found: $vercelVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Vercel CLI not found. Install with: npm install -g vercel" -ForegroundColor Red
    exit 1
}

# Check if logged in
try {
    vercel whoami | Out-Null
    Write-Host "✅ Logged in to Vercel" -ForegroundColor Green
} catch {
    Write-Host "❌ Not logged in. Please run: vercel login" -ForegroundColor Red
    exit 1
}

# Check if project is linked
if (-not (Test-Path ".vercel")) {
    Write-Host "📦 Linking to Vercel project..." -ForegroundColor Yellow
    vercel link
}

Write-Host ""
Write-Host "📝 Setting up environment variables:" -ForegroundColor Cyan
Write-Host ""

# Environment variables configuration
$envVars = @(
    @{
        Name = "VITE_SUPABASE_URL"
        Description = "Supabase Project URL"
        DefaultValue = "https://wqwhlbmsafgjlsjujuel.supabase.co"
        Required = $true
    },
    @{
        Name = "VITE_SUPABASE_ANON_KEY"
        Description = "Supabase Anonymous Key"
        DefaultValue = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indxd2hsYm1zYWZnamxzanVqdWVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2ODU0MjIsImV4cCI6MjA4MDI2MTQyMn0.yzj6nW3_bkDvACHtNDZKRdNrtE5umpFp0wysvnHXbmI"
        Required = $true
    },
    @{
        Name = "VITE_TWITTER_CLIENT_ID"
        Description = "Twitter OAuth Client ID"
        DefaultValue = ""
        Required = $true
    },
    @{
        Name = "VITE_TWITTER_REDIRECT_URI"
        Description = "Twitter OAuth Redirect URI"
        DefaultValue = ""
        Required = $true
        Note = "Update this after deployment with your actual Vercel URL"
    },
    @{
        Name = "VITE_TWITTER_SCOPES"
        Description = "Twitter OAuth Scopes"
        DefaultValue = "tweet.read,users.read,offline.access,tweet.write"
        Required = $false
    }
)

$environments = @("production", "preview", "development")

foreach ($envVar in $envVars) {
    Write-Host ""
    Write-Host "$($envVar.Name)" -ForegroundColor Yellow
    Write-Host "  Description: $($envVar.Description)"
    
    if ($envVar.Note) {
        Write-Host "  ⚠️  Note: $($envVar.Note)" -ForegroundColor Yellow
    }
    
    $value = $envVar.DefaultValue
    
    if ($envVar.Required -and -not $value) {
        $value = Read-Host "  Enter value for $($envVar.Name)"
    } elseif ($envVar.DefaultValue) {
        $useDefault = Read-Host "  Use default value? (Y/n)"
        if ($useDefault -ne "n" -and $useDefault -ne "N") {
            $value = $envVar.DefaultValue
        } else {
            $value = Read-Host "  Enter value for $($envVar.Name)"
        }
    } else {
        $value = Read-Host "  Enter value for $($envVar.Name)"
    }
    
    if (-not $value -and $envVar.Required) {
        Write-Host "  ⚠️  Skipping $($envVar.Name) (required but empty)" -ForegroundColor Yellow
        continue
    }
    
    if (-not $value) {
        Write-Host "  ⏭️  Skipping $($envVar.Name) (empty value)" -ForegroundColor Gray
        continue
    }
    
    # Set for each environment
    foreach ($env in $environments) {
        Write-Host "  Setting for $env..." -ForegroundColor Gray
        try {
            # Vercel CLI env add is interactive, so we pipe the value
            $value | vercel env add $envVar.Name $env 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  ✅ Set for $env" -ForegroundColor Green
            } else {
                Write-Host "  ⚠️  May already exist for $env, trying to update..." -ForegroundColor Yellow
                # Try to remove and re-add, or use update if available
                $value | vercel env add $envVar.Name $env 2>&1 | Out-Null
            }
        } catch {
            Write-Host "  ❌ Failed to set for $env" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "✅ Environment variables setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Deploy your project: vercel --prod"
Write-Host "2. Update VITE_TWITTER_REDIRECT_URI with your production URL"
Write-Host "3. Add the callback URL to your Twitter App settings"
Write-Host ""

