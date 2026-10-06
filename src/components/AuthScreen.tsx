/**
 * AssetMT - Enterprise Sign-In Screen
 * Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { ShieldCheck, Mail, Lock, ArrowRight, AlertCircle, Database } from 'lucide-react';
import { ServiceUnavailable } from './ServiceUnavailable.tsx';

interface AuthScreenProps {
  onOpenSetup: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onOpenSetup }) => {
  const {
    signInWithGoogle,
    signInWithPassword,
    signUpWithEmail,
    isConfigured,
    error: authError,
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // In production, never expose database configuration to customers
  if (!isConfigured && !import.meta.env.DEV) {
    return <ServiceUnavailable onRetry={() => window.location.reload()} />;
  }

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setLocalError(null);
      await signInWithGoogle();
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setLocalError('Please enter both email and password');
      return;
    }

    try {
      setLoading(true);
      setLocalError(null);
      setMessage(null);

      if (mode === 'signup') {
        const res = await signUpWithEmail(email, password);
        if (res.error) {
          setLocalError(res.error);
        } else {
          setMessage(res.message || 'Account created! Please sign in.');
          setMode('signin');
        }
      } else {
        const res = await signInWithPassword(email, password);
        if (res.error) {
          setLocalError(res.error);
        }
      }
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col justify-center items-center p-6 selection:bg-orange-100">
      <div className="w-full max-w-md">
        {/* Brand Card Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="text-2xl font-bold tracking-tight text-neutral-900 font-['Plus_Jakarta_Sans',sans-serif]">
              Asset<span className="text-[#FF6A1A]">MT</span>
            </span>
          </div>
          <div className="text-xs text-neutral-500 font-medium">
            Commercial Multi-Tenant Asset-Management SaaS
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5">
            by Akshigo Tech
          </div>
        </div>

        {/* Main Box */}
        <div className="bg-white border border-neutral-200 rounded-lg shadow-sm p-8">
          {!isConfigured ? (
            <div className="space-y-4 text-center">
              <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center mx-auto">
                <Database className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-semibold text-neutral-900">
                Developer Setup Required
              </h2>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Connect your local development environment to your Supabase project using the developer setup.
              </p>
              <button
                type="button"
                onClick={onOpenSetup}
                className="w-full py-2.5 px-4 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Database className="w-4 h-4" /> Open Developer Setup
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">
                  {mode === 'signin' ? 'Sign in to your account' : 'Create an account'}
                </h2>
                <p className="text-xs text-neutral-500 mt-1">
                  Access your enterprise workspace and asset registry
                </p>
              </div>

              {(localError || authError) && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{localError || authError}</span>
                </div>
              )}

              {message && (
                <div className="p-3 bg-green-50 border border-green-200 rounded text-xs text-green-700 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                  <span>{message}</span>
                </div>
              )}

              {/* Primary OAuth: Google */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-2.5 px-4 border border-neutral-300 hover:bg-neutral-50 rounded text-xs font-semibold text-neutral-700 transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Continue with Google
              </button>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-neutral-200 w-full"></div>
                <span className="bg-white px-2 text-[11px] text-neutral-400 uppercase tracking-wider relative font-medium">
                  or email login
                </span>
              </div>

              {/* Direct Supabase Email Auth */}
              <form onSubmit={handleEmailAuth} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-700 mb-1">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      placeholder="admin@yourcompany.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded transition-colors flex items-center justify-center gap-1.5 mt-2 cursor-pointer"
                >
                  <span>{mode === 'signin' ? 'Sign In' : 'Sign Up'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>

              <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-xs text-neutral-500">
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'signin' ? 'signup' : 'signin');
                    setLocalError(null);
                    setMessage(null);
                  }}
                  className="hover:text-neutral-900 underline"
                >
                  {mode === 'signin'
                    ? "Don't have an account? Sign up"
                    : 'Already registered? Sign in'}
                </button>

                {import.meta.env.DEV && (
                  <button
                    type="button"
                    onClick={onOpenSetup}
                    className="text-neutral-400 hover:text-neutral-700 flex items-center gap-1 text-[11px] cursor-pointer"
                  >
                    <Database className="w-3 h-3" /> Dev Setup
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Security & Multi-Tenant Disclaimer */}
        <div className="mt-6 text-center text-[11px] text-neutral-400 leading-relaxed flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-neutral-400" />
          <span>Tenant isolation enforced at database level with Postgres RLS</span>
        </div>
      </div>
    </div>
  );
};
