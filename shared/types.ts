/**
 * AssetMT - Shared Types
 * Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
 */

export type UserRole = 'TENANT_ADMIN' | 'TECHNICIAN' | 'MEMBER';

export type TenantSubscriptionStatus = 'ACTIVE' | 'TRIAL' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED';

export interface Company {
  id: string;
  name: string;
  code?: string | null;
  status?: TenantSubscriptionStatus;
  plan?: 'BASIC' | 'PRO' | 'ENTERPRISE';
  max_assets?: number;
  subscription_id?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  grace_period_until?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Membership {
  id: string;
  company_id: string;
  user_id: string;
  role: UserRole;
  is_active?: boolean;
  employee_id?: string | null;
  last_active_at?: string | null;
  invited_by?: string | null;
  created_at: string;
  company?: Company;
  employee?: Employee | null;
  email?: string | null;
}

export interface Category {
  id: string;
  company_id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  created_at: string;
}

export interface Department {
  id: string;
  company_id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Site {
  id: string;
  company_id: string;
  name: string;
  address?: string | null;
  created_at: string;
}

export interface Location {
  id: string;
  company_id: string;
  site_id: string;
  name: string;
  description?: string | null;
  created_at: string;
  site?: Site;
}

export interface Employee {
  id: string;
  company_id: string;
  employee_code: string;
  full_name: string;
  email?: string | null;
  job_title?: string | null;
  department_id?: string | null;
  site_id?: string | null;
  location_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // Joined relations
  department?: Department | null;
  site?: Site | null;
  location?: Location | null;
}

export type AssetStatus = 'Available' | 'Assigned' | 'Under Repair' | 'Retired' | 'Disposed';

// Note: In generic Asset Create/Edit forms, "Assigned" is strictly driven by the custody workflow.
export const GENERIC_FORM_ALLOWED_STATUSES: AssetStatus[] = [
  'Available',
  'Under Repair',
  'Retired',
  'Disposed',
];

export const ALL_ASSET_STATUSES: AssetStatus[] = [
  'Available',
  'Assigned',
  'Under Repair',
  'Retired',
  'Disposed',
];

export interface AssetAssignment {
  id: string;
  company_id: string;
  asset_id: string;
  employee_id: string;
  checked_out_at: string;
  expected_return_at?: string | null;
  checked_in_at?: string | null;
  checkout_condition?: string | null;
  checkin_condition?: string | null;
  checkout_notes?: string | null;
  checkin_notes?: string | null;
  issued_by?: string | null;
  returned_by?: string | null;
  created_at: string;
  updated_at: string;

  // Joined relations
  employee?: Employee | null;
  asset?: Asset | null;
}

export interface Asset {
  id: string;
  company_id: string;
  asset_tag: string;
  name: string;
  description?: string | null;
  category_id?: string | null;
  site_id?: string | null;
  location_id?: string | null;
  serial_number?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  status: AssetStatus;
  purchase_date?: string | null;
  purchase_cost?: number | null;
  currency: string;
  warranty_expiry?: string | null;
  notes?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;

  // Joined relations
  category?: Category | null;
  site?: Site | null;
  location?: Location | null;
  current_assignment?: AssetAssignment | null;
  current_employee?: Employee | null;
}

export interface AssetEvent {
  id: string;
  company_id: string;
  asset_id: string;
  event_type:
    | 'CREATED'
    | 'UPDATED'
    | 'CHECKED_OUT'
    | 'CHECKED_IN'
    | 'TRANSFERRED'
    | 'MAINTENANCE_CREATED'
    | 'MAINTENANCE_SCHEDULED'
    | 'MAINTENANCE_STARTED'
    | 'MAINTENANCE_COMPLETED'
    | 'MAINTENANCE_CANCELLED';
  actor_id: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface DashboardMetrics {
  totalAssets: number;
  totalValue: number;
  categoryBreakdown: { categoryName: string; count: number; value: number }[];
  statusBreakdown: Record<string, number>;
  recentEvents: (AssetEvent & { asset_tag?: string; asset_name?: string })[];
  maintenanceMetrics?: MaintenanceMetricsSummary;
}

export type MaintenanceStatus = 'Open' | 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';
export type MaintenancePriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type MaintenanceType =
  | 'Preventative'
  | 'Corrective'
  | 'Inspection'
  | 'Upgrade'
  | 'Calibration'
  | 'Other';

export interface Vendor {
  id: string;
  company_id: string;
  name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateVendorInput {
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  website?: string;
  notes?: string;
  is_active?: boolean;
}

export interface UpdateVendorInput extends Partial<CreateVendorInput> {}

export interface MaintenanceRecord {
  id: string;
  company_id: string;
  asset_id: string;
  work_order_number: string;
  title: string;
  description?: string | null;
  maintenance_type: MaintenanceType;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  scheduled_date?: string | null;
  due_date?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  assigned_user_id?: string | null;
  vendor_id?: string | null;
  service_cost?: number | null;
  currency: string;
  downtime_minutes?: number | null;
  resolution_notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;

