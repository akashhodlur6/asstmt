/**
 * AssetMT - Authentication & Workspace Context
 * Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase.ts';
import { api } from '../lib/api.ts';
import { Membership } from '../../shared/types.ts';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  token: string | null;
  membership: Membership | null;
  companyName: string | null;
  role: string | null;
  isLoading: boolean;
  isConfigured: boolean;
  isDatabaseIncomplete: boolean;
  workspaceLookupError: string | null;
  hasWorkspace: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<{ error?: string; message?: string }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error?: string; message?: string }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshWorkspace: () => Promise<void>;
  createWorkspace: (name: string, code?: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaceLookupError, setWorkspaceLookupError] = useState<string | null>(null);
  const [isDatabaseIncomplete, setIsDatabaseIncomplete] = useState<boolean>(false);

  const token = session?.access_token || null;

  const loadWorkspace = useCallback(async (accessToken: string) => {
    try {
      setError(null);
      setWorkspaceLookupError(null);
      setIsDatabaseIncomplete(false);
      const res = await api.getWorkspace(accessToken);
      if (res.success && res.hasWorkspace && res.membership) {
        setMembership(res.membership);
      } else {
        setMembership(null);
      }
    } catch (err: unknown) {
      console.error('Error fetching workspace:', err);
      const errorData = (err as unknown as { data?: { error?: string; message?: string; suggestion?: string; code?: string } })?.data;
      const errorStatus = (err as unknown as { status?: number })?.status;

      if (
        errorData?.error === 'SCHEMA_INCOMPLETE' ||
        errorData?.message?.includes('schema cache') ||
        errorData?.message?.includes('does not exist') ||
        errorData?.code === '42P01' ||
        errorData?.code === 'PGRST204' ||
        errorData?.code === 'PGRST205'
      ) {
        setIsDatabaseIncomplete(true);
        setWorkspaceLookupError(null);
        setError(
          import.meta.env.DEV
            ? 'Database status: Incomplete. Ensure migrations have been applied.'
            : 'Service temporarily unavailable. Please try again shortly.'
        );
        setMembership(null);
      } else if (errorStatus === 403 || errorData?.error === 'WORKSPACE_REQUIRED') {
        // Authenticated with no workspace: proceed to onboarding
        setIsDatabaseIncomplete(false);
        setWorkspaceLookupError(null);
        setMembership(null);
      } else {
        // Genuine request or permission failure - must not be treated as "no workspace"
        setIsDatabaseIncomplete(false);
        const errMsg = errorData?.message || (err instanceof Error ? err.message : 'Error checking workspace membership');
        setWorkspaceLookupError(errMsg);
        setError(errMsg);
        setMembership(null);
      }
    }
  }, []);

  const refreshWorkspace = useCallback(async () => {
    if (!token) return;
    await loadWorkspace(token);
  }, [token, loadWorkspace]);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session: initSession }, error: sessionError }) => {
      if (sessionError) {
        console.error('Error getting initial session:', sessionError);
      }
      setSession(initSession);
      setUser(initSession?.user || null);

      if (initSession?.access_token) {
        loadWorkspace(initSession.access_token).finally(() => {
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    // 2. Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user || null);

      if (newSession?.access_token) {
        await loadWorkspace(newSession.access_token);
      } else {
        setMembership(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadWorkspace]);

  const signInWithGoogle = async () => {
    if (!supabase) throw new Error('Supabase is not configured.');
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      throw oauthError;
    }
  };

  const signInWithEmail = async (email: string) => {
    if (!supabase) return { error: 'Supabase is not configured' };
    setError(null);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    if (otpError) {
      setError(otpError.message);
      return { error: otpError.message };
    }
    return { message: 'Check your email for the magic login link.' };
  };

  const signUpWithEmail = async (email: string, password: string) => {
    if (!supabase) return { error: 'Supabase is not configured' };
    setError(null);
    const { data, error: signError } = await supabase.auth.signUp({
      email,
      password,
    });
    if (signError) {
      setError(signError.message);
      return { error: signError.message };
    }
    if (data.session) {
      setSession(data.session);
      setUser(data.user);
      if (data.session.access_token) {
        await loadWorkspace(data.session.access_token);
      }
    }
    return { message: 'Account created successfully.' };
  };

  const signInWithPassword = async (email: string, password: string) => {
    if (!supabase) return { error: 'Supabase is not configured' };
    setError(null);
    const { data, error: signError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signError) {
      setError(signError.message);
      return { error: signError.message };
    }
    setSession(data.session);
    setUser(data.user);
    if (data.session.access_token) {
      await loadWorkspace(data.session.access_token);
    }
    return {};
  };

  const signOut = async () => {
    if (!supabase) return;
    setIsLoading(true);
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setMembership(null);
    setIsLoading(false);
  };

  const createWorkspace = async (name: string, code?: string) => {
    if (!token) {
      return { success: false, error: 'User is not authenticated' };
    }
    try {
      setError(null);
      const res = await api.createWorkspace(token, { name, code });
      if (res.success && res.membership) {
        setMembership(res.membership);
        return { success: true };
      }
      return { success: false, error: 'Failed to create workspace' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating workspace';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const companyName = membership?.company?.name || null;
  const role = membership?.role || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        token,
        membership,
        companyName,
        role,
        isLoading,
        isConfigured: isSupabaseConfigured,
        isDatabaseIncomplete,
        workspaceLookupError,
        hasWorkspace: Boolean(membership?.company_id),
        error,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signInWithPassword,
        signOut,
        refreshWorkspace,
        createWorkspace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
