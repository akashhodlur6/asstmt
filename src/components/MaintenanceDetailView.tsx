/**
 * AssetMT - Enterprise Maintenance Detail View (Page wrapper)
 * Renders full page maintenance detail with breadcrumbs, workflow actions, and audit trail.
 */

import React from 'react';
import { MaintenanceDetailModal } from './MaintenanceDetailModal.tsx';
import { ArrowLeft, Wrench } from 'lucide-react';

interface MaintenanceDetailViewProps {
  workOrderId: string;
  onNavigate: (view: string, entityId?: string) => void;
}

export const MaintenanceDetailView: React.FC<MaintenanceDetailViewProps> = ({
  workOrderId,
  onNavigate,
}) => {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <button
          onClick={() => onNavigate('maintenance')}
          className="hover:text-neutral-900 inline-flex items-center gap-1 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Work Orders</span>
        </button>
        <span>/</span>
        <span className="font-mono text-neutral-800">WO Details</span>
      </div>

      <MaintenanceDetailModal
        workOrderId={workOrderId}
        onClose={() => onNavigate('maintenance')}
        onNavigateToAsset={(aid) => onNavigate('asset-detail', aid)}
        onRecordUpdated={() => {}}
        onOpenEdit={(r) => onNavigate('maintenance-edit', r.id)}
      />
    </div>
  );
};
