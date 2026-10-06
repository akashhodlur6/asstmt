/**
 * AssetMT - Commercial Multi-Tenant Asset Management SaaS
 * Built for Akshigo Tech with AssetTiger parity layout & Akshigo orange #FF6A1A
 */

import React, { useState, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { AuthScreen } from './components/AuthScreen.tsx';
import { OnboardingModal } from './components/OnboardingModal.tsx';
import { SetupRequired } from './components/SetupRequired.tsx';
import { ServiceUnavailable } from './components/ServiceUnavailable.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { AssetListView } from './components/AssetListView.tsx';
import { EmployeeListView } from './components/EmployeeListView.tsx';
import { MaintenanceListView } from './components/MaintenanceListView.tsx';
import { Database, AlertTriangle, RefreshCw } from 'lucide-react';
import { api } from './lib/api.ts';
import { Asset } from '../shared/types.ts';

// Dynamically imported secondary views for optimized production payload
const AssetFormView = React.lazy(() => import('./components/AssetFormView.tsx').then((m) => ({ default: m.AssetFormView })));
const AssetDetailView = React.lazy(() => import('./components/AssetDetailView.tsx').then((m) => ({ default: m.AssetDetailView })));
const EmployeeFormView = React.lazy(() => import('./components/EmployeeFormView.tsx').then((m) => ({ default: m.EmployeeFormView })));
const EmployeeDetailView = React.lazy(() => import('./components/EmployeeDetailView.tsx').then((m) => ({ default: m.EmployeeDetailView })));
const MaintenanceFormView = React.lazy(() => import('./components/MaintenanceFormView.tsx').then((m) => ({ default: m.MaintenanceFormView })));
const MaintenanceDetailView = React.lazy(() => import('./components/MaintenanceDetailView.tsx').then((m) => ({ default: m.MaintenanceDetailView })));
const VendorListView = React.lazy(() => import('./components/VendorListView.tsx').then((m) => ({ default: m.VendorListView })));
const InventoryListView = React.lazy(() => import('./components/InventoryListView.tsx').then((m) => ({ default: m.InventoryListView })));
const AuditListView = React.lazy(() => import('./components/AuditListView.tsx').then((m) => ({ default: m.AuditListView })));
const ContractListView = React.lazy(() => import('./components/ContractListView.tsx').then((m) => ({ default: m.ContractListView })));
const LicenseListView = React.lazy(() => import('./components/LicenseListView.tsx').then((m) => ({ default: m.LicenseListView })));
const AlertsView = React.lazy(() => import('./components/AlertsView.tsx').then((m) => ({ default: m.AlertsView })));
const ReportsView = React.lazy(() => import('./components/ReportsView.tsx').then((m) => ({ default: m.ReportsView })));
const TenantUsersView = React.lazy(() => import('./components/TenantUsersView.tsx').then((m) => ({ default: m.TenantUsersView })));
const ImportCenterView = React.lazy(() => import('./components/ImportCenterView.tsx').then((m) => ({ default: m.ImportCenterView })));
const AuditLogView = React.lazy(() => import('./components/AuditLogView.tsx').then((m) => ({ default: m.AuditLogView })));
const TenantSettingsView = React.lazy(() => import('./components/TenantSettingsView.tsx').then((m) => ({ default: m.TenantSettingsView })));
const PlatformAdminView = React.lazy(() => import('./components/PlatformAdminView.tsx').then((m) => ({ default: m.PlatformAdminView })));
const BarcodeLabelModal = React.lazy(() => import('./components/BarcodeLabelModal.tsx').then((m) => ({ default: m.BarcodeLabelModal })));
const OrganizationManager = React.lazy(() => import('./components/OrganizationManager.tsx').then((m) => ({ default: m.OrganizationManager })));

function ViewLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center p-16 gap-3">
      <div className="w-6 h-6 border-2 border-neutral-300 border-t-[#FF6A1A] rounded-full animate-spin"></div>
      <span className="text-xs text-neutral-500 font-medium font-['Plus_Jakarta_Sans',sans-serif]">Loading view...</span>
    </div>
  );
}

