/**
 * AssetMT - Enterprise Maintenance Form View (Page wrapper)
 * Supports creating new work orders or editing existing work orders.
 */

import React, { useEffect, useState } from 'react';
import { MaintenanceFormModal } from './MaintenanceFormModal.tsx';
import { MaintenanceRecord } from '../../shared/types.ts';
import { api } from '../lib/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { ArrowLeft, RefreshCw } from 'lucide-react';

interface MaintenanceFormViewProps {
  workOrderId?: string;
  initialAssetId?: string;
  onNavigate: (view: string, entityId?: string) => void;
}

export const MaintenanceFormView: React.FC<MaintenanceFormViewProps> = ({
  workOrderId,
  initialAssetId,
  onNavigate,
}) => {
  const { token } = useAuth();
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [loading, setLoading] = useState(Boolean(workOrderId));

  useEffect(() => {
    if (!token || !workOrderId) return;
    setLoading(true);
    api
      .getMaintenanceRecord(token, workOrderId)
      .then((res) => {
        if (res.success) {
          setEditingRecord(res.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, workOrderId]);

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto flex items-center justify-center min-h-[300px]">
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <RefreshCw className="w-4 h-4 animate-spin text-[#FF6A1A]" />
          <span>Loading work order details...</span>
        </div>
      </div>
    );
  }

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
        <span className="font-semibold text-neutral-800">
          {workOrderId ? 'Edit Work Order' : 'New Work Order'}
        </span>
      </div>

      <MaintenanceFormModal
        initialAssetId={initialAssetId}
        editingRecord={editingRecord}
        onClose={() => onNavigate('maintenance')}
        onSuccess={(rec) => onNavigate('maintenance-detail', rec.id)}
      />
    </div>
  );
};
