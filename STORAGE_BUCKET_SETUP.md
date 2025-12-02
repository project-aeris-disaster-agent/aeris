# Storage Bucket Setup Guide

## Option 1: Via Supabase Dashboard (Easiest) ⭐ Recommended

1. **Go to Storage Dashboard:**
   - https://supabase.com/dashboard/project/wqwhlbmsafgjlsjujuel/storage/buckets

2. **Create New Bucket:**
   - Click "New bucket"
   - Name: `profile-photos`
   - **Public bucket**: ✅ Check this (makes it publicly accessible)
   - Click "Create bucket"

3. **Done!** ✅
   - RLS policies are already configured via migration
   - The bucket is ready to use

## Option 2: Via Script (Automated)

### Prerequisites
- Get your **service_role** key (NOT anon key):
  - Go to: https://supabase.com/dashboard/project/wqwhlbmsafgjlsjujuel/settings/api
  - Copy the `service_role` key (keep it secret!)

### Run the Script

1. **Set environment variable:**
   ```bash
   $env:SUPABASE_SERVICE_ROLE_KEY="your_service_role_key_here"
   ```

2. **Run the script:**
   ```bash
   node scripts/create-storage-bucket.js
   ```

   Or if you have tsx installed:
   ```bash
   npx tsx scripts/create-storage-bucket.ts
   ```

### What the Script Does
- ✅ Checks if bucket already exists
- ✅ Creates `profile-photos` bucket with public access
- ✅ Sets file size limit to 5MB
- ✅ Allows image types: JPEG, PNG, WebP, GIF

## Option 3: Via Supabase CLI

If you have Supabase CLI installed:

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref wqwhlbmsafgjlsjujuel

# Create bucket via CLI (if supported)
# Note: Storage buckets are typically created via Dashboard or API
```

## Verify Bucket Creation

After creating the bucket, verify it exists:

1. Go to: https://supabase.com/dashboard/project/wqwhlbmsafgjlsjujuel/storage/buckets
2. You should see `profile-photos` in the list
3. Click on it to see details

## RLS Policies

The following RLS policies are already configured (via migration `create_storage_buckets`):

- ✅ Users can upload their own profile photo
- ✅ Profile photos are publicly viewable
- ✅ Users can update their own profile photo
- ✅ Users can delete their own profile photo

## Usage in Code

Once the bucket is created, you can use it in your code:

```typescript
import { supabase } from '@/lib/supabase';

// Upload profile photo
const uploadPhoto = async (file: File, userId: string) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/avatar.${fileExt}`;
  
  const { data, error } = await supabase.storage
    .from('profile-photos')
    .upload(fileName, file);
    
  if (error) throw error;
  
  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('profile-photos')
    .getPublicUrl(fileName);
    
  return publicUrl;
};
```

---

**Recommended:** Use Option 1 (Dashboard) - it's the quickest and easiest! 🚀

