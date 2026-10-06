/**
 * AssetMT - Physical Asset Audits Management
 * Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardCheck,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Barcode,
  Calendar,
  Building2,
  MapPin,
  Check,
  X,
  Clock,
  History,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import {
  AuditSession,
  AuditSessionItem,
  Site,
  Location,
  CreateAuditSessionInput,
  ScanAuditItemInput,
} from '../../shared/types.ts';
import { validateAuditSession } from '../../shared/validation.ts';

interface AuditListViewProps {
  token: string;
  isTenantAdmin: boolean;
  onNavigateToAsset?: (assetId: string) => void;
}

export const AuditListView: React.FC<AuditListViewProps> = ({
  token,
  isTenantAdmin,
  onNavigateToAsset,
}) => {
  const [sessions, setSessions] = useState<AuditSession[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Audit Session View
  const [activeSession, setActiveSession] = useState<AuditSession | null>(null);
  const [sessionItems, setSessionItems] = useState<AuditSessionItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Filter & Search in active session
  const [itemSearch, setItemSearch] = useState('');
  const [itemStatusFilter, setItemStatusFilter] = useState<'all' | 'Found' | 'Missing' | 'Wrong Location' | 'Unexpected'>('all');

  // Scanner state
  const [scanInput, setScanInput] = useState('');
  const [scanMessage, setScanMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // New Audit Modal state
  const [showNewModal, setShowNewModal] = useState(false);
  const [newAuditForm, setNewAuditForm] = useState<Partial<CreateAuditSessionInput>>({
    name: `Physical Audit - ${new Date().toLocaleDateString()}`,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isCreating, setIsCreating] = useState(false);

  // Complete modal state
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeNotes, setCompleteNotes] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);

  // Load audit sessions
  const loadSessions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sessRes, siteRes, locRes] = await Promise.all([
        api.getAuditSessions(token),
        api.getSites(token),
        api.getLocations(token),
      ]);
      if (sessRes.success) setSessions(sessRes.data);
      if (siteRes.success) setSites(siteRes.data);
      if (locRes.success) setLocations(locRes.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load audit sessions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  // Open active audit session
  const openSession = async (session: AuditSession) => {
    setActiveSession(session);
    setIsLoadingItems(true);
    setScanMessage(null);
    try {
      const res = await api.getAuditSession(token, session.id);
      if (res.success) {
        setActiveSession(res.data);
        setSessionItems(res.items);
      }
    } catch (err: unknown) {
      console.error('Failed to load session details:', err);
    } finally {
      setIsLoadingItems(false);
    }
  };

  // Create new session
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateAuditSession(newAuditForm);
    if (!validation.isValid) {
      setFormErrors(validation.errors);
      return;
    }

    setIsCreating(true);
    setFormErrors({});
    try {
      const res = await api.createAuditSession(token, newAuditForm as CreateAuditSessionInput);
      if (res.success) {
        setShowNewModal(false);
        await loadSessions();
        await openSession(res.data);
      }
    } catch (err: unknown) {
      const errorData = (err as { data?: { error?: string; message?: string } })?.data;
      setFormErrors({ general: errorData?.message || (err instanceof Error ? err.message : 'Create failed') });
    } finally {
      setIsCreating(false);
    }
  };

  // Handle Scan
  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || !scanInput.trim()) return;

    setIsScanning(true);
    setScanMessage(null);
    try {
      const res = await api.scanAuditItem(token, activeSession.id, {
        asset_tag: scanInput.trim(),
      });
      if (res.success) {
        setScanInput('');
        setScanMessage({ text: `Recorded: ${scanInput.trim()} marked as ${res.data.status}` });
        // Reload session items
        const updatedRes = await api.getAuditSession(token, activeSession.id);
        if (updatedRes.success) {
          setActiveSession(updatedRes.data);
          setSessionItems(updatedRes.items);
        }
      }
    } catch (err: unknown) {
      const errorData = (err as { data?: { error?: string; message?: string } })?.data;
      setScanMessage({ text: errorData?.message || (err instanceof Error ? err.message : 'Scan failed'), isError: true });
    } finally {
      setIsScanning(false);
    }
  };

  // Quick manual status change on an audit item
  const handleQuickStatusChange = async (
    item: AuditSessionItem,
    status: 'Found' | 'Missing' | 'Wrong Location'
  ) => {
    if (!activeSession || activeSession.status !== 'In Progress') return;
    try {
      const res = await api.scanAuditItem(token, activeSession.id, {
        asset_id: item.asset_id,
        status,
      });
      if (res.success) {
        setSessionItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status } : i))
        );
        // Refresh session counters
        const sessRes = await api.getAuditSession(token, activeSession.id);
        if (sessRes.success) setActiveSession(sessRes.data);
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // Complete Audit
  const handleCompleteAudit = async () => {
    if (!activeSession) return;
    setIsCompleting(true);
    try {
      const res = await api.completeAuditSession(token, activeSession.id, {
        notes: completeNotes,
      });
      if (res.success) {
        setActiveSession(res.data);
        setShowCompleteModal(false);
        await loadSessions();
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to complete audit');
    } finally {
      setIsCompleting(false);
    }
  };

  // Filtered session items
  const filteredItems = useMemo(() => {
    return sessionItems.filter((i) => {
      const search = itemSearch.toLowerCase();
      const matchesSearch =
        !search ||
        i.asset?.name?.toLowerCase().includes(search) ||
        i.asset?.asset_tag?.toLowerCase().includes(search) ||
        i.asset?.serial_number?.toLowerCase().includes(search);

      const matchesStatus = itemStatusFilter === 'all' || i.status === itemStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [sessionItems, itemSearch, itemStatusFilter]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* View 1: Active Audit Session In Progress */}
      {activeSession ? (
        <div className="space-y-6">
          {/* Breadcrumb / Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setActiveSession(null)}
              className="text-xs text-neutral-500 hover:text-neutral-900 flex items-center gap-1 cursor-pointer font-medium"
            >
              ← Back to All Audit Sessions
            </button>

            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  activeSession.status === 'In Progress'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                }`}
              >
                {activeSession.status}
              </span>

              {isTenantAdmin && activeSession.status === 'In Progress' && (
                <button
                  onClick={() => setShowCompleteModal(true)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Complete Audit
                </button>
              )}
            </div>
          </div>

          {/* Session Header Card */}
          <div className="bg-white p-5 rounded-lg border border-neutral-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-[#FF6A1A]" />
                <h1 className="text-base font-bold text-neutral-900">{activeSession.name}</h1>
              </div>
              <div className="text-xs text-neutral-500 mt-1 flex flex-wrap items-center gap-3">
                <span>
                  Started: <strong className="text-neutral-800">{new Date(activeSession.started_at).toLocaleString()}</strong>
                </span>
                {activeSession.site && (
                  <span>
                    Scope Site: <strong className="text-neutral-800">{activeSession.site.name}</strong>
                  </span>
                )}
                {activeSession.location && (
                  <span>
                    Scope Location: <strong className="text-neutral-800">{activeSession.location.name}</strong>
                  </span>
                )}
                {activeSession.completed_at && (
                  <span>
                    Completed: <strong className="text-neutral-800">{new Date(activeSession.completed_at).toLocaleString()}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Quick Barcode Scanner Form */}
            {activeSession.status === 'In Progress' && isTenantAdmin && (
              <form onSubmit={handleScan} className="flex items-center gap-2 max-w-md w-full">
                <div className="relative flex-1">
                  <Barcode className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                  <input
                    type="text"
                    required
                    placeholder="Scan / Type Asset Tag (e.g. AST-001)..."
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-neutral-50 border border-neutral-300 rounded text-xs font-mono uppercase focus:bg-white focus:outline-none focus:border-[#FF6A1A]"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={isScanning}
                  className="px-3 py-1.5 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  {isScanning ? 'Checking...' : 'Scan / Verify'}
                </button>
              </form>
            )}
          </div>

          {scanMessage && (
            <div
              className={`p-3 rounded text-xs flex items-center gap-2 ${
                scanMessage.isError
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              }`}
            >
              {scanMessage.isError ? (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              <span>{scanMessage.text}</span>
            </div>
          )}

          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-3 bg-white rounded border border-neutral-200 text-center">
              <div className="text-[10px] font-semibold text-neutral-500 uppercase">Expected</div>
              <div className="text-lg font-bold text-neutral-900 mt-0.5">
                {activeSession.stats?.expected ?? sessionItems.length}
              </div>
            </div>
            <div className="p-3 bg-emerald-50/60 rounded border border-emerald-200 text-center">
              <div className="text-[10px] font-semibold text-emerald-700 uppercase">Found</div>
              <div className="text-lg font-bold text-emerald-800 mt-0.5">
                {sessionItems.filter((i) => i.status === 'Found').length}
              </div>
            </div>
            <div className="p-3 bg-red-50/60 rounded border border-red-200 text-center">
              <div className="text-[10px] font-semibold text-red-700 uppercase">Missing</div>
              <div className="text-lg font-bold text-red-800 mt-0.5">
                {sessionItems.filter((i) => i.status === 'Missing').length}
              </div>
            </div>
            <div className="p-3 bg-amber-50/60 rounded border border-amber-200 text-center">
              <div className="text-[10px] font-semibold text-amber-700 uppercase">Wrong Location</div>
              <div className="text-lg font-bold text-amber-800 mt-0.5">
                {sessionItems.filter((i) => i.status === 'Wrong Location').length}
              </div>
            </div>
            <div className="p-3 bg-blue-50/60 rounded border border-blue-200 text-center">
              <div className="text-[10px] font-semibold text-blue-700 uppercase">Unexpected</div>
              <div className="text-lg font-bold text-blue-800 mt-0.5">
                {sessionItems.filter((i) => i.status === 'Unexpected').length}
              </div>
            </div>
          </div>

          {/* Items Filter Bar */}
          <div className="bg-white p-3 rounded-lg border border-neutral-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Filter items in this audit..."
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 bg-neutral-50 border border-neutral-200 rounded text-xs focus:bg-white focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>

              <div className="inline-flex rounded border border-neutral-200 bg-neutral-50 p-0.5 text-xs">
                {(['all', 'Found', 'Missing', 'Wrong Location', 'Unexpected'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setItemStatusFilter(st)}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      itemStatusFilter === st
                        ? 'bg-white shadow-2xs font-semibold text-neutral-900'
                        : 'text-neutral-500'
                    }`}
                  >
                    {st === 'all' ? 'All' : st}
                  </button>
                ))}
              </div>
            </div>

            <span className="text-neutral-400 text-[11px]">
              Showing {filteredItems.length} of {sessionItems.length} items
            </span>
          </div>

          {/* Audit Items Table */}
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-2xs">
            {isLoadingItems ? (
              <div className="p-8 text-center text-xs text-neutral-400">Loading audit records...</div>
            ) : filteredItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-400">
                No items match the current filters.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase text-[10px] font-semibold">
                    <th className="py-2.5 px-4">Asset Tag</th>
                    <th className="py-2.5 px-4">Asset Name</th>
                    <th className="py-2.5 px-4">Expected Location</th>
                    <th className="py-2.5 px-4">Scanned Location</th>
                    <th className="py-2.5 px-4 text-center">Audit Status</th>
                    <th className="py-2.5 px-4">Scanned At</th>
                    {activeSession.status === 'In Progress' && isTenantAdmin && (
                      <th className="py-2.5 px-4 text-right">Quick Action</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredItems.map((item) => {
                    const statusColors = {
                      Found: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                      Missing: 'bg-red-50 text-red-800 border-red-200',
                      'Wrong Location': 'bg-amber-50 text-amber-800 border-amber-200',
                      Unexpected: 'bg-blue-50 text-blue-800 border-blue-200',
                    };

                    return (
                      <tr key={item.id} className="hover:bg-neutral-50/50">
                        <td className="py-2.5 px-4 font-mono font-semibold text-neutral-900">
                          {onNavigateToAsset ? (
                            <button
                              onClick={() => onNavigateToAsset(item.asset_id)}
                              className="text-[#FF6A1A] hover:underline cursor-pointer"
                            >
                              {item.asset?.asset_tag || '—'}
                            </button>
                          ) : (
                            item.asset?.asset_tag || '—'
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-neutral-900">
                          {item.asset?.name || '—'}
                          {item.asset?.serial_number && (
                            <span className="text-[10px] text-neutral-400 block font-mono">
                              S/N: {item.asset.serial_number}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-neutral-600">
                          {item.expected_site?.name ? (
                            <span>
                              {item.expected_site.name}
                              {item.expected_location?.name && (
                                <span className="text-neutral-400"> / {item.expected_location.name}</span>
                              )}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-neutral-600">
                          {item.scanned_site?.name ? (
                            <span>
                              {item.scanned_site.name}
                              {item.scanned_location?.name && (
                                <span className="text-neutral-400"> / {item.scanned_location.name}</span>
                              )}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              statusColors[item.status] || 'bg-neutral-100 text-neutral-700'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-[11px] text-neutral-500 font-mono">
                          {item.scanned_at ? new Date(item.scanned_at).toLocaleTimeString() : '—'}
                        </td>

                        {activeSession.status === 'In Progress' && isTenantAdmin && (
                          <td className="py-2.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1 justify-end">
                              {item.status !== 'Found' && (
                                <button
                                  type="button"
                                  onClick={() => handleQuickStatusChange(item, 'Found')}
                                  className="px-2 py-0.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-[10px] font-semibold cursor-pointer"
                                  title="Mark as Found"
                                >
                                  Mark Found
                                </button>
                              )}
                              {item.status !== 'Missing' && (
                                <button
                                  type="button"
                                  onClick={() => handleQuickStatusChange(item, 'Missing')}
                                  className="px-2 py-0.5 bg-red-50 text-red-700 hover:bg-red-100 rounded text-[10px] font-semibold cursor-pointer"
                                  title="Mark as Missing"
                                >
                                  Mark Missing
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        /* View 2: List of Physical Audit Sessions */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#FF6A1A]" />
                <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
                  Physical Asset Audits
                </h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-mono">
                  {sessions.length} Audits
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                Real-world physical reconciliation, location verification, and permanent audit compliance history.
              </p>
            </div>

            {isTenantAdmin && (
              <button
                onClick={() => {
                  setNewAuditForm({
                    name: `Physical Audit - ${new Date().toLocaleDateString()}`,
                  });
                  setFormErrors({});
                  setShowNewModal(true);
                }}
                className="px-4 py-2 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Start New Physical Audit
              </button>
            )}
          </div>

          {/* Sessions List */}
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-2xs">
            {isLoading ? (
              <div className="p-12 text-center text-xs text-neutral-400">Loading audits...</div>
            ) : error ? (
              <div className="p-8 text-center text-xs text-red-600 bg-red-50">{error}</div>
            ) : sessions.length === 0 ? (
              <div className="p-12 text-center">
                <ClipboardCheck className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                <div className="text-xs font-semibold text-neutral-800">No physical audits performed yet</div>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Start an audit session to reconcile your physical assets against recorded database locations.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {sessions.map((sess) => (
                  <div
                    key={sess.id}
                    onClick={() => openSession(sess)}
                    className="p-4 hover:bg-neutral-50/75 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-neutral-900 text-xs">{sess.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            sess.status === 'In Progress'
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          }`}
                        >
                          {sess.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-500 mt-1 flex flex-wrap items-center gap-3">
                        <span>
                          Started: <strong className="text-neutral-700">{new Date(sess.started_at).toLocaleDateString()}</strong>
                        </span>
                        {sess.site && <span>Site: {sess.site.name}</span>}
                        {sess.location && <span>Location: {sess.location.name}</span>}
                        {sess.completed_at && (
                          <span>
                            Completed: {new Date(sess.completed_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {sess.stats && (
                        <div className="flex items-center gap-4 text-xs font-mono">
                          <span className="text-emerald-700 font-semibold" title="Found">
                            ✓ {sess.stats.found}
                          </span>
                          <span className="text-red-600 font-semibold" title="Missing">
                            ✗ {sess.stats.missing}
                          </span>
                          <span className="text-amber-700 font-semibold" title="Wrong Location">
                            ⚠ {sess.stats.wrongLocation}
                          </span>
                          <span className="text-neutral-400">
                            / {sess.stats.expected} total
                          </span>
                        </div>
                      )}

                      <span className="text-xs text-[#FF6A1A] font-semibold flex items-center gap-1">
                        {sess.status === 'In Progress' ? 'Resume Audit' : 'View Report'}{' '}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Start New Audit Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-neutral-200 shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-4">
              <h3 className="text-sm font-bold text-neutral-900">Initiate Physical Asset Audit</h3>
              <button
                onClick={() => setShowNewModal(false)}
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

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Audit Session Name *
                </label>
                <input
                  type="text"
                  required
                  value={newAuditForm.name || ''}
                  onChange={(e) => setNewAuditForm({ ...newAuditForm, name: e.target.value })}
                  placeholder="e.g. Q4 2026 Headquarters Audit"
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                />
                {formErrors.name && <p className="text-[10px] text-red-500 mt-0.5">{formErrors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Audit Scope (Site)
                </label>
                <select
                  value={newAuditForm.site_id || ''}
                  onChange={(e) =>
                    setNewAuditForm({ ...newAuditForm, site_id: e.target.value || undefined })
                  }
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                >
                  <option value="">All Sites (Workspace-wide Audit)</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-neutral-400 mt-1">
                  Leave blank to audit all assets across all company sites.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Audit Scope (Specific Location)
                </label>
                <select
                  value={newAuditForm.location_id || ''}
                  onChange={(e) =>
                    setNewAuditForm({ ...newAuditForm, location_id: e.target.value || undefined })
                  }
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                >
                  <option value="">All Locations in selected site</option>
                  {locations
                    .filter((l) => !newAuditForm.site_id || l.site_id === newAuditForm.site_id)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={newAuditForm.notes || ''}
                  onChange={(e) => setNewAuditForm({ ...newAuditForm, notes: e.target.value })}
                  placeholder="Optional audit instructions or auditor notes..."
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-3 py-1.5 border border-neutral-300 rounded text-xs text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-1.5 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded cursor-pointer disabled:opacity-50"
                >
                  {isCreating ? 'Initializing...' : 'Start Audit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Audit Confirmation Modal */}
      {showCompleteModal && activeSession && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-neutral-200 shadow-xl max-w-md w-full p-6">
            <h3 className="text-sm font-bold text-neutral-900 mb-2">Complete Physical Audit</h3>
            <p className="text-xs text-neutral-600 mb-4">
              Completing this session will finalize the physical count and lock this audit as an immutable historical compliance record.
            </p>

            <div className="p-3 bg-neutral-50 rounded border border-neutral-200 mb-4 text-xs font-mono space-y-1">
              <div>Total Expected: {sessionItems.length}</div>
              <div className="text-emerald-700 font-bold">
                Found: {sessionItems.filter((i) => i.status === 'Found').length}
              </div>
              <div className="text-red-700 font-bold">
                Missing: {sessionItems.filter((i) => i.status === 'Missing').length}
              </div>
              <div className="text-amber-700 font-bold">
                Wrong Location: {sessionItems.filter((i) => i.status === 'Wrong Location').length}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Final Reconciliation Notes
              </label>
              <textarea
                rows={2}
                value={completeNotes}
                onChange={(e) => setCompleteNotes(e.target.value)}
                placeholder="Concluding remarks or discrepancy follow-ups..."
                className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-[#FF6A1A]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setShowCompleteModal(false)}
                className="px-3 py-1.5 border border-neutral-300 rounded text-xs text-neutral-700 hover:bg-neutral-50 cursor-pointer"
              >
                Continue Audit
              </button>
              <button
                type="button"
                onClick={handleCompleteAudit}
                disabled={isCompleting}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded cursor-pointer disabled:opacity-50"
              >
                {isCompleting ? 'Finalizing...' : 'Confirm & Complete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
