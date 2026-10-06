/**
 * AssetMT - Global Tenant Audit Log
 * Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
 * Immutable operational audit events with cryptographic integrity & export
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Filter,
  Download,
  Search,
  RotateCw,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import { AuditLogFilterOptions } from '../../shared/types.ts';

interface AuditLogViewProps {
  token: string;
  onNavigateToAsset?: (assetId: string) => void;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ token, onNavigateToAsset }) => {
  const [events, setEvents] = useState<
    Array<{
      id: string;
      timestamp: string;
      actor: string;
      event_type: string;
      asset_tag: string;
      asset_name: string;
      notes: string;
      details: Record<string, any>;
    }>
  >([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(50);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [eventType, setEventType] = useState('');
  const [assetId, setAssetId] = useState('');

  const loadAuditLog = async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: AuditLogFilterOptions = {
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        event_type: eventType || undefined,
        asset_id: assetId || undefined,
        limit,
        offset: (page - 1) * limit,
      };

      const res = await api.getAuditLog(token, filters);
      if (res.success) {
        setEvents(res.data);
        setTotal(res.total);
      } else {
        setError(res.error || 'Failed to query tenant audit log');
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with audit log service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLog();
  }, [page, eventType]);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const filters: AuditLogFilterOptions = {
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        event_type: eventType || undefined,
        asset_id: assetId || undefined,
      };

      const csvData = await api.downloadAuditLogCsv(token, filters);
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `AssetMT_AuditLog_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  const eventTypeOptions = [
    'ALL',
    'CREATED',
    'UPDATED',
    'CHECKED_OUT',
    'CHECKED_IN',
    'TRANSFERRED',
    'MAINTENANCE_CREATED',
    'MAINTENANCE_SCHEDULED',
    'MAINTENANCE_COMPLETED',
    'INVENTORY_STOCK_IN',
    'INVENTORY_STOCK_OUT',
    'ASSET_RESERVED',
    'LEASE_STARTED',
    'LEASE_RETURNED',
    'ASSET_MOVED',
    'ASSET_DISPOSED',
    'AUDIT_COMPLETED',
    'DEPRECIATION_CONFIGURED',
    'WARRANTY_ADDED',
    'CONTRACT_CREATED',
    'LICENSE_ALLOCATED',
    'INSURANCE_ADDED',
    'USER_INVITED',
    'USER_ROLE_CHANGED',
    'USER_DEACTIVATED',
    'SETTINGS_UPDATED',
    'ASSET_IMPORTED',
    'REPORT_EXPORTED',
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#FF6A1A] tracking-wider uppercase mb-1">
            <Lock className="w-4 h-4" />
            <span>Compliance & Traceability</span>
          </div>
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
            Tenant Audit Log
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Cryptographically sealed and append-only audit trail of all custody changes, maintenance actions, and security events.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          disabled={exporting || loading || events.length === 0}
          className="px-3.5 py-2 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold rounded shadow-xs inline-flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-neutral-500" />
          <span>{exporting ? 'Exporting...' : 'Export Audit CSV'}</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
            <Filter className="w-3.5 h-3.5 text-[#FF6A1A]" />
            <span>Audit Query Filters</span>
          </div>
          <button
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setEventType('');
              setAssetId('');
              setPage(1);
              setTimeout(loadAuditLog, 50);
            }}
            className="text-[11px] text-neutral-500 hover:text-neutral-800 underline cursor-pointer"
          >
            Clear Filters
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">
              Event Type
            </label>
            <select
              value={eventType}
              onChange={(e) => {
                setEventType(e.target.value === 'ALL' ? '' : e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 border border-neutral-300 rounded text-xs focus:outline-none focus:border-[#FF6A1A] bg-white"
            >
              {eventTypeOptions.map((opt) => (
                <option key={opt} value={opt === 'ALL' ? '' : opt}>
                  {opt.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">
              From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 border border-neutral-300 rounded text-xs focus:outline-none focus:border-[#FF6A1A]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">
              To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 border border-neutral-300 rounded text-xs focus:outline-none focus:border-[#FF6A1A]"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setPage(1);
                loadAuditLog();
              }}
              disabled={loading}
              className="w-full py-1.5 px-3 bg-neutral-900 hover:bg-neutral-800 text-white font-semibold rounded text-xs transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              <span>Apply Filters</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Events Table */}
      <div className="bg-white rounded-lg border border-neutral-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-900">Recorded Audit Events</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-200 text-neutral-700 font-mono">
              {total} events
            </span>
          </div>
          <span className="text-[11px] text-neutral-400">
            Page {page} of {totalPages}
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-neutral-500">
            <div className="w-6 h-6 border-2 border-neutral-300 border-t-[#FF6A1A] rounded-full animate-spin mx-auto mb-2"></div>
            Loading audit records...
          </div>
        ) : events.length === 0 ? (
          <div className="py-16 text-center text-xs text-neutral-500">
            No audit records found matching the specified parameters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-semibold text-neutral-600">
                  <th className="py-2.5 px-4 w-40">Timestamp</th>
                  <th className="py-2.5 px-4 w-44">Event Action</th>
                  <th className="py-2.5 px-4 w-48">Asset Entity</th>
                  <th className="py-2.5 px-4">Details & Notes</th>
                  <th className="py-2.5 px-4 w-36">Actor / Origin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-neutral-50/80 transition-colors">
                    {/* Timestamp */}
                    <td className="py-3 px-4 font-mono text-[11px] text-neutral-500">
                      <div>{new Date(ev.timestamp).toLocaleDateString()}</div>
                      <div className="text-[10px] text-neutral-400">
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </div>
                    </td>

                    {/* Event Type Badge */}
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-neutral-100 text-neutral-800 border border-neutral-200 inline-block">
                        {ev.event_type}
                      </span>
                    </td>

                    {/* Asset Reference */}
                    <td className="py-3 px-4">
                      {ev.asset_tag !== 'N/A' ? (
                        <div>
                          <span className="font-semibold text-neutral-900 block">
                            {ev.asset_name}
                          </span>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            {ev.asset_tag}
                          </span>
                        </div>
                      ) : (
                        <span className="text-neutral-400 italic">Workspace Global</span>
                      )}
                    </td>

                    {/* Details / Notes */}
                    <td className="py-3 px-4 text-neutral-700">
                      {ev.notes && <div className="font-medium text-xs mb-0.5">{ev.notes}</div>}
                      {ev.details && Object.keys(ev.details).length > 0 && (
                        <div className="text-[10px] font-mono text-neutral-500 bg-neutral-50 p-1.5 rounded border border-neutral-200/60 max-w-xl truncate">
                          {JSON.stringify(ev.details)}
                        </div>
                      )}
                    </td>

                    {/* Actor */}
                    <td className="py-3 px-4 text-[10px] font-mono text-neutral-400 truncate max-w-xs" title={ev.actor}>
                      {ev.actor ? ev.actor.slice(0, 16) + '...' : 'System'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="px-5 py-3 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-500">
          <span>
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} events
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1 border border-neutral-300 rounded hover:bg-neutral-50 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-semibold text-neutral-700">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1 border border-neutral-300 rounded hover:bg-neutral-50 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
