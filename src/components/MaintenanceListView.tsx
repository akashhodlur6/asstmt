/**
 * AssetMT - Enterprise Maintenance & Work Orders View
 * AssetTiger-style compact table, multi-parameter filtering, sorting, pagination, and KPI metrics.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import { MaintenanceRecord, MaintenanceStatus, MaintenancePriority, MaintenanceType } from '../../shared/types.ts';
import { MaintenanceDetailModal } from './MaintenanceDetailModal.tsx';
import { MaintenanceFormModal } from './MaintenanceFormModal.tsx';
import {
  Wrench,
  Search,
  Plus,
  RefreshCw,
  Building2,
  Calendar,
  DollarSign,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Play,
  CalendarClock,
  Filter,
  ArrowUpDown,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit3,
} from 'lucide-react';

interface MaintenanceListViewProps {
  onNavigate: (view: string, entityId?: string) => void;
}

export const MaintenanceListView: React.FC<MaintenanceListViewProps> = ({ onNavigate }) => {
  const { token, role } = useAuth();
  const isTenantAdmin = role === 'TENANT_ADMIN';

  // Data & State
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Sorting
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  // KPI Metrics
  const [metrics, setMetrics] = useState<{
    openCount: number;
    scheduledCount: number;
    inProgressCount: number;
    completedCount: number;
    overdueCount: number;
    totalCost: number;
  } | null>(null);

  // Modals
  const [activeWorkOrderId, setActiveWorkOrderId] = useState<string | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.getMaintenanceMetrics(token);
      if (res.success) {
        setMetrics(res.data);
      }
    } catch {
      // Metrics are non-critical
    }
  }, [token]);

  const fetchRecords = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.getMaintenanceRecords(token, {
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        maintenance_type: typeFilter || undefined,
        overdue: overdueOnly,
        sort_by: sortBy,
        sort_order: sortOrder,
        page,
        limit,
      });

      if (res.success) {
        setRecords(res.data);
        if (res.pagination) {
          setTotalCount(res.pagination.totalCount);
          setTotalPages(res.pagination.totalPages);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading maintenance records');
    } finally {
      setLoading(false);
    }
  }, [token, search, statusFilter, priorityFilter, typeFilter, overdueOnly, sortBy, sortOrder, page, limit]);

  useEffect(() => {
    fetchRecords();
    fetchMetrics();
  }, [fetchRecords, fetchMetrics]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const getStatusBadge = (status: MaintenanceStatus) => {
    switch (status) {
      case 'Open':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
            Open
          </span>
        );
      case 'Scheduled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <CalendarClock className="w-3 h-3 text-indigo-600" />
            Scheduled
          </span>
        );
      case 'In Progress':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Play className="w-3 h-3 text-amber-600 fill-amber-600" />
            In Progress
          </span>
        );
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Completed
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-neutral-100 text-neutral-600 border border-neutral-300">
            <XCircle className="w-3 h-3 text-neutral-400" />
            Cancelled
          </span>
        );
      default:
        return <span className="text-xs text-neutral-500">{status}</span>;
    }
  };

  const getPriorityBadge = (priority: MaintenancePriority) => {
    switch (priority) {
      case 'Critical':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-800 border border-red-300">
            Critical
          </span>
        );
      case 'High':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-orange-100 text-orange-800 border border-orange-200">
            High
          </span>
        );
      case 'Medium':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
            Medium
          </span>
        );
      case 'Low':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-100 text-neutral-600 border border-neutral-200">
            Low
          </span>
        );
      default:
        return <span className="text-xs text-neutral-600">{priority}</span>;
    }
  };

  const isOverdue = (record: MaintenanceRecord) => {
    if (!record.due_date) return false;
    if (record.status === 'Completed' || record.status === 'Cancelled') return false;
    const today = new Date().toISOString().split('T')[0];
    return record.due_date < today;
  };

  const formatCost = (cost?: number | null, currency = 'USD') => {
    if (cost === undefined || cost === null) return '—';
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD',
        minimumFractionDigits: 2,
      }).format(cost);
    } catch {
      return `${currency} ${cost}`;
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 select-text font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-neutral-900">
              Maintenance & Work Orders
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-100 text-neutral-700 font-mono">
              {totalCount} Total
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Schedule repairs, track technician/vendor services, downtime, and operational maintenance costs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('vendors')}
            className="px-3 py-1.5 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-medium rounded transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            title="Manage maintenance vendors & suppliers"
          >
            <Building2 className="w-3.5 h-3.5 text-neutral-500" />
            <span>Vendors Directory</span>
          </button>

          <button
            type="button"
            onClick={() => {
              fetchRecords();
              fetchMetrics();
            }}
            disabled={loading}
            className="px-3 py-1.5 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-medium rounded transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            title="Refresh records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {isTenantAdmin && (
            <button
              type="button"
              onClick={() => {
                setEditingRecord(null);
                setIsFormModalOpen(true);
              }}
              className="px-3.5 py-1.5 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Work Order</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Metric Summary Row */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div
            onClick={() => {
              setStatusFilter(statusFilter === 'Open' ? '' : 'Open');
              setOverdueOnly(false);
              setPage(1);
            }}
            className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
              statusFilter === 'Open'
                ? 'bg-sky-50 border-sky-300 ring-1 ring-sky-300'
                : 'bg-white border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <div className="text-[11px] font-semibold text-sky-700 flex items-center justify-between">
              <span>Open</span>
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
            </div>
            <div className="text-xl font-bold font-mono text-neutral-900 mt-1">
              {metrics.openCount}
            </div>
          </div>

          <div
            onClick={() => {
              setStatusFilter(statusFilter === 'Scheduled' ? '' : 'Scheduled');
              setOverdueOnly(false);
              setPage(1);
            }}
            className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
              statusFilter === 'Scheduled'
                ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300'
                : 'bg-white border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <div className="text-[11px] font-semibold text-indigo-700 flex items-center justify-between">
              <span>Scheduled</span>
              <CalendarClock className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <div className="text-xl font-bold font-mono text-neutral-900 mt-1">
              {metrics.scheduledCount}
            </div>
          </div>

          <div
            onClick={() => {
              setStatusFilter(statusFilter === 'In Progress' ? '' : 'In Progress');
              setOverdueOnly(false);
              setPage(1);
            }}
            className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
              statusFilter === 'In Progress'
                ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-300'
                : 'bg-white border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <div className="text-[11px] font-semibold text-amber-700 flex items-center justify-between">
              <span>In Progress</span>
              <Play className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            </div>
            <div className="text-xl font-bold font-mono text-neutral-900 mt-1">
              {metrics.inProgressCount}
            </div>
          </div>

          <div
            onClick={() => {
              setOverdueOnly(!overdueOnly);
              setStatusFilter('');
              setPage(1);
            }}
            className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
              overdueOnly
                ? 'bg-red-50 border-red-300 ring-1 ring-red-300'
                : 'bg-white border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <div className="text-[11px] font-semibold text-red-700 flex items-center justify-between">
              <span>Overdue</span>
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            </div>
            <div className="text-xl font-bold font-mono text-red-700 mt-1">
              {metrics.overdueCount}
            </div>
          </div>

          <div
            onClick={() => {
              setStatusFilter(statusFilter === 'Completed' ? '' : 'Completed');
              setOverdueOnly(false);
              setPage(1);
            }}
            className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
              statusFilter === 'Completed'
                ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-300'
                : 'bg-white border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <div className="text-[11px] font-semibold text-emerald-700 flex items-center justify-between">
              <span>Completed</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-xl font-bold font-mono text-neutral-900 mt-1">
              {metrics.completedCount}
            </div>
          </div>

          <div className="p-3.5 rounded-lg border bg-white border-neutral-200">
            <div className="text-[11px] font-semibold text-neutral-600 flex items-center justify-between">
              <span>Total Spend</span>
              <DollarSign className="w-3.5 h-3.5 text-neutral-400" />
            </div>
            <div className="text-lg font-bold font-mono text-neutral-900 mt-1 truncate">
              {formatCost(metrics.totalCost)}
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-neutral-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search work order #, title, or description..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
            />
          </div>

          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setOverdueOnly(false);
              setPage(1);
            }}
            className="w-full md:w-40 px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A] bg-white cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="Open">Open</option>
            <option value="Scheduled">Scheduled</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          {/* Priority Dropdown */}
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
            className="w-full md:w-36 px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A] bg-white cursor-pointer"
          >
            <option value="">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          {/* Type Dropdown */}
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="w-full md:w-40 px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A] bg-white cursor-pointer"
          >
            <option value="">All Types</option>
            <option value="Preventative">Preventative</option>
            <option value="Corrective">Corrective</option>
            <option value="Inspection">Inspection</option>
            <option value="Upgrade">Upgrade</option>
            <option value="Calibration">Calibration</option>
            <option value="Other">Other</option>
          </select>

          {(search || statusFilter || priorityFilter || typeFilter || overdueOnly) && (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('');
                setPriorityFilter('');
                setTypeFilter('');
                setOverdueOnly(false);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded transition-colors whitespace-nowrap cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">
          {error}
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 text-neutral-600 border-b border-neutral-200 font-semibold uppercase text-[11px] tracking-wider select-none">
                <th
                  onClick={() => handleSort('work_order_number')}
                  className="py-3 px-4 cursor-pointer hover:bg-neutral-100"
                >
                  <div className="flex items-center gap-1">
                    <span>WO #</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th className="py-3 px-4">Asset</th>
                <th
                  onClick={() => handleSort('title')}
                  className="py-3 px-4 cursor-pointer hover:bg-neutral-100"
                >
                  <div className="flex items-center gap-1">
                    <span>Title & Type</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('priority')}
                  className="py-3 px-4 cursor-pointer hover:bg-neutral-100"
                >
                  <div className="flex items-center gap-1">
                    <span>Priority</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('status')}
                  className="py-3 px-4 cursor-pointer hover:bg-neutral-100"
                >
                  <div className="flex items-center gap-1">
                    <span>Status</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th className="py-3 px-4">Vendor</th>
                <th
                  onClick={() => handleSort('due_date')}
                  className="py-3 px-4 cursor-pointer hover:bg-neutral-100"
                >
                  <div className="flex items-center gap-1">
                    <span>Dates</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('service_cost')}
                  className="py-3 px-4 text-right cursor-pointer hover:bg-neutral-100"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Cost</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-[#FF6A1A]" />
                      <span>Loading maintenance records...</span>
                    </div>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-400">
                    <div className="flex flex-col items-center gap-2">
                      <Wrench className="w-8 h-8 text-neutral-300" />
                      <div className="font-semibold text-neutral-700">No work orders found</div>
                      <div className="text-[11px] text-neutral-500">
                        {search || statusFilter || priorityFilter || typeFilter || overdueOnly
                          ? 'Try adjusting your search criteria or clearing filters.'
                          : 'Create your first work order to schedule repairs and track service costs.'}
                      </div>
                      {isTenantAdmin && !search && !statusFilter && (
                        <button
                          onClick={() => {
                            setEditingRecord(null);
                            setIsFormModalOpen(true);
                          }}
                          className="mt-2 px-3 py-1.5 bg-[#FF6A1A] text-white text-xs font-semibold rounded hover:bg-[#e55910] transition-colors cursor-pointer"
                        >
                          Create Work Order
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const overdue = isOverdue(r);

                  return (
                    <tr
                      key={r.id}
                      onClick={() => setActiveWorkOrderId(r.id)}
                      className="hover:bg-neutral-50 transition-colors cursor-pointer"
                    >
                      {/* Work Order Number */}
                      <td className="py-2.5 px-4 font-mono font-semibold text-neutral-900 whitespace-nowrap">
                        <span className="text-[#FF6A1A] hover:underline flex items-center gap-1">
                          {r.work_order_number}
                        </span>
                      </td>

                      {/* Asset */}
                      <td
                        className="py-2.5 px-4 whitespace-nowrap"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (r.asset_id) onNavigate('asset-detail', r.asset_id);
                        }}
                      >
                        <div className="font-medium text-neutral-900 hover:text-[#FF6A1A] transition-colors">
                          {r.asset?.name || 'Asset'}
                        </div>
                        <div className="font-mono text-[11px] text-neutral-400">
                          {r.asset?.asset_tag || '—'}
                        </div>
                      </td>

                      {/* Title & Type */}
                      <td className="py-2.5 px-4 max-w-xs">
                        <div className="font-medium text-neutral-900 truncate" title={r.title}>
                          {r.title}
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">
                          <span className="inline-block px-1.5 py-0.2 bg-neutral-100 rounded text-neutral-600 font-mono text-[10px]">
                            {r.maintenance_type}
                          </span>
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {getPriorityBadge(r.priority)}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {getStatusBadge(r.status)}
                          {overdue && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700"
                              title="Due date has passed"
                            >
                              Overdue
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Vendor */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {r.vendor?.name ? (
                          <div className="text-neutral-800 font-medium">{r.vendor.name}</div>
                        ) : (
                          <span className="text-neutral-400 italic">In-House / None</span>
                        )}
                      </td>

                      {/* Dates */}
                      <td className="py-2.5 px-4 whitespace-nowrap text-neutral-700">
                        {r.due_date ? (
                          <div className={overdue ? 'text-red-700 font-semibold' : ''}>
                            Due: {formatDate(r.due_date)}
                          </div>
                        ) : r.scheduled_date ? (
                          <div>Sched: {formatDate(r.scheduled_date)}</div>
                        ) : (
                          <div className="text-neutral-400 text-[11px]">Created {formatDate(r.created_at)}</div>
                        )}
                      </td>

                      {/* Cost */}
                      <td className="py-2.5 px-4 text-right font-mono font-medium text-neutral-900 whitespace-nowrap">
                        {formatCost(r.service_cost, r.currency)}
                      </td>

                      {/* Actions */}
                      <td
                        className="py-2.5 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setActiveWorkOrderId(r.id)}
                            className="p-1 hover:bg-neutral-100 text-neutral-600 rounded transition-colors"
                            title="View Full Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {isTenantAdmin && (r.status === 'Open' || r.status === 'Scheduled' || r.status === 'In Progress') && (
                            <button
                              onClick={() => {
                                setEditingRecord(r);
                                setIsFormModalOpen(true);
                              }}
                              className="p-1 hover:bg-neutral-100 text-neutral-600 rounded transition-colors"
                              title="Edit Work Order"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-4 py-3 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-600 bg-neutral-50/50">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 border border-neutral-300 rounded bg-white focus:outline-none focus:border-[#FF6A1A]"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>records per page</span>
          </div>

          <div className="flex items-center gap-3">
            <span>
              Showing {totalCount === 0 ? 0 : (page - 1) * limit + 1} to{' '}
              {Math.min(page * limit, totalCount)} of {totalCount} records
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="p-1 rounded border border-neutral-200 bg-white hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-mono font-medium">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="p-1 rounded border border-neutral-200 bg-white hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {activeWorkOrderId && (
        <MaintenanceDetailModal
          workOrderId={activeWorkOrderId}
          onClose={() => setActiveWorkOrderId(null)}
          onNavigateToAsset={(aid) => onNavigate('asset-detail', aid)}
          onRecordUpdated={() => {
            fetchRecords();
            fetchMetrics();
          }}
          onOpenEdit={(r) => {
            setActiveWorkOrderId(null);
            setEditingRecord(r);
            setIsFormModalOpen(true);
          }}
        />
      )}

      {/* Create / Edit Form Modal */}
      {isFormModalOpen && (
        <MaintenanceFormModal
          editingRecord={editingRecord}
          onClose={() => {
            setIsFormModalOpen(false);
            setEditingRecord(null);
          }}
          onSuccess={() => {
            setIsFormModalOpen(false);
            setEditingRecord(null);
            fetchRecords();
            fetchMetrics();
          }}
        />
      )}
    </div>
  );
};
