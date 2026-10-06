/**
 * AssetMT - Asset Insurance Tab
 * Displays insurance policies covering this specific asset
 * Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
 */

import React, { useState, useEffect } from 'react';
import { ShieldAlert, ShieldCheck, Calendar, DollarSign, RefreshCw, X, Plus } from 'lucide-react';
import { Asset, InsurancePolicy } from '../../../shared/types.ts';
import { api } from '../../lib/api.ts';

interface AssetInsuranceTabProps {
  token: string;
  asset: Asset;
  isTenantAdmin: boolean;
}

export const AssetInsuranceTab: React.FC<AssetInsuranceTabProps> = ({
  token,
  asset,
  isTenantAdmin,
}) => {
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [loading, setLoading] = useState(true);

  const loadInsurance = async () => {
    try {
      setLoading(true);
      const res = await api.getInsurancePolicies(token);
      if (res.success && res.data) {
        const covering = res.data.filter((p) =>
          p.assets?.some((a) => a.id === asset.id)
        );
        setPolicies(covering);
      }
    } catch (err) {
      console.error('Failed to load asset insurance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInsurance();
  }, [token, asset.id]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
            Insurance Policies Covering This Asset ({policies.length})
          </h3>
          <p className="text-[11px] text-neutral-500">
            Comprehensive property, casualty, equipment floater, and transit insurance coverage
          </p>
        </div>

        <button
          onClick={loadInsurance}
          disabled={loading}
          className="text-xs text-neutral-500 hover:text-neutral-800 flex items-center gap-1 cursor-pointer"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden shadow-2xs">
        {loading ? (
          <div className="py-12 text-center text-xs text-neutral-400">Loading insurance policies...</div>
        ) : policies.length === 0 ? (
          <div className="py-12 text-center text-neutral-400 text-xs">
            <ShieldAlert className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
            <p className="font-semibold text-neutral-700">No active insurance policy assigned</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              This asset is not linked to any active enterprise insurance schedule.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-200">
            {policies.map((p) => (
              <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-neutral-900 text-xs">
                      {p.policy_number}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-700">
                      {p.coverage_type}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        p.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <div className="font-semibold text-xs text-neutral-800 mt-1">
                    Carrier: {p.provider}
                  </div>
                  <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
                    Valid: {p.start_date} to {p.expiry_date}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-mono text-right">
                  <div>
                    <span className="text-[10px] text-neutral-400 block font-sans">Insured Limit:</span>
                    <span className="font-bold text-neutral-800">
                      {p.insured_value !== null ? `${p.currency} ${Number(p.insured_value).toLocaleString()}` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 block font-sans">Deductible:</span>
                    <span className="text-neutral-700">
                      {p.deductible !== null ? `${p.currency} ${Number(p.deductible).toLocaleString()}` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
