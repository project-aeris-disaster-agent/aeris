#!/usr/bin/env node

/**
 * Automated Vercel Environment Variable Fix Script (Node.js)
 * Cross-platform script to fix all Vercel environment variable issues
 * 
 * Usage:
 *   node scripts/fix-vercel-env.js
 *   node scripts/fix-vercel-env.js --twitter-client-id "ID" --production-url "https://app.vercel.app"
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
let twitterClientId = '';
let productionUrl = 'https://sonara-4psnws748-agent-aeris-projects.vercel.app';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--twitter-client-id' && args[i + 1]) {
    twitterClientId = args[i + 1];
    i++;
  } else if (args[i] === '--production-url' && args[i + 1]) {
    productionUrl = args[i + 1];
    i++;
  }
}

console.log('\n🤖 Automated Vercel Environment Variable Fix\n');
console.log('='.repeat(80));

// Step 1: Pull environment variables
console.log('\n📥 Step 1: Pulling environment variables from Vercel...');
try {
  execSync('npx vercel env pull .env.vercel-temp', { stdio: 'ignore', cwd: process.cwd() });
} catch (error) {
  console.error('❌ Failed to pull environment variables. Make sure you are logged in: vercel login');
  process.exit(1);
}

if (!existsSync('.env.vercel-temp')) {
  console.error('❌ Failed to create .env.vercel-temp file');
  process.exit(1);
}

console.log('✅ Environment variables pulled successfully');

// Step 2: Read and clean variables
console.log('\n🧹 Step 2: Cleaning environment variables...\n');

const envContent = readFileSync('.env.vercel-temp', 'utf-8');
const fixes = {};
const lines = envContent.split('\n');

for (const line of lines) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (!match) continue;
  
  const varName = match[1].trim();
  const rawValue = match[2];
  
  if (!varName.startsWith('VITE_')) continue;
  
  // Clean the value - more aggressive cleaning
  let cleaned = rawValue.trim()
    .replace(/^["']+/g, '')  // Remove leading quotes (all types)
    .replace(/["']+$/g, '')   // Remove trailing quotes (all types)
    .replace(/\\r\\n/g, '')  // Remove \r\n
    .replace(/\\n/g, '')     // Remove \n
    .replace(/\\r/g, '')     // Remove \r
    .replace(/["']/g, '')    // Remove any remaining quotes
    .trim();
  
  // Apply specific fixes
  switch (varName) {
    case 'VITE_TWITTER_REDIRECT_URI':
      if (cleaned.includes('localhost') || cleaned === '') {
        cleaned = `${productionUrl}/auth/twitter/callback`;
        console.log(`  🔧 ${varName}: Fixed localhost URL`);
      }
      break;
      
    case 'VITE_TWITTER_CLIENT_ID':
      if (cleaned.length < 10 || cleaned === 'y') {
        if (twitterClientId) {
          cleaned = twitterClientId;
          console.log(`  🔧 ${varName}: Updated with provided client ID`);
        } else {
          console.log(`  ⚠️  ${varName}: Needs manual update (current: "${cleaned}")`);
          console.log(`     Run with: --twitter-client-id "YOUR_CLIENT_ID"`);
          continue; // Skip this one
        }
      }
      break;
  }
  
  if (cleaned !== rawValue.trim()) {
    fixes[varName] = cleaned;
    console.log(`  ✅ ${varName}: Needs cleaning`);
  }
}

if (Object.keys(fixes).length === 0) {
  console.log('✅ All variables are already clean!');
  unlinkSync('.env.vercel-temp');
  process.exit(0);
}

// Step 3: Display what will be fixed
console.log(`\n📋 Step 3: Found ${Object.keys(fixes).length} variables to fix\n`);
console.log('='.repeat(80));

for (const [varName, newValue] of Object.entries(fixes)) {
  console.log(`\n  ${varName}:`);
  console.log(`    New value: ${newValue.substring(0, 60)}${newValue.length > 60 ? '...' : ''}`);
}

// Step 4: Update variables
console.log('\n🚀 Step 4: Updating variables in Vercel...\n');

const environments = ['production', 'preview', 'development'];
let updated = 0;
let failed = 0;

for (const [varName, newValue] of Object.entries(fixes)) {
  console.log(`Updating ${varName}...`);
  
  for (const env of environments) {
    try {
      // Remove old variable
      execSync(`npx vercel env rm ${varName} ${env} --yes`, { stdio: 'ignore' });
      
      // Add new variable
      execSync(`echo "${newValue}" | npx vercel env add ${varName} ${env}`, { stdio: 'ignore' });
      
      console.log(`  ✅ ${env}`);
      updated++;
    } catch (error) {
      console.log(`  ❌ ${env} failed`);
      failed++;
    }
  }
}

// Step 5: Summary
console.log('\n' + '='.repeat(80));
console.log(`\n📊 Summary: ${updated} updated, ${failed} failed`);

// Cleanup
unlinkSync('.env.vercel-temp');

console.log('\n✨ Done! Redeploy with: npx vercel --prod\n');

