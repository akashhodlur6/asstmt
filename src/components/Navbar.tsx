/**
 * AssetMT - Enterprise Top Bar
 * Top Bar Contract: Workspace Context / Navigation Breadcrumb / User & System Controls
 */

import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { LogOut, Building, ShieldCheck, Database, Wrench, User } from 'lucide-react';

interface NavbarProps {
  currentView: string;
  onOpenSetup?: () => void;
  onNavigate?: (view: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onOpenSetup, onNavigate }) => {
  const { user, companyName, role, signOut, isConfigured } = useAuth();

  const getViewDetails = () => {
    switch (currentView) {
      case 'dashboard':
        return { title: 'Dashboard', subtitle: "Overview of your organization's assets and operations" };
      case 'assets':
        return { title: 'Asset Registry', subtitle: 'Cataloged hardware, equipment, and organizational assets' };
      case 'asset-add':
        return { title: 'Add New Asset', subtitle: 'Register and assign a new asset to your workspace' };
      case 'asset-edit':
        return { title: 'Edit Asset', subtitle: 'Update specifications, custody, or financial data' };
      case 'asset-detail':
        return { title: 'Asset Record', subtitle: 'Complete lifecycle history, assignments, and audit trails' };
      case 'inventory':
        return { title: 'Consumable Inventory', subtitle: 'Quantity-tracked parts, supplies, and stock movements' };
      case 'audits':
        return { title: 'Physical Audits', subtitle: 'Barcode scanning, physical count verification, and discrepancy tracking' };
      case 'employees':
        return { title: 'Employee Directory', subtitle: 'Staff profiles, departmental units, and asset assignments' };
      case 'employee-add':
        return { title: 'Add Employee', subtitle: 'Create an employee record for asset assignment' };
      case 'employee-edit':
        return { title: 'Edit Employee', subtitle: 'Update employee profile details' };
      case 'employee-detail':
        return { title: 'Employee Record', subtitle: 'Assigned assets, custody transfers, and history' };
      case 'maintenance':
        return { title: 'Maintenance Management', subtitle: 'Work orders, preventative service schedules, and repair expenditures' };
      case 'vendors':
        return { title: 'Vendors & Suppliers', subtitle: 'Equipment manufacturers, service providers, and contacts' };
      case 'contracts':
        return { title: 'Contract Management', subtitle: 'Vendor agreements, renewal milestones, and multi-asset coverage' };
      case 'licenses':
        return { title: 'Software Licenses', subtitle: 'Seat quotas, license keys, and allocation to assets or employees' };
      case 'alerts':
        return { title: 'Alerts & Attention Center', subtitle: 'Overdue service, approaching warranties, and low inventory thresholds' };
      case 'reports':
        return { title: 'Reports Center', subtitle: 'Operational analytics, cost summaries, and audit logs' };
      case 'audit-log':
        return { title: 'Global Audit Log', subtitle: 'Immutable server-side activity history across all modules' };
      case 'csv-import':
        return { title: 'CSV Import Center', subtitle: 'Batch import assets, employees, and inventory records' };
      case 'tenant-settings':
        return { title: 'Tenant Settings', subtitle: 'Company branding, currency preferences, and tag numbering' };
      case 'tenant-users':
        return { title: 'Users & Roles', subtitle: 'Team memberships, invitations, and role-based permissions' };
      case 'org-management':
        return { title: 'Sites, Depts & Fields', subtitle: 'Locations, organizational hierarchies, and custom fields' };
      case 'platform-admin':
        return { title: 'Platform Owner Portal', subtitle: 'Global multi-tenant governance and infrastructure telemetry' };
      default:
        return { title: 'Workspace', subtitle: 'AssetMT enterprise workspace' };
    }
  };

  const { title, subtitle } = getViewDetails();

  const getRoleLabel = () => {
    if (role === 'TENANT_ADMIN') return 'Tenant Admin';
    if (role === 'TECHNICIAN') return 'Technician';
    return 'Member';
  };

  return (
    <header className="h-14 bg-white border-b border-neutral-200/80 px-6 flex items-center justify-between sticky top-0 z-10 select-none shrink-0">
      {/* Zone 1: Workspace Context & Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        {companyName ? (
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-6 h-6 rounded bg-neutral-100 flex items-center justify-center text-neutral-600">
              <Building className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-neutral-900 max-w-[140px] sm:max-w-[200px] truncate">
              {companyName}
            </span>
            <span className="text-[10px] text-orange-700 bg-orange-50 border border-orange-200/70 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-[#FF6A1A]" />
              <span>{getRoleLabel()}</span>
            </span>
          </div>
        ) : (
          <span className="text-xs text-neutral-400 italic">AssetMT Workspace</span>
        )}

        <span className="text-neutral-300 hidden md:inline">/</span>

        {/* Current View Breadcrumb */}
        <div className="hidden md:flex flex-col min-w-0">
          <span className="text-xs font-semibold text-neutral-900 tracking-tight leading-none">
            {title}
          </span>
          <span className="text-[10px] text-neutral-400 truncate mt-0.5 max-w-sm">
            {subtitle}
          </span>
        </div>
      </div>

      {/* Zone 3: System Status & User Actions */}
      <div className="flex items-center gap-3 shrink-0">
        {import.meta.env.DEV && onOpenSetup && (
          <button
            onClick={onOpenSetup}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 border cursor-pointer ${
              isConfigured
                ? 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                : 'border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100'
            }`}
            title="Developer Database Setup"
          >
            <Database className="w-3.5 h-3.5 text-neutral-500" />
            <span className="hidden sm:inline">Developer Setup</span>
          </button>
        )}

        {user && (
          <div className="flex items-center gap-3 pl-3 border-l border-neutral-200">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-medium text-neutral-800 max-w-[180px] truncate">
                {user.email}
              </div>
              <div className="text-[10px] text-neutral-400 font-mono">
                {user.id.slice(0, 8)}
              </div>
            </div>

            <button
              onClick={() => signOut()}
              className="p-1.5 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