  // Joined relations
  asset?: Asset | null;
  vendor?: Vendor | null;
}

export interface CreateMaintenanceInput {
  asset_id: string;
  work_order_number?: string;
  title: string;
  description?: string;
  maintenance_type: MaintenanceType;
  priority: MaintenancePriority;
  scheduled_date?: string | null;
  due_date?: string | null;
  assigned_user_id?: string | null;
  vendor_id?: string | null;
  service_cost?: number | null;
  currency?: string;
  notes?: string;
}

export interface UpdateMaintenanceInput extends Partial<CreateMaintenanceInput> {
  status?: MaintenanceStatus;
  started_at?: string | null;
  completed_at?: string | null;
  resolution_notes?: string | null;
  downtime_minutes?: number | null;
}

export interface ScheduleMaintenanceInput {
  scheduled_date: string;
  due_date?: string | null;
  assigned_user_id?: string | null;
  vendor_id?: string | null;
  notes?: string;
}

export interface StartMaintenanceInput {
  started_at?: string;
  notes?: string;
}

export interface CompleteMaintenanceInput {
  completed_at?: string;
  service_cost?: number | null;
  downtime_minutes?: number | null;
  resolution_notes: string;
}

export interface CancelMaintenanceInput {
  reason: string;
}

export interface MaintenanceMetricsSummary {
  openCount: number;
  scheduledCount: number;
  inProgressCount: number;
  completedCount: number;
  overdueCount: number;
  totalCost: number;
}

export interface CheckoutInput {
  employee_id: string;
  checked_out_at?: string;
  expected_return_at?: string | null;
  condition?: string;
  notes?: string;
}

export interface CheckinInput {
  checked_in_at?: string;
  condition?: string;
  site_id?: string | null;
  location_id?: string | null;
  notes?: string;
}

export interface TransferInput {
  new_employee_id: string;
  transfer_at?: string;
  condition?: string;
  notes?: string;
}

export interface CreateAssetInput {
  asset_tag: string;
  name: string;
  description?: string;
  category_id?: string;
  site_id?: string;
  location_id?: string;
  serial_number?: string;
  manufacturer?: string;
  model?: string;
  status?: AssetStatus;
  purchase_date?: string;
  purchase_cost?: number;
  currency?: string;
  warranty_expiry?: string;
  notes?: string;
}

export interface UpdateAssetInput extends Partial<CreateAssetInput> {
  // company_id and asset_tag can have restrictions
}

export interface CreateWorkspaceInput {
  name: string;
  code?: string;
}

export interface CreateDepartmentInput {
  name: string;
  code?: string;
  description?: string;
  is_archived?: boolean;
}

export interface UpdateDepartmentInput extends Partial<CreateDepartmentInput> {}

export interface CreateEmployeeInput {
  employee_code: string;
  full_name: string;
  email?: string;
  job_title?: string;
  department_id?: string | null;
  site_id?: string | null;
  location_id?: string | null;
  is_active?: boolean;
}

export interface UpdateEmployeeInput extends Partial<CreateEmployeeInput> {}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}

// ============================================================================
// Phase 4: Complete Asset Operations Types
// ============================================================================

// 1. Inventory / Stock
export type InventoryTransactionType = 'STOCK_IN' | 'STOCK_OUT' | 'TRANSFER' | 'ADJUSTMENT';

export interface InventoryItem {
  id: string;
  company_id: string;
  sku: string;
  name: string;
  category_id?: string | null;
  site_id?: string | null;
  location_id?: string | null;
  quantity_on_hand: number;
  minimum_stock_level: number;
  unit_cost?: number | null;
  currency: string;
  vendor_id?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // Joined relations
  category?: Category | null;
  site?: Site | null;
  location?: Location | null;
  vendor?: Vendor | null;
}

export interface InventoryTransaction {
  id: string;
  company_id: string;
  inventory_item_id: string;
  transaction_type: InventoryTransactionType;
  quantity: number;
  unit_cost?: number | null;
  from_location_id?: string | null;
  to_location_id?: string | null;
  reference_number?: string | null;
  notes?: string | null;
  performed_by?: string | null;
  created_at: string;

