/**
 * AssetMT - Company Workspace Onboarding
 * Atomic creation of customer company & initial TENANT_ADMIN membership
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Building, ShieldCheck, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';

export const OnboardingModal: React.FC = () => {
  const { user, createWorkspace, signOut, isDatabaseIncomplete, error: authError } = useAuth();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDatabaseIncomplete) {
      setError(
        import.meta.env.DEV
          ? 'Database status: Incomplete. Ensure migrations have been applied.'
          : 'Service temporarily unavailable. Please try again shortly.'
      );
      return;
    }
    if (!name.trim() || name.trim().length < 2) {
      setError('Please provide a valid company workspace name (min 2 characters).');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await createWorkspace(name.trim(), code.trim() || undefined);
      if (!res.success) {
        setError(res.error || 'Failed to initialize workspace.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Onboarding failed');
    } finally {
      setLoading(false);
    }
  };

  const activeError = error || (isDatabaseIncomplete ? authError : null);

  return (
    <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-neutral-200 shadow-xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center text-[#FF6A1A]">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-neutral-900">
              Create Company Workspace
            </h2>
            <p className="text-xs text-neutral-500">
              Set up your organization in AssetMT
            </p>
          </div>
        </div>

        <div className="mb-5 p-3 bg-neutral-50 border border-neutral-200 rounded text-xs text-neutral-600 leading-relaxed">
          <div className="flex items-center gap-1.5 font-semibold text-neutral-800 mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-orange-600" />
            <span>Role: Customer Tenant Admin</span>
          </div>
          Your account (<span className="font-mono text-neutral-800">{user?.email}</span>) will be
          registered as the Tenant Administrator for this company workspace.
        </div>

        {activeError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block">
                {import.meta.env.DEV
                  ? activeError
                  : 'Unable to initialize workspace. Please try again in a few moments.'}
              </span>
              {isDatabaseIncomplete && import.meta.env.DEV && (
                <span className="text-[11px] text-red-600 block">
                  Database status: Incomplete. Ensure migrations have been applied.
                </span>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Company Workspace Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Acme Corporation or Skyline Logistics"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Company Code <span className="text-neutral-400 font-normal">(Optional ID tag)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. ACME or SKY-HQ"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 text-xs border border-neutral-300 rounded font-mono uppercase focus:outline-none focus:border-[#FF6A1A]"
            />
            <p className="text-[11px] text-neutral-400 mt-1">
              Used as an identifier for asset prefixing and internal routing.
            </p>
          </div>

          <div className="p-3 bg-orange-50/60 rounded border border-orange-100 text-[11px] text-neutral-600 flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#FF6A1A] shrink-0 mt-0.5" />
            <span>
              Starter categories (IT Equipment, Office Furniture, Vehicles) and a default
              Headquarters site will be provisioned automatically.
            </span>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => signOut()}
              className="text-xs text-neutral-500 hover:text-neutral-800 cursor-pointer"
            >
              Sign Out
            </button>

            <button
              type="submit"
              disabled={loading || isDatabaseIncomplete}
              className="px-4 py-2 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>
                {loading
                  ? 'Creating Workspace...'
                  : isDatabaseIncomplete && import.meta.env.DEV
                  ? 'Database Incomplete'
                  : 'Initialize Workspace'}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
