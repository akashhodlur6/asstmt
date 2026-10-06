/**
 * AssetMT - Contract Management
 * Tenant-scoped contract records with multi-asset linking, vendor relations, and renewal indicators
 * Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
 */

import React, { useState, useEffect } from 'react';
import {
  FileCheck2,
  Plus,
  Search,
  Filter,
  Calendar,
  Building2,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Link,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  X,
} from 'lucide-react';
import { Contract, ContractType, ContractStatus, Vendor, Asset, CreateContractInput } from '../../shared/types.ts';
import { api } from '../lib/api.ts';

interface ContractListViewProps {
  token: string;
  isTenantAdmin: boolean;
  onNavigateToAsset?: (assetId: string) => void;
}

export const ContractListView: React.FC<ContractListViewProps> = ({
  token,
  isTenantAdmin,
  onNavigateToAsset,
}) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  // Form State
  const [formData, setFormData] = useState<CreateContractInput>({
    contract_number: '',
    title: '',
    vendor_id: '',
    contract_type: 'Service Level Agreement',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    renewal_date: '',
    contract_value: undefined,
    currency: 'USD',
    auto_renew: false,
    status: 'Active',
    notes: '',
    asset_ids: [],
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [cRes, vRes, aRes] = await Promise.all([
        api.getContracts(token),
        api.getVendors(token),
        api.getAssets(token),
      ]);

      if (cRes.success && cRes.data) setContracts(cRes.data);
      if (vRes.success && vRes.data) setVendors(vRes.data);
      if (aRes.success && aRes.data) setAssets(aRes.data);
    } catch (err) {
      console.error('Failed to load contracts data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleOpenCreate = () => {
    setFormData({
      contract_number: `CON-${Date.now().toString().slice(-6)}`,
      title: '',
      vendor_id: vendors[0]?.id || '',
      contract_type: 'Maintenance',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      renewal_date: '',
      contract_value: 0,
      currency: 'USD',
      auto_renew: false,
      status: 'Active',
      notes: '',
      asset_ids: [],
    });
    setFormErrors({});
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!formData.contract_number.trim()) errors.contract_number = 'Contract number is required';
    if (!formData.title.trim()) errors.title = 'Contract title is required';
    if (!formData.start_date) errors.start_date = 'Start date is required';
    if (!formData.end_date) errors.end_date = 'End date is required';
    else if (formData.end_date < formData.start_date) errors.end_date = 'End date cannot precede start date';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.createContract(token, formData);
      if (res.success) {
        setIsCreateModalOpen(false);
        await loadData();
      } else {
        setFormErrors({ submit: res.error || 'Failed to create contract' });
      }
    } catch (err: any) {
      setFormErrors({ submit: err.message || 'An unexpected error occurred' });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredContracts = contracts.filter((c) => {
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchNum = c.contract_number.toLowerCase().includes(q);
      const matchTitle = c.title.toLowerCase().includes(q);
      const matchVendor = c.vendor?.name?.toLowerCase().includes(q);
      if (!matchNum && !matchTitle && !matchVendor) return false;
    }
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-[#FF6A1A]/10 flex items-center justify-center text-[#FF6A1A]">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">Contract Management</h1>
            <p className="text-xs text-neutral-500">
              Commercial multi-tenant contract lifecycle: master services, leases, maintenance, warranties, and multi-asset coverage
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          {isTenantAdmin && (
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-[#FF6A1A] hover:bg-[#e55a10] text-white transition shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Contract</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-neutral-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search by contract #, title, vendor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-neutral-300 rounded font-medium focus:outline-none focus:border-[#FF6A1A]"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
          {['ALL', 'Active', 'Draft', 'Expired', 'Terminated'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
                statusFilter === st
                  ? 'bg-neutral-900 text-white'
                  : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Contract Table */}
      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3">Contract #</th>
                <th className="px-4 py-3">Title & Type</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Coverage Dates</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Linked Assets</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-400">
                    Loading contracts...
                  </td>
                </tr>
              ) : filteredContracts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-400">
                    No contracts found matching filter criteria.
                  </td>
                </tr>
              ) : (
                filteredContracts.map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-50/80 transition">
                    <td className="px-4 py-3 font-mono font-bold text-neutral-900">
                      {c.contract_number}
                      {c.auto_renew && (
                        <span className="block text-[9px] font-sans font-medium text-emerald-600">
                          Auto-renews
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-neutral-800">{c.title}</div>
                      <div className="text-[11px] text-neutral-500">{c.contract_type}</div>
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      {c.vendor ? (
                        <div className="flex items-center gap-1.5 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-neutral-400" />
                          <span>{c.vendor.name}</span>
                        </div>
                      ) : (
                        <span className="text-neutral-400 italic">None specified</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-[11px] text-neutral-800">
                        {c.start_date} to {c.end_date}
                      </div>
                      {c.days_until_expiry !== undefined && (
                        <div
                          className={`text-[10px] font-semibold mt-0.5 ${
                            c.days_until_expiry < 0
                              ? 'text-red-600'
                              : c.days_until_expiry <= 30
                              ? 'text-amber-600'
                              : 'text-neutral-400'
                          }`}
                        >
                          {c.days_until_expiry < 0
                            ? `Expired ${Math.abs(c.days_until_expiry)} days ago`
                            : `${c.days_until_expiry} days remaining`}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-neutral-800">
                      {c.contract_value !== null && c.contract_value !== undefined
                        ? `${c.currency} ${Number(c.contract_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-100 text-neutral-700 border border-neutral-200">
                        <Link className="w-3 h-3 text-neutral-500" />
                        {c.assets?.length || 0} Assets
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : c.status === 'Expired'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : c.status === 'Draft'
                            ? 'bg-neutral-100 text-neutral-600'
                            : 'bg-neutral-200 text-neutral-700'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedContract(c)}
                        className="px-2.5 py-1 rounded text-xs font-medium border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 cursor-pointer"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contract Detail Modal */}
      {selectedContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-neutral-200">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                  Contract Details
                </span>
                <h3 className="text-base font-bold text-neutral-900">{selectedContract.title}</h3>
              </div>
              <button
                onClick={() => setSelectedContract(null)}
                className="w-7 h-7 rounded flex items-center justify-center hover:bg-neutral-100 text-neutral-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase">Contract Number</div>
                  <div className="font-mono font-bold text-neutral-800">{selectedContract.contract_number}</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase">Type</div>
                  <div className="font-semibold text-neutral-800">{selectedContract.contract_type}</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase">Status</div>
                  <div className="font-bold text-neutral-800">{selectedContract.status}</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase">Vendor</div>
                  <div className="font-medium text-neutral-800">{selectedContract.vendor?.name || 'None'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase">Start Date</div>
                  <div className="font-mono text-neutral-800">{selectedContract.start_date}</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase">End Date</div>
                  <div className="font-mono font-bold text-neutral-800">{selectedContract.end_date}</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase">Contract Value</div>
                  <div className="font-mono font-bold text-neutral-900">
                    {selectedContract.contract_value !== null
                      ? `${selectedContract.currency} ${Number(selectedContract.contract_value).toLocaleString()}`
                      : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase">Auto Renew</div>
                  <div className="font-medium text-neutral-800">{selectedContract.auto_renew ? 'Yes' : 'No'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase">Renewal Date</div>
                  <div className="font-mono text-neutral-800">{selectedContract.renewal_date || 'N/A'}</div>
                </div>
              </div>

              {selectedContract.notes && (
                <div>
                  <div className="text-[11px] font-semibold text-neutral-500 uppercase">Notes & Special Terms</div>
                  <p className="mt-1 p-2.5 rounded bg-neutral-50 border border-neutral-200 text-neutral-700 whitespace-pre-wrap">
                    {selectedContract.notes}
                  </p>
                </div>
              )}

              {/* Linked Assets List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-semibold text-neutral-700 uppercase tracking-wide">
                    Covered / Linked Assets ({selectedContract.assets?.length || 0})
                  </div>
                </div>
                {(!selectedContract.assets || selectedContract.assets.length === 0) ? (
                  <div className="p-4 text-center bg-neutral-50 rounded border border-neutral-200 text-neutral-400">
                    No specific assets linked directly to this contract.
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg overflow-hidden">
                    {selectedContract.assets.map((asset) => (
                      <div key={asset.id} className="p-2.5 flex items-center justify-between bg-white hover:bg-neutral-50">
                        <div>
                          <div className="font-semibold text-neutral-900">{asset.name}</div>
                          <div className="font-mono text-[10px] text-neutral-500">{asset.asset_tag}</div>
                        </div>
                        {onNavigateToAsset && (
                          <button
                            onClick={() => {
                              setSelectedContract(null);
                              onNavigateToAsset(asset.id);
                            }}
                            className="text-xs font-medium text-[#FF6A1A] hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>Open Asset</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex justify-end">
              <button
                onClick={() => setSelectedContract(null)}
                className="px-4 py-1.5 rounded text-xs font-medium bg-neutral-900 text-white cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Contract Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto border border-neutral-200">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-neutral-900">Add New Contract</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="w-7 h-7 rounded flex items-center justify-center hover:bg-neutral-100 text-neutral-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 text-xs">
              {formErrors.submit && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
                  {formErrors.submit}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Contract Number *</label>
                  <input
                    type="text"
                    value={formData.contract_number}
                    onChange={(e) => setFormData({ ...formData, contract_number: e.target.value })}
                    className="w-full p-2 border border-neutral-300 rounded font-mono"
                    required
                  />
                  {formErrors.contract_number && <div className="text-red-500 text-[10px] mt-0.5">{formErrors.contract_number}</div>}
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Contract Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Dell Enterprise Hardware Maintenance"
                    className="w-full p-2 border border-neutral-300 rounded"
                    required
                  />
                  {formErrors.title && <div className="text-red-500 text-[10px] mt-0.5">{formErrors.title}</div>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Contract Type *</label>
                  <select
                    value={formData.contract_type}
                    onChange={(e) => setFormData({ ...formData, contract_type: e.target.value as ContractType })}
                    className="w-full p-2 border border-neutral-300 rounded bg-white"
                  >
                    <option value="Maintenance">Maintenance</option>
                    <option value="Lease">Lease</option>
                    <option value="Software License">Software License</option>
                    <option value="Service Level Agreement">Service Level Agreement</option>
                    <option value="Warranty">Warranty</option>
                    <option value="Procurement">Procurement</option>
                    <option value="Master Services">Master Services</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Vendor / Counterparty</label>
                  <select
                    value={formData.vendor_id || ''}
                    onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value || undefined })}
                    className="w-full p-2 border border-neutral-300 rounded bg-white"
                  >
                    <option value="">No vendor assigned</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full p-2 border border-neutral-300 rounded font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">End Date *</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full p-2 border border-neutral-300 rounded font-mono"
                    required
                  />
                  {formErrors.end_date && <div className="text-red-500 text-[10px] mt-0.5">{formErrors.end_date}</div>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Contract Value</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.contract_value || ''}
                    onChange={(e) => setFormData({ ...formData, contract_value: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="w-full p-2 border border-neutral-300 rounded font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full p-2 border border-neutral-300 rounded bg-white"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CAD">CAD ($)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Renewal Date</label>
                  <input
                    type="date"
                    value={formData.renewal_date || ''}
                    onChange={(e) => setFormData({ ...formData, renewal_date: e.target.value })}
                    className="w-full p-2 border border-neutral-300 rounded font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="auto_renew"
                  checked={formData.auto_renew}
                  onChange={(e) => setFormData({ ...formData, auto_renew: e.target.checked })}
                  className="rounded text-[#FF6A1A] focus:ring-[#FF6A1A]"
                />
                <label htmlFor="auto_renew" className="font-medium text-neutral-700 cursor-pointer">
                  Flag contract as Auto-Renewing
                </label>
              </div>

              {/* Multi-select Assets to Cover */}
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Select Covered Assets ({formData.asset_ids?.length || 0} selected)
                </label>
                <div className="max-h-36 overflow-y-auto border border-neutral-200 rounded p-2 bg-neutral-50 divide-y divide-neutral-200">
                  {assets.map((asset) => {
                    const isSelected = formData.asset_ids?.includes(asset.id);
                    return (
                      <label
                        key={asset.id}
                        className="flex items-center gap-2 py-1.5 px-1 hover:bg-neutral-100 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const cur = formData.asset_ids || [];
                            if (e.target.checked) {
                              setFormData({ ...formData, asset_ids: [...cur, asset.id] });
                            } else {
                              setFormData({ ...formData, asset_ids: cur.filter((id) => id !== asset.id) });
                            }
                          }}
                          className="rounded text-[#FF6A1A] focus:ring-[#FF6A1A]"
                        />
                        <span className="font-medium text-neutral-900">{asset.name}</span>
                        <span className="font-mono text-[10px] text-neutral-500">({asset.asset_tag})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Notes / Terms</label>
                <textarea
                  rows={2}
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full p-2 border border-neutral-300 rounded"
                  placeholder="Terms, cancellation clauses, coverage limits..."
                />
              </div>

              <div className="pt-3 border-t border-neutral-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-neutral-300 text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded bg-[#FF6A1A] hover:bg-[#e55a10] text-white font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Contract'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
