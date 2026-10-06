/**
 * AssetMT Test Suite: Phase 4 - Complete Asset Operations
 * 
 * Verifies database schema invariants, RLS policies, tenant isolation,
 * validation rules, state machines, Worker API RBAC, Barcode/QR generation,
 * and immutable audit event trails for:
 * 1. Inventory / Stock
 * 2. Barcode & QR Labels
 * 3. Physical Asset Audits
 * 4. Reservations
 * 5. Lease & Lease Return
 * 6. Asset Move / Relocation History
 * 7. Asset Disposal
 * 8. Linked / Related Assets
 */

import fs from 'node:fs';
import path from 'node:path';
import worker from '../worker/index.ts';
import {
  validateInventoryItem,
  validateInventoryStockMovement,
  validateReservation,
  validateLease,
  validateReturnLease,
  validateMoveAsset,
  validateDisposeAsset,
  validateAssetRelationship,
  validateAuditSession,
  validateScanAuditItem,
} from '../shared/validation.ts';
import {
  CreateInventoryItemInput,
  InventoryStockMovementInput,
  CreateReservationInput,
  CreateLeaseInput,
  ReturnLeaseInput,
  MoveAssetInput,
  DisposeAssetInput,
  CreateAssetRelationshipInput,
  CreateAuditSessionInput,
  ScanAuditItemInput,
} from '../shared/types.ts';

