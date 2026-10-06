/**
 * AssetMT - Safe Production Service Unavailable Screen
 * Replaces technical database error dialogs with a safe enterprise failure screen.
 * Strictly adheres to production security: no internal SQL, keys, or stack traces exposed.
 */

import React, { useMemo } from 'react';
import { AlertCircle, RefreshCw, LogOut } from 'lucide-react';

interface ServiceUnavailableProps {
  onRetry?: () => void;
  onSignOut?: () => void;
  referenceId?: string;
  isRetrying?: boolean;
}

export const ServiceUnavailable: React.FC<ServiceUnavailableProps> = ({
  onRetry,
  onSignOut,
  referenceId,
  isRetrying = false,
}) => {
  const generatedRefId = useMemo(() => {
    return referenceId || `REQ-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }, [referenceId]);

  return (
    <div className="min-h-screen bg-[#F7F6F2] flex flex-col justify-center items-center p-6 selection:bg-orange-100 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="w-full max-w-md">
        {/* Brand Card Header with dark styling */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-1.5">
            <div className="w-8 h-8 rounded-lg bg-[#0B0F14] border border-neutral-800 flex items-center justify-center shadow-xs">
              <span className="font-mono font-bold text-xs text-[#FF6A1A] tracking-tighter">A</span>
              <span className="font-mono font-bold text-xs text-white tracking-tighter">MT</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-neutral-900">
              Asset<span className="text-[#FF6A1A]">MT</span>
            </span>
          </div>
          <div className="text-xs text-neutral-500 font-medium">
            Enterprise Asset Management
          </div>
        </div>

        {/* Compact White Card */}
        <div className="bg-white border border-neutral-200/80 rounded-xl shadow-xs p-8 text-center space-y-5">
          <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200/60 text-amber-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>

          <div>
            <h1 className="text-base font-bold text-neutral-900">
              Service temporarily unavailable
            </h1>
            <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
              AssetMT is unable to connect to the application services. Please try again in a few minutes.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2.5">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                disabled={isRetrying}
                className="w-full py-2.5 px-4 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                <span>Retry</span>
              </button>
            )}

            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="text-xs text-neutral-500 hover:text-neutral-800 cursor-pointer py-1 inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            )}
          </div>

          {/* Clean Reference ID */}
          <div className="pt-3 border-t border-neutral-100 text-[11px] text-neutral-400 font-mono">
            Reference ID: {generatedRefId}
          </div>
        </div>
      </div>
    </div>
  );
};
