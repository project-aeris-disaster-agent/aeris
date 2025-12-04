// src/services/twitterOAuth.ts
// PKCE utilities for Twitter OAuth 2.0

function base64URLEncode(str: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return await crypto.subtle.digest('SHA-256', data);
}

export interface TwitterOAuthConfig {
  clientId: string;
  redirectUri: string;
  scopes?: string[];
}

export class TwitterOAuthService {
  private config: TwitterOAuthConfig;

  constructor(config: TwitterOAuthConfig) {
    this.config = config;
  }

  /**
   * Generate PKCE code verifier and challenge
   */
  async generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
    // Generate code verifier (43-128 characters)
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const codeVerifier = base64URLEncode(array.buffer);

    // Generate code challenge
    const codeChallenge = base64URLEncode(await sha256(codeVerifier));

    return { codeVerifier, codeChallenge };
  }

  /**
   * Generate random state for CSRF protection
   */
  generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return base64URLEncode(array.buffer);
  }

  /**
   * Get Twitter OAuth authorization URL
   * 
   * Note: Twitter OAuth 2.0 will always show the login screen on FIRST-TIME authorization,
   * even if the user is already logged into Twitter. This is a security feature by Twitter.
   * After the first authorization, subsequent authorizations should skip the login screen
   * if the user is still logged in and has previously authorized the app.
   */
  async getAuthorizationUrl(): Promise<{
    url: string;
    codeVerifier: string;
    state: string;
  }> {
    const { codeVerifier, codeChallenge } = await this.generatePKCE();
    const state = this.generateState();

    // Store code verifier and state in sessionStorage
    sessionStorage.setItem('twitter_code_verifier', codeVerifier);
    sessionStorage.setItem('twitter_state', state);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: (this.config.scopes || ['tweet.read', 'users.read', 'offline.access']).join(' '),
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      // Twitter OAuth 2.0 doesn't support 'prompt' parameter
      // First-time authorization will always show login screen (Twitter security feature)
    });

    const url = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;

    // Debug logging (remove in production)
    if (import.meta.env.DEV) {
      console.log('🔗 Twitter OAuth URL:', url.substring(0, 100) + '...');
      console.log('📍 Redirect URI being used:', this.config.redirectUri);
    }

    return { url, codeVerifier, state };
  }

  /**
   * Get stored code verifier from sessionStorage
   */
  getStoredCodeVerifier(): string | null {
    return sessionStorage.getItem('twitter_code_verifier');
  }

  /**
   * Get stored state from sessionStorage
   */
  getStoredState(): string | null {
    return sessionStorage.getItem('twitter_state');
  }

  /**
   * Clear stored OAuth data
   */
  clearStoredData(): void {
    sessionStorage.removeItem('twitter_code_verifier');
    sessionStorage.removeItem('twitter_state');
  }

  /**
   * Extract authorization code from callback URL
   */
  parseCallbackUrl(url: string): { code: string | null; state: string | null; error: string | null } {
    const urlObj = new URL(url);
    const code = urlObj.searchParams.get('code');
    const state = urlObj.searchParams.get('state');
    const error = urlObj.searchParams.get('error');

    return { code, state, error };
  }
}

// Singleton instance
let twitterOAuthInstance: TwitterOAuthService | null = null;

export function getTwitterOAuthService(): TwitterOAuthService {
  if (!twitterOAuthInstance) {
    const clientId = import.meta.env.VITE_TWITTER_CLIENT_ID;
    // Always use the environment variable if set, otherwise fall back to current origin
    // This ensures the redirect URI matches what's configured in Twitter Developer Portal
    const redirectUri = import.meta.env.VITE_TWITTER_REDIRECT_URI || `${window.location.origin}/auth/twitter/callback`;
    const scopes = import.meta.env.VITE_TWITTER_SCOPES?.split(',') || ['tweet.read', 'users.read', 'offline.access'];

    if (!clientId) {
      throw new Error('VITE_TWITTER_CLIENT_ID is not set in environment variables');
    }

    // Always log in production to help debug OAuth issues
    console.log('🔐 Twitter OAuth Config:', {
      clientId: clientId.substring(0, 10) + '...',
      redirectUri,
      scopes,
      currentOrigin: window.location.origin,
      hasEnvRedirectUri: !!import.meta.env.VITE_TWITTER_REDIRECT_URI,
    });

    twitterOAuthInstance = new TwitterOAuthService({
      clientId,
      redirectUri,
      scopes,
    });
  }

  return twitterOAuthInstance;
}

