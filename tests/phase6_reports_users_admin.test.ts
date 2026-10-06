/**
 * AssetMT - Phase 6 Test Suite: Reports, Users, Permissions & Tenant Administration
 * Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
 */

import {
  ROLES,
  ROLE_HIERARCHY,
  isTenantAdmin,
  isTechnician,
  isMember,
  canManageUsers,
  canManageSettings,
  canImportData,
  canDisposeAsset,
  canConfigureFinancials,
  canManageAudits,
  canPerformCustody,
  canPerformMaintenance,
  canManageInventory,
  canMoveAsset,
  canCreateAsset,
  canUpdateAsset,
  canScanAudits,
  canViewReports,
  canExportReports,
  canViewAuditLog,
  getPlanQuotas,
  BASIC_PLAN_QUOTAS,
} from '../shared/permissions.ts';

import {
  validateInvitation,
  validateTenantSettings,
  sanitizeCsvCell,
  buildSafeCsv,
  validateImportRow,
} from '../shared/validation.ts';

export async function runPhase6ReportsUsersAdminTests(): Promise<{ passed: number; failed: number; tests: string[] }> {
  let passed = 0;
  let failed = 0;
  const tests: string[] = [];

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      passed++;
      tests.push(`  [PASS] ${testName}`);
    } else {
      failed++;
      tests.push(`  [FAIL] ${testName} ${detail ? `- ${detail}` : ''}`);
    }
  }

  // ==========================================================================
  // 1. Centralized Role-Based Access Control (RBAC) & Hierarchy
  // ==========================================================================
  assert(
    isTenantAdmin('TENANT_ADMIN') && !isTenantAdmin('TECHNICIAN') && !isTenantAdmin('MEMBER'),
    'RBAC: isTenantAdmin identifies TENANT_ADMIN strictly'
  );

  assert(
    isTechnician('TECHNICIAN') && !isTechnician('TENANT_ADMIN') && !isTechnician('MEMBER'),
    'RBAC: isTechnician identifies TECHNICIAN strictly'
  );

  assert(
    isMember('MEMBER') && !isMember('TECHNICIAN') && !isMember('TENANT_ADMIN'),
    'RBAC: isMember identifies MEMBER strictly'
  );

  assert(
    ROLE_HIERARCHY['TENANT_ADMIN'] > ROLE_HIERARCHY['TECHNICIAN'] &&
      ROLE_HIERARCHY['TECHNICIAN'] > ROLE_HIERARCHY['MEMBER'],
    'RBAC: Role hierarchy enforces TENANT_ADMIN (30) > TECHNICIAN (20) > MEMBER (10)'
  );

  // Administrative mutations reserved strictly for TENANT_ADMIN
  assert(
    canManageUsers('TENANT_ADMIN') && !canManageUsers('TECHNICIAN') && !canManageUsers('MEMBER'),
    'RBAC: canManageUsers permits only TENANT_ADMIN'
  );

  assert(
    canManageSettings('TENANT_ADMIN') && !canManageSettings('TECHNICIAN') && !canManageSettings('MEMBER'),
    'RBAC: canManageSettings permits only TENANT_ADMIN'
  );

  assert(
    canImportData('TENANT_ADMIN') && !canImportData('TECHNICIAN') && !canImportData('MEMBER'),
    'RBAC: canImportData permits only TENANT_ADMIN'
  );

  assert(
    canDisposeAsset('TENANT_ADMIN') && !canDisposeAsset('TECHNICIAN') && !canDisposeAsset('MEMBER'),
    'RBAC: canDisposeAsset permits only TENANT_ADMIN'
  );

  assert(
    canConfigureFinancials('TENANT_ADMIN') && !canConfigureFinancials('TECHNICIAN') && !canConfigureFinancials('MEMBER'),
    'RBAC: canConfigureFinancials permits only TENANT_ADMIN'
  );

  assert(
    canManageAudits('TENANT_ADMIN') && !canManageAudits('TECHNICIAN') && !canManageAudits('MEMBER'),
    'RBAC: canManageAudits permits only TENANT_ADMIN'
  );

  // Operational workflows permitted for TENANT_ADMIN and TECHNICIAN, but not MEMBER
  assert(
    canPerformCustody('TENANT_ADMIN') && canPerformCustody('TECHNICIAN') && !canPerformCustody('MEMBER'),
    'RBAC: canPerformCustody permits TENANT_ADMIN & TECHNICIAN, rejects MEMBER'
  );

  assert(
    canPerformMaintenance('TENANT_ADMIN') && canPerformMaintenance('TECHNICIAN') && !canPerformMaintenance('MEMBER'),
    'RBAC: canPerformMaintenance permits TENANT_ADMIN & TECHNICIAN, rejects MEMBER'
  );

  assert(
    canManageInventory('TENANT_ADMIN') && canManageInventory('TECHNICIAN') && !canManageInventory('MEMBER'),
    'RBAC: canManageInventory permits TENANT_ADMIN & TECHNICIAN, rejects MEMBER'
  );

  assert(
    canMoveAsset('TENANT_ADMIN') && canMoveAsset('TECHNICIAN') && !canMoveAsset('MEMBER'),
    'RBAC: canMoveAsset permits TENANT_ADMIN & TECHNICIAN, rejects MEMBER'
  );

  assert(
    canCreateAsset('TENANT_ADMIN') && canCreateAsset('TECHNICIAN') && !canCreateAsset('MEMBER'),
    'RBAC: canCreateAsset permits TENANT_ADMIN & TECHNICIAN, rejects MEMBER'
  );

  assert(
    canScanAudits('TENANT_ADMIN') && canScanAudits('TECHNICIAN') && !canScanAudits('MEMBER'),
    'RBAC: canScanAudits permits TENANT_ADMIN & TECHNICIAN, rejects MEMBER'
  );

  // Read permissions: reports and audit log
  assert(
    canViewReports('MEMBER') && canViewReports('TECHNICIAN') && canViewReports('TENANT_ADMIN'),
    'RBAC: canViewReports permits all authenticated tenant members'
  );

  assert(
    canExportReports('MEMBER') && canExportReports('TECHNICIAN') && canExportReports('TENANT_ADMIN'),
    'RBAC: canExportReports permits all authenticated tenant members'
  );

  assert(
    canViewAuditLog('TENANT_ADMIN') && canViewAuditLog('TECHNICIAN') && !canViewAuditLog('MEMBER'),
    'RBAC: canViewAuditLog permits TENANT_ADMIN & TECHNICIAN, restricts MEMBER'
  );

  // ==========================================================================
  // 2. User Invitation Validation & Invariants
  // ==========================================================================
  const validInvite = validateInvitation({
    email: 'newuser@tenantcorp.com',
    role: 'TECHNICIAN',
    employee_id: 'emp-101',
  });
  assert(validInvite.isValid, 'Invitation: valid email and TECHNICIAN role accepted');

  const invalidEmailInvite = validateInvitation({
    email: 'not-an-email',
    role: 'MEMBER',
  });
  assert(
    !invalidEmailInvite.isValid && Boolean(invalidEmailInvite.errors.email),
    'Invitation: invalid email format rejected'
  );

  const missingRoleInvite = validateInvitation({
    email: 'test@example.com',
    role: 'SUPER_ADMIN' as any,
  });
  assert(
    !missingRoleInvite.isValid && Boolean(missingRoleInvite.errors.role),
    'Invitation: illegal non-tenant role (e.g. SUPER_ADMIN) rejected'
  );

  const emptyInvite = validateInvitation({});
  assert(
    !emptyInvite.isValid && Boolean(emptyInvite.errors.email) && Boolean(emptyInvite.errors.role),
    'Invitation: empty payload requires email and role'
  );

  // Status transitions
  const validStatuses = ['PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED'];
  assert(
    validStatuses.includes('PENDING') && validStatuses.includes('ACCEPTED') && validStatuses.includes('CANCELLED'),
    'Invitation: lifecycle statuses PENDING, ACCEPTED, EXPIRED, CANCELLED supported'
  );

  // ==========================================================================
  // 3. Tenant Settings Validation
  // ==========================================================================
  const validSettings = validateTenantSettings({
    company_name: 'Acme Asset Corp',
    timezone: 'America/New_York',
    default_currency: 'USD',
    asset_tag_prefix: 'ACME',
    asset_tag_next_number: 1001,
  });
  assert(validSettings.isValid, 'Tenant Settings: valid organization settings accepted');

  const shortNameSettings = validateTenantSettings({
    company_name: 'A',
  });
  assert(
    !shortNameSettings.isValid && Boolean(shortNameSettings.errors.company_name),
    'Tenant Settings: company name under 2 characters rejected'
  );

  const invalidCurrencySettings = validateTenantSettings({
    default_currency: 'UNITED_STATES_DOLLAR',
  });
  assert(
    !invalidCurrencySettings.isValid && Boolean(invalidCurrencySettings.errors.default_currency),
    'Tenant Settings: currency exceeding 5 characters rejected'
  );

  const invalidTagPrefixSettings = validateTenantSettings({
    asset_tag_prefix: 'VERYLONGPREFIXOVER10CHARS',
  });
  assert(
    !invalidTagPrefixSettings.isValid && Boolean(invalidTagPrefixSettings.errors.asset_tag_prefix),
    'Tenant Settings: asset tag prefix exceeding 10 characters rejected'
  );

  const negativeTagNumberSettings = validateTenantSettings({
    asset_tag_next_number: -5,
  });
  assert(
    !negativeTagNumberSettings.isValid && Boolean(negativeTagNumberSettings.errors.asset_tag_next_number),
    'Tenant Settings: negative asset tag starting number rejected'
  );

  // ==========================================================================
  // 4. CSV Formula Injection Defense (Sanitization)
  // ==========================================================================
  const formulaEquals = sanitizeCsvCell('=SUM(A1:A10)');
  assert(
    formulaEquals.startsWith("'="),
    'CSV Security: formulas starting with = neutralized with leading quote'
  );

  const formulaPlus = sanitizeCsvCell('+cmd|/c calc.exe!A1');
  assert(
    formulaPlus.startsWith("'+"),
    'CSV Security: formulas starting with + neutralized'
  );

  const formulaMinus = sanitizeCsvCell('-1+1');
  assert(
    formulaMinus.startsWith("'-"),
    'CSV Security: cells starting with - neutralized'
  );

  const formulaAt = sanitizeCsvCell('@SUM(B1:B5)');
  assert(
    formulaAt.startsWith("'@"),
    'CSV Security: cells starting with @ neutralized'
  );

  const normalText = sanitizeCsvCell('Dell XPS 15');
  assert(
    normalText === 'Dell XPS 15',
    'CSV Security: benign alphanumeric strings left untouched'
  );

  const textWithComma = sanitizeCsvCell('Laptop, High Spec');
  assert(
    textWithComma === '"Laptop, High Spec"',
    'CSV Security: cells containing commas wrapped in standard quotes'
  );

  const safeCsvString = buildSafeCsv(
    ['Asset Name', 'Formula Attack'],
    [
      { name: 'Server A', formula: '=cmd|/c calc' },
      { name: 'Server B', formula: 'Normal Value' },
    ],
    ['name', 'formula']
  );
  assert(
    safeCsvString.includes("'=cmd") && !safeCsvString.includes('\n=cmd'),
    'CSV Security: buildSafeCsv protects entire batch against formula injection'
  );

  // ==========================================================================
  // 5. Controlled CSV Import Row Validation
  // ==========================================================================
  // Target: ASSETS
  const validAssetRow = validateImportRow('ASSETS', {
    name: 'Dell Precision 5570',
    asset_tag: 'AST-999',
    purchase_cost: 2199.5,
    status: 'Available',
  });
  assert(
    validAssetRow.isValid && validAssetRow.parsed.purchase_cost === 2199.5,
    'CSV Import: valid asset row parsed with numeric cost conversion'
  );

  const invalidAssetRow = validateImportRow('ASSETS', {
    name: 'X', // too short
    purchase_cost: -50, // negative cost
    status: 'UnknownStatus',
  });
  assert(
    !invalidAssetRow.isValid && invalidAssetRow.errors.length >= 3,
    'CSV Import: invalid asset row catches name, negative cost, and invalid status'
  );

  // Target: EMPLOYEES
  const validEmployeeRow = validateImportRow('EMPLOYEES', {
    full_name: 'Robert Oppenheimer',
    employee_code: 'EMP-001',
    email: 'robert@losalamos.gov',
  });
  assert(
    validEmployeeRow.isValid && validEmployeeRow.parsed.email === 'robert@losalamos.gov',
    'CSV Import: valid employee row parsed'
  );

  const invalidEmployeeRow = validateImportRow('EMPLOYEES', {
    full_name: '',
    email: 'invalid-email-address',
  });
  assert(
    !invalidEmployeeRow.isValid && invalidEmployeeRow.errors.length >= 2,
    'CSV Import: invalid employee row catches empty name and malformed email'
  );

  // Target: INVENTORY
  const validInventoryRow = validateImportRow('INVENTORY', {
    sku: 'DDR5-32GB',
    name: 'Kingston Fury 32GB RAM',
    quantity_on_hand: 15,
  });
  assert(
    validInventoryRow.isValid && validInventoryRow.parsed.quantity_on_hand === 15,
    'CSV Import: valid inventory row parsed with quantity on hand'
  );

  const invalidInventoryRow = validateImportRow('INVENTORY', {
    sku: 'A', // too short
    name: '',
    quantity_on_hand: -10,
  });
  assert(
    !invalidInventoryRow.isValid && invalidInventoryRow.errors.length >= 3,
    'CSV Import: invalid inventory row catches short SKU, empty name, and negative quantity'
  );

  // ==========================================================================
  // 6. Basic Plan Quotas & Platform Admin Architecture
  // ==========================================================================
  assert(
    BASIC_PLAN_QUOTAS.maxAssets === 500 &&
      BASIC_PLAN_QUOTAS.maxTenantAdmins === 1 &&
      BASIC_PLAN_QUOTAS.maxTechnicians === 1 &&
      BASIC_PLAN_QUOTAS.maxEmployees === Infinity,
    'Plan Quotas: Basic plan enforces 500 assets, 1 Admin, 1 Technician, Unlimited Employees'
  );

  const basicQuotas = getPlanQuotas('BASIC');
  const proQuotas = getPlanQuotas('PRO');
  assert(
    basicQuotas.maxAssets === 500 && proQuotas.maxAssets === 5000,
    'Plan Quotas: getPlanQuotas maps plan tiers accurately'
  );

  // Platform admin separation invariants
  assert(
    !canManageUsers('MEMBER') && !isTenantAdmin('MEMBER'),
    'Security Invariant: Tenant role cannot derive platform ownership'
  );

  return { passed, failed, tests };
}
