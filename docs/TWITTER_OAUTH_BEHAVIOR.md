# Twitter OAuth 2.0 Behavior Notes

## Login Screen Behavior

**Important:** Twitter OAuth 2.0 will **always show the login screen** on **first-time authorization** of your app, even if the user is already logged into Twitter in the same browser.

### Why This Happens

Twitter implements this as a security measure:
- Ensures the user explicitly authorizes your app
- Prevents unauthorized app access
- Verifies user identity before granting permissions

### Expected Behavior

1. **First-Time Authorization:**
   - User clicks "Sign in with X"
   - Twitter shows login screen (even if already logged in)
   - User enters credentials or selects account
   - Twitter shows authorization screen
   - User authorizes the app
   - Redirects back to your app

2. **Subsequent Authorizations:**
   - If user is still logged into Twitter
   - And has previously authorized your app
   - Twitter should skip the login screen
   - Show authorization screen directly
   - Or auto-approve if permissions haven't changed

### Twitter OAuth 2.0 Limitations

Unlike other OAuth providers (Google, GitHub), Twitter OAuth 2.0:
- **Does NOT support** the `prompt` parameter
- **Does NOT support** silent authentication (`prompt=none`)
- **Always requires** explicit user interaction on first authorization

### Workarounds

Unfortunately, there's no way to completely skip the login screen on first authorization. However:

1. **After First Authorization:** Users won't need to log in again if:
   - They remain logged into Twitter
   - They haven't revoked app access
   - The authorization hasn't expired

2. **User Experience:** You can:
   - Add a message explaining this is a one-time step
   - Show a loading state during the OAuth flow
   - Provide clear instructions

### Testing

To test if subsequent authorizations skip login:

1. Complete first authorization (will show login screen)
2. Revoke app access in Twitter settings
3. Try authorizing again - should show login screen again
4. Complete authorization
5. Try authorizing again immediately - should skip login screen

### References

- [Twitter OAuth 2.0 Documentation](https://developer.twitter.com/en/docs/authentication/oauth-2-0)
- Twitter OAuth 2.0 doesn't support `prompt` parameter like OAuth 2.1 spec
- This is a known limitation of Twitter's implementation