function MainApp() {
  const {
    user,
    membership,
    companyName,
    role,
    token,
    isLoading,
    isDatabaseIncomplete,
    workspaceLookupError,
    error,
    refreshWorkspace,
    signOut,
  } = useAuth();
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>(undefined);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | undefined>(undefined);
  const [selectedMaintenanceId, setSelectedMaintenanceId] = useState<string | undefined>(undefined);
  const [showSetupModal, setShowSetupModal] = useState<boolean>(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState<boolean>(false);
  const [barcodeAssets, setBarcodeAssets] = useState<Asset[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState<boolean>(false);

  React.useEffect(() => {
    async function checkOwner() {
      if (token) {
        try {
          const res = await api.checkPlatformAdmin(token);
          if (res.success && res.is_platform_admin) {
            setIsPlatformAdmin(true);
          }
        } catch {
          // Normal tenant user - ignore
        }
      }
    }
    checkOwner();
  }, [token]);

  const handleOpenBarcodeModal = async () => {
    if (token) {
      try {
        const res = await api.getAssets(token, { limit: 100 });
        if (res.success) {
          setBarcodeAssets(res.data);
        }
      } catch {
        // Ignore fetch error, modal can still render or search
      }
    }
    setShowBarcodeModal(true);
  };

  const handleNavigate = (view: string, entityId?: string) => {
    if (view === 'asset-detail' || view === 'asset-edit') {
      setSelectedAssetId(entityId);
    } else if (view === 'employee-detail' || view === 'employee-edit') {
      setSelectedEmployeeId(entityId);
    } else if (view === 'maintenance-detail' || view === 'maintenance-edit') {
      setSelectedMaintenanceId(entityId);
    } else if (view === 'maintenance-add') {
      setSelectedMaintenanceId(undefined);
    } else if (view === 'employee-add') {
      setSelectedEmployeeId(undefined);
    } else if (view === 'asset-add') {
      setSelectedAssetId(undefined);
    }
    setCurrentView(view);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-neutral-300 border-t-[#FF6A1A] rounded-full animate-spin"></div>
          <div className="text-xs font-semibold text-neutral-600 font-['Plus_Jakarta_Sans',sans-serif]">
            Loading AssetMT...
          </div>
        </div>
      </div>
    );
  }

  // 1. Not authenticated: Show Sign In Screen
  if (!user) {
    return (
      <>
        <AuthScreen onOpenSetup={() => setShowSetupModal(true)} />
        {showSetupModal && import.meta.env.DEV && (
          <SetupRequired isModal onClose={() => setShowSetupModal(false)} />
        )}
      </>
    );
  }

  // 2. Database setup incomplete: Safe generic failure in production, clean diagnostic in dev
  if (isDatabaseIncomplete) {
    if (!import.meta.env.DEV) {
      return (
        <ServiceUnavailable
          onRetry={() => refreshWorkspace()}
          onSignOut={() => signOut()}
        />
      );
    }

    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4 font-['Plus_Jakarta_Sans',sans-serif]">
        <div className="bg-white rounded-lg border border-red-200 shadow-xl max-w-xl w-full p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-neutral-900">
                  Developer Setup: Database Incomplete
                </h2>
                <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 font-mono font-bold px-1.5 py-0.5 rounded">
                  DEV ONLY
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                The database schema has not been initialized.
              </p>
            </div>
          </div>

          <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800 mb-4 leading-relaxed font-mono">
            Database status: Incomplete. Ensure migrations have been applied.
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => signOut()}
              className="text-xs text-neutral-500 hover:text-neutral-800 cursor-pointer"
            >
              Sign Out
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSetupModal(true)}
                className="px-3 py-1.5 border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-medium rounded transition-colors cursor-pointer"
              >
                Developer Setup
              </button>
              <button
                onClick={() => refreshWorkspace()}
                className="px-4 py-1.5 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Connection</span>
              </button>
            </div>
          </div>
        </div>
        {showSetupModal && (
          <SetupRequired isModal onClose={() => setShowSetupModal(false)} />
        )}
      </div>
    );
  }

  // 3. Genuine request/permission failure: Safe screen in production, diagnostic in dev
  if (workspaceLookupError) {
    if (!import.meta.env.DEV) {
      return (
        <ServiceUnavailable
          onRetry={() => refreshWorkspace()}
          onSignOut={() => signOut()}
        />
      );
    }

    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4 font-['Plus_Jakarta_Sans',sans-serif]">
        <div className="bg-white rounded-lg border border-neutral-200 shadow-xl max-w-md w-full p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">
                Workspace Lookup Failure
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Could not verify company workspace membership due to a server or network error.
              </p>
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 mb-5 leading-relaxed">
            {workspaceLookupError}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => signOut()}
              className="text-xs text-neutral-500 hover:text-neutral-800 cursor-pointer"
            >
              Sign Out
            </button>
            <button
              onClick={() => refreshWorkspace()}
              className="px-4 py-2 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Authenticated with no workspace: Show Onboarding Modal
  if (!membership) {
    return (
      <>
        <OnboardingModal />
        {showSetupModal && import.meta.env.DEV && (
          <SetupRequired isModal onClose={() => setShowSetupModal(false)} />
        )}
      </>
    );
  }

  // Authenticated with Active Workspace: Main SaaS Workspace
  return (
    <div className="h-screen w-screen flex bg-[#F7F6F2] overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Dark Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onSelectView={(v) => handleNavigate(v)}
        onOpenBarcodeModal={handleOpenBarcodeModal}
        isPlatformAdmin={isPlatformAdmin}
      />

      {/* Main Viewport Container */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Bar Contract */}
        <Navbar
          currentView={currentView}
          onOpenSetup={() => setShowSetupModal(true)}
          onNavigate={(v) => handleNavigate(v)}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-[#F7F6F2]">
          <Suspense fallback={<ViewLoadingFallback />}>
            {currentView === 'dashboard' && (
              <DashboardView onNavigate={handleNavigate} />
            )}

            {currentView === 'assets' && (
              <AssetListView onNavigate={handleNavigate} />
            )}

            {currentView === 'inventory' && token && (
              <InventoryListView
                token={token}
                isTenantAdmin={role === 'TENANT_ADMIN'}
              />
            )}

            {currentView === 'audits' && token && (
              <AuditListView
                token={token}
                isTenantAdmin={role === 'TENANT_ADMIN'}
                onNavigateToAsset={(id) => handleNavigate('asset-detail', id)}
              />
            )}

            {currentView === 'asset-add' && (
              <AssetFormView onNavigate={handleNavigate} />
            )}

            {currentView === 'asset-edit' && (
              <AssetFormView assetId={selectedAssetId} onNavigate={handleNavigate} />
            )}

            {currentView === 'asset-detail' && selectedAssetId && (
              <AssetDetailView assetId={selectedAssetId} onNavigate={handleNavigate} />
            )}

            {currentView === 'org-management' && (
              <OrganizationManager />
            )}

            {currentView === 'employees' && (
              <EmployeeListView onNavigate={handleNavigate} />
            )}

            {currentView === 'employee-add' && (
              <EmployeeFormView onNavigate={handleNavigate} />
            )}

            {currentView === 'employee-edit' && (
              <EmployeeFormView employeeId={selectedEmployeeId} onNavigate={handleNavigate} />
            )}

            {currentView === 'employee-detail' && selectedEmployeeId && (
              <EmployeeDetailView employeeId={selectedEmployeeId} onNavigate={handleNavigate} />
            )}

            {currentView === 'maintenance' && (
              <MaintenanceListView onNavigate={handleNavigate} />
            )}

            {currentView === 'maintenance-add' && (
              <MaintenanceFormView onNavigate={handleNavigate} />
            )}

            {currentView === 'maintenance-edit' && selectedMaintenanceId && (
              <MaintenanceFormView workOrderId={selectedMaintenanceId} onNavigate={handleNavigate} />
            )}

            {currentView === 'maintenance-detail' && selectedMaintenanceId && (
              <MaintenanceDetailView workOrderId={selectedMaintenanceId} onNavigate={handleNavigate} />
            )}

            {currentView === 'vendors' && (
              <VendorListView onNavigate={handleNavigate} />
            )}

            {currentView === 'contracts' && token && (
              <ContractListView
                token={token}
                isTenantAdmin={role === 'TENANT_ADMIN'}
                onNavigateToAsset={(id) => handleNavigate('asset-detail', id)}
              />
            )}

            {currentView === 'licenses' && token && (
              <LicenseListView
                token={token}
                isTenantAdmin={role === 'TENANT_ADMIN'}
                onNavigateToAsset={(id) => handleNavigate('asset-detail', id)}
                onNavigateToEmployee={(id) => handleNavigate('employee-detail', id)}
              />
            )}

            {currentView === 'alerts' && token && (
              <AlertsView
                token={token}
                onNavigateToAsset={(id) => handleNavigate('asset-detail', id)}
                onNavigateToView={(view) => handleNavigate(view)}
              />
            )}

            {/* Phase 6 Views */}
            {currentView === 'reports' && token && (
              <ReportsView
                token={token}
                onNavigateToAsset={(id) => handleNavigate('asset-detail', id)}
              />
            )}

            {currentView === 'tenant-users' && token && (
              <TenantUsersView
                token={token}
                currentUserRole={(role as any) || 'MEMBER'}
                currentUserId={user.id}
                onNavigateToEmployee={(id) => handleNavigate('employee-detail', id)}
              />
            )}

            {currentView === 'csv-import' && token && (
              <ImportCenterView
                token={token}
                onNavigateToView={(v) => handleNavigate(v)}
              />
            )}

            {currentView === 'audit-log' && token && (
              <AuditLogView
                token={token}
                onNavigateToAsset={(id) => handleNavigate('asset-detail', id)}
              />
            )}

            {currentView === 'tenant-settings' && token && (
              <TenantSettingsView
                token={token}
                currentUserRole={(role as any) || 'MEMBER'}
                onNavigateToUsers={() => handleNavigate('tenant-users')}
              />
            )}

            {currentView === 'platform-admin' && token && (
              <PlatformAdminView token={token} />
            )}
          </Suspense>
        </main>
      </div>

      {showSetupModal && import.meta.env.DEV && (
        <SetupRequired isModal onClose={() => setShowSetupModal(false)} />
      )}

      {showBarcodeModal && (
        <Suspense fallback={null}>
          <BarcodeLabelModal
            assets={barcodeAssets}
            companyName={companyName || 'AssetMT'}
            onClose={() => setShowBarcodeModal(false)}
            onSelectAsset={(id) => {
              setShowBarcodeModal(false);
              handleNavigate('asset-detail', id);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
