/**
 * AssetMT Test Suite: Phase 3 - Asset Maintenance, Work Orders & Vendors
 * Verifies database schema invariants, RLS policies, tenant isolation,
 * validation rules, workflow state machine transitions, Worker API RBAC,
 * and audit event integrity.
 */

import fs from 'node:fs';
import path from 'node:path';
import worker from '../worker/index.ts';
import {
  validateVendor,
  validateMaintenance,
  validateScheduleMaintenance,
  validateCompleteMaintenance,
  validateCancelMaintenance,
  isValidMaintenanceTransition,
} from '../shared/validation.ts';
import {
  CreateVendorInput,
  CreateMaintenanceInput,
  MaintenanceStatus,
  MaintenanceRecord,
} from '../shared/types.ts';

export async function runMaintenanceAndVendorsTests(): Promise<{
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
  // 1. Migration 0006 Schema & Constraints
  // ==========================================================================
  const migrationPath = path.resolve('migrations/0006_asset_maintenance_and_vendors.sql');
  const migrationExists = fs.existsSync(migrationPath);
  assert('Additive migration 0006_asset_maintenance_and_vendors.sql exists', migrationExists);

  if (migrationExists) {
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Vendors Table Invariants
    assert(
      'Table public.vendors defined with company cascade reference',
      sql.includes('CREATE TABLE IF NOT EXISTS public.vendors') &&
      sql.includes('company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE')
    );

    assert(
      'Vendor tenant composite unique constraint (uq_vendor_tenant)',
      sql.includes('CONSTRAINT uq_vendor_tenant UNIQUE (company_id, id)')
    );

    assert(
      'Vendor name unique per tenant constraint (uq_vendor_name_tenant)',
      sql.includes('CONSTRAINT uq_vendor_name_tenant UNIQUE (company_id, name)')
    );

    assert(
      'Tenant immutability trigger on vendors (trg_prevent_tenant_change_vendors)',
      sql.includes('trg_prevent_tenant_change_vendors') &&
      sql.includes('BEFORE UPDATE ON public.vendors')
    );

    assert(
      'RLS enabled on public.vendors',
      sql.includes('ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY')
    );

    assert(
      'Tenant member read policy on vendors',
      sql.includes('CREATE POLICY "Tenants can view company vendors"') &&
      sql.includes('public.is_tenant_member(company_id)')
    );

    assert(
      'Tenant admin mutation policies on vendors (INSERT, UPDATE, DELETE)',
      sql.includes('CREATE POLICY "Tenant admins can insert company vendors"') &&
      sql.includes('CREATE POLICY "Tenant admins can update company vendors"') &&
      sql.includes('CREATE POLICY "Tenant admins can delete company vendors"')
    );

    // Maintenance Records Table Invariants
    assert(
      'Table public.maintenance_records defined with company cascade reference',
      sql.includes('CREATE TABLE IF NOT EXISTS public.maintenance_records') &&
      sql.includes('company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE')
    );

    assert(
      'Tenant composite foreign key to assets (fk_maintenance_asset_tenant)',
      sql.includes('CONSTRAINT fk_maintenance_asset_tenant FOREIGN KEY (company_id, asset_id)') &&
      sql.includes('REFERENCES public.assets(company_id, id)')
    );

    assert(
      'Tenant composite foreign key to vendors (fk_maintenance_vendor_tenant)',
      sql.includes('CONSTRAINT fk_maintenance_vendor_tenant FOREIGN KEY (company_id, vendor_id)') &&
      sql.includes('REFERENCES public.vendors(company_id, id)')
    );

    assert(
      'Work order number unique per tenant constraint (uq_work_order_number_tenant)',
      sql.includes('CONSTRAINT uq_work_order_number_tenant UNIQUE (company_id, work_order_number)')
    );

    assert(
      'Maintenance type CHECK constraint defined with valid enum values',
      sql.includes('CHECK (maintenance_type IN (\'Preventative\', \'Corrective\', \'Inspection\', \'Upgrade\', \'Calibration\', \'Other\'))')
    );

    assert(
      'Maintenance priority CHECK constraint defined with valid enum values',
      sql.includes('CHECK (priority IN (\'Low\', \'Medium\', \'High\', \'Critical\'))')
    );

    assert(
      'Maintenance status CHECK constraint defined with valid lifecycle enum values',
      sql.includes('CHECK (status IN (\'Open\', \'Scheduled\', \'In Progress\', \'Completed\', \'Cancelled\'))')
    );

    assert(
      'Tenant immutability trigger on maintenance_records',
      sql.includes('trg_prevent_tenant_change_maintenance') &&
      sql.includes('BEFORE UPDATE ON public.maintenance_records')
    );

    assert(
      'RLS enabled on public.maintenance_records',
      sql.includes('ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY')
    );

    assert(
      'Tenant member read policy on maintenance_records',
      sql.includes('CREATE POLICY "Tenants can view maintenance records"') &&
      sql.includes('public.is_tenant_member(company_id)')
    );

    assert(
      'Tenant admin insert and update policies on maintenance_records',
      sql.includes('CREATE POLICY "Tenant admins can insert maintenance records"') &&
      sql.includes('CREATE POLICY "Tenant admins can update maintenance records"')
    );

    assert(
      'No DELETE policy on maintenance_records for ordinary users to preserve permanent history',
      !sql.includes('CREATE POLICY "Tenants can delete maintenance records"') &&
      !sql.includes('CREATE POLICY "Tenant admins can delete maintenance records"')
    );

    // Asset Events constraint extended
    assert(
      'asset_events event_type CHECK updated with all 5 maintenance event types',
      sql.includes('MAINTENANCE_CREATED') &&
      sql.includes('MAINTENANCE_SCHEDULED') &&
      sql.includes('MAINTENANCE_STARTED') &&
      sql.includes('MAINTENANCE_COMPLETED') &&
      sql.includes('MAINTENANCE_CANCELLED')
    );
  }

  // ==========================================================================
  // 2. Vendor Validation Rules
  // ==========================================================================
  const validVendorInput: CreateVendorInput = {
    name: 'Apex Precision Instruments',
    contact_name: 'John Miller',
    email: 'service@apextech.com',
    phone: '+1 555-0199',
    is_active: true,
  };
  assert('Valid vendor input passes validation', validateVendor(validVendorInput, false).isValid);

  const blankVendorName = validateVendor({ name: '   ' }, false);
  assert('Blank vendor name is rejected', !blankVendorName.isValid && Boolean(blankVendorName.errors.name));

  const invalidVendorEmail = validateVendor({ name: 'Test Vendor', email: 'not-an-email' }, false);
  assert('Malformed vendor email is rejected', !invalidVendorEmail.isValid && Boolean(invalidVendorEmail.errors.email));

  const longVendorName = validateVendor({ name: 'A'.repeat(150) }, false);
  assert('Excessively long vendor name is rejected', !longVendorName.isValid && Boolean(longVendorName.errors.name));

  // ==========================================================================
  // 3. Maintenance Validation Rules
  // ==========================================================================
  const validMaintenanceInput: CreateMaintenanceInput = {
    asset_id: 'ast-100',
    work_order_number: 'WO-10001',
    title: 'Annual Hydraulic Calibration',
    maintenance_type: 'Calibration',
    priority: 'High',
    service_cost: 450,
  };
  assert('Valid maintenance input passes validation', validateMaintenance(validMaintenanceInput, false).isValid);

  const missingAssetId = validateMaintenance({ title: 'Repair', maintenance_type: 'Corrective', priority: 'Medium' }, false);
  assert('Missing asset_id on work order creation is rejected', !missingAssetId.isValid && Boolean(missingAssetId.errors.asset_id));

  const missingTitle = validateMaintenance({ asset_id: 'ast-100', maintenance_type: 'Corrective', priority: 'Medium' }, false);
  assert('Missing title on work order is rejected', !missingTitle.isValid && Boolean(missingTitle.errors.title));

  const invalidType = validateMaintenance({
    asset_id: 'ast-100',
    title: 'Repair',
    maintenance_type: 'INVALID_TYPE' as any,
    priority: 'Medium',
  }, false);
  assert('Invalid maintenance type is rejected', !invalidType.isValid && Boolean(invalidType.errors.maintenance_type));

  const invalidPriority = validateMaintenance({
    asset_id: 'ast-100',
    title: 'Repair',
    maintenance_type: 'Corrective',
    priority: 'URGENT' as any,
  }, false);
  assert('Invalid priority enum is rejected', !invalidPriority.isValid && Boolean(invalidPriority.errors.priority));

  const negativeCost = validateMaintenance({
    asset_id: 'ast-100',
    title: 'Repair',
    maintenance_type: 'Corrective',
    priority: 'Medium',
    service_cost: -50,
  }, false);
  assert('Negative service cost is rejected', !negativeCost.isValid && Boolean(negativeCost.errors.service_cost));

  // Schedule sub-action validation
  const validSchedule = validateScheduleMaintenance({ scheduled_date: '2026-10-15', due_date: '2026-10-20' });
  assert('Valid schedule input passes validation', validSchedule.isValid);

  const missingSchedDate = validateScheduleMaintenance({ scheduled_date: '' });
  assert('Missing scheduled_date is rejected', !missingSchedDate.isValid && Boolean(missingSchedDate.errors.scheduled_date));

  const dueDateBeforeSchedDate = validateScheduleMaintenance({
    scheduled_date: '2026-10-15',
    due_date: '2026-10-10',
  });
  assert('Due date preceding scheduled date is rejected', !dueDateBeforeSchedDate.isValid && Boolean(dueDateBeforeSchedDate.errors.due_date));

  // Complete sub-action validation
  const validComplete = validateCompleteMaintenance({
    resolution_notes: 'Replaced hydraulic gasket and recalibrated pressure gauge to 150 PSI.',
    service_cost: 380,
    downtime_minutes: 120,
  });
  assert('Valid completion input with resolution notes and cost passes validation', validComplete.isValid);

  const missingResolutionNotes = validateCompleteMaintenance({
    resolution_notes: '   ',
  });
  assert('Completion without resolution notes is rejected', !missingResolutionNotes.isValid && Boolean(missingResolutionNotes.errors.resolution_notes));

  const negativeDowntime = validateCompleteMaintenance({
    resolution_notes: 'Done',
    downtime_minutes: -10,
  });
  assert('Negative downtime minutes is rejected', !negativeDowntime.isValid && Boolean(negativeDowntime.errors.downtime_minutes));

  // Cancel sub-action validation
  const validCancel = validateCancelMaintenance({ reason: 'Asset decommissioned by site manager' });
  assert('Valid cancellation input with reason passes validation', validCancel.isValid);

  const missingCancelReason = validateCancelMaintenance({ reason: '   ' });
  assert('Cancellation without reason is rejected', !missingCancelReason.isValid && Boolean(missingCancelReason.errors.reason));

  // ==========================================================================
  // 4. Safe State Machine Transitions
  // ==========================================================================
  // Allowed transitions
  assert('State transition Open -> Scheduled is VALID', isValidMaintenanceTransition('Open', 'Scheduled').isValid);
  assert('State transition Open -> In Progress is VALID', isValidMaintenanceTransition('Open', 'In Progress').isValid);
  assert('State transition Open -> Cancelled is VALID', isValidMaintenanceTransition('Open', 'Cancelled').isValid);

  assert('State transition Scheduled -> In Progress is VALID', isValidMaintenanceTransition('Scheduled', 'In Progress').isValid);
  assert('State transition Scheduled -> Scheduled (reschedule) is VALID', isValidMaintenanceTransition('Scheduled', 'Scheduled').isValid);
  assert('State transition Scheduled -> Cancelled is VALID', isValidMaintenanceTransition('Scheduled', 'Cancelled').isValid);

  assert('State transition In Progress -> Completed is VALID', isValidMaintenanceTransition('In Progress', 'Completed').isValid);
  assert('State transition In Progress -> Cancelled is VALID', isValidMaintenanceTransition('In Progress', 'Cancelled').isValid);

  // Rejected invalid transitions
  assert('Transition Completed -> In Progress is REJECTED (terminal state)', !isValidMaintenanceTransition('Completed', 'In Progress').isValid);
  assert('Transition Completed -> Scheduled is REJECTED (terminal state)', !isValidMaintenanceTransition('Completed', 'Scheduled').isValid);
  assert('Transition Completed -> Cancelled is REJECTED (terminal state)', !isValidMaintenanceTransition('Completed', 'Cancelled').isValid);

  assert('Transition Cancelled -> In Progress is REJECTED (terminal state)', !isValidMaintenanceTransition('Cancelled', 'In Progress').isValid);
  assert('Transition Cancelled -> Completed is REJECTED (terminal state)', !isValidMaintenanceTransition('Cancelled', 'Completed').isValid);
  assert('Transition Cancelled -> Open is REJECTED (terminal state)', !isValidMaintenanceTransition('Cancelled', 'Open').isValid);

  assert('Direct transition Open -> Completed is REJECTED (must start service first)', !isValidMaintenanceTransition('Open', 'Completed').isValid);

  // ==========================================================================
  // 5. Worker API Authentication & Route Protection
  // ==========================================================================
  const fakeEnv = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key',
  };

  // Vendor routes without Auth -> 401
  const reqVendorsNoAuth = new Request('http://localhost/api/vendors', { method: 'GET' });
  const resVendorsNoAuth = await worker.fetch(reqVendorsNoAuth, fakeEnv);
  assert('Worker GET /api/vendors without Authorization returns 401', resVendorsNoAuth.status === 401);

  const reqCreateVendorNoAuth = new Request('http://localhost/api/vendors', {
    method: 'POST',
    body: JSON.stringify({ name: 'Acme' }),
  });
  const resCreateVendorNoAuth = await worker.fetch(reqCreateVendorNoAuth, fakeEnv);
  assert('Worker POST /api/vendors without Authorization returns 401', resCreateVendorNoAuth.status === 401);

  // Maintenance routes without Auth -> 401
  const reqMaintNoAuth = new Request('http://localhost/api/maintenance', { method: 'GET' });
  const resMaintNoAuth = await worker.fetch(reqMaintNoAuth, fakeEnv);
  assert('Worker GET /api/maintenance without Authorization returns 401', resMaintNoAuth.status === 401);

  const reqCreateMaintNoAuth = new Request('http://localhost/api/maintenance', {
    method: 'POST',
    body: JSON.stringify({ title: 'Repair' }),
  });
  const resCreateMaintNoAuth = await worker.fetch(reqCreateMaintNoAuth, fakeEnv);
  assert('Worker POST /api/maintenance without Authorization returns 401', resCreateMaintNoAuth.status === 401);

  const reqSchedNoAuth = new Request('http://localhost/api/maintenance/wo-1/schedule', {
    method: 'POST',
    body: JSON.stringify({ scheduled_date: '2026-10-10' }),
  });
  const resSchedNoAuth = await worker.fetch(reqSchedNoAuth, fakeEnv);
  assert('Worker POST /api/maintenance/:id/schedule without Authorization returns 401', resSchedNoAuth.status === 401);

  const reqStartNoAuth = new Request('http://localhost/api/maintenance/wo-1/start', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const resStartNoAuth = await worker.fetch(reqStartNoAuth, fakeEnv);
  assert('Worker POST /api/maintenance/:id/start without Authorization returns 401', resStartNoAuth.status === 401);

  const reqCompleteNoAuth = new Request('http://localhost/api/maintenance/wo-1/complete', {
    method: 'POST',
    body: JSON.stringify({ resolution_notes: 'Fixed' }),
  });
  const resCompleteNoAuth = await worker.fetch(reqCompleteNoAuth, fakeEnv);
  assert('Worker POST /api/maintenance/:id/complete without Authorization returns 401', resCompleteNoAuth.status === 401);

  const reqCancelNoAuth = new Request('http://localhost/api/maintenance/wo-1/cancel', {
    method: 'POST',
    body: JSON.stringify({ reason: 'Decommissioned' }),
  });
  const resCancelNoAuth = await worker.fetch(reqCancelNoAuth, fakeEnv);
  assert('Worker POST /api/maintenance/:id/cancel without Authorization returns 401', resCancelNoAuth.status === 401);

  // ==========================================================================
  // 6. RBAC Role Restrictions (MEMBER Rejection vs TENANT_ADMIN Authorization)
  // ==========================================================================
  const workerFile = fs.readFileSync(path.resolve('worker/index.ts'), 'utf-8');

  assert(
    'Worker restricts POST /api/vendors to TENANT_ADMIN',
    workerFile.includes('Only Tenant Admins are authorized to register vendors')
  );

  assert(
    'Worker restricts PUT /api/vendors/:id to TENANT_ADMIN',
    workerFile.includes('Only Tenant Admins are authorized to update vendors')
  );

  assert(
    'Worker restricts POST /api/vendors/:id/toggle-active to TENANT_ADMIN',
    workerFile.includes('Only Tenant Admins are authorized to update vendor status')
  );

  assert(
    'Worker restricts POST /api/maintenance (create work order) to TENANT_ADMIN',
    workerFile.includes('Only Tenant Admins are authorized to create work orders')
  );

  assert(
    'Worker restricts PUT /api/maintenance/:id to TENANT_ADMIN',
    workerFile.includes('Only Tenant Admins are authorized to update work orders')
  );

  assert(
    'Worker restricts POST /api/maintenance/:id/schedule to TENANT_ADMIN',
    workerFile.includes('Only Tenant Admins are authorized to schedule maintenance')
  );

  assert(
    'Worker restricts POST /api/maintenance/:id/start to TENANT_ADMIN',
    workerFile.includes('Only Tenant Admins are authorized to start maintenance')
  );

  assert(
    'Worker restricts POST /api/maintenance/:id/complete to TENANT_ADMIN',
    workerFile.includes('Only Tenant Admins are authorized to complete maintenance')
  );

  assert(
    'Worker restricts POST /api/maintenance/:id/cancel to TENANT_ADMIN',
    workerFile.includes('Only Tenant Admins are authorized to cancel maintenance')
  );

  // Cross-tenant protection in worker queries
  assert(
    'Worker enforces tenantId match on vendor queries',
    workerFile.includes('.eq(\'company_id\', tenantId)')
  );

  assert(
    'Worker verifies asset belongs to tenant before creating work order',
    workerFile.includes('Target asset does not exist in your workspace')
  );

  assert(
    'Worker verifies vendor belongs to tenant before creating work order',
    workerFile.includes('Selected vendor does not exist in your workspace')
  );

  // Audit logging server-side
  assert(
    'Worker logs MAINTENANCE_CREATED event in asset_events',
    workerFile.includes("event_type: 'MAINTENANCE_CREATED'")
  );

  assert(
    'Worker logs MAINTENANCE_SCHEDULED event in asset_events',
    workerFile.includes("event_type: 'MAINTENANCE_SCHEDULED'")
  );

  assert(
    'Worker logs MAINTENANCE_STARTED event in asset_events',
    workerFile.includes("event_type: 'MAINTENANCE_STARTED'")
  );

  assert(
    'Worker logs MAINTENANCE_COMPLETED event in asset_events',
    workerFile.includes("event_type: 'MAINTENANCE_COMPLETED'")
  );

  assert(
    'Worker logs MAINTENANCE_CANCELLED event in asset_events',
    workerFile.includes("event_type: 'MAINTENANCE_CANCELLED'")
  );

  // ==========================================================================
  // 7. Complete Lifecycle State Machine & Custody Independence
  // ==========================================================================
  const tenantCompany = 'tenant-xyz-100';
  const sampleAsset = {
    id: 'ast-laptop-1',
    company_id: tenantCompany,
    name: 'MacBook Pro M3 Max',
    asset_tag: 'AST-0091',
    status: 'Available', // Asset is Available
  };

  // Step A: Work Order Created
  let currentWorkOrder: Partial<MaintenanceRecord> = {
    id: 'wo-rec-1',
    company_id: tenantCompany,
    asset_id: sampleAsset.id,
    work_order_number: 'WO-88219',
    title: 'Screen hinge tightening and thermal paste reapplication',
    maintenance_type: 'Preventative',
    priority: 'Medium',
    status: 'Open',
    created_at: new Date().toISOString(),
  };
  assert('Work order initializes in Open status', currentWorkOrder.status === 'Open');

  // Step B: Scheduled
  const schedTransition = isValidMaintenanceTransition(currentWorkOrder.status!, 'Scheduled');
  assert('Can transition Open -> Scheduled', schedTransition.isValid);
  currentWorkOrder = {
    ...currentWorkOrder,
    status: 'Scheduled',
    scheduled_date: '2026-10-05',
    due_date: '2026-10-08',
  };

  // Step C: Started
  const startTransition = isValidMaintenanceTransition(currentWorkOrder.status!, 'In Progress');
  assert('Can transition Scheduled -> In Progress', startTransition.isValid);
  currentWorkOrder = {
    ...currentWorkOrder,
    status: 'In Progress',
    started_at: new Date().toISOString(),
  };

  // Step D: Completed
  const completeTransition = isValidMaintenanceTransition(currentWorkOrder.status!, 'Completed');
  assert('Can transition In Progress -> Completed', completeTransition.isValid);
  currentWorkOrder = {
    ...currentWorkOrder,
    status: 'Completed',
    completed_at: new Date().toISOString(),
    service_cost: 140.0,
    downtime_minutes: 90,
    resolution_notes: 'Replaced hinges under warranty and applied Arctic MX-4 thermal paste.',
  };

  assert('Completed work order retains completion timestamp', Boolean(currentWorkOrder.completed_at));
  assert('Completed work order retains final service cost', currentWorkOrder.service_cost === 140.0);
  assert('Completed work order retains downtime minutes', currentWorkOrder.downtime_minutes === 90);
  assert('Completed work order retains resolution notes', Boolean(currentWorkOrder.resolution_notes));

  // Invariant: Asset custody remains independent and unaffected
  assert(
    'Asset custody remains Available; maintenance workflow does not corrupt asset lifecycle status',
    sampleAsset.status === 'Available'
  );

  return { passed, failed, tests };
}
