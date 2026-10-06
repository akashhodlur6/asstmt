/**
 * AssetMT - Add / Edit Asset Form
 * Full AssetTiger parity fields with dynamic Category/Site/Location creation.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import {
  Asset,
  AssetStatus,
  Category,
  CreateAssetInput,
  Location,
  Site,
} from '../../shared/types.ts';
import { validateAsset } from '../../shared/validation.ts';
import {
  ArrowLeft,
  Save,
  Plus,
  Wand2,
  AlertCircle,
  CheckCircle2,
  Info,
} from 'lucide-react';

interface AssetFormViewProps {
  assetId?: string;
  onNavigate: (view: string, assetId?: string) => void;
}

export const AssetFormView: React.FC<AssetFormViewProps> = ({ assetId, onNavigate }) => {
  const { token } = useAuth();
  const isEditing = Boolean(assetId);

  // Form State
  const [assetTag, setAssetTag] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [status, setStatus] = useState<AssetStatus>('Available');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [warrantyExpiry, setWarrantyExpiry] = useState('');
  const [notes, setNotes] = useState('');

  // Dropdown Lookups
  const [categories, setCategories] = useState<Category[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // Modals for quick-add
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [showAddSite, setShowAddSite] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [showAddLoc, setShowAddLoc] = useState(false);
  const [newLocName, setNewLocName] = useState('');

  // Execution states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load Lookups
  const loadLookups = useCallback(async () => {
    if (!token) return;
    try {
      const [catRes, siteRes, locRes] = await Promise.all([
        api.getCategories(token),
        api.getSites(token),
        api.getLocations(token),
      ]);
      if (catRes.success) setCategories(catRes.data);
      if (siteRes.success) setSites(siteRes.data);
      if (locRes.success) setLocations(locRes.data);
    } catch {
      // Ignore lookup load error
    }
  }, [token]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  // Load Existing Asset for Editing
  useEffect(() => {
    if (!token || !assetId) {
      // If adding new, generate initial tag placeholder
      if (!isEditing && !assetTag) {
        setAssetTag(`AST-${Math.floor(10000 + Math.random() * 90000)}`);
      }
      return;
    }

    setLoading(true);
    api
      .getAsset(token, assetId)
      .then((res) => {
        if (res.success && res.data) {
          const a = res.data;
          setAssetTag(a.asset_tag);
          setName(a.name);
          setDescription(a.description || '');
          setCategoryId(a.category_id || '');
          setSiteId(a.site_id || '');
          setLocationId(a.location_id || '');
          setSerialNumber(a.serial_number || '');
          setManufacturer(a.manufacturer || '');
          setModel(a.model || '');
          setStatus(a.status);
          setPurchaseDate(a.purchase_date || '');
          setPurchaseCost(a.purchase_cost !== null && a.purchase_cost !== undefined ? String(a.purchase_cost) : '');
          setCurrency(a.currency || 'USD');
          setWarrantyExpiry(a.warranty_expiry || '');
          setNotes(a.notes || '');
        }
      })
      .catch((err) => {
        setGeneralError(err instanceof Error ? err.message : 'Error loading asset');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token, assetId, isEditing]);

  // Handle Quick Category Create
  const handleQuickAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newCatName.trim()) return;
    try {
      setGeneralError(null);
      const res = await api.createCategory(token, { name: newCatName.trim() });
      if (res.success) {
        setCategories((prev) => [...prev, res.data]);
        setCategoryId(res.data.id);
        setNewCatName('');
        setShowAddCat(false);
      }
    } catch (err: unknown) {
      setGeneralError(err instanceof Error ? err.message : 'Failed to create category');
    }
  };

  // Handle Quick Site Create
  const handleQuickAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newSiteName.trim()) return;
    try {
      setGeneralError(null);
      const res = await api.createSite(token, { name: newSiteName.trim() });
      if (res.success) {
        setSites((prev) => [...prev, res.data]);
        setSiteId(res.data.id);
        setNewSiteName('');
        setShowAddSite(false);
      }
    } catch (err: unknown) {
      setGeneralError(err instanceof Error ? err.message : 'Failed to create site');
    }
  };

  // Handle Quick Location Create
  const handleQuickAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !siteId || !newLocName.trim()) {
      setGeneralError('Please select a site before adding a location to it.');
      return;
    }
    try {
      setGeneralError(null);
      const res = await api.createLocation(token, { site_id: siteId, name: newLocName.trim() });
      if (res.success) {
        setLocations((prev) => [...prev, res.data]);
        setLocationId(res.data.id);
        setNewLocName('');
        setShowAddLoc(false);
      }
    } catch (err: unknown) {
      setGeneralError(err instanceof Error ? err.message : 'Failed to create location');
    }
  };

  const handleGenerateTag = () => {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    setAssetTag(`AST-${randomNum}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setGeneralError(null);
    setSuccessMsg(null);

    const payload: CreateAssetInput = {
      asset_tag: assetTag.trim(),
      name: name.trim(),
      description: description.trim() || undefined,
      category_id: categoryId || undefined,
      site_id: siteId || undefined,
      location_id: locationId || undefined,
      serial_number: serialNumber.trim() || undefined,
      manufacturer: manufacturer.trim() || undefined,
      model: model.trim() || undefined,
      status,
      purchase_date: purchaseDate || undefined,
      purchase_cost: purchaseCost ? parseFloat(purchaseCost) : undefined,
      currency,
      warranty_expiry: warrantyExpiry || undefined,
      notes: notes.trim() || undefined,
    };

    // Shared Client-Side Validation
    const validation = validateAsset(payload, isEditing);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});

    try {
      setSaving(true);
      let savedAsset: Asset;

      if (isEditing && assetId) {
        const res = await api.updateAsset(token, assetId, payload);
        savedAsset = res.data;
      } else {
        const res = await api.createAsset(token, payload);
        savedAsset = res.data;
      }

      setSuccessMsg(`Asset ${savedAsset.asset_tag} successfully saved.`);
      setTimeout(() => {
        onNavigate('asset-detail', savedAsset.id);
      }, 700);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save asset';
      setGeneralError(msg);
      // Check if duplicate tag error returned from API
      const statusData = (err as unknown as { data?: { errors?: Record<string, string> } })?.data;
      if (statusData?.errors) {
        setErrors(statusData.errors);
      }
    } finally {
      setSaving(false);
    }
  };

  const filteredLocations = siteId
    ? locations.filter((loc) => loc.site_id === siteId)
    : locations;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 select-text">
      {/* Top Navigation & Breadcrumb Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate(assetId ? 'asset-detail' : 'assets', assetId)}
            className="p-1.5 rounded hover:bg-neutral-100 text-neutral-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 font-['Plus_Jakarta_Sans',sans-serif]">
              {isEditing ? `Edit Asset: ${assetTag}` : 'Add New Asset'}
            </h1>
            <p className="text-xs text-neutral-500">
              {isEditing
                ? 'Update asset details and trigger server-side audit logging'
                : 'Register a new enterprise hardware or equipment asset'}
            </p>
          </div>
        </div>
      </div>

      {generalError && (
        <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{generalError}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-green-50 border border-green-200 text-xs text-green-700 rounded flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-xs text-neutral-400">Loading asset form...</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Identification & General Info */}
          <div className="bg-white border border-neutral-200 rounded-lg p-6 space-y-4">
            <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider border-b border-neutral-100 pb-2">
              1. Asset Identification & Categorization
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Asset Tag */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Asset Tag <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. AST-1004"
                    value={assetTag}
                    onChange={(e) => setAssetTag(e.target.value)}
                    className={`w-full px-3 py-1.5 text-xs font-mono border rounded focus:outline-none ${
                      errors.asset_tag
                        ? 'border-red-500 bg-red-50/20'
                        : 'border-neutral-300 focus:border-[#FF6A1A]'
                    }`}
                  />
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={handleGenerateTag}
                      className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs rounded font-medium inline-flex items-center gap-1 shrink-0"
                      title="Generate random unique tag"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      <span>Auto</span>
                    </button>
                  )}
                </div>
                {errors.asset_tag && (
                  <p className="text-[11px] text-red-600 mt-1">{errors.asset_tag}</p>
                )}
              </div>

              {/* Category */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-neutral-700">
                    Category
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddCat(!showAddCat)}
                    className="text-[11px] text-[#FF6A1A] hover:underline font-medium inline-flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" /> Add Category
                  </button>
                </div>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A] bg-white"
                >
                  <option value="">— Select Category —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Add Category Inline Pop */}
            {showAddCat && (
              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="New category name (e.g. Laboratory Equipment)"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="px-2.5 py-1 text-xs border border-neutral-300 rounded bg-white flex-1 focus:outline-none focus:border-[#FF6A1A]"
                />
                <button
                  type="button"
                  onClick={handleQuickAddCategory}
                  className="px-3 py-1 bg-neutral-800 text-white text-xs font-medium rounded hover:bg-neutral-900"
                >
                  Save Category
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCat(false)}
                  className="text-xs text-neutral-500 hover:text-neutral-800 px-1"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Asset Name / Description */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Asset Name / Description <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. MacBook Pro 16-inch M3 Max 64GB"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full px-3 py-1.5 text-xs border rounded focus:outline-none ${
                  errors.name
                    ? 'border-red-500 bg-red-50/20'
                    : 'border-neutral-300 focus:border-[#FF6A1A]'
                }`}
              />
              {errors.name && <p className="text-[11px] text-red-600 mt-1">{errors.name}</p>}
            </div>

            {/* Serial, Manufacturer & Model */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Serial Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. C02G90XXMD6M"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-mono border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Manufacturer
                </label>
                <input
                  type="text"
                  placeholder="e.g. Apple, Dell, Herman Miller"
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Model
                </label>
                <input
                  type="text"
                  placeholder="e.g. A2991 / Precision 5570"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Location & Status */}
          <div className="bg-white border border-neutral-200 rounded-lg p-6 space-y-4">
            <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider border-b border-neutral-100 pb-2">
              2. Facility Location & Operational Status
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Site */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-neutral-700">Site</label>
                  <button
                    type="button"
                    onClick={() => setShowAddSite(!showAddSite)}
                    className="text-[11px] text-[#FF6A1A] hover:underline font-medium inline-flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" /> Add Site
                  </button>
                </div>
                <select
                  value={siteId}
                  onChange={(e) => {
                    setSiteId(e.target.value);
                    setLocationId('');
                  }}
                  className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A] bg-white"
                >
                  <option value="">— Select Site —</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-neutral-700">Location</label>
                  {siteId && (
                    <button
                      type="button"
                      onClick={() => setShowAddLoc(!showAddLoc)}
                      className="text-[11px] text-[#FF6A1A] hover:underline font-medium inline-flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" /> Add Location
                    </button>
                  )}
                </div>
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  disabled={!siteId}
                  className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A] bg-white disabled:bg-neutral-50 disabled:text-neutral-400"
                >
                  <option value="">
                    {siteId ? '— Select Location —' : 'Select a site first'}
                  </option>
                  {filteredLocations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Asset Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as AssetStatus)}
                  className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A] bg-white font-medium"
                >
                  <option value="Available">Available</option>
                  <option value="Under Repair">Under Repair</option>
                  <option value="Retired">Retired</option>
                  <option value="Disposed">Disposed</option>
                  {/* Prohibited Assigned status */}
                  <option value="Assigned" disabled>
                    Assigned (Reserved for Phase 2 Custody)
                  </option>
                </select>
                <div className="flex items-center gap-1 text-[10px] text-neutral-400 mt-1">
                  <Info className="w-3 h-3 text-neutral-400 shrink-0" />
                  <span>&apos;Assigned&apos; status is unlocked when Custody workflows are introduced.</span>
                </div>
              </div>
            </div>

            {/* Quick Add Site Modal/Bar */}
            {showAddSite && (
              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="New site name (e.g. West Campus Data Center)"
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  className="px-2.5 py-1 text-xs border border-neutral-300 rounded bg-white flex-1 focus:outline-none focus:border-[#FF6A1A]"
                />
                <button
                  type="button"
                  onClick={handleQuickAddSite}
                  className="px-3 py-1 bg-neutral-800 text-white text-xs font-medium rounded hover:bg-neutral-900"
                >
                  Save Site
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddSite(false)}
                  className="text-xs text-neutral-500 hover:text-neutral-800 px-1"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Quick Add Location Modal/Bar */}
            {showAddLoc && (
              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="New location name (e.g. Server Room B, Rack 04)"
                  value={newLocName}
                  onChange={(e) => setNewLocName(e.target.value)}
                  className="px-2.5 py-1 text-xs border border-neutral-300 rounded bg-white flex-1 focus:outline-none focus:border-[#FF6A1A]"
                />
                <button
                  type="button"
                  onClick={handleQuickAddLocation}
                  className="px-3 py-1 bg-neutral-800 text-white text-xs font-medium rounded hover:bg-neutral-900"
                >
                  Save Location
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddLoc(false)}
                  className="text-xs text-neutral-500 hover:text-neutral-800 px-1"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Section 3: Financial & Warranty */}
          <div className="bg-white border border-neutral-200 rounded-lg p-6 space-y-4">
            <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider border-b border-neutral-100 pb-2">
              3. Procurement & Warranty
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Purchase Date
                </label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Purchase Cost
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={purchaseCost}
                  onChange={(e) => setPurchaseCost(e.target.value)}
                  className={`w-full px-3 py-1.5 text-xs font-mono border rounded focus:outline-none ${
                    errors.purchase_cost
                      ? 'border-red-500 bg-red-50/20'
                      : 'border-neutral-300 focus:border-[#FF6A1A]'
                  }`}
                />
                {errors.purchase_cost && (
                  <p className="text-[11px] text-red-600 mt-1">{errors.purchase_cost}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A] bg-white font-mono"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="AUD">AUD ($)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="JPY">JPY (¥)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Warranty Expiry
                </label>
                <input
                  type="date"
                  value={warrantyExpiry}
                  onChange={(e) => setWarrantyExpiry(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Notes */}
          <div className="bg-white border border-neutral-200 rounded-lg p-6 space-y-4">
            <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider border-b border-neutral-100 pb-2">
              4. Notes & Additional Details
            </h2>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Internal Notes & Observations
              </label>
              <textarea
                rows={3}
                placeholder="Include supplier details, invoice reference numbers, or deployment notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => onNavigate(assetId ? 'asset-detail' : 'assets', assetId)}
              className="px-4 py-2 border border-neutral-300 text-neutral-700 hover:bg-neutral-50 text-xs font-medium rounded transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Asset...' : isEditing ? 'Save Changes' : 'Create Asset'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
