/**
 * AssetMT - SaaS Platform Admin Foundation
 * Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
 * STRICT SEPARATION: Platform Admin (SaaS Owner) != Tenant Admin (Customer Organization).
 * Server-side authorization only via /api/platform/* endpoints.
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Building2,
  Users,
  Layers,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCw,
  Search,
  Lock,
  Server,
  Activity,
  BarChart,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import { PlatformTenantItem } from '../../shared/types.ts';

interface PlatformAdminViewProps {
  token: string;
}

export const PlatformAdminView: React.FC<PlatformAdminViewProps> = ({ token }) => {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [tenants, setTenants] = useState<PlatformTenantItem[]>([]);
  const [metrics, setMetrics] = useState<{
    totalTenants: number;
    activeTenants: number;
    suspendedTenants: number;
    totalAssets: number;
    totalUsers: number;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingCompanyId, setUpdatingCompanyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const verifyAndLoad = async () => {
    setLoading(true);
    setError(null);
    try {
      const verifyRes = await api.checkPlatformAdmin(token);
      if (!verifyRes.success || !verifyRes.is_platform_admin) {
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      setIsAuthorized(true);

      const [tenantsRes, metricsRes] = await Promise.all([
        api.getPlatformTenants(token),
        api.getPlatformMetrics(token),
      ]);

      if (tenantsRes.success) setTenants(tenantsRes.data);
      if (metricsRes.success) setMetrics(metricsRes.data);
    } catch (err: any) {
      setError(err.message || 'Error communicating with platform admin service');
      setIsAuthorized(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    verifyAndLoad();
  }, [token]);

  const handleToggleStatus = async (companyId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!confirm(`Are you sure you want to change tenant status to ${nextStatus}?`)) return;

    setUpdatingCompanyId(companyId);
    try {
      const res = await api.updatePlatformTenantStatus(token, companyId, nextStatus);
      if (res.success) {
        verifyAndLoad();
      } else {
        alert(res.error || 'Failed to update tenant status');
      }
    } catch (err: any) {
      alert(`Error updating tenant status: ${err.message}`);
    } finally {
      setUpdatingCompanyId(null);
    }
  };

  // If unauthorized: show strict access denial message
  if (isAuthorized === false) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 bg-white rounded-lg border border-red-200 shadow-xl text-center space-y-4">
        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-neutral-900">
          Platform Administration Access Denied
        </h2>
        <p className="text-xs text-neutral-600 leading-relaxed">
          Your authenticated identity is not registered in the platform owner access control list.
          Tenant Admin privileges do not grant SaaS platform ownership access.
        </p>
        <div className="p-3 bg-neutral-50 rounded border border-neutral-200 text-[11px] text-neutral-500 font-mono text-left space-y-1">
          <div>Platform Security Constraint:</div>
          <div>• Authorization authoritative at Cloudflare Worker layer.</div>
          <div>• Configured via <code>platform_admins</code> table or server environment.</div>
        </div>
      </div>
    );
  }

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.code && t.code.toLowerCase().includes(search.toLowerCase())) ||
      t.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-purple-600 tracking-wider uppercase mb-1">
            <Server className="w-4 h-4" />
            <span>Akshigo Tech SaaS Owner Portal</span>
          </div>
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
            Platform Administration (Foundation)
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Cross-tenant observability, quota allocations, tenant life-cycle activation, and platform health.
          </p>
        </div>

        <button
          onClick={verifyAndLoad}
          disabled={loading}
          className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded shadow-xs inline-flex items-center gap-2 transition-colors cursor-pointer"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Platform Metrics</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Top Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          <div className="p-4 bg-white rounded-lg border border-neutral-200 shadow-xs">
            <div className="text-[10px] font-semibold text-neutral-500 uppercase">Total Tenants</div>
            <div className="text-xl font-extrabold text-neutral-900 mt-0.5">{metrics.totalTenants}</div>
          </div>
          <div className="p-4 bg-white rounded-lg border border-neutral-200 shadow-xs">
            <div className="text-[10px] font-semibold text-emerald-600 uppercase">Active Workspaces</div>
            <div className="text-xl font-extrabold text-emerald-700 mt-0.5">{metrics.activeTenants}</div>
          </div>
          <div className="p-4 bg-white rounded-lg border border-neutral-200 shadow-xs">
            <div className="text-[10px] font-semibold text-red-600 uppercase">Suspended Tenants</div>
            <div className="text-xl font-extrabold text-red-700 mt-0.5">{metrics.suspendedTenants}</div>
          </div>
          <div className="p-4 bg-white rounded-lg border border-neutral-200 shadow-xs">
            <div className="text-[10px] font-semibold text-neutral-500 uppercase">Global Assets</div>
            <div className="text-xl font-extrabold text-neutral-900 mt-0.5">{metrics.totalAssets}</div>
          </div>
          <div className="p-4 bg-white rounded-lg border border-neutral-200 shadow-xs">
            <div className="text-[10px] font-semibold text-neutral-500 uppercase">Registered Users</div>
            <div className="text-xl font-extrabold text-neutral-900 mt-0.5">{metrics.totalUsers}</div>
          </div>
        </div>
      )}

      {/* Search & Tenants Table */}
      <div className="bg-white rounded-lg border border-neutral-200 shadow-xs overflow-hidden space-y-0">
        <div className="p-4 border-b border-neutral-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-neutral-50/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-900">Tenant Workspaces</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-200 text-neutral-700 font-mono">
              {filteredTenants.length}
            </span>
          </div>

          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Search companies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-neutral-300 rounded text-xs focus:outline-none focus:border-purple-600 bg-white"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-neutral-500">
            <div className="w-6 h-6 border-2 border-neutral-300 border-t-purple-600 rounded-full animate-spin mx-auto mb-2"></div>
            Loading platform tenant registry...
          </div>
        ) : filteredTenants.length === 0 ? (
          <div className="py-16 text-center text-xs text-neutral-500">
            No tenant organizations found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-semibold text-neutral-600">
                  <th className="py-2.5 px-4">Company Name & Identifier</th>
                  <th className="py-2.5 px-4">Subscription Plan</th>
                  <th className="py-2.5 px-4">Workspace Status</th>
                  <th className="py-2.5 px-4">Assets Tracked</th>
                  <th className="py-2.5 px-4">App Users</th>
                  <th className="py-2.5 px-4">Directory Personnel</th>
                  <th className="py-2.5 px-4">Created Date</th>
                  <th className="py-2.5 px-4 text-right">Owner Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredTenants.map((t) => (
                  <tr key={t.id} className="hover:bg-neutral-50/80 transition-colors">
                    {/* Name */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-neutral-400" />
                        <span>{t.name}</span>
                        {t.code && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-neutral-100 text-neutral-600">
                            {t.code}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-400 font-mono mt-0.5 truncate max-w-xs">
                        UUID: {t.id}
                      </div>
                    </td>

                    {/* Plan */}
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-800 border border-neutral-200 font-mono">
                        {t.plan}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${
                          t.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {t.status === 'ACTIVE' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        <span>{t.status}</span>
                      </span>
                    </td>

                    {/* Assets */}
                    <td className="py-3 px-4 font-mono font-medium">
                      <span>{t.asset_count}</span>
                      <span className="text-[10px] text-neutral-400"> / {t.max_assets}</span>
                    </td>

                    {/* App Users */}
                    <td className="py-3 px-4 font-mono font-medium">{t.user_count}</td>

                    {/* Personnel */}
                    <td className="py-3 px-4 font-mono font-medium">{t.employee_count}</td>

                    {/* Created */}
                    <td className="py-3 px-4 text-neutral-500 text-[11px]">
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleToggleStatus(t.id, t.status)}
                        disabled={updatingCompanyId === t.id}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer ${
                          t.status === 'ACTIVE'
                            ? 'border border-red-200 text-red-700 hover:bg-red-50'
                            : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        {t.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
