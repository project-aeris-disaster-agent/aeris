import { supabase } from '@/lib/supabase';
import type { User, Session, AuthError } from '@supabase/supabase-js';

export interface SignUpData {
  email: string;
  password: string;
  full_name?: string;
  phone?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User | null;
  session: Session | null;
  error: AuthError | null;
}

/**
 * Auth Service - Handles all authentication operations with Supabase
 */
export class AuthService {
  /**
   * Sign up a new user with email and password
   */
  static async signUp(data: SignUpData): Promise<AuthResponse> {
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.full_name,
          phone: data.phone,
        },
      },
    });

    return {
      user: authData.user,
      session: authData.session,
      error,
    };
  }

  /**
   * Sign in an existing user
   */
  static async signIn(data: SignInData): Promise<AuthResponse> {
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    return {
      user: authData.user,
      session: authData.session,
      error,
    };
  }

  /**
   * Sign out the current user
   */
  static async signOut(): Promise<{ error: AuthError | null }> {
    const { error } = await supabase.auth.signOut();
    return { error };
  }

  /**
   * Get the current session
   */
  static async getSession(): Promise<Session | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  }

  /**
   * Get the current user
   */
  static async getCurrentUser(): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }

  /**
   * Reset password - sends password reset email
   */
  static async resetPassword(email: string): Promise<{ error: AuthError | null }> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    return { error };
  }

  /**
   * Update password
   */
  static async updatePassword(newPassword: string): Promise<{ error: AuthError | null }> {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { error };
  }

  /**
   * Listen to auth state changes
   */
  static onAuthStateChange(
    callback: (event: string, session: Session | null) => void
  ) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  }

  /**
   * Update user profile
   */
  static async updateProfile(updates: {
    full_name?: string;
    phone?: string;
    username?: string;
    profile_photo_url?: string;
    preferences?: Record<string, any>;
  }): Promise<{ error: any }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: new Error('User not authenticated') };
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    return { error };
  }

  /**
   * Link Twitter account to user profile
   */
  static async linkTwitterAccount(data: {
    twitter_user_id: string;
    twitter_username: string;
    twitter_access_token: string;
    twitter_refresh_token: string;
  }): Promise<{ error: any }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: new Error('User not authenticated') };
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        ...data,
        twitter_connected_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    return { error };
  }

  /**
   * Link Web3 wallet to user profile
   */
  static async linkWallet(data: {
    wallet_address: string;
    wallet_network?: string;
  }): Promise<{ error: any }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: new Error('User not authenticated') };
    }

    // Get current wallet addresses
    const { data: profile } = await supabase
      .from('profiles')
      .select('wallet_addresses')
      .eq('id', user.id)
      .single();

    const currentAddresses = (profile?.wallet_addresses as string[]) || [];
    const updatedAddresses = [...currentAddresses, data.wallet_address];

    const { error } = await supabase
      .from('profiles')
      .update({
        wallet_address: data.wallet_address,
        wallet_addresses: updatedAddresses,
        wallet_network: data.wallet_network || 'ethereum',
      })
      .eq('id', user.id);

    return { error };
  }
}

