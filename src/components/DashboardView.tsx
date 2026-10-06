/**
 * AssetMT - Enterprise Dashboard
 * Premium B2B SaaS layout with 100% real database metrics, interactive SVG charts,
 * operational telemetry, recent activity timeline, and compliance alert panels.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import { DashboardMetrics, Asset, Site, InventoryItem, AssetReservation, AssetLease, MaintenanceRecord } from '../../shared/types.ts';
import {
  AssetStatusDonutChart,
  CategoryHorizontalBarChart,
  SiteDistributionBarChart,
  MaintenanceActivityChart,
  AssetFinancialOverview,
} from './DashboardCharts.tsx';
import {
  Boxes,
  DollarSign,
  Plus,
  RefreshCw,
  Clock,
  Tag,
  ArrowUpRight,
  ShieldAlert,
  Wrench,
  AlertTriangle,
  ClipboardCheck,
  QrCode,
  BellRing,
  FileCheck2,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  Users,
  AlertOctagon,
  PackageCheck,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (view: string, assetId?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { token, companyName, role } = useAuth();
  const isTenantAdmin = role === 'TENANT_ADMIN';
  const isTechnician = role === 'TECHNICIAN';
  const canAddAsset = isTenantAdmin || isTechnician;

  // Primary Data
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [alertsSummary, setAlertsSummary] = useState<{
    total: number;
    overdue: number;
    next7Days: number;
    next30Days: number;
    next60_90Days: number;
  }>({ total: 0, overdue: 0, next7Days: 0, next30Days: 0, next60_90Days: 0 });

  // Secondary Real Operational Data
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [activeReservationsCount, setActiveReservationsCount] = useState<number>(0);
  const [activeLeasesCount, setActiveLeasesCount] = useState<number>(0);
  const [siteData, setSiteData] = useState<{ siteName: string; count: number }[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [tenantCurrency, setTenantCurrency] = useState<string>('USD');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);

      // Execute primary & secondary telemetry queries in parallel
      const [
        dashRes,
        alertRes,
        invRes,
        resRes,
        leaseRes,
        sitesRes,
        assetsRes,
        maintRes,
        settingsRes,
      ] = await Promise.all([
        api.getDashboard(token),
        api.getAlerts(token).catch(() => null),
        api.getInventoryItems(token).catch(() => null),
        api.getAssetReservations(token).catch(() => null),
        api.getAssetLeases(token).catch(() => null),
        api.getSites(token).catch(() => null),
        api.getAssets(token, { limit: 100 }).catch(() => null),
        api.getMaintenanceRecords(token).catch(() => null),
        api.getTenantSettings(token).catch(() => null),
      ]);

      if (dashRes.success) {
        setMetrics(dashRes.data);
      }

      if (alertRes?.success && alertRes.data) {
        setAlertsSummary({
          total: alertRes.data.totalAlerts || 0,
          overdue: alertRes.data.summaryByWindow?.OVERDUE || 0,
          next7Days: alertRes.data.summaryByWindow?.NEXT_7_DAYS || 0,
          next30Days: alertRes.data.summaryByWindow?.NEXT_30_DAYS || 0,
          next60_90Days: alertRes.data.summaryByWindow?.NEXT_60_90_DAYS || 0,
        });
      }

      if (invRes?.success && Array.isArray(invRes.data)) {
        const lowItems = invRes.data.filter(
          (item: InventoryItem) => item.quantity_on_hand <= (item.minimum_stock_level || 0)
        );
        setLowStockCount(lowItems.length);
      }

      if (resRes?.success && Array.isArray(resRes.data)) {
        const activeRes = resRes.data.filter(
          (r: AssetReservation) => r.status === 'Active'
        );
        setActiveReservationsCount(activeRes.length);
      }

      if (leaseRes?.success && Array.isArray(leaseRes.data)) {
        const activeL = leaseRes.data.filter((l: AssetLease) => l.status === 'Active');
        setActiveLeasesCount(activeL.length);
      }

      if (maintRes?.success && Array.isArray(maintRes.data)) {
        setMaintenanceRecords(maintRes.data);
      }

      if (settingsRes?.success && settingsRes.data?.default_currency) {
        setTenantCurrency(settingsRes.data.default_currency);
      }

      // Compute Real Assets by Site
      if (sitesRes?.success && Array.isArray(sitesRes.data)) {
        const sites: Site[] = sitesRes.data;
        const assets: Asset[] = assetsRes?.success && Array.isArray(assetsRes.data) ? assetsRes.data : [];

        const siteCounts: Record<string, number> = {};
        sites.forEach((s) => (siteCounts[s.name] = 0));

        assets.forEach((a) => {
          if (a.site_id) {
            const siteMatch = sites.find((s) => s.id === a.site_id);
            if (siteMatch) {
              siteCounts[siteMatch.name] = (siteCounts[siteMatch.name] || 0) + 1;
            }
          }
        });

        const calculated = Object.entries(siteCounts).map(([siteName, count]) => ({
          siteName,
          count,
        }));
        setSiteData(calculated);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const formatCurrency = (val: number) => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: tenantCurrency || 'USD',
        maximumFractionDigits: 0,
      }).format(val);
    } catch {
      return `$${val.toLocaleString()}`;
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
      if (diff < 60) return 'Just now';
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Status breakdown numbers
  const availableCount = metrics?.statusBreakdown?.['Available'] || 0;
  const assignedCount = metrics?.statusBreakdown?.['Assigned'] || 0;
  const underRepairCount = metrics?.statusBreakdown?.['Under Repair'] || 0;
  const totalAssets = metrics?.totalAssets || 0;
  const totalValue = metrics?.totalValue || 0;
  const maintenanceSpend = metrics?.maintenanceMetrics?.totalCost || 0;
  const openWorkOrders = metrics?.maintenanceMetrics?.openCount || 0;
  const overdueMaintenance = metrics?.maintenanceMetrics?.overdueCount || alertsSummary.overdue;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 select-text text-neutral-900">
      {/* ==================================================================== */}
      {/* 1. HERO / WELCOME AREA                                               */}
      {/* ==================================================================== */}
      <div className="bg-white border border-neutral-200/80 rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#FF6A1A] uppercase tracking-wider">
              {getGreeting()}
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-neutral-900 mt-0.5">
            {companyName || 'AssetMT Workspace'}
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Here&apos;s what&apos;s happening across your asset operations.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={fetchDashboardData}
            disabled={loading}
            className="px-3 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-medium rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Refresh metrics from database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#FF6A1A]' : 'text-neutral-500'}`} />
            <span>Refresh</span>
          </button>

          {canAddAsset && (
            <button
              type="button"
              onClick={() => onNavigate('asset-add')}
              className="px-4 py-2 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Asset</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Failed to load live metrics</span>
            {error}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. PRIMARY KPI ROW (5 CARDS)                                         */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Assets */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-xs hover:border-neutral-300 transition-all">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-semibold text-neutral-600">Total Assets</span>
            <div className="w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-600">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-neutral-900 tracking-tight">
            {loading ? '—' : totalAssets.toLocaleString()}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
            <span>Tracked across workspace</span>
          </div>
        </div>

        {/* Card 2: Available */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-xs hover:border-neutral-300 transition-all">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-semibold text-neutral-600">Available</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-neutral-900 tracking-tight">
            {loading ? '—' : availableCount.toLocaleString()}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#27C499]" />
            <span>Ready for deployment</span>
          </div>
        </div>

        {/* Card 3: Assigned */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-xs hover:border-neutral-300 transition-all">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-semibold text-neutral-600">Assigned</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-[#315CFF]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-neutral-900 tracking-tight">
            {loading ? '—' : assignedCount.toLocaleString()}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-blue-700 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#315CFF]" />
            <span>In active employee custody</span>
          </div>
        </div>

        {/* Card 4: Under Maintenance */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-xs hover:border-neutral-300 transition-all">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-semibold text-neutral-600">Under Maintenance</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-neutral-900 tracking-tight">
            {loading ? '—' : underRepairCount.toLocaleString()}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-amber-700 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
            <span>Active service & work orders</span>
          </div>
        </div>

        {/* Card 5: Total Asset Value */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-xs hover:border-neutral-300 transition-all">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-semibold text-neutral-600">Asset Value</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-[#27C499]">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-neutral-900 tracking-tight truncate">
            {loading ? '—' : formatCurrency(totalValue)}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
            <span>Combined acquisition cost</span>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 3. SECONDARY OPERATIONAL KPI ROW (6 CARDS)                           */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Open Maintenance */}
        <div
          onClick={() => onNavigate('maintenance')}
          className="bg-white border border-neutral-200/80 rounded-xl p-3.5 shadow-xs hover:border-sky-300 hover:bg-sky-50/30 transition-all cursor-pointer group"
        >
          <div className="text-[11px] font-semibold text-neutral-500 group-hover:text-sky-700">Open Work Orders</div>
          <div className="text-xl font-bold font-mono text-neutral-900 mt-1 tabular-nums">
            {loading ? '—' : openWorkOrders}
          </div>
          <div className="text-[10px] text-neutral-400 mt-0.5">In maintenance queue</div>
        </div>

        {/* Overdue Maintenance */}
        <div
          onClick={() => onNavigate('maintenance')}
          className={`border rounded-xl p-3.5 shadow-xs transition-all cursor-pointer group ${
            overdueMaintenance > 0
              ? 'bg-red-50/60 border-red-200 hover:border-red-300'
              : 'bg-white border-neutral-200/80 hover:border-neutral-300'
          }`}
        >
          <div className={`text-[11px] font-semibold ${overdueMaintenance > 0 ? 'text-red-700' : 'text-neutral-500'}`}>
            Overdue Maintenance
          </div>
          <div className={`text-xl font-bold font-mono mt-1 tabular-nums ${overdueMaintenance > 0 ? 'text-red-700' : 'text-neutral-900'}`}>
            {loading ? '—' : overdueMaintenance}
          </div>
          <div className="text-[10px] text-neutral-400 mt-0.5">Exceeded target SLA</div>
        </div>

        {/* Low Stock */}
        <div
          onClick={() => onNavigate('inventory')}
          className={`border rounded-xl p-3.5 shadow-xs transition-all cursor-pointer group ${
            lowStockCount > 0
              ? 'bg-amber-50/60 border-amber-200 hover:border-amber-300'
              : 'bg-white border-neutral-200/80 hover:border-neutral-300'
          }`}
        >
          <div className={`text-[11px] font-semibold ${lowStockCount > 0 ? 'text-amber-700' : 'text-neutral-500'}`}>
            Low Stock Parts
          </div>
          <div className={`text-xl font-bold font-mono mt-1 tabular-nums ${lowStockCount > 0 ? 'text-amber-700' : 'text-neutral-900'}`}>
            {loading ? '—' : lowStockCount}
          </div>
          <div className="text-[10px] text-neutral-400 mt-0.5">&le; minimum threshold</div>
        </div>

        {/* Expiring Soon */}
        <div
          onClick={() => onNavigate('alerts')}
          className="bg-white border border-neutral-200/80 rounded-xl p-3.5 shadow-xs hover:border-amber-300 hover:bg-amber-50/30 transition-all cursor-pointer group"
        >
          <div className="text-[11px] font-semibold text-neutral-500 group-hover:text-amber-700">Expiring Soon</div>
          <div className="text-xl font-bold font-mono text-neutral-900 mt-1 tabular-nums">
            {loading ? '—' : alertsSummary.next30Days + alertsSummary.next7Days}
          </div>
          <div className="text-[10px] text-neutral-400 mt-0.5">Warranties & contracts &le; 30d</div>
        </div>

        {/* Active Reservations */}
        <div
          onClick={() => onNavigate('assets')}
          className="bg-white border border-neutral-200/80 rounded-xl p-3.5 shadow-xs hover:border-indigo-300 hover:bg-indigo-50/30 transition-all cursor-pointer group"
        >
          <div className="text-[11px] font-semibold text-neutral-500 group-hover:text-indigo-700">Reservations</div>
          <div className="text-xl font-bold font-mono text-neutral-900 mt-1 tabular-nums">
            {loading ? '—' : activeReservationsCount}
          </div>
          <div className="text-[10px] text-neutral-400 mt-0.5">Active asset holds</div>
        </div>

        {/* Active Leases */}
        <div
          onClick={() => onNavigate('assets')}
          className="bg-white border border-neutral-200/80 rounded-xl p-3.5 shadow-xs hover:border-emerald-300 hover:bg-emerald-50/30 transition-all cursor-pointer group"
        >
          <div className="text-[11px] font-semibold text-neutral-500 group-hover:text-emerald-700">Active Leases</div>
          <div className="text-xl font-bold font-mono text-neutral-900 mt-1 tabular-nums">
            {loading ? '—' : activeLeasesCount}
          </div>
          <div className="text-[10px] text-neutral-400 mt-0.5">Vendor leasing contracts</div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 4. CHARTS ROW 1: STATUS DISTRIBUTION & ASSETS BY CATEGORY            */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Asset Distribution Donut */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-neutral-900">Asset Distribution</h2>
              <p className="text-xs text-neutral-500">Assets by current operational status</p>
            </div>
            <button
              onClick={() => onNavigate('assets')}
              className="text-xs text-[#FF6A1A] hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Asset Registry</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <AssetStatusDonutChart
            statusBreakdown={metrics?.statusBreakdown || {}}
            totalAssets={totalAssets}
          />
        </div>

        {/* Chart 2: Assets by Category Horizontal Bars */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-neutral-900">Assets by Category</h2>
              <p className="text-xs text-neutral-500">Asset count and valuation per category</p>
            </div>
            <button
              onClick={() => onNavigate('assets')}
              className="text-xs text-[#FF6A1A] hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <CategoryHorizontalBarChart
            categories={metrics?.categoryBreakdown || []}
            formatCurrency={formatCurrency}
          />
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 5. CHARTS ROW 2: ASSETS BY SITE & MAINTENANCE ACTIVITY               */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 3: Assets by Site */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-sm font-bold text-neutral-900">Assets by Site</h2>
              <p className="text-xs text-neutral-500">Distribution across physical branches & offices</p>
            </div>
            <button
              onClick={() => onNavigate('org-management')}
              className="text-xs text-[#FF6A1A] hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Manage Sites</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <SiteDistributionBarChart siteData={siteData} />
        </div>

        {/* Chart 4: Maintenance Activity */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-neutral-900">Maintenance Activity</h2>
              <p className="text-xs text-neutral-500">Current work orders and service distribution</p>
            </div>
            <button
              onClick={() => onNavigate('maintenance')}
              className="text-xs text-[#FF6A1A] hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Work Orders</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <MaintenanceActivityChart
            maintenanceMetrics={metrics?.maintenanceMetrics}
            hasHistory={maintenanceRecords.length > 0 || (metrics?.maintenanceMetrics?.totalCost || 0) > 0}
          />
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 6. OPERATIONAL HEALTH & FINANCIAL OVERVIEW                           */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Operational Health Card */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-neutral-900">Operational Health</h2>
              <p className="text-xs text-neutral-500">Action items requiring immediate supervision</p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Real-time Telemetry</span>
            </div>
          </div>

          <div className="space-y-2.5">
            {/* Row 1: Overdue Maintenance */}
            <div
              onClick={() => onNavigate('maintenance')}
              className="flex items-center justify-between p-3 rounded-lg border border-neutral-100 bg-neutral-50/50 hover:bg-neutral-100/60 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${overdueMaintenance > 0 ? 'bg-red-500' : 'bg-emerald-500'}`} />
                <span className="text-xs font-medium text-neutral-800">Maintenance Overdue</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-mono text-xs font-bold ${overdueMaintenance > 0 ? 'text-red-700' : 'text-neutral-600'}`}>
                  {overdueMaintenance}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-700 transition-colors" />
              </div>
            </div>

            {/* Row 2: Low Inventory */}
            <div
              onClick={() => onNavigate('inventory')}
              className="flex items-center justify-between p-3 rounded-lg border border-neutral-100 bg-neutral-50/50 hover:bg-neutral-100/60 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${lowStockCount > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                <span className="text-xs font-medium text-neutral-800">Low Stock Inventory Items</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-mono text-xs font-bold ${lowStockCount > 0 ? 'text-amber-700' : 'text-neutral-600'}`}>
                  {lowStockCount}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-700 transition-colors" />
              </div>
            </div>

            {/* Row 3: Compliance Expiring */}
            <div
              onClick={() => onNavigate('alerts')}
              className="flex items-center justify-between p-3 rounded-lg border border-neutral-100 bg-neutral-50/50 hover:bg-neutral-100/60 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${alertsSummary.next30Days > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                <span className="text-xs font-medium text-neutral-800">Compliance Expiring (&le; 30 Days)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-mono text-xs font-bold ${alertsSummary.next30Days > 0 ? 'text-amber-700' : 'text-neutral-600'}`}>
                  {alertsSummary.next30Days}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-700 transition-colors" />
              </div>
            </div>

            {/* Row 4: Open Work Orders */}
            <div
              onClick={() => onNavigate('maintenance')}
              className="flex items-center justify-between p-3 rounded-lg border border-neutral-100 bg-neutral-50/50 hover:bg-neutral-100/60 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-xs font-medium text-neutral-800">Active Work Orders In Queue</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-neutral-800">
                  {openWorkOrders}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-700 transition-colors" />
              </div>
            </div>
          </div>
        </div>

        {/* Financial Visual Overview */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-neutral-900">Asset Value Overview</h2>
              <p className="text-xs text-neutral-500">Financial allocation and maintenance ratio</p>
            </div>
            <button
              onClick={() => onNavigate('reports')}
              className="text-xs text-[#FF6A1A] hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Financial Reports</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <AssetFinancialOverview
            totalAssetValue={totalValue}
            maintenanceSpend={maintenanceSpend}
            formatCurrency={formatCurrency}
          />
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 7. RECENT ACTIVITY & ATTENTION / ALERT PANEL                         */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Needs Attention (1 Col) */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                <BellRing className="w-4 h-4 text-[#FF6A1A]" />
                <span>Needs Attention</span>
              </h2>
              <p className="text-xs text-neutral-500">Items requiring review</p>
            </div>
            <button
              onClick={() => onNavigate('alerts')}
              className="text-xs text-[#FF6A1A] hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <span>View all ({alertsSummary.total})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {alertsSummary.total === 0 && overdueMaintenance === 0 && lowStockCount === 0 ? (
            <div className="py-12 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="text-xs font-semibold text-neutral-800">All Systems Nominal</p>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                No overdue jobs, expiring contracts, or depleted stock.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {overdueMaintenance > 0 && (
                <div
                  onClick={() => onNavigate('maintenance')}
                  className="p-3 bg-red-50/70 border border-red-200 rounded-lg cursor-pointer hover:bg-red-50 transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-red-800">
                    <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
                    <span>{overdueMaintenance} maintenance job{overdueMaintenance > 1 ? 's' : ''} overdue</span>
                  </div>
                  <p className="text-[11px] text-red-600 mt-1 pl-4">
                    Requires immediate technician intervention.
                  </p>
                </div>
              )}

              {alertsSummary.next7Days > 0 && (
                <div
                  onClick={() => onNavigate('alerts')}
                  className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg cursor-pointer hover:bg-amber-50 transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                    <span className="w-2 h-2 rounded-full bg-amber-600 shrink-0" />
                    <span>{alertsSummary.next7Days} item{alertsSummary.next7Days > 1 ? 's' : ''} expire within 7 days</span>
                  </div>
                  <p className="text-[11px] text-amber-600 mt-1 pl-4">
                    Warranty or contract expiry deadline approaching.
                  </p>
                </div>
              )}

              {lowStockCount > 0 && (
                <div
                  onClick={() => onNavigate('inventory')}
                  className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg cursor-pointer hover:bg-neutral-100/60 transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-neutral-800">
                    <span className="w-2 h-2 rounded-full bg-neutral-600 shrink-0" />
                    <span>{lowStockCount} inventory item{lowStockCount > 1 ? 's' : ''} below threshold</span>
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-1 pl-4">
                    Reorder stock to avoid replenishment delays.
                  </p>
                </div>
              )}

              {alertsSummary.next30Days > 0 && (
                <div
                  onClick={() => onNavigate('alerts')}
                  className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg cursor-pointer hover:bg-neutral-100/60 transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-neutral-700">
                    <span className="w-2 h-2 rounded-full bg-neutral-400 shrink-0" />
                    <span>{alertsSummary.next30Days} item{alertsSummary.next30Days > 1 ? 's' : ''} expiring in 30 days</span>
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-1 pl-4">
                    Review renewal agreements and software licenses.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Recent Activity Timeline (2 Cols) */}
        <div className="lg:col-span-2 bg-white border border-neutral-200/80 rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-neutral-500" />
                <span>Recent Activity</span>
              </h2>
              <p className="text-xs text-neutral-500">Live server-side audit events</p>
            </div>
            <button
              onClick={() => onNavigate('audit-log')}
              className="text-xs text-[#FF6A1A] hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Full Audit Log</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-neutral-400 font-mono">
              Loading activity timeline...
            </div>
          ) : !metrics?.recentEvents || metrics.recentEvents.length === 0 ? (
            <div className="py-12 text-center">
              <Clock className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-neutral-800">No Recent Activity</p>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Asset creation, checkouts, and maintenance transitions will stream here.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-neutral-200">
              {metrics.recentEvents.slice(0, 7).map((ev) => {
                const getEventBadge = () => {
                  switch (ev.event_type) {
                    case 'CREATED':
                      return { text: 'Created', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
                    case 'CHECKED_OUT':
                      return { text: 'Checked Out', color: 'bg-blue-50 text-blue-700 border-blue-200' };
                    case 'CHECKED_IN':
                      return { text: 'Checked In', color: 'bg-purple-50 text-purple-700 border-purple-200' };
                    case 'TRANSFERRED':
                      return { text: 'Transferred', color: 'bg-amber-50 text-amber-700 border-amber-200' };
                    case 'MAINTENANCE_CREATED':
                    case 'MAINTENANCE_SCHEDULED':
                    case 'MAINTENANCE_STARTED':
                      return { text: 'Maintenance', color: 'bg-sky-50 text-sky-700 border-sky-200' };
                    case 'MAINTENANCE_COMPLETED':
                      return { text: 'Serviced', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
                    default:
                      return { text: ev.event_type.replace(/_/g, ' '), color: 'bg-neutral-50 text-neutral-700 border-neutral-200' };
                  }
                };

                const badge = getEventBadge();

                return (
                  <div
                    key={ev.id}
                    onClick={() => ev.asset_id && onNavigate('asset-detail', ev.asset_id)}
                    className="relative group cursor-pointer"
                  >
                    {/* Node Dot on Timeline */}
                    <div className="absolute -left-6 top-1 w-2 h-2 rounded-full bg-neutral-400 group-hover:bg-[#FF6A1A] transition-colors border-2 border-white shadow-xs" />

                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${badge.color}`}>
                          {badge.text}
                        </span>
                        <span className="font-semibold text-neutral-900 group-hover:text-[#FF6A1A] transition-colors truncate max-w-xs">
                          {ev.asset_name || 'Asset Record'}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-neutral-400 shrink-0">
                        {formatRelativeTime(ev.created_at)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-neutral-500 pl-0.5">
                      {ev.asset_tag && (
                        <span className="font-mono text-neutral-600 font-medium">
                          {ev.asset_tag}
                        </span>
                      )}
                      {(ev.details?.notes as string) && (
                        <>
                          <span className="text-neutral-300">·</span>
                          <span className="truncate">{ev.details.notes as string}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
