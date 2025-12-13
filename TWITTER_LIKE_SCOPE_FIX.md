# Twitter Like Scope Fix

## 🔍 Problem Identified

**Issue:** LIKE actions failing with `Twitter API 403: Forbidden`

**Root Cause:** OAuth scopes were missing `like.read` and `like.write` permissions.

## ✅ Fix Applied

### Updated OAuth Scopes

**Before:**
```typescript
const defaultScopes = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'];
```

**After:**
```typescript
const defaultScopes = [
  'tweet.read', 
  'tweet.write', 
  'users.read', 
  'like.read',    // Read likes (for checking if already liked)
  'like.write',   // Like tweets (for agent mode)
  'offline.access'
];
```

## 📝 Files Changed

1. **`src/services/twitterOAuth.ts`**
   - Added `like.read` and `like.write` to default scopes
   - Updated scope parameter in OAuth URL generation

2. **`supabase/functions/twitter-oauth-callback/index.ts`**
   - Added verification for `like.write` scope
   - Added warning if like scopes are not granted

## 🚀 Next Steps

### 1. Re-authenticate Twitter Account

**Important:** Since you logged in with a different account, you need to reconnect Twitter to get the new scopes:

1. Go to **Auth page**
2. **Disconnect** Twitter (if connected)
3. **Reconnect** Twitter
4. This will request the new scopes including `like.write`

### 2. Verify Scopes in Twitter Developer Portal

1. Go to **Twitter Developer Portal**
   - https://developer.twitter.com/en/portal/dashboard
2. Navigate to your app → **Settings** → **User authentication settings**
3. Under **App permissions**, ensure:
   - ✅ Read tweets
   - ✅ Write tweets
   - ✅ Read users
   - ✅ **Like tweets** ← This is the key one!

### 3. Test Again

After re-authenticating:
1. Click "Connect Google Calendar" button
2. Check console logs
3. LIKE actions should now succeed ✅

## 🔍 How to Verify Scopes Were Granted

After re-authenticating, check the console logs. You should see:

```
📝 Scope analysis: {
  grantedScopes: ['tweet.read', 'tweet.write', 'users.read', 'like.read', 'like.write', 'offline.access'],
  hasWriteScope: true,
  hasLikeWriteScope: true,  ← Should be true
  hasLikeReadScope: true,    ← Should be true
  ...
}
```

If `hasLikeWriteScope` is `false`, you'll see a warning:
```
⚠️ WARNING: Twitter did NOT grant like.write scope! Like actions will fail.
```

## 📊 Expected Results After Fix

**Before:**
- ✅ Retweets: Success
- ❌ Likes: 403 Forbidden
- ✅ Comments: Success

**After (with new scopes):**
- ✅ Retweets: Success
- ✅ Likes: Success ← Fixed!
- ✅ Comments: Success

## ⚠️ Important Notes

1. **Existing tokens won't work** - You MUST re-authenticate to get new scopes
2. **Twitter app permissions** - Make sure your Twitter app has "Like tweets" permission enabled
3. **Scope verification** - The callback function now logs which scopes were granted

## 🐛 Troubleshooting

### If LIKE still fails after re-authenticating:

1. **Check Twitter Developer Portal:**
   - Verify "Like tweets" permission is enabled
   - App permissions should be "Read and Write" (not just "Read")

2. **Check Console Logs:**
   - Look for scope analysis in callback logs
   - Verify `hasLikeWriteScope: true`

3. **Check Token:**
   - Old tokens won't have new scopes
   - Must disconnect and reconnect to get fresh token

4. **Check Twitter API Status:**
   - Sometimes Twitter API has temporary issues
   - Try again after a few minutes

