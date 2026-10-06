/**
 * AssetMT - Enterprise Dark Sidebar
 * Premium B2B SaaS Dark Theme (#0B0F14) with Akshigo Orange (#FF6A1A) Accents
 */

import React, { useState } from 'react';
import {
  LayoutDashboard,
  List,
  PlusCircle,
  MapPin,
  QrCode,
  Wrench,
  Boxes,
  ClipboardCheck,
  Users,
  Building2,
  KeyRound,
  BellRing,
  ShieldCheck,
  BarChart3,
  FileCheck2,
  FileSpreadsheet,
  Settings,
  UserCheck,
  Server,
  ChevronLeft,
  ChevronRight,
  Shield,
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
  onOpenBarcodeModal?: () => void;
  alertCount?: number;
  isPlatformAdmin?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  onOpenBarcodeModal,
  alertCount = 0,
  isPlatformAdmin = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Group 1: OVERVIEW
  const overviewGroup = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'alerts', label: 'Alerts & Expiry', icon: BellRing, badge: alertCount > 0 ? alertCount : undefined },
  ];

  // Group 2: ASSET MANAGEMENT
  const assetManagementGroup = [
    { id: 'assets', label: 'List of Assets', icon: List },
    { id: 'asset-add', label: 'Add Asset', icon: PlusCircle },
    { id: 'inventory', label: 'Inventory / Stock', icon: Boxes },
    { id: 'audits', label: 'Physical Audits', icon: ClipboardCheck },
    { id: 'org-management', label: 'Sites, Depts & Fields', icon: MapPin },
  ];

  // Group 3: PEOPLE
  const peopleGroup = [
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'tenant-users', label: 'Users & Roles', icon: UserCheck },
  ];

  // Group 4: OPERATIONS
  const operationsGroup = [
    { id: 'maintenance', label: 'Maintenance', icon: Wrench },
    { id: 'vendors', label: 'Vendors', icon: Building2 },
    { id: 'contracts', label: 'Contracts', icon: FileCheck2 },
    { id: 'licenses', label: 'Software Licenses', icon: KeyRound },
  ];

  // Group 5: INTELLIGENCE
  const intelligenceGroup = [
    { id: 'reports', label: 'Reports Center', icon: BarChart3 },
    { id: 'audit-log', label: 'Global Audit Log', icon: ShieldCheck },
  ];

  // Group 6: ADMINISTRATION
  const administrationGroup = [
    { id: 'csv-import', label: 'CSV Import Center', icon: FileSpreadsheet },
    { id: 'tenant-settings', label: 'Tenant Settings', icon: Settings },
  ];

  const checkIsActive = (id: string) => {
    if (currentView === id) return true;
    if (id === 'assets' && (currentView === 'asset-detail' || currentView === 'asset-edit')) return true;
    if (id === 'employees' && (currentView === 'employee-detail' || currentView === 'employee-edit' || currentView === 'employee-add')) return true;
    if (id === 'maintenance' && (currentView === 'maintenance-detail' || currentView === 'maintenance-edit' || currentView === 'maintenance-add')) return true;
    return false;
  };

  const renderNavItem = (item: { id: string; label: string; icon: React.ElementType; badge?: number }) => {
    const Icon = item.icon;
    const isActive = checkIsActive(item.id);

    return (
      <button
        key={item.id}
        onClick={() => onSelectView(item.id)}
        title={isCollapsed ? item.label : undefined}
        className={`w-full flex items-center relative transition-all duration-150 rounded-lg text-xs font-medium cursor-pointer ${
          isCollapsed ? 'justify-center p-2.5 my-0.5' : 'justify-between px-3 py-2 my-0.5'
        } ${
          isActive
            ? 'bg-[#141A22] text-white font-semibold shadow-xs'
            : 'text-neutral-400 hover:bg-[#141A22] hover:text-neutral-200'
        }`}
      >
        {/* Subtle orange active left indicator */}
        {isActive && (
          <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#FF6A1A] rounded-r" />
        )}

        <div className={`flex items-center gap-2.5 ${isCollapsed ? 'justify-center' : ''}`}>
          <Icon
            className={`w-4 h-4 shrink-0 transition-colors ${
              isActive ? 'text-[#FF6A1A]' : 'text-neutral-500 group-hover:text-neutral-300'
            }`}
          />
          {!isCollapsed && <span className="truncate">{item.label}</span>}
        </div>

        {!isCollapsed && item.badge !== undefined && (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FF6A1A] text-white">
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <aside
      className={`bg-[#0B0F14] border-r border-neutral-800/80 flex flex-col justify-between shrink-0 h-screen select-none transition-all duration-200 z-20 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Top Header & Navigation */}
      <div className="flex flex-col h-full overflow-hidden">
        {/* SIDEBAR BRAND LOCKUP */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-neutral-800/80 shrink-0">
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5">
              {/* AssetMT Logo Icon */}
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#141A22] to-[#1B232E] border border-neutral-800 flex items-center justify-center shadow-xs shrink-0">
                <span className="font-mono font-bold text-xs text-[#FF6A1A] tracking-tighter">A</span>
                <span className="font-mono font-bold text-xs text-white tracking-tighter">MT</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight text-white leading-none">
                  Asset<span className="text-[#FF6A1A]">MT</span>
                </span>
                <span className="text-[10px] font-medium text-neutral-500 tracking-normal mt-0.5">
                  Asset Management
                </span>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 mx-auto rounded-lg bg-[#141A22] border border-neutral-800 flex items-center justify-center">
              <span className="font-mono font-bold text-xs text-[#FF6A1A]">A</span>
            </div>
          )}

          {/* Collapse Toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded text-neutral-500 hover:text-neutral-300 hover:bg-[#141A22] transition-colors"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* SCROLLABLE NAVIGATION GROUPS */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 scrollbar-thin scrollbar-thumb-neutral-800">
          {/* 1. OVERVIEW */}
          <div>
            {!isCollapsed && (
              <div className="px-3 mb-1 text-[10px] font-semibold text-neutral-500 tracking-widest uppercase">
                Overview
              </div>
            )}
            <nav className="flex flex-col gap-0.5">{overviewGroup.map(renderNavItem)}</nav>
          </div>

          {/* 2. ASSET MANAGEMENT */}
          <div>
            {!isCollapsed && (
              <div className="px-3 mb-1 text-[10px] font-semibold text-neutral-500 tracking-widest uppercase">
                Asset Management
              </div>
            )}
            <nav className="flex flex-col gap-0.5">
              {assetManagementGroup.map(renderNavItem)}
              {onOpenBarcodeModal && (
                <button
                  type="button"
                  onClick={onOpenBarcodeModal}
                  title={isCollapsed ? 'Barcode & QR Labels' : undefined}
                  className={`w-full flex items-center relative transition-all duration-150 rounded-lg text-xs font-medium cursor-pointer text-neutral-400 hover:bg-[#141A22] hover:text-neutral-200 ${
                    isCollapsed ? 'justify-center p-2.5 my-0.5' : 'justify-start px-3 py-2 my-0.5 gap-2.5'
                  }`}
                >
                  <QrCode className="w-4 h-4 shrink-0 text-neutral-500" />
                  {!isCollapsed && <span>Barcode & QR Labels</span>}
                </button>
              )}
            </nav>
          </div>

          {/* 3. PEOPLE */}
          <div>
            {!isCollapsed && (
              <div className="px-3 mb-1 text-[10px] font-semibold text-neutral-500 tracking-widest uppercase">
                People
              </div>
            )}
            <nav className="flex flex-col gap-0.5">{peopleGroup.map(renderNavItem)}</nav>
          </div>

          {/* 4. OPERATIONS */}
          <div>
            {!isCollapsed && (
              <div className="px-3 mb-1 text-[10px] font-semibold text-neutral-500 tracking-widest uppercase">
                Operations
              </div>
            )}
            <nav className="flex flex-col gap-0.5">{operationsGroup.map(renderNavItem)}</nav>
          </div>

          {/* 5. INTELLIGENCE */}
          <div>
            {!isCollapsed && (
              <div className="px-3 mb-1 text-[10px] font-semibold text-neutral-500 tracking-widest uppercase">
                Intelligence
              </div>
            )}
            <nav className="flex flex-col gap-0.5">{intelligenceGroup.map(renderNavItem)}</nav>
          </div>

          {/* 6. ADMINISTRATION */}
          <div>
            {!isCollapsed && (
              <div className="px-3 mb-1 text-[10px] font-semibold text-neutral-500 tracking-widest uppercase">
                Administration
              </div>
            )}
            <nav className="flex flex-col gap-0.5">
              {administrationGroup.map(renderNavItem)}

              {isPlatformAdmin && (
                <button
                  onClick={() => onSelectView('platform-admin')}
                  title={isCollapsed ? 'Platform Owner Portal' : undefined}
                  className={`w-full flex items-center relative transition-all duration-150 rounded-lg text-xs font-medium cursor-pointer ${
                    isCollapsed ? 'justify-center p-2.5 my-0.5' : 'justify-start px-3 py-2 my-0.5 gap-2.5'
                  } ${
                    currentView === 'platform-admin'
                      ? 'bg-purple-950/40 text-purple-300 font-semibold border-l-2 border-purple-500'
                      : 'text-purple-400/80 hover:bg-[#141A22] hover:text-purple-300'
                  }`}
                >
                  <Server className="w-4 h-4 shrink-0 text-purple-400" />
                  {!isCollapsed && <span>Platform Owner Portal</span>}
                </button>
              )}
            </nav>
          </div>
        </div>
      </div>

      {/* FOOTER: AKSHIGO BRANDING & STATUS */}
      <div className="p-3 border-t border-neutral-800/80 bg-[#0B0F14] text-neutral-500 shrink-0">
        {!isCollapsed ? (
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 font-medium text-neutral-400">
              <Shield className="w-3.5 h-3.5 text-[#FF6A1A]" />
              <span>AssetMT SaaS</span>
            </div>
            <span className="text-[10px] font-mono text-neutral-600">v1.0 Pro</span>
          </div>
        ) : (
          <div className="flex justify-center">
            <span className="w-2 h-2 rounded-full bg-emerald-500" title="Online" />
          </div>
        )}
      </div>
    </aside>
  );
};
