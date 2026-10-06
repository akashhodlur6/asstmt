/**
 * AssetMT - List of Assets
 * High-density enterprise asset table with search, filters, sorting & pagination.
 */

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import { Asset, Category, Location, Site } from '../../shared/types.ts';

const BarcodeLabelModal = React.lazy(() => import('./BarcodeLabelModal.tsx').then((m) => ({ default: m.BarcodeLabelModal })));
import {
  Search,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  FileSpreadsheet,
  QrCode,
} from 'lucide-react';

interface AssetListViewProps {
  onNavigate: (view: string, assetId?: string) => void;
}

export const AssetListView: React.FC<AssetListViewProps> = ({ onNavigate }) => {
  const { token, role, companyName } = useAuth();
  const isTenantAdmin = role === 'TENANT_ADMIN';

  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSite, setSelectedSite] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Sorting & Pagination
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load filter lookup options
  useEffect(() => {
    if (!token) return;
    api.getCategories(token).then((res) => res.success && setCategories(res.data)).catch(() => {});
    api.getSites(token).then((res) => res.success && setSites(res.data)).catch(() => {});
    api.getLocations(token).then((res) => res.success && setLocations(res.data)).catch(() => {});
  }, [token]);

  // Fetch Assets
  const fetchAssets = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.getAssets(token, {
        search: search.trim() || undefined,
        category_id: selectedCategory || undefined,
        site_id: selectedSite || undefined,
        location_id: selectedLocation || undefined,
        status: selectedStatus || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page,
        limit,
      });

      if (res.success) {
        setAssets(res.data);
        setTotalCount(res.pagination.totalCount);
        setTotalPages(res.pagination.totalPages);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error fetching assets');
    } finally {
      setLoading(false);
    }
  }, [
    token,
    search,
    selectedCategory,
    selectedSite,
    selectedLocation,
    selectedStatus,
    sortBy,
    sortOrder,
    page,
    limit,
  ]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

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
    setSelectedCategory('');
    setSelectedSite('');
    setSelectedLocation('');
    setSelectedStatus('');
    setPage(1);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Available':
        return 'text-emerald-700 bg-emerald-50 border border-emerald-200';
      case 'Assigned':
        return 'text-blue-700 bg-blue-50 border border-blue-200 font-semibold';
      case 'Under Repair':
        return 'text-amber-700 bg-amber-50 border border-amber-200';
      case 'Retired':
        return 'text-neutral-600 bg-neutral-100 border border-neutral-200';
      case 'Disposed':
        return 'text-red-700 bg-red-50 border border-red-200';
      default:
        return 'text-neutral-600 bg-neutral-100 border border-neutral-200';
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-5 select-text">
      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 font-['Plus_Jakarta_Sans',sans-serif]">
            List of Assets
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Displaying <span className="font-mono tabular-nums font-semibold text-neutral-800">{totalCount}</span> registered assets
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowBarcodeModal(true)}
            className="px-3 py-1.5 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-medium rounded transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            title="Print barcode and QR labels"
          >
            <QrCode className="w-3.5 h-3.5 text-neutral-500" />
            <span>Labels & QR</span>
          </button>

          <button
            type="button"
            onClick={fetchAssets}
            disabled={loading}
            className="px-3 py-1.5 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-medium rounded transition-colors inline-flex items-center gap-1.5"
            title="Refresh assets table"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('asset-add')}
            className="px-3.5 py-1.5 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Asset</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-neutral-200 rounded-lg p-3.5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="relative md:col-span-2">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search tag, description, serial, model..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A] bg-white text-neutral-700"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Site Filter */}
          <div>
            <select
              value={selectedSite}
              onChange={(e) => {
                setSelectedSite(e.target.value);
                setSelectedLocation('');
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A] bg-white text-neutral-700"
            >
              <option value="">All Sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A] bg-white text-neutral-700"
            >
              <option value="">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Assigned">Assigned</option>
              <option value="Under Repair">Under Repair</option>
              <option value="Retired">Retired</option>
              <option value="Disposed">Disposed</option>
            </select>
          </div>
        </div>

        {/* Active Filter Clear */}
        {(search || selectedCategory || selectedSite || selectedLocation || selectedStatus) && (
          <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-xs text-neutral-500">
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-400" />
              <span>Filters currently active</span>
            </div>
            <button
              onClick={handleResetFilters}
              className="text-xs text-[#FF6A1A] hover:underline font-medium cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Asset Table Container */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold select-none">
              <tr>
                <th
                  onClick={() => handleSort('asset_tag')}
                  className="py-3 px-4 cursor-pointer hover:text-neutral-900"
                >
                  <div className="flex items-center gap-1">
                    <span>Asset Tag</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('name')}
                  className="py-3 px-4 cursor-pointer hover:text-neutral-900"
                >
                  <div className="flex items-center gap-1">
                    <span>Description / Name</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th className="py-3 px-4">Category</th>
                <th
                  onClick={() => handleSort('status')}
                  className="py-3 px-4 cursor-pointer hover:text-neutral-900"
                >
                  <div className="flex items-center gap-1">
                    <span>Status</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th className="py-3 px-4">Custodian</th>
                <th className="py-3 px-4">Site / Location</th>
                <th
                  onClick={() => handleSort('purchase_cost')}
                  className="py-3 px-4 text-right cursor-pointer hover:text-neutral-900"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Cost</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('purchase_date')}
                  className="py-3 px-4 text-right cursor-pointer hover:text-neutral-900"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Purchased</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-100">
              {loading && assets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-xs text-neutral-400">
                    Loading asset records...
                  </td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="max-w-xs mx-auto space-y-3">
                      <FileSpreadsheet className="w-8 h-8 text-neutral-300 mx-auto" />
                      <div className="text-xs font-semibold text-neutral-800">
                        No Assets Found
                      </div>
                      <p className="text-xs text-neutral-500">
                        {search || selectedCategory || selectedStatus
                          ? 'No asset records matched your filter criteria.'
                          : 'Your company registry does not have any assets yet.'}
                      </p>
                      <button
                        onClick={() => onNavigate('asset-add')}
                        className="px-3.5 py-1.5 bg-[#FF6A1A] text-white text-xs font-semibold rounded hover:bg-[#e55910] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add First Asset
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                assets.map((asset) => (
                  <tr
                    key={asset.id}
                    onClick={() => onNavigate('asset-detail', asset.id)}
                    className="hover:bg-neutral-50/80 transition-colors cursor-pointer group"
                  >
                    {/* Asset Tag */}
                    <td className="py-2.5 px-4 font-mono font-bold text-neutral-900 group-hover:text-[#FF6A1A] whitespace-nowrap">
                      {asset.asset_tag}
                    </td>

                    {/* Name & Manufacturer/Model */}
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-neutral-900 truncate max-w-xs">
                        {asset.name}
                      </div>
                      {(asset.manufacturer || asset.model) && (
                        <div className="text-[11px] text-neutral-500 truncate">
                          {[asset.manufacturer, asset.model].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>

                    {/* Category */}
                    <td className="py-2.5 px-4 text-neutral-700 whitespace-nowrap">
                      {asset.category?.name || <span className="text-neutral-400">—</span>}
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${getStatusColor(
                          asset.status
                        )}`}
                      >
                        {asset.status}
                      </span>
                    </td>

                    {/* Custodian Column */}
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {asset.current_employee ? (
                        <div>
                          <div className="font-semibold text-neutral-900">
                            {asset.current_employee.full_name}
                          </div>
                          <div className="text-[10px] font-mono text-neutral-500">
                            {asset.current_employee.employee_code}
                            {asset.current_employee.department?.name && ` · ${asset.current_employee.department.name}`}
                          </div>
                        </div>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>

                    {/* Site & Location */}
                    <td className="py-2.5 px-4 text-neutral-700 whitespace-nowrap">
                      {asset.site?.name ? (
                        <span>
                          {asset.site.name}
                          {asset.location?.name && (
                            <span className="text-neutral-400"> / {asset.location.name}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>

                    {/* Purchase Cost */}
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-neutral-900 whitespace-nowrap">
                      {asset.purchase_cost !== null && asset.purchase_cost !== undefined
                        ? `$${Number(asset.purchase_cost).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        : <span className="text-neutral-400">—</span>}
                    </td>

                    {/* Purchase Date */}
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-neutral-600 whitespace-nowrap">
                      {asset.purchase_date || <span className="text-neutral-400">—</span>}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {asset.status === 'Available' && isTenantAdmin && (
                          <button
                            type="button"
                            onClick={() => onNavigate('asset-detail', asset.id)}
                            className="px-2 py-0.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-[11px] font-semibold rounded transition-colors cursor-pointer"
                            title="Assign / Check out asset to an employee"
                          >
                            Check Out
                          </button>
                        )}
                        {asset.status === 'Assigned' && isTenantAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => onNavigate('asset-detail', asset.id)}
                              className="px-2 py-0.5 bg-neutral-100 text-neutral-800 hover:bg-neutral-200 border border-neutral-300 text-[11px] font-semibold rounded transition-colors cursor-pointer"
                              title="Check in asset back to inventory"
                            >
                              Check In
                            </button>
                            <button
                              type="button"
                              onClick={() => onNavigate('asset-detail', asset.id)}
                              className="px-2 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-[11px] font-semibold rounded transition-colors cursor-pointer"
                              title="Transfer asset custody to another employee"
                            >
                              Transfer
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => onNavigate('asset-detail', asset.id)}
                          className="text-xs text-[#FF6A1A] hover:underline font-medium cursor-pointer ml-1"
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-600 select-none">
            <div>
              Page <span className="font-semibold">{page}</span> of{' '}
              <span className="font-semibold">{totalPages}</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-2 py-1 bg-white border border-neutral-300 rounded hover:bg-neutral-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-2 py-1 bg-white border border-neutral-300 rounded hover:bg-neutral-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {showBarcodeModal && (
        <Suspense fallback={null}>
          <BarcodeLabelModal
            assets={assets}
            companyName={companyName || 'AssetMT'}
            onClose={() => setShowBarcodeModal(false)}
            onSelectAsset={(id) => onNavigate('asset-detail', id)}
          />
        </Suspense>
      )}
    </div>
  );
};
