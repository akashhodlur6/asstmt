/**
 * AssetMT - Asset Contracts Tab
 * Shows contracts linked to this specific asset
 * Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
 */

import React, { useState, useEffect } from 'react';
import { FileCheck2, Building2, Calendar, Link, Plus, RefreshCw, X } from 'lucide-react';
import { Asset, Contract } from '../../../shared/types.ts';
import { api } from '../../lib/api.ts';

interface AssetContractsTabProps {
  token: string;
  asset: Asset;
  isTenantAdmin: boolean;
}

export const AssetContractsTab: React.FC<AssetContractsTabProps> = ({
  token,
  asset,
  isTenantAdmin,
}) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [allContracts, setAllContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState('');
  const [linking, setLinking] = useState(false);

  const loadContracts = async () => {
    try {
      setLoading(true);
      const res = await api.getContracts(token);
      if (res.success && res.data) {
        setAllContracts(res.data);
        const linked = res.data.filter((c) =>
          c.assets?.some((a) => a.id === asset.id)
        );
        setContracts(linked);
        if (res.data.length > 0) setSelectedContractId(res.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load asset contracts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContracts();
  }, [token, asset.id]);

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContractId) return;

    try {
      setLinking(true);
      const res = await api.linkContractAsset(token, selectedContractId, asset.id);
      if (res.success) {
        setIsLinkModalOpen(false);
        await loadContracts();
      }
    } catch (err) {
      console.error('Failed to link asset to contract:', err);
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
            Linked Enterprise Contracts ({contracts.length})
          </h3>
          <p className="text-[11px] text-neutral-500">
            Maintenance SLAs, lease agreements, and service contracts covering this asset
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadContracts}
            disabled={loading}
            className="text-xs text-neutral-500 hover:text-neutral-800 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          {isTenantAdmin && (
            <button
              onClick={() => setIsLinkModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-[#FF6A1A] hover:bg-[#e55a10] text-white transition shadow-xs cursor-pointer"
            >
              <Link className="w-3.5 h-3.5" />
              <span>Link to Contract</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden shadow-2xs">
        {loading ? (
          <div className="py-12 text-center text-xs text-neutral-400">Loading linked contracts...</div>
        ) : contracts.length === 0 ? (
          <div className="py-12 text-center text-neutral-400 text-xs">
            <FileCheck2 className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
            <p className="font-semibold text-neutral-700">No contracts linked to this asset</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Click "Link to Contract" to attach an existing vendor contract or master agreement.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-200">
            {contracts.map((c) => (
              <div key={c.id} className="p-4 flex items-center justify-between hover:bg-neutral-50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-neutral-900 text-xs">
                      {c.contract_number}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-700">
                      {c.contract_type}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        c.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-neutral-100 text-neutral-600'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <div className="font-semibold text-xs text-neutral-800 mt-1">{c.title}</div>
                  <div className="flex items-center gap-3 text-[11px] text-neutral-500 mt-1 font-mono">
                    <span>
                      Vendor: <span className="font-sans font-medium text-neutral-700">{c.vendor?.name || 'None'}</span>
                    </span>
                    <span>•</span>
                    <span>
                      {c.start_date} to {c.end_date}
                    </span>
                  </div>
                </div>

                <div className="font-mono font-semibold text-xs text-neutral-900">
                  {c.contract_value !== null ? `${c.currency} ${Number(c.contract_value).toLocaleString()}` : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Link to Contract Modal */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-neutral-200">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-neutral-900">Link Asset to Contract</h3>
              <button
                onClick={() => setIsLinkModalOpen(false)}
                className="w-7 h-7 rounded flex items-center justify-center hover:bg-neutral-100 text-neutral-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLinkSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Select Active Contract</label>
                <select
                  value={selectedContractId}
                  onChange={(e) => setSelectedContractId(e.target.value)}
                  className="w-full p-2 border border-neutral-300 rounded bg-white"
                  required
                >
                  {allContracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.contract_number} — {c.title} ({c.contract_type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-neutral-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-neutral-300 text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={linking}
                  className="px-4 py-1.5 rounded bg-[#FF6A1A] hover:bg-[#e55a10] text-white font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {linking ? 'Linking...' : 'Link Contract'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
