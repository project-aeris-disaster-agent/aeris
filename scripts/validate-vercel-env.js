#!/usr/bin/env node

/**
 * Environment Variable Validation Script
 * 
 * This script helps identify common issues with Vercel environment variables:
 * - Quotes around values
 * - Trailing/leading whitespace
 * - Invalid URL formats
 * - Missing required variables
 * - Format issues
 */

const requiredVars = {
  'VITE_SUPABASE_URL': {
    type: 'url',
    example: 'https://wqwhlbmsafgjlsjujuel.supabase.co',
    description: 'Supabase project URL',
    validation: (value) => {
      if (!value) return { valid: false, error: 'Missing' };
      const trimmed = value.trim().replace(/^["']|["']$/g, '');
      try {
        const url = new URL(trimmed);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          return { valid: false, error: 'Must be HTTP or HTTPS URL' };
        }
        if (!trimmed.includes('.supabase.co')) {
          return { valid: false, error: 'Should be a Supabase URL' };
        }
        return { valid: true, cleaned: trimmed };
      } catch {
        return { valid: false, error: 'Invalid URL format' };
      }
    }
  },
  'VITE_SUPABASE_ANON_KEY': {
    type: 'jwt',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Supabase anonymous key (JWT)',
    validation: (value) => {
      if (!value) return { valid: false, error: 'Missing' };
      const trimmed = value.trim().replace(/^["']|["']$/g, '');
      if (trimmed.length < 50) {
        return { valid: false, error: 'Key seems too short' };
      }
      if (!trimmed.startsWith('eyJ')) {
        return { valid: false, error: 'JWT should start with eyJ' };
      }
      return { valid: true, cleaned: trimmed };
    }
  },
  'VITE_TWITTER_CLIENT_ID': {
    type: 'string',
    example: 'TGtVM2pMb3M0WFlnY3gyekdpa1I6MTpjaQ',
    description: 'Twitter OAuth Client ID',
    validation: (value) => {
      if (!value) return { valid: false, error: 'Missing' };
      const trimmed = value.trim().replace(/^["']|["']$/g, '');
      if (trimmed.length < 10) {
        return { valid: false, error: 'Client ID seems too short' };
      }
      if (trimmed.includes('"') || trimmed.includes("'")) {
        return { valid: false, error: 'Contains quotes' };
      }
      if (trimmed.includes('\n') || trimmed.includes('\r')) {
        return { valid: false, error: 'Contains newlines' };
      }
      return { valid: true, cleaned: trimmed };
    }
  },
  'VITE_TWITTER_REDIRECT_URI': {
    type: 'url',
    example: 'https://your-app.vercel.app/auth/twitter/callback',
    description: 'Twitter OAuth redirect URI',
    validation: (value) => {
      if (!value) return { valid: false, error: 'Missing' };
      const trimmed = value.trim().replace(/^["']|["']$/g, '');
      try {
        const url = new URL(trimmed);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          return { valid: false, error: 'Must be HTTP or HTTPS URL' };
        }
        if (!trimmed.endsWith('/auth/twitter/callback')) {
          return { valid: false, error: 'Should end with /auth/twitter/callback' };
        }
        return { valid: true, cleaned: trimmed };
      } catch {
        return { valid: false, error: 'Invalid URL format' };
      }
    }
  },
  'VITE_TWITTER_SCOPES': {
    type: 'csv',
    example: 'tweet.read,users.read,offline.access,tweet.write',
    description: 'Twitter OAuth scopes (comma-separated)',
    validation: (value) => {
      if (!value) return { valid: false, error: 'Missing' };
      const trimmed = value.trim().replace(/^["']|["']$/g, '');
      const scopes = trimmed.split(',').map(s => s.trim()).filter(Boolean);
      const requiredScopes = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'];
      const missing = requiredScopes.filter(s => !scopes.includes(s));
      if (missing.length > 0) {
        return { valid: false, error: `Missing required scopes: ${missing.join(', ')}` };
      }
      if (trimmed.includes('"') || trimmed.includes("'")) {
        return { valid: false, error: 'Contains quotes' };
      }
      return { valid: true, cleaned: trimmed };
    }
  }
};

const optionalVars = {
  'VITE_GROK_API_KEY': {
    type: 'string',
    description: 'Grok API key (optional)',
  },
  'VITE_GROK_API_URL': {
    type: 'url',
    description: 'Grok API URL (optional)',
    default: 'https://api.x.ai/v1'
  },
  'VITE_API_BASE_URL': {
    type: 'url',
    description: 'API base URL (optional)',
  }
};

function validateValue(varName, varConfig, value) {
  if (!value) {
    return {
      name: varName,
      status: 'missing',
      error: 'Variable not set',
      recommendation: `Set ${varName} in Vercel Dashboard → Settings → Environment Variables`
    };
  }

  const result = varConfig.validation(value);
  
  if (!result.valid) {
    return {
      name: varName,
      status: 'invalid',
      error: result.error,
      currentValue: value.length > 50 ? value.substring(0, 50) + '...' : value,
      hasQuotes: value.includes('"') || value.includes("'"),
      hasWhitespace: value !== value.trim(),
      recommendation: `Fix ${varName} in Vercel Dashboard. Remove quotes and whitespace.`
    };
  }

  const cleaned = result.cleaned;
  const needsCleaning = cleaned !== value;

  return {
    name: varName,
    status: needsCleaning ? 'needs_cleaning' : 'valid',
    error: needsCleaning ? 'Contains quotes or whitespace' : null,
    currentValue: value.length > 50 ? value.substring(0, 50) + '...' : value,
    cleanedValue: cleaned.length > 50 ? cleaned.substring(0, 50) + '...' : cleaned,
    hasQuotes: value.includes('"') || value.includes("'"),
    hasWhitespace: value !== value.trim(),
    recommendation: needsCleaning 
      ? `Update ${varName} in Vercel to remove quotes/whitespace. Use: ${cleaned.substring(0, 80)}...`
      : 'Value is correct'
  };
}

function printReport(results) {
  console.log('\n🔍 Environment Variable Validation Report\n');
  console.log('='.repeat(80));
  
  const issues = results.filter(r => r.status !== 'valid');
  const valid = results.filter(r => r.status === 'valid');

  if (valid.length > 0) {
    console.log('\n✅ VALID VARIABLES:');
    valid.forEach(r => {
      console.log(`   ✓ ${r.name}`);
    });
  }

  if (issues.length > 0) {
    console.log('\n❌ ISSUES FOUND:');
    issues.forEach(r => {
      console.log(`\n   ${r.name}:`);
      console.log(`   Status: ${r.status.toUpperCase()}`);
      if (r.error) console.log(`   Error: ${r.error}`);
      if (r.currentValue) {
        console.log(`   Current: ${r.currentValue}`);
        if (r.hasQuotes) console.log(`   ⚠️  Contains quotes!`);
        if (r.hasWhitespace) console.log(`   ⚠️  Has leading/trailing whitespace!`);
      }
      if (r.cleanedValue) {
        console.log(`   Should be: ${r.cleanedValue}`);
      }
      if (r.recommendation) {
        console.log(`   💡 ${r.recommendation}`);
      }
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\nSummary: ${valid.length} valid, ${issues.length} with issues\n`);
  
  if (issues.length > 0) {
    console.log('📝 TO FIX:');
    console.log('1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables');
    console.log('2. For each variable with issues:');
    console.log('   - Click to edit');
    console.log('   - Remove ALL quotes (single and double)');
    console.log('   - Remove leading/trailing whitespace');
    console.log('   - Save');
    console.log('3. Redeploy your project\n');
  }
}

// Main execution
async function main() {
  console.log('🔍 Vercel Environment Variable Validator\n');
  console.log('Note: This script validates based on common patterns.');
  console.log('To check actual values, you need to:');
  console.log('1. Pull env vars: vercel env pull .env.local');
  console.log('2. Or check in Vercel Dashboard\n');

  // Check if we can read from .env.local (if pulled)
  const fs = await import('fs');
  const path = await import('path');
  
  const envFiles = ['.env.local', '.env.vercel', '.env'];
  let envVars = {};

  for (const file of envFiles) {
      const filePath = path.default.join(process.cwd(), file);
      if (fs.default.existsSync(filePath)) {
        console.log(`📄 Reading from ${file}...`);
        const content = fs.default.readFileSync(filePath, 'utf-8');
      content.split('\n').forEach(line => {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim();
          if (key.startsWith('VITE_')) {
            envVars[key] = value;
          }
        }
      });
    }
  }

  if (Object.keys(envVars).length === 0) {
    console.log('\n⚠️  No environment variables found in local files.');
    console.log('To validate your Vercel environment variables:');
    console.log('  1. Run: vercel env pull .env.local');
    console.log('  2. Then run this script again\n');
    console.log('Or check manually in Vercel Dashboard:\n');
    
    // Print validation guide
    console.log('REQUIRED VARIABLES:');
    Object.entries(requiredVars).forEach(([name, config]) => {
      console.log(`\n  ${name}:`);
      console.log(`    Type: ${config.type}`);
      console.log(`    Example: ${config.example}`);
      console.log(`    Description: ${config.description}`);
    });
    
    return;
  }

  // Validate all required variables
  const results = [];
  for (const [varName, varConfig] of Object.entries(requiredVars)) {
    const value = envVars[varName];
    results.push(validateValue(varName, varConfig, value));
  }

  printReport(results);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('validate-vercel-env.js')) {
  main().catch(console.error);
}

export { validateValue, requiredVars, optionalVars };

