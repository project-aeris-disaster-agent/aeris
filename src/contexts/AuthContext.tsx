import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { AuthService } from '@/services/auth';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  clearOAuthState: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if Supabase is properly initialized before making calls
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('⚠️ Supabase not initialized - skipping auth setup');
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((error) => {
      console.error('Error getting session:', error);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const signUp = async (email: string, password: string, fullName?: string) => {
    const result = await AuthService.signUp({ email, password, full_name: fullName });
    return { error: result.error };
  };

  const signIn = async (email: string, password: string) => {
    const result = await AuthService.signIn({ email, password });
    return { error: result.error };
  };

  const signOut = async () => {
    await AuthService.signOut();
    setUser(null);
    setSession(null);
  };

  const logout = async () => {
    await AuthService.logout();
    setUser(null);
    setSession(null);
  };

  const resetPassword = async (email: string) => {
    return await AuthService.resetPassword(email);
  };

  const clearOAuthState = () => {
    AuthService.clearAllOAuthState();
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    logout,
    resetPassword,
    clearOAuthState,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

