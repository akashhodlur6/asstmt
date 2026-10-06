/**
 * AssetMT - Employee Details View
 * Phase 2B: Real employee custody records & historical asset assignments.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import { AssetAssignment, Employee } from '../../shared/types.ts';
import {
  ArrowLeft,
  Edit2,
  Users,
  Briefcase,
  Building,
  Mail,
  Calendar,
  Clock,
  UserCheck,
  UserX,
  Info,
  Layers,
  AlertCircle,
  X,
  History,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

interface EmployeeDetailViewProps {
  employeeId: string;
  onNavigate: (view: string, id?: string) => void;
}

export const EmployeeDetailView: React.FC<EmployeeDetailViewProps> = ({
  employeeId,
  onNavigate,
}) => {
  const { token, companyName, role } = useAuth();
  const isTenantAdmin = role === 'TENANT_ADMIN';

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [assignments, setAssignments] = useState<AssetAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status toggle confirmation modal
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchEmployee = useCallback(async () => {
    if (!token || !employeeId) return;
    try {
      setLoading(true);
      setError(null);
      const [empRes, asgnRes] = await Promise.all([
        api.getEmployee(token, employeeId),
        api.getEmployeeAssignments(token, employeeId).catch(() => ({ success: false, data: [] })),
      ]);

      if (empRes.success) {
        setEmployee(empRes.data);
      }
      if (asgnRes.success) {
        setAssignments(asgnRes.data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading employee record');
    } finally {
      setLoading(false);
    }
  }, [token, employeeId]);

  useEffect(() => {
    fetchEmployee();
  }, [fetchEmployee]);

  const handleToggleActive = async () => {
    if (!token || !employee || actionLoading) return;
    try {
      setActionLoading(true);
      const res = await api.toggleEmployeeActive(token, employee.id, !employee.is_active);
      if (res.success) {
        setEmployee(res.data);
        setShowStatusModal(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update employee status');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatTimestamp = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const activeAssignments = assignments.filter((a) => !a.checked_in_at);
  const historicalAssignments = assignments.filter((a) => a.checked_in_at);

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-8 h-8 border-2 border-neutral-300 border-t-[#FF6A1A] rounded-full animate-spin"></div>
        <div className="text-xs text-neutral-500 font-medium">Loading employee record...</div>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-4">
        <button
          onClick={() => onNavigate('employees')}
          className="text-xs text-neutral-600 hover:text-neutral-900 inline-flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Employees
        </button>
        <div className="p-4 bg-red-50 border border-red-200 text-xs text-red-700 rounded-lg">
          {error || 'Employee record could not be found.'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 select-text font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
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
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded text-neutral-800">
                {employee.employee_code}
              </span>
              <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
                {employee.full_name}
              </h1>
              <span
                className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                  employee.is_active
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                }`}
              >
                {employee.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-500 mt-1">
              <span>{employee.department?.name || 'No Department'}</span>
              <span aria-hidden="true">·</span>
              <span>{employee.job_title || 'No Title'}</span>
              {employee.email && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{employee.email}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {isTenantAdmin && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('employee-edit', employee.id)}
              className="px-3.5 py-1.5 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold rounded inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Edit2 className="w-3.5 h-3.5 text-neutral-500" />
              <span>Edit Details</span>
            </button>

            <button
              type="button"
              onClick={() => setShowStatusModal(true)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs ${
                employee.is_active
                  ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              {employee.is_active ? (
                <>
                  <UserX className="w-3.5 h-3.5" />
                  <span>Deactivate</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Activate</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Details & Assigned Assets */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Details Card */}
          <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs space-y-4">
            <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider border-b border-neutral-100 pb-2 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-neutral-400" />
              <span>Directory Profile</span>
            </h2>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4 text-xs">
              <div>
                <dt className="text-neutral-500 font-medium">Employee Code / ID</dt>
                <dd className="font-mono font-bold text-neutral-900 mt-0.5">{employee.employee_code}</dd>
              </div>

              <div>
                <dt className="text-neutral-500 font-medium">Full Name</dt>
                <dd className="font-semibold text-neutral-900 mt-0.5">{employee.full_name}</dd>
              </div>

              <div>
                <dt className="text-neutral-500 font-medium">Work Email</dt>
                <dd className="font-mono text-neutral-800 mt-0.5">
                  {employee.email || <span className="text-neutral-400 italic">None registered</span>}
                </dd>
              </div>

              <div>
                <dt className="text-neutral-500 font-medium">Job Title</dt>
                <dd className="text-neutral-800 mt-0.5">
                  {employee.job_title || <span className="text-neutral-400 italic">None</span>}
                </dd>
              </div>

              <div>
                <dt className="text-neutral-500 font-medium">Department</dt>
                <dd className="mt-0.5">
                  {employee.department ? (
                    <span className="font-medium text-neutral-900">
                      {employee.department.name}
                      {employee.department.code && (
                        <span className="text-neutral-400 font-mono text-[11px]"> ({employee.department.code})</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-neutral-400 italic">Unassigned</span>
                  )}
                </dd>
              </div>

              <div>
                <dt className="text-neutral-500 font-medium">Facility / Site</dt>
                <dd className="mt-0.5 text-neutral-800 font-medium">
                  {employee.site?.name || '—'}
                </dd>
              </div>

              <div>
                <dt className="text-neutral-500 font-medium">Sub-Location</dt>
                <dd className="mt-0.5 text-neutral-800">
                  {employee.location?.name || '—'}
                </dd>
              </div>

              <div>
                <dt className="text-neutral-500 font-medium">Record Status</dt>
                <dd className="mt-0.5 font-semibold">
                  {employee.is_active ? (
                    <span className="text-emerald-700">Active Directory Record</span>
                  ) : (
                    <span className="text-neutral-600">Inactive / Deactivated</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {/* Currently Assigned Assets */}
          <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
              <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-[#FF6A1A]" />
                <span>Currently Assigned Assets</span>
              </h2>
              <span className="text-[11px] font-mono px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded font-semibold">
                {activeAssignments.length} Asset{activeAssignments.length === 1 ? '' : 's'}
              </span>
            </div>

            {activeAssignments.length === 0 ? (
              <div className="p-6 bg-neutral-50/60 rounded-lg border border-neutral-200 text-center space-y-1">
                <p className="text-xs text-neutral-600 font-medium">No Assets Currently Checked Out</p>
                <p className="text-[11px] text-neutral-400">
                  This employee currently does not hold custody of any company assets.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-neutral-200 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold select-none">
                    <tr>
                      <th className="py-2.5 px-3">Asset Tag</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">Checked Out</th>
                      <th className="py-2.5 px-3">Expected Return</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {activeAssignments.map((asgn) => (
                      <tr key={asgn.id} className="hover:bg-neutral-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-neutral-900 whitespace-nowrap">
                          {asgn.asset?.asset_tag}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-neutral-900 max-w-xs truncate">
                          {asgn.asset?.name}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-neutral-700 whitespace-nowrap">
                          {formatDate(asgn.checked_out_at)}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-neutral-700 whitespace-nowrap">
                          {formatDate(asgn.expected_return_at)}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => asgn.asset_id && onNavigate('asset-detail', asgn.asset_id)}
                            className="text-xs text-[#FF6A1A] hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>Manage</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Historical Custody Records */}
          <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
              <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-4 h-4 text-neutral-500" />
                <span>Past Custody History</span>
              </h2>
              <span className="text-[11px] font-mono text-neutral-500">
                {historicalAssignments.length} Returned
              </span>
            </div>

            {historicalAssignments.length === 0 ? (
              <div className="py-4 text-center text-xs text-neutral-400">
                No past returned custody records for this employee.
              </div>
            ) : (
              <div className="overflow-x-auto border border-neutral-200 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold select-none">
                    <tr>
                      <th className="py-2.5 px-3">Asset Tag</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">Checked Out</th>
                      <th className="py-2.5 px-3">Checked In</th>
                      <th className="py-2.5 px-3">Returned Condition</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {historicalAssignments.map((asgn) => (
                      <tr key={asgn.id} className="hover:bg-neutral-50/80 transition-colors">
                        <td className="py-2 px-3 font-mono font-bold text-neutral-900 whitespace-nowrap">
                          {asgn.asset?.asset_tag}
                        </td>
                        <td className="py-2 px-3 text-neutral-800 max-w-xs truncate">
                          {asgn.asset?.name}
                        </td>
                        <td className="py-2 px-3 font-mono text-neutral-600 whitespace-nowrap">
                          {formatDate(asgn.checked_out_at)}
                        </td>
                        <td className="py-2 px-3 font-mono text-neutral-600 whitespace-nowrap">
                          {formatDate(asgn.checked_in_at)}
                        </td>
                        <td className="py-2 px-3 text-neutral-700">
                          {asgn.checkin_condition || 'Good'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Meta & Audit */}
        <div className="space-y-6">
          <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs space-y-4">
            <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider border-b border-neutral-100 pb-2">
              System Audit
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-neutral-500 block">Workspace Tenant:</span>
                <span className="font-semibold text-neutral-900">{companyName}</span>
              </div>

              <div>
                <span className="text-neutral-500 block">Record Created:</span>
                <span className="text-neutral-800 font-mono text-[11px]">{formatTimestamp(employee.created_at)}</span>
              </div>

              <div>
                <span className="text-neutral-500 block">Last Modified:</span>
                <span className="text-neutral-800 font-mono text-[11px]">{formatTimestamp(employee.updated_at)}</span>
              </div>

              <div className="pt-2 border-t border-neutral-100">
                <span className="text-[11px] text-neutral-400 block leading-tight">
                  Tenant ownership is enforced at the database level with immutable triggers and Row-Level Security.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-neutral-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  employee.is_active ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                }`}
              >
                {employee.is_active ? <UserX className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-neutral-900">
                  {employee.is_active ? `Deactivate ${employee.full_name}?` : `Activate ${employee.full_name}?`}
                </h3>
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                  {employee.is_active
                    ? `Deactivating ${employee.full_name} (${employee.employee_code}) will mark their record inactive. The record remains preserved in the directory and historical custody links remain intact.`
                    : `Activating ${employee.full_name} (${employee.employee_code}) will restore them to active directory status.`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                disabled={actionLoading}
                className="px-3 py-1.5 border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-medium rounded transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleActive}
                disabled={actionLoading}
                className={`px-4 py-1.5 text-white text-xs font-semibold rounded transition-colors cursor-pointer disabled:opacity-50 ${
                  employee.is_active ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {actionLoading ? 'Updating...' : employee.is_active ? 'Confirm Deactivation' : 'Confirm Activation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
