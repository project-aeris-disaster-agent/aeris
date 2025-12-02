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
    });

    const url = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;

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
    const redirectUri = import.meta.env.VITE_TWITTER_REDIRECT_URI || `${window.location.origin}/auth/twitter/callback`;
    const scopes = import.meta.env.VITE_TWITTER_SCOPES?.split(',') || ['tweet.read', 'users.read', 'offline.access'];

    if (!clientId) {
      throw new Error('VITE_TWITTER_CLIENT_ID is not set in environment variables');
    }

    twitterOAuthInstance = new TwitterOAuthService({
      clientId,
      redirectUri,
      scopes,
    });
  }

  return twitterOAuthInstance;
}

