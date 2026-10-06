/**
 * AssetMT - Maintenance Work Order Detail Modal
 * Full lifecycle state machine transitions with confirmations, resolution logging & audit trail.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import {
  AssetEvent,
  CompleteMaintenanceInput,
  MaintenanceRecord,
  ScheduleMaintenanceInput,
  Vendor,
} from '../../shared/types.ts';
import {
  Wrench,
  X,
  Play,
  CheckCircle2,
  XCircle,
  Calendar,
  Building2,
  DollarSign,
  Clock,
  AlertCircle,
  Edit3,
  CalendarClock,
  History,
  Tag,
  ExternalLink,
} from 'lucide-react';

interface MaintenanceDetailModalProps {
  workOrderId: string;
  onClose: () => void;
  onNavigateToAsset?: (assetId: string) => void;
  onRecordUpdated?: (record: MaintenanceRecord) => void;
  onOpenEdit?: (record: MaintenanceRecord) => void;
}

export const MaintenanceDetailModal: React.FC<MaintenanceDetailModalProps> = ({
  workOrderId,
  onClose,
  onNavigateToAsset,
  onRecordUpdated,
  onOpenEdit,
}) => {
  const { token, role } = useAuth();
  const isTenantAdmin = role === 'TENANT_ADMIN';

  const [record, setRecord] = useState<MaintenanceRecord | null>(null);
  const [events, setEvents] = useState<AssetEvent[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sub-action dialog states
  const [actionType, setActionType] = useState<'schedule' | 'start' | 'complete' | 'cancel' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Schedule sub-form
  const [schedDate, setSchedDate] = useState(new Date().toISOString().split('T')[0]);
  const [schedDueDate, setSchedDueDate] = useState('');
  const [schedVendorId, setSchedVendorId] = useState('');
  const [schedNotes, setSchedNotes] = useState('');

  // Start sub-form
  const [startNotes, setStartNotes] = useState('');

  // Complete sub-form
  const [completeCost, setCompleteCost] = useState('');
  const [completeDowntime, setCompleteDowntime] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Cancel sub-form
  const [cancelReason, setCancelReason] = useState('');

  const fetchRecord = useCallback(async () => {
    if (!token || !workOrderId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.getMaintenanceRecord(token, workOrderId);
      if (res.success) {
        setRecord(res.data);
        setEvents(res.events || []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading work order');
    } finally {
      setLoading(false);
    }
  }, [token, workOrderId]);

  useEffect(() => {
    fetchRecord();
  }, [fetchRecord]);

  useEffect(() => {
    if (!token) return;
    api.getVendors(token, { is_active: 'true' }).then((res) => {
      if (res.success) setVendors(res.data);
    }).catch(() => {});
  }, [token]);

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

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'Open':
        return 'bg-neutral-100 text-neutral-800 border-neutral-200';
      case 'Scheduled':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'In Progress':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'Completed':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'Cancelled':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-neutral-100 text-neutral-700 border-neutral-200';
    }
  };

  const getPriorityBadge = (pr: string) => {
    switch (pr) {
      case 'Critical':
        return 'bg-red-100 text-red-800 border-red-200 font-bold';
      case 'High':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Medium':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'Low':
        return 'bg-neutral-100 text-neutral-700 border-neutral-200';
      default:
        return 'bg-neutral-100 text-neutral-700 border-neutral-200';
    }
  };

  // 1. Handle Schedule
  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !record) return;
    setActionError(null);
    try {
      setActionLoading(true);
      const res = await api.scheduleMaintenance(token, record.id, {
        scheduled_date: schedDate,
        due_date: schedDueDate || null,
        vendor_id: schedVendorId || null,
        notes: schedNotes || undefined,
      });
      if (res.success) {
        setRecord(res.data);
        setActionType(null);
        if (onRecordUpdated) onRecordUpdated(res.data);
        await fetchRecord();
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to schedule work order');
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Handle Start Work
  const handleStartSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !record) return;
    setActionError(null);
    try {
      setActionLoading(true);
      const res = await api.startMaintenance(token, record.id, {
        started_at: new Date().toISOString(),
        notes: startNotes || undefined,
      });
      if (res.success) {
        setRecord(res.data);
        setActionType(null);
        if (onRecordUpdated) onRecordUpdated(res.data);
        await fetchRecord();
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to start work order');
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Handle Complete
  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !record) return;
    if (!resolutionNotes.trim()) {
      setActionError('Resolution notes are required when completing a work order.');
      return;
    }
    setActionError(null);
    try {
      setActionLoading(true);
      const payload: CompleteMaintenanceInput = {
        completed_at: new Date().toISOString(),
        resolution_notes: resolutionNotes.trim(),
        service_cost: completeCost ? parseFloat(completeCost) : null,
        downtime_minutes: completeDowntime ? parseInt(completeDowntime, 10) : null,
      };
      const res = await api.completeMaintenance(token, record.id, payload);
      if (res.success) {
        setRecord(res.data);
        setActionType(null);
        if (onRecordUpdated) onRecordUpdated(res.data);
        await fetchRecord();
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to complete work order');
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Handle Cancel
  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !record) return;
    if (!cancelReason.trim()) {
      setActionError('Cancellation reason is required.');
      return;
    }
    setActionError(null);
    try {
      setActionLoading(true);
      const res = await api.cancelMaintenance(token, record.id, {
        reason: cancelReason.trim(),
      });
      if (res.success) {
        setRecord(res.data);
        setActionType(null);
        if (onRecordUpdated) onRecordUpdated(res.data);
        await fetchRecord();
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to cancel work order');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-8 text-center text-xs text-neutral-400">
          Loading work order #{workOrderId}...
        </div>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-4">
          <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-lg">
            {error || 'Work order record could not be found.'}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-1.5 bg-neutral-100 text-neutral-700 rounded text-xs font-medium hover:bg-neutral-200"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-neutral-200 shadow-xl max-w-3xl w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto font-['Plus_Jakarta_Sans',sans-serif]">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-neutral-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
                {record.work_order_number}
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded font-medium border ${getStatusBadge(record.status)}`}>
                {record.status}
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded font-medium border ${getPriorityBadge(record.priority)}`}>
                {record.priority}
              </span>
              <span className="text-[11px] text-neutral-500 font-mono">
                {record.maintenance_type}
              </span>
            </div>
            <h2 className="text-base font-bold text-neutral-900 pt-1">{record.title}</h2>
          </div>

          <div className="flex items-center gap-2">
            {isTenantAdmin && (
              <button
                type="button"
                onClick={() => {
                  if (onOpenEdit) onOpenEdit(record);
                }}
                className="px-2.5 py-1.5 border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold rounded inline-flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-neutral-500" />
                <span>Edit</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-700 p-1.5 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Lifecycle Control Bar (Visible for authorized users on non-terminal states) */}
        {isTenantAdmin && record.status !== 'Completed' && record.status !== 'Cancelled' && (
          <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider">
              Workflow Actions:
            </div>
            <div className="flex items-center gap-2">
              {record.status === 'Open' && (
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setSchedDate(new Date().toISOString().split('T')[0]);
                    setSchedVendorId(record.vendor_id || '');
                    setActionType('schedule');
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <CalendarClock className="w-3.5 h-3.5" />
                  <span>Schedule Service</span>
                </button>
              )}

              {(record.status === 'Open' || record.status === 'Scheduled') && (
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setActionType('start');
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Start Work</span>
                </button>
              )}

              {record.status === 'In Progress' && (
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setCompleteCost(record.service_cost ? String(record.service_cost) : '');
                    setActionType('complete');
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Complete Work Order</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  setActionType('cancel');
                }}
                className="px-3 py-1.5 border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 rounded font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancel Work Order</span>
              </button>
            </div>
          </div>
        )}

        {/* Sub-form: Schedule */}
        {actionType === 'schedule' && (
          <form onSubmit={handleScheduleSubmit} className="p-4 bg-amber-50/60 border border-amber-200 rounded-lg space-y-3 text-xs">
            <div className="font-bold text-amber-900 flex items-center justify-between">
              <span>Schedule Service Appointment</span>
              <button type="button" onClick={() => setActionType(null)} className="text-amber-700 hover:text-amber-900">
                Cancel
              </button>
            </div>
            {actionError && <p className="text-red-600 text-[11px]">{actionError}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-neutral-700 font-semibold mb-1">Scheduled Date *</label>
                <input
                  type="date"
                  required
                  value={schedDate}
                  onChange={(e) => setSchedDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-neutral-300 rounded bg-white"
                />
              </div>
              <div>
                <label className="block text-neutral-700 font-semibold mb-1">Due Date</label>
                <input
                  type="date"
                  value={schedDueDate}
                  onChange={(e) => setSchedDueDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-neutral-300 rounded bg-white"
                />
              </div>
              <div>
                <label className="block text-neutral-700 font-semibold mb-1">Assigned Vendor</label>
                <select
                  value={schedVendorId}
                  onChange={(e) => setSchedVendorId(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-neutral-300 rounded bg-white"
                >
                  <option value="">— Internal / No Vendor —</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="submit"
                disabled={actionLoading}
                className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded font-semibold cursor-pointer"
              >
                {actionLoading ? 'Scheduling...' : 'Confirm Schedule'}
              </button>
            </div>
          </form>
        )}

        {/* Sub-form: Start */}
        {actionType === 'start' && (
          <form onSubmit={handleStartSubmit} className="p-4 bg-blue-50/60 border border-blue-200 rounded-lg space-y-3 text-xs">
            <div className="font-bold text-blue-900 flex items-center justify-between">
              <span>Start Maintenance Work</span>
              <button type="button" onClick={() => setActionType(null)} className="text-blue-700 hover:text-blue-900">
                Cancel
              </button>
            </div>
            {actionError && <p className="text-red-600 text-[11px]">{actionError}</p>}
            <p className="text-blue-800 text-[11px]">
              This will mark the work order as <strong>In Progress</strong> and record the start timestamp.
            </p>
            <div>
              <label className="block text-neutral-700 font-semibold mb-1">Technician Notes (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Technician on-site; disassembly started..."
                value={startNotes}
                onChange={(e) => setStartNotes(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-neutral-300 rounded bg-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="submit"
                disabled={actionLoading}
                className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded font-semibold cursor-pointer"
              >
                {actionLoading ? 'Starting...' : 'Confirm Work In Progress'}
              </button>
            </div>
          </form>
        )}

        {/* Sub-form: Complete */}
        {actionType === 'complete' && (
          <form onSubmit={handleCompleteSubmit} className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-lg space-y-3 text-xs">
            <div className="font-bold text-emerald-950 flex items-center justify-between">
              <span>Complete Maintenance Work Order</span>
              <button type="button" onClick={() => setActionType(null)} className="text-emerald-700 hover:text-emerald-900">
                Cancel
              </button>
            </div>
            {actionError && <p className="text-red-600 text-[11px]">{actionError}</p>}
            <div>
              <label className="block text-neutral-800 font-semibold mb-1">
                Resolution & Service Notes <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                placeholder="Detail work performed, replaced parts, test results, calibration outcome..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-neutral-300 rounded bg-white"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-neutral-700 font-semibold mb-1">Final Service Cost ({record.currency})</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={completeCost}
                  onChange={(e) => setCompleteCost(e.target.value)}
                  className="w-full px-2.5 py-1.5 font-mono border border-neutral-300 rounded bg-white"
                />
              </div>
              <div>
                <label className="block text-neutral-700 font-semibold mb-1">Asset Downtime (Minutes)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 120"
                  value={completeDowntime}
                  onChange={(e) => setCompleteDowntime(e.target.value)}
                  className="w-full px-2.5 py-1.5 font-mono border border-neutral-300 rounded bg-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="submit"
                disabled={actionLoading || !resolutionNotes.trim()}
                className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-semibold cursor-pointer"
              >
                {actionLoading ? 'Completing...' : 'Mark Completed'}
              </button>
            </div>
          </form>
        )}

        {/* Sub-form: Cancel */}
        {actionType === 'cancel' && (
          <form onSubmit={handleCancelSubmit} className="p-4 bg-red-50/60 border border-red-200 rounded-lg space-y-3 text-xs">
            <div className="font-bold text-red-900 flex items-center justify-between">
              <span>Cancel Work Order</span>
              <button type="button" onClick={() => setActionType(null)} className="text-red-700 hover:text-red-900">
                Back
              </button>
            </div>
            {actionError && <p className="text-red-600 text-[11px]">{actionError}</p>}
            <div>
              <label className="block text-neutral-800 font-semibold mb-1">
                Cancellation Reason <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Equipment replaced, work deferred, duplicate ticket..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-neutral-300 rounded bg-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="submit"
                disabled={actionLoading || !cancelReason.trim()}
                className="px-3.5 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded font-semibold cursor-pointer"
              >
                {actionLoading ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </form>
        )}

        {/* Main Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Card 1: Asset & Target Equipment */}
          <div className="p-4 bg-neutral-50/60 border border-neutral-200 rounded-lg space-y-3">
            <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider flex items-center gap-1.5 border-b border-neutral-200 pb-1.5">
              <Tag className="w-3.5 h-3.5 text-neutral-400" />
              <span>Target Asset Information</span>
            </div>

            <dl className="grid grid-cols-2 gap-y-2">
              <dt className="text-neutral-500">Asset Tag:</dt>
              <dd className="font-mono font-bold text-neutral-900 flex items-center gap-1">
                <span>{record.asset?.asset_tag || '—'}</span>
                {record.asset?.id && onNavigateToAsset && (
                  <button
                    type="button"
                    onClick={() => onNavigateToAsset(record.asset!.id)}
                    className="text-[#FF6A1A] hover:underline"
                    title="Open Asset Details"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </dd>

              <dt className="text-neutral-500">Asset Name:</dt>
              <dd className="font-medium text-neutral-800">{record.asset?.name || '—'}</dd>

              <dt className="text-neutral-500">Asset Status:</dt>
              <dd className="font-medium text-neutral-800">{record.asset?.status || '—'}</dd>
            </dl>
          </div>

          {/* Card 2: Schedule & Dates */}
          <div className="p-4 bg-neutral-50/60 border border-neutral-200 rounded-lg space-y-3">
            <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider flex items-center gap-1.5 border-b border-neutral-200 pb-1.5">
              <Calendar className="w-3.5 h-3.5 text-neutral-400" />
              <span>Service Schedule & Dates</span>
            </div>

            <dl className="grid grid-cols-2 gap-y-2">
              <dt className="text-neutral-500">Scheduled Date:</dt>
              <dd className="font-mono font-medium text-neutral-800">{formatDate(record.scheduled_date)}</dd>

              <dt className="text-neutral-500">Due Date:</dt>
              <dd className="font-mono font-medium text-neutral-800">{formatDate(record.due_date)}</dd>

              <dt className="text-neutral-500">Started At:</dt>
              <dd className="font-mono text-neutral-700">{formatTimestamp(record.started_at)}</dd>

              <dt className="text-neutral-500">Completed At:</dt>
              <dd className="font-mono font-semibold text-emerald-800">{formatTimestamp(record.completed_at)}</dd>
            </dl>
          </div>

          {/* Card 3: Vendor & Cost */}
          <div className="p-4 bg-neutral-50/60 border border-neutral-200 rounded-lg space-y-3">
            <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider flex items-center gap-1.5 border-b border-neutral-200 pb-1.5">
              <Building2 className="w-3.5 h-3.5 text-neutral-400" />
              <span>Vendor & Financials</span>
            </div>

            <dl className="grid grid-cols-2 gap-y-2">
              <dt className="text-neutral-500">Service Vendor:</dt>
              <dd className="font-medium text-neutral-900">{record.vendor?.name || 'Internal IT / Maintenance'}</dd>

              <dt className="text-neutral-500">Service Cost:</dt>
              <dd className="font-mono font-bold text-neutral-900">
                {record.service_cost !== null && record.service_cost !== undefined
                  ? `$${Number(record.service_cost).toFixed(2)}`
                  : '—'}
              </dd>

              <dt className="text-neutral-500">Equipment Downtime:</dt>
              <dd className="font-mono text-neutral-800">
                {record.downtime_minutes ? `${record.downtime_minutes} mins` : '—'}
              </dd>
            </dl>
          </div>

          {/* Card 4: Description & Resolution */}
          <div className="p-4 bg-neutral-50/60 border border-neutral-200 rounded-lg space-y-3">
            <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider flex items-center gap-1.5 border-b border-neutral-200 pb-1.5">
              <Wrench className="w-3.5 h-3.5 text-neutral-400" />
              <span>Work Instructions & Notes</span>
            </div>

            <div className="space-y-2">
              <div>
                <span className="text-neutral-400 block text-[10px]">Description:</span>
                <p className="text-neutral-800">{record.description || 'No detailed description provided.'}</p>
              </div>

              {record.resolution_notes && (
                <div className="pt-2 border-t border-neutral-200">
                  <span className="text-neutral-400 block text-[10px]">Resolution / Observations:</span>
                  <p className="text-emerald-900 font-medium italic">{record.resolution_notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section: Audit & Event History */}
        <div className="pt-3 border-t border-neutral-100 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-neutral-500" />
              <span>Work Order Audit Trail (asset_events)</span>
            </h3>
            <span className="text-[10px] font-mono text-neutral-500">
              {events.length} Event{events.length === 1 ? '' : 's'}
            </span>
          </div>

          {events.length === 0 ? (
            <div className="py-4 text-center text-xs text-neutral-400">
              No specific audit events logged for this work order yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {events.map((ev) => (
                <div key={ev.id} className="p-2 bg-neutral-50 rounded border border-neutral-200 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        ev.event_type === 'MAINTENANCE_CREATED'
                          ? 'bg-neutral-200 text-neutral-800'
                          : ev.event_type === 'MAINTENANCE_SCHEDULED'
                          ? 'bg-amber-100 text-amber-800'
                          : ev.event_type === 'MAINTENANCE_STARTED'
                          ? 'bg-blue-100 text-blue-800'
                          : ev.event_type === 'MAINTENANCE_COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {ev.event_type}
                    </span>
                    <span className="text-neutral-600 text-[11px]">
                      {(ev.details as { notes?: string; resolution_notes?: string; reason?: string })?.notes ||
                        (ev.details as { resolution_notes?: string })?.resolution_notes ||
                        (ev.details as { reason?: string })?.reason ||
                        'Status updated'}
                    </span>
                  </div>
                  <span className="text-neutral-400 font-mono text-[10px]">
                    {formatTimestamp(ev.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