  // Joined relations
  item?: InventoryItem | null;
  from_location?: Location | null;
  to_location?: Location | null;
}

export interface CreateInventoryItemInput {
  sku: string;
  name: string;
  category_id?: string | null;
  site_id?: string | null;
  location_id?: string | null;
  quantity_on_hand?: number;
  minimum_stock_level?: number;
  unit_cost?: number | null;
  currency?: string;
  vendor_id?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export interface UpdateInventoryItemInput extends Partial<CreateInventoryItemInput> {}

export interface InventoryStockMovementInput {
  transaction_type: InventoryTransactionType;
  quantity: number;
  unit_cost?: number | null;
  from_location_id?: string | null;
  to_location_id?: string | null;
  reference_number?: string | null;
  notes?: string | null;
}

// 2. Reservations
export type ReservationStatus = 'Active' | 'Fulfilled' | 'Cancelled' | 'Expired';

export interface AssetReservation {
  id: string;
  company_id: string;
  asset_id: string;
  employee_id: string;
  reserved_from: string;
  reserved_until: string;
  purpose?: string | null;
  status: ReservationStatus;
  created_by?: string | null;
  created_at: string;
  updated_at: string;

  // Joined relations
  asset?: Asset | null;
  employee?: Employee | null;
}

export interface CreateReservationInput {
  asset_id: string;
  employee_id: string;
  reserved_from: string;
  reserved_until: string;
  purpose?: string | null;
}

// 3. Lease / Lease Return
export type LeaseStatus = 'Active' | 'Returned' | 'Terminated' | 'Expired';
export type LeaseInterval = 'Monthly' | 'Quarterly' | 'Annual' | 'Total';

export interface AssetLease {
  id: string;
  company_id: string;
  asset_id: string;
  vendor_id: string;
  lease_reference?: string | null;
  start_date: string;
  end_date: string;
  cost?: number | null;
  cost_interval?: LeaseInterval | null;
  currency: string;
  notes?: string | null;
  return_date?: string | null;
  return_condition?: string | null;
  return_notes?: string | null;
  status: LeaseStatus;
  created_by?: string | null;
  created_at: string;
  updated_at: string;

  // Joined relations
  asset?: Asset | null;
  vendor?: Vendor | null;
}

export interface CreateLeaseInput {
  asset_id: string;
  vendor_id: string;
  lease_reference?: string | null;
  start_date: string;
  end_date: string;
  cost?: number | null;
  cost_interval?: LeaseInterval | null;
  currency?: string;
  notes?: string | null;
}

export interface ReturnLeaseInput {
  return_date: string;
  return_condition?: string | null;
  return_notes?: string | null;
}

// 4. Asset Move / Location History
export interface AssetLocationHistory {
  id: string;
  company_id: string;
  asset_id: string;
  from_site_id?: string | null;
  from_location_id?: string | null;
  to_site_id?: string | null;
  to_location_id?: string | null;
  moved_at: string;
  moved_by?: string | null;
  notes?: string | null;

  // Joined relations
  from_site?: Site | null;
  from_location?: Location | null;
  to_site?: Site | null;
  to_location?: Location | null;
}

export interface MoveAssetInput {
  to_site_id?: string | null;
  to_location_id?: string | null;
  moved_at?: string;
  notes?: string | null;
}

// 5. Asset Disposal
export type DisposalMethod = 'Sold' | 'Recycled' | 'Scrapped' | 'Donated' | 'Lost' | 'Other';

export interface AssetDisposal {
  id: string;
  company_id: string;
  asset_id: string;
  disposal_date: string;
  disposal_method: DisposalMethod;
  reason: string;
  recovery_value?: number | null;
  currency: string;
  notes?: string | null;
  disposed_by?: string | null;
  created_at: string;

