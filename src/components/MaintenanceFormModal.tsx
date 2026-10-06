/**
 * AssetMT - Create / Edit Maintenance Work Order Modal
 * AssetTiger enterprise parity styling with asset search & vendor selection.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import {
  Asset,
  CreateMaintenanceInput,
  MaintenancePriority,
  MaintenanceRecord,
  MaintenanceType,
  Vendor,
} from '../../shared/types.ts';
import {
  validateMaintenance,
  VALID_MAINTENANCE_TYPES,
  VALID_MAINTENANCE_PRIORITIES,
} from '../../shared/validation.ts';
import {
  Wrench,
  X,
  Search,
  AlertCircle,
  Building2,
  Calendar,
  DollarSign,
  Tag,
  Wand2,
} from 'lucide-react';

interface MaintenanceFormModalProps {
  initialAssetId?: string;
  editingRecord?: MaintenanceRecord | null;
  onClose: () => void;
  onSuccess: (record: MaintenanceRecord) => void;
}

export const MaintenanceFormModal: React.FC<MaintenanceFormModalProps> = ({
  initialAssetId,
  editingRecord,
  onClose,
  onSuccess,
}) => {
  const { token } = useAuth();
  const isEditing = Boolean(editingRecord);

  // Assets and Vendors for lookups
  const [assets, setAssets] = useState<Asset[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [assetSearch, setAssetSearch] = useState('');

  // Form State
  const [assetId, setAssetId] = useState(editingRecord?.asset_id || initialAssetId || '');
  const [workOrderNumber, setWorkOrderNumber] = useState(
    editingRecord?.work_order_number || ''
  );
  const [title, setTitle] = useState(editingRecord?.title || '');
  const [description, setDescription] = useState(editingRecord?.description || '');
  const [maintenanceType, setMaintenanceType] = useState<MaintenanceType>(
    editingRecord?.maintenance_type || 'Preventative'
  );
  const [priority, setPriority] = useState<MaintenancePriority>(
    editingRecord?.priority || 'Medium'
  );
  const [scheduledDate, setScheduledDate] = useState(
    editingRecord?.scheduled_date ? editingRecord.scheduled_date.split('T')[0] : ''
  );
  const [dueDate, setDueDate] = useState(
    editingRecord?.due_date ? editingRecord.due_date.split('T')[0] : ''
  );
  const [vendorId, setVendorId] = useState(editingRecord?.vendor_id || '');
  const [serviceCost, setServiceCost] = useState(
    editingRecord?.service_cost !== null && editingRecord?.service_cost !== undefined
      ? String(editingRecord.service_cost)
      : ''
  );
  const [currency, setCurrency] = useState(editingRecord?.currency || 'USD');
  const [notes, setNotes] = useState(editingRecord?.resolution_notes || '');

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Generate initial work order number for new records if blank
  useEffect(() => {
    if (!isEditing && !workOrderNumber) {
      const rand = Math.floor(10000 + Math.random() * 90000);
      setWorkOrderNumber(`WO-${rand}`);
    }
  }, [isEditing, workOrderNumber]);

  // Load assets and active vendors
  useEffect(() => {
    if (!token) return;

    api
      .getAssets(token, { limit: 100 })
      .then((res) => {
        if (res.success) setAssets(res.data);
      })
      .catch(() => {});

    api
      .getVendors(token, { is_active: 'true' })
      .then((res) => {
        if (res.success) setVendors(res.data);
      })
      .catch(() => {});
  }, [token]);

  const handleGenerateWo = () => {
    const rand = Math.floor(10000 + Math.random() * 90000);
    setWorkOrderNumber(`WO-${rand}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setGeneralError(null);

    const payload: CreateMaintenanceInput = {
      asset_id: assetId,
      work_order_number: workOrderNumber.trim() || undefined,
      title: title.trim(),
      description: description.trim() || undefined,
      maintenance_type: maintenanceType,
      priority,
      scheduled_date: scheduledDate || null,
      due_date: dueDate || null,
      vendor_id: vendorId || null,
      service_cost: serviceCost ? parseFloat(serviceCost) : null,
      currency,
      notes: notes.trim() || undefined,
    };

    const validation = validateMaintenance(payload, isEditing);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});

    try {
      setLoading(true);
      let resRecord: MaintenanceRecord;
      if (isEditing && editingRecord) {
        const res = await api.updateMaintenanceRecord(token, editingRecord.id, payload);
        resRecord = res.data;
      } else {
        const res = await api.createMaintenanceRecord(token, payload);
        resRecord = res.data;
      }
      onSuccess(resRecord);
    } catch (err: unknown) {
      setGeneralError(err instanceof Error ? err.message : 'Failed to save work order');
    } finally {
      setLoading(false);
    }
  };

  const filteredAssets = assets.filter((a) =>
    assetSearch
      ? a.asset_tag.toLowerCase().includes(assetSearch.toLowerCase()) ||
        a.name.toLowerCase().includes(assetSearch.toLowerCase())
      : true
  );

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-neutral-200 shadow-xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#FF6A1A]/10 text-[#FF6A1A] flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900">
                {isEditing ? `Edit Work Order ${editingRecord?.work_order_number}` : 'New Maintenance Work Order'}
              </h3>
              <p className="text-[11px] text-neutral-500">
                Schedule preventative maintenance, inspection, or repairs
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 p-1 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {generalError && (
          <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{generalError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Section 1: Target Asset & WO Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Target Asset Selection */}
            <div>
              <label className="block text-xs font-semibold text-neutral-800 mb-1">
                Target Asset <span className="text-red-500">*</span>
              </label>
              {initialAssetId ? (
                <div className="p-2 bg-neutral-50 border border-neutral-200 rounded font-mono font-medium text-neutral-800">
                  {assets.find((a) => a.id === assetId)?.asset_tag || 'Selected Asset'} —{' '}
                  {assets.find((a) => a.id === assetId)?.name || ''}
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search asset tag or name..."
                      value={assetSearch}
                      onChange={(e) => setAssetSearch(e.target.value)}
                      className="w-full pl-8 pr-2 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A] mb-1"
                    />
                  </div>
                  <select
                    required
                    value={assetId}
                    onChange={(e) => setAssetId(e.target.value)}
                    className={`w-full px-2.5 py-1.5 border rounded focus:outline-none bg-white font-medium ${
                      errors.asset_id ? 'border-red-500 bg-red-50/20' : 'border-neutral-300 focus:border-[#FF6A1A]'
                    }`}
                  >
                    <option value="">— Select Target Asset —</option>
                    {filteredAssets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.asset_tag} — {a.name} ({a.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {errors.asset_id && <p className="text-[11px] text-red-600 mt-1">{errors.asset_id}</p>}
            </div>

            {/* Work Order Number */}
            <div>
              <label className="block text-xs font-semibold text-neutral-800 mb-1">
                Work Order # <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="e.g. WO-10024"
                  value={workOrderNumber}
                  onChange={(e) => setWorkOrderNumber(e.target.value)}
                  className={`w-full px-3 py-1.5 font-mono border rounded focus:outline-none ${
                    errors.work_order_number ? 'border-red-500 bg-red-50/20' : 'border-neutral-300 focus:border-[#FF6A1A]'
                  }`}
                />
                {!isEditing && (
                  <button
                    type="button"
                    onClick={handleGenerateWo}
                    className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded font-medium inline-flex items-center gap-1 shrink-0"
                    title="Auto-generate work order number"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Auto</span>
                  </button>
                )}
              </div>
              {errors.work_order_number && (
                <p className="text-[11px] text-red-600 mt-1">{errors.work_order_number}</p>
              )}
            </div>
          </div>

          {/* Section 2: Title & Description */}
          <div>
            <label className="block text-xs font-semibold text-neutral-800 mb-1">
              Work Order Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Annual Hydraulic System Calibration & Seal Replacement"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full px-3 py-1.5 border rounded focus:outline-none ${
                errors.title ? 'border-red-500 bg-red-50/20' : 'border-neutral-300 focus:border-[#FF6A1A]'
              }`}
            />
            {errors.title && <p className="text-[11px] text-red-600 mt-1">{errors.title}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Description & Detailed Work Instructions
            </label>
            <textarea
              rows={2}
              placeholder="Specify maintenance checklist, component parts required, safety precautions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-1.5 border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
            />
          </div>

          {/* Section 3: Type & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-800 mb-1">
                Maintenance Type <span className="text-red-500">*</span>
              </label>
              <select
                value={maintenanceType}
                onChange={(e) => setMaintenanceType(e.target.value as MaintenanceType)}
                className="w-full px-2.5 py-1.5 border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A] bg-white font-medium"
              >
                {VALID_MAINTENANCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-800 mb-1">
                Priority Level <span className="text-red-500">*</span>
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as MaintenancePriority)}
                className="w-full px-2.5 py-1.5 border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A] bg-white font-medium"
              >
                {VALID_MAINTENANCE_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 4: Schedule & Due Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Scheduled Service Date (Optional)
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-1.5 border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
              />
              <span className="text-[10px] text-neutral-400">
                Setting a date will set status to &quot;Scheduled&quot;
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Due / Expiry Date (Optional)
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`w-full px-3 py-1.5 border rounded focus:outline-none ${
                  errors.due_date ? 'border-red-500 bg-red-50/20' : 'border-neutral-300 focus:border-[#FF6A1A]'
                }`}
              />
              {errors.due_date && <p className="text-[11px] text-red-600 mt-1">{errors.due_date}</p>}
            </div>
          </div>

          {/* Section 5: Vendor & Estimated Cost */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Assigned Service Vendor
              </label>
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A] bg-white"
              >
                <option value="">— Internal / No Vendor —</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Service Cost (Est./Actual)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={serviceCost}
                onChange={(e) => setServiceCost(e.target.value)}
                className="w-full px-3 py-1.5 font-mono border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-2.5 py-1.5 font-mono border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A] bg-white"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD ($)</option>
                <option value="AUD">AUD ($)</option>
              </select>
            </div>
          </div>

          {/* Section 6: Additional Notes */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Internal Observations / Notes
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Asset warranty covers labor; replacement parts invoiced separately..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-1.5 border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-1.5 border border-neutral-300 hover:bg-neutral-50 text-neutral-700 font-medium rounded transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !assetId || !title}
              className="px-4 py-1.5 bg-[#FF6A1A] hover:bg-[#e55910] text-white font-semibold rounded transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {loading ? 'Saving...' : isEditing ? 'Save Work Order' : 'Create Work Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
