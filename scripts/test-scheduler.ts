// Test script for Twitter automation scheduler
// Run with: npx tsx scripts/test-scheduler.ts

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wqwhlbmsafgjlsjujuel.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testScheduler() {
  console.log('🧪 Testing Twitter Automation Scheduler\n');

  // 1. Check for existing pending posts
  console.log('1️⃣ Checking for pending scheduled posts...');
  const { data: pendingPosts, error: fetchError } = await supabase
    .from('scheduled_posts')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(5);

  if (fetchError) {
    console.error('❌ Error fetching posts:', fetchError);
    return;
  }

  console.log(`   Found ${pendingPosts?.length || 0} pending posts due for execution\n`);

  if (!pendingPosts || pendingPosts.length === 0) {
    console.log('ℹ️  No pending posts to process. The scheduler will run when posts are scheduled.\n');
    console.log('✅ Scheduler is ready! You can:');
    console.log('   - Schedule a post via the UI');
    console.log('   - Wait for the daily cron job (9 AM UTC)');
    console.log('   - Manually trigger via: POST /api/cron/process-posts\n');
    return;
  }

  // 2. Test Edge Function directly
  console.log('2️⃣ Testing Edge Function directly...');
  const CRON_SECRET = process.env.CRON_SECRET || 'Sonara2026!';
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/process-scheduled-posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Edge Function executed successfully!');
      console.log(`   Processed: ${result.processed || 0} posts`);
      console.log(`   Succeeded: ${result.succeeded || 0}`);
      console.log(`   Failed: ${result.failed || 0}`);
      
      if (result.results && result.results.length > 0) {
        console.log('\n   Results:');
        result.results.forEach((r: any) => {
          console.log(`   - Post ${r.id} (${r.action}): ${r.status}${r.error ? ` - ${r.error}` : ''}`);
        });
      }
    } else {
      console.error('❌ Edge Function error:', result);
    }
  } catch (error) {
    console.error('❌ Error calling Edge Function:', error);
  }

  console.log('\n✅ Test complete!');
}

testScheduler().catch(console.error);