  // Joined relations
  asset?: Asset | null;
}

export interface DisposeAssetInput {
  disposal_date: string;
  disposal_method: DisposalMethod;
  reason: string;
  recovery_value?: number | null;
  currency?: string;
  notes?: string | null;
}

// 6. Linked / Related Assets
export type RelationshipType = 'Component Of' | 'Accessory Of' | 'Related To';

export interface AssetRelationship {
  id: string;
  company_id: string;
  parent_asset_id: string;
  child_asset_id: string;
  relationship_type: RelationshipType;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;

  // Joined relations
  parent_asset?: Asset | null;
  child_asset?: Asset | null;
}

export interface CreateAssetRelationshipInput {
  parent_asset_id?: string;
  child_asset_id: string;
  relationship_type: RelationshipType;
  notes?: string | null;
}

// 7. Physical Asset Audits
export type AuditSessionStatus = 'In Progress' | 'Completed' | 'Cancelled';
export type AuditItemStatus = 'Found' | 'Missing' | 'Wrong Location' | 'Unexpected';

export interface AuditSession {
  id: string;
  company_id: string;
  name: string;
  site_id?: string | null;
  location_id?: string | null;
  status: AuditSessionStatus;
  started_at: string;
  completed_at?: string | null;
  started_by?: string | null;
  completed_by?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;

  // Joined relations
  site?: Site | null;
  location?: Location | null;
  stats?: {
    expected: number;
    found: number;
    missing: number;
    wrongLocation: number;
    unexpected: number;
  };
}

export interface AuditSessionItem {
  id: string;
  company_id: string;
  session_id: string;
  asset_id: string;
  expected_site_id?: string | null;
  expected_location_id?: string | null;
  scanned_site_id?: string | null;
  scanned_location_id?: string | null;
  status: AuditItemStatus;
  notes?: string | null;
  scanned_by?: string | null;
  scanned_at?: string | null;

  // Joined relations
  asset?: Asset | null;
  expected_site?: Site | null;
  expected_location?: Location | null;
  scanned_site?: Site | null;
  scanned_location?: Location | null;
}

export interface CreateAuditSessionInput {
  name: string;
  site_id?: string | null;
  location_id?: string | null;
  notes?: string | null;
}

export interface ScanAuditItemInput {
  asset_id?: string;
  asset_tag?: string;
  scanned_site_id?: string | null;
  scanned_location_id?: string | null;
  status?: AuditItemStatus;
  notes?: string | null;
}

export interface CompleteAuditSessionInput {
  notes?: string | null;
}

// ============================================================================
// Phase 5: Financial, Compliance & Asset Records Types
// ============================================================================

// 1. Depreciation
export type DepreciationMethod = 'STRAIGHT_LINE' | 'DECLINING_BALANCE' | 'NO_DEPRECIATION';

export interface AssetDepreciation {
  id: string;
  company_id: string;
  asset_id: string;
  method: DepreciationMethod;
  salvage_value: number;
  useful_life_months: number;
  depreciation_start_date?: string | null;
  rate?: number | null;
  created_at: string;
  updated_at: string;

  // Calculated fields (server/domain controlled)
  original_cost?: number;
  accumulated_depreciation?: number;
  current_book_value?: number;
  depreciation_to_date?: number;
}

export interface DepreciationSchedulePeriod {
  period: number;
  year: number;
  month?: number;
  period_label: string;
  starting_book_value: number;
  depreciation_expense: number;
  accumulated_depreciation: number;
  ending_book_value: number;
}

export interface ConfigureDepreciationInput {
  method: DepreciationMethod;
  salvage_value?: number;
  useful_life_months?: number;
  depreciation_start_date?: string | null;
  rate?: number | null;
}

// 2. Warranties
export type WarrantyType =
  | 'Manufacturer'
  | 'Extended'
  | 'Vendor'
  | 'Third-Party'
  | 'Replacement'
  | 'Labor Only'
  | 'Parts & Labor';

export type WarrantyStatus = 'Active' | 'Expired' | 'Voided';

export interface AssetWarranty {
  id: string;
  company_id: string;
  asset_id: string;
  vendor_id?: string | null;
  warranty_number: string;
  provider_name: string;
  warranty_type: WarrantyType;
  start_date: string;
  end_date: string;
  coverage_details?: string | null;
  contact_details?: string | null;
  status: WarrantyStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;

