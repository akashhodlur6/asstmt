/**
 * AssetMT - Phase 7 Test Suite: Production Hardening, Storage, Subscription Entitlement & Launch
 * Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
 */

import {
  sanitizeFilename,
  validateStorageUpload,
  validateAkshigoHandoffPayload,
  generateAkshigoHandoffSignature,
  verifyAkshigoHandoffSignature,
  sanitizeCsvCell,
  buildSafeCsv,
  validateImportRow,
  consumeDurableNonce,
} from '../shared/validation.ts';
import {
  isTenantAdminCreationAllowed,
  isTechnicianCreationAllowed,
  canMutateTenantBusinessData,
  BASIC_PLAN_QUOTAS,
} from '../shared/permissions.ts';

export async function runPhase7ProductionLaunchTests(): Promise<{ passed: number; failed: number; tests: string[] }> {
  const tests: string[] = [];
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      tests.push(`  ✓ ${testName}`);
      passed++;
    } else {
      tests.push(`  ✗ FAIL: ${testName}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // 1. Filename Sanitization & Directory Traversal Protection
  // --------------------------------------------------------------------------
  assert(
    sanitizeFilename('../../etc/passwd') === 'passwd',
    'Strip path traversal (Unix ../../)'
  );
  assert(
    sanitizeFilename('..\\..\\windows\\system32\\cmd.exe') === 'cmd.exe',
    'Strip Windows path traversal (..\\..\\)'
  );
  assert(
    sanitizeFilename('malicious<script>alert(1).pdf') === 'malicious_script_alert_1_.pdf',
    'Replace HTML/XSS injection characters with safe underscores'
  );
  assert(
    sanitizeFilename('.hidden_bashrc') === 'hidden_bashrc',
    'Strip leading dots preventing hidden file creation'
  );
  assert(
    sanitizeFilename('a'.repeat(150) + '.pdf').length <= 100,
    'Enforce maximum filename length constraint (<= 100 chars)'
  );

  // --------------------------------------------------------------------------
  // 2. Binary Storage Upload & MIME Type Validation
  // --------------------------------------------------------------------------
  const validDoc = validateStorageUpload({
    filename: 'equipment_manual.pdf',
    size: 5 * 1024 * 1024,
    mimeType: 'application/pdf',
  }, 'DOCUMENT');
  assert(validDoc.isValid, 'Allow valid 5MB PDF document upload');

  const oversizeDoc = validateStorageUpload({
    filename: 'giant_archive.zip',
    size: 30 * 1024 * 1024,
    mimeType: 'application/pdf',
  }, 'DOCUMENT');
  assert(!oversizeDoc.isValid && Boolean(oversizeDoc.errors.size), 'Reject document upload exceeding 25MB limit');

  const invalidMime = validateStorageUpload({
    filename: 'malware.exe',
    size: 1024,
    mimeType: 'application/x-msdownload',
  }, 'DOCUMENT');
  assert(!invalidMime.isValid && Boolean(invalidMime.errors.mimeType), 'Reject unapproved executable MIME types');

  const validLogo = validateStorageUpload({
    filename: 'company_logo.png',
    size: 500 * 1024,
    mimeType: 'image/png',
  }, 'LOGO');
  assert(validLogo.isValid, 'Allow valid 500KB PNG logo');

  const oversizeLogo = validateStorageUpload({
    filename: 'huge_logo.png',
    size: 3 * 1024 * 1024,
    mimeType: 'image/png',
  }, 'LOGO');
  assert(!oversizeLogo.isValid && Boolean(oversizeLogo.errors.size), 'Reject logo exceeding 2MB limit');

  // --------------------------------------------------------------------------
  // 3. CSV Formula Injection (DDE) Defense
  // --------------------------------------------------------------------------
  assert(
    sanitizeCsvCell('=SUM(1+1)') === "'=SUM(1+1)",
    'Prefix leading equals sign with single quote to prevent DDE execution'
  );
  assert(
    sanitizeCsvCell('@IMPORTXML').startsWith("'@IMPORTXML"),
    'Prefix leading @ symbol formula'
  );
  assert(
    sanitizeCsvCell('+cmd|"/C calc"!A0').includes("'+cmd"),
    'Prefix leading plus sign formula execution'
  );
  assert(
    sanitizeCsvCell('-2+3') === "'-2+3",
    'Prefix leading minus sign formula'
  );
  assert(
    sanitizeCsvCell('Normal Text Asset') === 'Normal Text Asset',
    'Leave regular text untouched in CSV cell'
  );

  const safeCsvOutput = buildSafeCsv(
    ['Asset Name', 'Formula Exploit'],
    [{ name: 'Server 01', exploit: '=cmd|"/C calc"!A0' }],
    ['name', 'exploit']
  );
  assert(
    safeCsvOutput.includes("'=cmd"),
    'Safe CSV builder sanitizes all cell contents against command injection'
  );

  // --------------------------------------------------------------------------
  // 4. Subscription Lifecycle & Status Mutation Gates
  // --------------------------------------------------------------------------
  assert(canMutateTenantBusinessData('ACTIVE'), 'ACTIVE tenant can mutate business data');
  assert(canMutateTenantBusinessData('TRIAL'), 'TRIAL tenant can mutate business data');
  assert(!canMutateTenantBusinessData('PAST_DUE'), 'PAST_DUE tenant blocked from business mutation');
  assert(!canMutateTenantBusinessData('SUSPENDED'), 'SUSPENDED tenant is strictly blocked from data mutations');
  assert(!canMutateTenantBusinessData('CANCELLED'), 'CANCELLED tenant is strictly blocked from data mutations');

  // --------------------------------------------------------------------------
  // 5. Subscription Plan Quotas & Role Creation Entitlements
  // --------------------------------------------------------------------------
  assert(isTenantAdminCreationAllowed(1, 'BASIC') === false, 'BASIC plan limits to 1 Tenant Admin');
  assert(isTenantAdminCreationAllowed(0, 'BASIC') === true, 'BASIC plan allows initial 1 Tenant Admin');
  assert(isTenantAdminCreationAllowed(4, 'PRO') === true, 'PRO plan allows up to 5 Tenant Admins');
  assert(isTenantAdminCreationAllowed(5, 'PRO') === false, 'PRO plan rejects 6th Tenant Admin');
  assert(isTenantAdminCreationAllowed(40, 'ENTERPRISE') === true, 'ENTERPRISE plan allows up to 50 Tenant Admins');

  assert(isTechnicianCreationAllowed(0, 'BASIC') === true, 'BASIC plan allows 1 Technician');
  assert(isTechnicianCreationAllowed(1, 'BASIC') === false, 'BASIC plan rejects 2nd Technician');
  assert(isTechnicianCreationAllowed(9, 'PRO') === true, 'PRO plan allows up to 10 Technicians');
  assert(isTechnicianCreationAllowed(10, 'PRO') === false, 'PRO plan rejects 11th Technician');
  assert(isTechnicianCreationAllowed(150, 'ENTERPRISE') === true, 'ENTERPRISE plan allows up to 200 Technicians');

  // --------------------------------------------------------------------------
  // 6. Akshigo Website Integration & Handoff Validation
  // --------------------------------------------------------------------------
  const secretKey = 'akshigo_prod_integration_secret_test';
  const now = Date.now();
  const validSig = await generateAkshigoHandoffSignature(secretKey, {
    timestamp: now,
    tenant_name: 'Acme Global Corp',
    admin_email: 'admin@acmecorp.com',
    plan: 'PRO',
    subscription_id: 'sub_akshigo_98472910',
  });

  const validHandoff = validateAkshigoHandoffPayload({
    tenant_name: 'Acme Global Corp',
    admin_email: 'admin@acmecorp.com',
    plan: 'PRO',
    subscription_id: 'sub_akshigo_98472910',
    timestamp: now,
    signature: validSig,
  });
  assert(validHandoff.isValid, 'Accept valid signed Akshigo subscription handoff payload');

  const isVerified = await verifyAkshigoHandoffSignature(secretKey, {
    timestamp: now,
    tenant_name: 'Acme Global Corp',
    admin_email: 'admin@acmecorp.com',
    plan: 'PRO',
    subscription_id: 'sub_akshigo_98472910',
    signature: validSig,
  });
  assert(isVerified, 'Verify valid HMAC SHA-256 signature on canonical handoff payload');

  const isTampered = await verifyAkshigoHandoffSignature(secretKey, {
    timestamp: now,
    tenant_name: 'Acme Global Corp',
    admin_email: 'hacker@malicious.com', // tampered
    plan: 'ENTERPRISE', // forged
    subscription_id: 'sub_akshigo_98472910',
    signature: validSig,
  });
  assert(!isTampered, 'Reject tampered handoff payload with mismatched HMAC signature');

  const isWrongSecret = await verifyAkshigoHandoffSignature('wrong_secret_key', {
    timestamp: now,
    tenant_name: 'Acme Global Corp',
    admin_email: 'admin@acmecorp.com',
    plan: 'PRO',
    subscription_id: 'sub_akshigo_98472910',
    signature: validSig,
  });
  assert(!isWrongSecret, 'Reject signature verified with incorrect secret key');

  const expiredHandoff = validateAkshigoHandoffPayload({
    tenant_name: 'Acme Global Corp',
    admin_email: 'admin@acmecorp.com',
    plan: 'PRO',
    subscription_id: 'sub_akshigo_98472910',
    timestamp: Date.now() - 600 * 1000, // 10 minutes ago
    signature: validSig,
  });
  assert(
    !expiredHandoff.isValid && Boolean(expiredHandoff.errors.timestamp),
    'Reject expired Akshigo handoff payload (> 5 minutes window)'
  );

  const missingSigHandoff = validateAkshigoHandoffPayload({
    tenant_name: 'Acme Global Corp',
    admin_email: 'admin@acmecorp.com',
    plan: 'PRO',
    subscription_id: 'sub_akshigo_98472910',
    timestamp: now,
  });
  assert(
    !missingSigHandoff.isValid && Boolean(missingSigHandoff.errors.signature),
    'Reject handoff payload missing cryptographic signature'
  );

  const invalidPlanHandoff = validateAkshigoHandoffPayload({
    tenant_name: 'Acme Global Corp',
    admin_email: 'admin@acmecorp.com',
    plan: 'SUPER_TIER_INVALID',
    subscription_id: 'sub_akshigo_98472910',
    timestamp: now,
    signature: validSig,
  });
  assert(
    !invalidPlanHandoff.isValid && Boolean(invalidPlanHandoff.errors.plan),
    'Reject unrecognized subscription plan tier in handoff'
  );

  // --------------------------------------------------------------------------
  // 6. Durable Replay Attack Protection (PostgreSQL-backed across Workers)
  // --------------------------------------------------------------------------
  const sharedPgDatabase = new Map<string, { nonce_hash: string; consumed_at: string; expires_at: string }>();
  const createWorkerClient = () => ({
    from: (table: string) => ({
      insert: async (row: { nonce_hash: string; consumed_at: string; expires_at: string }) => {
        if (table === 'consumed_handoff_nonces') {
          if (sharedPgDatabase.has(row.nonce_hash)) {
            return {
              error: {
                code: '23505',
                message: 'duplicate key value violates unique constraint "consumed_handoff_nonces_pkey"',
              },
            };
          }
          sharedPgDatabase.set(row.nonce_hash, row);
          return { error: null };
        }
        return { error: null };
      },
    }),
  });

  // Test 1: First signed handoff succeeds
  const workerInstance1 = createWorkerClient();
  const firstConsume = await consumeDurableNonce(workerInstance1, validSig, now);
  assert(!firstConsume.isReplay, 'first signed handoff succeeds');

  // Test 2: Identical replay fails
  const identicalReplay = await consumeDurableNonce(workerInstance1, validSig, now);
  assert(identicalReplay.isReplay, 'identical replay fails');

  // Test 3: Replay from fresh Worker/runtime state still fails
  const freshWorkerInstance = createWorkerClient(); // Brand new runtime instance without in-memory state
  const crossWorkerReplay = await consumeDurableNonce(freshWorkerInstance, validSig, now);
  assert(crossWorkerReplay.isReplay, 'replay from fresh Worker/runtime state still fails');

  // Test 4: Bad signature fails
  const badSig = '0000000000000000000000000000000000000000000000000000000000000000';
  const badSigVerified = await verifyAkshigoHandoffSignature(secretKey, {
    timestamp: now,
    tenant_name: 'Acme Global Corp',
    admin_email: 'admin@acmecorp.com',
    plan: 'PRO',
    subscription_id: 'sub_akshigo_98472910',
    signature: badSig,
  });
  assert(!badSigVerified, 'bad signature fails');

  // Test 5: Expired request fails
  const expiredPayload = validateAkshigoHandoffPayload({
    tenant_name: 'Acme Global Corp',
    admin_email: 'admin@acmecorp.com',
    plan: 'PRO',
    subscription_id: 'sub_akshigo_98472910',
    timestamp: Date.now() - 350 * 1000, // > 5 minutes ago
    signature: validSig,
  });
  assert(
    !expiredPayload.isValid && Boolean(expiredPayload.errors.timestamp),
    'expired request fails'
  );

  return { passed, failed, tests };
}
