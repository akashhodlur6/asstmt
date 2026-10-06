/**
 * AssetMT - Asset Financial & Acquisition Tab
 * Structured funding source, PO, invoice, cost center, and acquisition terms
 * Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
 */

import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Edit3,
  Building2,
  Calendar,
  FileText,
  CreditCard,
  Briefcase,
  CheckCircle2,
  X,
  RefreshCw,
} from 'lucide-react';
import { Asset, AssetPurchase, UpsertAssetPurchaseInput, FundingSource, Vendor, Department } from '../../../shared/types.ts';
import { api } from '../../lib/api.ts';

interface AssetFinancialTabProps {
  token: string;
  asset: Asset;
  isTenantAdmin: boolean;
  onRefreshAsset?: () => void;
}

export const AssetFinancialTab: React.FC<AssetFinancialTabProps> = ({
  token,
  asset,
  isTenantAdmin,
  onRefreshAsset,
}) => {
  const [purchase, setPurchase] = useState<AssetPurchase | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState<UpsertAssetPurchaseInput>({
    vendor_id: '',
    invoice_number: '',
    purchase_order: '',
    purchase_date: asset.purchase_date || '',
    purchase_cost: asset.purchase_cost ? Number(asset.purchase_cost) : undefined,
    currency: asset.currency || 'USD',
    funding_source: 'Company Purchase',
    department_id: '',
    cost_center: '',
    is_financed: false,
    is_leased: false,
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadPurchaseData = async () => {
    try {
      setLoading(true);
      const [pRes, vRes, dRes] = await Promise.all([
        api.getAssetPurchase(token, asset.id),
        api.getVendors(token),
        api.getDepartments(token),
      ]);

      if (pRes.success && pRes.data) {
        setPurchase(pRes.data);
        setFormData({
          vendor_id: pRes.data.vendor_id || '',
          invoice_number: pRes.data.invoice_number || '',
          purchase_order: pRes.data.purchase_order || '',
          purchase_date: pRes.data.purchase_date || asset.purchase_date || '',
          purchase_cost: pRes.data.purchase_cost ?? (asset.purchase_cost ? Number(asset.purchase_cost) : 0),
          currency: pRes.data.currency || asset.currency || 'USD',
          funding_source: pRes.data.funding_source || 'Company Purchase',
          department_id: pRes.data.department_id || '',
          cost_center: pRes.data.cost_center || '',
          is_financed: pRes.data.is_financed || false,
          is_leased: pRes.data.is_leased || false,
          notes: pRes.data.notes || '',
        });
      }
      if (vRes.success && vRes.data) setVendors(vRes.data);
      if (dRes.success && dRes.data) setDepartments(dRes.data);
    } catch (err) {
      console.error('Failed to load purchase information:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPurchaseData();
  }, [token, asset.id]);

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setFormError(null);
      const res = await api.saveAssetPurchase(token, asset.id, formData);
      if (res.success && res.data) {
        setPurchase(res.data);
        setIsEditModalOpen(false);
        if (onRefreshAsset) onRefreshAsset();
      } else {
        setFormError(res.error || 'Failed to update acquisition details');
      }
    } catch (err: any) {
      setFormError(err.message || 'Error updating purchase record');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
            Acquisition & Funding Records
          </h3>
          <p className="text-[11px] text-neutral-500">
            Invoice, purchase orders, funding source, and cost center attribution
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadPurchaseData}
            disabled={loading}
            className="text-xs text-neutral-500 hover:text-neutral-800 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          {isTenantAdmin && (
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 transition shadow-2xs cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Acquisition Info</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Purchase Specs */}
        <div className="bg-white border border-neutral-200 rounded-lg p-5 space-y-4 shadow-2xs">
          <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wider border-b border-neutral-100 pb-2 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-neutral-400" />
            <span>Purchase & Vendor Details</span>
          </h4>

          <dl className="grid grid-cols-2 gap-y-3 text-xs">
            <dt className="text-neutral-500">Acquisition Vendor</dt>
            <dd className="font-semibold text-neutral-900">{purchase?.vendor?.name || '—'}</dd>

            <dt className="text-neutral-500">Purchase Order (PO)</dt>
            <dd className="font-mono text-neutral-800">{purchase?.purchase_order || '—'}</dd>

            <dt className="text-neutral-500">Invoice Number</dt>
            <dd className="font-mono text-neutral-800">{purchase?.invoice_number || '—'}</dd>

            <dt className="text-neutral-500">Purchase Date</dt>
            <dd className="font-mono text-neutral-800">{purchase?.purchase_date || asset.purchase_date || '—'}</dd>

            <dt className="text-neutral-500">Acquisition Cost</dt>
            <dd className="font-mono font-bold text-neutral-900">
              {purchase?.currency || asset.currency}{' '}
              {Number(purchase?.purchase_cost ?? asset.purchase_cost ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </dd>
          </dl>
        </div>

        {/* Card 2: Funding & Financing */}
        <div className="bg-white border border-neutral-200 rounded-lg p-5 space-y-4 shadow-2xs">
          <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wider border-b border-neutral-100 pb-2 flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-neutral-400" />
            <span>Funding & Budget Allocation</span>
          </h4>

          <dl className="grid grid-cols-2 gap-y-3 text-xs">
            <dt className="text-neutral-500">Funding Source</dt>
            <dd className="font-semibold text-neutral-900">{purchase?.funding_source || 'Company Purchase'}</dd>

            <dt className="text-neutral-500">Charge Department</dt>
            <dd className="text-neutral-800">{purchase?.department?.name || '—'}</dd>

            <dt className="text-neutral-500">Cost Center Code</dt>
            <dd className="font-mono text-neutral-800">{purchase?.cost_center || '—'}</dd>

            <dt className="text-neutral-500">Financed / Loan</dt>
            <dd className="text-neutral-800">{purchase?.is_financed ? 'Yes' : 'No'}</dd>

            <dt className="text-neutral-500">Operating Lease</dt>
            <dd className="text-neutral-800">{purchase?.is_leased ? 'Yes' : 'No'}</dd>
          </dl>

          {purchase?.notes && (
            <div className="pt-2 border-t border-neutral-100 text-xs">
              <span className="font-semibold text-neutral-500 block text-[10px] uppercase">Acquisition Notes</span>
              <p className="text-neutral-700 mt-1 whitespace-pre-wrap">{purchase.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Acquisition Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-neutral-200">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                  Asset Record
                </span>
                <h3 className="text-base font-bold text-neutral-900">Edit Acquisition Information</h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="w-7 h-7 rounded flex items-center justify-center hover:bg-neutral-100 text-neutral-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSubmit} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Purchase Vendor</label>
                  <select
                    value={formData.vendor_id || ''}
                    onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value || undefined })}
                    className="w-full p-2 border border-neutral-300 rounded bg-white"
                  >
                    <option value="">No vendor selected</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Funding Source</label>
                  <select
                    value={formData.funding_source}
                    onChange={(e) => setFormData({ ...formData, funding_source: e.target.value as FundingSource })}
                    className="w-full p-2 border border-neutral-300 rounded bg-white font-medium"
                  >
                    <option value="Company Purchase">Company Purchase</option>
                    <option value="Department Budget">Department Budget</option>
                    <option value="Grant">Grant</option>
                    <option value="Donation">Donation</option>
                    <option value="Finance">Finance</option>
                    <option value="Lease">Lease</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Purchase Order (PO)</label>
                  <input
                    type="text"
                    value={formData.purchase_order || ''}
                    onChange={(e) => setFormData({ ...formData, purchase_order: e.target.value })}
                    placeholder="e.g. PO-88320"
                    className="w-full p-2 border border-neutral-300 rounded font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Invoice Number</label>
                  <input
                    type="text"
                    value={formData.invoice_number || ''}
                    onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                    placeholder="e.g. INV-10928"
                    className="w-full p-2 border border-neutral-300 rounded font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={formData.purchase_date || ''}
                    onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                    className="w-full p-2 border border-neutral-300 rounded font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Purchase Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.purchase_cost ?? ''}
                    onChange={(e) => setFormData({ ...formData, purchase_cost: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 border border-neutral-300 rounded font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Cost Center</label>
                  <input
                    type="text"
                    value={formData.cost_center || ''}
                    onChange={(e) => setFormData({ ...formData, cost_center: e.target.value })}
                    placeholder="e.g. CC-4010"
                    className="w-full p-2 border border-neutral-300 rounded font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Charge Department</label>
                  <select
                    value={formData.department_id || ''}
                    onChange={(e) => setFormData({ ...formData, department_id: e.target.value || undefined })}
                    className="w-full p-2 border border-neutral-300 rounded bg-white"
                  >
                    <option value="">No department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={formData.is_financed}
                    onChange={(e) => setFormData({ ...formData, is_financed: e.target.checked })}
                    className="text-[#FF6A1A] focus:ring-[#FF6A1A] rounded"
                  />
                  <span>Financed Asset</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={formData.is_leased}
                    onChange={(e) => setFormData({ ...formData, is_leased: e.target.checked })}
                    className="text-[#FF6A1A] focus:ring-[#FF6A1A] rounded"
                  />
                  <span>Leased Asset</span>
                </label>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Acquisition comments, terms..."
                  className="w-full p-2 border border-neutral-300 rounded"
                />
              </div>

              <div className="pt-3 border-t border-neutral-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-neutral-300 text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded bg-[#FF6A1A] hover:bg-[#e55a10] text-white font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Acquisition Info'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
