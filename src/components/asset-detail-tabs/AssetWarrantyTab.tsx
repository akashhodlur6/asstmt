/**
 * AssetMT - Asset Warranty Tab
 * Active warranties, expiry indicators, warranty history records, and additions
 * Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Plus,
  Calendar,
  Building2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Phone,
  FileText,
  X,
  RefreshCw,
} from 'lucide-react';
import { Asset, AssetWarranty, CreateWarrantyInput, WarrantyType, Vendor } from '../../../shared/types.ts';
import { api } from '../../lib/api.ts';

interface AssetWarrantyTabProps {
  token: string;
  asset: Asset;
  isTenantAdmin: boolean;
  onRefreshAsset?: () => void;
}

export const AssetWarrantyTab: React.FC<AssetWarrantyTabProps> = ({
  token,
  asset,
  isTenantAdmin,
  onRefreshAsset,
}) => {
  const [warranties, setWarranties] = useState<AssetWarranty[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState<CreateWarrantyInput>({
    asset_id: asset.id,
    warranty_number: '',
    provider_name: '',
    warranty_type: 'Manufacturer',
    start_date: asset.purchase_date || new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    coverage_details: '',
    contact_details: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadWarranties = async () => {
    try {
      setLoading(true);
      const [wRes, vRes] = await Promise.all([
        api.getWarranties(token, asset.id),
        api.getVendors(token),
      ]);
      if (wRes.success && wRes.data) setWarranties(wRes.data);
      if (vRes.success && vRes.data) setVendors(vRes.data);
    } catch (err) {
      console.error('Failed to load asset warranties:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWarranties();
  }, [token, asset.id]);

  const handleOpenAdd = () => {
    setFormData({
      asset_id: asset.id,
      warranty_number: `WAR-${Date.now().toString().slice(-6)}`,
      provider_name: asset.manufacturer || vendors[0]?.name || '',
      warranty_type: 'Manufacturer',
      start_date: asset.purchase_date || new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      coverage_details: 'Parts & Labor Coverage',
      contact_details: '',
      notes: '',
    });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.warranty_number.trim()) {
      setFormError('Warranty number is required');
      return;
    }
    if (!formData.provider_name.trim()) {
      setFormError('Provider name is required');
      return;
    }
    if (formData.end_date < formData.start_date) {
      setFormError('Warranty expiry date cannot precede start date');
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);
      const res = await api.createWarranty(token, formData);
      if (res.success) {
        setIsAddModalOpen(false);
        await loadWarranties();
        if (onRefreshAsset) onRefreshAsset();
      } else {
        setFormError(res.error || 'Failed to add warranty');
      }
    } catch (err: any) {
      setFormError(err.message || 'Error creating warranty');
    } finally {
      setSubmitting(false);
    }
  };

  const activeWarranties = warranties.filter((w) => w.status === 'Active');
  const expiredWarranties = warranties.filter((w) => w.status === 'Expired');

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
            Warranty Records & History
          </h3>
          <p className="text-[11px] text-neutral-500">
            {warranties.length} total warranty records tracked for this asset
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadWarranties}
            disabled={loading}
            className="text-xs text-neutral-500 hover:text-neutral-800 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          {isTenantAdmin && (
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-[#FF6A1A] hover:bg-[#e55a10] text-white transition shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Warranty</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Warranties */}
      <div className="space-y-3">
        <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-wide">
          Active Coverage ({activeWarranties.length})
        </div>

        {activeWarranties.length === 0 ? (
          <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg text-center text-xs text-neutral-400">
            No active warranty policies registered. Click "Add Warranty" to attach a policy.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeWarranties.map((w) => (
              <div
                key={w.id}
                className="bg-white p-4 rounded-lg border border-emerald-200 bg-emerald-50/20 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-neutral-900 text-xs">
                        {w.warranty_number}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {w.status}
                      </span>
                      {w.is_expiring_soon && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Expiring Soon
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-semibold text-neutral-800 mt-1">
                      {w.provider_name} ({w.warranty_type})
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-white p-2.5 rounded border border-neutral-200">
                  <div>
                    <span className="text-[10px] text-neutral-400 block font-sans">Start Date:</span>
                    <span className="text-neutral-700">{w.start_date}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 block font-sans">Expiry Date:</span>
                    <span className="font-bold text-neutral-900">{w.end_date}</span>
                  </div>
                </div>

                {w.coverage_details && (
                  <div className="text-xs text-neutral-600 bg-white p-2.5 rounded border border-neutral-200">
                    <span className="font-semibold block text-[10px] text-neutral-400 uppercase">Coverage</span>
                    {w.coverage_details}
                  </div>
                )}

                {w.contact_details && (
                  <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                    <Phone className="w-3.5 h-3.5 text-neutral-400" />
                    <span>{w.contact_details}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historical / Expired Warranties */}
      {expiredWarranties.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-neutral-200">
          <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-wide">
            Expired Warranty History ({expiredWarranties.length})
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-neutral-500 font-semibold border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-2">Warranty #</th>
                  <th className="px-4 py-2">Provider</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Coverage Period</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 text-neutral-700">
                {expiredWarranties.map((w) => (
                  <tr key={w.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-2 font-mono font-medium">{w.warranty_number}</td>
                    <td className="px-4 py-2">{w.provider_name}</td>
                    <td className="px-4 py-2">{w.warranty_type}</td>
                    <td className="px-4 py-2 font-mono text-[11px]">
                      {w.start_date} to {w.end_date}
                    </td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-neutral-100 text-neutral-500 font-medium">
                        Expired
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Warranty Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-neutral-200">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                  Asset Compliance
                </span>
                <h3 className="text-base font-bold text-neutral-900">Add Warranty Record</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-7 h-7 rounded flex items-center justify-center hover:bg-neutral-100 text-neutral-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Warranty Number *</label>
                  <input
                    type="text"
                    value={formData.warranty_number}
                    onChange={(e) => setFormData({ ...formData, warranty_number: e.target.value })}
                    className="w-full p-2 border border-neutral-300 rounded font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Provider / Vendor *</label>
                  <input
                    type="text"
                    value={formData.provider_name}
                    onChange={(e) => setFormData({ ...formData, provider_name: e.target.value })}
                    placeholder="e.g. AppleCare, Dell ProSupport"
                    className="w-full p-2 border border-neutral-300 rounded"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Warranty Type *</label>
                  <select
                    value={formData.warranty_type}
                    onChange={(e) => setFormData({ ...formData, warranty_type: e.target.value as WarrantyType })}
                    className="w-full p-2 border border-neutral-300 rounded bg-white"
                  >
                    <option value="Manufacturer">Manufacturer</option>
                    <option value="Extended">Extended</option>
                    <option value="Vendor">Vendor</option>
                    <option value="Third-Party">Third-Party</option>
                    <option value="Replacement">Replacement</option>
                    <option value="Labor Only">Labor Only</option>
                    <option value="Parts & Labor">Parts & Labor</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Vendor (Optional)</label>
                  <select
                    value={formData.vendor_id || ''}
                    onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value || undefined })}
                    className="w-full p-2 border border-neutral-300 rounded bg-white"
                  >
                    <option value="">No vendor linkage</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Coverage Start Date *</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full p-2 border border-neutral-300 rounded font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Coverage Expiration Date *</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full p-2 border border-neutral-300 rounded font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Coverage Scope</label>
                <textarea
                  rows={2}
                  value={formData.coverage_details || ''}
                  onChange={(e) => setFormData({ ...formData, coverage_details: e.target.value })}
                  placeholder="e.g. Next-business-day onsite support, accidental damage..."
                  className="w-full p-2 border border-neutral-300 rounded"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Support Contact / Claim Info</label>
                <input
                  type="text"
                  value={formData.contact_details || ''}
                  onChange={(e) => setFormData({ ...formData, contact_details: e.target.value })}
                  placeholder="Support portal URL, phone number, SLA ID..."
                  className="w-full p-2 border border-neutral-300 rounded"
                />
              </div>

              <div className="pt-3 border-t border-neutral-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-neutral-300 text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded bg-[#FF6A1A] hover:bg-[#e55a10] text-white font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Adding...' : 'Add Warranty'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