  // Joined relations & computed
  vendor?: Vendor | null;
  asset?: Asset | null;
  days_until_expiry?: number;
  is_expiring_soon?: boolean;
}

export interface CreateWarrantyInput {
  asset_id: string;
  vendor_id?: string | null;
  warranty_number: string;
  provider_name: string;
  warranty_type: WarrantyType;
  start_date: string;
  end_date: string;
  coverage_details?: string | null;
  contact_details?: string | null;
  notes?: string | null;
}

export interface UpdateWarrantyInput extends Partial<CreateWarrantyInput> {
  status?: WarrantyStatus;
}

// 3. Contracts
export type ContractType =
  | 'Maintenance'
  | 'Lease'
  | 'Software License'
  | 'Service Level Agreement'
  | 'Warranty'
  | 'Procurement'
  | 'Master Services'
  | 'Other';

export type ContractStatus = 'Draft' | 'Active' | 'Expired' | 'Terminated';

export interface Contract {
  id: string;
  company_id: string;
  contract_number: string;
  title: string;
  vendor_id?: string | null;
  contract_type: ContractType;
  start_date: string;
  end_date: string;
  renewal_date?: string | null;
  contract_value?: number | null;
  currency: string;
  auto_renew: boolean;
  status: ContractStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;

  // Joined relations & computed
  vendor?: Vendor | null;
  assets?: Asset[];
  days_until_expiry?: number;
  days_until_renewal?: number;
  is_expiring_soon?: boolean;
}

export interface CreateContractInput {
  contract_number: string;
  title: string;
  vendor_id?: string | null;
  contract_type: ContractType;
  start_date: string;
  end_date: string;
  renewal_date?: string | null;
  contract_value?: number | null;
  currency?: string;
  auto_renew?: boolean;
  status?: ContractStatus;
  notes?: string | null;
  asset_ids?: string[];
}

export interface UpdateContractInput extends Partial<CreateContractInput> {}

// 4. Software / License Tracking
export type SoftwareLicenseType =
  | 'Per User'
  | 'Per Device'
  | 'Subscription'
  | 'Site'
  | 'Enterprise'
  | 'Volume'
  | 'Other';

export type LicenseAllocationType = 'Asset' | 'Employee';
export type LicenseAllocationStatus = 'Active' | 'Released';

export interface SoftwareLicense {
  id: string;
  company_id: string;
  software_name: string;
  vendor_id?: string | null;
  publisher?: string | null;
  license_key?: string | null;
  license_type: SoftwareLicenseType;
  purchased_quantity: number;
  allocated_quantity: number;
  renewal_date?: string | null;
  expiry_date?: string | null;
  purchase_cost?: number | null;
  currency: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;

  // Joined relations
  vendor?: Vendor | null;
  allocations?: SoftwareLicenseAllocation[];
  days_until_expiry?: number;
  available_quantity?: number;
}

export interface SoftwareLicenseAllocation {
  id: string;
  company_id: string;
  license_id: string;
  allocation_type: LicenseAllocationType;
  asset_id?: string | null;
  employee_id?: string | null;
  allocated_at: string;
  released_at?: string | null;
  status: LicenseAllocationStatus;
  notes?: string | null;

  // Joined relations
  license?: SoftwareLicense | null;
  asset?: Asset | null;
  employee?: Employee | null;
}

export interface CreateLicenseInput {
  software_name: string;
  vendor_id?: string | null;
  publisher?: string | null;
  license_key?: string | null;
  license_type: SoftwareLicenseType;
  purchased_quantity: number;
  renewal_date?: string | null;
  expiry_date?: string | null;
  purchase_cost?: number | null;
  currency?: string;
  notes?: string | null;
}

export interface UpdateLicenseInput extends Partial<CreateLicenseInput> {}

export interface AllocateLicenseInput {
  allocation_type: LicenseAllocationType;
  asset_id?: string;
  employee_id?: string;
  notes?: string | null;
}

// 5. Insurance
export type InsuranceCoverageType =
  | 'Comprehensive'
  | 'Liability'
  | 'Property'
  | 'Theft'
  | 'Equipment Floater'
  | 'Business Interruption'
  | 'Cyber Risk'
  | 'Other';

export type InsuranceStatus = 'Active' | 'Expired' | 'Cancelled';

export interface InsurancePolicy {
  id: string;
  company_id: string;
  policy_number: string;
  provider: string;
  coverage_type: InsuranceCoverageType;
  start_date: string;
  expiry_date: string;
  insured_value?: number | null;
  premium?: number | null;
  currency: string;
  deductible?: number | null;
  status: InsuranceStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;