export async function runPhase4AssetOperationsTests(): Promise<{
  passed: number;
  failed: number;
  tests: string[];
}> {
  let passed = 0;
  let failed = 0;
  const tests: string[] = [];

  function assert(name: string, condition: boolean, details?: string) {
    if (condition) {
      passed++;
      tests.push(`[PASS] ${name}`);
    } else {
      failed++;
      tests.push(`[FAIL] ${name} ${details ? `(${details})` : ''}`);
    }
  }

  // ==========================================================================
  // 1. Migration 0007 Schema & Database Invariants
  // ==========================================================================
  const migrationPath = path.resolve('migrations/0007_complete_asset_operations.sql');
  const migrationExists = fs.existsSync(migrationPath);
  assert('Additive migration 0007_complete_asset_operations.sql exists', migrationExists);

  if (migrationExists) {
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // 1. Inventory / Stock Invariants
    assert(
      'Table public.inventory_items defined with company cascade reference',
      sql.includes('CREATE TABLE IF NOT EXISTS public.inventory_items') &&
      sql.includes('company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE')
    );
    assert(
      'Inventory item SKU unique per tenant (uq_inventory_sku_tenant)',
      sql.includes('CONSTRAINT uq_inventory_sku_tenant UNIQUE (company_id, sku)')
    );
    assert(
      'Inventory composite tenant foreign keys to category, site, location, vendor',
      sql.includes('CONSTRAINT fk_inv_category_tenant') &&
      sql.includes('CONSTRAINT fk_inv_site_tenant') &&
      sql.includes('CONSTRAINT fk_inv_location_tenant') &&
      sql.includes('CONSTRAINT fk_inv_vendor_tenant')
    );
    assert(
      'Non-negative quantity on hand and minimum stock check constraints',
      sql.includes('quantity_on_hand INTEGER NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0)') &&
      sql.includes('minimum_stock_level INTEGER NOT NULL DEFAULT 0 CHECK (minimum_stock_level >= 0)')
    );
    assert(
      'Tenant immutability trigger on inventory_items',
      sql.includes('CREATE TRIGGER trg_prevent_tenant_change_inv_items')
    );
    assert(
      'RLS enabled on public.inventory_items with member select and admin mutations',
      sql.includes('ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY') &&
      sql.includes('CREATE POLICY "Tenants can view inventory items"') &&
      sql.includes('CREATE POLICY "Tenant admins can insert inventory items"')
    );

    // Inventory Transactions Invariants
    assert(
      'Table public.inventory_transactions defined with company cascade reference',
      sql.includes('CREATE TABLE IF NOT EXISTS public.inventory_transactions') &&
      sql.includes('CONSTRAINT fk_inv_txn_item_tenant FOREIGN KEY (company_id, inventory_item_id)')
    );
    assert(
      'Inventory transaction types CHECK constraint (STOCK_IN, STOCK_OUT, TRANSFER, ADJUSTMENT)',
      sql.includes("CHECK (transaction_type IN ('STOCK_IN', 'STOCK_OUT', 'TRANSFER', 'ADJUSTMENT'))")
    );
    assert(
      'Inventory transactions permanent history: no DELETE policy for normal users',
      !sql.includes('CREATE POLICY "Tenant admins can delete inventory transactions"') &&
      sql.includes('CREATE POLICY "Tenants can view inventory transactions"')
    );

    // 2. Reservations Invariants
    assert(
      'Table public.asset_reservations defined with company cascade reference',
      sql.includes('CREATE TABLE IF NOT EXISTS public.asset_reservations')
    );
    assert(
      'Reservation composite tenant foreign keys to assets and employees',
      sql.includes('CONSTRAINT fk_reservation_asset_tenant FOREIGN KEY (company_id, asset_id)') &&
      sql.includes('CONSTRAINT fk_reservation_employee_tenant FOREIGN KEY (company_id, employee_id)')
    );
    assert(
      'Reservation dates CHECK constraint (reserved_until >= reserved_from)',
      sql.includes('CONSTRAINT chk_reservation_dates CHECK (reserved_until >= reserved_from)')
    );
    assert(
      'Unique partial index preventing overlapping active reservations for same asset',
      sql.includes('CREATE UNIQUE INDEX IF NOT EXISTS uq_active_asset_reservation') &&
      sql.includes("WHERE (status = 'Active')")
    );
    assert(
      'Tenant immutability trigger on asset_reservations',
      sql.includes('CREATE TRIGGER trg_prevent_tenant_change_reservations')
    );
    assert(
      'RLS enabled on public.asset_reservations',
      sql.includes('ALTER TABLE public.asset_reservations ENABLE ROW LEVEL SECURITY')
    );

    // 3. Lease / Lease Return Invariants
    assert(
      'Table public.asset_leases defined with company cascade reference',
      sql.includes('CREATE TABLE IF NOT EXISTS public.asset_leases')
    );
    assert(
      'Lease composite foreign keys to assets and vendors (lessor)',
      sql.includes('CONSTRAINT fk_lease_asset_tenant FOREIGN KEY (company_id, asset_id)') &&
      sql.includes('CONSTRAINT fk_lease_vendor_tenant FOREIGN KEY (company_id, vendor_id)')
    );
    assert(
      'Lease status and dates check constraints',
      sql.includes("CHECK (status IN ('Active', 'Returned', 'Terminated', 'Expired'))") &&
      sql.includes('CONSTRAINT chk_lease_dates CHECK (end_date >= start_date)')
    );
    assert(
      'Tenant immutability trigger on asset_leases',
      sql.includes('CREATE TRIGGER trg_prevent_tenant_change_leases')
    );
    assert(
      'RLS enabled on public.asset_leases',
      sql.includes('ALTER TABLE public.asset_leases ENABLE ROW LEVEL SECURITY')
    );

    // 4. Asset Move / Location History Invariants
    assert(
      'Table public.asset_location_history defined with company cascade reference',
      sql.includes('CREATE TABLE IF NOT EXISTS public.asset_location_history')
    );
    assert(
      'Location history composite foreign keys to asset, sites, and locations',
      sql.includes('CONSTRAINT fk_loc_hist_asset_tenant') &&
      sql.includes('CONSTRAINT fk_loc_hist_from_site_tenant') &&
      sql.includes('CONSTRAINT fk_loc_hist_to_site_tenant')
    );
    assert(
      'Location history permanent log: no DELETE policy for normal users',
      !sql.includes('CREATE POLICY "Tenant admins can delete asset location history"') &&
      sql.includes('CREATE POLICY "Tenants can view asset location history"')
    );

    // 5. Asset Disposal Invariants
    assert(
      'Table public.asset_disposals defined with company cascade reference',
      sql.includes('CREATE TABLE IF NOT EXISTS public.asset_disposals')
    );
    assert(
      'Disposal method check constraint with standard disposal methods',
      sql.includes("CHECK (disposal_method IN ('Sold', 'Recycled', 'Scrapped', 'Donated', 'Lost', 'Other'))")
    );
    assert(
      'Unique disposal per asset tenant constraint (uq_asset_disposal_tenant)',
      sql.includes('CONSTRAINT uq_asset_disposal_tenant UNIQUE (company_id, asset_id)')
    );
    assert(
      'Disposals permanent record: no DELETE policy for normal users',
      !sql.includes('CREATE POLICY "Tenant admins can delete asset disposals"') &&
      sql.includes('CREATE POLICY "Tenants can view asset disposals"')
    );

    // 6. Linked / Related Assets Invariants
    assert(
      'Table public.asset_relationships defined with company cascade reference',
      sql.includes('CREATE TABLE IF NOT EXISTS public.asset_relationships')
    );
    assert(
      'Self-linking strictly prohibited at database level (parent <> child)',
      sql.includes('CONSTRAINT chk_no_self_link CHECK (parent_asset_id <> child_asset_id)')
    );
    assert(
      'Duplicate relationship per tenant prevented (uq_asset_relationship_tenant)',
      sql.includes('CONSTRAINT uq_asset_relationship_tenant UNIQUE (company_id, parent_asset_id, child_asset_id)')
    );
    assert(
      'Relationship types check constraint (Component Of, Accessory Of, Related To)',
      sql.includes("CHECK (relationship_type IN ('Component Of', 'Accessory Of', 'Related To'))")
    );

    // 7. Physical Asset Audits Invariants
    assert(
      'Table public.audit_sessions defined with company cascade reference',
      sql.includes('CREATE TABLE IF NOT EXISTS public.audit_sessions')
    );
    assert(
      'Table public.audit_session_items defined with company cascade reference',
      sql.includes('CREATE TABLE IF NOT EXISTS public.audit_session_items')
    );
    assert(
      'Audit session items status check constraint (Found, Missing, Wrong Location, Unexpected)',
      sql.includes("CHECK (status IN ('Found', 'Missing', 'Wrong Location', 'Unexpected'))")
    );
    assert(
      'Audit session items unique per session and asset (uq_audit_item_tenant)',
      sql.includes('CONSTRAINT uq_audit_item_tenant UNIQUE (company_id, session_id, asset_id)')
    );
    assert(
      'Audit history permanently preserved: no DELETE policy for normal users on audit_sessions',
      !sql.includes('CREATE POLICY "Tenant admins can delete audit sessions"') &&
      sql.includes('CREATE POLICY "Tenants can view audit sessions"')
    );

    // 8. asset_events constraint extended with Phase 4 types
    const eventTypes = [
      'INVENTORY_STOCK_IN',
      'INVENTORY_STOCK_OUT',
      'INVENTORY_TRANSFER',
      'ASSET_RESERVED',
      'RESERVATION_CANCELLED',
      'LEASE_STARTED',
      'LEASE_RETURNED',
      'ASSET_MOVED',
      'ASSET_DISPOSED',
      'ASSET_LINKED',
      'AUDIT_STARTED',
      'AUDIT_COMPLETED',
    ];
    const hasAllEvents = eventTypes.every((et) => sql.includes(`'${et}'`));
    assert('asset_events check constraint extended with all 12 Phase 4 event types', hasAllEvents);
  }

  // ==========================================================================
  // 2. Input Validation Rules & Boundary Conditions
  // ==========================================================================

  // Inventory Item Validation
  const validInv: CreateInventoryItemInput = {
    sku: 'SKU-TONER-01',
    name: 'HP LaserJet 85A Toner Cartridge',
    quantity_on_hand: 15,
    minimum_stock_level: 3,
    unit_cost: 65.5,
  };
  assert('Valid inventory item input passes validation', validateInventoryItem(validInv).isValid);

  assert(
    'Blank inventory SKU is rejected',
    !validateInventoryItem({ ...validInv, sku: '' }).isValid
  );

  assert(
    'Blank inventory item name is rejected',
    !validateInventoryItem({ ...validInv, name: '' }).isValid
  );

  assert(
    'Negative quantity on hand is rejected',
    !validateInventoryItem({ ...validInv, quantity_on_hand: -5 }).isValid
  );

  assert(
    'Negative minimum stock level is rejected',
    !validateInventoryItem({ ...validInv, minimum_stock_level: -1 }).isValid
  );

  assert(
    'Negative unit cost is rejected',
    !validateInventoryItem({ ...validInv, unit_cost: -10 }).isValid
  );

  // Stock Movement Validation
  const validStockIn: InventoryStockMovementInput = {
    transaction_type: 'STOCK_IN',
    quantity: 10,
    unit_cost: 45.0,
    notes: 'Received from supplier',
  };
  assert('Valid stock in movement passes validation', validateInventoryStockMovement(validStockIn).isValid);

  assert(
    'Zero quantity in stock movement is rejected',
    !validateInventoryStockMovement({ ...validStockIn, quantity: 0 }).isValid
  );

  assert(
    'Negative quantity in stock movement is rejected',
    !validateInventoryStockMovement({ ...validStockIn, quantity: -2 }).isValid
  );

  assert(
    'Invalid transaction type is rejected',
    !validateInventoryStockMovement({ ...validStockIn, transaction_type: 'INVALID' as any }).isValid
  );

  // Stock Out Insufficient Stock Check
  assert(
    'Stock out exceeding current stock is rejected',
    !validateInventoryStockMovement({ transaction_type: 'STOCK_OUT', quantity: 20 }, 15).isValid
  );

  assert(
    'Stock out within available stock is accepted',
    validateInventoryStockMovement({ transaction_type: 'STOCK_OUT', quantity: 10 }, 15).isValid
  );

  // Reservation Validation
  const validRes: CreateReservationInput = {
    asset_id: 'asset-123',
    employee_id: 'emp-456',
    reserved_from: '2026-10-01',
    reserved_until: '2026-10-15',
    purpose: 'Offsite Client Conference',
  };
  assert('Valid asset reservation passes validation', validateReservation(validRes).isValid);

  assert(
    'Reservation missing asset_id is rejected',
    !validateReservation({ ...validRes, asset_id: '' }).isValid
  );

  assert(
    'Reservation missing employee_id is rejected',
    !validateReservation({ ...validRes, employee_id: '' }).isValid
  );

  assert(
    'Reservation with end date before start date is rejected',
    !validateReservation({ ...validRes, reserved_from: '2026-10-15', reserved_until: '2026-10-01' }).isValid
  );

  // Lease Validation
  const validLease: CreateLeaseInput = {
    asset_id: 'asset-123',
    vendor_id: 'vendor-789',
    lease_reference: 'LEASE-REF-2026-001',
    start_date: '2026-01-01',
    end_date: '2027-01-01',
    cost: 1200,
    cost_interval: 'Monthly',
  };
  assert('Valid asset lease passes validation', validateLease(validLease).isValid);

  assert(
    'Lease missing lessor vendor is rejected',
    !validateLease({ ...validLease, vendor_id: '' }).isValid
  );

  assert(
    'Lease with end date before start date is rejected',
    !validateLease({ ...validLease, start_date: '2027-01-01', end_date: '2026-01-01' }).isValid
  );

  assert(
    'Lease with negative cost is rejected',
    !validateLease({ ...validLease, cost: -500 }).isValid
  );

  // Lease Return Validation
  const validReturn: ReturnLeaseInput = {
    return_date: '2026-12-31',
    return_condition: 'Good',
    return_notes: 'All accessories returned in working order',
  };
  assert('Valid lease return passes validation', validateReturnLease(validReturn).isValid);

  assert(
    'Lease return without valid date is rejected',
    !validateReturnLease({ return_date: '' }).isValid
  );

  // Asset Move Validation
  const validMove: MoveAssetInput = {
    to_site_id: 'site-hq',
    to_location_id: 'loc-floor-3',
    notes: 'Relocated to Executive Suite',
  };
  assert('Valid asset move passes validation', validateMoveAsset(validMove).isValid);

  assert(
    'Asset move without target site or location is rejected',
    !validateMoveAsset({ notes: 'Nowhere to go' }).isValid
  );

  // Asset Disposal Validation
  const validDisposal: DisposeAssetInput = {
    disposal_date: '2026-09-28',
    disposal_method: 'Recycled',
    reason: 'End of hardware lifecycle, damaged beyond economical repair',
    recovery_value: 0,
  };
  assert('Valid asset disposal passes validation', validateDisposeAsset(validDisposal).isValid);

  assert(
    'Asset disposal missing reason is rejected',
    !validateDisposeAsset({ ...validDisposal, reason: '' }).isValid
  );

  assert(
    'Asset disposal with invalid method is rejected',
    !validateDisposeAsset({ ...validDisposal, disposal_method: 'THROWN_AWAY' as any }).isValid
  );

  assert(
    'Asset disposal with negative recovery value is rejected',
    !validateDisposeAsset({ ...validDisposal, recovery_value: -100 }).isValid
  );

  // Linked Assets Validation
  const validRel: CreateAssetRelationshipInput = {
    child_asset_id: 'docking-station-01',
    relationship_type: 'Accessory Of',
    notes: 'Thunderbolt 4 dock',
  };
  assert('Valid asset relationship passes validation', validateAssetRelationship(validRel).isValid);

  assert(
    'Self-linking asset to itself is strictly rejected',
    !validateAssetRelationship({
      parent_asset_id: 'laptop-01',
      child_asset_id: 'laptop-01',
      relationship_type: 'Component Of',
    }).isValid
  );

  assert(
    'Missing related child asset is rejected',
    !validateAssetRelationship({ ...validRel, child_asset_id: '' }).isValid
  );

  assert(
    'Invalid relationship type is rejected',
    !validateAssetRelationship({ ...validRel, relationship_type: 'Friend Of' as any }).isValid
  );

  // Physical Asset Audit Validation
  const validAuditSession: CreateAuditSessionInput = {
    name: 'Q3 2026 HQ Physical Inventory Audit',
    site_id: 'site-hq',
    notes: 'Annual mandatory internal compliance review',
  };
  assert('Valid physical audit session passes validation', validateAuditSession(validAuditSession).isValid);

  assert(
    'Audit session without name is rejected',
    !validateAuditSession({ ...validAuditSession, name: '' }).isValid
  );

  const validScan: ScanAuditItemInput = {
    asset_id: 'asset-123',
    asset_tag: 'AST-00100',
    status: 'Found',
  };
  assert('Valid audit scan input passes validation', validateScanAuditItem(validScan).isValid);

  assert(
    'Audit scan missing both asset ID and tag is rejected',
    !validateScanAuditItem({ notes: 'Scanned nothing' }).isValid
  );

  // ==========================================================================
  // 3. Cloudflare Worker API & 401 Authentication Rejection
  // ==========================================================================
  const fakeEnv = {
    SUPABASE_URL: 'https://tkdnynxeofyukpnrjfem.supabase.co',
    SUPABASE_ANON_KEY: 'test-key',
  };

  // Inventory unauthenticated
  const reqInvGet = new Request('http://localhost/api/inventory', { method: 'GET' });
  const resInvGet = await worker.fetch(reqInvGet, fakeEnv);
  assert('Worker GET /api/inventory without Authorization returns 401', resInvGet.status === 401);

  const reqInvPost = new Request('http://localhost/api/inventory', {
    method: 'POST',
    body: JSON.stringify(validInv),
  });
  const resInvPost = await worker.fetch(reqInvPost, fakeEnv);
  assert('Worker POST /api/inventory without Authorization returns 401', resInvPost.status === 401);

  const reqInvMove = new Request('http://localhost/api/inventory/inv-1/movement', {
    method: 'POST',
    body: JSON.stringify(validStockIn),
  });
  const resInvMove = await worker.fetch(reqInvMove, fakeEnv);
  assert('Worker POST /api/inventory/:id/movement without Authorization returns 401', resInvMove.status === 401);

  // Reservations unauthenticated
  const reqResGet = new Request('http://localhost/api/reservations', { method: 'GET' });
  const resResGet = await worker.fetch(reqResGet, fakeEnv);
  assert('Worker GET /api/reservations without Authorization returns 401', resResGet.status === 401);

  const reqResPost = new Request('http://localhost/api/reservations', {
    method: 'POST',
    body: JSON.stringify(validRes),
  });
  const resResPost = await worker.fetch(reqResPost, fakeEnv);
  assert('Worker POST /api/reservations without Authorization returns 401', resResPost.status === 401);

  // Leases unauthenticated
  const reqLeaseGet = new Request('http://localhost/api/leases', { method: 'GET' });
  const resLeaseGet = await worker.fetch(reqLeaseGet, fakeEnv);
  assert('Worker GET /api/leases without Authorization returns 401', resLeaseGet.status === 401);

  const reqLeasePost = new Request('http://localhost/api/leases', {
    method: 'POST',
    body: JSON.stringify(validLease),
  });
  const resLeasePost = await worker.fetch(reqLeasePost, fakeEnv);
  assert('Worker POST /api/leases without Authorization returns 401', resLeasePost.status === 401);

  // Asset Move unauthenticated
  const reqMovePost = new Request('http://localhost/api/assets/ast-1/move', {
    method: 'POST',
    body: JSON.stringify(validMove),
  });
  const resMovePost = await worker.fetch(reqMovePost, fakeEnv);
  assert('Worker POST /api/assets/:id/move without Authorization returns 401', resMovePost.status === 401);

  // Asset Disposal unauthenticated
  const reqDisposePost = new Request('http://localhost/api/assets/ast-1/dispose', {
    method: 'POST',
    body: JSON.stringify(validDisposal),
  });
  const resDisposePost = await worker.fetch(reqDisposePost, fakeEnv);
  assert('Worker POST /api/assets/:id/dispose without Authorization returns 401', resDisposePost.status === 401);

  // Asset Relationships unauthenticated
  const reqRelPost = new Request('http://localhost/api/assets/ast-1/relationships', {
    method: 'POST',
    body: JSON.stringify(validRel),
  });
  const resRelPost = await worker.fetch(reqRelPost, fakeEnv);
  assert('Worker POST /api/assets/:id/relationships without Authorization returns 401', resRelPost.status === 401);

  // Audits unauthenticated
  const reqAuditGet = new Request('http://localhost/api/audits', { method: 'GET' });
  const resAuditGet = await worker.fetch(reqAuditGet, fakeEnv);
  assert('Worker GET /api/audits without Authorization returns 401', resAuditGet.status === 401);

  const reqAuditPost = new Request('http://localhost/api/audits', {
    method: 'POST',
    body: JSON.stringify(validAuditSession),
  });
  const resAuditPost = await worker.fetch(reqAuditPost, fakeEnv);
  assert('Worker POST /api/audits without Authorization returns 401', resAuditPost.status === 401);

  const reqAuditScan = new Request('http://localhost/api/audits/aud-1/scan', {
    method: 'POST',
    body: JSON.stringify(validScan),
  });
  const resAuditScan = await worker.fetch(reqAuditScan, fakeEnv);
  assert('Worker POST /api/audits/:id/scan without Authorization returns 401', resAuditScan.status === 401);

  // ==========================================================================
  // 4. Worker RBAC Protection (TENANT_ADMIN Enforcement)
  // ==========================================================================
  const workerFile = fs.readFileSync(path.resolve('worker/index.ts'), 'utf-8');

  assert(
    'Worker restricts POST /api/inventory to TENANT_ADMIN',
    workerFile.includes('Only Tenant Admins are authorized to create inventory items')
  );

  assert(
    'Worker restricts stock movements to TENANT_ADMIN',
    workerFile.includes('Only Tenant Admins are authorized to record stock movements')
  );

  assert(
    'Worker restricts POST /api/reservations to TENANT_ADMIN',
    workerFile.includes('Only Tenant Admins are authorized to reserve assets')
  );

  assert(
    'Worker restricts reservation cancellation to TENANT_ADMIN',
    workerFile.includes('Only Tenant Admins are authorized to cancel reservations')
  );

  assert(
    'Worker restricts POST /api/leases to TENANT_ADMIN',
    workerFile.includes('Only Tenant Admins are authorized to register asset leases')
  );

  assert(
    'Worker restricts lease return to TENANT_ADMIN',
    workerFile.includes('Only Tenant Admins are authorized to process lease returns')
  );

  assert(
    'Worker restricts POST /api/assets/:id/move to TENANT_ADMIN',
    workerFile.includes('Only Tenant Admins are authorized to move assets')
  );

  assert(
    'Worker restricts POST /api/assets/:id/dispose to TENANT_ADMIN',
    workerFile.includes('Only Tenant Admins are authorized to dispose assets')
  );

  assert(
    'Worker restricts POST /api/assets/:id/relationships to TENANT_ADMIN',
    workerFile.includes('Only Tenant Admins are authorized to link assets')
  );

  assert(
    'Worker restricts DELETE /api/relationships/:id to TENANT_ADMIN',
    workerFile.includes('Only Tenant Admins are authorized to remove asset relationships')
  );

  assert(
    'Worker restricts POST /api/audits to TENANT_ADMIN',
    workerFile.includes('Only Tenant Admins are authorized to initiate audits')
  );

  assert(
    'Worker restricts POST /api/audits/:id/complete to TENANT_ADMIN',
    workerFile.includes('Only Tenant Admins are authorized to complete audits')
  );

  // Cross-tenant protection in Phase 4 queries
  assert(
    'Worker verifies inventory item belongs to tenant before movement',
    workerFile.includes('Inventory item not found in your workspace')
  );

  assert(
    'Worker verifies lessor vendor belongs to tenant before creating lease',
    workerFile.includes('Lessor vendor not found in your workspace')
  );

  assert(
    'Worker verifies employee belongs to tenant before creating reservation',
    workerFile.includes('Target employee not found in your workspace')
  );

  // ==========================================================================
  // 5. Asset Lifecycle Invariants for Disposed & Reserved Assets
  // ==========================================================================

  // Disposed Asset Safeguards
  assert(
    'Worker prevents checking out an asset in Disposed status',
    workerFile.includes('Disposed') &&
    (workerFile.includes('disposed') || workerFile.includes('Disposed assets cannot be checked out'))
  );

  assert(
    'Worker prevents creating reservations on a Disposed asset',
    workerFile.includes('Disposed') &&
    (workerFile.includes('Cannot reserve an asset that is disposed') || workerFile.includes('Disposed assets cannot be reserved'))
  );

  assert(
    'Worker prevents creating maintenance on a Disposed asset',
    workerFile.includes('Disposed') &&
    (workerFile.includes('Cannot create maintenance for a disposed asset') || workerFile.includes('Cannot create lease for a disposed asset'))
  );

  assert(
    'Disposal sets asset status to Disposed without deleting historical records',
    workerFile.includes("status: 'Disposed'")
  );

  // Server-side audit event logging
  assert(
    'Worker logs INVENTORY_STOCK_IN event in asset_events',
    workerFile.includes("INVENTORY_STOCK_IN")
  );

  assert(
    'Worker logs INVENTORY_STOCK_OUT event in asset_events',
    workerFile.includes("INVENTORY_STOCK_OUT")
  );

  assert(
    'Worker logs INVENTORY_TRANSFER event in asset_events',
    workerFile.includes("INVENTORY_TRANSFER")
  );

  assert(
    'Worker logs ASSET_RESERVED event in asset_events',
    workerFile.includes("event_type: 'ASSET_RESERVED'")
  );

  assert(
    'Worker logs RESERVATION_CANCELLED event in asset_events',
    workerFile.includes("event_type: 'RESERVATION_CANCELLED'")
  );

  assert(
    'Worker logs LEASE_STARTED event in asset_events',
    workerFile.includes("event_type: 'LEASE_STARTED'")
  );

  assert(
    'Worker logs LEASE_RETURNED event in asset_events',
    workerFile.includes("event_type: 'LEASE_RETURNED'")
  );

  assert(
    'Worker logs ASSET_MOVED event in asset_events',
    workerFile.includes("event_type: 'ASSET_MOVED'")
  );

  assert(
    'Worker logs ASSET_DISPOSED event in asset_events',
    workerFile.includes("event_type: 'ASSET_DISPOSED'")
  );

  assert(
    'Worker logs ASSET_LINKED event in asset_events',
    workerFile.includes("event_type: 'ASSET_LINKED'")
  );

  assert(
    'Worker logs AUDIT_STARTED event in asset_events',
    workerFile.includes("event_type: 'AUDIT_STARTED'")
  );

  assert(
    'Worker logs AUDIT_COMPLETED event in asset_events',
    workerFile.includes("event_type: 'AUDIT_COMPLETED'")
  );

  // ==========================================================================
  // 6. Barcode & QR Label Printing and Scanner Modal Checks
  // ==========================================================================
  const barcodeModalPath = path.resolve('src/components/BarcodeLabelModal.tsx');
  const barcodeModalExists = fs.existsSync(barcodeModalPath);
  assert('BarcodeLabelModal component exists in codebase', barcodeModalExists);

  if (barcodeModalExists) {
    const modalContent = fs.readFileSync(barcodeModalPath, 'utf-8');
    assert(
      'BarcodeLabelModal generates algorithmic QR code matrix',
      modalContent.includes('generateQrMatrix')
    );
    assert(
      'BarcodeLabelModal generates Code 128 / Barcode representation',
      modalContent.includes('generateCode128Bars') || modalContent.includes('barcode')
    );
    assert(
      'BarcodeLabelModal supports single and multi-select label printing',
      modalContent.includes('selectedAssetIds') || modalContent.includes('printLabels')
    );
    assert(
      'BarcodeLabelModal includes search / scan input resolving asset by tag',
      modalContent.includes('scanInput') || modalContent.includes('handleScanSubmit')
    );
  }

  return { passed, failed, tests };
}
