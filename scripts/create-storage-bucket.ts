/**
 * Script to create Supabase storage bucket
 * Run with: npx tsx scripts/create-storage-bucket.ts
 * 
 * Note: This requires the service role key, not the anon key
 * You can get it from: Supabase Dashboard → Settings → API → service_role key
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wqwhlbmsafgjlsjujuel.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required');
  console.log('\n📝 To get your service role key:');
  console.log('1. Go to: https://supabase.com/dashboard/project/wqwhlbmsafgjlsjujuel/settings/api');
  console.log('2. Copy the "service_role" key (NOT the anon key)');
  console.log('3. Set it as: SUPABASE_SERVICE_ROLE_KEY=your_key_here');
  process.exit(1);
}

// Create admin client with service role key
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createStorageBucket() {
  console.log('🚀 Creating storage bucket: profile-photos...\n');

  try {
    // Check if bucket already exists
    const { data: existingBuckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Error listing buckets:', listError);
      return;
    }

    const bucketExists = existingBuckets?.some(bucket => bucket.id === 'profile-photos');
    
    if (bucketExists) {
      console.log('✅ Bucket "profile-photos" already exists!');
      return;
    }

    // Create the bucket
    const { data, error } = await supabaseAdmin.storage.createBucket('profile-photos', {
      public: true, // Make it publicly accessible
      fileSizeLimit: 5242880, // 5MB limit
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    });

    if (error) {
      console.error('❌ Error creating bucket:', error);
      return;
    }

    console.log('✅ Successfully created bucket "profile-photos"!');
    console.log('📦 Bucket details:', data);
    console.log('\n✅ Storage bucket setup complete!');
    console.log('🔐 RLS policies are already configured via migration.');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

createStorageBucket();

