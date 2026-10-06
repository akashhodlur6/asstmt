/**
 * AssetMT - Asset Details & Activity Audit View
 * AssetTiger tabbed layout with real database audit trail & Phase 2B Custody workflows.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import {
  Asset,
  AssetAssignment,
  AssetEvent,
  Employee,
  Location,
  Site,
  MaintenanceRecord,
  AssetReservation,
  AssetLease,
  AssetLocationHistory,
  AssetDisposal,
  AssetRelationship,
  Vendor,
  CreateReservationInput,
  CreateLeaseInput,
  ReturnLeaseInput,
  MoveAssetInput,
  DisposeAssetInput,
  CreateAssetRelationshipInput,
} from '../../shared/types.ts';
import { MaintenanceDetailModal } from './MaintenanceDetailModal.tsx';
import { MaintenanceFormModal } from './MaintenanceFormModal.tsx';
import { BarcodeLabelModal } from './BarcodeLabelModal.tsx';
import {
  validateCheckout,
  validateCheckin,
  validateTransfer,
  validateReservation,
  validateLease,
  validateReturnLease,
  validateMoveAsset,
  validateDisposeAsset,
  validateAssetRelationship,
} from '../../shared/validation.ts';
import {
  ArrowLeft,
  Edit3,
  Calendar,
  DollarSign,
  Tag,
  Building2,
  Clock,
  ShieldAlert,
  History,
  Info,
  CalendarClock,
  Wrench,
  TrendingDown,
  Paperclip,
  UserCheck,
  ArrowRightLeft,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
  QrCode,
  MapPin,
  Trash2,
  Link2,
  FileText,
  AlertOctagon,
  ExternalLink,
  ShieldCheck,
  FileCheck2,
  KeyRound,
  SlidersHorizontal,
} from 'lucide-react';
import { AssetDepreciationTab } from './asset-detail-tabs/AssetDepreciationTab.tsx';
import { AssetWarrantyTab } from './asset-detail-tabs/AssetWarrantyTab.tsx';
import { AssetFinancialTab } from './asset-detail-tabs/AssetFinancialTab.tsx';
import { AssetDocumentsTab } from './asset-detail-tabs/AssetDocumentsTab.tsx';
import { AssetCustomFieldsTab } from './asset-detail-tabs/AssetCustomFieldsTab.tsx';
import { AssetContractsTab } from './asset-detail-tabs/AssetContractsTab.tsx';
import { AssetInsuranceTab } from './asset-detail-tabs/AssetInsuranceTab.tsx';
import { AssetLicensesTab } from './asset-detail-tabs/AssetLicensesTab.tsx';

interface AssetDetailViewProps {
  assetId: string;
  onNavigate: (view: string, assetId?: string) => void;
}

export const AssetDetailView: React.FC<AssetDetailViewProps> = ({ assetId, onNavigate }) => {
  const { token, role } = useAuth();
  const isTenantAdmin = role === 'TENANT_ADMIN';

  const [asset, setAsset] = useState<Asset | null>(null);
  const [history, setHistory] = useState<AssetEvent[]>([]);
  const [assignments, setAssignments] = useState<AssetAssignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [activeTab, setActiveTab] = useState<
    | 'details'
    | 'financial'
    | 'depreciation'
    | 'warranty'
    | 'contracts'
    | 'insurance'
    | 'licenses'
    | 'documents'
    | 'custom-fields'
    | 'custody'
    | 'maintenance'
    | 'reservations'
    | 'leases'
    | 'movement'
    | 'linked'
    | 'history'
  >('details');
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [activeWorkOrderId, setActiveWorkOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Phase 4 Data States
  const [reservations, setReservations] = useState<AssetReservation[]>([]);
  const [leases, setLeases] = useState<AssetLease[]>([]);
  const [locationHistory, setLocationHistory] = useState<AssetLocationHistory[]>([]);
  const [relationships, setRelationships] = useState<AssetRelationship[]>([]);
  const [disposal, setDisposal] = useState<AssetDisposal | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [allAssets, setAllAssets] = useState<Asset[]>([]);

  // Phase 4 Modal States
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showDisposeModal, setShowDisposeModal] = useState(false);
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [showLeaseModal, setShowLeaseModal] = useState(false);
  const [showReturnLeaseModal, setShowReturnLeaseModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [activeLeaseToReturn, setActiveLeaseToReturn] = useState<AssetLease | null>(null);

  // Phase 4 Form States
  const [moveForm, setMoveForm] = useState<Partial<MoveAssetInput>>({});
  const [disposeForm, setDisposeForm] = useState<Partial<DisposeAssetInput>>({
    disposal_date: new Date().toISOString().split('T')[0],
    disposal_method: 'Recycled',
    reason: '',
  });
  const [reserveForm, setReserveForm] = useState<Partial<CreateReservationInput>>({
    reserved_from: new Date().toISOString().split('T')[0],
    reserved_until: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
  });
  const [leaseForm, setLeaseForm] = useState<Partial<CreateLeaseInput>>({
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
    cost_interval: 'Monthly',
  });
  const [returnLeaseForm, setReturnLeaseForm] = useState<Partial<ReturnLeaseInput>>({
    return_date: new Date().toISOString().split('T')[0],
    return_condition: 'Good',
  });
  const [linkForm, setLinkForm] = useState<Partial<CreateAssetRelationshipInput>>({
    relationship_type: 'Component Of',
  });
  const [phase4Errors, setPhase4Errors] = useState<Record<string, string>>({});
  const [phase4Loading, setPhase4Loading] = useState(false);

  // Modal States
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Checkout Form State
  const [checkoutEmployeeId, setCheckoutEmployeeId] = useState('');
  const [checkoutDate, setCheckoutDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [checkoutCondition, setCheckoutCondition] = useState('Good');
  const [checkoutNotes, setCheckoutNotes] = useState('');

  // Checkin Form State
  const [checkinDate, setCheckinDate] = useState(new Date().toISOString().split('T')[0]);
  const [checkinCondition, setCheckinCondition] = useState('Good');
  const [destinationSiteId, setDestinationSiteId] = useState('');
  const [destinationLocationId, setDestinationLocationId] = useState('');
  const [checkinNotes, setCheckinNotes] = useState('');

  // Transfer Form State
  const [transferEmployeeId, setTransferEmployeeId] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [transferCondition, setTransferCondition] = useState('Good');
  const [transferNotes, setTransferNotes] = useState('');

  // Search filter inside modal employee dropdowns
  const [empSearch, setEmpSearch] = useState('');

  const fetchAssetDetails = useCallback(async () => {
    if (!token || !assetId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.getAsset(token, assetId);
      if (res.success) {
        setAsset(res.data);
        setHistory(res.history);
        if ((res as unknown as { assignments?: AssetAssignment[] }).assignments) {
          setAssignments((res as unknown as { assignments: AssetAssignment[] }).assignments);
        }
      }

      // Parallel fetch for assignments, maintenance, reservations, leases, movement, relations, disposal
      const [asgnRes, maintRes, resvRes, leaseRes, locRes, relRes, dispRes] = await Promise.all([
        api.getAssetAssignments(token, assetId).catch(() => null),
        api.getAssetMaintenance(token, assetId).catch(() => null),
        api.getAssetReservations(token, assetId).catch(() => null),
        api.getAssetLeases(token, assetId).catch(() => null),
        api.getAssetLocationHistory(token, assetId).catch(() => null),
        api.getAssetRelationships(token, assetId).catch(() => null),
        api.getAssetDisposal(token, assetId).catch(() => null),
      ]);

      if (asgnRes?.success) setAssignments(asgnRes.data);
      if (maintRes?.success) setMaintenanceRecords(maintRes.data);
      if (resvRes?.success) setReservations(resvRes.data);
      if (leaseRes?.success) setLeases(leaseRes.data);
      if (locRes?.success) setLocationHistory(locRes.data);
      if (relRes?.success) setRelationships(relRes.data);
      if (dispRes?.success) setDisposal(dispRes.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading asset record');
    } finally {
      setLoading(false);
    }
  }, [token, assetId]);

  useEffect(() => {
    fetchAssetDetails();
  }, [fetchAssetDetails]);

  // Load active employees, sites/locations, vendors, and all assets for dropdowns
  useEffect(() => {
    if (!token) return;
    api.getEmployees(token, { limit: 100 }).then((res) => {
      if (res.success) setEmployees(res.data);
    }).catch(() => {});
    api.getSites(token).then((res) => {
      if (res.success) setSites(res.data);
    }).catch(() => {});
    api.getLocations(token).then((res) => {
      if (res.success) setLocations(res.data);
    }).catch(() => {});
    api.getVendors(token).then((res) => {
      if (res.success) setVendors(res.data);
    }).catch(() => {});
    api.getAssets(token, { limit: 100 }).then((res) => {
      if (res.success) setAllAssets(res.data);
    }).catch(() => {});
  }, [token]);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const formatCost = (val?: number | null, curr = 'USD') => {
    if (val === null || val === undefined) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: 2,
    }).format(Number(val));
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'Available':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'Assigned':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'Under Repair':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'Retired':
        return 'text-neutral-600 bg-neutral-100 border-neutral-200';
      case 'Disposed':
        return 'text-red-700 bg-red-50 border-red-200';
      default:
        return 'text-neutral-600 bg-neutral-100 border-neutral-200';
    }
  };

  const calculateDaysInCustody = (checkedOutAt: string, checkedInAt?: string | null) => {
    const start = new Date(checkedOutAt).getTime();
    const end = checkedInAt ? new Date(checkedInAt).getTime() : Date.now();
    const diffDays = Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
    if (diffDays === 0) {
      const diffHours = Math.max(0, Math.floor((end - start) / (1000 * 60 * 60)));
      return `${diffHours} hour${diffHours === 1 ? '' : 's'}`;
    }
    return `${diffDays} day${diffDays === 1 ? '' : 's'}`;
  };

  const activeAssignment = assignments.find((a) => !a.checked_in_at) || asset?.current_assignment || null;
  const activeEmployees = employees.filter((e) => e.is_active);

  // 1. Handle Check Out Submit
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !asset) return;
    setModalError(null);

    const validation = validateCheckout({
      employee_id: checkoutEmployeeId,
      checked_out_at: checkoutDate,
      expected_return_at: expectedReturnDate || undefined,
    });

    if (!validation.isValid) {
      setModalError(Object.values(validation.errors)[0]);
      return;
    }

    try {
      setModalLoading(true);
      const res = await api.checkoutAsset(token, asset.id, {
        employee_id: checkoutEmployeeId,
        checked_out_at: new Date(checkoutDate).toISOString(),
        expected_return_at: expectedReturnDate ? new Date(expectedReturnDate).toISOString() : null,
        condition: checkoutCondition,
        notes: checkoutNotes,
      });

      if (res.success) {
        setShowCheckoutModal(false);
        setCheckoutEmployeeId('');
        setExpectedReturnDate('');
        setCheckoutNotes('');
        await fetchAssetDetails();
        setActiveTab('custody');
      }
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Failed to check out asset');
    } finally {
      setModalLoading(false);
    }
  };

  // 2. Handle Check In Submit
  const handleCheckinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !asset) return;
    setModalError(null);

    const validation = validateCheckin({
      checked_in_at: checkinDate,
    });

    if (!validation.isValid) {
      setModalError(Object.values(validation.errors)[0]);
      return;
    }

    try {
      setModalLoading(true);
      const res = await api.checkinAsset(token, asset.id, {
        checked_in_at: new Date(checkinDate).toISOString(),
        condition: checkinCondition,
        site_id: destinationSiteId || null,
        location_id: destinationLocationId || null,
        notes: checkinNotes,
      });

      if (res.success) {
        setShowCheckinModal(false);
        setCheckinNotes('');
        setDestinationSiteId('');
        setDestinationLocationId('');
        await fetchAssetDetails();
        setActiveTab('custody');
      }
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Failed to check in asset');
    } finally {
      setModalLoading(false);
    }
  };

  // 3. Handle Transfer Submit
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !asset) return;
    setModalError(null);

    const validation = validateTransfer(
      { new_employee_id: transferEmployeeId, transfer_at: transferDate },
      activeAssignment?.employee_id
    );

    if (!validation.isValid) {
      setModalError(Object.values(validation.errors)[0]);
      return;
    }

    try {
      setModalLoading(true);
      const res = await api.transferAsset(token, asset.id, {
        new_employee_id: transferEmployeeId,
        transfer_at: new Date(transferDate).toISOString(),
        condition: transferCondition,
        notes: transferNotes,
      });

      if (res.success) {
        setShowTransferModal(false);
        setTransferEmployeeId('');
        setTransferNotes('');
        await fetchAssetDetails();
        setActiveTab('custody');
      }
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Failed to transfer asset');
    } finally {
      setModalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-neutral-400">
        Loading asset record #{assetId}...
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-4">
        <button
          onClick={() => onNavigate('assets')}
          className="text-xs text-neutral-500 hover:text-neutral-800 inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Assets
        </button>
        <div className="p-4 bg-red-50 border border-red-200 text-xs text-red-700 rounded flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{error || 'Asset record could not be found or access is denied.'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 select-text font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Header Card */}
      <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <button
              onClick={() => onNavigate('assets')}
              className="text-xs text-neutral-500 hover:text-neutral-800 inline-flex items-center gap-1 font-medium transition-colors mb-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Asset Registry</span>
            </button>

            <div className="flex items-center gap-3">
              <span className="font-mono text-xl font-bold tracking-tight text-neutral-900 bg-neutral-100 px-2.5 py-1 rounded">
                {asset.asset_tag}
              </span>
              <span
                className={`text-xs px-2.5 py-1 rounded font-medium border ${getStatusBadge(
                  asset.status
                )}`}
              >
                {asset.status}
              </span>
            </div>

            <h1 className="text-lg font-bold text-neutral-900">
              {asset.name}
            </h1>

            {/* Unboxed Metadata Line with Typographic Separator */}
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <span>{asset.category?.name || 'Uncategorized'}</span>
              <span aria-hidden="true">·</span>
              <span>
                {asset.site?.name ? `${asset.site.name}` : 'No Site'}
                {asset.location?.name ? ` / ${asset.location.name}` : ''}
              </span>
              <span aria-hidden="true">·</span>
              <span>Added {formatDate(asset.created_at)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {asset.status === 'Available' && isTenantAdmin && (
              <button
                type="button"
                onClick={() => {
                  setModalError(null);
                  setCheckoutDate(new Date().toISOString().split('T')[0]);
                  setShowCheckoutModal(true);
                }}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Check Out / Assign</span>
              </button>
            )}

            {asset.status === 'Assigned' && isTenantAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setModalError(null);
                    setCheckinDate(new Date().toISOString().split('T')[0]);
                    setShowCheckinModal(true);
                  }}
                  className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-900 text-white text-xs font-semibold rounded transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Check In</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalError(null);
                    setTransferDate(new Date().toISOString().split('T')[0]);
                    setShowTransferModal(true);
                  }}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Transfer</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => onNavigate('asset-edit', asset.id)}
              className="px-3.5 py-2 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold rounded transition-colors inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-neutral-500" />
              <span>Edit Details</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation Bar */}
      <div className="border-b border-neutral-200 flex items-center gap-1 text-xs font-medium select-none overflow-x-auto">
        <button
          onClick={() => setActiveTab('details')}
          className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'details'
              ? 'border-[#FF6A1A] text-[#FF6A1A] font-semibold'
              : 'border-transparent text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Info className="w-3.5 h-3.5" />
          <span>Asset Details</span>
        </button>

        <button
          onClick={() => setActiveTab('custody')}
          className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'custody'
              ? 'border-[#FF6A1A] text-[#FF6A1A] font-semibold'
              : 'border-transparent text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <CalendarClock className="w-3.5 h-3.5" />
          <span>Custody & Checkouts</span>
          {activeAssignment && (
            <span className="ml-1 px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded text-[10px] font-mono">
              Assigned
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'history'
              ? 'border-[#FF6A1A] text-[#FF6A1A] font-semibold'
              : 'border-transparent text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Activity History</span>
          <span className="ml-1 px-1.5 py-0.2 bg-neutral-100 text-neutral-600 rounded text-[10px] font-mono">
            {history.length}
          </span>
        </button>

        {/* Tab 3: Maintenance */}
        <button
          onClick={() => setActiveTab('maintenance')}
          className={`px-3 py-2.5 border-b-2 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === 'maintenance'
              ? 'border-[#FF6A1A] text-[#FF6A1A] font-semibold'
              : 'border-transparent text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>Maintenance</span>
          <span className="ml-1 px-1.5 py-0.2 bg-neutral-100 text-neutral-600 rounded text-[10px] font-mono">
            {maintenanceRecords.length}
          </span>
        </button>

        {/* Phase 5 Tabs */}
        <button
          onClick={() => setActiveTab('financial')}
          className={`px-3 py-2.5 border-b-2 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === 'financial'
              ? 'border-[#FF6A1A] text-[#FF6A1A] font-semibold'
              : 'border-transparent text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>Financial</span>
        </button>

        <button
          onClick={() => setActiveTab('depreciation')}
          className={`px-3 py-2.5 border-b-2 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === 'depreciation'
              ? 'border-[#FF6A1A] text-[#FF6A1A] font-semibold'
              : 'border-transparent text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <TrendingDown className="w-3.5 h-3.5" />
          <span>Depreciation</span>
        </button>

        <button
          onClick={() => setActiveTab('warranty')}
          className={`px-3 py-2.5 border-b-2 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === 'warranty'
              ? 'border-[#FF6A1A] text-[#FF6A1A] font-semibold'
              : 'border-transparent text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Warranty</span>
        </button>

        <button
          onClick={() => setActiveTab('contracts')}
          className={`px-3 py-2.5 border-b-2 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === 'contracts'
              ? 'border-[#FF6A1A] text-[#FF6A1A] font-semibold'
              : 'border-transparent text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <FileCheck2 className="w-3.5 h-3.5" />
          <span>Contracts</span>
        </button>

        <button
          onClick={() => setActiveTab('insurance')}
          className={`px-3 py-2.5 border-b-2 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === 'insurance'
              ? 'border-[#FF6A1A] text-[#FF6A1A] font-semibold'
              : 'border-transparent text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Insurance</span>
        </button>

        <button
          onClick={() => setActiveTab('licenses')}
          className={`px-3 py-2.5 border-b-2 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === 'licenses'
              ? 'border-[#FF6A1A] text-[#FF6A1A] font-semibold'
              : 'border-transparent text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Licenses</span>
        </button>

        <button
          onClick={() => setActiveTab('documents')}
          className={`px-3 py-2.5 border-b-2 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === 'documents'
              ? 'border-[#FF6A1A] text-[#FF6A1A] font-semibold'
              : 'border-transparent text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Paperclip className="w-3.5 h-3.5" />
          <span>Documents</span>
        </button>

        <button
          onClick={() => setActiveTab('custom-fields')}
          className={`px-3 py-2.5 border-b-2 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === 'custom-fields'
              ? 'border-[#FF6A1A] text-[#FF6A1A] font-semibold'
              : 'border-transparent text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Custom Fields</span>
        </button>
      </div>

      {/* Phase 5 Subtab Contents */}
      {activeTab === 'financial' && (
        <AssetFinancialTab
          token={token!}
          asset={asset}
          isTenantAdmin={isTenantAdmin}
          onRefreshAsset={fetchAssetDetails}
        />
      )}

      {activeTab === 'depreciation' && (
        <AssetDepreciationTab
          token={token!}
          asset={asset}
          isTenantAdmin={isTenantAdmin}
          onRefreshAsset={fetchAssetDetails}
        />
      )}

      {activeTab === 'warranty' && (
        <AssetWarrantyTab
          token={token!}
          asset={asset}
          isTenantAdmin={isTenantAdmin}
          onRefreshAsset={fetchAssetDetails}
        />
      )}

      {activeTab === 'contracts' && (
        <AssetContractsTab
          token={token!}
          asset={asset}
          isTenantAdmin={isTenantAdmin}
        />
      )}

      {activeTab === 'insurance' && (
        <AssetInsuranceTab
          token={token!}
          asset={asset}
          isTenantAdmin={isTenantAdmin}
        />
      )}

      {activeTab === 'licenses' && (
        <AssetLicensesTab
          token={token!}
          asset={asset}
          isTenantAdmin={isTenantAdmin}
        />
      )}

      {activeTab === 'documents' && (
        <AssetDocumentsTab
          token={token!}
          asset={asset}
          isTenantAdmin={isTenantAdmin}
        />
      )}

      {activeTab === 'custom-fields' && (
        <AssetCustomFieldsTab
          token={token!}
          asset={asset}
          isTenantAdmin={isTenantAdmin}
        />
      )}

      {/* Tab 1: Details View */}
      {activeTab === 'details' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Asset Core Details */}
          <div className="bg-white border border-neutral-200 rounded-lg p-6 space-y-4 shadow-2xs">
            <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider border-b border-neutral-100 pb-2 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-neutral-400" />
              <span>Asset Identification</span>
            </h2>

            <dl className="grid grid-cols-2 gap-y-3 text-xs">
              <dt className="text-neutral-500">Asset Tag</dt>
              <dd className="font-mono font-semibold text-neutral-900">{asset.asset_tag}</dd>

              <dt className="text-neutral-500">Description</dt>
              <dd className="text-neutral-800 font-medium">{asset.name}</dd>

              <dt className="text-neutral-500">Category</dt>
              <dd className="text-neutral-800">{asset.category?.name || '—'}</dd>

              <dt className="text-neutral-500">Serial Number</dt>
              <dd className="font-mono text-neutral-800">{asset.serial_number || '—'}</dd>

              <dt className="text-neutral-500">Manufacturer</dt>
              <dd className="text-neutral-800">{asset.manufacturer || '—'}</dd>

              <dt className="text-neutral-500">Model</dt>
              <dd className="text-neutral-800">{asset.model || '—'}</dd>

              <dt className="text-neutral-500">Status</dt>
              <dd className="font-semibold text-neutral-900">{asset.status}</dd>
            </dl>
          </div>

          {/* Card 2: Location & Placement */}
          <div className="bg-white border border-neutral-200 rounded-lg p-6 space-y-4 shadow-2xs">
            <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider border-b border-neutral-100 pb-2 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-neutral-400" />
              <span>Location & Placement</span>
            </h2>

            <dl className="grid grid-cols-2 gap-y-3 text-xs">
              <dt className="text-neutral-500">Facility / Site</dt>
              <dd className="text-neutral-800 font-medium">{asset.site?.name || '—'}</dd>

              <dt className="text-neutral-500">Site Address</dt>
              <dd className="text-neutral-600">{asset.site?.address || '—'}</dd>

              <dt className="text-neutral-500">Sub-Location</dt>
              <dd className="text-neutral-800 font-medium">{asset.location?.name || '—'}</dd>

              <dt className="text-neutral-500">Location Notes</dt>
              <dd className="text-neutral-600">{asset.location?.description || '—'}</dd>
            </dl>
          </div>

          {/* Card 3: Financial & Procurement */}
          <div className="bg-white border border-neutral-200 rounded-lg p-6 space-y-4 shadow-2xs">
            <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider border-b border-neutral-100 pb-2 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-neutral-400" />
              <span>Financial & Warranty</span>
            </h2>

            <dl className="grid grid-cols-2 gap-y-3 text-xs">
              <dt className="text-neutral-500">Purchase Date</dt>
              <dd className="font-mono tabular-nums text-neutral-800">
                {formatDate(asset.purchase_date)}
              </dd>

              <dt className="text-neutral-500">Purchase Cost</dt>
              <dd className="font-mono tabular-nums font-semibold text-neutral-900">
                {formatCost(asset.purchase_cost, asset.currency)}
              </dd>

              <dt className="text-neutral-500">Currency</dt>
              <dd className="font-mono text-neutral-800">{asset.currency}</dd>

              <dt className="text-neutral-500">Warranty Expiration</dt>
              <dd className="font-mono tabular-nums text-neutral-800">
                {formatDate(asset.warranty_expiry)}
              </dd>
            </dl>
          </div>

          {/* Card 4: Metadata & Notes */}
          <div className="bg-white border border-neutral-200 rounded-lg p-6 space-y-4 shadow-2xs">
            <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider border-b border-neutral-100 pb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              <span>Record Metadata</span>
            </h2>

            <dl className="grid grid-cols-2 gap-y-3 text-xs">
              <dt className="text-neutral-500">Record ID</dt>
              <dd className="font-mono text-[11px] text-neutral-500 select-all">{asset.id}</dd>

              <dt className="text-neutral-500">Registered</dt>
              <dd className="font-mono tabular-nums text-neutral-600">
                {formatTimestamp(asset.created_at)}
              </dd>

              <dt className="text-neutral-500">Last Modified</dt>
              <dd className="font-mono tabular-nums text-neutral-600">
                {formatTimestamp(asset.updated_at)}
              </dd>

              <dt className="text-neutral-500">Internal Notes</dt>
              <dd className="text-neutral-700 italic col-span-2 pt-1 border-t border-neutral-100">
                {asset.notes || 'No notes added for this asset.'}
              </dd>
            </dl>
          </div>
        </div>
      )}

      {/* Tab 2: Custody & Checkouts */}
      {activeTab === 'custody' && (
        <div className="space-y-6">
          {/* Current Custody Card */}
          <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3">
              <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-[#FF6A1A]" />
                <span>Current Custodian Status</span>
              </h2>
              <div>
                {asset.status === 'Assigned' && (
                  <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold rounded">
                    Currently Assigned
                  </span>
                )}
                {asset.status === 'Available' && (
                  <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded">
                    Available in Inventory
                  </span>
                )}
                {asset.status !== 'Assigned' && asset.status !== 'Available' && (
                  <span className="px-2.5 py-1 bg-neutral-100 border border-neutral-200 text-neutral-700 text-xs font-semibold rounded">
                    Status: {asset.status}
                  </span>
                )}
              </div>
            </div>

            {asset.status === 'Assigned' && activeAssignment ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
                <div className="space-y-3">
                  <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-lg space-y-2">
                    <div className="text-[11px] text-blue-600 font-semibold uppercase tracking-wider">
                      Assigned Custodian
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold bg-white border border-blue-200 px-2 py-0.5 rounded text-blue-900">
                        {activeAssignment.employee?.employee_code || 'EMP'}
                      </span>
                      <span className="font-bold text-sm text-neutral-900">
                        {activeAssignment.employee?.full_name}
                      </span>
                    </div>
                    {activeAssignment.employee?.department?.name && (
                      <div className="text-xs text-neutral-600">
                        Department: <span className="font-medium text-neutral-900">{activeAssignment.employee.department.name}</span>
                      </div>
                    )}
                    {activeAssignment.employee?.job_title && (
                      <div className="text-xs text-neutral-600">
                        Job Title: <span className="font-medium text-neutral-900">{activeAssignment.employee.job_title}</span>
                      </div>
                    )}
                    {activeAssignment.employee?.email && (
                      <div className="text-xs text-neutral-500 font-mono">
                        {activeAssignment.employee.email}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <dl className="grid grid-cols-2 gap-y-3">
                    <dt className="text-neutral-500">Checked Out Date:</dt>
                    <dd className="font-mono font-medium text-neutral-900">
                      {formatTimestamp(activeAssignment.checked_out_at)}
                    </dd>

                    <dt className="text-neutral-500">Expected Return:</dt>
                    <dd className="font-mono font-medium text-neutral-900">
                      {activeAssignment.expected_return_at
                        ? formatDate(activeAssignment.expected_return_at)
                        : 'No return date set'}
                    </dd>

                    <dt className="text-neutral-500">Custody Duration:</dt>
                    <dd className="font-medium text-neutral-800">
                      {calculateDaysInCustody(activeAssignment.checked_out_at)}
                    </dd>

                    <dt className="text-neutral-500">Checkout Condition:</dt>
                    <dd className="font-medium text-neutral-800">
                      {activeAssignment.checkout_condition || 'Standard'}
                    </dd>

                    <dt className="text-neutral-500">Notes:</dt>
                    <dd className="text-neutral-700 italic col-span-2 pt-1 border-t border-neutral-100">
                      {activeAssignment.checkout_notes || 'None provided'}
                    </dd>
                  </dl>

                  {isTenantAdmin && (
                    <div className="flex items-center gap-2 pt-3 border-t border-neutral-100">
                      <button
                        type="button"
                        onClick={() => {
                          setModalError(null);
                          setCheckinDate(new Date().toISOString().split('T')[0]);
                          setShowCheckinModal(true);
                        }}
                        className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-900 text-white text-xs font-semibold rounded inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Check In Asset
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setModalError(null);
                          setTransferDate(new Date().toISOString().split('T')[0]);
                          setShowTransferModal(true);
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" /> Transfer Custody
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : asset.status === 'Available' ? (
              <div className="p-6 bg-emerald-50/50 border border-emerald-100 rounded-lg text-center space-y-3">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-emerald-950">Asset Ready for Assignment</h3>
                  <p className="text-[11px] text-emerald-700 max-w-md mx-auto">
                    This item is currently available in the company inventory. You can assign it to any active company employee custodian.
                  </p>
                </div>
                {isTenantAdmin ? (
                  <button
                    type="button"
                    onClick={() => {
                      setModalError(null);
                      setCheckoutDate(new Date().toISOString().split('T')[0]);
                      setShowCheckoutModal(true);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Check Out / Assign to Employee
                  </button>
                ) : (
                  <div className="text-[11px] text-neutral-500 italic">
                    Tenant Admin permissions required to check out assets.
                  </div>
                )}
              </div>
            ) : (
              <div className="p-5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-600 space-y-1">
                <div className="font-semibold text-neutral-800">Asset Unavailable for Custody</div>
                <p className="text-[11px] text-neutral-500">
                  This asset is currently in status <span className="font-semibold">{asset.status}</span> and cannot be checked out.
                </p>
              </div>
            )}
          </div>

          {/* Custody History Table */}
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-2xs">
            <div className="p-4 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
              <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-4 h-4 text-neutral-500" />
                <span>Custody & Checkout History</span>
              </h3>
              <span className="text-[11px] text-neutral-500 font-mono">
                {assignments.length} Record{assignments.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-neutral-50/50 border-b border-neutral-200 text-neutral-600 font-semibold select-none">
                  <tr>
                    <th className="py-2.5 px-4">Custodian Employee</th>
                    <th className="py-2.5 px-4">Department</th>
                    <th className="py-2.5 px-4">Checked Out</th>
                    <th className="py-2.5 px-4">Checked In</th>
                    <th className="py-2.5 px-4">Duration</th>
                    <th className="py-2.5 px-4">Condition</th>
                    <th className="py-2.5 px-4">Status / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {assignments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-neutral-400">
                        No custody history recorded for this asset yet.
                      </td>
                    </tr>
                  ) : (
                    assignments.map((asgn) => (
                      <tr key={asgn.id} className="hover:bg-neutral-50/60 transition-colors">
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-neutral-900">
                            {asgn.employee?.full_name || 'Former Employee'}
                          </div>
                          <div className="font-mono text-[10px] text-neutral-500">
                            {asgn.employee?.employee_code || '—'}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-neutral-700">
                          {asgn.employee?.department?.name || '—'}
                        </td>
                        <td className="py-2.5 px-4 font-mono tabular-nums text-neutral-800 whitespace-nowrap">
                          {formatTimestamp(asgn.checked_out_at)}
                        </td>
                        <td className="py-2.5 px-4 font-mono tabular-nums whitespace-nowrap">
                          {asgn.checked_in_at ? (
                            <span className="text-neutral-700">{formatTimestamp(asgn.checked_in_at)}</span>
                          ) : (
                            <span className="text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">
                              Active Custody
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-neutral-700 whitespace-nowrap">
                          {calculateDaysInCustody(asgn.checked_out_at, asgn.checked_in_at)}
                        </td>
                        <td className="py-2.5 px-4 text-neutral-700">
                          <span className="font-medium text-neutral-800">
                            {asgn.checkout_condition || 'Good'}
                          </span>
                          {asgn.checkin_condition && asgn.checkin_condition !== asgn.checkout_condition && (
                            <span className="text-neutral-500 text-[11px] block">
                              Returned: {asgn.checkin_condition}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-neutral-600 max-w-xs">
                          {asgn.checkin_notes || asgn.checkout_notes || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Activity History (Full Audit Trail) */}
      {activeTab === 'history' && (
        <div className="bg-white border border-neutral-200 rounded-lg p-6 space-y-4 shadow-2xs">
          <div className="border-b border-neutral-100 pb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-neutral-400" />
              <span>Immutable Audit Trail (asset_events)</span>
            </h2>
            <span className="text-xs text-neutral-500 font-mono">
              {history.length} Event{history.length === 1 ? '' : 's'} Logged
            </span>
          </div>

          {history.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-400">
              No audit events recorded for this asset yet.
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((ev, index) => (
                <div
                  key={ev.id || index}
                  className="p-3.5 bg-neutral-50/80 border border-neutral-200 rounded-lg space-y-2 text-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                          ev.event_type === 'CREATED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ev.event_type === 'CHECKED_OUT'
                            ? 'bg-blue-100 text-blue-800'
                            : ev.event_type === 'CHECKED_IN'
                            ? 'bg-purple-100 text-purple-800'
                            : ev.event_type === 'TRANSFERRED'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-neutral-200 text-neutral-800'
                        }`}
                      >
                        {ev.event_type}
                      </span>
                      <span className="text-neutral-500 font-mono text-[11px]">
                        Event ID: {ev.id.substring(0, 8)}...
                      </span>
                    </div>

                    <div className="text-[11px] text-neutral-500 font-mono tabular-nums">
                      {formatTimestamp(ev.created_at)}
                    </div>
                  </div>

                  {ev.details && Object.keys(ev.details).length > 0 && (
                    <pre className="p-2 bg-white border border-neutral-200 rounded text-[11px] font-mono text-neutral-700 overflow-x-auto">
                      {JSON.stringify(ev.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Maintenance & Service History */}
      {activeTab === 'maintenance' && (
        <div className="space-y-6">
          {/* Top KPI Summary & Quick Actions */}
          <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-4">
              <div>
                <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Maintenance & Service Management</span>
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Track repairs, scheduled maintenance, vendor servicing, and permanent lifecycle history
                </p>
              </div>

              {isTenantAdmin && (
                <button
                  type="button"
                  onClick={() => setShowMaintenanceModal(true)}
                  className="px-3 py-1.5 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>New Work Order</span>
                </button>
              )}
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                <span className="text-[11px] text-neutral-500 font-medium">Active Work Orders</span>
                <div className="text-lg font-bold font-mono text-neutral-900 mt-1">
                  {maintenanceRecords.filter((r) => r.status === 'Open' || r.status === 'Scheduled' || r.status === 'In Progress').length}
                </div>
              </div>

              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                <span className="text-[11px] text-neutral-500 font-medium">Completed Services</span>
                <div className="text-lg font-bold font-mono text-emerald-700 mt-1">
                  {maintenanceRecords.filter((r) => r.status === 'Completed').length}
                </div>
              </div>

              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                <span className="text-[11px] text-neutral-500 font-medium">Total Service Spend</span>
                <div className="text-lg font-bold font-mono text-neutral-900 mt-1">
                  ${maintenanceRecords
                    .reduce((sum, r) => sum + (Number(r.service_cost) || 0), 0)
                    .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                <span className="text-[11px] text-neutral-500 font-medium">Cumulative Downtime</span>
                <div className="text-lg font-bold font-mono text-neutral-900 mt-1">
                  {maintenanceRecords.reduce((sum, r) => sum + (Number(r.downtime_minutes) || 0), 0)} min
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Active Work Orders */}
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
              <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5 text-neutral-500" />
                <span>Active & Scheduled Work Orders</span>
              </h3>
              <span className="text-xs text-neutral-500 font-mono">
                {maintenanceRecords.filter((r) => r.status === 'Open' || r.status === 'Scheduled' || r.status === 'In Progress').length} Active
              </span>
            </div>

            {maintenanceRecords.filter((r) => r.status === 'Open' || r.status === 'Scheduled' || r.status === 'In Progress').length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-400">
                No open or active work orders for this asset.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 text-neutral-600 border-b border-neutral-200 font-semibold uppercase text-[11px]">
                      <th className="py-2.5 px-4">WO #</th>
                      <th className="py-2.5 px-4">Title & Type</th>
                      <th className="py-2.5 px-4">Priority</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4">Vendor / Assignee</th>
                      <th className="py-2.5 px-4">Target Date</th>
                      <th className="py-2.5 px-4 text-right">Est. Cost</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {maintenanceRecords
                      .filter((r) => r.status === 'Open' || r.status === 'Scheduled' || r.status === 'In Progress')
                      .map((r) => (
                        <tr
                          key={r.id}
                          onClick={() => setActiveWorkOrderId(r.id)}
                          className="hover:bg-neutral-50 transition-colors cursor-pointer"
                        >
                          <td className="py-2.5 px-4 font-mono font-semibold text-[#FF6A1A] whitespace-nowrap">
                            {r.work_order_number}
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="font-medium text-neutral-900">{r.title}</div>
                            <div className="text-[11px] text-neutral-500">{r.maintenance_type}</div>
                          </td>
                          <td className="py-2.5 px-4">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-neutral-100 text-neutral-700">
                              {r.priority}
                            </span>
                          </td>
                          <td className="py-2.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              {r.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-neutral-700">
                            {r.vendor?.name || 'In-House'}
                          </td>
                          <td className="py-2.5 px-4 text-neutral-700 font-mono">
                            {formatDate(r.due_date || r.scheduled_date)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-medium text-neutral-900">
                            {r.service_cost !== null && r.service_cost !== undefined ? `$${Number(r.service_cost).toFixed(2)}` : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveWorkOrderId(r.id);
                              }}
                              className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded text-[11px] font-medium transition-colors cursor-pointer"
                            >
                              Manage
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 2: Completed Service History */}
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
              <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Completed Service History</span>
              </h3>
              <span className="text-xs text-neutral-500 font-mono">
                {maintenanceRecords.filter((r) => r.status === 'Completed' || r.status === 'Cancelled').length} Historical
              </span>
            </div>

            {maintenanceRecords.filter((r) => r.status === 'Completed' || r.status === 'Cancelled').length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-400">
                No completed service history recorded for this asset yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 text-neutral-600 border-b border-neutral-200 font-semibold uppercase text-[11px]">
                      <th className="py-2.5 px-4">WO #</th>
                      <th className="py-2.5 px-4">Title & Type</th>
                      <th className="py-2.5 px-4">Completed Date</th>
                      <th className="py-2.5 px-4">Vendor</th>
                      <th className="py-2.5 px-4">Downtime</th>
                      <th className="py-2.5 px-4 text-right">Final Cost</th>
                      <th className="py-2.5 px-4">Resolution Notes</th>
                      <th className="py-2.5 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {maintenanceRecords
                      .filter((r) => r.status === 'Completed' || r.status === 'Cancelled')
                      .map((r) => (
                        <tr
                          key={r.id}
                          onClick={() => setActiveWorkOrderId(r.id)}
                          className="hover:bg-neutral-50 transition-colors cursor-pointer"
                        >
                          <td className="py-2.5 px-4 font-mono font-semibold text-neutral-900 whitespace-nowrap">
                            {r.work_order_number}
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="font-medium text-neutral-900">{r.title}</div>
                            <div className="text-[11px] text-neutral-500">{r.maintenance_type}</div>
                          </td>
                          <td className="py-2.5 px-4 text-neutral-700 font-mono whitespace-nowrap">
                            {formatDate(r.completed_at || r.updated_at)}
                          </td>
                          <td className="py-2.5 px-4 text-neutral-700">
                            {r.vendor?.name || 'In-House'}
                          </td>
                          <td className="py-2.5 px-4 text-neutral-700 font-mono">
                            {r.downtime_minutes ? `${r.downtime_minutes} min` : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-medium text-neutral-900">
                            {r.service_cost !== null && r.service_cost !== undefined ? `$${Number(r.service_cost).toFixed(2)}` : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-neutral-600 max-w-xs truncate" title={r.resolution_notes || ''}>
                            {r.resolution_notes || '—'}
                          </td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                r.status === 'Completed'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: Check Out / Assign Modal */}
      {/* ========================================================================= */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-neutral-200 shadow-xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">Check Out Asset</h3>
                  <p className="text-[11px] text-neutral-500 font-mono">
                    {asset.asset_tag} — {asset.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCheckoutSubmit} className="space-y-4">
              {/* Employee Selection */}
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Assign To Employee Custodian <span className="text-red-500">*</span>
                </label>
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search active employee name, code..."
                    value={empSearch}
                    onChange={(e) => setEmpSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                  />
                </div>
                <select
                  required
                  value={checkoutEmployeeId}
                  onChange={(e) => setCheckoutEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A] bg-white font-medium"
                >
                  <option value="">— Select Employee Custodian —</option>
                  {activeEmployees
                    .filter((emp) =>
                      empSearch
                        ? emp.full_name.toLowerCase().includes(empSearch.toLowerCase()) ||
                          emp.employee_code.toLowerCase().includes(empSearch.toLowerCase())
                        : true
                    )
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_code}) {emp.department?.name ? `· ${emp.department.name}` : ''}
                      </option>
                    ))}
                </select>
                {activeEmployees.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    No active employees registered. Add an employee in Lists &gt; Employees first.
                  </p>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1">
                    Checkout Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={checkoutDate}
                    onChange={(e) => setCheckoutDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1">
                    Expected Return Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={expectedReturnDate}
                    onChange={(e) => setExpectedReturnDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                  />
                </div>
              </div>

              {/* Condition */}
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Item Condition at Checkout
                </label>
                <select
                  value={checkoutCondition}
                  onChange={(e) => setCheckoutCondition(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A] bg-white"
                >
                  <option value="New / Sealed">New / Sealed</option>
                  <option value="Excellent">Excellent</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                  <option value="Needs Cleaning">Needs Cleaning</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Checkout Notes / Accessories Included
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Issued with 140W USB-C Charger & Laptop Sleeve"
                  value={checkoutNotes}
                  onChange={(e) => setCheckoutNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowCheckoutModal(false)}
                  disabled={modalLoading}
                  className="px-3.5 py-1.5 border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-medium rounded transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading || !checkoutEmployeeId}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {modalLoading ? 'Checking out...' : 'Confirm Checkout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: Check In Modal */}
      {/* ========================================================================= */}
      {showCheckinModal && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-neutral-200 shadow-xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-neutral-800 text-white flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">Check In Asset</h3>
                  <p className="text-[11px] text-neutral-500 font-mono">
                    {asset.asset_tag} — {asset.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCheckinModal(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCheckinSubmit} className="space-y-4">
              {/* Current Custodian Display (Read-Only) */}
              <div className="p-3 bg-neutral-50 rounded border border-neutral-200 text-xs space-y-1">
                <span className="text-neutral-500 block text-[11px]">Returning Custodian:</span>
                <div className="font-bold text-neutral-900 flex items-center gap-2">
                  <span>{activeAssignment?.employee?.full_name || 'Current Custodian'}</span>
                  <span className="font-mono text-[10px] bg-white px-1.5 py-0.5 rounded border border-neutral-300">
                    {activeAssignment?.employee?.employee_code}
                  </span>
                </div>
                <div className="text-[11px] text-neutral-500">
                  Checked out on: {activeAssignment ? formatTimestamp(activeAssignment.checked_out_at) : '—'}
                </div>
              </div>

              {/* Checkin Date */}
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Check-in Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={checkinDate}
                  onChange={(e) => setCheckinDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>

              {/* Returned Condition */}
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Returned Condition
                </label>
                <select
                  value={checkinCondition}
                  onChange={(e) => setCheckinCondition(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A] bg-white"
                >
                  <option value="Excellent">Excellent</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                  <option value="Damaged / Needs Repair">Damaged / Needs Repair</option>
                  <option value="Missing Parts">Missing Parts</option>
                </select>
              </div>

              {/* Destination Site & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1">
                    Return Site (Optional)
                  </label>
                  <select
                    value={destinationSiteId}
                    onChange={(e) => {
                      setDestinationSiteId(e.target.value);
                      setDestinationLocationId('');
                    }}
                    className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A] bg-white"
                  >
                    <option value="">Keep current site</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1">
                    Return Location
                  </label>
                  <select
                    value={destinationLocationId}
                    onChange={(e) => setDestinationLocationId(e.target.value)}
                    disabled={!destinationSiteId}
                    className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A] bg-white disabled:bg-neutral-50 disabled:text-neutral-400"
                  >
                    <option value="">Keep current location</option>
                    {locations
                      .filter((l) => l.site_id === destinationSiteId)
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Check-in Notes / Condition Summary
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Returned with all cables; inspected and cleaned"
                  value={checkinNotes}
                  onChange={(e) => setCheckinNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowCheckinModal(false)}
                  disabled={modalLoading}
                  className="px-3.5 py-1.5 border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-medium rounded transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {modalLoading ? 'Checking in...' : 'Confirm Check In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: Transfer Modal */}
      {/* ========================================================================= */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-neutral-200 shadow-xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">Transfer Asset Custody</h3>
                  <p className="text-[11px] text-neutral-500 font-mono">
                    {asset.asset_tag} — {asset.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleTransferSubmit} className="space-y-4">
              {/* Current Custodian */}
              <div className="p-3 bg-blue-50/60 rounded border border-blue-100 text-xs space-y-1">
                <span className="text-blue-700 font-semibold block text-[11px]">Current Custodian:</span>
                <div className="font-bold text-neutral-900 flex items-center gap-2">
                  <span>{activeAssignment?.employee?.full_name || 'Current Custodian'}</span>
                  <span className="font-mono text-[10px] bg-white px-1.5 py-0.5 rounded border border-blue-200 text-blue-900">
                    {activeAssignment?.employee?.employee_code}
                  </span>
                </div>
              </div>

              {/* New Employee Custodian Select */}
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Transfer To New Employee Custodian <span className="text-red-500">*</span>
                </label>
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search new employee name, code..."
                    value={empSearch}
                    onChange={(e) => setEmpSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                  />
                </div>
                <select
                  required
                  value={transferEmployeeId}
                  onChange={(e) => setTransferEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A] bg-white font-medium"
                >
                  <option value="">— Select New Employee Custodian —</option>
                  {activeEmployees
                    .filter((emp) => emp.id !== activeAssignment?.employee_id)
                    .filter((emp) =>
                      empSearch
                        ? emp.full_name.toLowerCase().includes(empSearch.toLowerCase()) ||
                          emp.employee_code.toLowerCase().includes(empSearch.toLowerCase())
                        : true
                    )
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_code}) {emp.department?.name ? `· ${emp.department.name}` : ''}
                      </option>
                    ))}
                </select>
              </div>

              {/* Transfer Date */}
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Transfer Effective Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>

              {/* Condition */}
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Item Condition at Handover
                </label>
                <select
                  value={transferCondition}
                  onChange={(e) => setTransferCondition(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A] bg-white"
                >
                  <option value="Excellent">Excellent</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Transfer Reason / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Department internal transfer / role reassignment"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  disabled={modalLoading}
                  className="px-3.5 py-1.5 border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-medium rounded transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading || !transferEmployeeId}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {modalLoading ? 'Transferring...' : 'Confirm Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Maintenance Modals */}
      {showMaintenanceModal && (
        <MaintenanceFormModal
          initialAssetId={assetId}
          onClose={() => setShowMaintenanceModal(false)}
          onSuccess={() => {
            setShowMaintenanceModal(false);
            fetchAssetDetails();
          }}
        />
      )}

      {activeWorkOrderId && (
        <MaintenanceDetailModal
          workOrderId={activeWorkOrderId}
          onClose={() => setActiveWorkOrderId(null)}
          onRecordUpdated={() => {
            fetchAssetDetails();
          }}
        />
      )}
    </div>
  );
};
