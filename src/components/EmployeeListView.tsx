/**
 * AssetMT - Employees Directory
 * High-density enterprise employee directory table with search, filters, sorting & pagination.
 * Phase 2A: Employees are custodians who can hold assets, NOT login users.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import { Department, Employee } from '../../shared/types.ts';
import {
  Search,
  Plus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Briefcase,
  Users,
  Eye,
  Edit2,
  UserCheck,
  UserX,
  AlertTriangle,
  X,
  Building,
} from 'lucide-react';

interface EmployeeListViewProps {
  onNavigate: (view: string, employeeId?: string) => void;
}

export const EmployeeListView: React.FC<EmployeeListViewProps> = ({ onNavigate }) => {
  const { token, companyName } = useAuth();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedActive, setSelectedActive] = useState('all'); // 'all', 'true', 'false'

  // Sorting & Pagination
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Deactivate/Activate Confirmation Modal
  const [targetEmployee, setTargetEmployee] = useState<Employee | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Load department options for filter
  useEffect(() => {
    if (!token) return;
    api.getDepartments(token, true).then((res) => {
      if (res.success) setDepartments(res.data);
    }).catch(() => {});
  }, [token]);

  // Fetch Employees
  const fetchEmployees = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.getEmployees(token, {
        search: search.trim() || undefined,
        department_id: selectedDepartment || undefined,
        is_active: selectedActive === 'all' ? undefined : selectedActive,
        sort_by: sortBy,
        sort_order: sortOrder,
        page,
        limit,
      });

      if (res.success) {
        setEmployees(res.data);
        setTotalCount(res.pagination.totalCount);
        setTotalPages(res.pagination.totalPages);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error fetching employee directory');
    } finally {
      setLoading(false);
    }
  }, [
    token,
    search,
    selectedDepartment,
    selectedActive,
    sortBy,
    sortOrder,
    page,
    limit,
  ]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedDepartment('');
    setSelectedActive('all');
    setPage(1);
  };

  const handleConfirmToggleActive = async () => {
    if (!token || !targetEmployee || actionLoading) return;
    try {
      setActionLoading(true);
      const res = await api.toggleEmployeeActive(token, targetEmployee.id, !targetEmployee.is_active);
      if (res.success) {
        setEmployees((prev) =>
          prev.map((emp) => (emp.id === targetEmployee.id ? res.data : emp))
        );
        setTargetEmployee(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update employee status');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-5 select-text font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-neutral-900">
              Employee Directory
            </h1>
            <span className="text-[10px] text-neutral-500 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded font-mono">
              Directory Only · No Login
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Managing <span className="font-mono tabular-nums font-semibold text-neutral-800">{totalCount}</span> registered employees and custodians in <span className="font-semibold text-neutral-700">{companyName}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('org-management')}
            className="px-3 py-1.5 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-medium rounded transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Manage Departments, Sites & Categories"
          >
            <Briefcase className="w-3.5 h-3.5 text-neutral-500" />
            <span>Departments</span>
          </button>

          <button
            type="button"
            onClick={fetchEmployees}
            disabled={loading}
            className="px-3 py-1.5 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-medium rounded transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Refresh directory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('employee-add')}
            className="px-3.5 py-1.5 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-neutral-200 rounded-lg p-3.5 space-y-3 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative md:col-span-2">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search employee ID, name, email, title..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
            />
          </div>

          {/* Department Filter */}
          <div>
            <select
              value={selectedDepartment}
              onChange={(e) => {
                setSelectedDepartment(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A] bg-white text-neutral-700 cursor-pointer"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.is_archived ? '(Archived)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Active Status Filter */}
          <div>
            <select
              value={selectedActive}
              onChange={(e) => {
                setSelectedActive(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A] bg-white text-neutral-700 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="true">Active Only</option>
              <option value="false">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* Active Filters Clear */}
        {(search || selectedDepartment || selectedActive !== 'all') && (
          <div className="flex items-center justify-between pt-1 border-t border-neutral-100 text-xs text-neutral-500">
            <span>Filtered results active</span>
            <button
              onClick={handleResetFilters}
              className="text-[#FF6A1A] hover:underline font-medium cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Table Container */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 select-none">
              <tr>
                <th
                  onClick={() => handleSort('employee_code')}
                  className="py-2.5 px-4 font-semibold cursor-pointer hover:bg-neutral-100 transition-colors w-32"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Employee ID</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>

                <th
                  onClick={() => handleSort('full_name')}
                  className="py-2.5 px-4 font-semibold cursor-pointer hover:bg-neutral-100 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Full Name</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>

                <th className="py-2.5 px-4 font-semibold text-neutral-600">
                  Department
                </th>

                <th
                  onClick={() => handleSort('job_title')}
                  className="py-2.5 px-4 font-semibold cursor-pointer hover:bg-neutral-100 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Job Title</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>

                <th className="py-2.5 px-4 font-semibold text-neutral-600">
                  Work Email
                </th>

                <th className="py-2.5 px-4 font-semibold text-neutral-600">
                  Site / Location
                </th>

                <th
                  onClick={() => handleSort('is_active')}
                  className="py-2.5 px-4 font-semibold cursor-pointer hover:bg-neutral-100 transition-colors w-24 text-center"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Status</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>

                <th className="py-2.5 px-4 font-semibold text-right w-28">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-5 h-5 border-2 border-neutral-300 border-t-[#FF6A1A] rounded-full animate-spin"></div>
                      <span>Loading employee directory...</span>
                    </div>
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-400">
                    <div className="flex flex-col items-center gap-2 max-w-sm mx-auto">
                      <Users className="w-8 h-8 text-neutral-300" />
                      <div className="font-semibold text-neutral-700">No employees found</div>
                      <p className="text-neutral-500 text-[11px]">
                        {search || selectedDepartment || selectedActive !== 'all'
                          ? 'No employee records match the selected filters.'
                          : 'Get started by adding your first employee to this company directory.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => onNavigate('employee-add')}
                        className="mt-2 px-3 py-1.5 bg-[#FF6A1A] text-white text-xs font-semibold rounded hover:bg-[#e55910] cursor-pointer"
                      >
                        Add Employee
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr
                    key={emp.id}
                    className={`hover:bg-neutral-50/70 transition-colors ${
                      !emp.is_active ? 'bg-neutral-50/40 text-neutral-500' : ''
                    }`}
                  >
                    {/* Employee Code */}
                    <td className="py-2.5 px-4 font-mono font-bold text-neutral-900">
                      <span className="bg-neutral-100 border border-neutral-200 px-1.5 py-0.5 rounded text-[11px]">
                        {emp.employee_code}
                      </span>
                    </td>

                    {/* Full Name */}
                    <td className="py-2.5 px-4">
                      <button
                        onClick={() => onNavigate('employee-detail', emp.id)}
                        className="font-bold text-neutral-900 hover:text-[#FF6A1A] text-left transition-colors cursor-pointer"
                      >
                        {emp.full_name}
                      </button>
                    </td>

                    {/* Department */}
                    <td className="py-2.5 px-4">
                      {emp.department ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-neutral-800 font-medium">{emp.department.name}</span>
                          {emp.department.is_archived && (
                            <span className="text-[10px] text-neutral-500 bg-neutral-100 px-1 py-0.2 rounded font-mono">
                              Archived
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-neutral-400 italic">None</span>
                      )}
                    </td>

                    {/* Job Title */}
                    <td className="py-2.5 px-4 text-neutral-700">
                      {emp.job_title || '—'}
                    </td>

                    {/* Work Email */}
                    <td className="py-2.5 px-4">
                      {emp.email ? (
                        <span className="text-neutral-600 font-mono text-[11px] truncate max-w-[160px] block" title={emp.email}>
                          {emp.email}
                        </span>
                      ) : (
                        <span className="text-neutral-400 italic">—</span>
                      )}
                    </td>

                    {/* Site & Location */}
                    <td className="py-2.5 px-4 text-neutral-600">
                      {emp.site ? (
                        <span>
                          {emp.site.name}
                          {emp.location ? ` · ${emp.location.name}` : ''}
                        </span>
                      ) : (
                        <span className="text-neutral-400 italic">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-4 text-center">
                      {emp.is_active ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-neutral-200 text-neutral-700">
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-4 text-right space-x-1">
                      <button
                        type="button"
                        onClick={() => onNavigate('employee-detail', emp.id)}
                        className="p-1 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                        title="View Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onNavigate('employee-edit', emp.id)}
                        className="p-1 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                        title="Edit Employee"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setTargetEmployee(emp)}
                        className={`p-1 rounded transition-colors cursor-pointer ${
                          emp.is_active
                            ? 'text-amber-600 hover:text-amber-800 hover:bg-amber-50'
                            : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                        }`}
                        title={emp.is_active ? 'Deactivate Employee' : 'Activate Employee'}
                      >
                        {emp.is_active ? (
                          <UserX className="w-3.5 h-3.5" />
                        ) : (
                          <UserCheck className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="bg-neutral-50/80 px-4 py-3 border-t border-neutral-200 flex items-center justify-between text-xs select-none">
          <div className="text-neutral-500">
            Showing <span className="font-semibold text-neutral-800">{employees.length}</span> of{' '}
            <span className="font-semibold text-neutral-800">{totalCount}</span> employees
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1 border border-neutral-200 rounded hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4 text-neutral-600" />
            </button>

            <span className="text-neutral-700 font-medium">
              Page {page} of {Math.max(1, totalPages)}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-1 border border-neutral-200 rounded hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4 text-neutral-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Activate/Deactivate Confirmation Dialog */}
      {targetEmployee && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-neutral-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  targetEmployee.is_active
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-emerald-100 text-emerald-600'
                }`}
              >
                {targetEmployee.is_active ? (
                  <UserX className="w-5 h-5" />
                ) : (
                  <UserCheck className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-neutral-900">
                  {targetEmployee.is_active
                    ? `Deactivate ${targetEmployee.full_name}?`
                    : `Activate ${targetEmployee.full_name}?`}
                </h3>
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                  {targetEmployee.is_active
                    ? `Deactivating ${targetEmployee.full_name} (${targetEmployee.employee_code}) will mark their directory record as inactive. Existing records and historical references are preserved. No records are deleted.`
                    : `Activating ${targetEmployee.full_name} (${targetEmployee.employee_code}) will restore them to active directory status.`}
                </p>
              </div>
            </div>

            <div className="bg-neutral-50 p-2.5 rounded border border-neutral-200 text-[11px] text-neutral-600 space-y-1">
              <div>
                <span className="font-semibold">Employee ID:</span>{' '}
                <span className="font-mono">{targetEmployee.employee_code}</span>
              </div>
              <div>
                <span className="font-semibold">Department:</span>{' '}
                {targetEmployee.department?.name || 'Unassigned'}
              </div>
              {targetEmployee.email && (
                <div>
                  <span className="font-semibold">Email:</span> {targetEmployee.email}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setTargetEmployee(null)}
                disabled={actionLoading}
                className="px-3 py-1.5 border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-medium rounded transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmToggleActive}
                disabled={actionLoading}
                className={`px-4 py-1.5 text-white text-xs font-semibold rounded transition-colors cursor-pointer disabled:opacity-50 ${
                  targetEmployee.is_active
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {actionLoading
                  ? 'Updating...'
                  : targetEmployee.is_active
                  ? 'Confirm Deactivation'
                  : 'Confirm Activation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
