/**
 * AssetMT - Inventory & Consumable Stock Management
 * Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Boxes,
  Plus,
  Search,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  SlidersHorizontal,
  History,
  TrendingDown,
  Building2,
  MapPin,
  CheckCircle2,
  X,
  Package,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import {
  InventoryItem,
  InventoryTransaction,
  Category,
  Site,
  Location,
  Vendor,
  CreateInventoryItemInput,
  InventoryStockMovementInput,
} from '../../shared/types.ts';
import {
  validateInventoryItem,
  validateInventoryStockMovement,
} from '../../shared/validation.ts';

interface InventoryListViewProps {
  token: string;
  isTenantAdmin: boolean;
}

export const InventoryListView: React.FC<InventoryListViewProps> = ({
  token,
  isTenantAdmin,
}) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('active');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [movementItem, setMovementItem] = useState<InventoryItem | null>(null);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [itemHistory, setItemHistory] = useState<InventoryTransaction[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Form states
  const [itemForm, setItemForm] = useState<Partial<CreateInventoryItemInput>>({
    sku: '',
    name: '',
    quantity_on_hand: 0,
    minimum_stock_level: 5,
    unit_cost: 0,
    currency: 'USD',
    is_active: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stock movement form state
  const [movementForm, setMovementForm] = useState<Partial<InventoryStockMovementInput>>({
    transaction_type: 'STOCK_IN',
    quantity: 1,
    notes: '',
  });
  const [movementErrors, setMovementErrors] = useState<Record<string, string>>({});
  const [isMovingStock, setIsMovingStock] = useState(false);

  // Fetch initial data
  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [itemsRes, catRes, siteRes, locRes, venRes] = await Promise.all([
        api.getInventoryItems(token, {
          active: activeFilter === 'all' ? undefined : activeFilter === 'active',
          low_stock: lowStockOnly ? true : undefined,
        }),
        api.getCategories(token),
        api.getSites(token),
        api.getLocations(token),
        api.getVendors(token),
      ]);

      if (itemsRes.success) setItems(itemsRes.data);
      if (catRes.success) setCategories(catRes.data);
      if (siteRes.success) setSites(siteRes.data);
      if (locRes.success) setLocations(locRes.data);
      if (venRes.success) setVendors(venRes.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [lowStockOnly, activeFilter]);

  // Load item transaction history
  const loadItemHistory = async (item: InventoryItem) => {
    setHistoryItem(item);
    setIsLoadingHistory(true);
    try {
      const res = await api.getInventoryTransactions(token, item.id);
      if (res.success) {
        setItemHistory(res.data);
      }
    } catch (err) {
      console.error('Failed to load item transaction history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        !search ||
        item.name.toLowerCase().includes(search) ||
        item.sku.toLowerCase().includes(search) ||
        item.notes?.toLowerCase().includes(search);

      return matchesSearch;
    });
  }, [items, searchTerm]);

  // Summary counts
  const summary = useMemo(() => {
    const totalItems = items.length;
    const totalQty = items.reduce((acc, i) => acc + (i.quantity_on_hand || 0), 0);
    const lowStockCount = items.filter((i) => i.quantity_on_hand <= i.minimum_stock_level).length;
    const totalVal = items.reduce(
      (acc, i) => acc + (i.quantity_on_hand || 0) * (Number(i.unit_cost) || 0),
      0
    );
    return { totalItems, totalQty, lowStockCount, totalVal };
  }, [items]);

  // Handle Save (Create or Edit Item)
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateInventoryItem(itemForm, Boolean(editingItem));
    if (!validation.isValid) {
      setFormErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    setFormErrors({});
    try {
      if (editingItem) {
        const res = await api.updateInventoryItem(token, editingItem.id, itemForm);
        if (res.success) {
          setItems((prev) => prev.map((i) => (i.id === editingItem.id ? res.data : i)));
          setEditingItem(null);
          setShowAddModal(false);
        }
      } else {
        const res = await api.createInventoryItem(token, itemForm as CreateInventoryItemInput);
        if (res.success) {
          setItems((prev) => [res.data, ...prev]);
          setShowAddModal(false);
        }
      }
    } catch (err: unknown) {
      const errorData = (err as { data?: { error?: string; errors?: Record<string, string>; message?: string } })?.data;
      if (errorData?.errors) {
        setFormErrors(errorData.errors);
      } else {
        setFormErrors({ general: errorData?.message || (err instanceof Error ? err.message : 'Save failed') });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Stock Movement
  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementItem) return;

    const validation = validateInventoryStockMovement(movementForm, movementItem.quantity_on_hand);
    if (!validation.isValid) {
      setMovementErrors(validation.errors);
      return;
    }

    setIsMovingStock(true);
    setMovementErrors({});
    try {
      const res = await api.recordStockMovement(
        token,
        movementItem.id,
        movementForm as InventoryStockMovementInput
      );
      if (res.success) {
        setItems((prev) => prev.map((i) => (i.id === movementItem.id ? res.item : i)));
        setMovementItem(null);
      }
    } catch (err: unknown) {
      const errorData = (err as { data?: { error?: string; message?: string } })?.data;
      setMovementErrors({
        general: errorData?.message || (err instanceof Error ? err.message : 'Movement failed'),
      });
    } finally {
      setIsMovingStock(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#FF6A1A]" />
            <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
              Inventory & Consumables
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-mono">
              {items.length} SKUs
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Quantity-based consumable stock tracking, minimum thresholds, and immutable movement history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isTenantAdmin && (
            <button
              onClick={() => {
                setEditingItem(null);
                setItemForm({
                  sku: '',
                  name: '',
                  quantity_on_hand: 0,
                  minimum_stock_level: 5,
                  unit_cost: 0,
                  currency: 'USD',
                  is_active: true,
                });
                setFormErrors({});
                setShowAddModal(true);
              }}
              className="px-4 py-2 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Inventory Item
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-lg border border-neutral-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
            Total Inventory Value
          </div>
          <div className="text-xl font-bold text-neutral-900 mt-1">
            ${summary.totalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5 font-mono">
            {summary.totalQty} total units across all SKUs
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg border border-neutral-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
            Active SKUs
          </div>
          <div className="text-xl font-bold text-neutral-900 mt-1">
            {items.filter((i) => i.is_active).length}
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5">
            {items.filter((i) => !i.is_active).length} inactive items
          </div>
        </div>

        <div
          className={`p-4 rounded-lg border shadow-2xs cursor-pointer transition-colors ${
            lowStockOnly
              ? 'bg-amber-100/60 border-amber-300 ring-2 ring-amber-400'
              : summary.lowStockCount > 0
              ? 'bg-amber-50/50 border-amber-200 hover:bg-amber-50'
              : 'bg-white border-neutral-200'
          }`}
          onClick={() => setLowStockOnly(!lowStockOnly)}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-900 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              Low Stock Alert
            </span>
            {lowStockOnly && (
              <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                Active Filter
              </span>
            )}
          </div>
          <div className="text-xl font-bold text-amber-900 mt-1">
            {summary.lowStockCount}
          </div>
          <div className="text-[11px] text-amber-700 mt-0.5">
            Items at or below minimum threshold
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg border border-neutral-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
            Stock Replenishment
          </div>
          <div className="text-xl font-bold text-neutral-900 mt-1">
            {summary.lowStockCount === 0 ? 'Healthy' : 'Action Needed'}
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5">
            {summary.lowStockCount === 0 ? 'All items above thresholds' : 'Reorder low-stock consumables'}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-lg border border-neutral-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by SKU, name, notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded text-xs focus:bg-white focus:outline-none focus:border-[#FF6A1A]"
            />
          </div>

          <div className="inline-flex rounded-md border border-neutral-200 bg-neutral-50 p-0.5 text-xs">
            <button
              onClick={() => setActiveFilter('active')}
              className={`px-2.5 py-1 rounded cursor-pointer ${
                activeFilter === 'active' ? 'bg-white shadow-2xs font-semibold text-neutral-900' : 'text-neutral-500'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-2.5 py-1 rounded cursor-pointer ${
                activeFilter === 'all' ? 'bg-white shadow-2xs font-semibold text-neutral-900' : 'text-neutral-500'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveFilter('inactive')}
              className={`px-2.5 py-1 rounded cursor-pointer ${
                activeFilter === 'inactive' ? 'bg-white shadow-2xs font-semibold text-neutral-900' : 'text-neutral-500'
              }`}
            >
              Inactive
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData()}
            className="p-1.5 border border-neutral-200 rounded hover:bg-neutral-50 text-neutral-600 cursor-pointer"
            title="Refresh inventory"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-neutral-200 rounded-lg shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-neutral-400">Loading inventory items...</div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-red-600 bg-red-50">{error}</div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center">
            <Boxes className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
            <div className="text-xs font-semibold text-neutral-800">No inventory items found</div>
            <p className="text-[11px] text-neutral-400 mt-1">
              {lowStockOnly ? 'No items currently below minimum stock levels.' : 'Get started by registering consumable stock items.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-50/75 border-b border-neutral-200 text-neutral-500 uppercase tracking-wider font-semibold text-[10px]">
                  <th className="py-2.5 px-4">SKU / Code</th>
                  <th className="py-2.5 px-4">Item Name</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Site & Location</th>
                  <th className="py-2.5 px-4 text-right">On Hand</th>
                  <th className="py-2.5 px-4 text-right">Min Stock</th>
                  <th className="py-2.5 px-4 text-right">Unit Cost</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredItems.map((item) => {
                  const isLow = item.quantity_on_hand <= item.minimum_stock_level;
                  return (
                    <tr key={item.id} className="hover:bg-neutral-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-neutral-900">
                        {item.sku}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-neutral-900">{item.name}</div>
                        {item.notes && (
                          <div className="text-[10px] text-neutral-400 truncate max-w-xs">
                            {item.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-neutral-600">
                        {item.category?.name || '—'}
                      </td>
                      <td className="py-3 px-4 text-neutral-600">
                        {item.site ? (
                          <span>
                            {item.site.name}
                            {item.location && <span className="text-neutral-400"> / {item.location.name}</span>}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-neutral-900">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs ${
                            isLow ? 'bg-amber-100 text-amber-900' : 'text-neutral-900'
                          }`}
                        >
                          {item.quantity_on_hand}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-neutral-500">
                        {item.minimum_stock_level}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-neutral-700">
                        {item.unit_cost !== null && item.unit_cost !== undefined
                          ? `$${Number(item.unit_cost).toFixed(2)}`
                          : '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          {isLow && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              Low
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              item.is_active
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                            }`}
                          >
                            {item.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => loadItemHistory(item)}
                            className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded cursor-pointer"
                            title="Transaction History"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>

                          {isTenantAdmin && (
                            <>
                              <button
                                onClick={() => {
                                  setMovementItem(item);
                                  setMovementForm({
                                    transaction_type: 'STOCK_IN',
                                    quantity: 1,
                                    notes: '',
                                  });
                                  setMovementErrors({});
                                }}
                                className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded text-[11px] font-medium cursor-pointer transition-colors inline-flex items-center gap-1"
                              >
                                <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                                Adjust
                              </button>

                              <button
                                onClick={() => {
                                  setEditingItem(item);
                                  setItemForm({
                                    sku: item.sku,
                                    name: item.name,
                                    category_id: item.category_id || undefined,
                                    site_id: item.site_id || undefined,
                                    location_id: item.location_id || undefined,
                                    minimum_stock_level: item.minimum_stock_level,
                                    unit_cost: item.unit_cost !== null ? Number(item.unit_cost) : undefined,
                                    currency: item.currency,
                                    vendor_id: item.vendor_id || undefined,
                                    notes: item.notes || '',
                                    is_active: item.is_active,
                                  });
                                  setFormErrors({});
                                  setShowAddModal(true);
                                }}
                                className="px-2 py-1 text-neutral-600 hover:text-neutral-900 rounded text-[11px] cursor-pointer"
                              >
                                Edit
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Inventory Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-neutral-200 shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-4">
              <h3 className="text-sm font-bold text-neutral-900">
                {editingItem ? `Edit Inventory Item (${editingItem.sku})` : 'New Consumable Inventory Item'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-neutral-400 hover:text-neutral-700 text-sm"
              >
                ✕
              </button>
            </div>

            {formErrors.general && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 mb-4">
                {formErrors.general}
              </div>
            )}

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    SKU / Part Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CAB-CAT6-01"
                    value={itemForm.sku || ''}
                    onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded font-mono uppercase focus:outline-none focus:border-[#FF6A1A]"
                  />
                  {formErrors.sku && <p className="text-[10px] text-red-500 mt-0.5">{formErrors.sku}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Category
                  </label>
                  <select
                    value={itemForm.category_id || ''}
                    onChange={(e) => setItemForm({ ...itemForm, category_id: e.target.value || undefined })}
                    className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                  >
                    <option value="">(None)</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cat6 Ethernet Cable 10ft or Wireless Mouse"
                  value={itemForm.name || ''}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                />
                {formErrors.name && <p className="text-[10px] text-red-500 mt-0.5">{formErrors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {!editingItem && (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Initial Quantity on Hand
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={itemForm.quantity_on_hand ?? 0}
                      onChange={(e) =>
                        setItemForm({ ...itemForm, quantity_on_hand: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded font-mono focus:outline-none focus:border-[#FF6A1A]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Minimum Stock Level
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={itemForm.minimum_stock_level ?? 5}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, minimum_stock_level: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded font-mono focus:outline-none focus:border-[#FF6A1A]"
                  />
                  <span className="text-[10px] text-neutral-400">Triggers low-stock warning</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Unit Cost ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={itemForm.unit_cost ?? ''}
                    onChange={(e) =>
                      setItemForm({
                        ...itemForm,
                        unit_cost: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded font-mono focus:outline-none focus:border-[#FF6A1A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Supplier / Vendor
                  </label>
                  <select
                    value={itemForm.vendor_id || ''}
                    onChange={(e) => setItemForm({ ...itemForm, vendor_id: e.target.value || undefined })}
                    className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                  >
                    <option value="">(None)</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Site</label>
                  <select
                    value={itemForm.site_id || ''}
                    onChange={(e) => setItemForm({ ...itemForm, site_id: e.target.value || undefined })}
                    className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                  >
                    <option value="">(None)</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Location</label>
                  <select
                    value={itemForm.location_id || ''}
                    onChange={(e) => setItemForm({ ...itemForm, location_id: e.target.value || undefined })}
                    className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                  >
                    <option value="">(None)</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={itemForm.notes || ''}
                  onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })}
                  placeholder="Optional storage instructions or part specifications..."
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="item_is_active"
                  checked={itemForm.is_active ?? true}
                  onChange={(e) => setItemForm({ ...itemForm, is_active: e.target.checked })}
                  className="rounded text-[#FF6A1A] focus:ring-[#FF6A1A]"
                />
                <label htmlFor="item_is_active" className="text-xs text-neutral-700 font-medium">
                  Item is active and available for consumption
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 border border-neutral-300 rounded text-xs text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Movement Modal */}
      {movementItem && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-neutral-200 shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-4">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Record Stock Movement</h3>
                <p className="text-[11px] text-neutral-500 font-mono">
                  {movementItem.sku} — {movementItem.name} (Current: {movementItem.quantity_on_hand})
                </p>
              </div>
              <button
                onClick={() => setMovementItem(null)}
                className="text-neutral-400 hover:text-neutral-700 text-sm"
              >
                ✕
              </button>
            </div>

            {movementErrors.general && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 mb-4">
                {movementErrors.general}
              </div>
            )}

            <form onSubmit={handleRecordMovement} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Movement Type *
                </label>
                <select
                  value={movementForm.transaction_type}
                  onChange={(e) =>
                    setMovementForm({
                      ...movementForm,
                      transaction_type: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                >
                  <option value="STOCK_IN">Stock In (Receive shipment / restock)</option>
                  <option value="STOCK_OUT">Stock Out (Consume / issue to team)</option>
                  <option value="TRANSFER">Transfer (Move to another location)</option>
                  <option value="ADJUSTMENT">Adjustment (Count audit reconciliation)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  {movementForm.transaction_type === 'ADJUSTMENT'
                    ? 'New Adjusted Stock Count *'
                    : 'Quantity *'}
                </label>
                <input
                  type="number"
                  min={movementForm.transaction_type === 'ADJUSTMENT' ? '0' : '1'}
                  max={
                    movementForm.transaction_type === 'STOCK_OUT' || movementForm.transaction_type === 'TRANSFER'
                      ? movementItem.quantity_on_hand
                      : undefined
                  }
                  required
                  value={movementForm.quantity ?? 1}
                  onChange={(e) =>
                    setMovementForm({ ...movementForm, quantity: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded font-mono focus:outline-none focus:border-[#FF6A1A]"
                />
                {movementErrors.quantity && (
                  <p className="text-[10px] text-red-500 mt-0.5">{movementErrors.quantity}</p>
                )}
              </div>

              {(movementForm.transaction_type === 'TRANSFER' || movementForm.transaction_type === 'STOCK_IN') && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Destination Location
                  </label>
                  <select
                    value={movementForm.to_location_id || ''}
                    onChange={(e) =>
                      setMovementForm({ ...movementForm, to_location_id: e.target.value || undefined })
                    }
                    className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                  >
                    <option value="">(Select Location)</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Reference # (PO, Ticket, Receipt)
                </label>
                <input
                  type="text"
                  placeholder="e.g. PO-88201 or TICKET-492"
                  value={movementForm.reference_number || ''}
                  onChange={(e) =>
                    setMovementForm({ ...movementForm, reference_number: e.target.value })
                  }
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded font-mono focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Reason for stock movement..."
                  value={movementForm.notes || ''}
                  onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setMovementItem(null)}
                  className="px-3 py-1.5 border border-neutral-300 rounded text-xs text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isMovingStock}
                  className="px-4 py-1.5 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded cursor-pointer disabled:opacity-50"
                >
                  {isMovingStock ? 'Recording...' : 'Record Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item Transaction History Drawer / Modal */}
      {historyItem && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-neutral-200 shadow-xl max-w-2xl w-full p-6 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 mb-4">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">
                  Stock Movement History
                </h3>
                <p className="text-[11px] text-neutral-500 font-mono">
                  {historyItem.sku} — {historyItem.name}
                </p>
              </div>
              <button
                onClick={() => setHistoryItem(null)}
                className="text-neutral-400 hover:text-neutral-700 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoadingHistory ? (
                <div className="p-8 text-center text-xs text-neutral-400">Loading history...</div>
              ) : itemHistory.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-400">
                  No stock transactions recorded for this item yet.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase font-semibold text-[10px]">
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3 text-right">Quantity</th>
                      <th className="py-2 px-3">Reference / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {itemHistory.map((t) => (
                      <tr key={t.id} className="hover:bg-neutral-50/50">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-600">
                          {new Date(t.created_at).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              t.transaction_type === 'STOCK_IN'
                                ? 'bg-emerald-50 text-emerald-800'
                                : t.transaction_type === 'STOCK_OUT'
                                ? 'bg-red-50 text-red-800'
                                : t.transaction_type === 'TRANSFER'
                                ? 'bg-blue-50 text-blue-800'
                                : 'bg-purple-50 text-purple-800'
                            }`}
                          >
                            {t.transaction_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-900">
                          {t.transaction_type === 'STOCK_IN'
                            ? `+${t.quantity}`
                            : t.transaction_type === 'STOCK_OUT'
                            ? `-${t.quantity}`
                            : t.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-neutral-600">
                          {t.reference_number && (
                            <span className="font-mono text-[10px] bg-neutral-100 px-1 py-0.5 rounded mr-1">
                              {t.reference_number}
                            </span>
                          )}
                          {t.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="pt-4 border-t border-neutral-200 flex justify-end">
              <button
                onClick={() => setHistoryItem(null)}
                className="px-4 py-1.5 border border-neutral-300 rounded text-xs text-neutral-700 hover:bg-neutral-50 cursor-pointer font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
