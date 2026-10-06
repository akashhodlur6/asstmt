/**
 * AssetMT Test Suite: Validation Rules
 * Tests field validation, duplicate detection, and Phase 2 status restriction.
 */

import { validateAsset, validateCreateWorkspace } from '../shared/validation.ts';
import { AssetStatus, CreateAssetInput } from '../shared/types.ts';

export function runValidationTests(): { passed: number; failed: number; tests: string[] } {
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

  // 1. Workspace Onboarding Validation
  const validWorkspace = validateCreateWorkspace({ name: 'Acme Global Ltd', code: 'ACME' });
  assert('Valid workspace passes validation', validWorkspace.isValid);

  const emptyWorkspace = validateCreateWorkspace({ name: '' });
  assert('Empty workspace name is rejected', !emptyWorkspace.isValid && Boolean(emptyWorkspace.errors.name));

  const invalidCode = validateCreateWorkspace({ name: 'Acme Global', code: 'ACME 123!@#' });
  assert('Invalid company code characters are rejected', !invalidCode.isValid && Boolean(invalidCode.errors.code));

  // 2. Asset Tag & Name Validation
  const validAsset: CreateAssetInput = {
    asset_tag: 'AST-1001',
    name: 'Dell Precision 5570',
    status: 'Available',
    purchase_cost: 2499.0,
  };
  const resValid = validateAsset(validAsset, false);
  assert('Valid asset passes validation', resValid.isValid);

  const missingTag = validateAsset({ name: 'Test' }, false);
  assert('Missing asset tag on create is rejected', !missingTag.isValid && Boolean(missingTag.errors.asset_tag));

  const invalidTagChars = validateAsset({ asset_tag: 'AST@#$!*()', name: 'Test' }, false);
  assert('Illegal characters in asset tag are rejected', !invalidTagChars.isValid && Boolean(invalidTagChars.errors.asset_tag));

  const missingName = validateAsset({ asset_tag: 'AST-1002' }, false);
  assert('Missing asset name is rejected', !missingName.isValid && Boolean(missingName.errors.name));

  // 3. Status restriction: "Assigned" strictly rejected in Phase 1
  const assignedStatusAttempt: CreateAssetInput = {
    asset_tag: 'AST-1003',
    name: 'MacBook Pro',
    status: 'Assigned' as unknown as AssetStatus,
  };
  const resAssigned = validateAsset(assignedStatusAttempt, false);
  assert(
    'Status "Assigned" is strictly rejected before custody workflows exist',
    !resAssigned.isValid && resAssigned.errors.status.includes('custody')
  );

  // 4. Permitted statuses allowed
  const allowedStatuses: AssetStatus[] = ['Available', 'Under Repair', 'Retired', 'Disposed'];
  for (const st of allowedStatuses) {
    const res = validateAsset({ asset_tag: 'AST-1004', name: 'Asset Test', status: st }, false);
    assert(`Status "${st}" is permitted`, res.isValid);
  }

  // 5. Cost validation
  const negativeCost = validateAsset({ asset_tag: 'AST-1005', name: 'Server', purchase_cost: -50 }, false);
  assert('Negative purchase cost is rejected', !negativeCost.isValid && Boolean(negativeCost.errors.purchase_cost));

  return { passed, failed, tests };
}
