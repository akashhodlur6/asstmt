/**
 * AssetMT - Add / Edit Employee Form
 * Compact enterprise form matching AssetFormView design.
 * Phase 2A: Employees are directory custodians who can hold assets; NOT login users.
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import { Department, Employee, Location, Site } from '../../shared/types.ts';
import { validateEmployee } from '../../shared/validation.ts';
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  Users,
  Info,
  Building,
  Briefcase,
  Plus,
} from 'lucide-react';

interface EmployeeFormViewProps {
  employeeId?: string;
  onNavigate: (view: string, id?: string) => void;
}

export const EmployeeFormView: React.FC<EmployeeFormViewProps> = ({
  employeeId,
  onNavigate,
}) => {
  const { token, companyName } = useAuth();
  const isEdit = Boolean(employeeId);

  // Form Fields
  const [employeeCode, setEmployeeCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Lookups
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // Original employee state for archived department retention
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);

  // States
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Quick department add modal
  const [showQuickDept, setShowQuickDept] = useState(false);
  const [quickDeptName, setQuickDeptName] = useState('');
  const [quickDeptCode, setQuickDeptCode] = useState('');
  const [quickDeptLoading, setQuickDeptLoading] = useState(false);

  // Load Lookups
  useEffect(() => {
    if (!token) return;
    // Load all departments (including archived, we will filter in render)
    api.getDepartments(token, true).then((res) => {
      if (res.success) setDepartments(res.data);
    }).catch(() => {});

    api.getSites(token).then((res) => {
      if (res.success) setSites(res.data);
    }).catch(() => {});

    api.getLocations(token).then((res) => {
      if (res.success) setLocations(res.data);
    }).catch(() => {});
  }, [token]);

  // Load existing employee if editing
  useEffect(() => {
    if (!token || !employeeId) return;

    setLoading(true);
    setGeneralError(null);
    api.getEmployee(token, employeeId)
      .then((res) => {
        if (res.success) {
          const emp = res.data;
          setCurrentEmployee(emp);
          setEmployeeCode(emp.employee_code);
          setFullName(emp.full_name);
          setEmail(emp.email || '');
          setJobTitle(emp.job_title || '');
          setDepartmentId(emp.department_id || '');
          setSiteId(emp.site_id || '');
          setLocationId(emp.location_id || '');
          setIsActive(emp.is_active);
        }
      })
      .catch((err: unknown) => {
        setGeneralError(err instanceof Error ? err.message : 'Error loading employee record');
      })
      .finally(() => setLoading(false));
  }, [token, employeeId]);

  // Handle Quick Add Department
  const handleQuickAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !quickDeptName.trim() || quickDeptLoading) return;
    try {
      setQuickDeptLoading(true);
      const res = await api.createDepartment(token, {
        name: quickDeptName.trim(),
        code: quickDeptCode.trim() || undefined,
      });
      if (res.success) {
        setDepartments((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
        setDepartmentId(res.data.id);
        setShowQuickDept(false);
        setQuickDeptName('');
        setQuickDeptCode('');
      }
    } catch (err: unknown) {
      setGeneralError(err instanceof Error ? err.message : 'Failed to create department');
    } finally {
      setQuickDeptLoading(false);
    }
  };

  // Filter departments for selection:
  // "Keep archived departments visible on existing employee records but unavailable for new selections."
  const availableDepartments = departments.filter((d) => {
    if (!d.is_archived) return true;
    // If editing and this employee currently has this archived department assigned, keep it visible
    if (isEdit && currentEmployee?.department_id === d.id) return true;
    return false;
  });

  // Filter locations by site
  const filteredLocations = siteId
    ? locations.filter((loc) => loc.site_id === siteId)
    : locations;

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || saving) return;

    setFieldErrors({});
    setGeneralError(null);

    const payload = {
      employee_code: employeeCode.trim(),
      full_name: fullName.trim(),
      email: email.trim() || undefined,
      job_title: jobTitle.trim() || undefined,
      department_id: departmentId || null,
      site_id: siteId || null,
      location_id: locationId || null,
      is_active: isActive,
    };

    // Client-side validation
    const validation = validateEmployee(payload, isEdit);
    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      return;
    }

    try {
      setSaving(true);
      if (isEdit && employeeId) {
        const res = await api.updateEmployee(token, employeeId, payload);
        if (res.success) {
          setSuccessMsg(`Employee "${res.data.full_name}" updated successfully.`);
          setTimeout(() => {
            onNavigate('employee-detail', res.data.id);
          }, 800);
        }
      } else {
        const res = await api.createEmployee(token, payload);
        if (res.success) {
          setSuccessMsg(`Employee "${res.data.full_name}" registered successfully.`);
          setTimeout(() => {
            onNavigate('employee-detail', res.data.id);
          }, 800);
        }
      }
    } catch (err: unknown) {
      const errorObj = err as { data?: { errors?: Record<string, string>; message?: string }; message?: string };
      if (errorObj?.data?.errors) {
        setFieldErrors(errorObj.data.errors);
      }
      setGeneralError(
        errorObj?.data?.message ||
        (err instanceof Error ? err.message : 'Failed to save employee record')
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-8 h-8 border-2 border-neutral-300 border-t-[#FF6A1A] rounded-full animate-spin"></div>
        <div className="text-xs text-neutral-500 font-medium">Loading employee details...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 select-text font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Breadcrumb & Action Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('employees')}
            className="p-1.5 border border-neutral-200 hover:bg-neutral-100 rounded text-neutral-600 transition-colors cursor-pointer"
            title="Back to Employees List"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-neutral-900">
              {isEdit ? `Edit Employee: ${fullName || employeeCode}` : 'Add New Employee'}
            </h1>
            <p className="text-xs text-neutral-500">
              Register employee or custodian details for <span className="font-semibold text-neutral-800">{companyName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('employees')}
            disabled={saving}
            className="px-3.5 py-1.5 border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-medium rounded transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-1.5 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : isEdit ? 'Update Employee' : 'Save Employee'}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {generalError && (
        <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Unable to save employee</div>
            <div>{generalError}</div>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-green-50 border border-green-200 text-xs text-green-700 rounded flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Identity & Scope Notice */}
      <div className="p-3.5 bg-neutral-100/80 border border-neutral-200 rounded-lg text-xs text-neutral-700 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-semibold text-neutral-900">Directory Record Only:</span> Employees in AssetMT are custodians who can hold and manage company assets. Adding an employee does <em>not</em> create a login account, send an invitation email, or grant access to this software.
        </div>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-lg p-6 shadow-2xs space-y-6">
        {/* Section 1: Identification */}
        <div>
          <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider mb-4 border-b border-neutral-100 pb-2">
            1. Employee Identification
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Employee ID / Code */}
            <div>
              <label className="block text-xs font-semibold text-neutral-800 mb-1">
                Employee ID / Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. EMP-1001"
                value={employeeCode}
                onChange={(e) => {
                  setEmployeeCode(e.target.value);
                  if (fieldErrors.employee_code) {
                    setFieldErrors((prev) => ({ ...prev, employee_code: '' }));
                  }
                }}
                className={`w-full px-3 py-1.5 text-xs font-mono border rounded focus:outline-none focus:border-[#FF6A1A] ${
                  fieldErrors.employee_code ? 'border-red-500 bg-red-50/30' : 'border-neutral-300'
                }`}
              />
              {fieldErrors.employee_code ? (
                <div className="text-[11px] text-red-600 mt-1">{fieldErrors.employee_code}</div>
              ) : (
                <div className="text-[11px] text-neutral-400 mt-1">
                  Unique identifier code within your company workspace.
                </div>
              )}
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-neutral-800 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Jane Doe"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (fieldErrors.full_name) {
                    setFieldErrors((prev) => ({ ...prev, full_name: '' }));
                  }
                }}
                className={`w-full px-3 py-1.5 text-xs border rounded focus:outline-none focus:border-[#FF6A1A] ${
                  fieldErrors.full_name ? 'border-red-500 bg-red-50/30' : 'border-neutral-300'
                }`}
              />
              {fieldErrors.full_name && (
                <div className="text-[11px] text-red-600 mt-1">{fieldErrors.full_name}</div>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Contact & Role */}
        <div>
          <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider mb-4 border-b border-neutral-100 pb-2">
            2. Role & Directory Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Job Title */}
            <div>
              <label className="block text-xs font-semibold text-neutral-800 mb-1">
                Job Title
              </label>
              <input
                type="text"
                placeholder="e.g. Senior Systems Engineer"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
              />
            </div>

            {/* Work Email */}
            <div>
              <label className="block text-xs font-semibold text-neutral-800 mb-1">
                Work Email <span className="text-neutral-400 font-normal">(Optional)</span>
              </label>
              <input
                type="email"
                placeholder="e.g. jane.doe@company.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => ({ ...prev, email: '' }));
                  }
                }}
                className={`w-full px-3 py-1.5 text-xs border rounded focus:outline-none focus:border-[#FF6A1A] ${
                  fieldErrors.email ? 'border-red-500 bg-red-50/30' : 'border-neutral-300'
                }`}
              />
              {fieldErrors.email ? (
                <div className="text-[11px] text-red-600 mt-1">{fieldErrors.email}</div>
              ) : (
                <div className="text-[11px] text-neutral-400 mt-1">
                  Directory contact reference only. Does not provide software login access.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Organization & Location */}
        <div>
          <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider mb-4 border-b border-neutral-100 pb-2">
            3. Department & Physical Location
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Department */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-neutral-800">
                  Department
                </label>
                <button
                  type="button"
                  onClick={() => setShowQuickDept(true)}
                  className="text-[11px] text-[#FF6A1A] hover:underline font-medium inline-flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> New
                </button>
              </div>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A] bg-white cursor-pointer"
              >
                <option value="">-- No Department --</option>
                {availableDepartments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.is_archived ? '(Archived)' : ''}
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-neutral-400 mt-1">
                Archived departments are hidden from new selections.
              </div>
            </div>

            {/* Site */}
            <div>
              <label className="block text-xs font-semibold text-neutral-800 mb-1">
                Primary Facility / Site
              </label>
              <select
                value={siteId}
                onChange={(e) => {
                  setSiteId(e.target.value);
                  setLocationId('');
                }}
                className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A] bg-white cursor-pointer"
              >
                <option value="">-- No Site Assigned --</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-neutral-400 mt-1">
                Reuses existing company physical facilities.
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-xs font-semibold text-neutral-800 mb-1">
                Sub-Location
              </label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                disabled={!siteId}
                className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A] bg-white cursor-pointer disabled:opacity-50"
              >
                <option value="">-- No Sub-Location --</option>
                {filteredLocations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-neutral-400 mt-1">
                Filtered to selected site locations.
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Status */}
        <div>
          <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider mb-4 border-b border-neutral-100 pb-2">
            4. Employment Status
          </h2>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active_check"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-[#FF6A1A] focus:ring-[#FF6A1A] rounded border-neutral-300 cursor-pointer"
            />
            <label htmlFor="is_active_check" className="text-xs text-neutral-700 font-medium cursor-pointer">
              Active employee record <span className="text-neutral-400 font-normal">(Inactive employees remain in the directory for historical integrity)</span>
            </label>
          </div>
        </div>

        {/* Section 5: Custody & Asset Assignment Callout */}
        <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-amber-950">
            <Users className="w-4 h-4 text-amber-600" />
            <span>Asset Custody & Assignment Workflows</span>
          </div>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            Direct asset check-out, check-in, and transfer workflows will be implemented in the custody phase (Phase 2B). Assigned asset counts are not fabricated and will reflect live custody transactions once that phase is active.
          </p>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100">
          <button
            type="button"
            onClick={() => onNavigate('employees')}
            disabled={saving}
            className="px-4 py-2 border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-medium rounded transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : isEdit ? 'Update Employee Record' : 'Save Employee Record'}</span>
          </button>
        </div>
      </form>

      {/* Quick Add Department Modal */}
      {showQuickDept && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-neutral-200 shadow-xl max-w-sm w-full p-5 space-y-3">
            <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
              Quick Add Department
            </h3>
            <form onSubmit={handleQuickAddDepartment} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Department Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Finance"
                  value={quickDeptName}
                  onChange={(e) => setQuickDeptName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Department Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. FIN"
                  value={quickDeptCode}
                  onChange={(e) => setQuickDeptCode(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowQuickDept(false)}
                  className="px-3 py-1.5 border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-medium rounded transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickDeptLoading}
                  className="px-4 py-1.5 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded transition-colors cursor-pointer disabled:opacity-50"
                >
                  {quickDeptLoading ? 'Adding...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
