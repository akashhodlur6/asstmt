/**
 * AssetMT - Asset Custom Fields Tab
 * Tenant-defined dynamic custom fields for assets (Text, Number, Date, Yes/No, Dropdown)
 * Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
 */

import React, { useState, useEffect } from 'react';
import {
  SlidersHorizontal,
  Plus,
  Save,
  CheckCircle2,
  AlertCircle,
  Calendar,
  X,
  RefreshCw,
} from 'lucide-react';
import {
  Asset,
  CustomFieldDefinition,
  CustomFieldType,
  CreateCustomFieldDefinitionInput,
} from '../../../shared/types.ts';
import { api } from '../../lib/api.ts';

interface AssetCustomFieldsTabProps {
  token: string;
  asset: Asset;
  isTenantAdmin: boolean;
}

export const AssetCustomFieldsTab: React.FC<AssetCustomFieldsTabProps> = ({
  token,
  asset,
  isTenantAdmin,
}) => {
  const [fields, setFields] = useState<Array<{ definition: CustomFieldDefinition; value: string }>>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isAddDefModalOpen, setIsAddDefModalOpen] = useState(false);

  // New Definition Form State
  const [defForm, setDefForm] = useState<CreateCustomFieldDefinitionInput>({
    field_name: '',
    field_type: 'Text',
    is_required: false,
    is_active: true,
    dropdown_choices: ['Option 1', 'Option 2'],
    display_order: 0,
  });
  const [dropdownChoicesText, setDropdownChoicesText] = useState('Option 1, Option 2');
  const [defSubmitting, setDefSubmitting] = useState(false);
  const [defError, setDefError] = useState<string | null>(null);

  const loadCustomFields = async () => {
    try {
      setLoading(true);
      const res = await api.getAssetCustomFields(token, asset.id);
      if (res.success && res.data) {
        setFields(res.data);
        const map: Record<string, string> = {};
        res.data.forEach((item) => {
          map[item.definition.id] = item.value || '';
        });
        setValues(map);
      }
    } catch (err) {
      console.error('Failed to load custom fields:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomFields();
  }, [token, asset.id]);

  const handleSaveValues = async () => {
    try {
      setSaving(true);
      setSaveSuccess(false);
      const payload = Object.entries(values).map(([field_definition_id, field_value]) => ({
        field_definition_id,
        field_value,
      }));

      const res = await api.saveAssetCustomFields(token, asset.id, payload);
      if (res.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save custom fields:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateDefinition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!defForm.field_name.trim()) {
      setDefError('Field name is required');
      return;
    }

    let choices: string[] = [];
    if (defForm.field_type === 'Dropdown') {
      choices = dropdownChoicesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (choices.length === 0) {
        setDefError('Dropdown fields require at least one choice');
        return;
      }
    }

    try {
      setDefSubmitting(true);
      setDefError(null);
      const res = await api.createCustomFieldDefinition(token, {
        ...defForm,
        dropdown_choices: choices,
      });

      if (res.success) {
        setIsAddDefModalOpen(false);
        setDefForm({
          field_name: '',
          field_type: 'Text',
          is_required: false,
          is_active: true,
          dropdown_choices: [],
          display_order: 0,
        });
        await loadCustomFields();
      } else {
        setDefError(res.error || 'Failed to create custom field definition');
      }
    } catch (err: any) {
      setDefError(err.message || 'Error creating custom field');
    } finally {
      setDefSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
            Custom Tenant Fields
          </h3>
          <p className="text-[11px] text-neutral-500">
            Organization-specific metadata definitions with strongly enforced typing
          </p>
        </div>

        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved successfully
            </span>
          )}
          {isTenantAdmin && (
            <button
              onClick={() => {
                setDefError(null);
                setIsAddDefModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 transition shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Define New Field</span>
            </button>
          )}
          {fields.length > 0 && isTenantAdmin && (
            <button
              onClick={handleSaveValues}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-[#FF6A1A] hover:bg-[#e55a10] text-white transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Field Values'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Fields Form Grid */}
      <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-2xs">
        {loading ? (
          <div className="py-8 text-center text-xs text-neutral-400">Loading custom fields...</div>
        ) : fields.length === 0 ? (
          <div className="py-8 text-center text-xs text-neutral-400">
            <SlidersHorizontal className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
            <p className="font-semibold text-neutral-700">No custom fields defined yet</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Tenant Admins can click "Define New Field" to configure organization-wide custom asset attributes.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map(({ definition: def }) => {
              const val = values[def.id] || '';
              return (
                <div key={def.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-neutral-800">
                      {def.field_name}
                      {def.is_required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                    <span className="text-[10px] text-neutral-400 font-mono">{def.field_type}</span>
                  </div>

                  {def.field_type === 'Text' && (
                    <input
                      type="text"
                      disabled={!isTenantAdmin}
                      value={val}
                      onChange={(e) => setValues({ ...values, [def.id]: e.target.value })}
                      placeholder={`Enter ${def.field_name.toLowerCase()}...`}
                      className="w-full text-xs p-2 border border-neutral-300 rounded bg-white focus:outline-none focus:border-[#FF6A1A] disabled:bg-neutral-50"
                    />
                  )}

                  {def.field_type === 'Number' && (
                    <input
                      type="number"
                      disabled={!isTenantAdmin}
                      value={val}
                      onChange={(e) => setValues({ ...values, [def.id]: e.target.value })}
                      className="w-full text-xs p-2 border border-neutral-300 rounded bg-white font-mono focus:outline-none focus:border-[#FF6A1A] disabled:bg-neutral-50"
                    />
                  )}

                  {def.field_type === 'Date' && (
                    <input
                      type="date"
                      disabled={!isTenantAdmin}
                      value={val}
                      onChange={(e) => setValues({ ...values, [def.id]: e.target.value })}
                      className="w-full text-xs p-2 border border-neutral-300 rounded bg-white font-mono focus:outline-none focus:border-[#FF6A1A] disabled:bg-neutral-50"
                    />
                  )}

                  {def.field_type === 'Yes/No' && (
                    <select
                      disabled={!isTenantAdmin}
                      value={val}
                      onChange={(e) => setValues({ ...values, [def.id]: e.target.value })}
                      className="w-full text-xs p-2 border border-neutral-300 rounded bg-white font-medium disabled:bg-neutral-50"
                    >
                      <option value="">Unset</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  )}

                  {def.field_type === 'Dropdown' && (
                    <select
                      disabled={!isTenantAdmin}
                      value={val}
                      onChange={(e) => setValues({ ...values, [def.id]: e.target.value })}
                      className="w-full text-xs p-2 border border-neutral-300 rounded bg-white font-medium disabled:bg-neutral-50"
                    >
                      <option value="">Select option</option>
                      {(def.dropdown_choices || []).map((choice) => (
                        <option key={choice} value={choice}>
                          {choice}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Define New Custom Field Modal */}
      {isAddDefModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-neutral-200">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-neutral-900">Define Custom Field</h3>
              <button
                onClick={() => setIsAddDefModalOpen(false)}
                className="w-7 h-7 rounded flex items-center justify-center hover:bg-neutral-100 text-neutral-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDefinition} className="p-5 space-y-4 text-xs">
              {defError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
                  {defError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Field Name *</label>
                <input
                  type="text"
                  value={defForm.field_name}
                  onChange={(e) => setDefForm({ ...defForm, field_name: e.target.value })}
                  placeholder="e.g. Asset Security Level, EPA Id, MAC Address"
                  className="w-full p-2 border border-neutral-300 rounded"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Field Type *</label>
                <select
                  value={defForm.field_type}
                  onChange={(e) =>
                    setDefForm({ ...defForm, field_type: e.target.value as CustomFieldType })
                  }
                  className="w-full p-2 border border-neutral-300 rounded bg-white font-medium"
                >
                  <option value="Text">Text</option>
                  <option value="Number">Number</option>
                  <option value="Date">Date</option>
                  <option value="Yes/No">Yes/No</option>
                  <option value="Dropdown">Dropdown</option>
                </select>
              </div>

              {defForm.field_type === 'Dropdown' && (
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Choices (comma-separated) *
                  </label>
                  <input
                    type="text"
                    value={dropdownChoicesText}
                    onChange={(e) => setDropdownChoicesText(e.target.value)}
                    placeholder="e.g. Low, Medium, High, Critical"
                    className="w-full p-2 border border-neutral-300 rounded"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="cf_required"
                  checked={defForm.is_required}
                  onChange={(e) => setDefForm({ ...defForm, is_required: e.target.checked })}
                  className="text-[#FF6A1A] focus:ring-[#FF6A1A] rounded"
                />
                <label htmlFor="cf_required" className="font-medium text-neutral-700 cursor-pointer">
                  Mark as Required Field
                </label>
              </div>

              <div className="pt-3 border-t border-neutral-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddDefModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-neutral-300 text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={defSubmitting}
                  className="px-4 py-1.5 rounded bg-[#FF6A1A] hover:bg-[#e55a10] text-white font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {defSubmitting ? 'Creating...' : 'Create Field'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
