# AssetMT Phase Status & Module Scope Roadmap
**Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech**

---

## Phase 1 (Foundation & Asset Master Data - Implemented)
- **Multi-Tenant Foundation**: Separate customer companies, tenant isolation, tenant-admin role assignment.
- **Authentication**: Supabase Google Sign-In, token verification, session persistence, safe single-workspace onboarding.
- **Atomic Onboarding**: Restricted PostgreSQL SECURITY DEFINER onboarding procedure deriving creator from `auth.uid()`.
- **Database-Level Tenant Security**: RLS enabled across all tenant tables, non-recursive RLS policies, composite foreign keys preventing cross-tenant category/site/location references, immutable `tenant_id` trigger.
- **Asset Master Data**:
  - Asset Tag (unique per tenant)
  - Asset Name & Description
  - Category (with dynamic tenant-scoped category management)
  - Serial Number, Manufacturer, Model
  - Site & Location hierarchy (with dynamic tenant-scoped site/location management)
  - Status management (Default: "Available"; "Assigned" strictly disabled until custody is available)
  - Purchase Date, Purchase Cost, Currency, Warranty Expiry, Notes
- **Transactional Audit Logging**: Server-side database triggers logging all asset creation and modification events with actor snapshot in `asset_events`.
- **Dashboard**: Tenant-scoped asset counts, category breakdown, real recent activity timeline.
- **Asset List & Explorer**: High-density enterprise table, text search, category/site/location filters, sorting, pagination.
- **Asset Details & Form**: Tabbed AssetTiger parity layout with live details, edit action, activity audit history.
- **Cloudflare Worker API**: `/api/*` endpoints validating Bearer tokens with `auth.getUser(token)`, preserving user JWT context for Supabase queries.
- **Verification Status**:
  - *Automated Invariant Suite*: 56 tests passed (schema invariants, RLS policies, Worker auth rejection, state machine transitions).
  - *Live Browser Check*: Pending user interaction in live browser session.

---

## Phase 2A (Employees & Departments Directory - Implemented)
- **Employees are NOT Login Users**:
  - Directory entities who can hold and manage company assets.
  - Creating an employee does **NOT** create a Supabase Auth user, send an email/invite, create a membership, or grant application access.
  - Existing membership/role model unchanged.
- **Employee Directory UI & Navigation**:
  - Located under Lists navigation with AssetTiger compact table design.
  - Employee list with text search (code, name, email, title), department filter, active/inactive status filter, sorting, and pagination.
  - Add & Edit Employee Form: Employee ID/code, full name, optional work email, department, optional site/location, job title, and active status.
  - Employee Detail View: Full profile, company scope, audit timestamps, and clear custody notice.
  - Activate/Deactivate action with confirmation dialog.
  - No hard deletion of employee records; preserves historical references.
- **Department Management**:
  - Minimal tenant-scoped department management (list, add, edit, archive).
  - Archived departments remain visible on existing employee records but are unavailable for new selections.
  - No hard deletion of departments.
- **Custody Boundary Enforcement**:
  - Asset assignment explicitly marked as pending until Phase 2B.
  - No fabricated asset counts in Phase 2A.
- **Database & Security (Migrations `0003` & `0004`)**:
  - `public.departments` and `public.employees` tables with required `company_id REFERENCES companies(id) ON DELETE CASCADE`.
  - Tenant-scoped uniqueness: `uq_department_name_tenant (company_id, name)` and `uq_employee_code_tenant (company_id, employee_code)`.
  - Composite tenant foreign keys: `fk_employee_department_tenant`, `fk_employee_site_tenant`, `fk_employee_location_tenant`.
  - Tenant immutability triggers: `trg_prevent_tenant_change_departments` and `trg_prevent_tenant_change_employees`.
  - Row Level Security (RLS) policies: `SELECT` allowed for all tenant members (`is_tenant_member`); `INSERT`, `UPDATE`, `DELETE` strictly restricted to `TENANT_ADMIN` (`is_tenant_admin`) via `migrations/0004_restrict_directory_mutations_to_tenant_admin.sql`.
  - Worker API endpoints with `TENANT_ADMIN` RBAC checks: `/api/departments`, `/api/departments/:id`, `/api/employees`, `/api/employees/:id`, `/api/employees/:id/toggle-active`.

