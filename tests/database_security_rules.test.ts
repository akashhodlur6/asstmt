/**
 * AssetMT Test Suite: Database Schema & Security Architecture
 * Inspects migrations/0001_initial_schema.sql to verify all multi-tenant invariants.
 */

import fs from 'node:fs';
import path from 'node:path';

export function runDatabaseSecurityTests(): { passed: number; failed: number; tests: string[] } {
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

  const migrationPath = path.resolve('migrations/0001_initial_schema.sql');
  const migrationExists = fs.existsSync(migrationPath);
  assert('Database migration file exists at migrations/0001_initial_schema.sql', migrationExists);

  if (!migrationExists) {
    return { passed, failed, tests };
  }

  const sql = fs.readFileSync(migrationPath, 'utf-8');

  // 1. Table definitions
  const requiredTables = [
    'companies',
    'memberships',
    'categories',
    'sites',
    'locations',
    'assets',
    'asset_events',
  ];
  for (const table of requiredTables) {
    const tablePattern = new RegExp(`CREATE TABLE (IF NOT EXISTS )?public\\.${table}`, 'i');
    assert(`Table public.${table} is defined in migration`, tablePattern.test(sql));
  }

  // 2. Multi-tenant composite constraints preventing cross-tenant references
  assert(
    'Composite foreign key constraint preventing cross-tenant location->site references',
    sql.includes('fk_location_site_tenant FOREIGN KEY (company_id, site_id)')
  );
  assert(
    'Composite foreign key constraint preventing cross-tenant asset->category references',
    sql.includes('fk_asset_category_tenant FOREIGN KEY (company_id, category_id)')
  );
  assert(
    'Composite foreign key constraint preventing cross-tenant asset->site references',
    sql.includes('fk_asset_site_tenant FOREIGN KEY (company_id, site_id)')
  );
  assert(
    'Composite foreign key constraint preventing cross-tenant asset->location references',
    sql.includes('fk_asset_location_tenant FOREIGN KEY (company_id, location_id)')
  );

  // 3. Asset tag uniqueness within tenant
  assert(
    'Tenant-scoped asset tag uniqueness constraint (uq_asset_tag_tenant)',
    sql.includes('uq_asset_tag_tenant UNIQUE (company_id, asset_tag)')
  );

  // 4. Immutability of tenant_id trigger
  assert(
    'Trigger function prevent_tenant_id_change exists to forbid changing company_id',
    sql.includes('prevent_tenant_id_change()') && sql.includes('Changing company_id (tenant_id) is strictly forbidden')
  );

  // 5. Transactional server-side audit logging trigger
  assert(
    'Transactional audit trigger record_asset_audit_event() logs CREATED and UPDATED events',
    sql.includes('record_asset_audit_event()') && sql.includes('INSERT INTO public.asset_events')
  );

  // 6. Atomic onboarding SECURITY DEFINER function
  assert(
    'Atomic onboarding function create_company_workspace() exists with SECURITY DEFINER and search_path',
    sql.includes('CREATE OR REPLACE FUNCTION public.create_company_workspace') &&
      sql.includes('SECURITY DEFINER') &&
      sql.includes('SET search_path = public')
  );
  assert(
    'Onboarding assigns initial TENANT_ADMIN membership derived from auth.uid()',
    sql.includes("VALUES (v_company_id, v_user_id, 'TENANT_ADMIN')")
  );

  // 7. RLS policies on all tables
  for (const table of requiredTables) {
    const rlsPattern = new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, 'i');
    assert(`Row Level Security enabled on public.${table}`, rlsPattern.test(sql));
  }

  // 8. Direct audit events manipulation blocked
  assert(
    'Audit table public.asset_events has SELECT policy but denies direct INSERT/UPDATE/DELETE to normal users',
    sql.includes('CREATE POLICY "Tenants can select asset events"\n    ON public.asset_events FOR SELECT') &&
      !sql.includes('ON public.asset_events FOR INSERT\n    WITH CHECK (true)')
  );

  return { passed, failed, tests };
}
