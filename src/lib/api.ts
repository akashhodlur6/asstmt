/**
 * AssetMT - Frontend API Client
 * Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
 */

import {
  Asset,
  AssetEvent,
  Category,
  CreateAssetInput,
  CreateDepartmentInput,
  CreateEmployeeInput,
  CreateWorkspaceInput,
  DashboardMetrics,
  Department,
  Employee,
  Location,
  Membership,
  Site,
  UpdateAssetInput,
  UpdateDepartmentInput,
  UpdateEmployeeInput,
  CheckoutInput,
  CheckinInput,
  TransferInput,
  AssetAssignment,
  Vendor,
  CreateVendorInput,
  UpdateVendorInput,
  MaintenanceRecord,
  CreateMaintenanceInput,
  UpdateMaintenanceInput,
  ScheduleMaintenanceInput,
  StartMaintenanceInput,
  CompleteMaintenanceInput,
  CancelMaintenanceInput,
  MaintenanceMetricsSummary,
  InventoryItem,
  InventoryTransaction,
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
  InventoryStockMovementInput,
  AssetReservation,
  CreateReservationInput,
  AssetLease,
  CreateLeaseInput,
  ReturnLeaseInput,
  AssetLocationHistory,
  MoveAssetInput,
  AssetDisposal,
  DisposeAssetInput,
  AssetRelationship,
  CreateAssetRelationshipInput,
  AuditSession,
  AuditSessionItem,
  CreateAuditSessionInput,
  ScanAuditItemInput,
  CompleteAuditSessionInput,
  AssetDepreciation,
  ConfigureDepreciationInput,
  DepreciationSchedulePeriod,
  AssetWarranty,
  CreateWarrantyInput,
  UpdateWarrantyInput,
  Contract,
  CreateContractInput,
  UpdateContractInput,
  SoftwareLicense,
  SoftwareLicenseAllocation,
  CreateLicenseInput,
  UpdateLicenseInput,
  AllocateLicenseInput,
  InsurancePolicy,
  CreateInsurancePolicyInput,
  AssetPurchase,
  UpsertAssetPurchaseInput,
  DocumentRecord,
  CreateDocumentInput,
  CustomFieldDefinition,
  CreateCustomFieldDefinitionInput,
  SystemAlert,
  TenantInvitation,
  CreateTenantInvitationInput,
  UpdateTenantUserRoleInput,
  LinkUserEmployeeInput,
  TenantSettings,
  UpdateTenantSettingsInput,
  PlatformTenantItem,
  TenantUsageSummary,
  ReportFilterOptions,
  ReportResult,
  ImportTarget,
  ImportPreviewResponse,
  CommitImportResponse,
  AuditLogFilterOptions,
  StorageUploadResponse,
  AcceptInvitationResponse,
  AkshigoHandoffPayload,
  AkshigoHandoffResponse,
} from '../../shared/types.ts';

import { getActiveSupabaseConfig } from './supabase.ts';

async function fetchWithAuth<T>(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  // Ensure Worker receives the exact active Supabase project endpoint
  const activeCfg = getActiveSupabaseConfig();
  if (activeCfg) {
    headers.set('x-supabase-url', activeCfg.url);
    headers.set('x-supabase-anon-key', activeCfg.anonKey);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.message || data?.error || `Request failed with status ${response.status}`;
    const error = new Error(errorMsg);
    (error as unknown as { status: number; data: unknown }).status = response.status;
    (error as unknown as { status: number; data: unknown }).data = data;
    throw error;
  }

  return data;
}

