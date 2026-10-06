/**
 * AssetMT - Developer Diagnostic & Setup Modal
 * Retained strictly for local development testing (ENVIRONMENT !== 'production').
 * Customers in production never see this screen.
 */

import React, { useState } from 'react';
import {
  saveRuntimeSupabaseConfig,
  clearRuntimeSupabaseConfig,
  getActiveSupabaseConfig,
} from '../lib/supabase.ts';
import { ExternalLink, Key, RefreshCw, Terminal, CheckCircle2, AlertCircle } from 'lucide-react';

interface SetupRequiredProps {
  onClose?: () => void;
  isModal?: boolean;
}

export const SetupRequired: React.FC<SetupRequiredProps> = ({ onClose, isModal = false }) => {
  // Never render in production
  if (!import.meta.env.DEV) {
    return null;
  }

  const active = getActiveSupabaseConfig();
  const [url, setUrl] = useState(active?.url || '');
  const [anonKey, setAnonKey] = useState(active?.anonKey || '');
  const [error, setError] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !anonKey.trim()) {
      setError('Please provide both the Supabase Project URL and Anon Public Key.');
      return;
    }
    if (!url.startsWith('https://')) {
      setError('Supabase URL must start with https://');
      return;
    }
    setError(null);
    saveRuntimeSupabaseConfig({
      url: url.trim(),
      anonKey: anonKey.trim(),
    });
  };

  const handleClear = () => {
    clearRuntimeSupabaseConfig();
  };

  const isConnected = Boolean(active?.url && active?.anonKey);

  return (
    <div
      className={
        isModal
          ? 'fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4'
          : 'max-w-4xl mx-auto p-6'
      }
    >
      <div className="bg-white rounded-xl border border-neutral-200 shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 border-b border-neutral-100 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0B0F14] border border-neutral-800 flex items-center justify-center">
              <span className="font-mono font-bold text-xs text-[#FF6A1A]">A</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-neutral-900">
                  Developer Environment Setup
                </h2>
                <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 font-mono font-bold px-1.5 py-0.2 rounded">
                  DEV ONLY
                </span>
              </div>
              <p className="text-[11px] text-neutral-500">
                Local testing connector for Supabase backend
              </p>
            </div>
          </div>
          {isModal && onClose && (
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-700 text-sm px-2 py-1 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        <div className="p-5 space-y-5">
          {/* Status Indicator */}
          <div className={`p-3.5 rounded-lg border flex items-center justify-between text-xs ${
            isConnected
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span className="font-medium">
                Database Status: <strong>{isConnected ? 'Ready / Connected' : 'Incomplete / Unconfigured'}</strong>
              </span>
            </div>
            <span className="font-mono text-[10px] opacity-75">
              {active?.url ? active.url.replace(/^https?:\/\//, '').split('.')[0] : 'No connection'}
            </span>
          </div>

          {/* Migration note - clean, dynamic, non-stale */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-xs text-neutral-600 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-neutral-800">
              <Terminal className="w-3.5 h-3.5 text-neutral-500" />
              <span>Database Migrations Status</span>
            </div>
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              Database schema and triggers are managed via versioned migration files in{' '}
              <code className="bg-white px-1 py-0.5 rounded border border-neutral-200 font-mono text-[10px] text-neutral-700">/migrations</code>.
            </p>
          </div>

          {/* Quick Runtime Connector */}
          <div>
            <h3 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-neutral-500" /> Local Development Connection
            </h3>
            <p className="text-[11px] text-neutral-500 mb-3">
              Configure local testing credentials (persisted in session storage only):
            </p>

            {error && (
              <div className="mb-3 p-2.5 bg-red-50 text-red-700 text-xs rounded-md border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-neutral-700 mb-1">
                  VITE_SUPABASE_URL
                </label>
                <input
                  type="text"
                  placeholder="https://xyzcompany.supabase.co"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded-md font-mono focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-700 mb-1">
                  VITE_SUPABASE_ANON_KEY (Public Key Only)
                </label>
                <input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded-md font-mono focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded-md transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Save & Reconnect
                </button>

                {active && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-xs text-red-600 hover:underline cursor-pointer"
                  >
                    Clear Session Config
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Dynamic Auth Redirect URL */}
          <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
            <span>Auth Redirect Origin:</span>
            <code className="font-mono text-[10px] bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-700">
              {window.location.origin}
            </code>
          </div>
        </div>
      </div>
    </div>
  );
};