  // Joined relations
  assets?: Asset[];
  days_until_expiry?: number;
}

export interface CreateInsurancePolicyInput {
  policy_number: string;
  provider: string;
  coverage_type: InsuranceCoverageType;
  start_date: string;
  expiry_date: string;
  insured_value?: number | null;
  premium?: number | null;
  currency?: string;
  deductible?: number | null;
  status?: InsuranceStatus;
  notes?: string | null;
  asset_ids?: string[];
}

export interface UpdateInsurancePolicyInput extends Partial<CreateInsurancePolicyInput> {}

// 6. Acquisition & Purchase / Funding
export type FundingSource =
  | 'Company Purchase'
  | 'Department Budget'
  | 'Grant'
  | 'Donation'
  | 'Finance'
  | 'Lease'
  | 'Other';

export interface AssetPurchase {
  id: string;
  company_id: string;
  asset_id: string;
  vendor_id?: string | null;
  invoice_number?: string | null;
  purchase_order?: string | null;
  purchase_date?: string | null;
  purchase_cost?: number | null;
  currency: string;
  funding_source: FundingSource;
  department_id?: string | null;
  cost_center?: string | null;
  is_financed: boolean;
  is_leased: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;

  // Joined relations
  vendor?: Vendor | null;
  department?: Department | null;
}

export interface UpsertAssetPurchaseInput {
  vendor_id?: string | null;
  invoice_number?: string | null;
  purchase_order?: string | null;
  purchase_date?: string | null;
  purchase_cost?: number | null;
  currency?: string;
  funding_source?: FundingSource;
  department_id?: string | null;
  cost_center?: string | null;
  is_financed?: boolean;
  is_leased?: boolean;
  notes?: string | null;
}

// 7. Documents / Attachments
export type DocumentEntityType =
  | 'ASSET'
  | 'WARRANTY'
  | 'CONTRACT'
  | 'INSURANCE'
  | 'LICENSE'
  | 'MAINTENANCE'
  | 'PURCHASE';

export interface DocumentRecord {
  id: string;
  company_id: string;
  entity_type: DocumentEntityType;
  entity_id: string;
  original_filename: string;
  stored_path: string;
  content_type: string;
  file_size: number;
  uploaded_by: string;
  description?: string | null;
  created_at: string;
  file_url?: string;
}

export interface CreateDocumentInput {
  entity_type: DocumentEntityType;
  entity_id: string;
  original_filename: string;
  content_type?: string;
  file_size: number;
  description?: string | null;
  file_data_base64?: string;
}

// 8. Custom Fields
export type CustomFieldType = 'Text' | 'Number' | 'Date' | 'Yes/No' | 'Dropdown';

export interface CustomFieldDefinition {
  id: string;
  company_id: string;
  field_name: string;
  field_type: CustomFieldType;
  is_required: boolean;
  is_active: boolean;
  dropdown_choices: string[];
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface AssetCustomFieldValue {
  id: string;
  company_id: string;
  asset_id: string;
  field_definition_id: string;
  field_value: string;
  created_at: string;
  updated_at: string;
  field_definition?: CustomFieldDefinition;
}

export interface CreateCustomFieldDefinitionInput {
  field_name: string;
  field_type: CustomFieldType;
  is_required?: boolean;
  is_active?: boolean;
  dropdown_choices?: string[];
  display_order?: number;
}

export interface UpdateCustomFieldDefinitionInput extends Partial<CreateCustomFieldDefinitionInput> {}

export interface SaveAssetCustomFieldValueInput {
  field_definition_id: string;
  field_value: string;
}

// 9. Alerts & Expiry Center
export type AlertCategory =
  | 'WARRANTY'
  | 'CONTRACT'
  | 'INSURANCE'
  | 'LICENSE'
  | 'LEASE'
  | 'MAINTENANCE'
  | 'RESERVATION'
  | 'INVENTORY'
  | 'AUDIT';

export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export type AlertWindow = 'OVERDUE' | 'NEXT_7_DAYS' | 'NEXT_30_DAYS' | 'NEXT_60_90_DAYS';

export interface SystemAlert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  window: AlertWindow;
  title: string;
  description: string;
  entity_type: string;
  entity_id: string;
  reference_code?: string;
  due_date?: string;
  days_remaining?: number;
  action_url?: string;
}

// ============================================================================
// PHASE 6: USERS, INVITATIONS, SETTINGS, REPORTS, IMPORT, PLATFORM ADMIN
// ============================================================================

// 1. Tenant User Management & Invitations
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';

export interface TenantInvitation {
  id: string;
  company_id: string;
  email: string;
  role: UserRole;
  token: string;
  invited_by: string;
  invited_at: string;
  expires_at: string;
  accepted_at?: string | null;
  cancelled_at?: string | null;
  status: InvitationStatus;
  employee_id?: string | null;
  created_at: string;
  updated_at: string;