export const api = {
  async getConfigStatus(): Promise<{ success: boolean; configured: boolean }> {
    try {
      const res = await fetch('/api/config-status');
      return await res.json();
    } catch {
      return { success: false, configured: false };
    }
  },

  async getWorkspace(token: string): Promise<{
    success: boolean;
    hasWorkspace: boolean;
    membership: Membership | null;
    user: { id: string; email?: string };
  }> {
    return fetchWithAuth('/api/workspace', token);
  },

  async createWorkspace(
    token: string,
    input: CreateWorkspaceInput
  ): Promise<{ success: boolean; membership: Membership; result: unknown }> {
    return fetchWithAuth('/api/workspace', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async getDashboard(token: string): Promise<{
    success: boolean;
    data: DashboardMetrics;
  }> {
    return fetchWithAuth('/api/dashboard', token);
  },

  async getAssets(
    token: string,
    params: {
      search?: string;
      category_id?: string;
      site_id?: string;
      location_id?: string;
      status?: string;
      sort_by?: string;
      sort_order?: 'asc' | 'desc';
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{
    success: boolean;
    data: Asset[];
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
    };
  }> {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.category_id) query.set('category_id', params.category_id);
    if (params.site_id) query.set('site_id', params.site_id);
    if (params.location_id) query.set('location_id', params.location_id);
    if (params.status) query.set('status', params.status);
    if (params.sort_by) query.set('sort_by', params.sort_by);
    if (params.sort_order) query.set('sort_order', params.sort_order);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const qs = query.toString();
    const endpoint = `/api/assets${qs ? `?${qs}` : ''}`;
    return fetchWithAuth(endpoint, token);
  },

  async getAsset(
    token: string,
    id: string
  ): Promise<{
    success: boolean;
    data: Asset;
    history: AssetEvent[];
  }> {
    return fetchWithAuth(`/api/assets/${id}`, token);
  },

  async createAsset(
    token: string,
    input: CreateAssetInput
  ): Promise<{
    success: boolean;
    data: Asset;
  }> {
    return fetchWithAuth('/api/assets', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async updateAsset(
    token: string,
    id: string,
    input: UpdateAssetInput
  ): Promise<{
    success: boolean;
    data: Asset;
  }> {
    return fetchWithAuth(`/api/assets/${id}`, token, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  async getCategories(token: string): Promise<{ success: boolean; data: Category[] }> {
    return fetchWithAuth('/api/categories', token);
  },

  async createCategory(
    token: string,
    input: { name: string; description?: string; code?: string }
  ): Promise<{ success: boolean; data: Category }> {
    return fetchWithAuth('/api/categories', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async getSites(token: string): Promise<{ success: boolean; data: Site[] }> {
    return fetchWithAuth('/api/sites', token);
  },

  async createSite(
    token: string,
    input: { name: string; address?: string }
  ): Promise<{ success: boolean; data: Site }> {
    return fetchWithAuth('/api/sites', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async getLocations(
    token: string,
    siteId?: string
  ): Promise<{ success: boolean; data: Location[] }> {
    const qs = siteId ? `?site_id=${siteId}` : '';
    return fetchWithAuth(`/api/locations${qs}`, token);
  },

  async createLocation(
    token: string,
    input: { site_id: string; name: string; description?: string }
  ): Promise<{ success: boolean; data: Location }> {
    return fetchWithAuth('/api/locations', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async getDepartments(
    token: string,
    includeArchived = false
  ): Promise<{ success: boolean; data: Department[] }> {
    const qs = includeArchived ? '?include_archived=true' : '';
    return fetchWithAuth(`/api/departments${qs}`, token);
  },

  async createDepartment(
    token: string,
    input: CreateDepartmentInput
  ): Promise<{ success: boolean; data: Department }> {
    return fetchWithAuth('/api/departments', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async updateDepartment(
    token: string,
    id: string,
    input: UpdateDepartmentInput
  ): Promise<{ success: boolean; data: Department }> {
    return fetchWithAuth(`/api/departments/${id}`, token, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  async getEmployees(
    token: string,
    params: {
      search?: string;
      department_id?: string;
      site_id?: string;
      is_active?: string;
      sort_by?: string;
      sort_order?: 'asc' | 'desc';
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{
    success: boolean;
    data: Employee[];
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
    };
  }> {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.department_id) query.set('department_id', params.department_id);
    if (params.site_id) query.set('site_id', params.site_id);
    if (params.is_active) query.set('is_active', params.is_active);
    if (params.sort_by) query.set('sort_by', params.sort_by);
    if (params.sort_order) query.set('sort_order', params.sort_order);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const qs = query.toString();
    const endpoint = `/api/employees${qs ? `?${qs}` : ''}`;
    return fetchWithAuth(endpoint, token);
  },

  async getEmployee(
    token: string,
    id: string
  ): Promise<{
    success: boolean;
    data: Employee;
  }> {
    return fetchWithAuth(`/api/employees/${id}`, token);
  },

  async createEmployee(
    token: string,
    input: CreateEmployeeInput
  ): Promise<{
    success: boolean;
    data: Employee;
  }> {
    return fetchWithAuth('/api/employees', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async updateEmployee(
    token: string,
    id: string,
    input: UpdateEmployeeInput
  ): Promise<{
    success: boolean;
    data: Employee;
  }> {
    return fetchWithAuth(`/api/employees/${id}`, token, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  async toggleEmployeeActive(
    token: string,
    id: string,
    isActive?: boolean
  ): Promise<{
    success: boolean;
    data: Employee;
  }> {
    return fetchWithAuth(`/api/employees/${id}/toggle-active`, token, {
      method: 'POST',
      body: JSON.stringify({ is_active: isActive }),
    });
  },

  async checkoutAsset(
    token: string,
    assetId: string,
    input: CheckoutInput
  ): Promise<{
    success: boolean;
    data: AssetAssignment;
  }> {
    return fetchWithAuth(`/api/assets/${assetId}/checkout`, token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async checkinAsset(
    token: string,
    assetId: string,
    input: CheckinInput
  ): Promise<{
    success: boolean;
    data: AssetAssignment;
  }> {
    return fetchWithAuth(`/api/assets/${assetId}/checkin`, token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async transferAsset(
    token: string,
    assetId: string,
    input: TransferInput
  ): Promise<{
    success: boolean;
    data: AssetAssignment;
  }> {
    return fetchWithAuth(`/api/assets/${assetId}/transfer`, token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async getAssetAssignments(
    token: string,
    assetId: string
  ): Promise<{
    success: boolean;
    data: AssetAssignment[];
  }> {
    return fetchWithAuth(`/api/assets/${assetId}/assignments`, token);
  },

  async getEmployeeAssignments(
    token: string,
    employeeId: string
  ): Promise<{
    success: boolean;
    data: AssetAssignment[];
  }> {
    return fetchWithAuth(`/api/employees/${employeeId}/assignments`, token);
  },

  // --------------------------------------------------------------------------
  // Phase 3: Vendors API
  // --------------------------------------------------------------------------
  async getVendors(
    token: string,
    params: { search?: string; is_active?: string } = {}
  ): Promise<{ success: boolean; data: Vendor[] }> {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.is_active) query.set('is_active', params.is_active);
    const qs = query.toString();
    return fetchWithAuth(`/api/vendors${qs ? `?${qs}` : ''}`, token);
  },

  async getVendor(
    token: string,
    id: string
  ): Promise<{ success: boolean; data: Vendor; maintenanceCount: number }> {
    return fetchWithAuth(`/api/vendors/${id}`, token);
  },

  async createVendor(
    token: string,
    input: CreateVendorInput
  ): Promise<{ success: boolean; data: Vendor }> {
    return fetchWithAuth('/api/vendors', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async updateVendor(
    token: string,
    id: string,
    input: UpdateVendorInput
  ): Promise<{ success: boolean; data: Vendor }> {
    return fetchWithAuth(`/api/vendors/${id}`, token, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  async toggleVendorActive(
    token: string,
    id: string,
    isActive?: boolean
  ): Promise<{ success: boolean; data: Vendor }> {
    return fetchWithAuth(`/api/vendors/${id}/toggle-active`, token, {
      method: 'POST',
      body: JSON.stringify({ is_active: isActive }),
    });
  },

  // --------------------------------------------------------------------------
  // Phase 3: Maintenance & Work Orders API
  // --------------------------------------------------------------------------
  async getMaintenanceRecords(
    token: string,
    params: {
      search?: string;
      status?: string;
      priority?: string;
      maintenance_type?: string;
      asset_id?: string;
      vendor_id?: string;
      overdue?: string | boolean;
      sort_by?: string;
      sort_order?: 'asc' | 'desc';
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{
    success: boolean;
    data: MaintenanceRecord[];
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
    };
  }> {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    if (params.priority) query.set('priority', params.priority);
    if (params.maintenance_type) query.set('maintenance_type', params.maintenance_type);
    if (params.asset_id) query.set('asset_id', params.asset_id);
    if (params.vendor_id) query.set('vendor_id', params.vendor_id);
    if (params.overdue !== undefined && params.overdue !== null) query.set('overdue', String(params.overdue));
    if (params.sort_by) query.set('sort_by', params.sort_by);
    if (params.sort_order) query.set('sort_order', params.sort_order);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const qs = query.toString();
    return fetchWithAuth(`/api/maintenance${qs ? `?${qs}` : ''}`, token);
  },

  async getMaintenanceMetrics(
    token: string
  ): Promise<{ success: boolean; data: MaintenanceMetricsSummary }> {
    return fetchWithAuth('/api/maintenance/metrics', token);
  },

  async getMaintenanceRecord(
    token: string,
    id: string
  ): Promise<{
    success: boolean;
    data: MaintenanceRecord;
    events: AssetEvent[];
  }> {
    return fetchWithAuth(`/api/maintenance/${id}`, token);
  },

  async createMaintenanceRecord(
    token: string,
    input: CreateMaintenanceInput
  ): Promise<{ success: boolean; data: MaintenanceRecord }> {
    return fetchWithAuth('/api/maintenance', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async updateMaintenanceRecord(
    token: string,
    id: string,
    input: UpdateMaintenanceInput
  ): Promise<{ success: boolean; data: MaintenanceRecord }> {
    return fetchWithAuth(`/api/maintenance/${id}`, token, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  async scheduleMaintenance(
    token: string,
    id: string,
    input: ScheduleMaintenanceInput
  ): Promise<{ success: boolean; data: MaintenanceRecord }> {
    return fetchWithAuth(`/api/maintenance/${id}/schedule`, token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async startMaintenance(
    token: string,
    id: string,
    input: StartMaintenanceInput = {}
  ): Promise<{ success: boolean; data: MaintenanceRecord }> {
    return fetchWithAuth(`/api/maintenance/${id}/start`, token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async completeMaintenance(
    token: string,
    id: string,
    input: CompleteMaintenanceInput
  ): Promise<{ success: boolean; data: MaintenanceRecord }> {
    return fetchWithAuth(`/api/maintenance/${id}/complete`, token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async cancelMaintenance(
    token: string,
    id: string,
    input: CancelMaintenanceInput
  ): Promise<{ success: boolean; data: MaintenanceRecord }> {
    return fetchWithAuth(`/api/maintenance/${id}/cancel`, token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async getAssetMaintenanceHistory(
    token: string,
    assetId: string
  ): Promise<{ success: boolean; data: MaintenanceRecord[] }> {
    return fetchWithAuth(`/api/assets/${assetId}/maintenance`, token);
  },

  async getAssetMaintenance(
    token: string,
    assetId: string
  ): Promise<{ success: boolean; data: MaintenanceRecord[] }> {
    return this.getAssetMaintenanceHistory(token, assetId);
  },

  async getVendorMaintenanceHistory(
    token: string,
    vendorId: string
  ): Promise<{ success: boolean; data: MaintenanceRecord[] }> {
    return fetchWithAuth(`/api/vendors/${vendorId}/maintenance`, token);
  },

  // --------------------------------------------------------------------------
  // Phase 4: Inventory / Stock
  // --------------------------------------------------------------------------
  async getInventoryItems(
    token: string,
    params?: { search?: string; low_stock?: boolean; active?: boolean }
  ): Promise<{ success: boolean; data: InventoryItem[] }> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.low_stock) query.set('low_stock', 'true');
    if (params?.active !== undefined) query.set('active', String(params.active));
    const qs = query.toString();
    return fetchWithAuth(`/api/inventory${qs ? `?${qs}` : ''}`, token);
  },

  async getInventoryItem(
    token: string,
    id: string
  ): Promise<{ success: boolean; data: InventoryItem }> {
    return fetchWithAuth(`/api/inventory/${id}`, token);
  },

  async createInventoryItem(
    token: string,
    input: CreateInventoryItemInput
  ): Promise<{ success: boolean; data: InventoryItem }> {
    return fetchWithAuth('/api/inventory', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async updateInventoryItem(
    token: string,
    id: string,
    input: UpdateInventoryItemInput
  ): Promise<{ success: boolean; data: InventoryItem }> {
    return fetchWithAuth(`/api/inventory/${id}`, token, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  async recordStockMovement(
    token: string,
    id: string,
    input: InventoryStockMovementInput
  ): Promise<{ success: boolean; data: InventoryTransaction; item: InventoryItem }> {
    return fetchWithAuth(`/api/inventory/${id}/movement`, token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async getInventoryTransactions(
    token: string,
    itemId?: string
  ): Promise<{ success: boolean; data: InventoryTransaction[] }> {
    const qs = itemId ? `?item_id=${encodeURIComponent(itemId)}` : '';
    return fetchWithAuth(`/api/inventory-transactions${qs}`, token);
  },

  // --------------------------------------------------------------------------
  // Phase 4: Asset Reservations
  // --------------------------------------------------------------------------
  async getAssetReservations(
    token: string,
    assetId?: string
  ): Promise<{ success: boolean; data: AssetReservation[] }> {
    const qs = assetId ? `?asset_id=${encodeURIComponent(assetId)}` : '';
    return fetchWithAuth(`/api/reservations${qs}`, token);
  },

  async createReservation(
    token: string,
    input: CreateReservationInput
  ): Promise<{ success: boolean; data: AssetReservation }> {
    return fetchWithAuth('/api/reservations', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async cancelReservation(
    token: string,
    id: string
  ): Promise<{ success: boolean; data: AssetReservation }> {
    return fetchWithAuth(`/api/reservations/${id}/cancel`, token, {
      method: 'POST',
    });
  },

  async fulfillReservation(
    token: string,
    id: string
  ): Promise<{ success: boolean; data: AssetReservation }> {
    return fetchWithAuth(`/api/reservations/${id}/fulfill`, token, {
      method: 'POST',
    });
  },

  // --------------------------------------------------------------------------
  // Phase 4: Asset Leases
  // --------------------------------------------------------------------------
  async getAssetLeases(
    token: string,
    assetId?: string
  ): Promise<{ success: boolean; data: AssetLease[] }> {
    const qs = assetId ? `?asset_id=${encodeURIComponent(assetId)}` : '';
    return fetchWithAuth(`/api/leases${qs}`, token);
  },

  async createLease(
    token: string,
    input: CreateLeaseInput
  ): Promise<{ success: boolean; data: AssetLease }> {
    return fetchWithAuth('/api/leases', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async returnLease(
    token: string,
    id: string,
    input: ReturnLeaseInput
  ): Promise<{ success: boolean; data: AssetLease }> {
    return fetchWithAuth(`/api/leases/${id}/return`, token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // --------------------------------------------------------------------------
  // Phase 4: Asset Move & Location History
  // --------------------------------------------------------------------------
  async moveAsset(
    token: string,
    assetId: string,
    input: MoveAssetInput
  ): Promise<{ success: boolean; data: Asset; locationHistory: AssetLocationHistory }> {
    return fetchWithAuth(`/api/assets/${assetId}/move`, token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async getAssetLocationHistory(
    token: string,
    assetId: string
  ): Promise<{ success: boolean; data: AssetLocationHistory[] }> {
    return fetchWithAuth(`/api/assets/${assetId}/location-history`, token);
  },

  // --------------------------------------------------------------------------
  // Phase 4: Asset Disposal
  // --------------------------------------------------------------------------
  async disposeAsset(
    token: string,
    assetId: string,
    input: DisposeAssetInput
  ): Promise<{ success: boolean; data: Asset; disposal: AssetDisposal }> {
    return fetchWithAuth(`/api/assets/${assetId}/dispose`, token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async getAssetDisposal(
    token: string,
    assetId: string
  ): Promise<{ success: boolean; data: AssetDisposal | null }> {
    return fetchWithAuth(`/api/assets/${assetId}/disposal`, token);
  },

  // --------------------------------------------------------------------------
  // Phase 4: Linked / Related Assets
  // --------------------------------------------------------------------------
  async getAssetRelationships(
    token: string,
    assetId: string
  ): Promise<{ success: boolean; data: AssetRelationship[] }> {
    return fetchWithAuth(`/api/assets/${assetId}/relationships`, token);
  },

  async createAssetRelationship(
    token: string,
    assetId: string,
    input: CreateAssetRelationshipInput
  ): Promise<{ success: boolean; data: AssetRelationship }> {
    return fetchWithAuth(`/api/assets/${assetId}/relationships`, token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async deleteAssetRelationship(
    token: string,
    id: string
  ): Promise<{ success: boolean }> {
    return fetchWithAuth(`/api/relationships/${id}`, token, {
      method: 'DELETE',
    });
  },

  // --------------------------------------------------------------------------
  // Phase 4: Physical Asset Audits
  // --------------------------------------------------------------------------
  async getAuditSessions(
    token: string
  ): Promise<{ success: boolean; data: AuditSession[] }> {
    return fetchWithAuth('/api/audits', token);
  },

  async getAuditSession(
    token: string,
    id: string
  ): Promise<{ success: boolean; data: AuditSession; items: AuditSessionItem[] }> {
    return fetchWithAuth(`/api/audits/${id}`, token);
  },

  async createAuditSession(
    token: string,
    input: CreateAuditSessionInput
  ): Promise<{ success: boolean; data: AuditSession }> {
    return fetchWithAuth('/api/audits', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async scanAuditItem(
    token: string,
    sessionId: string,
    input: ScanAuditItemInput
  ): Promise<{ success: boolean; data: AuditSessionItem }> {
    return fetchWithAuth(`/api/audits/${sessionId}/scan`, token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async completeAuditSession(
    token: string,
    sessionId: string,
    input?: CompleteAuditSessionInput
  ): Promise<{ success: boolean; data: AuditSession }> {
    return fetchWithAuth(`/api/audits/${sessionId}/complete`, token, {
      method: 'POST',
      body: JSON.stringify(input || {}),
    });
  },

  // --------------------------------------------------------------------------
  // Phase 5: Depreciation
  // --------------------------------------------------------------------------
  async getDepreciation(
    token: string,
    assetId: string
  ): Promise<{ success: boolean; data: { config: AssetDepreciation; calculation: any }; error?: string }> {
    return fetchWithAuth(`/api/assets/${assetId}/depreciation`, token);
  },

  async configureDepreciation(
    token: string,
    assetId: string,
    input: ConfigureDepreciationInput
  ): Promise<{ success: boolean; data: { config: AssetDepreciation; calculation: any }; error?: string }> {
    return fetchWithAuth(`/api/assets/${assetId}/depreciation`, token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // --------------------------------------------------------------------------
  // Phase 5: Warranties
  // --------------------------------------------------------------------------
  async getWarranties(
    token: string,
    assetId?: string
  ): Promise<{ success: boolean; data: AssetWarranty[]; error?: string }> {
    const url = assetId ? `/api/warranties?asset_id=${assetId}` : '/api/warranties';
    return fetchWithAuth(url, token);
  },

  async createWarranty(
    token: string,
    input: CreateWarrantyInput
  ): Promise<{ success: boolean; data: AssetWarranty; error?: string }> {
    return fetchWithAuth('/api/warranties', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async updateWarranty(
    token: string,
    id: string,
    input: UpdateWarrantyInput
  ): Promise<{ success: boolean; data: AssetWarranty; error?: string }> {
    return fetchWithAuth(`/api/warranties/${id}`, token, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  // --------------------------------------------------------------------------
  // Phase 5: Contracts
  // --------------------------------------------------------------------------
  async getContracts(
    token: string
  ): Promise<{ success: boolean; data: Contract[]; error?: string }> {
    return fetchWithAuth('/api/contracts', token);
  },

  async getContract(
    token: string,
    id: string
  ): Promise<{ success: boolean; data: Contract; error?: string }> {
    return fetchWithAuth(`/api/contracts/${id}`, token);
  },

  async createContract(
    token: string,
    input: CreateContractInput
  ): Promise<{ success: boolean; data: Contract; error?: string }> {
    return fetchWithAuth('/api/contracts', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async updateContract(
    token: string,
    id: string,
    input: UpdateContractInput
  ): Promise<{ success: boolean; data: Contract; error?: string }> {
    return fetchWithAuth(`/api/contracts/${id}`, token, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  async linkContractAsset(
    token: string,
    contractId: string,
    assetId: string
  ): Promise<{ success: boolean; message: string; error?: string }> {
    return fetchWithAuth(`/api/contracts/${contractId}/link-asset`, token, {
      method: 'POST',
      body: JSON.stringify({ asset_id: assetId }),
    });
  },

  // --------------------------------------------------------------------------
  // Phase 5: Software Licenses
  // --------------------------------------------------------------------------
  async getLicenses(
    token: string
  ): Promise<{ success: boolean; data: SoftwareLicense[]; error?: string }> {
    return fetchWithAuth('/api/licenses', token);
  },

  async getLicense(
    token: string,
    id: string
  ): Promise<{ success: boolean; data: SoftwareLicense; error?: string }> {
    return fetchWithAuth(`/api/licenses/${id}`, token);
  },

  async createLicense(
    token: string,
    input: CreateLicenseInput
  ): Promise<{ success: boolean; data: SoftwareLicense; error?: string }> {
    return fetchWithAuth('/api/licenses', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async allocateLicense(
    token: string,
    licenseId: string,
    input: AllocateLicenseInput
  ): Promise<{ success: boolean; data: SoftwareLicenseAllocation; error?: string }> {
    return fetchWithAuth(`/api/licenses/${licenseId}/allocate`, token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async releaseLicense(
    token: string,
    licenseId: string,
    allocationId: string
  ): Promise<{ success: boolean; data: SoftwareLicenseAllocation; error?: string }> {
    return fetchWithAuth(`/api/licenses/${licenseId}/allocations/${allocationId}/release`, token, {
      method: 'POST',
    });
  },

  // --------------------------------------------------------------------------
  // Phase 5: Insurance Policies
  // --------------------------------------------------------------------------
  async getInsurancePolicies(
    token: string
  ): Promise<{ success: boolean; data: InsurancePolicy[]; error?: string }> {
    return fetchWithAuth('/api/insurance', token);
  },

  async createInsurancePolicy(
    token: string,
    input: CreateInsurancePolicyInput
  ): Promise<{ success: boolean; data: InsurancePolicy; error?: string }> {
    return fetchWithAuth('/api/insurance', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // --------------------------------------------------------------------------
  // Phase 5: Asset Purchase & Acquisition
  // --------------------------------------------------------------------------
  async getAssetPurchase(
    token: string,
    assetId: string
  ): Promise<{ success: boolean; data: AssetPurchase; error?: string }> {
    return fetchWithAuth(`/api/assets/${assetId}/purchase`, token);
  },

  async saveAssetPurchase(
    token: string,
    assetId: string,
    input: UpsertAssetPurchaseInput
  ): Promise<{ success: boolean; data: AssetPurchase; error?: string }> {
    return fetchWithAuth(`/api/assets/${assetId}/purchase`, token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // --------------------------------------------------------------------------
  // Phase 5: Documents & Attachments
  // --------------------------------------------------------------------------
  async getDocuments(
    token: string,
    entityType: string,
    entityId: string
  ): Promise<{ success: boolean; data: DocumentRecord[]; error?: string }> {
    return fetchWithAuth(`/api/documents?entity_type=${entityType}&entity_id=${entityId}`, token);
  },

  async createDocument(
    token: string,
    input: CreateDocumentInput
  ): Promise<{ success: boolean; data: DocumentRecord; error?: string }> {
    return fetchWithAuth('/api/documents', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async deleteDocument(
    token: string,
    id: string
  ): Promise<{ success: boolean; message: string; error?: string }> {
    return fetchWithAuth(`/api/documents/${id}`, token, {
      method: 'DELETE',
    });
  },

  // --------------------------------------------------------------------------
  // Phase 5: Custom Fields
  // --------------------------------------------------------------------------
  async getCustomFieldDefinitions(
    token: string
  ): Promise<{ success: boolean; data: CustomFieldDefinition[]; error?: string }> {
    return fetchWithAuth('/api/custom-fields/definitions', token);
  },

  async createCustomFieldDefinition(
    token: string,
    input: CreateCustomFieldDefinitionInput
  ): Promise<{ success: boolean; data: CustomFieldDefinition; error?: string }> {
    return fetchWithAuth('/api/custom-fields/definitions', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async getAssetCustomFields(
    token: string,
    assetId: string
  ): Promise<{ success: boolean; data: Array<{ definition: CustomFieldDefinition; value: string }>; error?: string }> {
    return fetchWithAuth(`/api/assets/${assetId}/custom-fields`, token);
  },

  async saveAssetCustomFields(
    token: string,
    assetId: string,
    values: Array<{ field_definition_id: string; field_value: string }>
  ): Promise<{ success: boolean; message: string; error?: string }> {
    return fetchWithAuth(`/api/assets/${assetId}/custom-fields`, token, {
      method: 'POST',
      body: JSON.stringify({ values }),
    });
  },

  // --------------------------------------------------------------------------
  // Phase 5: Alerts & Expiry Center
  // --------------------------------------------------------------------------
  async getAlerts(
    token: string
  ): Promise<{
    success: boolean;
    data: {
      alerts: SystemAlert[];
      totalAlerts: number;
      summaryByWindow: { OVERDUE: number; NEXT_7_DAYS: number; NEXT_30_DAYS: number; NEXT_60_90_DAYS: number };
      summaryByCategory: Record<string, number>;
    };
    error?: string;
  }> {
    return fetchWithAuth('/api/alerts', token);
  },

  // --------------------------------------------------------------------------
  // Phase 6: Tenant Application Users & Invitations
  // --------------------------------------------------------------------------
  async getTenantUsers(
    token: string
  ): Promise<{
    success: boolean;
    data: {
      users: Array<Membership & { email?: string; company_name?: string }>;
      invitations: TenantInvitation[];
    };
    error?: string;
  }> {
    return fetchWithAuth('/api/tenant-users', token);
  },

  async inviteUser(
    token: string,
    input: CreateTenantInvitationInput
  ): Promise<{ success: boolean; data: TenantInvitation; error?: string }> {
    return fetchWithAuth('/api/tenant-users/invite', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async resendInvitation(
    token: string,
    invitationId: string
  ): Promise<{ success: boolean; data: TenantInvitation; message?: string; error?: string }> {
    return fetchWithAuth(`/api/tenant-users/invitations/${invitationId}/resend`, token, {
      method: 'POST',
    });
  },

  async cancelInvitation(
    token: string,
    invitationId: string
  ): Promise<{ success: boolean; data: TenantInvitation; error?: string }> {
    return fetchWithAuth(`/api/tenant-users/invitations/${invitationId}/cancel`, token, {
      method: 'POST',
    });
  },

  async updateUserRole(
    token: string,
    membershipId: string,
    input: UpdateTenantUserRoleInput
  ): Promise<{ success: boolean; data: Membership; error?: string }> {
    return fetchWithAuth(`/api/tenant-users/${membershipId}/role`, token, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  async toggleUserStatus(
    token: string,
    membershipId: string,
    isActive: boolean
  ): Promise<{ success: boolean; data: Membership; error?: string }> {
    return fetchWithAuth(`/api/tenant-users/${membershipId}/status`, token, {
      method: 'PUT',
      body: JSON.stringify({ is_active: isActive }),
    });
  },

  async linkUserEmployee(
    token: string,
    membershipId: string,
    input: LinkUserEmployeeInput
  ): Promise<{ success: boolean; data: Membership; error?: string }> {
    return fetchWithAuth(`/api/tenant-users/${membershipId}/link-employee`, token, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  // --------------------------------------------------------------------------
  // Phase 6: Reporting Center
  // --------------------------------------------------------------------------
  async getReport(
    token: string,
    filter: ReportFilterOptions
  ): Promise<{ success: boolean; data: ReportResult; error?: string }> {
    const params = new URLSearchParams();
    params.set('report_type', filter.report_type);
    if (filter.start_date) params.set('start_date', filter.start_date);
    if (filter.end_date) params.set('end_date', filter.end_date);
    if (filter.site_id) params.set('site_id', filter.site_id);
    if (filter.location_id) params.set('location_id', filter.location_id);
    if (filter.category_id) params.set('category_id', filter.category_id);
    if (filter.department_id) params.set('department_id', filter.department_id);
    if (filter.employee_id) params.set('employee_id', filter.employee_id);
    if (filter.vendor_id) params.set('vendor_id', filter.vendor_id);
    if (filter.status) params.set('status', filter.status);

    return fetchWithAuth(`/api/reports?${params.toString()}`, token);
  },

  async downloadReportCsv(token: string, filter: ReportFilterOptions): Promise<string> {
    const params = new URLSearchParams();
    params.set('report_type', filter.report_type);
    params.set('export', 'csv');
    if (filter.start_date) params.set('start_date', filter.start_date);
    if (filter.end_date) params.set('end_date', filter.end_date);
    if (filter.site_id) params.set('site_id', filter.site_id);
    if (filter.location_id) params.set('location_id', filter.location_id);
    if (filter.category_id) params.set('category_id', filter.category_id);
    if (filter.department_id) params.set('department_id', filter.department_id);
    if (filter.employee_id) params.set('employee_id', filter.employee_id);
    if (filter.vendor_id) params.set('vendor_id', filter.vendor_id);
    if (filter.status) params.set('status', filter.status);

    const res = await fetch(`/api/reports?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to export report: ${res.statusText}`);
    }
    return res.text();
  },

  // --------------------------------------------------------------------------
  // Phase 6: CSV Import Center
  // --------------------------------------------------------------------------
  async previewImport(
    token: string,
    target: ImportTarget,
    csvContent: string
  ): Promise<{ success: boolean; data: ImportPreviewResponse; error?: string }> {
    return fetchWithAuth('/api/import/preview', token, {
      method: 'POST',
      body: JSON.stringify({ target, csv_content: csvContent }),
    });
  },

  async commitImport(
    token: string,
    target: ImportTarget,
    rows: Record<string, any>[],
    skipDuplicates: boolean = true
  ): Promise<{ success: boolean; data: CommitImportResponse; error?: string }> {
    return fetchWithAuth('/api/import/commit', token, {
      method: 'POST',
      body: JSON.stringify({ target, rows, skip_duplicates: skipDuplicates }),
    });
  },

  // --------------------------------------------------------------------------
  // Phase 6: Global Audit Log
  // --------------------------------------------------------------------------
  async getAuditLog(
    token: string,
    filter: AuditLogFilterOptions = {}
  ): Promise<{
    success: boolean;
    data: Array<{
      id: string;
      timestamp: string;
      actor: string;
      event_type: string;
      asset_tag: string;
      asset_name: string;
      notes: string;
      details: Record<string, any>;
    }>;
    total: number;
    error?: string;
  }> {
    const params = new URLSearchParams();
    if (filter.start_date) params.set('start_date', filter.start_date);
    if (filter.end_date) params.set('end_date', filter.end_date);
    if (filter.event_type) params.set('event_type', filter.event_type);
    if (filter.asset_id) params.set('asset_id', filter.asset_id);
    if (filter.limit) params.set('limit', String(filter.limit));
    if (filter.offset) params.set('offset', String(filter.offset));

    return fetchWithAuth(`/api/audit-log?${params.toString()}`, token);
  },

  async downloadAuditLogCsv(token: string, filter: AuditLogFilterOptions = {}): Promise<string> {
    const params = new URLSearchParams();
    params.set('export', 'csv');
    if (filter.start_date) params.set('start_date', filter.start_date);
    if (filter.end_date) params.set('end_date', filter.end_date);
    if (filter.event_type) params.set('event_type', filter.event_type);
    if (filter.asset_id) params.set('asset_id', filter.asset_id);

    const res = await fetch(`/api/audit-log?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to export audit log: ${res.statusText}`);
    }
    return res.text();
  },

  // --------------------------------------------------------------------------
  // Phase 6: Tenant Settings & Branding
  // --------------------------------------------------------------------------
  async getTenantSettings(
    token: string
  ): Promise<{ success: boolean; data: TenantSettings; error?: string }> {
    return fetchWithAuth('/api/tenant-settings', token);
  },

  async updateTenantSettings(
    token: string,
    input: UpdateTenantSettingsInput
  ): Promise<{ success: boolean; data: TenantSettings; error?: string }> {
    return fetchWithAuth('/api/tenant-settings', token, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  // --------------------------------------------------------------------------
  // Phase 6: Basic Plan Quotas & Usage Summary
  // --------------------------------------------------------------------------
  async getTenantUsage(
    token: string
  ): Promise<{ success: boolean; data: TenantUsageSummary; error?: string }> {
    return fetchWithAuth('/api/tenant-usage', token);
  },

  // --------------------------------------------------------------------------
  // Phase 6: Platform Admin Foundation (SaaS Owner)
  // --------------------------------------------------------------------------
  async checkPlatformAdmin(
    token: string
  ): Promise<{ success: boolean; is_platform_admin: boolean; error?: string }> {
    return fetchWithAuth('/api/platform/verify', token);
  },

  async getPlatformTenants(
    token: string
  ): Promise<{ success: boolean; data: PlatformTenantItem[]; error?: string }> {
    return fetchWithAuth('/api/platform/tenants', token);
  },

  async updatePlatformTenantStatus(
    token: string,
    companyId: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL'
  ): Promise<{ success: boolean; data: any; error?: string }> {
    return fetchWithAuth(`/api/platform/tenants/${companyId}/status`, token, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  async getPlatformMetrics(
    token: string
  ): Promise<{
    success: boolean;
    data: {
      totalTenants: number;
      activeTenants: number;
      suspendedTenants: number;
      totalAssets: number;
      totalUsers: number;
    };
    error?: string;
  }> {
    return fetchWithAuth('/api/platform/metrics', token);
  },

  // --------------------------------------------------------------------------
  // Phase 7: Real Binary Object Storage & Document Uploads
  // --------------------------------------------------------------------------
  async uploadDocumentFile(
    token: string,
    file: File,
    entityType: string,
    entityId: string,
    documentType: string = 'Other',
    notes: string = ''
  ): Promise<{ success: boolean; data: StorageUploadResponse; error?: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entity_type', entityType);
    formData.append('entity_id', entityId);
    formData.append('document_type', documentType);
    formData.append('notes', notes);

    const res = await fetch('/api/documents/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    return res.json();
  },

  async deleteDocumentStorage(
    token: string,
    documentId: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    return fetchWithAuth(`/api/documents/${documentId}/storage`, token, {
      method: 'DELETE',
    });
  },

  async uploadTenantLogoFile(
    token: string,
    file: File
  ): Promise<{ success: boolean; data: TenantSettings; error?: string }> {
    const formData = new FormData();
    formData.append('logo', file);

    const res = await fetch('/api/tenant-settings/logo', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    return res.json();
  },

  async acceptInvitation(
    token: string,
    inviteToken: string
  ): Promise<{ success: boolean; data: AcceptInvitationResponse; error?: string }> {
    return fetchWithAuth('/api/tenant-users/accept-invitation', token, {
      method: 'POST',
      body: JSON.stringify({ token: inviteToken }),
    });
  },

  async submitAkshigoHandoff(
    token: string,
    payload: AkshigoHandoffPayload
  ): Promise<{ success: boolean; data: AkshigoHandoffResponse; error?: string }> {
    return fetchWithAuth('/api/integration/akshigo/handoff', token, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
