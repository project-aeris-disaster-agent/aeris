// Test Grok API connectivity and status

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Try to load from .env.local or .env if they exist
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadEnvFile = (envPath: string) => {
  try {
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      envContent.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const match = trimmed.match(/^([^=]+)=(.*)$/);
          if (match && !process.env[match[1]]) {
            process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
          }
        }
      });
    }
  } catch {
    // Ignore errors loading env file
  }
};

// Try .env.local first, then .env
loadEnvFile(path.join(__dirname, '..', '.env.local'));
loadEnvFile(path.join(__dirname, '..', '.env'));

// Map VITE_ vars to server-side equivalents when needed
if (!process.env.GROK_API_KEY && process.env.VITE_GROK_API_KEY) {
  process.env.GROK_API_KEY = process.env.VITE_GROK_API_KEY;
}

const GROK_API_KEY = process.env.GROK_API_KEY || '';

if (!GROK_API_KEY) {
  console.error('❌ GROK_API_KEY not set');
  console.log('Please set GROK_API_KEY environment variable');
  process.exit(1);
}

async function testGrokAPI() {
  console.log('🔍 TESTING GROK API STATUS\n');
  console.log('='.repeat(80) + '\n');

  // Test 1: Simple API call
  console.log('📡 Test 1: Simple API Call\n');
  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-3-latest',
        messages: [
          { role: 'user', content: 'Say "API is working" if you can read this.' }
        ],
        max_tokens: 50,
        temperature: 0.7,
      }),
    });

    console.log(`Status Code: ${response.status}`);
    console.log(`Status Text: ${response.statusText}`);
    console.log(`Headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`\n❌ API Error Response:`);
      console.error(errorText);
      
      if (response.status === 401) {
        console.error('\n⚠️  Authentication failed. Check your API key.');
      } else if (response.status === 429) {
        console.error('\n⚠️  Rate limit exceeded. Wait before retrying.');
      } else if (response.status === 500) {
        console.error('\n⚠️  Server error. Grok API may be experiencing issues.');
      } else if (response.status === 503) {
        console.error('\n⚠️  Service unavailable. Grok API may be down.');
      }
      
      process.exit(1);
    }

    const data = await response.json();
    console.log(`\n✅ API Response:`);
    console.log(JSON.stringify(data, null, 2));
    
    const message = data.choices?.[0]?.message?.content;
    if (message) {
      console.log(`\n📝 Response Content: "${message}"`);
    }

    console.log('\n✅ Test 1 PASSED: API is responding correctly\n');
  } catch (error) {
    console.error('\n❌ Test 1 FAILED:');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    if (error instanceof Error && error.message.includes('fetch')) {
      console.error('\n⚠️  Network error. Check your internet connection.');
    }
    process.exit(1);
  }

  // Test 2: Check rate limits (make a few quick calls)
  console.log('📡 Test 2: Rate Limit Check (3 quick calls)\n');
  const rateLimitResults: Array<{ attempt: number; status: number; time: number }> = [];
  
  for (let i = 1; i <= 3; i++) {
    try {
      const startTime = Date.now();
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'grok-3-latest',
          messages: [
            { role: 'user', content: `Test ${i}` }
          ],
          max_tokens: 10,
          temperature: 0.7,
        }),
      });

      const endTime = Date.now();
      rateLimitResults.push({
        attempt: i,
        status: response.status,
        time: endTime - startTime
      });

      if (response.status === 429) {
        console.log(`⚠️  Attempt ${i}: Rate limited (${response.status})`);
        const retryAfter = response.headers.get('retry-after');
        if (retryAfter) {
          console.log(`   Retry after: ${retryAfter} seconds`);
        }
      } else if (response.ok) {
        console.log(`✅ Attempt ${i}: Success (${response.status}) - ${endTime - startTime}ms`);
      } else {
        console.log(`❌ Attempt ${i}: Error (${response.status})`);
      }

      // Small delay between calls
      if (i < 3) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`❌ Attempt ${i} failed:`, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  const allSuccessful = rateLimitResults.every(r => r.status === 200);
  if (allSuccessful) {
    console.log('\n✅ Test 2 PASSED: No rate limit issues detected\n');
  } else {
    console.log('\n⚠️  Test 2 WARNING: Some requests failed or were rate limited\n');
  }

  // Test 3: Check model availability
  console.log('📡 Test 3: Model Availability Check\n');
  const models = ['grok-3-latest', 'grok-4-latest', 'grok-2-1212', 'grok-2-vision-1212'];
  
  for (const model of models) {
    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'user', content: 'Test' }
          ],
          max_tokens: 5,
        }),
      });

      if (response.ok) {
        console.log(`✅ ${model}: Available`);
      } else {
        const errorText = await response.text();
        console.log(`❌ ${model}: ${response.status} - ${errorText.substring(0, 100)}`);
      }
    } catch (error) {
      console.log(`❌ ${model}: Error - ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY\n');
  console.log('✅ Grok API is accessible and responding');
  console.log('✅ Authentication is working');
  console.log('✅ Basic requests are successful\n');
  console.log('💡 If reply generation is still failing, the issue is likely:');
  console.log('   1. Banned phrase detection being too strict');
  console.log('   2. Response validation logic');
  console.log('   3. Timeout issues with longer prompts\n');
  console.log('='.repeat(80));
}

testGrokAPI().catch(console.error);