  // Joined
  inviter?: { id: string; email?: string } | null;
  employee?: Employee | null;
}

export interface CreateInvitationInput {
  email: string;
  role: UserRole;
  employee_id?: string | null;
}
export type CreateTenantInvitationInput = CreateInvitationInput;

export interface UpdateTenantUserRoleInput {
  role: UserRole;
}

export interface LinkUserEmployeeInput {
  employee_id: string | null;
}

// 2. Tenant Settings & Branding
export interface TenantSettings {
  id: string;
  company_id: string;
  company_name: string;
  company_code?: string | null;
  timezone: string;
  default_currency: string;
  date_format: string;
  logo_url?: string | null;
  logo_storage_path?: string | null;
  accent_color: string;
  display_preferences: Record<string, any>;
  asset_tag_prefix: string;
  asset_tag_next_number: number;
  default_category_id?: string | null;
  default_site_id?: string | null;
  expiry_reminder_days: number[];
  maintenance_reminder_days: number[];
  low_stock_threshold_alert: boolean;
  enforce_mfa: boolean;
  session_timeout_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface UpdateTenantSettingsInput {
  company_name?: string;
  company_code?: string;
  timezone?: string;
  default_currency?: string;
  date_format?: string;
  logo_url?: string | null;
  logo_storage_path?: string | null;
  accent_color?: string;
  display_preferences?: Record<string, any>;
  asset_tag_prefix?: string;
  asset_tag_next_number?: number;
  default_category_id?: string | null;
  default_site_id?: string | null;
  expiry_reminder_days?: number[];
  maintenance_reminder_days?: number[];
  low_stock_threshold_alert?: boolean;
  enforce_mfa?: boolean;
  session_timeout_minutes?: number;
}

// 3. Platform Admin & Usage Quotas
export interface PlatformAdmin {
  id: string;
  user_id: string;
  email?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface PlatformTenantItem {
  id: string;
  name: string;
  code?: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL';
  plan: 'BASIC' | 'PRO' | 'ENTERPRISE';
  max_assets: number;
  asset_count: number;
  user_count: number;
  employee_count: number;
  created_at: string;
}

export interface TenantUsageSummary {
  plan: string;
  status: string;
  assets: { used: number; limit: number };
  tenant_admins: { used: number; limit: number };
  technicians: { used: number; limit: number };
  members: { used: number; limit: number | null };
  employees: { used: number; limit: null };
}

// 4. Reporting Center
export type ReportCategory =
  | 'ASSET'
  | 'CUSTODY'
  | 'MAINTENANCE'
  | 'FINANCIAL'
  | 'INVENTORY'
  | 'AUDIT'
  | 'COMPLIANCE';

export type ReportType =
  // Asset
  | 'ASSET_REGISTER'
  | 'ASSETS_BY_STATUS'
  | 'ASSETS_BY_CATEGORY'
  | 'ASSETS_BY_LOCATION'
  | 'ASSETS_BY_CUSTODIAN'
  | 'ASSETS_BY_DEPARTMENT'
  | 'DISPOSED_ASSETS'
  | 'ASSET_MOVEMENT_HISTORY'
  // Custody
  | 'CURRENT_ASSIGNMENTS'
  | 'CHECKOUT_HISTORY'
  | 'CHECKIN_HISTORY'
  | 'TRANSFER_HISTORY'
  // Maintenance
  | 'OPEN_WORK_ORDERS'
  | 'COMPLETED_MAINTENANCE'
  | 'OVERDUE_MAINTENANCE'
  | 'MAINTENANCE_COST'
  // Financial
  | 'PURCHASE_VALUE'
  | 'DEPRECIATION_SUMMARY'
  | 'ACTIVE_CONTRACTS'
  | 'INSURANCE_COVERAGE'
  | 'SOFTWARE_LICENSES'
  // Inventory
  | 'STOCK_LEVELS'
  | 'LOW_STOCK'
  | 'STOCK_TRANSACTIONS'
  | 'INVENTORY_VALUATION'
  // Audit
  | 'AUDIT_RESULTS'
  | 'MISSING_ASSETS'
  | 'WRONG_LOCATION'
  // Compliance
  | 'EXPIRING_CONTRACTS'
  | 'EXPIRING_WARRANTIES'
  | 'EXPIRING_INSURANCE'
  | 'LICENSE_RENEWALS'
  | 'EXPIRING_LEASES';

export interface ReportFilterOptions {
  report_type: ReportType;
  start_date?: string;
  end_date?: string;
  site_id?: string;
  location_id?: string;
  category_id?: string;
  department_id?: string;
  employee_id?: string;
  vendor_id?: string;
  status?: string;
  export_format?: 'json' | 'csv';
}

export interface ReportSummaryMetric {
  label: string;
  value: string | number;
  highlight?: boolean;
}

export interface ReportResult {
  title: string;
  category: ReportCategory;
  report_type: ReportType;
  generated_at: string;
  total_records: number;
  metrics: ReportSummaryMetric[];
  columns: Array<{ key: string; header: string; type?: 'text' | 'number' | 'currency' | 'date' | 'badge' }>;
  rows: Record<string, any>[];
}

// 5. CSV Import & Validation Previews
export type ImportTarget = 'ASSETS' | 'EMPLOYEES' | 'INVENTORY';

export interface ImportPreviewRow {
  row_number: number;
  raw_data: Record<string, string>;
  parsed_data: Record<string, any>;
  is_valid: boolean;
  errors: string[];
}

export interface ImportPreviewResponse {
  target: ImportTarget;
  total_rows: number;
  valid_count: number;
  invalid_count: number;
  detected_columns: string[];
  rows: ImportPreviewRow[];
}

export interface CommitImportRequest {
  target: ImportTarget;
  rows: Record<string, any>[];
  skip_duplicates?: boolean;
}

export interface CommitImportResponse {
  success: boolean;
  imported_count: number;
  skipped_count: number;
  failed_count: number;
  errors?: string[];
}

// 6. Global Audit Log
export interface AuditLogFilterOptions {
  start_date?: string;
  end_date?: string;
  event_type?: string;
  actor_id?: string;
  asset_id?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// PHASE 7: PRODUCTION HARDENING, STORAGE, EMAIL & AKSHIGO INTEGRATION
// ============================================================================

export type StandardErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PLAN_LIMIT_REACHED'
  | 'TENANT_SUSPENDED'
  | 'RATE_LIMITED'
  | 'STORAGE_ERROR'
  | 'INTERNAL_ERROR';

export interface StorageUploadResponse {
  success: boolean;
  document_id: string;
  storage_key: string;
  original_filename: string;
  file_size: number;
  content_type: string;
  download_url: string;
}

export interface AcceptInvitationInput {
  token: string;
}

export interface AcceptInvitationResponse {
  success: boolean;
  company_id: string;
  company_name: string;
  role: UserRole;
  membership_id: string;
}

export interface AkshigoHandoffPayload {
  tenant_name: string;
  company_code?: string;
  admin_email: string;
  plan: 'BASIC' | 'PRO' | 'ENTERPRISE';
  subscription_id: string;
  signature: string;
  timestamp: number;
}

export interface AkshigoHandoffResponse {
  success: boolean;
  company_id: string;
  company_name: string;
  plan: string;
  status: string;
  message: string;
}



