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
    return execSync(command, { 
      encoding: 'utf-8', 
      stdio: 'inherit',
      ...options 
    });
  } catch (error) {
    console.error(`Error executing: ${command}`);
    throw error;
  }
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
      try {
        console.log(`  Setting for ${env}...`);
        // Use echo to pipe value into vercel env add
        // Note: vercel env add is interactive, so we need to use a workaround
        const command = `echo "${value}" | vercel env add ${envVar.name} ${env}`;
        execCommand(command);
        console.log(`  ✅ Set for ${env}`);
      } catch (error) {
        console.log(`  ⚠️  Failed to set for ${env} (may already exist)`);
        // Try to update with --upsert if available
        try {
          execCommand(`echo "${value}" | vercel env add ${envVar.name} ${env} --upsert`);
          console.log(`  ✅ Updated for ${env}`);
        } catch (updateError) {
          console.log(`  ❌ Could not update for ${env}`);
        }
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

