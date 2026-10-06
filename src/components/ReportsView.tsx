/**
 * AssetMT - Enterprise Reporting Center
 * Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
 * Parity with AssetTiger reporting & real multi-category server analytics
 */

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Printer,
  Filter,
  RefreshCw,
  Search,
  Calendar,
  Layers,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Building,
  UserCheck,
  Shield,
  Clock,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import {
  ReportCategory,
  ReportType,
  ReportResult,
  ReportFilterOptions,
  Category,
  Department,
  Site,
  Employee,
  Vendor,
} from '../../shared/types.ts';

interface ReportsViewProps {
  token: string;
  onNavigateToAsset?: (assetId: string) => void;
}

interface ReportDefinition {
  type: ReportType;
  category: ReportCategory;
  name: string;
  description: string;
}

const REPORT_DEFINITIONS: ReportDefinition[] = [
  // ASSET
  { type: 'ASSET_REGISTER', category: 'ASSET', name: 'Master Asset Register', description: 'Comprehensive register of all non-disposed tenant assets' },
  { type: 'ASSETS_BY_STATUS', category: 'ASSET', name: 'Assets by Status', description: 'Grouped breakdown of assets across operational statuses' },
  { type: 'ASSETS_BY_CATEGORY', category: 'ASSET', name: 'Assets by Category', description: 'Distribution and count of assets across registered categories' },
  { type: 'ASSETS_BY_LOCATION', category: 'ASSET', name: 'Assets by Site & Location', description: 'Geographical asset placement across sites and rooms' },
  { type: 'ASSETS_BY_CUSTODIAN', category: 'ASSET', name: 'Assets by Custodian', description: 'Assets currently assigned to active employees' },
  { type: 'ASSETS_BY_DEPARTMENT', category: 'ASSET', name: 'Assets by Department', description: 'Departmental asset allocation and cost attribution' },
  { type: 'DISPOSED_ASSETS', category: 'ASSET', name: 'Disposed Assets Ledger', description: 'Archived records of scrapped, sold, and donated assets' },
  { type: 'ASSET_MOVEMENT_HISTORY', category: 'ASSET', name: 'Asset Movement History', description: 'Audit trail of site and room re-locations' },

  // CUSTODY
  { type: 'CURRENT_ASSIGNMENTS', category: 'CUSTODY', name: 'Current Active Custody', description: 'Active asset checkouts with custodians and due dates' },
  { type: 'CHECKOUT_HISTORY', category: 'CUSTODY', name: 'Historical Checkouts', description: 'Chronological checkout events across all employees' },
  { type: 'CHECKIN_HISTORY', category: 'CUSTODY', name: 'Historical Check-ins', description: 'Returns log with condition notes and return dates' },
  { type: 'TRANSFER_HISTORY', category: 'CUSTODY', name: 'Custodian Transfers', description: 'Direct employee-to-employee asset custody handovers' },

  // MAINTENANCE
  { type: 'OPEN_WORK_ORDERS', category: 'MAINTENANCE', name: 'Open & Scheduled Work Orders', description: 'Active service requests requiring technician resolution' },
  { type: 'COMPLETED_MAINTENANCE', category: 'MAINTENANCE', name: 'Completed Maintenance Log', description: 'Historic repair records with service notes and resolution times' },
  { type: 'OVERDUE_MAINTENANCE', category: 'MAINTENANCE', name: 'Overdue Work Orders', description: 'Past-due work orders requiring urgent intervention' },
  { type: 'MAINTENANCE_COST', category: 'MAINTENANCE', name: 'Maintenance Cost Analysis', description: 'Service expenses by vendor, asset, and work order' },

  // FINANCIAL
  { type: 'PURCHASE_VALUE', category: 'FINANCIAL', name: 'Capital Asset Purchases', description: 'Acquisition cost and funding source breakdown' },
  { type: 'DEPRECIATION_SUMMARY', category: 'FINANCIAL', name: 'Depreciation & Book Value', description: 'Asset book values, accumulated depreciation, and salvage floors' },
  { type: 'ACTIVE_CONTRACTS', category: 'FINANCIAL', name: 'Active Vendor Contracts', description: 'Lease and maintenance service agreement values' },
  { type: 'INSURANCE_COVERAGE', category: 'FINANCIAL', name: 'Insurance Valuation & Premiums', description: 'Policy coverage limits, insured values, and annual premiums' },
  { type: 'SOFTWARE_LICENSES', category: 'FINANCIAL', name: 'Software License Allocations', description: 'Purchased vs utilized seats and per-seat license costs' },

  // INVENTORY
  { type: 'STOCK_LEVELS', category: 'INVENTORY', name: 'Current Stock Balance', description: 'On-hand quantities of consumable parts and materials' },
  { type: 'LOW_STOCK', category: 'INVENTORY', name: 'Low Stock Alerts', description: 'Parts at or below minimum threshold requiring re-order' },
  { type: 'STOCK_TRANSACTIONS', category: 'INVENTORY', name: 'Stock Movement Ledger', description: 'Receipts, consumptions, and adjustment history' },
  { type: 'INVENTORY_VALUATION', category: 'INVENTORY', name: 'Inventory Asset Valuation', description: 'Total capital value tied up in stored inventory' },

  // AUDIT
  { type: 'AUDIT_RESULTS', category: 'AUDIT', name: 'Physical Audit Results', description: 'Verification pass rates and scanned asset status' },
  { type: 'MISSING_ASSETS', category: 'AUDIT', name: 'Missing / Unscanned Assets', description: 'Assets unaccounted for during periodic physical audits' },
  { type: 'WRONG_LOCATION', category: 'AUDIT', name: 'Displaced / Misplaced Assets', description: 'Assets scanned in rooms differing from system records' },

  // COMPLIANCE
  { type: 'EXPIRING_CONTRACTS', category: 'COMPLIANCE', name: 'Expiring Contracts (90 Days)', description: 'Agreements expiring soon requiring negotiation or renewal' },
  { type: 'EXPIRING_WARRANTIES', category: 'COMPLIANCE', name: 'Expiring Warranties (90 Days)', description: 'Hardware warranty deadlines approaching end-of-coverage' },
  { type: 'EXPIRING_INSURANCE', category: 'COMPLIANCE', name: 'Expiring Insurance Policies', description: 'Underwritten coverage approaching lapse date' },
  { type: 'LICENSE_RENEWALS', category: 'COMPLIANCE', name: 'Software License Renewals', description: 'Subscription license terms up for renewal' },
  { type: 'EXPIRING_LEASES', category: 'COMPLIANCE', name: 'Expiring Equipment Leases', description: 'Leased items due for return or buyout negotiation' },
];