---

## Phase 2B (Asset Custody Workflows - Implemented)
- **Asset Custody & Lifecycle**:
  - `Available Asset -> Check Out / Assign -> Assigned -> Transfer Custody OR Check In -> Available`.
  - Exactly one active employee custodian per asset guaranteed at the database level via unique partial index.
  - Generic create/edit asset form strictly prohibits setting `status = 'Assigned'`; assignment status is driven exclusively by the custody workflow.
- **Database & Security (Migration `0005_asset_custody_and_assignments.sql`)**:
  - Table `public.asset_assignments` tracking asset, employee, checkout date, expected return date, checkin date, checkout/checkin conditions, notes, and actor references.
  - Composite tenant foreign keys (`fk_assignment_asset_tenant`, `fk_assignment_employee_tenant`) preventing cross-tenant references.
  - Tenant immutability trigger `trg_prevent_tenant_change_assignments` preventing modification of `company_id`.
  - Unique partial index `uq_active_asset_assignment_tenant (company_id, asset_id) WHERE (checked_in_at IS NULL)` guaranteeing one active custody row.
  - Row Level Security: `SELECT` allowed for all tenant members; mutations restricted to `is_tenant_admin(company_id)`.
  - Atomic PostgreSQL SECURITY DEFINER RPCs: `public.checkout_asset`, `public.checkin_asset`, `public.transfer_asset`.
  - Audit logging in `public.asset_events` with `CHECKED_OUT`, `CHECKED_IN`, `TRANSFERRED`.
- **Worker API Endpoints**:
  - `POST /api/assets/:id/checkout` (TENANT_ADMIN only)
  - `POST /api/assets/:id/checkin` (TENANT_ADMIN only)
  - `POST /api/assets/:id/transfer` (TENANT_ADMIN only)
  - `GET /api/assets/:id/assignments` (tenant members)
  - `GET /api/employees/:id/assignments` (tenant members)
- **UI Parity & Workflows**:
  - Asset List: Shows `Assigned` status badge, dedicated Custodian column, and status filtering.
  - Asset Detail: Functional "Custody & Checkouts" tab with active custodian profile, time in custody, Check Out / Check In / Transfer modals, and complete chronological custody history table.
  - Employee Detail: Real query of active assigned assets table and past custody history table (no hardcoded/fake counts).
  - Dashboard: Real database counts for `Assigned` status in KPI summary and activity feed.

---

## Phase 3 (Asset Maintenance, Work Orders & Vendors - Implemented)
- **AssetTiger Parity Maintenance & Vendor Directory**:
  - `Asset -> Create Maintenance / Work Order -> Schedule -> Start (In Progress) -> Complete -> Permanent Lifecycle History`.
  - State machine safe transitions enforced server- and database-side. Terminal states (`Completed`, `Cancelled`) cannot be reverted.
  - Asset custody status remains independent and operational: maintenance tracking does not disrupt active employee custody.
- **Database & Security (Migration `0006_asset_maintenance_and_vendors.sql`)**:
  - `public.vendors`: Tenant-isolated vendor registry with unique vendor name per tenant (`uq_vendor_name_tenant`), composite tenant key (`uq_vendor_tenant`), and tenant immutability trigger.
  - `public.maintenance_records`: Tenant-scoped work orders with unique work order number (`uq_work_order_number_tenant`), composite foreign keys enforcing same-tenant asset (`fk_maintenance_asset_tenant`) and same-tenant vendor (`fk_maintenance_vendor_tenant`).
  - Row Level Security: `SELECT` allowed for all tenant members; `INSERT`, `UPDATE` strictly restricted to `is_tenant_admin(company_id)`.
  - Permanent audit history: Ordinary users cannot hard-delete maintenance records.
  - Audit logging in `public.asset_events` with `MAINTENANCE_CREATED`, `MAINTENANCE_SCHEDULED`, `MAINTENANCE_STARTED`, `MAINTENANCE_COMPLETED`, and `MAINTENANCE_CANCELLED`.
