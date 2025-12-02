# Supabase Edge Function Setup for Twitter OAuth

## Overview

We use Supabase Edge Functions to securely handle Twitter OAuth token exchange. This keeps the `TWITTER_CLIENT_SECRET` secure on the server side.

## Prerequisites

1. Supabase CLI installed: `npm install -g supabase`
2. Logged into Supabase: `supabase login`
3. Linked to your project: `supabase link --project-ref wqwhlbmsafgjlsjujuel`

## Setup Steps

### 1. Initialize Supabase Functions (if not already done)

```bash
supabase functions new twitter-oauth-callback
supabase functions new twitter-refresh-token
```

### 2. Set Environment Variables

Set the Twitter credentials as Edge Function secrets:

```bash
# Set Twitter OAuth credentials
supabase secrets set TWITTER_CLIENT_ID=your_twitter_client_id
supabase secrets set TWITTER_CLIENT_SECRET=your_twitter_client_secret
```

### 3. Deploy Edge Functions

```bash
# Deploy the OAuth callback function
supabase functions deploy twitter-oauth-callback

# Deploy the refresh token function
supabase functions deploy twitter-refresh-token
```

### 4. Verify Deployment

Check your Supabase Dashboard → Edge Functions to see both functions deployed.

## Edge Functions Created

### 1. `twitter-oauth-callback`
- **Purpose**: Exchanges authorization code for access/refresh tokens
- **Endpoint**: `https://wqwhlbmsafgjlsjujuel.supabase.co/functions/v1/twitter-oauth-callback`
- **Method**: POST
- **Body**: 
  ```json
  {
    "code": "authorization_code",
    "code_verifier": "pkce_code_verifier",
    "redirect_uri": "http://localhost:5173/auth/twitter/callback"
  }
  ```
- **Returns**: Access token, refresh token, and user profile

### 2. `twitter-refresh-token`
- **Purpose**: Refreshes expired access tokens
- **Endpoint**: `https://wqwhlbmsafgjlsjujuel.supabase.co/functions/v1/twitter-refresh-token`
- **Method**: POST
- **Body**:
  ```json
  {
    "refresh_token": "refresh_token",
    "client_id": "twitter_client_id"
  }
  ```
- **Returns**: New access token and refresh token

## Testing Edge Functions

### Test OAuth Callback Function

```bash
curl -X POST \
  'https://wqwhlbmsafgjlsjujuel.supabase.co/functions/v1/twitter-oauth-callback' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "code": "test_code",
    "code_verifier": "test_verifier",
    "redirect_uri": "http://localhost:5173/auth/twitter/callback"
  }'
```

## Local Development

To test Edge Functions locally:

```bash
# Start Supabase locally
supabase start

# Serve functions locally
supabase functions serve twitter-oauth-callback --env-file .env.local
```

## Environment Variables Needed

Create a `.env.local` file for local development:

```env
TWITTER_CLIENT_ID=your_twitter_client_id
TWITTER_CLIENT_SECRET=your_twitter_client_secret
```

## Troubleshooting

### Function Not Found
- Ensure functions are deployed: `supabase functions list`
- Check function names match exactly

### Authentication Errors
- Verify secrets are set: `supabase secrets list`
- Check Twitter credentials are correct

### CORS Issues
- Edge Functions include CORS headers automatically
- Ensure your frontend URL is allowed

## Security Notes

- ✅ Client secret is stored securely in Supabase secrets
- ✅ Never expose client secret in frontend code
- ✅ Edge Functions handle all sensitive operations
- ✅ Tokens are stored in Supabase database (encrypted)

## Next Steps

After deploying Edge Functions:
1. Test the OAuth flow end-to-end
2. Verify tokens are stored in Supabase
3. Test token refresh functionality
4. Implement token refresh logic in your app

