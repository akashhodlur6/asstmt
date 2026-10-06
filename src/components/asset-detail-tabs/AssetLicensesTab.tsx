/**
 * AssetMT - Asset Licenses Tab
 * Software licenses allocated directly to this hardware asset
 * Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
 */

import React, { useState, useEffect } from 'react';
import { KeyRound, Laptop, Calendar, Building2, RefreshCw, X, ShieldCheck } from 'lucide-react';
import { Asset, SoftwareLicense } from '../../../shared/types.ts';
import { api } from '../../lib/api.ts';

interface AssetLicensesTabProps {
  token: string;
  asset: Asset;
  isTenantAdmin: boolean;
}

export const AssetLicensesTab: React.FC<AssetLicensesTabProps> = ({
  token,
  asset,
  isTenantAdmin,
}) => {
  const [allocatedLicenses, setAllocatedLicenses] = useState<
    Array<{ license: SoftwareLicense; allocationDate: string; allocationId: string }>
  >([]);
  const [loading, setLoading] = useState(true);

  const loadAllocations = async () => {
    try {
      setLoading(true);
      const res = await api.getLicenses(token);
      if (res.success && res.data) {
        const found: Array<{ license: SoftwareLicense; allocationDate: string; allocationId: string }> = [];

        // For each license, fetch detail allocations to see if this asset is allocated
        for (const lic of res.data) {
          const det = await api.getLicense(token, lic.id);
          if (det.success && det.data && det.data.allocations) {
            det.data.allocations.forEach((alloc) => {
              if (alloc.asset_id === asset.id && alloc.status === 'Active') {
                found.push({
                  license: det.data,
                  allocationDate: alloc.allocated_at,
                  allocationId: alloc.id,
                });
              }
            });
          }
        }
        setAllocatedLicenses(found);
      }
    } catch (err) {
      console.error('Failed to load asset software licenses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllocations();
  }, [token, asset.id]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
            Installed / Assigned Software Licenses ({allocatedLicenses.length})
          </h3>
          <p className="text-[11px] text-neutral-500">
            Per-device software seats, operating system licenses, and enterprise software assigned to this asset
          </p>
        </div>

        <button
          onClick={loadAllocations}
          disabled={loading}
          className="text-xs text-neutral-500 hover:text-neutral-800 flex items-center gap-1 cursor-pointer"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden shadow-2xs">
        {loading ? (
          <div className="py-12 text-center text-xs text-neutral-400">Loading assigned software licenses...</div>
        ) : allocatedLicenses.length === 0 ? (
          <div className="py-12 text-center text-neutral-400 text-xs">
            <KeyRound className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
            <p className="font-semibold text-neutral-700">No software licenses allocated to this device</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Navigate to Software Licenses to allocate available software seats to this asset.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-200">
            {allocatedLicenses.map(({ license: lic, allocationDate, allocationId }) => (
              <div key={allocationId} className="p-4 flex items-center justify-between hover:bg-neutral-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-neutral-100 flex items-center justify-center text-neutral-600">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-neutral-900">{lic.software_name}</div>
                    <div className="text-[11px] text-neutral-500">
                      {lic.publisher || 'Vendor'} • {lic.license_type}
                    </div>
                    <div className="text-[10px] font-mono text-neutral-400 mt-0.5">
                      Assigned {new Date(allocationDate).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-mono text-xs font-medium text-neutral-700 block">
                    {lic.license_key || '••••••••'}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold">Active Seat</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
