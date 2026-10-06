/**
 * AssetMT - Sites, Departments & Categories Manager
 * Provides working tenant-scoped Category/Department/Site/Location management.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import { Category, Department, Location, Site } from '../../shared/types.ts';
import {
  Plus,
  Building,
  MapPin,
  Tag,
  Briefcase,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Archive,
  ArchiveRestore,
  Edit2,
  X,
} from 'lucide-react';

export const OrganizationManager: React.FC = () => {
  const { token, companyName } = useAuth();

  const [activeTab, setActiveTab] = useState<'departments' | 'categories' | 'sites' | 'locations'>('departments');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // Department form state
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [deptDesc, setDeptDesc] = useState('');

  // Department edit modal state
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editDeptName, setEditDeptName] = useState('');
  const [editDeptCode, setEditDeptCode] = useState('');
  const [editDeptDesc, setEditDeptDesc] = useState('');

  // Category form state
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');

  // Site form state
  const [siteName, setSiteName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');

  // Location form state
  const [locSiteId, setLocSiteId] = useState('');
  const [locName, setLocName] = useState('');
  const [locDesc, setLocDesc] = useState('');

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const [deptRes, catRes, siteRes, locRes] = await Promise.all([
        api.getDepartments(token, true), // include archived for management view
        api.getCategories(token),
        api.getSites(token),
        api.getLocations(token),
      ]);
      if (deptRes.success) setDepartments(deptRes.data);
      if (catRes.success) setCategories(catRes.data);
      if (siteRes.success) {
        setSites(siteRes.data);
        if (siteRes.data.length > 0 && !locSiteId) {
          setLocSiteId(siteRes.data[0].id);
        }
      }
      if (locRes.success) setLocations(locRes.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading organization lookup records');
    } finally {
      setLoading(false);
    }
  }, [token, locSiteId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Department Handlers
  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !deptName.trim() || submitting) return;
    try {
      setSubmitting(true);
      setError(null);
      const res = await api.createDepartment(token, {
        name: deptName.trim(),
        code: deptCode.trim() || undefined,
        description: deptDesc.trim() || undefined,
      });
      if (res.success) {
        setDepartments((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
        setDeptName('');
        setDeptCode('');
        setDeptDesc('');
        setSuccess(`Department "${res.data.name}" added successfully.`);
        setTimeout(() => setSuccess(null), 3500);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create department');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditDept = (dept: Department) => {
    setEditingDept(dept);
    setEditDeptName(dept.name);
    setEditDeptCode(dept.code || '');
    setEditDeptDesc(dept.description || '');
  };

  const handleSaveEditDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingDept || !editDeptName.trim() || submitting) return;
    try {
      setSubmitting(true);
      setError(null);
      const res = await api.updateDepartment(token, editingDept.id, {
        name: editDeptName.trim(),
        code: editDeptCode.trim() || undefined,
        description: editDeptDesc.trim() || undefined,
      });
      if (res.success) {
        setDepartments((prev) =>
          prev.map((d) => (d.id === editingDept.id ? res.data : d)).sort((a, b) => a.name.localeCompare(b.name))
        );
        setEditingDept(null);
        setSuccess(`Department "${res.data.name}" updated successfully.`);
        setTimeout(() => setSuccess(null), 3500);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update department');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleArchiveDept = async (dept: Department) => {
    if (!token) return;
    const action = dept.is_archived ? 'restore' : 'archive';
    const confirmMsg = dept.is_archived
      ? `Re-activate department "${dept.name}"? It will become available for new employee assignments.`
      : `Archive department "${dept.name}"? It will be hidden from new employee assignments, but remains preserved on existing employees.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setError(null);
      const res = await api.updateDepartment(token, dept.id, {
        is_archived: !dept.is_archived,
      });
      if (res.success) {
        setDepartments((prev) => prev.map((d) => (d.id === dept.id ? res.data : d)));
        setSuccess(
          `Department "${dept.name}" ${dept.is_archived ? 'restored to active' : 'archived'} successfully.`
        );
        setTimeout(() => setSuccess(null), 3500);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to ${action} department`);
    }
  };

  // Category Handlers
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !catName.trim() || submitting) return;
    try {
      setSubmitting(true);
      setError(null);
      const res = await api.createCategory(token, {
        name: catName.trim(),
        description: catDesc.trim() || undefined,
      });
      if (res.success) {
        setCategories((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
        setCatName('');
        setCatDesc('');
        setSuccess(`Category "${res.data.name}" added successfully.`);
        setTimeout(() => setSuccess(null), 3500);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create category');
    } finally {
      setSubmitting(false);
    }
  };

  // Site Handlers
  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !siteName.trim() || submitting) return;
    try {
      setSubmitting(true);
      setError(null);
      const res = await api.createSite(token, {
        name: siteName.trim(),
        address: siteAddress.trim() || undefined,
      });
      if (res.success) {
        setSites((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
        setSiteName('');
        setSiteAddress('');
        if (!locSiteId) setLocSiteId(res.data.id);
        setSuccess(`Site "${res.data.name}" added successfully.`);
        setTimeout(() => setSuccess(null), 3500);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create site');
    } finally {
      setSubmitting(false);
    }
  };

  // Location Handlers
  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !locSiteId || !locName.trim() || submitting) return;
    try {
      setSubmitting(true);
      setError(null);
      const res = await api.createLocation(token, {
        site_id: locSiteId,
        name: locName.trim(),
        description: locDesc.trim() || undefined,
      });
      if (res.success) {
        setLocations((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
        setLocName('');
        setLocDesc('');
        setSuccess(`Location "${res.data.name}" added successfully.`);
        setTimeout(() => setSuccess(null), 3500);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create location');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 select-text font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">
            Departments, Sites & Categories
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Configure tenant-scoped organization taxonomy, departments and physical facilities for{' '}
            <span className="font-semibold text-neutral-800">{companyName}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="px-3 py-1.5 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-medium rounded transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 text-xs text-green-700 rounded flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-neutral-200 flex items-center gap-1 text-xs font-medium select-none">
        <button
          onClick={() => setActiveTab('departments')}
          className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'departments'
              ? 'border-[#FF6A1A] text-[#FF6A1A] font-semibold'
              : 'border-transparent text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>Departments ({departments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'categories'
              ? 'border-[#FF6A1A] text-[#FF6A1A] font-semibold'
              : 'border-transparent text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          <span>Categories ({categories.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('sites')}
          className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'sites'
              ? 'border-[#FF6A1A] text-[#FF6A1A] font-semibold'
              : 'border-transparent text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Sites ({sites.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('locations')}
          className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'locations'
              ? 'border-[#FF6A1A] text-[#FF6A1A] font-semibold'
              : 'border-transparent text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>Locations ({locations.length})</span>
        </button>
      </div>

      {/* Departments View */}
      {activeTab === 'departments' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Add Department Form */}
          <div className="md:col-span-1 bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs h-fit">
            <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider mb-3">
              Add Department
            </h2>
            <form onSubmit={handleAddDepartment} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Department Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Engineering"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Department Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. ENG-01"
                  value={deptCode}
                  onChange={(e) => setDeptCode(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional department notes"
                  value={deptDesc}
                  onChange={(e) => setDeptDesc(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-1.5 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded transition-colors inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{submitting ? 'Adding...' : 'Add Department'}</span>
              </button>

              <p className="text-[11px] text-neutral-400 mt-2 leading-tight">
                Departments are scoped to your company workspace. Archived departments remain visible on existing employee records but are hidden from new selections.
              </p>
            </form>
          </div>

          {/* Departments Table */}
          <div className="md:col-span-2 bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-2xs">
            <div className="p-3 bg-neutral-50/70 border-b border-neutral-200 flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-700">Company Departments</span>
              <span className="text-neutral-500 font-mono text-[11px]">
                {departments.filter((d) => !d.is_archived).length} Active ·{' '}
                {departments.filter((d) => d.is_archived).length} Archived
              </span>
            </div>

            {departments.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-400">
                No departments created yet. Add your first department using the form on the left.
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Department Name</th>
                    <th className="py-2.5 px-4">Code</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {departments.map((d) => (
                    <tr key={d.id} className={`hover:bg-neutral-50/50 ${d.is_archived ? 'bg-neutral-50/30 opacity-75' : ''}`}>
                      <td className="py-2.5 px-4 font-semibold text-neutral-900">
                        {d.name}
                        {d.description && (
                          <div className="text-[11px] font-normal text-neutral-400 truncate max-w-xs">
                            {d.description}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-neutral-600">
                        {d.code || '—'}
                      </td>
                      <td className="py-2.5 px-4">
                        {d.is_archived ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-neutral-200 text-neutral-700">
                            Archived
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEditDept(d)}
                          className="text-neutral-500 hover:text-neutral-800 p-1 rounded hover:bg-neutral-100 transition-colors inline-flex items-center cursor-pointer"
                          title="Edit Department"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleArchiveDept(d)}
                          className={`p-1 rounded transition-colors inline-flex items-center cursor-pointer ${
                            d.is_archived
                              ? 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                              : 'text-amber-600 hover:text-amber-800 hover:bg-amber-50'
                          }`}
                          title={d.is_archived ? 'Re-activate Department' : 'Archive Department'}
                        >
                          {d.is_archived ? (
                            <ArchiveRestore className="w-3.5 h-3.5" />
                          ) : (
                            <Archive className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Edit Department Modal */}
      {editingDept && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-neutral-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-sm font-bold text-neutral-900">
                Edit Department: {editingDept.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingDept(null)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditDept} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Department Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editDeptName}
                  onChange={(e) => setEditDeptName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Department Code
                </label>
                <input
                  type="text"
                  value={editDeptCode}
                  onChange={(e) => setEditDeptCode(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editDeptDesc}
                  onChange={(e) => setEditDeptDesc(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setEditingDept(null)}
                  className="px-3 py-1.5 border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-medium rounded transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Categories View */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs h-fit">
            <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider mb-3">
              Add Category
            </h2>
            <form onSubmit={handleAddCategory} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Heavy Machinery"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional categorization notes"
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-1.5 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded transition-colors inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{submitting ? 'Adding...' : 'Add Category'}</span>
              </button>
            </form>
          </div>

          <div className="md:col-span-2 bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-2xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-4">Category Name</th>
                  <th className="py-2.5 px-4">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {categories.map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-50/50">
                    <td className="py-2.5 px-4 font-semibold text-neutral-900">{c.name}</td>
                    <td className="py-2.5 px-4 text-neutral-500">{c.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sites View */}
      {activeTab === 'sites' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs h-fit">
            <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider mb-3">
              Add Physical Site
            </h2>
            <form onSubmit={handleAddSite} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Site Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Branch Office North"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Physical Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. 100 Main St, Suite 400"
                  value={siteAddress}
                  onChange={(e) => setSiteAddress(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-1.5 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded transition-colors inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{submitting ? 'Adding...' : 'Add Site'}</span>
              </button>
            </form>
          </div>

          <div className="md:col-span-2 bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-2xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-4">Site Name</th>
                  <th className="py-2.5 px-4">Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {sites.map((s) => (
                  <tr key={s.id} className="hover:bg-neutral-50/50">
                    <td className="py-2.5 px-4 font-semibold text-neutral-900">{s.name}</td>
                    <td className="py-2.5 px-4 text-neutral-500">{s.address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Locations View */}
      {activeTab === 'locations' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs h-fit">
            <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider mb-3">
              Add Sub-Location
            </h2>
            <form onSubmit={handleAddLocation} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Parent Site <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={locSiteId}
                  onChange={(e) => setLocSiteId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A] bg-white cursor-pointer"
                >
                  <option value="">Select a Site</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Location Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Floor 2 Server Room"
                  value={locName}
                  onChange={(e) => setLocName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rack A1"
                  value={locDesc}
                  onChange={(e) => setLocDesc(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>

              <button
                type="submit"
                disabled={!locSiteId || submitting}
                className="w-full py-1.5 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded transition-colors inline-flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{submitting ? 'Adding...' : 'Add Location'}</span>
              </button>
            </form>
          </div>

          <div className="md:col-span-2 bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-2xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-4">Location Name</th>
                  <th className="py-2.5 px-4">Parent Site</th>
                  <th className="py-2.5 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {locations.map((l) => (
                  <tr key={l.id} className="hover:bg-neutral-50/50">
                    <td className="py-2.5 px-4 font-semibold text-neutral-900">{l.name}</td>
                    <td className="py-2.5 px-4 text-neutral-700">{l.site?.name || '—'}</td>
                    <td className="py-2.5 px-4 text-neutral-500">{l.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
