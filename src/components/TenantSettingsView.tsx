/**
 * AssetMT - Tenant Settings & Branding Administration
 * Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
 * Sections: General, Branding, Asset Settings, Notifications, Security & Plan Quotas
 */

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building,
  Palette,
  Tags,
  Bell,
  Shield,
  Save,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Layers,
  Clock,
  Coins,
  Gauge,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import {
  TenantSettings,
  UpdateTenantSettingsInput,
  TenantUsageSummary,
  Category,
  Site,
} from '../../shared/types.ts';
import { canManageSettings } from '../../shared/permissions.ts';

interface TenantSettingsViewProps {
  token: string;
  currentUserRole: string;
  onNavigateToUsers?: () => void;
}

export const TenantSettingsView: React.FC<TenantSettingsViewProps> = ({
  token,
  currentUserRole,
  onNavigateToUsers,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'branding' | 'assets' | 'notifications' | 'security'>('general');
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [usage, setUsage] = useState<TenantUsageSummary | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form Fields
  const [companyName, setCompanyName] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD');

  const [accentColor, setAccentColor] = useState('#FF6A1A');
  const [logoUrl, setLogoUrl] = useState('');

  const [assetTagPrefix, setAssetTagPrefix] = useState('AST');
  const [assetTagNextNumber, setAssetTagNextNumber] = useState(1001);
  const [defaultCategoryId, setDefaultCategoryId] = useState('');
  const [defaultSiteId, setDefaultSiteId] = useState('');

  const [expiryReminderDays, setExpiryReminderDays] = useState('7, 30, 90');
  const [maintenanceReminderDays, setMaintenanceReminderDays] = useState('3, 7');
  const [lowStockAlert, setLowStockAlert] = useState(true);

  const [enforceMfa, setEnforceMfa] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(480);

  const canEdit = canManageSettings(currentUserRole);

  const loadSettingsAndUsage = async () => {
    setLoading(true);
    setError(null);
    try {
      const [settRes, useRes, catRes, siteRes] = await Promise.all([
        api.getTenantSettings(token),
        api.getTenantUsage(token),
        api.getCategories(token),
        api.getSites(token),
      ]);

      if (settRes.success && settRes.data) {
        const s = settRes.data;
        setSettings(s);
        setCompanyName(s.company_name || '');
        setCompanyCode(s.company_code || '');
        setTimezone(s.timezone || 'UTC');
        setDefaultCurrency(s.default_currency || 'USD');
        setDateFormat(s.date_format || 'YYYY-MM-DD');
        setAccentColor(s.accent_color || '#FF6A1A');
        setLogoUrl(s.logo_url || '');
        setAssetTagPrefix(s.asset_tag_prefix || 'AST');
        setAssetTagNextNumber(s.asset_tag_next_number || 1001);
        setDefaultCategoryId(s.default_category_id || '');
        setDefaultSiteId(s.default_site_id || '');
        setExpiryReminderDays(
          Array.isArray(s.expiry_reminder_days) ? s.expiry_reminder_days.join(', ') : '7, 30, 90'
        );
        setMaintenanceReminderDays(
          Array.isArray(s.maintenance_reminder_days) ? s.maintenance_reminder_days.join(', ') : '3, 7'
        );
        setLowStockAlert(s.low_stock_threshold_alert !== false);
        setEnforceMfa(Boolean(s.enforce_mfa));
        setSessionTimeout(s.session_timeout_minutes || 480);
      }

      if (useRes.success) setUsage(useRes.data);
      if (catRes.success) setCategories(catRes.data);
      if (siteRes.success) setSites(siteRes.data);
    } catch (err: any) {
      setError(err.message || 'Error loading tenant settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettingsAndUsage();
  }, [token]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const expDaysArr = expiryReminderDays
        .split(',')
        .map((x) => parseInt(x.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0);

      const maintDaysArr = maintenanceReminderDays
        .split(',')
        .map((x) => parseInt(x.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0);

      const payload: UpdateTenantSettingsInput = {
        company_name: companyName.trim(),
        company_code: companyCode.trim() || undefined,
        timezone,
        default_currency: defaultCurrency.trim().toUpperCase(),
        date_format: dateFormat,
        accent_color: accentColor,
        logo_url: logoUrl.trim() || null,
        asset_tag_prefix: assetTagPrefix.trim().toUpperCase(),
        asset_tag_next_number: Number(assetTagNextNumber),
        default_category_id: defaultCategoryId || null,
        default_site_id: defaultSiteId || null,
        expiry_reminder_days: expDaysArr.length > 0 ? expDaysArr : [7, 30, 90],
        maintenance_reminder_days: maintDaysArr.length > 0 ? maintDaysArr : [3, 7],
        low_stock_threshold_alert: lowStockAlert,
        enforce_mfa: enforceMfa,
        session_timeout_minutes: Number(sessionTimeout),
      };

      const res = await api.updateTenantSettings(token, payload);
      if (res.success) {
        setSettings(res.data);
        setSuccessMessage('Tenant settings updated successfully.');
      } else {
        setError(res.error || 'Failed to update tenant settings');
      }
    } catch (err: any) {
      setError(err.message || 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#FF6A1A] tracking-wider uppercase mb-1">
            <Settings className="w-4 h-4" />
            <span>Workspace Administration</span>
          </div>
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
            Tenant Settings & Preferences
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Configure organization metadata, default currencies, asset tagging numbering, reminder windows, and security parameters.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-4 py-2 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded shadow-xs inline-flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving Changes...' : 'Save Settings'}</span>
          </button>
        )}
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-700 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-700 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Plan & Quotas Card */}
      {usage && (
        <div className="p-4 bg-white rounded-lg border border-neutral-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-[#FF6A1A]" />
              <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                Current Subscription Plan: {usage.plan}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
              STATUS: {usage.status}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 bg-neutral-50 rounded border border-neutral-200/70">
              <div className="text-[10px] font-semibold text-neutral-500 uppercase">Assets Allocated</div>
              <div className="text-sm font-bold text-neutral-900 mt-0.5">
                {usage.assets.used} / {usage.assets.limit}
              </div>
              <div className="w-full bg-neutral-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="bg-[#FF6A1A] h-full"
                  style={{ width: `${Math.min(100, (usage.assets.used / usage.assets.limit) * 100)}%` }}
                />
              </div>
            </div>

            <div className="p-2.5 bg-neutral-50 rounded border border-neutral-200/70">
              <div className="text-[10px] font-semibold text-neutral-500 uppercase">Tenant Admins</div>
              <div className="text-sm font-bold text-neutral-900 mt-0.5">
                {usage.tenant_admins.used} / {usage.tenant_admins.limit}
              </div>
              <div className="text-[10px] text-neutral-400 mt-1">Included in Basic: 1 Admin</div>
            </div>

            <div className="p-2.5 bg-neutral-50 rounded border border-neutral-200/70">
              <div className="text-[10px] font-semibold text-neutral-500 uppercase">Technicians</div>
              <div className="text-sm font-bold text-neutral-900 mt-0.5">
                {usage.technicians.used} / {usage.technicians.limit}
              </div>
              <div className="text-[10px] text-neutral-400 mt-1">Included in Basic: 1 Technician</div>
            </div>

            <div className="p-2.5 bg-neutral-50 rounded border border-neutral-200/70">
              <div className="text-[10px] font-semibold text-neutral-500 uppercase">Employees</div>
              <div className="text-sm font-bold text-neutral-900 mt-0.5">
                {usage.employees.used} / ∞
              </div>
              <div className="text-[10px] text-emerald-600 mt-1 font-medium">Unlimited Custodians</div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-neutral-200 p-1 shadow-xs flex gap-1">
        {[
          { id: 'general', label: 'General', icon: Building },
          { id: 'branding', label: 'Branding & Logo', icon: Palette },
          { id: 'assets', label: 'Asset Tagging', icon: Tags },
          { id: 'notifications', label: 'Reminders & Alerts', icon: Bell },
          { id: 'security', label: 'Security & Access', icon: Shield },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2 px-3 rounded text-xs font-semibold inline-flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isActive
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <form onSubmit={handleSave} className="bg-white rounded-lg border border-neutral-200 p-6 shadow-xs space-y-6 text-xs">
        {/* 1. GENERAL */}
        {activeTab === 'general' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-neutral-900 pb-2 border-b border-neutral-100">
              Organization & Locale Configuration
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={!canEdit}
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-xs focus:outline-none focus:border-[#FF6A1A] disabled:bg-neutral-50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Company Code (Short Identifier)
                </label>
                <input
                  type="text"
                  value={companyCode}
                  onChange={(e) => setCompanyCode(e.target.value)}
                  disabled={!canEdit}
                  placeholder="e.g. ACME"
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-xs uppercase focus:outline-none focus:border-[#FF6A1A] disabled:bg-neutral-50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Default Currency
                </label>
                <input
                  type="text"
                  value={defaultCurrency}
                  onChange={(e) => setDefaultCurrency(e.target.value)}
                  disabled={!canEdit}
                  placeholder="USD"
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-xs uppercase focus:outline-none focus:border-[#FF6A1A] disabled:bg-neutral-50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  disabled={!canEdit}
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-xs focus:outline-none focus:border-[#FF6A1A] bg-white disabled:bg-neutral-50"
                >
                  <option value="UTC">UTC (Universal Coordinated Time)</option>
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                  <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                  <option value="America/Denver">America/Denver (MST/MDT)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Date Format
                </label>
                <select
                  value={dateFormat}
                  onChange={(e) => setDateFormat(e.target.value)}
                  disabled={!canEdit}
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-xs focus:outline-none focus:border-[#FF6A1A] bg-white disabled:bg-neutral-50"
                >
                  <option value="YYYY-MM-DD">YYYY-MM-DD (ISO International)</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY (US Standard)</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY (European / UK)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 2. BRANDING & LOGO */}
        {activeTab === 'branding' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-neutral-900 pb-2 border-b border-neutral-100">
              Tenant Identity & Branding
            </h3>

            <div className="p-3.5 bg-neutral-50 rounded border border-neutral-200 text-xs text-neutral-600 flex items-start gap-2.5">
              <Palette className="w-4 h-4 text-[#FF6A1A] shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-neutral-900">Brand Hierarchy:</span>{' '}
                AssetMT represents the core SaaS platform engine by Akshigo Tech. Tenant branding allows custom organizational styling and logo presentation on header bars and exported labels.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Tenant Accent Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    disabled={!canEdit}
                    className="w-9 h-9 p-0.5 border border-neutral-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    disabled={!canEdit}
                    className="flex-1 px-3 py-2 border border-neutral-300 rounded text-xs font-mono uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Company Logo Upload (Private Storage)
                </label>
                <div className="flex items-center gap-3">
                  {logoUrl && (
                    <img
                      src={logoUrl}
                      alt="Company Logo Preview"
                      className="w-10 h-10 object-contain rounded border border-neutral-200 bg-neutral-50 p-1"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  )}
                  <label className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded cursor-pointer transition-colors inline-flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Logo Image</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      disabled={!canEdit}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            setSaving(true);
                            const res = await api.uploadTenantLogoFile(token, file);
                            if (res.success && res.data) {
                              setLogoUrl(res.data.logo_url || '');
                              setSuccessMessage('Logo uploaded and stored in private bucket.');
                            } else {
                              setError(res.error || 'Failed to upload logo');
                            }
                          } catch (err: any) {
                            setError(err.message || 'Error uploading logo');
                          } finally {
                            setSaving(false);
                          }
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
                <span className="text-[10px] text-neutral-400 mt-1 block">
                  Supported formats: PNG, JPG, WebP, SVG (Max 2MB).
                </span>
              </div>
            </div>

            {/* Storage Adapter Status */}
            <div className="p-4 bg-emerald-50/60 rounded-lg border border-emerald-200 text-xs text-emerald-900 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>Private Binary Storage Layer Active</span>
              </div>
              <p className="text-[11px] leading-relaxed text-emerald-800">
                Binary object storage engine active with tenant-scoped isolation. Logos and document attachments are stored securely without exposing private credentials.
              </p>
            </div>
          </div>
        )}

        {/* 3. ASSET TAGGING & DEFAULTS */}
        {activeTab === 'assets' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-neutral-900 pb-2 border-b border-neutral-100">
              Asset Tagging & Classification Defaults
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Asset Tag Prefix <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={assetTagPrefix}
                  onChange={(e) => setAssetTagPrefix(e.target.value.toUpperCase())}
                  disabled={!canEdit}
                  placeholder="AST"
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-xs uppercase focus:outline-none focus:border-[#FF6A1A] disabled:bg-neutral-50"
                />
                <span className="text-[10px] text-neutral-400 mt-1 block">
                  Prefix used when auto-generating asset barcodes (e.g. {assetTagPrefix}-1001)
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Next Asset Tag Number
                </label>
                <input
                  type="number"
                  min={1}
                  value={assetTagNextNumber}
                  onChange={(e) => setAssetTagNextNumber(parseInt(e.target.value, 10) || 1)}
                  disabled={!canEdit}
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-xs focus:outline-none focus:border-[#FF6A1A] disabled:bg-neutral-50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Default Category for New Assets
                </label>
                <select
                  value={defaultCategoryId}
                  onChange={(e) => setDefaultCategoryId(e.target.value)}
                  disabled={!canEdit}
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-xs focus:outline-none focus:border-[#FF6A1A] bg-white disabled:bg-neutral-50"
                >
                  <option value="">None (User must select)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Default Primary Site
                </label>
                <select
                  value={defaultSiteId}
                  onChange={(e) => setDefaultSiteId(e.target.value)}
                  disabled={!canEdit}
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-xs focus:outline-none focus:border-[#FF6A1A] bg-white disabled:bg-neutral-50"
                >
                  <option value="">None (User must select)</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 4. NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-neutral-900 pb-2 border-b border-neutral-100">
              Automated Reminders & Expiry Horizons
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Compliance Expiry Reminder Windows (Days Before Expiry)
                </label>
                <input
                  type="text"
                  value={expiryReminderDays}
                  onChange={(e) => setExpiryReminderDays(e.target.value)}
                  disabled={!canEdit}
                  placeholder="7, 30, 90"
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-xs focus:outline-none focus:border-[#FF6A1A] disabled:bg-neutral-50"
                />
                <span className="text-[10px] text-neutral-400 mt-1 block">
                  Comma-separated list of day horizons for contract, warranty, insurance, and lease alerts.
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Maintenance Due Reminder Windows (Days)
                </label>
                <input
                  type="text"
                  value={maintenanceReminderDays}
                  onChange={(e) => setMaintenanceReminderDays(e.target.value)}
                  disabled={!canEdit}
                  placeholder="3, 7"
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-xs focus:outline-none focus:border-[#FF6A1A] disabled:bg-neutral-50"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lowStockAlert}
                    onChange={(e) => setLowStockAlert(e.target.checked)}
                    disabled={!canEdit}
                    className="rounded text-[#FF6A1A] focus:ring-0"
                  />
                  <span className="text-xs text-neutral-800 font-medium">
                    Trigger system dashboard alerts when consumable inventory falls below re-order point
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* 5. SECURITY & ACCESS */}
        {activeTab === 'security' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-neutral-900 pb-2 border-b border-neutral-100">
              Tenant Security & Session Policy
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Session Timeout (Minutes of Inactivity)
                </label>
                <input
                  type="number"
                  min={15}
                  max={1440}
                  value={sessionTimeout}
                  onChange={(e) => setSessionTimeout(parseInt(e.target.value, 10) || 480)}
                  disabled={!canEdit}
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-xs focus:outline-none focus:border-[#FF6A1A] disabled:bg-neutral-50"
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enforceMfa}
                    onChange={(e) => setEnforceMfa(e.target.checked)}
                    disabled={!canEdit}
                    className="rounded text-[#FF6A1A] focus:ring-0"
                  />
                  <span className="text-xs text-neutral-800 font-medium">
                    Enforce Multi-Factor Authentication (MFA) for Tenant Admins
                  </span>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-100 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-neutral-800">Tenant User Access Registry</div>
                <div className="text-[11px] text-neutral-500">
                  Manage active member logins and revoke credentials in real-time.
                </div>
              </div>
              {onNavigateToUsers && (
                <button
                  type="button"
                  onClick={onNavigateToUsers}
                  className="px-3.5 py-1.5 border border-neutral-300 hover:bg-neutral-50 text-neutral-700 font-semibold rounded text-xs cursor-pointer"
                >
                  Open Users Management
                </button>
              )}
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
