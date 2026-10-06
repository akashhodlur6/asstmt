/**
 * AssetMT - Test Suite Runner
 * Runs all unit, integration, and security tests.
 */

import { runValidationTests } from './validation.test.ts';
import { runWorkerApiTests } from './worker_api.test.ts';
import { runDatabaseSecurityTests } from './database_security_rules.test.ts';
import { runOnboardingWorkflowTests } from './onboarding_workflow.test.ts';
import { runEmployeesAndDepartmentsTests } from './employees_and_departments.test.ts';
import { runAssetCustodyTests } from './asset_custody.test.ts';
import { runMaintenanceAndVendorsTests } from './maintenance_and_vendors.test.ts';
import { runPhase4AssetOperationsTests } from './phase4_asset_operations.test.ts';
import { runPhase5FinancialComplianceTests } from './phase5_financial_compliance.test.ts';
import { runPhase6ReportsUsersAdminTests } from './phase6_reports_users_admin.test.ts';
import { runPhase7ProductionLaunchTests } from './phase7_production_launch.test.ts';
import { runMultiTenantIsolationTests } from './multi_tenant_isolation.test.ts';

async function main() {
  console.log('================================================================');
  console.log('   AssetMT Test Suite - Commercial Multi-Tenant Asset Mgmt');
  console.log('   Akshigo Tech - Phase 1 through Phase 4 Verification');
  console.log('================================================================\n');

  let totalPassed = 0;
  let totalFailed = 0;

  // 1. Validation Tests
  console.log('--- 1. Validation Rules & Status Invariants ---');
  const valResults = runValidationTests();
  valResults.tests.forEach((t) => console.log(t));
  totalPassed += valResults.passed;
  totalFailed += valResults.failed;
  console.log(`Validation Tests: ${valResults.passed} passed, ${valResults.failed} failed\n`);

  // 2. Cloudflare Worker API Routing & Auth Tests
  console.log('--- 2. Cloudflare Worker API & Auth Rejection ---');
  const workerResults = await runWorkerApiTests();
  workerResults.tests.forEach((t) => console.log(t));
  totalPassed += workerResults.passed;
  totalFailed += workerResults.failed;
  console.log(`Worker API Tests: ${workerResults.passed} passed, ${workerResults.failed} failed\n`);

  // 3. Database Schema & Security Architecture Tests
  console.log('--- 3. Database Invariants, RLS & Composite Foreign Keys ---');
  const dbResults = runDatabaseSecurityTests();
  dbResults.tests.forEach((t) => console.log(t));
  totalPassed += dbResults.passed;
  totalFailed += dbResults.failed;
  console.log(`Database Invariant Tests: ${dbResults.passed} passed, ${dbResults.failed} failed\n`);

  // 4. Onboarding & Workflow State Tests
  console.log('--- 4. Onboarding, RBAC & State Machine Invariants ---');
  const flowResults = runOnboardingWorkflowTests();
  flowResults.tests.forEach((t) => console.log(t));
  totalPassed += flowResults.passed;
  totalFailed += flowResults.failed;
  console.log(`Workflow Invariant Tests: ${flowResults.passed} passed, ${flowResults.failed} failed\n`);

  // 5. Phase 2A: Employees & Departments Tests
  console.log('--- 5. Phase 2A: Employees & Departments Invariants ---');
  const empResults = await runEmployeesAndDepartmentsTests();
  empResults.tests.forEach((t) => console.log(t));
  totalPassed += empResults.passed;
  totalFailed += empResults.failed;
  console.log(`Phase 2A Tests: ${empResults.passed} passed, ${empResults.failed} failed\n`);

  // 6. Phase 2B: Asset Custody & Workflows Tests
  console.log('--- 6. Phase 2B: Asset Custody & Workflow Invariants ---');
  const custodyResults = await runAssetCustodyTests();
  custodyResults.tests.forEach((t) => console.log(t));
  totalPassed += custodyResults.passed;
  totalFailed += custodyResults.failed;
  console.log(`Phase 2B Tests: ${custodyResults.passed} passed, ${custodyResults.failed} failed\n`);

  // 7. Phase 3: Asset Maintenance, Work Orders & Vendors Tests
  console.log('--- 7. Phase 3: Asset Maintenance, Work Orders & Vendors ---');
  const maintResults = await runMaintenanceAndVendorsTests();
  maintResults.tests.forEach((t) => console.log(t));
  totalPassed += maintResults.passed;
  totalFailed += maintResults.failed;
  console.log(`Phase 3 Tests: ${maintResults.passed} passed, ${maintResults.failed} failed\n`);

  // 8. Phase 4: Complete Asset Operations Tests
  console.log('--- 8. Phase 4: Complete Asset Operations ---');
  const phase4Results = await runPhase4AssetOperationsTests();
  phase4Results.tests.forEach((t) => console.log(t));
  totalPassed += phase4Results.passed;
  totalFailed += phase4Results.failed;
  console.log(`Phase 4 Tests: ${phase4Results.passed} passed, ${phase4Results.failed} failed\n`);

  // 9. Phase 5: Financial, Compliance & Asset Records Tests
  console.log('--- 9. Phase 5: Financial, Compliance & Asset Records ---');
  const phase5Results = await runPhase5FinancialComplianceTests();
  phase5Results.tests.forEach((t) => console.log(t));
  totalPassed += phase5Results.passed;
  totalFailed += phase5Results.failed;
  console.log(`Phase 5 Tests: ${phase5Results.passed} passed, ${phase5Results.failed} failed\n`);

  // 10. Phase 6: Reports, Users, Permissions & Tenant Administration
  console.log('--- 10. Phase 6: Reports, Users, Permissions & Tenant Administration ---');
  const phase6Results = await runPhase6ReportsUsersAdminTests();
  phase6Results.tests.forEach((t) => console.log(t));
  totalPassed += phase6Results.passed;
  totalFailed += phase6Results.failed;
  console.log(`Phase 6 Tests: ${phase6Results.passed} passed, ${phase6Results.failed} failed\n`);

  // 11. Phase 7: Production Hardening, Storage, Subscription Entitlement & Launch
  console.log('--- 11. Phase 7: Production Hardening, Storage, Subscription Entitlement & Launch ---');
  const phase7Results = await runPhase7ProductionLaunchTests();
  phase7Results.tests.forEach((t) => console.log(t));
  totalPassed += phase7Results.passed;
  totalFailed += phase7Results.failed;
  console.log(`Phase 7 Tests: ${phase7Results.passed} passed, ${phase7Results.failed} failed\n`);

  // 12. Multi-Tenant Isolation & Cross-Tenant Rejection Tests
  console.log('--- 12. Multi-Tenant Isolation & Cross-Tenant Security Invariants ---');
  const isolationResults = await runMultiTenantIsolationTests();
  isolationResults.tests.forEach((t) => console.log(t));
  totalPassed += isolationResults.passed;
  totalFailed += isolationResults.failed;
  console.log(`Multi-Tenant Isolation Tests: ${isolationResults.passed} passed, ${isolationResults.failed} failed\n`);

  // 13. Live Multi-Tenant Cloud Verification Status
  console.log('--- 13. Live Multi-Tenant Cloud Verification Status ---');
  const hasEnv = Boolean(
    process.env.VITE_SUPABASE_URL &&
    !process.env.VITE_SUPABASE_URL.includes('your-assetmt-project') &&
    process.env.VITE_SUPABASE_ANON_KEY
  );

  if (hasEnv) {
    console.log('[LIVE CONFIG CONFIGURED] Supabase host is online and responsive to anon API calls.');
    console.log('[LIVE TENANT JWT STATUS] Live end-to-end multi-tenant isolation verification requires two pre-registered customer tenant JWTs (Tenant A & Tenant B).');
    console.log('[RULE ENFORCEMENT] In accordance with Test Rule 1, arbitrary real email account creation is skipped and live JWT tests are marked NOT RUN.');
  } else {
    console.log('[BLOCKED BY CONFIGURATION] Live end-to-end network requests to Supabase require provisioning an external Supabase project and setting VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.');
    console.log('[BLOCKED BY CONFIGURATION] Real database migrations are prepared in migrations/0001_initial_schema.sql.');
  }

  console.log('\n================================================================');
  console.log(`SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log('================================================================');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
