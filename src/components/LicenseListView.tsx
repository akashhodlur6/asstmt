/**
 * AssetMT - Software & License Tracking
 * Manage software licenses, key references, allocations to assets and employees, and expiry monitoring
 * Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
 */

import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Plus,
  Search,
  Users,
  Laptop,
  Calendar,
  Building2,
  DollarSign,
  Eye,
  EyeOff,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import {
  SoftwareLicense,
  SoftwareLicenseType,
  SoftwareLicenseAllocation,
  Vendor,
  Asset,
  Employee,
  CreateLicenseInput,
  AllocateLicenseInput,
} from '../../shared/types.ts';
import { api } from '../lib/api.ts';

interface LicenseListViewProps {
  token: string;
  isTenantAdmin: boolean;
  onNavigateToAsset?: (assetId: string) => void;
  onNavigateToEmployee?: (employeeId: string) => void;
}

export const LicenseListView: React.FC<LicenseListViewProps> = ({
  token,
  isTenantAdmin,
  onNavigateToAsset,
  onNavigateToEmployee,
}) => {
  const [licenses, setLicenses] = useState<SoftwareLicense[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState<SoftwareLicense | null>(null);
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);

  // Forms
  const [formData, setFormData] = useState<CreateLicenseInput>({
    software_name: '',
    vendor_id: '',
    publisher: '',
    license_key: '',
    license_type: 'Per User',
    purchased_quantity: 5,
    renewal_date: '',
    expiry_date: '',
    purchase_cost: 0,
    currency: 'USD',
    notes: '',
  });

  const [allocData, setAllocData] = useState<AllocateLicenseInput>({
    allocation_type: 'Employee',
    asset_id: '',
    employee_id: '',
    notes: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [lRes, vRes, aRes, eRes] = await Promise.all([
        api.getLicenses(token),
        api.getVendors(token),
        api.getAssets(token),
        api.getEmployees(token),
      ]);

      if (lRes.success && lRes.data) setLicenses(lRes.data);
      if (vRes.success && vRes.data) setVendors(vRes.data);
      if (aRes.success && aRes.data) setAssets(aRes.data);
      if (eRes.success && eRes.data) setEmployees(eRes.data);
    } catch (err) {
      console.error('Failed to load software licenses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const toggleRevealKey = (id: string) => {
    setRevealedKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenCreate = () => {
    setFormData({
      software_name: '',
      vendor_id: vendors[0]?.id || '',
      publisher: '',
      license_key: '',
      license_type: 'Per User',
      purchased_quantity: 5,
      renewal_date: '',
      expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      purchase_cost: 0,
      currency: 'USD',
      notes: '',
    });
    setFormErrors({});
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.software_name.trim()) {
      setFormErrors({ software_name: 'Software name is required' });
      return;
    }
    if (!formData.purchased_quantity || formData.purchased_quantity <= 0) {
      setFormErrors({ purchased_quantity: 'Purchased quantity must be greater than 0' });
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.createLicense(token, formData);
      if (res.success) {
        setIsCreateModalOpen(false);
        await loadData();
      } else {
        setFormErrors({ submit: res.error || 'Failed to create license' });
      }
    } catch (err: any) {
      setFormErrors({ submit: err.message || 'An unexpected error occurred' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDetail = async (lic: SoftwareLicense) => {
    try {
      const res = await api.getLicense(token, lic.id);
      if (res.success && res.data) {
        setSelectedLicense(res.data);
      } else {
        setSelectedLicense(lic);
      }
    } catch {
      setSelectedLicense(lic);
    }
  };

  const handleOpenAllocate = (lic: SoftwareLicense) => {
    setSelectedLicense(lic);
    setAllocData({
      allocation_type: 'Employee',
      asset_id: assets[0]?.id || '',
      employee_id: employees[0]?.id || '',
      notes: '',
    });
    setFormErrors({});
    setIsAllocateModalOpen(true);
  };

  const handleAllocateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLicense) return;

    if (allocData.allocation_type === 'Asset' && !allocData.asset_id) {
      setFormErrors({ target: 'Please select an asset to assign the license' });
      return;
    }
    if (allocData.allocation_type === 'Employee' && !allocData.employee_id) {
      setFormErrors({ target: 'Please select an employee to assign the license' });
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.allocateLicense(token, selectedLicense.id, allocData);
      if (res.success) {
        setIsAllocateModalOpen(false);
        await loadData();
        if (selectedLicense) {
          await handleOpenDetail(selectedLicense);
        }
      } else {
        setFormErrors({ submit: res.error || 'Failed to allocate license' });
      }
    } catch (err: any) {
      setFormErrors({ submit: err.message || 'An error occurred during allocation' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReleaseAllocation = async (licenseId: string, allocId: string) => {
    if (!confirm('Are you sure you want to release this license seat? It will be returned to the pool.')) return;
    try {
      const res = await api.releaseLicense(token, licenseId, allocId);
      if (res.success) {
        await loadData();
        if (selectedLicense && selectedLicense.id === licenseId) {
          await handleOpenDetail(selectedLicense);
        }
      }
    } catch (err) {
      console.error('Failed to release license allocation:', err);
    }
  };

  const filteredLicenses = licenses.filter((l) => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchName = l.software_name.toLowerCase().includes(q);
      const matchPub = l.publisher?.toLowerCase().includes(q);
      const matchVendor = l.vendor?.name?.toLowerCase().includes(q);
      if (!matchName && !matchPub && !matchVendor) return false;
    }
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-[#FF6A1A]/10 flex items-center justify-center text-[#FF6A1A]">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">Software & License Tracking</h1>
            <p className="text-xs text-neutral-500">
              Track subscriptions, enterprise seats, license keys, and enforce allocation quotas across assets and employees
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
              <span>Add Software License</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-3 bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-neutral-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search software, publisher, vendor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-neutral-300 rounded font-medium focus:outline-none focus:border-[#FF6A1A]"
          />
        </div>
        <div className="text-xs font-medium text-neutral-500">
          Total Licenses: <span className="font-bold text-neutral-800">{licenses.length}</span>
        </div>
      </div>

      {/* Licenses Table */}
      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3">Software / Product</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">License Key Reference</th>
                <th className="px-4 py-3">Seats & Allocation</th>
                <th className="px-4 py-3">Renewal / Expiry</th>
                <th className="px-4 py-3">Vendor / Publisher</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-400">
                    Loading software licenses...
                  </td>
                </tr>
              ) : filteredLicenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-400">
                    No software licenses found.
                  </td>
                </tr>
              ) : (
                filteredLicenses.map((lic) => {
                  const purchased = Number(lic.purchased_quantity) || 0;
                  const allocated = Number(lic.allocated_quantity) || 0;
                  const available = Math.max(0, purchased - allocated);
                  const isFull = available === 0;

                  return (
                    <tr key={lic.id} className="hover:bg-neutral-50/80 transition">
                      <td className="px-4 py-3">
                        <div className="font-bold text-neutral-900">{lic.software_name}</div>
                        {lic.publisher && (
                          <div className="text-[11px] text-neutral-500">{lic.publisher}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-100 text-neutral-700">
                          {lic.license_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-neutral-700">
                          <span>
                            {revealedKeys[lic.id] || !lic.license_key?.startsWith('••••')
                              ? lic.license_key || '—'
                              : lic.license_key}
                          </span>
                          {lic.license_key && (
                            <button
                              type="button"
                              onClick={() => toggleRevealKey(lic.id)}
                              className="text-neutral-400 hover:text-neutral-600 cursor-pointer"
                              title={revealedKeys[lic.id] ? 'Mask key' : 'Reveal key'}
                            >
                              {revealedKeys[lic.id] ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-32">
                          <div className="flex items-center justify-between text-[11px] font-medium mb-1">
                            <span className="text-neutral-700">
                              {allocated} / {purchased} used
                            </span>
                            <span
                              className={`font-semibold ${
                                isFull ? 'text-amber-600' : 'text-emerald-600'
                              }`}
                            >
                              {available} left
                            </span>
                          </div>
                          <div className="w-full bg-neutral-200 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isFull ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{
                                width: `${Math.min(100, (allocated / purchased) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-neutral-800">
                        {lic.expiry_date || lic.renewal_date || 'Perpetual'}
                        {lic.days_until_expiry !== undefined && (
                          <div
                            className={`text-[10px] font-semibold mt-0.5 ${
                              lic.days_until_expiry < 0
                                ? 'text-red-600'
                                : lic.days_until_expiry <= 30
                                ? 'text-amber-600'
                                : 'text-neutral-400'
                            }`}
                          >
                            {lic.days_until_expiry < 0
                              ? `Expired ${Math.abs(lic.days_until_expiry)}d ago`
                              : `${lic.days_until_expiry}d left`}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-neutral-700">
                        {lic.vendor?.name || lic.publisher || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isTenantAdmin && !isFull && (
                            <button
                              onClick={() => handleOpenAllocate(lic)}
                              className="px-2 py-1 rounded text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 cursor-pointer"
                            >
                              Assign Seat
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenDetail(lic)}
                            className="px-2.5 py-1 rounded text-xs font-medium border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 cursor-pointer"
                          >
                            Allocations ({lic.allocated_quantity})
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* License Allocations & History Modal */}
      {selectedLicense && !isAllocateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-neutral-200">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                  License Details & Allocations
                </span>
                <h3 className="text-base font-bold text-neutral-900">{selectedLicense.software_name}</h3>
              </div>
              <button
                onClick={() => setSelectedLicense(null)}
                className="w-7 h-7 rounded flex items-center justify-center hover:bg-neutral-100 text-neutral-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase">License Type</div>
                  <div className="font-semibold text-neutral-800">{selectedLicense.license_type}</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase">Purchased</div>
                  <div className="font-mono font-bold text-neutral-800">{selectedLicense.purchased_quantity} Seats</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase">Allocated</div>
                  <div className="font-mono font-bold text-neutral-800">{selectedLicense.allocated_quantity} Seats</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase">Available</div>
                  <div className="font-mono font-bold text-emerald-600">
                    {Math.max(0, selectedLicense.purchased_quantity - selectedLicense.allocated_quantity)} Seats
                  </div>
                </div>
              </div>

              {/* Allocations Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-neutral-700 uppercase tracking-wide">
                    Seat Allocations ({selectedLicense.allocations?.length || 0})
                  </span>
                  {isTenantAdmin &&
                    selectedLicense.allocated_quantity < selectedLicense.purchased_quantity && (
                      <button
                        onClick={() => handleOpenAllocate(selectedLicense)}
                        className="px-2.5 py-1 rounded text-xs font-semibold bg-[#FF6A1A] text-white hover:bg-[#e55a10] cursor-pointer"
                      >
                        + Allocate Seat
                      </button>
                    )}
                </div>

                {(!selectedLicense.allocations || selectedLicense.allocations.length === 0) ? (
                  <div className="p-6 text-center bg-neutral-50 rounded border border-neutral-200 text-neutral-400">
                    No active allocations found for this software license.
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg overflow-hidden">
                    {selectedLicense.allocations.map((alloc) => (
                      <div
                        key={alloc.id}
                        className="p-3 flex items-center justify-between bg-white hover:bg-neutral-50"
                      >
                        <div className="flex items-center gap-2.5">
                          {alloc.allocation_type === 'Asset' ? (
                            <Laptop className="w-4 h-4 text-blue-500" />
                          ) : (
                            <Users className="w-4 h-4 text-purple-500" />
                          )}
                          <div>
                            <div className="font-semibold text-neutral-900">
                              {alloc.allocation_type === 'Asset'
                                ? alloc.asset?.name || 'Asset'
                                : alloc.employee?.full_name || 'Employee'}
                            </div>
                            <div className="font-mono text-[10px] text-neutral-400">
                              {alloc.allocation_type === 'Asset'
                                ? `Tag: ${alloc.asset?.asset_tag || 'N/A'}`
                                : `Code: ${alloc.employee?.employee_code || 'N/A'}`}
                              {' • '}Allocated on {new Date(alloc.allocated_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              alloc.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-neutral-100 text-neutral-500'
                            }`}
                          >
                            {alloc.status}
                          </span>
                          {isTenantAdmin && alloc.status === 'Active' && (
                            <button
                              onClick={() => handleReleaseAllocation(selectedLicense.id, alloc.id)}
                              className="px-2 py-1 rounded text-[11px] font-medium border border-neutral-200 text-red-600 hover:bg-red-50 cursor-pointer"
                            >
                              Release Seat
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex justify-end">
              <button
                onClick={() => setSelectedLicense(null)}
                className="px-4 py-1.5 rounded text-xs font-medium bg-neutral-900 text-white cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Allocate Seat Modal */}
      {isAllocateModalOpen && selectedLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-neutral-200">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-neutral-900">
                Allocate Seat: {selectedLicense.software_name}
              </h3>
              <button
                onClick={() => setIsAllocateModalOpen(false)}
                className="w-7 h-7 rounded flex items-center justify-center hover:bg-neutral-100 text-neutral-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAllocateSubmit} className="p-5 space-y-4 text-xs">
              {formErrors.submit && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
                  {formErrors.submit}
                </div>
              )}

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Target Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="allocation_type"
                      checked={allocData.allocation_type === 'Employee'}
                      onChange={() => setAllocData({ ...allocData, allocation_type: 'Employee' })}
                      className="text-[#FF6A1A] focus:ring-[#FF6A1A]"
                    />
                    <span>Employee User</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="allocation_type"
                      checked={allocData.allocation_type === 'Asset'}
                      onChange={() => setAllocData({ ...allocData, allocation_type: 'Asset' })}
                      className="text-[#FF6A1A] focus:ring-[#FF6A1A]"
                    />
                    <span>Hardware Asset</span>
                  </label>
                </div>
              </div>

              {allocData.allocation_type === 'Employee' ? (
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Assign to Employee *</label>
                  <select
                    value={allocData.employee_id}
                    onChange={(e) => setAllocData({ ...allocData, employee_id: e.target.value })}
                    className="w-full p-2 border border-neutral-300 rounded bg-white"
                    required
                  >
                    <option value="">Select Employee</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_code})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Assign to Asset *</label>
                  <select
                    value={allocData.asset_id}
                    onChange={(e) => setAllocData({ ...allocData, asset_id: e.target.value })}
                    className="w-full p-2 border border-neutral-300 rounded bg-white"
                    required
                  >
                    <option value="">Select Asset</option>
                    {assets.map((ast) => (
                      <option key={ast.id} value={ast.id}>
                        {ast.name} ({ast.asset_tag})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Allocation Notes</label>
                <input
                  type="text"
                  value={allocData.notes || ''}
                  onChange={(e) => setAllocData({ ...allocData, notes: e.target.value })}
                  placeholder="Department approval, reason..."
                  className="w-full p-2 border border-neutral-300 rounded"
                />
              </div>

              <div className="pt-3 border-t border-neutral-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAllocateModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-neutral-300 text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded bg-[#FF6A1A] hover:bg-[#e55a10] text-white font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Assigning...' : 'Assign Seat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add License Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-neutral-200">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-neutral-900">Add Software License</h3>
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

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Software / Product Name *</label>
                <input
                  type="text"
                  value={formData.software_name}
                  onChange={(e) => setFormData({ ...formData, software_name: e.target.value })}
                  placeholder="e.g. Adobe Creative Cloud, Microsoft 365"
                  className="w-full p-2 border border-neutral-300 rounded"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Publisher</label>
                  <input
                    type="text"
                    value={formData.publisher || ''}
                    onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                    placeholder="e.g. Adobe, Microsoft"
                    className="w-full p-2 border border-neutral-300 rounded"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">License Type *</label>
                  <select
                    value={formData.license_type}
                    onChange={(e) => setFormData({ ...formData, license_type: e.target.value as SoftwareLicenseType })}
                    className="w-full p-2 border border-neutral-300 rounded bg-white"
                  >
                    <option value="Per User">Per User</option>
                    <option value="Per Device">Per Device</option>
                    <option value="Subscription">Subscription</option>
                    <option value="Site">Site</option>
                    <option value="Enterprise">Enterprise</option>
                    <option value="Volume">Volume</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">License Key / Serial Reference</label>
                <input
                  type="text"
                  value={formData.license_key || ''}
                  onChange={(e) => setFormData({ ...formData, license_key: e.target.value })}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  className="w-full p-2 border border-neutral-300 rounded font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Purchased Seats / Quota *</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.purchased_quantity}
                    onChange={(e) => setFormData({ ...formData, purchased_quantity: parseInt(e.target.value) || 1 })}
                    className="w-full p-2 border border-neutral-300 rounded font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Vendor</label>
                  <select
                    value={formData.vendor_id || ''}
                    onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value || undefined })}
                    className="w-full p-2 border border-neutral-300 rounded bg-white"
                  >
                    <option value="">No vendor</option>
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
                  <label className="block font-semibold text-neutral-700 mb-1">Expiry / Renewal Date</label>
                  <input
                    type="date"
                    value={formData.expiry_date || ''}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    className="w-full p-2 border border-neutral-300 rounded font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Purchase Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.purchase_cost || ''}
                    onChange={(e) => setFormData({ ...formData, purchase_cost: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="w-full p-2 border border-neutral-300 rounded font-mono"
                  />
                </div>
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
                  {submitting ? 'Creating...' : 'Create License'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
