/**
 * AssetMT - Supabase Client Initialization
 * Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const RUNTIME_CONFIG_KEY = 'assetmt_supabase_runtime_config';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function getActiveSupabaseConfig(): SupabaseConfig | null {
  // 1. Check Vite environment variables
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (envUrl && envKey && !envUrl.includes('your-assetmt-project')) {
    return { url: envUrl, anonKey: envKey };
  }

  // 2. In local development ONLY, allow developer testing session storage
  if (import.meta.env.DEV) {
    try {
      const stored = sessionStorage.getItem(RUNTIME_CONFIG_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.url && parsed.anonKey) {
          return parsed;
        }
      }
    } catch {
      // Ignore storage errors
    }
  }

  return null;
}

export function saveRuntimeSupabaseConfig(config: SupabaseConfig) {
  if (!import.meta.env.DEV) return;
  try {
    sessionStorage.setItem(RUNTIME_CONFIG_KEY, JSON.stringify(config));
    // Reload to re-instantiate client cleanly
    window.location.reload();
  } catch (err) {
    console.error('Failed to save runtime config:', err);
  }
}

export function clearRuntimeSupabaseConfig() {
  if (!import.meta.env.DEV) return;
  try {
    sessionStorage.removeItem(RUNTIME_CONFIG_KEY);
    window.location.reload();
  } catch (err) {
    console.error('Failed to clear runtime config:', err);
  }
}

let supabaseInstance: SupabaseClient | null = null;
const activeConfig = getActiveSupabaseConfig();

if (activeConfig) {
  supabaseInstance = createClient(activeConfig.url, activeConfig.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  });
}

export const supabase = supabaseInstance;
export const isSupabaseConfigured = Boolean(supabaseInstance);
