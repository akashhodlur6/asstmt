/**
 * AssetMT - Alerts & Attention Center
 * Real database-derived expiry and operational alerts with multi-window filtering
 * Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
 */

import React, { useState, useEffect } from 'react';
import {
  BellRing,
  AlertTriangle,
  Clock,
  Calendar,
  ShieldAlert,
  FileCheck2,
  KeyRound,
  ShieldCheck,
  Wrench,
  Boxes,
  ClipboardCheck,
  Filter,
  RefreshCw,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { SystemAlert, AlertWindow, AlertCategory } from '../../shared/types.ts';
import { api } from '../lib/api.ts';

interface AlertsViewProps {
  token: string;
  onNavigateToAsset?: (assetId: string) => void;
  onNavigateToView?: (view: string) => void;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  token,
  onNavigateToAsset,
  onNavigateToView,
}) => {
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWindow, setSelectedWindow] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [summary, setSummary] = useState({
    OVERDUE: 0,
    NEXT_7_DAYS: 0,
    NEXT_30_DAYS: 0,
    NEXT_60_90_DAYS: 0,
  });

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const res = await api.getAlerts(token);
      if (res.success && res.data) {
        setAlerts(res.data.alerts || []);
        if (res.data.summaryByWindow) {
          setSummary(res.data.summaryByWindow);
        }
      }
    } catch (err) {
      console.error('Failed to load system alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [token]);

  const filteredAlerts = alerts.filter((a) => {
    if (selectedWindow !== 'ALL' && a.window !== selectedWindow) return false;
    if (selectedCategory !== 'ALL' && a.category !== selectedCategory) return false;
    return true;
  });

  const getCategoryIcon = (cat: AlertCategory) => {
    switch (cat) {
      case 'WARRANTY':
        return ShieldCheck;
      case 'CONTRACT':
        return FileCheck2;
      case 'INSURANCE':
        return ShieldAlert;
      case 'LICENSE':
        return KeyRound;
      case 'MAINTENANCE':
        return Wrench;
      case 'INVENTORY':
        return Boxes;
      case 'AUDIT':
        return ClipboardCheck;
      default:
        return AlertTriangle;
    }
  };

  const getSeverityBadge = (severity: SystemAlert['severity']) => {
    switch (severity) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">Critical</span>;
      case 'WARNING':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">Warning</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">Notice</span>;
    }
  };

  const getWindowBadge = (win: AlertWindow) => {
    switch (win) {
      case 'OVERDUE':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-600 border border-red-200">Overdue</span>;
      case 'NEXT_7_DAYS':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-600 border border-amber-200">&le; 7 Days</span>;
      case 'NEXT_30_DAYS':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-neutral-100 text-neutral-700 border border-neutral-200">&le; 30 Days</span>;
      case 'NEXT_60_90_DAYS':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-neutral-50 text-neutral-500 border border-neutral-200">60-90 Days</span>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#FF6A1A]/10 flex items-center justify-center text-[#FF6A1A]">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-900">Alerts & Attention Center</h1>
              <p className="text-xs text-neutral-500">
                Live database compliance notifications: expiring warranties, contracts, insurance, licenses, leases, and pending work orders
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadAlerts}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 transition cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Alerts</span>
        </button>
      </div>

      {/* Metric Window Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setSelectedWindow('OVERDUE')}
          className={`p-3 rounded-lg border text-left transition cursor-pointer ${
            selectedWindow === 'OVERDUE'
              ? 'border-red-400 bg-red-50/50 shadow-sm'
              : 'border-neutral-200 bg-white hover:border-red-200'
          }`}
        >
          <div className="text-[11px] font-semibold text-red-600 uppercase tracking-wide">Overdue</div>
          <div className="text-2xl font-bold text-neutral-900 mt-0.5">{summary.OVERDUE}</div>
          <div className="text-[10px] text-neutral-500 mt-1">Requires immediate attention</div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedWindow('NEXT_7_DAYS')}
          className={`p-3 rounded-lg border text-left transition cursor-pointer ${
            selectedWindow === 'NEXT_7_DAYS'
              ? 'border-amber-400 bg-amber-50/50 shadow-sm'
              : 'border-neutral-200 bg-white hover:border-amber-200'
          }`}
        >
          <div className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide">Next 7 Days</div>
          <div className="text-2xl font-bold text-neutral-900 mt-0.5">{summary.NEXT_7_DAYS}</div>
          <div className="text-[10px] text-neutral-500 mt-1">Due within the upcoming week</div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedWindow('NEXT_30_DAYS')}
          className={`p-3 rounded-lg border text-left transition cursor-pointer ${
            selectedWindow === 'NEXT_30_DAYS'
              ? 'border-blue-400 bg-blue-50/50 shadow-sm'
              : 'border-neutral-200 bg-white hover:border-blue-200'
          }`}
        >
          <div className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide">Next 30 Days</div>
          <div className="text-2xl font-bold text-neutral-900 mt-0.5">{summary.NEXT_30_DAYS}</div>
          <div className="text-[10px] text-neutral-500 mt-1">Due within the month</div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedWindow('NEXT_60_90_DAYS')}
          className={`p-3 rounded-lg border text-left transition cursor-pointer ${
            selectedWindow === 'NEXT_60_90_DAYS'
              ? 'border-[#FF6A1A] bg-orange-50/50 shadow-sm'
              : 'border-neutral-200 bg-white hover:border-orange-200'
          }`}
        >
          <div className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide">60 - 90 Days</div>
          <div className="text-2xl font-bold text-neutral-900 mt-0.5">{summary.NEXT_60_90_DAYS}</div>
          <div className="text-[10px] text-neutral-500 mt-1">Quarterly outlook</div>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-neutral-500 mr-2 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Timeframe:
          </span>
          {['ALL', 'OVERDUE', 'NEXT_7_DAYS', 'NEXT_30_DAYS', 'NEXT_60_90_DAYS'].map((w) => (
            <button
              key={w}
              onClick={() => setSelectedWindow(w)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
                selectedWindow === w
                  ? 'bg-neutral-900 text-white'
                  : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100'
              }`}
            >
              {w === 'ALL'
                ? `All Windows (${alerts.length})`
                : w === 'OVERDUE'
                ? `Overdue (${summary.OVERDUE})`
                : w === 'NEXT_7_DAYS'
                ? `Next 7 Days (${summary.NEXT_7_DAYS})`
                : w === 'NEXT_30_DAYS'
                ? `Next 30 Days (${summary.NEXT_30_DAYS})`
                : `60-90 Days (${summary.NEXT_60_90_DAYS})`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-neutral-500">Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs px-2.5 py-1 bg-white border border-neutral-300 rounded font-medium text-neutral-700"
          >
            <option value="ALL">All Categories</option>
            <option value="WARRANTY">Warranties</option>
            <option value="CONTRACT">Contracts</option>
            <option value="INSURANCE">Insurance</option>
            <option value="LICENSE">Software Licenses</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="RESERVATION">Reservations</option>
            <option value="INVENTORY">Inventory / Stock</option>
            <option value="AUDIT">Physical Audits</option>
          </select>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-2.5">
        {loading ? (
          <div className="py-16 text-center text-xs text-neutral-400">Loading active compliance alerts...</div>
        ) : filteredAlerts.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-lg border border-neutral-200">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-800">All clear in this view</h3>
            <p className="text-xs text-neutral-500 mt-0.5">No overdue or upcoming compliance events match the selected criteria.</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const Icon = getCategoryIcon(alert.category);
            return (
              <div
                key={alert.id}
                className="bg-white p-3.5 rounded-lg border border-neutral-200 hover:border-neutral-300 transition shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-neutral-100 flex items-center justify-center text-neutral-600 shrink-0 mt-0.5">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-neutral-900">{alert.title}</span>
                      {getSeverityBadge(alert.severity)}
                      {getWindowBadge(alert.window)}
                      {alert.reference_code && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 bg-neutral-100 text-neutral-600 rounded">
                          {alert.reference_code}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-600 mt-1">{alert.description}</p>
                    {alert.due_date && (
                      <div className="flex items-center gap-3 text-[11px] text-neutral-400 mt-1 font-mono">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-neutral-400" />
                          Due: {alert.due_date}
                        </span>
                        {alert.days_remaining !== undefined && (
                          <span
                            className={
                              alert.days_remaining < 0
                                ? 'text-red-600 font-bold'
                                : alert.days_remaining <= 7
                                ? 'text-amber-600 font-semibold'
                                : 'text-neutral-500'
                            }
                          >
                            {alert.days_remaining < 0
                              ? `${Math.abs(alert.days_remaining)} days overdue`
                              : `${alert.days_remaining} days remaining`}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {alert.category === 'CONTRACT' && onNavigateToView && (
                    <button
                      onClick={() => onNavigateToView('contracts')}
                      className="px-2.5 py-1 rounded text-xs font-medium border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 flex items-center gap-1 cursor-pointer"
                    >
                      <span>View Contracts</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                  {alert.category === 'LICENSE' && onNavigateToView && (
                    <button
                      onClick={() => onNavigateToView('licenses')}
                      className="px-2.5 py-1 rounded text-xs font-medium border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 flex items-center gap-1 cursor-pointer"
                    >
                      <span>View Licenses</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                  {alert.category === 'INVENTORY' && onNavigateToView && (
                    <button
                      onClick={() => onNavigateToView('inventory')}
                      className="px-2.5 py-1 rounded text-xs font-medium border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 flex items-center gap-1 cursor-pointer"
                    >
                      <span>View Inventory</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                  {alert.category === 'MAINTENANCE' && onNavigateToView && (
                    <button
                      onClick={() => onNavigateToView('maintenance')}
                      className="px-2.5 py-1 rounded text-xs font-medium border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 flex items-center gap-1 cursor-pointer"
                    >
                      <span>View Maintenance</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                  {alert.category === 'AUDIT' && onNavigateToView && (
                    <button
                      onClick={() => onNavigateToView('audits')}
                      className="px-2.5 py-1 rounded text-xs font-medium border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 flex items-center gap-1 cursor-pointer"
                    >
                      <span>Reconcile Audit</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