- **Worker API Endpoints**:
  - `GET /api/vendors` & `GET /api/vendors/:id` (all members)
  - `POST /api/vendors`, `PUT /api/vendors/:id`, `POST /api/vendors/:id/toggle-active` (TENANT_ADMIN only)
  - `GET /api/maintenance` & `GET /api/maintenance/:id` (all members)
  - `POST /api/maintenance` (TENANT_ADMIN only)
  - `PUT /api/maintenance/:id` (TENANT_ADMIN only)
  - `POST /api/maintenance/:id/schedule` (TENANT_ADMIN only)
  - `POST /api/maintenance/:id/start` (TENANT_ADMIN only)
  - `POST /api/maintenance/:id/complete` (TENANT_ADMIN only)
  - `POST /api/maintenance/:id/cancel` (TENANT_ADMIN only)
  - `GET /api/assets/:id/maintenance` (asset service history)
  - `GET /api/vendors/:id/maintenance` (vendor service history)
  - `GET /api/maintenance/metrics` (KPI aggregates)
- **UI Components & Workflows**:
  - Maintenance List (`MaintenanceListView`): AssetTiger-style table with WO#, Asset, Title/Type, Priority, Status, Vendor, Target Dates, Cost, Actions, Search, multi-criteria filters, sorting, and pagination.
  - Work Order Detail Modal (`MaintenanceDetailModal`) & Page (`MaintenanceDetailView`): Live lifecycle action buttons (Schedule, Start, Complete, Cancel, Edit), resolution logging, cost/downtime tracking, and chronological asset event trail.
  - Work Order Form (`MaintenanceFormModal` & `MaintenanceFormView`): Create/edit work order with asset selector, vendor lookup, priority, type, dates, and cost.
  - Vendor Directory (`VendorListView`): Enterprise table with search, active filter, add/edit modal, activation toggle, and slide-over drawer showing vendor profile and linked work order history.
  - Asset Detail (`AssetDetailView`): Fully activated "Maintenance" tab displaying active work orders, completed service history, downtime, spend totals, and "+ New Work Order" action.
  - Dashboard (`DashboardView`): Real database-backed maintenance telemetry row showing Open, Scheduled, In Progress, Overdue counts, and total maintenance spend.
- **Verification Status**:
  - *Automated Invariant Suite*: 237 passed, 0 failed across all test suites.
  - *Build & Typecheck*: Passed (`tsc --noEmit` 0 errors, `compile_applet` succeeded).

---

## Phase 4 (Complete Asset Operations - Implemented)
- **1. Inventory / Stock**:
  - Quantity-based inventory tracking for consumable/non-serialized items (SKU, name, category, site, location, vendor, quantity on hand, minimum stock level, unit cost, currency, active status, notes).
  - Immutable transaction log: `Stock In`, `Stock Out`, `Transfer`, and `Adjustment`.
  - Non-negative stock constraints enforced at database and application levels.
  - Low-stock indication and automated threshold warnings.
  - `InventoryListView` component with full search, low-stock filter, stock movement dialog, transaction history slide-over, and add/edit forms.
- **2. Barcode & QR Labels**:
  - Unique QR code matrix and Code 128 barcode representations generated algorithmically for every asset.
  - Printable sheet view with Standard, Compact, and QR-only format toggles.
  - Single and multi-select label printing (`window.print`).
  - Search / test-scan input resolving assets by asset tag or serial number.
  - `BarcodeLabelModal` integrated across sidebar navigation, asset list header, and asset detail.
