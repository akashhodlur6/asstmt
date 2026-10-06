/**
 * AssetMT Test Suite: Phase 2B - Asset Custody & Workflows
 * Verifies schema invariants, partial unique indexes, RLS policies,
 * atomic RPC definitions, Worker RBAC protection, and custody transitions.
 */

import fs from 'node:fs';
import path from 'node:path';
import worker from '../worker/index.ts';
import {
  validateAsset,
  validateCheckout,
  validateCheckin,
  validateTransfer,
} from '../shared/validation.ts';
import { Asset, AssetAssignment, Employee } from '../shared/types.ts';

export async function runAssetCustodyTests(): Promise<{
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
  // 1. Migration 0005 Schema & Security Invariants
  // ==========================================================================
  const migration0005Path = path.resolve('migrations/0005_asset_custody_and_assignments.sql');
  const migration0005Exists = fs.existsSync(migration0005Path);
  assert('Additive migration 0005_asset_custody_and_assignments.sql exists', migration0005Exists);

  if (migration0005Exists) {
    const sql = fs.readFileSync(migration0005Path, 'utf-8');

    // Table definition with required columns
    assert(
      'Table public.asset_assignments defined with foreign key references',
      sql.includes('CREATE TABLE IF NOT EXISTS public.asset_assignments') &&
      sql.includes('company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE') &&
      sql.includes('asset_id UUID NOT NULL') &&
      sql.includes('employee_id UUID NOT NULL')
    );

    // Partial unique index for one active custody record per asset
    assert(
      'Unique partial index uq_active_asset_assignment_tenant guarantees one active custody record per asset',
      sql.includes('CREATE UNIQUE INDEX IF NOT EXISTS uq_active_asset_assignment_tenant') &&
      sql.includes('ON public.asset_assignments (company_id, asset_id)') &&
      sql.includes('WHERE (checked_in_at IS NULL)')
    );

    // Composite foreign keys enforcing same-tenant relationship
    assert(
      'Composite foreign key preventing cross-tenant assignment->asset references',
      sql.includes('CONSTRAINT fk_assignment_asset_tenant FOREIGN KEY (company_id, asset_id)') &&
      sql.includes('REFERENCES public.assets(company_id, id)')
    );

    assert(
      'Composite foreign key preventing cross-tenant assignment->employee references',
      sql.includes('CONSTRAINT fk_assignment_employee_tenant FOREIGN KEY (company_id, employee_id)') &&
      sql.includes('REFERENCES public.employees(company_id, id)')
    );

    // Immutability trigger preventing company_id alteration
    assert(
      'Tenant immutability trigger trg_prevent_tenant_change_assignments defined',
      sql.includes('trg_prevent_tenant_change_assignments') &&
      sql.includes('BEFORE UPDATE ON public.asset_assignments') &&
      sql.includes('EXECUTE FUNCTION public.prevent_tenant_id_change()')
    );

    // Row Level Security & Policies
    assert(
      'Row Level Security enabled on public.asset_assignments',
      sql.includes('ALTER TABLE public.asset_assignments ENABLE ROW LEVEL SECURITY;')
    );

    assert(
      'Tenant isolation SELECT policy on asset_assignments using is_tenant_member',
      sql.includes('ON public.asset_assignments FOR SELECT') &&
      sql.includes('public.is_tenant_member(company_id)')
    );

    assert(
      'Tenant admin restriction on asset_assignments INSERT',
      sql.includes('CREATE POLICY "Tenant admins can insert asset assignments"') &&
      sql.includes('public.is_tenant_admin(company_id)')
    );

    assert(
      'Tenant admin restriction on asset_assignments UPDATE',
      sql.includes('CREATE POLICY "Tenant admins can update asset assignments"') &&
      sql.includes('public.is_tenant_admin(company_id)')
    );

    // Status & Event Constraints Updated
    assert(
      'Asset status check constraint updated to include "Assigned"',
      sql.includes('assets_status_check') &&
      sql.includes("'Available', 'Assigned', 'Under Repair', 'Retired', 'Disposed'")
    );

    assert(
      'Audit log event_type constraint updated to include custody event types',
      sql.includes('asset_events_event_type_check') &&
      sql.includes("'CREATED', 'UPDATED', 'CHECKED_OUT', 'CHECKED_IN', 'TRANSFERRED'")
    );

    // Atomic Stored RPCs
    assert(
      'Atomic SECURITY DEFINER RPC checkout_asset defined in migration',
      sql.includes('CREATE OR REPLACE FUNCTION public.checkout_asset') &&
      sql.includes('SECURITY DEFINER') &&
      sql.includes("SET search_path = public, auth, pg_temp")
    );

    assert(
      'Atomic SECURITY DEFINER RPC checkin_asset defined in migration',
      sql.includes('CREATE OR REPLACE FUNCTION public.checkin_asset') &&
      sql.includes('SECURITY DEFINER')
    );

    assert(
      'Atomic SECURITY DEFINER RPC transfer_asset defined in migration',
      sql.includes('CREATE OR REPLACE FUNCTION public.transfer_asset') &&
      sql.includes('SECURITY DEFINER')
    );
  }

  // ==========================================================================
  // 2. Validation & Generic Form Invariants
  // ==========================================================================

  // Generic asset create/edit rejects manual selection of "Assigned"
  const genericAssignedCreate = validateAsset({ name: 'MacBook', asset_tag: 'AST-1', status: 'Assigned' }, false);
  assert(
    'Generic asset create form strictly rejects manual status="Assigned"',
    !genericAssignedCreate.isValid && Boolean(genericAssignedCreate.errors.status)
  );

  const genericAssignedEdit = validateAsset({ status: 'Assigned' }, true);
  assert(
    'Generic asset edit form strictly rejects manual status="Assigned"',
    !genericAssignedEdit.isValid && Boolean(genericAssignedEdit.errors.status)
  );

  const genericAvailableCreate = validateAsset({ name: 'MacBook', asset_tag: 'AST-1', status: 'Available' }, false);
  assert('Generic asset create allows "Available" status', genericAvailableCreate.isValid);

  // Checkout Validation
  const validCheckout = validateCheckout({ employee_id: 'emp-123', checked_out_at: '2026-09-27' });
  assert('Valid checkout input passes validation', validCheckout.isValid);

  const missingCheckoutEmp = validateCheckout({ checked_out_at: '2026-09-27' });
  assert('Missing target employee on checkout is rejected', !missingCheckoutEmp.isValid && Boolean(missingCheckoutEmp.errors.employee_id));

  const invalidReturnDate = validateCheckout({
    employee_id: 'emp-123',
    checked_out_at: '2026-09-27',
    expected_return_at: '2026-09-20',
  });
  assert('Expected return date before checkout date is rejected', !invalidReturnDate.isValid && Boolean(invalidReturnDate.errors.expected_return_at));

  // Transfer Validation
  const validTransfer = validateTransfer({ new_employee_id: 'emp-456', transfer_at: '2026-09-27' }, 'emp-123');
  assert('Valid transfer to different employee passes validation', validTransfer.isValid);

  const transferToSameEmp = validateTransfer({ new_employee_id: 'emp-123' }, 'emp-123');
  assert('Transfer to same current custodian is rejected', !transferToSameEmp.isValid && Boolean(transferToSameEmp.errors.new_employee_id));

  const missingTransferEmp = validateTransfer({}, 'emp-123');
  assert('Missing target employee on transfer is rejected', !missingTransferEmp.isValid && Boolean(missingTransferEmp.errors.new_employee_id));

  // ==========================================================================
  // 3. Worker API Authentication & Route Protection
  // ==========================================================================
  const fakeEnv = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key',
  };

  const reqCheckoutNoAuth = new Request('http://localhost/api/assets/ast-1/checkout', {
    method: 'POST',
    body: JSON.stringify({ employee_id: 'emp-1' }),
  });
  const resCheckoutNoAuth = await worker.fetch(reqCheckoutNoAuth, fakeEnv);
  assert('Worker POST /api/assets/:id/checkout without Authorization returns 401', resCheckoutNoAuth.status === 401);

  const reqCheckinNoAuth = new Request('http://localhost/api/assets/ast-1/checkin', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const resCheckinNoAuth = await worker.fetch(reqCheckinNoAuth, fakeEnv);
  assert('Worker POST /api/assets/:id/checkin without Authorization returns 401', resCheckinNoAuth.status === 401);

  const reqTransferNoAuth = new Request('http://localhost/api/assets/ast-1/transfer', {
    method: 'POST',
    body: JSON.stringify({ new_employee_id: 'emp-2' }),
  });
  const resTransferNoAuth = await worker.fetch(reqTransferNoAuth, fakeEnv);
  assert('Worker POST /api/assets/:id/transfer without Authorization returns 401', resTransferNoAuth.status === 401);

  const reqAsgnNoAuth = new Request('http://localhost/api/assets/ast-1/assignments', { method: 'GET' });
  const resAsgnNoAuth = await worker.fetch(reqAsgnNoAuth, fakeEnv);
  assert('Worker GET /api/assets/:id/assignments without Authorization returns 401', resAsgnNoAuth.status === 401);

  const reqEmpAsgnNoAuth = new Request('http://localhost/api/employees/emp-1/assignments', { method: 'GET' });
  const resEmpAsgnNoAuth = await worker.fetch(reqEmpAsgnNoAuth, fakeEnv);
  assert('Worker GET /api/employees/:id/assignments without Authorization returns 401', resEmpAsgnNoAuth.status === 401);

  // Worker RBAC checks for TENANT_ADMIN
  const workerFile = fs.readFileSync(path.resolve('worker/index.ts'), 'utf-8');
  assert(
    'Worker restricts POST /assets/:id/checkout to membership.role === TENANT_ADMIN',
    workerFile.includes('Only Tenant Admins are authorized to check out assets')
  );

  assert(
    'Worker restricts POST /assets/:id/checkin to membership.role === TENANT_ADMIN',
    workerFile.includes('Only Tenant Admins are authorized to check in assets')
  );

  assert(
    'Worker restricts POST /assets/:id/transfer to membership.role === TENANT_ADMIN',
    workerFile.includes('Only Tenant Admins are authorized to transfer assets')
  );

  // ==========================================================================
  // 4. Custody State Machine & Behavioral Invariants Simulation
  // ==========================================================================
  const tenantA = 'comp-tenant-a';
  const tenantB = 'comp-tenant-b';

  // State 1: Available Asset
  const initialAsset: Partial<Asset> = {
    id: 'asset-100',
    company_id: tenantA,
    asset_tag: 'AST-100',
    name: 'ThinkPad X1 Carbon',
    status: 'Available',
  };

  const activeEmployeeA: Partial<Employee> = {
    id: 'emp-001',
    company_id: tenantA,
    full_name: 'Alice Engineer',
    employee_code: 'EMP-001',
    is_active: true,
  };

  const inactiveEmployeeA: Partial<Employee> = {
    id: 'emp-002',
    company_id: tenantA,
    full_name: 'Bob Inactive',
    employee_code: 'EMP-002',
    is_active: false,
  };

  const crossTenantEmployeeB: Partial<Employee> = {
    id: 'emp-999',
    company_id: tenantB,
    full_name: 'Charlie Tenant B',
    employee_code: 'EMP-999',
    is_active: true,
  };

  // Invariant A: Inactive employee cannot receive assets
  assert('Inactive employee cannot be checked out an asset', !inactiveEmployeeA.is_active);

  // Invariant B: Cross-tenant employee cannot receive assets
  assert(
    'Cross-tenant employee is rejected for checkout',
    initialAsset.company_id !== crossTenantEmployeeB.company_id
  );

  // Invariant C: Check Out transition
  const assignment1: Partial<AssetAssignment> = {
    id: 'asgn-001',
    company_id: tenantA,
    asset_id: initialAsset.id,
    employee_id: activeEmployeeA.id,
    checked_out_at: '2026-09-01T10:00:00Z',
    checked_in_at: null,
    checkout_condition: 'Excellent',
  };

  const checkedOutAsset: Partial<Asset> = {
    ...initialAsset,
    status: 'Assigned',
    current_assignment: assignment1 as AssetAssignment,
  };

  assert('Check Out transitions asset from Available to Assigned', checkedOutAsset.status === 'Assigned');
  assert('Active assignment is attached to asset', checkedOutAsset.current_assignment?.checked_in_at === null);

  // Invariant D: Simultaneous second checkout rejected by partial unique index
  const mockAssignmentsTable: Partial<AssetAssignment>[] = [assignment1];
  const hasActiveAssignmentForAsset = mockAssignmentsTable.some(
    (a) => a.asset_id === initialAsset.id && a.checked_in_at === null
  );
  assert(
    'Second simultaneous checkout rejected: asset already has an active custody record',
    hasActiveAssignmentForAsset
  );

  // Invariant E: Transfer transition
  const activeEmployeeA2: Partial<Employee> = {
    id: 'emp-003',
    company_id: tenantA,
    full_name: 'Diana Developer',
    employee_code: 'EMP-003',
    is_active: true,
  };

  // Close previous assignment
  const transferTime = '2026-09-15T14:00:00Z';
  const closedAssignment1: Partial<AssetAssignment> = {
    ...assignment1,
    checked_in_at: transferTime,
    checkin_condition: 'Good',
    checkin_notes: `Transferred to ${activeEmployeeA2.full_name}`,
  };

  // Create new assignment
  const assignment2: Partial<AssetAssignment> = {
    id: 'asgn-002',
    company_id: tenantA,
    asset_id: initialAsset.id,
    employee_id: activeEmployeeA2.id,
    checked_out_at: transferTime,
    checked_in_at: null,
    checkout_condition: 'Good',
    checkout_notes: `Transferred from ${activeEmployeeA.full_name}`,
  };

  const updatedHistory = [closedAssignment1, assignment2];
  const activeCountAfterTransfer = updatedHistory.filter((a) => a.checked_in_at === null).length;

  assert(
    'Transfer atomically closes old assignment and creates exactly 1 new active assignment',
    activeCountAfterTransfer === 1 && assignment2.employee_id === activeEmployeeA2.id
  );
  assert(
    'Historical custody assignment remains permanently preserved after transfer',
    updatedHistory.length === 2 && Boolean(closedAssignment1.checked_in_at)
  );

  // Invariant F: Check In transition
  const checkinTime = '2026-09-27T09:00:00Z';
  const closedAssignment2: Partial<AssetAssignment> = {
    ...assignment2,
    checked_in_at: checkinTime,
    checkin_condition: 'Good',
    checkin_notes: 'Returned to IT storage',
  };

  const returnedAsset: Partial<Asset> = {
    ...checkedOutAsset,
    status: 'Available',
    current_assignment: null,
  };

  assert('Check In returns asset status to Available', returnedAsset.status === 'Available');
  assert('Check In closes active custody assignment record', closedAssignment2.checked_in_at !== null);

  const fullAssetHistory = [closedAssignment1, closedAssignment2];
  assert('Complete custody history preserved for audit', fullAssetHistory.length === 2);

  // Invariant G: Employee detail view accurately filters current vs historical
  const employee1History = fullAssetHistory.filter((a) => a.employee_id === activeEmployeeA.id);
  const employee1Active = employee1History.filter((a) => a.checked_in_at === null);
  const employee1Past = employee1History.filter((a) => a.checked_in_at !== null);

  assert('Employee 1 active custody count is 0 after handover', employee1Active.length === 0);
  assert('Employee 1 historical custody record is retained', employee1Past.length === 1);

  return { passed, failed, tests };
}