export const ReportsView: React.FC<ReportsViewProps> = ({ token, onNavigateToAsset }) => {
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>('ASSET');
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('ASSET_REGISTER');

  // Filter state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [siteId, setSiteId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Dropdown reference data
  const [sites, setSites] = useState<Site[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  // Report execution state
  const [reportResult, setReportResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isPrintMode, setIsPrintMode] = useState<boolean>(false);

  // Load dropdown references
  useEffect(() => {
    async function loadRefs() {
      try {
        const [siteRes, catRes, deptRes, empRes, venRes] = await Promise.all([
          api.getSites(token),
          api.getCategories(token),
          api.getDepartments(token),
          api.getEmployees(token),
          api.getVendors(token),
        ]);
        if (siteRes.success) setSites(siteRes.data);
        if (catRes.success) setCategories(catRes.data);
        if (deptRes.success) setDepartments(deptRes.data);
        if (empRes.success) setEmployees(empRes.data);
        if (venRes.success) setVendors(venRes.data);
      } catch (err: any) {
        console.error('Failed to load filter metadata:', err);
      }
    }
    loadRefs();
  }, [token]);

  // Execute report
  const runReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: ReportFilterOptions = {
        report_type: selectedReportType,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        site_id: siteId || undefined,
        category_id: categoryId || undefined,
        department_id: departmentId || undefined,
        employee_id: employeeId || undefined,
        vendor_id: vendorId || undefined,
        status: statusFilter || undefined,
      };

      const res = await api.getReport(token, filters);
      if (res.success) {
        setReportResult(res.data);
      } else {
        setError(res.error || 'Failed to generate report');
      }
    } catch (err: any) {
      setError(err.message || 'Error executing server report query');
    } finally {
      setLoading(false);
    }
  };

  // Run initial or report change
  useEffect(() => {
    runReport();
  }, [selectedReportType]);

  // CSV Export with Formula Injection Defense
  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const filters: ReportFilterOptions = {
        report_type: selectedReportType,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        site_id: siteId || undefined,
        category_id: categoryId || undefined,
        department_id: departmentId || undefined,
        employee_id: employeeId || undefined,
        vendor_id: vendorId || undefined,
        status: statusFilter || undefined,
      };

      const csvData = await api.downloadReportCsv(token, filters);
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `AssetMT_${selectedReportType.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const currentDef = REPORT_DEFINITIONS.find((r) => r.type === selectedReportType);
  const reportsInActiveCategory = REPORT_DEFINITIONS.filter((r) => r.category === selectedCategory);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 print:p-0 print:m-0 print:max-w-none">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-200 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#FF6A1A] tracking-wider uppercase mb-1">
            <BarChart3 className="w-4 h-4" />
            <span>Operational Intelligence</span>
          </div>
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
            Tenant Reporting Center
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Audit-grade operational analytics, asset registers, compliance horizons, and financial ledgers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={exporting || loading || !reportResult}
            className="px-3.5 py-2 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold rounded shadow-xs inline-flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
            title="Download CSV sanitized against spreadsheet formula injection"
          >
            <Download className="w-3.5 h-3.5 text-neutral-500" />
            <span>{exporting ? 'Generating CSV...' : 'Export CSV'}</span>
          </button>

          <button
            onClick={handlePrint}
            disabled={!reportResult}
            className="px-3.5 py-2 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded shadow-xs inline-flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print View</span>
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="bg-white rounded-lg border border-neutral-200 p-1.5 shadow-xs flex flex-wrap gap-1 print:hidden">
        {(['ASSET', 'CUSTODY', 'MAINTENANCE', 'FINANCIAL', 'INVENTORY', 'AUDIT', 'COMPLIANCE'] as ReportCategory[]).map(
          (cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  const firstInCat = REPORT_DEFINITIONS.find((r) => r.category === cat);
                  if (firstInCat) setSelectedReportType(firstInCat.type);
                }}
                className={`px-3.5 py-2 rounded text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#FF6A1A] text-white shadow-xs'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
              >
                {cat}
              </button>
            );
          }
        )}
      </div>

      {/* Report Selection Sub-bar & Description */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex-1">
          <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
            Select {selectedCategory} Report
          </label>
          <div className="flex flex-wrap gap-2">
            {reportsInActiveCategory.map((rep) => (
              <button
                key={rep.type}
                onClick={() => setSelectedReportType(rep.type)}
                className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors cursor-pointer ${
                  selectedReportType === rep.type
                    ? 'bg-orange-50 border-[#FF6A1A] text-[#FF6A1A] font-semibold'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                {rep.name}
              </button>
            ))}
          </div>
          {currentDef && (
            <p className="text-xs text-neutral-500 mt-2 italic">
              {currentDef.description}
            </p>
          )}
        </div>
      </div>

      {/* Filter Toolbar (Server-side) */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4 shadow-xs print:hidden space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
            <Filter className="w-3.5 h-3.5 text-[#FF6A1A]" />
            <span>Server-Side Report Filters</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setSiteId('');
                setCategoryId('');
                setDepartmentId('');
                setEmployeeId('');
                setVendorId('');
                setStatusFilter('');
                setTimeout(runReport, 50);
              }}
              className="text-[11px] text-neutral-500 hover:text-neutral-800 underline cursor-pointer"
            >
              Reset Filters
            </button>
            <button
              onClick={runReport}
              disabled={loading}
              className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium rounded inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              <span>Apply Filters</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2.5 text-xs">
          {/* Start Date */}
          <div>
            <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-2 py-1.5 border border-neutral-300 rounded text-xs focus:outline-none focus:border-[#FF6A1A]"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-2 py-1.5 border border-neutral-300 rounded text-xs focus:outline-none focus:border-[#FF6A1A]"
            />
          </div>

          {/* Site */}
          <div>
            <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Site</label>
            <select
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className="w-full px-2 py-1.5 border border-neutral-300 rounded text-xs focus:outline-none focus:border-[#FF6A1A] bg-white"
            >
              <option value="">All Sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-2 py-1.5 border border-neutral-300 rounded text-xs focus:outline-none focus:border-[#FF6A1A] bg-white"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Department */}
          <div>
            <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Department</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full px-2 py-1.5 border border-neutral-300 rounded text-xs focus:outline-none focus:border-[#FF6A1A] bg-white"
            >
              <option value="">All Depts</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Employee */}
          <div>
            <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Employee</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full px-2 py-1.5 border border-neutral-300 rounded text-xs focus:outline-none focus:border-[#FF6A1A] bg-white"
            >
              <option value="">All Personnel</option>
              {employees.map((em) => (
                <option key={em.id} value={em.id}>{em.full_name}</option>
              ))}
            </select>
          </div>

          {/* Vendor */}
          <div>
            <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Vendor</label>
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="w-full px-2 py-1.5 border border-neutral-300 rounded text-xs focus:outline-none focus:border-[#FF6A1A] bg-white"
            >
              <option value="">All Vendors</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2 py-1.5 border border-neutral-300 rounded text-xs focus:outline-none focus:border-[#FF6A1A] bg-white"
            >
              <option value="">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Checked Out">Checked Out</option>
              <option value="In Maintenance">In Maintenance</option>
              <option value="Disposed">Disposed</option>
              <option value="Reserved">Reserved</option>
              <option value="Leased">Leased</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Printable Report Header */}
      {reportResult && (
        <div className="hidden print:block mb-6 border-b border-neutral-400 pb-3">
          <div className="text-xl font-bold text-neutral-900">AssetMT — {reportResult.title}</div>
          <div className="text-xs text-neutral-600 mt-1">
            Generated: {new Date(reportResult.generated_at).toLocaleString()} | Records: {reportResult.total_records}
          </div>
        </div>
      )}

      {/* Top Metrics Cards */}
      {reportResult && reportResult.metrics && reportResult.metrics.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {reportResult.metrics.map((m, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-lg border bg-white shadow-xs ${
                m.highlight ? 'border-[#FF6A1A] bg-orange-50/30' : 'border-neutral-200'
              }`}
            >
              <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                {m.label}
              </div>
              <div
                className={`text-xl font-extrabold mt-1 tracking-tight ${
                  m.highlight ? 'text-[#FF6A1A]' : 'text-neutral-900'
                }`}
              >
                {m.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Report Table */}
      <div className="bg-white rounded-lg border border-neutral-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/50 print:bg-white">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-900">
              {reportResult?.title || currentDef?.name}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-200 text-neutral-700 font-mono">
              {reportResult?.total_records || 0} records
            </span>
          </div>
          <div className="text-[11px] text-neutral-400">
            {reportResult?.generated_at ? `As of ${new Date(reportResult.generated_at).toLocaleTimeString()}` : ''}
          </div>
        </div>

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2">
            <div className="w-7 h-7 border-2 border-neutral-300 border-t-[#FF6A1A] rounded-full animate-spin"></div>
            <span className="text-xs font-medium text-neutral-500">Querying authoritative tenant records...</span>
          </div>
        ) : !reportResult || reportResult.rows.length === 0 ? (
          <div className="py-16 text-center text-xs text-neutral-500">
            No records matched the selected report filters and tenant boundaries.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-semibold text-neutral-600">
                  {reportResult.columns.map((col) => (
                    <th key={col.key} className="py-2.5 px-4">
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {reportResult.rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-neutral-50/80 transition-colors">
                    {reportResult.columns.map((col) => {
                      const val = row[col.key];

                      let content: React.ReactNode = val !== undefined && val !== null ? String(val) : '—';

                      if (col.type === 'currency' && typeof val === 'number') {
                        content = `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                      } else if (col.type === 'date' && val) {
                        content = new Date(val).toLocaleDateString();
                      } else if (col.type === 'badge') {
                        const s = String(val);
                        let badgeClass = 'bg-neutral-100 text-neutral-700';
                        if (['Available', 'Completed', 'Active'].includes(s)) {
                          badgeClass = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
                        } else if (['Checked Out', 'In Progress', 'Scheduled'].includes(s)) {
                          badgeClass = 'bg-blue-50 text-blue-700 border border-blue-200';
                        } else if (['In Maintenance', 'Low Stock', 'Overdue'].includes(s)) {
                          badgeClass = 'bg-amber-50 text-amber-700 border border-amber-200';
                        } else if (['Disposed', 'Missing', 'Expired', 'Cancelled'].includes(s)) {
                          badgeClass = 'bg-red-50 text-red-700 border border-red-200';
                        }
                        content = (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${badgeClass}`}>
                            {s}
                          </span>
                        );
                      }

                      // Clickable asset tag / name
                      if (col.key === 'asset_tag' && row.asset_id && onNavigateToAsset) {
                        return (
                          <td key={col.key} className="py-2.5 px-4 font-mono font-medium">
                            <button
                              onClick={() => onNavigateToAsset(row.asset_id)}
                              className="text-[#FF6A1A] hover:underline cursor-pointer"
                            >
                              {String(val)}
                            </button>
                          </td>
                        );
                      }

                      return (
                        <td key={col.key} className="py-2.5 px-4 text-neutral-800">
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CSV Formula Injection Protection Notice */}
      <div className="p-3 bg-neutral-100/80 rounded border border-neutral-200 text-[11px] text-neutral-500 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-neutral-400" />
          <span>
            CSV Export complies with RFC 4180 and automatically defends against spreadsheet formula injection (=, +, -, @).
          </span>
        </div>
        <span className="font-mono text-[10px] text-neutral-400">Tenant-Authoritative RLS</span>
      </div>
    </div>
  );
};
