/**
 * AssetMT - Asset Depreciation Tab
 * Server-controlled depreciation calculation, schedule breakdown, and config
 * Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingDown,
  Settings,
  DollarSign,
  Calendar,
  AlertCircle,
  CheckCircle2,
  X,
  RefreshCw,
  Info,
} from 'lucide-react';
import {
  Asset,
  AssetDepreciation,
  ConfigureDepreciationInput,
  DepreciationSchedulePeriod,
  DepreciationMethod,
} from '../../../shared/types.ts';
import { calculateDepreciation } from '../../../shared/validation.ts';
import { api } from '../../lib/api.ts';

interface AssetDepreciationTabProps {
  token: string;
  asset: Asset;
  isTenantAdmin: boolean;
  onRefreshAsset?: () => void;
}

export const AssetDepreciationTab: React.FC<AssetDepreciationTabProps> = ({
  token,
  asset,
  isTenantAdmin,
  onRefreshAsset,
}) => {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<AssetDepreciation | null>(null);
  const [calculation, setCalculation] = useState<any | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState<ConfigureDepreciationInput>({
    method: 'STRAIGHT_LINE',
    salvage_value: 0,
    useful_life_months: 60,
    depreciation_start_date: asset.purchase_date || new Date().toISOString().split('T')[0],
    rate: 0.2,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadDepreciation = async () => {
    try {
      setLoading(true);
      const res = await api.getDepreciation(token, asset.id);
      if (res.success && res.data) {
        setConfig(res.data.config);
        setCalculation(res.data.calculation);
        if (res.data.config) {
          setFormData({
            method: res.data.config.method || 'STRAIGHT_LINE',
            salvage_value: res.data.config.salvage_value ?? 0,
            useful_life_months: res.data.config.useful_life_months ?? 60,
            depreciation_start_date: res.data.config.depreciation_start_date || asset.purchase_date || '',
            rate: res.data.config.rate ?? 0.2,
          });
        }
      }
    } catch (err) {
      console.error('Failed to load depreciation:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepreciation();
  }, [token, asset.id]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setFormError(null);
      const res = await api.configureDepreciation(token, asset.id, formData);
      if (res.success && res.data) {
        setConfig(res.data.config);
        setCalculation(res.data.calculation);
        setIsConfigModalOpen(false);
        if (onRefreshAsset) onRefreshAsset();
      } else {
        setFormError(res.error || 'Failed to save depreciation configuration');
      }
    } catch (err: any) {
      setFormError(err.message || 'Error configuring depreciation');
    } finally {
      setSubmitting(false);
    }
  };

  const cost = Number(asset.purchase_cost) || 0;
  const currentBookVal = calculation ? calculation.currentBookValue : cost;
  const accumDep = calculation ? calculation.accumulatedDepreciation : 0;
  const salvage = config ? Number(config.salvage_value) : 0;

  // Real-time calculation preview in modal
  const previewCalc = calculateDepreciation(
    cost,
    formData.salvage_value || 0,
    formData.useful_life_months || 60,
    formData.depreciation_start_date,
    formData.method,
    formData.rate
  );

  return (
    <div className="space-y-6">
      {/* Top Banner / Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-2xs">
          <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">
            Acquisition Cost
          </div>
          <div className="text-xl font-bold font-mono text-neutral-900 mt-1">
            {asset.currency} {cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-neutral-500 mt-1">
            Purchased {asset.purchase_date || 'N/A'}
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-2xs">
          <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">
            Accumulated Dep.
          </div>
          <div className="text-xl font-bold font-mono text-neutral-700 mt-1">
            {asset.currency} {accumDep.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-neutral-500 mt-1">
            {cost > 0 ? `${Math.round((accumDep / cost) * 100)}% written off` : '0%'}
          </div>
        </div>

        <div className="bg-white border border-emerald-200 bg-emerald-50/30 rounded-lg p-4 shadow-2xs">
          <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">
            Current Book Value
          </div>
          <div className="text-xl font-bold font-mono text-emerald-800 mt-1">
            {asset.currency} {currentBookVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-emerald-600 mt-1">
            Never below salvage ({asset.currency} {salvage.toLocaleString()})
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">
              Depreciation Method
            </div>
            <div className="text-xs font-bold text-neutral-800 mt-1">
              {config?.method === 'STRAIGHT_LINE'
                ? 'Straight Line'
                : config?.method === 'DECLINING_BALANCE'
                ? 'Declining Balance'
                : 'No Depreciation'}
            </div>
          </div>
          {isTenantAdmin && (
            <button
              onClick={() => setIsConfigModalOpen(true)}
              className="mt-2 text-xs font-semibold text-[#FF6A1A] hover:underline flex items-center gap-1 cursor-pointer self-start"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Configure Method</span>
            </button>
          )}
        </div>
      </div>

      {/* Schedule Table */}
      <div className="bg-white border border-neutral-200 rounded-lg shadow-2xs overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
          <div>
            <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
              Annual Depreciation Schedule
            </h3>
            <p className="text-[11px] text-neutral-500">
              Controlled server-side projection across useful asset life
            </p>
          </div>
          <button
            onClick={loadDepreciation}
            disabled={loading}
            className="text-xs text-neutral-500 hover:text-neutral-800 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Recalculate</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-100/60 text-neutral-600 uppercase font-semibold text-[10px] border-b border-neutral-200">
              <tr>
                <th className="px-4 py-2.5">Period</th>
                <th className="px-4 py-2.5">Fiscal Year</th>
                <th className="px-4 py-2.5 text-right">Beginning Book Value</th>
                <th className="px-4 py-2.5 text-right">Depreciation Expense</th>
                <th className="px-4 py-2.5 text-right">Accumulated Depreciation</th>
                <th className="px-4 py-2.5 text-right">Ending Book Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 font-mono text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-neutral-400 font-sans text-xs">
                    Calculating asset depreciation schedule...
                  </td>
                </tr>
              ) : !calculation || calculation.schedule.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-neutral-400 font-sans text-xs">
                    {config?.method === 'NO_DEPRECIATION'
                      ? 'No depreciation configured for this asset. Select Straight Line or Declining Balance to generate a schedule.'
                      : 'Asset acquisition cost is less than or equal to salvage value; no schedule generated.'}
                  </td>
                </tr>
              ) : (
                calculation.schedule.map((item: DepreciationSchedulePeriod) => (
                  <tr key={item.period} className="hover:bg-neutral-50/80 transition">
                    <td className="px-4 py-2.5 font-sans font-medium text-neutral-800">
                      {item.period_label}
                    </td>
                    <td className="px-4 py-2.5 text-neutral-600">{item.year}</td>
                    <td className="px-4 py-2.5 text-right text-neutral-700">
                      {asset.currency} {item.starting_book_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-neutral-900">
                      {asset.currency} {item.depreciation_expense.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5 text-right text-neutral-700">
                      {asset.currency} {item.accumulated_depreciation.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-emerald-700">
                      {asset.currency} {item.ending_book_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Configure Modal */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-neutral-200">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                  Asset Financials
                </span>
                <h3 className="text-base font-bold text-neutral-900">Configure Depreciation</h3>
              </div>
              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="w-7 h-7 rounded flex items-center justify-center hover:bg-neutral-100 text-neutral-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
                  {formError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Depreciation Method *
                </label>
                <select
                  value={formData.method}
                  onChange={(e) =>
                    setFormData({ ...formData, method: e.target.value as DepreciationMethod })
                  }
                  className="w-full p-2 border border-neutral-300 rounded bg-white font-medium"
                >
                  <option value="STRAIGHT_LINE">Straight Line</option>
                  <option value="DECLINING_BALANCE">Declining Balance</option>
                  <option value="NO_DEPRECIATION">No Depreciation</option>
                </select>
              </div>

              {formData.method !== 'NO_DEPRECIATION' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-neutral-700 mb-1">
                        Salvage / Residual Floor Value
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={cost}
                        value={formData.salvage_value ?? 0}
                        onChange={(e) =>
                          setFormData({ ...formData, salvage_value: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full p-2 border border-neutral-300 rounded font-mono"
                      />
                      <span className="text-[10px] text-neutral-400">Book value cannot drop below this</span>
                    </div>

                    <div>
                      <label className="block font-semibold text-neutral-700 mb-1">
                        Useful Life (Months) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="600"
                        value={formData.useful_life_months ?? 60}
                        onChange={(e) =>
                          setFormData({ ...formData, useful_life_months: parseInt(e.target.value) || 60 })
                        }
                        className="w-full p-2 border border-neutral-300 rounded font-mono"
                        required
                      />
                      <span className="text-[10px] text-neutral-400">
                        {Math.floor((formData.useful_life_months || 60) / 12)} years
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-neutral-700 mb-1">
                        Depreciation Start Date
                      </label>
                      <input
                        type="date"
                        value={formData.depreciation_start_date || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, depreciation_start_date: e.target.value })
                        }
                        className="w-full p-2 border border-neutral-300 rounded font-mono"
                      />
                    </div>

                    {formData.method === 'DECLINING_BALANCE' && (
                      <div>
                        <label className="block font-semibold text-neutral-700 mb-1">
                          Annual Rate (0.01 - 1.0)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max="1.0"
                          value={formData.rate ?? 0.2}
                          onChange={(e) =>
                            setFormData({ ...formData, rate: parseFloat(e.target.value) || 0.2 })
                          }
                          className="w-full p-2 border border-neutral-300 rounded font-mono"
                        />
                        <span className="text-[10px] text-neutral-400">e.g. 0.20 = 20% annual</span>
                      </div>
                    )}
                  </div>

                  {/* Live Preview Box */}
                  <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                    <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <Info className="w-3 h-3" /> Live Calculation Preview
                    </div>
                    <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
                      <div>
                        <span className="text-neutral-400 block text-[9px]">Original:</span>
                        <span className="font-semibold text-neutral-800">
                          {asset.currency} {cost.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block text-[9px]">Acc. Dep:</span>
                        <span className="font-semibold text-neutral-800">
                          {asset.currency} {previewCalc.accumulatedDepreciation.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block text-[9px]">Est Book Value:</span>
                        <span className="font-bold text-emerald-700">
                          {asset.currency} {previewCalc.currentBookValue.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="pt-3 border-t border-neutral-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-neutral-300 text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded bg-[#FF6A1A] hover:bg-[#e55a10] text-white font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
