/**
 * AssetMT - Vendor Directory & Management View
 * AssetTiger-style compact enterprise vendor directory.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import { Vendor, CreateVendorInput, MaintenanceRecord } from '../../shared/types.ts';
import { validateVendor } from '../../shared/validation.ts';
import {
  Building2,
  Search,
  Plus,
  Edit3,
  UserCheck,
  UserX,
  RefreshCw,
  Mail,
  Phone,
  Globe,
  FileText,
  Wrench,
  AlertCircle,
  CheckCircle2,
  X,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

interface VendorListViewProps {
  onNavigate: (view: string, id?: string) => void;
}

export const VendorListView: React.FC<VendorListViewProps> = ({ onNavigate }) => {
  const { token, role } = useAuth();
  const isTenantAdmin = role === 'TENANT_ADMIN';

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  // Selected Vendor Detail Drawer
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [vendorWorkOrders, setVendorWorkOrders] = useState<MaintenanceRecord[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Add / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [formData, setFormData] = useState<CreateVendorInput>({
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    website: '',
    notes: '',
    is_active: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchVendors = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.getVendors(token, {
        search: search.trim() || undefined,
        is_active: activeFilter || undefined,
      });
      if (res.success) {
        setVendors(res.data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading vendors');
    } finally {
      setLoading(false);
    }
  }, [token, search, activeFilter]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  // Load Drawer details when vendor is clicked
  const handleSelectVendor = async (v: Vendor) => {
    setSelectedVendor(v);
    if (!token) return;
    try {
      setDrawerLoading(true);
      const res = await api.getMaintenanceRecords(token, { vendor_id: v.id, limit: 50 });
      if (res.success) {
        setVendorWorkOrders(res.data);
      }
    } catch {
      setVendorWorkOrders([]);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingVendor(null);
    setFormData({
      name: '',
      contact_name: '',
      email: '',
      phone: '',
      website: '',
      notes: '',
      is_active: true,
    });
    setFormErrors({});
    setModalError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (v: Vendor) => {
    setEditingVendor(v);
    setFormData({
      name: v.name,
      contact_name: v.contact_name || '',
      email: v.email || '',
      phone: v.phone || '',
      website: v.website || '',
      notes: v.notes || '',
      is_active: v.is_active,
    });
    setFormErrors({});
    setModalError(null);
    setShowModal(true);
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const validation = validateVendor(formData, Boolean(editingVendor));
    if (!validation.isValid) {
      setFormErrors(validation.errors);
      return;
    }
    setFormErrors({});
    setModalError(null);

    try {
      setModalLoading(true);
      if (editingVendor) {
        const res = await api.updateVendor(token, editingVendor.id, formData);
        if (res.success) {
          setShowModal(false);
          await fetchVendors();
          if (selectedVendor?.id === editingVendor.id) {
            setSelectedVendor(res.data);
          }
        }
      } else {
        const res = await api.createVendor(token, formData);
        if (res.success) {
          setShowModal(false);
          await fetchVendors();
        }
      }
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Failed to save vendor');
    } finally {
      setModalLoading(false);
    }
  };

  const handleToggleActive = async (v: Vendor, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token || !isTenantAdmin) return;
    try {
      const res = await api.toggleVendorActive(token, v.id, !v.is_active);
      if (res.success) {
        setVendors((prev) => prev.map((item) => (item.id === v.id ? res.data : item)));
        if (selectedVendor?.id === v.id) {
          setSelectedVendor(res.data);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update vendor active state');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 select-text font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">
            Vendor Directory
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Service providers, external contractors, suppliers, and equipment maintenance vendors
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchVendors}
            disabled={loading}
            className="px-3 py-1.5 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-medium rounded transition-colors inline-flex items-center gap-1.5"
            title="Refresh vendor list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {isTenantAdmin && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-3.5 py-1.5 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Vendor</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white border border-neutral-200 rounded-lg p-3.5 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search vendor name, contact person, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
          />
        </div>

        <div className="w-full sm:w-48">
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A] bg-white text-neutral-700"
          >
            <option value="">All Statuses</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Main Grid: List Table + Detail Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Table (2 Columns on large screen) */}
        <div className="lg:col-span-2 bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-neutral-50/70 border-b border-neutral-200 text-neutral-600 font-semibold select-none">
                <tr>
                  <th className="py-3 px-4">Vendor Name</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Contact Details</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading && vendors.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-xs text-neutral-400">
                      Loading vendor directory...
                    </td>
                  </tr>
                ) : vendors.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center">
                      <div className="max-w-xs mx-auto space-y-2">
                        <Building2 className="w-8 h-8 text-neutral-300 mx-auto" />
                        <div className="text-xs font-semibold text-neutral-800">
                          No Vendors Registered
                        </div>
                        <p className="text-[11px] text-neutral-500">
                          {search
                            ? 'No vendors matched your search criteria.'
                            : 'Register maintenance service providers and contractors to assign work orders.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  vendors.map((v) => {
                    const isSelected = selectedVendor?.id === v.id;
                    return (
                      <tr
                        key={v.id}
                        onClick={() => handleSelectVendor(v)}
                        className={`transition-colors cursor-pointer ${
                          isSelected ? 'bg-orange-50/50' : 'hover:bg-neutral-50/80'
                        }`}
                      >
                        <td className="py-2.5 px-4 font-semibold text-neutral-900">
                          <div className="flex items-center gap-1.5">
                            <span className={isSelected ? 'text-[#FF6A1A]' : ''}>{v.name}</span>
                          </div>
                        </td>

                        <td className="py-2.5 px-4 text-neutral-700">
                          {v.contact_name || <span className="text-neutral-400">—</span>}
                        </td>

                        <td className="py-2.5 px-4 text-neutral-600">
                          <div className="space-y-0.5">
                            {v.email && (
                              <div className="flex items-center gap-1 font-mono text-[11px]">
                                <Mail className="w-3 h-3 text-neutral-400" />
                                <span>{v.email}</span>
                              </div>
                            )}
                            {v.phone && (
                              <div className="flex items-center gap-1 text-[11px]">
                                <Phone className="w-3 h-3 text-neutral-400" />
                                <span>{v.phone}</span>
                              </div>
                            )}
                            {!v.email && !v.phone && <span className="text-neutral-400">—</span>}
                          </div>
                        </td>

                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${
                              v.is_active
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-neutral-100 text-neutral-600 border-neutral-200'
                            }`}
                          >
                            {v.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        <td className="py-2.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {isTenantAdmin && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(v)}
                                  className="p-1 rounded text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100"
                                  title="Edit Vendor"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleToggleActive(v, e)}
                                  className={`p-1 rounded ${
                                    v.is_active
                                      ? 'text-amber-600 hover:bg-amber-50'
                                      : 'text-emerald-600 hover:bg-emerald-50'
                                  }`}
                                  title={v.is_active ? 'Deactivate Vendor' : 'Activate Vendor'}
                                >
                                  {v.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => handleSelectVendor(v)}
                              className="text-neutral-400 hover:text-neutral-700 p-1"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
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

        {/* Vendor Detail Drawer (1 Column) */}
        <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs space-y-4">
          {selectedVendor ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between border-b border-neutral-100 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-neutral-900">{selectedVendor.name}</h2>
                  <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5">
                    <span
                      className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-medium ${
                        selectedVendor.is_active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                      }`}
                    >
                      {selectedVendor.is_active ? 'Active Vendor' : 'Inactive'}
                    </span>
                  </div>
                </div>
                {isTenantAdmin && (
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(selectedVendor)}
                    className="px-2.5 py-1 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold rounded inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3 text-neutral-500" />
                    <span>Edit</span>
                  </button>
                )}
              </div>

              {/* Contact Info Card */}
              <div className="space-y-2 text-xs">
                {selectedVendor.contact_name && (
                  <div>
                    <span className="text-neutral-400 block text-[11px]">Primary Contact:</span>
                    <span className="font-semibold text-neutral-900">{selectedVendor.contact_name}</span>
                  </div>
                )}
                {selectedVendor.email && (
                  <div>
                    <span className="text-neutral-400 block text-[11px]">Email:</span>
                    <a
                      href={`mailto:${selectedVendor.email}`}
                      className="font-mono text-blue-600 hover:underline"
                    >
                      {selectedVendor.email}
                    </a>
                  </div>
                )}
                {selectedVendor.phone && (
                  <div>
                    <span className="text-neutral-400 block text-[11px]">Phone:</span>
                    <span className="text-neutral-800">{selectedVendor.phone}</span>
                  </div>
                )}
                {selectedVendor.website && (
                  <div>
                    <span className="text-neutral-400 block text-[11px]">Website:</span>
                    <a
                      href={selectedVendor.website.startsWith('http') ? selectedVendor.website : `https://${selectedVendor.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      <span>{selectedVendor.website}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                {selectedVendor.notes && (
                  <div className="pt-2 border-t border-neutral-100">
                    <span className="text-neutral-400 block text-[11px]">Notes:</span>
                    <p className="text-neutral-600 italic text-[11px]">{selectedVendor.notes}</p>
                  </div>
                )}
              </div>

              {/* Associated Maintenance Work Orders */}
              <div className="pt-3 border-t border-neutral-100 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Service History</span>
                  </h3>
                  <span className="text-[10px] font-mono text-neutral-500">
                    {vendorWorkOrders.length} Work Order{vendorWorkOrders.length === 1 ? '' : 's'}
                  </span>
                </div>

                {drawerLoading ? (
                  <div className="py-4 text-center text-xs text-neutral-400">Loading work orders...</div>
                ) : vendorWorkOrders.length === 0 ? (
                  <div className="py-4 text-center text-xs text-neutral-400">
                    No work orders assigned to this vendor yet.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {vendorWorkOrders.map((wo) => (
                      <div
                        key={wo.id}
                        onClick={() => onNavigate('maintenance', wo.id)}
                        className="p-2.5 rounded bg-neutral-50 hover:bg-neutral-100 transition-colors cursor-pointer border border-neutral-200 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-neutral-900 text-[11px]">
                            {wo.work_order_number}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-medium ${
                              wo.status === 'Completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : wo.status === 'In Progress'
                                ? 'bg-blue-100 text-blue-800'
                                : wo.status === 'Scheduled'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-neutral-200 text-neutral-800'
                            }`}
                          >
                            {wo.status}
                          </span>
                        </div>
                        <div className="font-medium text-neutral-800 truncate">{wo.title}</div>
                        {wo.service_cost && (
                          <div className="text-[10px] font-mono text-neutral-500">
                            Cost: ${Number(wo.service_cost).toFixed(2)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-neutral-400 space-y-2">
              <Building2 className="w-8 h-8 text-neutral-300 mx-auto" />
              <p>Select a vendor to view details and service history.</p>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: Add / Edit Vendor */}
      {/* ========================================================================= */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-neutral-200 shadow-xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-neutral-800 text-white flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">
                    {editingVendor ? `Edit Vendor: ${editingVendor.name}` : 'Register New Vendor'}
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Service contractor or equipment maintenance partner
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Vendor / Contractor Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Precision Hardware Services"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-3 py-1.5 text-xs border rounded focus:outline-none ${
                    formErrors.name ? 'border-red-500 bg-red-50/20' : 'border-neutral-300 focus:border-[#FF6A1A]'
                  }`}
                />
                {formErrors.name && <p className="text-[11px] text-red-600 mt-1">{formErrors.name}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. John Miller"
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Work Email
                  </label>
                  <input
                    type="email"
                    placeholder="service@apextech.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs font-mono border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                  />
                  {formErrors.email && <p className="text-[11px] text-red-600 mt-1">{formErrors.email}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="+1 (555) 019-2834"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Website URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://apextech.com"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Service Specialization / Internal Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Authorized Apple Service Provider, SLA 24-hour turnaround..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={modalLoading}
                  className="px-3.5 py-1.5 border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-medium rounded transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-4 py-1.5 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {modalLoading ? 'Saving...' : editingVendor ? 'Update Vendor' : 'Register Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