- **3. Physical Asset Audits**:
  - Audit sessions scoped by site or location (`Draft`, `In Progress`, `Completed`, `Cancelled`).
  - Scan & resolve asset workflow marking items as `Found`, `Missing`, `Wrong Location`, or `Unexpected`.
  - Real-time audit reconciliation displaying expected, found, missing, unexpected, and location mismatch counts.
  - Permanent audit history preserved: ordinary users cannot delete audit records.
  - `AuditListView` with session creation, active audit reconciliation workbench, and tag scanner.
- **4. Asset Reservations**:
  - Reservation scheduling for available assets to employees (`reserved_from`, `reserved_until`, purpose, status).
  - Database-level prevention of overlapping active reservations on the same asset via unique partial index.
  - Checkout integration: alerts when asset has active reservation and protects assigned employee custody.
- **5. Leased Assets & Returns**:
  - Independent lease tracking linked to vendors/lessors (`start_date`, `end_date`, recurring/total cost, interval, reference, currency).
  - Lease return workflow with return date, condition, and notes.
  - Segregated from employee custody history to avoid lifecycle collision.
- **6. Asset Relocation & Movement**:
  - Move asset workflow capturing previous and target site/location hierarchy with move timestamp and notes.
  - Immutable movement history recorded in `asset_location_history`.
  - Validates site and location belong to the active company workspace.
- **7. Safe Asset Disposal**:
  - Safe decommissioning workflow (`Sold`, `Recycled`, `Scrapped`, `Donated`, `Lost`, `Other`) with date, reason, recovery value, and notes.
  - Soft disposal model: asset status set to `Disposed`. Disposed assets cannot be checked out, reserved, moved, or serviced.
  - Preserves entire custody, maintenance, relocation, and audit history permanently.
- **8. Linked & Related Assets**:
  - Bidirectional relational hierarchy: `Component Of`, `Accessory Of`, and `Related To`.
  - Database-enforced prevention of self-linking and duplicate tenant relationships.
  - Dedicated linked asset management tab and relationship modal on `AssetDetailView`.
- **Database & Security (Migration `0007_complete_asset_operations.sql`)**:
  - 8 new tenant-isolated tables with `company_id REFERENCES companies(id) ON DELETE CASCADE`.
  - Tenant immutability triggers on all tables preventing `company_id` modification.
  - RLS enabled across all new tables: `SELECT` allowed for tenant members; mutations strictly restricted to `TENANT_ADMIN`.
  - Permanent audit event logging in `asset_events` with 12 new event types (`INVENTORY_STOCK_IN`, `INVENTORY_STOCK_OUT`, `INVENTORY_TRANSFER`, `ASSET_RESERVED`, `RESERVATION_CANCELLED`, `LEASE_STARTED`, `LEASE_RETURNED`, `ASSET_MOVED`, `ASSET_DISPOSED`, `ASSET_LINKED`, `AUDIT_STARTED`, `AUDIT_COMPLETED`).
- **Verification Status**:
  - *Automated Invariant Suite*: 360 passed, 0 failed across all test suites.
  - *Build & Typecheck*: Passed (`tsc --noEmit` 0 errors, `compile_applet` succeeded).

---

## Pending Modules (Deferred to Subsequent Phases)
The following modules are explicitly reserved for subsequent phases:
1. **Permissions & Team Invitations** (granular member roles, invite links, email invitations)
2. **Asset Depreciation Models** (Straight-line, declining balance, tax tables)
3. **Contracts, Warranties & Software Licenses Management**
4. **Insurance Policies & Claims**
5. **Funding Sources & Grant Accounting**
6. **Advanced Custom Reports & Scheduled Exports**
7. **Automated Alerts, Thresholds & Email Notifications**
8. **Configurable Custom Fields & Form Builder**
9. **Mobile & Offline App Capabilities**
10. **Third-Party API Integrations & Webhooks**
11. **Akshigo Tech Company Website & Subscription Integration** (commercial plan enforcement and centralized billing)

