#!/usr/bin/env node
/**
 * Script to set up Vercel environment variables using Vercel CLI
 * 
 * Usage:
 *   node scripts/setup-vercel-env.js
 * 
 * This script will prompt for values and set them in Vercel for all environments
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function execCommand(command, options = {}) {
  try {
    const result = execSync(command, { 
      encoding: 'utf-8', 
      stdio: options.stdio || 'pipe',
      ...options 
    });
    return { success: true, output: result };
  } catch (error) {
    const errorOutput = error.stderr?.toString() || error.stdout?.toString() || error.message || '';
    if (options.stdio === 'inherit') {
      // If stdio is inherit, error is already shown, but we still need to throw
      throw error;
    }
    return { success: false, error: errorOutput, code: error.status || error.code };
  }
}

async function setEnvVar(name, value, env) {
  // Escape value for shell command (handle special characters)
  const escapedValue = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`');
  const command = `echo "${escapedValue}" | vercel env add ${name} ${env}`;
  
  const result = execCommand(command, { stdio: 'pipe' });
  
  if (result.success) {
    return { success: true, message: 'Added' };
  }
  
  const errorOutput = result.error || '';
  
  // Check if variable already exists
  if (errorOutput.includes('already exists') || errorOutput.includes('has already been added')) {
    try {
      // Remove existing variable first (use --yes flag for non-interactive)
      const removeResult = execCommand(`vercel env rm ${name} ${env} --yes`, { stdio: 'pipe' });
      
      if (!removeResult.success && !removeResult.error.includes('not found')) {
        return { success: false, message: `Could not remove existing variable: ${removeResult.error}` };
      }
      
      // Wait a moment for removal to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Try to add again
      const addResult = execCommand(command, { stdio: 'pipe' });
      
      if (addResult.success) {
        return { success: true, message: 'Updated (removed and re-added)' };
      } else {
        return { success: false, message: `Could not re-add after removal: ${addResult.error}` };
      }
    } catch (removeError) {
      return { success: false, message: `Error during update: ${removeError.message || 'Unknown error'}` };
    }
  }
  
  return { success: false, message: errorOutput || 'Unknown error' };
}

// Environment variables to set
const envVars = [
  {
    name: 'VITE_SUPABASE_URL',
    description: 'Supabase Project URL',
    defaultValue: 'https://wqwhlbmsafgjlsjujuel.supabase.co',
    required: true,
  },
  {
    name: 'VITE_SUPABASE_ANON_KEY',
    description: 'Supabase Anonymous Key',
    defaultValue: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indxd2hsYm1zYWZnamxzanVqdWVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2ODU0MjIsImV4cCI6MjA4MDI2MTQyMn0.yzj6nW3_bkDvACHtNDZKRdNrtE5umpFp0wysvnHXbmI',
    required: true,
  },
  {
    name: 'VITE_TWITTER_CLIENT_ID',
    description: 'Twitter OAuth Client ID',
    defaultValue: '',
    required: true,
  },
  {
    name: 'VITE_TWITTER_REDIRECT_URI',
    description: 'Twitter OAuth Redirect URI (will be updated after first deployment)',
    defaultValue: '',
    required: true,
    note: 'Update this after deployment with your actual Vercel URL',
  },
  {
    name: 'VITE_TWITTER_SCOPES',
    description: 'Twitter OAuth Scopes',
    defaultValue: 'tweet.read,users.read,offline.access,tweet.write',
    required: false,
  },
];

const environments = ['production', 'preview', 'development'];

async function setupEnvVars() {
  console.log('🚀 Vercel Environment Variables Setup\n');
  console.log('This script will help you set up environment variables in Vercel.\n');
  console.log('Make sure you are logged in to Vercel CLI: vercel login\n');

  // Check if logged in
  try {
    execCommand('vercel whoami', { stdio: 'pipe' });
  } catch (error) {
    console.error('❌ Not logged in to Vercel. Please run: vercel login');
    process.exit(1);
  }

  // Check if project is linked
  const vercelDir = join(process.cwd(), '.vercel');
  if (!existsSync(vercelDir)) {
    console.log('📦 Linking to Vercel project...');
    execCommand('vercel link', { stdio: 'inherit' });
  }

  console.log('\n📝 Setting up environment variables:\n');

  for (const envVar of envVars) {
    console.log(`\n${envVar.name}`);
    console.log(`  Description: ${envVar.description}`);
    if (envVar.note) {
      console.log(`  ⚠️  Note: ${envVar.note}`);
    }

    let value = envVar.defaultValue;
    
    if (envVar.required && !value) {
      value = await question(`  Enter value for ${envVar.name}: `);
    } else if (envVar.defaultValue) {
      const useDefault = await question(`  Use default value? (Y/n): `);
      if (useDefault.toLowerCase() !== 'n' && useDefault.toLowerCase() !== 'no') {
        value = envVar.defaultValue;
      } else {
        value = await question(`  Enter value for ${envVar.name}: `);
      }
    } else {
      value = await question(`  Enter value for ${envVar.name}: `);
    }

    if (!value && envVar.required) {
      console.log(`  ⚠️  Skipping ${envVar.name} (required but empty)`);
      continue;
    }

    if (!value) {
      console.log(`  ⏭️  Skipping ${envVar.name} (empty value)`);
      continue;
    }

    // Set for each environment
    for (const env of environments) {
      console.log(`  Setting for ${env}...`);
      const result = await setEnvVar(envVar.name, value, env);
      
      if (result.success) {
        console.log(`  ✅ ${result.message} for ${env}`);
      } else {
        console.log(`  ⚠️  Failed for ${env}: ${result.message}`);
        console.log(`  💡 You may need to manually update this variable in Vercel dashboard`);
      }
    }
  }

  console.log('\n✅ Environment variables setup complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Deploy your project: vercel --prod');
  console.log('2. Update VITE_TWITTER_REDIRECT_URI with your production URL');
  console.log('3. Add the callback URL to your Twitter App settings');
  console.log('\n');

  rl.close();
}

setupEnvVars().catch(error => {
  console.error('❌ Error:', error);
  rl.close();
  process.exit(1);
});

