# Twitter OAuth Implementation Guide

## ✅ Frontend Implementation Complete

The Twitter OAuth 2.0 flow has been implemented on the frontend with PKCE (Proof Key for Code Exchange) for enhanced security.

## Files Created/Modified

### New Files
1. **`src/services/twitterOAuth.ts`**
   - Twitter OAuth service with PKCE support
   - Generates code verifier and challenge
   - Manages state for CSRF protection
   - Handles OAuth URL generation

2. **`src/pages/TwitterCallbackPage.tsx`**
   - Handles OAuth callback from Twitter
   - Validates state parameter
   - Exchanges authorization code for tokens (via backend API)
   - Provides user feedback during authentication

### Modified Files
1. **`src/components/NewAuthCard.tsx`**
   - Added "Sign in with X" button
   - Integrated Twitter OAuth flow
   - Added loading states for Twitter authentication

2. **`src/App.tsx`**
   - Added route for `/auth/twitter/callback`

## Environment Variables Required

Add these to your `.env.local` and `.env` files:

```env
# Twitter OAuth 2.0 (Frontend - must start with VITE_)
VITE_TWITTER_CLIENT_ID=your_client_id_here
VITE_TWITTER_REDIRECT_URI=http://localhost:3000/auth/twitter/callback
VITE_TWITTER_SCOPES=tweet.read,users.read,offline.access

# Backend API URL (for token exchange)
VITE_API_BASE_URL=http://localhost:8000/api
```

## How It Works

### 1. User Clicks "Sign in with X"
- Frontend generates PKCE code verifier and challenge
- Generates random state for CSRF protection
- Stores verifier and state in sessionStorage
- Redirects user to Twitter authorization page

### 2. User Authorizes on Twitter
- Twitter redirects back to `/auth/twitter/callback` with authorization code
- Frontend validates state parameter
- Sends code + verifier to backend API

### 3. Backend Token Exchange (Required)
**⚠️ This must be implemented on your backend server**

The backend endpoint `/api/auth/twitter/callback` must:
- Receive `code`, `codeVerifier`, and `state` from frontend
- Exchange authorization code for access/refresh tokens using Twitter API
- Validate state (should match frontend)
- Store tokens securely (encrypted, in database)
- Return access token to frontend (or set httpOnly cookie)

### 4. Frontend Receives Tokens
- Stores access token (consider using httpOnly cookies instead)
- Redirects user to dashboard

## Backend API Endpoint Required

You need to create a backend endpoint that handles the token exchange. Here's an example:

### Node.js/Express Example

```typescript
// POST /api/auth/twitter/callback
import express from 'express';
import fetch from 'node-fetch';

router.post('/auth/twitter/callback', async (req, res) => {
  try {
    const { code, codeVerifier, state } = req.body;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(
          `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: process.env.TWITTER_CLIENT_ID!,
        redirect_uri: process.env.TWITTER_REDIRECT_URI!,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      return res.status(400).json({ 
        message: error.error_description || 'Token exchange failed' 
      });
    }

    const tokens = await tokenResponse.json();

    // Fetch user profile
    const userResponse = await fetch('https://api.twitter.com/2/users/me', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
      },
    });

    const userData = await userResponse.json();

    // TODO: Create/update user in database
    // TODO: Store tokens securely (encrypted)
    // TODO: Create session/JWT token

    res.json({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      user: userData.data,
    });
  } catch (error) {
    console.error('Twitter callback error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
```

### Backend Environment Variables

```env
# Backend .env (NOT exposed to frontend)
TWITTER_CLIENT_ID=your_client_id_here
TWITTER_CLIENT_SECRET=your_client_secret_here
TWITTER_REDIRECT_URI=http://localhost:3000/auth/twitter/callback
```

## Security Best Practices

1. **Never expose `TWITTER_CLIENT_SECRET` to frontend**
   - Only use in backend environment variables
   - Token exchange MUST happen server-side

2. **Store tokens securely**
   - Encrypt tokens before storing in database
   - Use httpOnly cookies for refresh tokens
   - Access tokens can be in localStorage (but httpOnly cookies are better)

3. **Validate state parameter**
   - Prevents CSRF attacks
   - Always compare state from callback with stored state

4. **Use PKCE**
   - Already implemented in this solution
   - Required for OAuth 2.0 public clients

## Testing

1. **Set up environment variables** in `.env.local`
2. **Start your frontend**: `npm run dev`
3. **Set up backend API** with token exchange endpoint
4. **Click "Sign in with X"** button
5. **Authorize on Twitter**
6. **Verify callback** handles the response correctly

## Next Steps

1. ✅ Frontend OAuth flow - **COMPLETE**
2. ⏳ Backend token exchange endpoint - **REQUIRED**
3. ⏳ User database integration
4. ⏳ Session management
5. ⏳ Token refresh logic

## Troubleshooting

### "VITE_TWITTER_CLIENT_ID is not set"
- Make sure your `.env.local` file has `VITE_TWITTER_CLIENT_ID`
- Restart your dev server after adding environment variables

### "Failed to exchange authorization code"
- Check that backend API endpoint is running
- Verify `VITE_API_BASE_URL` points to correct backend
- Check backend logs for detailed error messages

### "Invalid state parameter"
- State validation failed - user may have navigated away
- Clear sessionStorage and try again

## References

- [Twitter OAuth 2.0 Documentation](https://developer.twitter.com/en/docs/authentication/oauth-2-0)
- [PKCE RFC 7636](https://tools.ietf.org/html/rfc7636)
- Your existing docs: `docs/TWITTER_API_V2.md`

