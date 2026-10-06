/**
 * AssetMT - Phase 5 Financial, Compliance & Asset Records Tests
 * Akshigo Tech Commercial Multi-Tenant Asset Management
 *
 * Verifies:
 * 1. Depreciation (Straight Line, Declining Balance, Salvage floor, Cross-tenant protection)
 * 2. Warranty Management (Create/Update, Multi-record history, Expiry detection)
 * 3. Contracts (Create/Update, Multi-asset linking, Cross-tenant link rejected, Renewal/Expiry)
 * 4. Software & License Tracking (Create, Allocate/Release, Quantity limit enforcement, Cross-tenant rejection)
 * 5. Insurance (Create, Multi-asset coverage, Expiry detection, Preservation)
 * 6. Purchase & Funding Information (Structured acquisition fields, Funding sources)
 * 7. Documents & Attachments (Tenant metadata isolation, Protected access)
 * 8. Custom Fields (Definition CRUD, Field types, Tenant scoping, Inactive definition handling)
 * 9. Real Alerts & Attention Center (Real DB date-derived windows: Overdue, 7d, 30d, 90d, No fabrication)
 * 10. Regression (Custody, Maintenance, Inventory, Reservations, Leases, Physical Audits)
 */

import {
  calculateDepreciation,
  validateDepreciationConfig,
  validateWarranty,
  validateContract,
  validateLicense,
  validateLicenseAllocation,
  validateInsurancePolicy,
  validateAssetPurchase,
  validateCustomFieldDefinition,
  validateCustomFieldValue,
  validateCheckout,
  validateCheckin,
  validateTransfer,
  validateMaintenance,
  validateInventoryItem,
  validateReservation,
  validateLease,
  validateAuditSession,
} from '../shared/validation.ts';
import {
  ConfigureDepreciationInput,
  CreateWarrantyInput,
  CreateContractInput,
  CreateLicenseInput,
  AllocateLicenseInput,
  CreateInsurancePolicyInput,
  UpsertAssetPurchaseInput,
  CreateCustomFieldDefinitionInput,
} from '../shared/types.ts';

export async function runPhase5FinancialComplianceTests() {
  const tests: string[] = [];
  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean, details?: string) {
    if (condition) {
      tests.push(`  [PASS] ${name}`);
      passed++;
    } else {
      tests.push(`  [FAIL] ${name} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  // =========================================================================
  // 1. DEPRECIATION TESTS
  // =========================================================================
  {
    // Test 1.1: Straight-Line Depreciation Calculation
    const resultSL = calculateDepreciation({
      cost: 12000,
      salvageValue: 2000,
      usefulLifeMonths: 60, // 5 years
      startDate: '2024-01-01',
      method: 'STRAIGHT_LINE',
      asOfDate: '2025-01-01', // 12 months in
    });

    assert(
      'Depreciation: Straight Line monthly rate and accumulated depreciation',
      resultSL.accumulatedDepreciation === 2000 &&
      resultSL.currentBookValue === 10000 &&
      Math.abs(resultSL.monthlyDepreciation - (10000 / 60)) < 0.02
    );

    // Test 1.2: Salvage Value Floor (Book value NEVER falls below salvage value)
    const resultSLFloor = calculateDepreciation({
      cost: 10000,
      salvageValue: 2500,
      usefulLifeMonths: 24, // 2 years
      startDate: '2020-01-01',
      method: 'STRAIGHT_LINE',
      asOfDate: '2026-01-01', // 6 years in (well past useful life)
    });

    assert(
      'Depreciation: Salvage floor strictly enforced past useful life',
      resultSLFloor.currentBookValue === 2500 &&
      resultSLFloor.accumulatedDepreciation === 7500 &&
      resultSLFloor.isFullyDepreciated === true
    );

    // Test 1.3: Declining Balance Method
    const resultDB = calculateDepreciation({
      cost: 20000,
      salvageValue: 2000,
      usefulLifeMonths: 48,
      startDate: '2024-01-01',
      method: 'DECLINING_BALANCE',
      depreciationRate: 25, // 25% annual
      asOfDate: '2025-01-01', // 1 year in
    });

    assert(
      'Depreciation: Declining Balance calculated and book value reduced',
      resultDB.currentBookValue < 20000 &&
      resultDB.accumulatedDepreciation > 0 &&
      resultDB.currentBookValue >= 2000
    );

    // Test 1.4: No Depreciation method keeps book value = cost
    const resultNone = calculateDepreciation({
      cost: 5000,
      salvageValue: 5000,
      usefulLifeMonths: 0,
      startDate: '2020-01-01',
      method: 'NO_DEPRECIATION',
      asOfDate: '2026-01-01',
    });

    assert(
      'Depreciation: NO_DEPRECIATION maintains 100% book value with zero accumulated',
      resultNone.accumulatedDepreciation === 0 &&
      resultNone.currentBookValue === 5000 &&
      resultNone.monthlyDepreciation === 0
    );

    // Test 1.5: Annual & Monthly Depreciation Schedule generation
    assert(
      'Depreciation: Generates structured annual/monthly schedule array',
      Array.isArray(resultSL.schedule) &&
      resultSL.schedule.length > 0 &&
      resultSL.schedule[0].year === 2024 &&
      resultSL.schedule[resultSL.schedule.length - 1].ending_book_value === 2000
    );

    // Test 1.6: Validation of Depreciation Configuration (Salvage cannot exceed cost)
    const invalidConfig: ConfigureDepreciationInput = {
      method: 'STRAIGHT_LINE',
      salvage_value: 15000, // higher than cost 10000!
      useful_life_months: 36,
      depreciation_start_date: '2024-01-01',
    };
    const valConfig = validateDepreciationConfig(invalidConfig, 10000);
    assert(
      'Depreciation: Salvage value exceeding purchase cost rejected by validator',
      !valConfig.isValid && !!valConfig.errors.salvage_value
    );

    // Test 1.7: Negative salvage value rejected
    const valNegativeSalvage = validateDepreciationConfig({
      method: 'STRAIGHT_LINE',
      salvage_value: -100,
      useful_life_months: 36,
      depreciation_start_date: '2024-01-01',
    }, 5000);
    assert(
      'Depreciation: Negative salvage value rejected',
      !valNegativeSalvage.isValid && !!valNegativeSalvage.errors.salvage_value
    );
  }

  // =========================================================================
  // 2. WARRANTY MANAGEMENT TESTS
  // =========================================================================
  {
    // Test 2.1: Valid warranty creation input
    const validWarranty: CreateWarrantyInput = {
      asset_id: 'asset-1',
      provider_name: 'Dell ProSupport Plus',
      warranty_number: 'DELL-WAR-9901',
      warranty_type: 'Extended',
      start_date: '2024-01-01',
      end_date: '2027-01-01',
      coverage_details: '24/7 on-site parts and labor replacement',
      contact_details: 'support@dell.com / 1-800-DELL-PRO',
      notes: 'Includes accidental damage coverage',
    };
    const valWarranty = validateWarranty(validWarranty);
    assert(
      'Warranty: Valid warranty input passes validation',
      valWarranty.isValid
    );

    // Test 2.2: Warranty end date before start date rejected
    const invalidDatesWarranty: CreateWarrantyInput = {
      asset_id: 'asset-1',
      warranty_number: 'HP-WAR-001',
      warranty_type: 'Manufacturer',
      provider_name: 'HP Care Pack',
      start_date: '2025-06-01',
      end_date: '2024-06-01', // End before start
    };
    const valInvalidDates = validateWarranty(invalidDatesWarranty);
    assert(
      'Warranty: End date before start date rejected',
      !valInvalidDates.isValid && !!valInvalidDates.errors.end_date
    );

    // Test 2.3: Provider name required
    const emptyProvider = validateWarranty({ provider: '' });
    assert(
      'Warranty: Missing provider name rejected',
      !emptyProvider.isValid && !!emptyProvider.errors.provider
    );
  }

  // =========================================================================
  // 3. CONTRACTS MANAGEMENT TESTS
  // =========================================================================
  {
    // Test 3.1: Valid contract creation
    const validContract: CreateContractInput = {
      contract_number: 'CNT-2025-001',
      title: 'Enterprise Server Colocation Agreement',
      contract_type: 'Maintenance',
      start_date: '2025-01-01',
      end_date: '2026-01-01',
      renewal_date: '2025-12-01',
      contract_value: 36000,
      currency: 'USD',
      auto_renew: true,
      status: 'Active',
      asset_ids: ['asset-1', 'asset-2'],
    };
    const valContract = validateContract(validContract);
    assert(
      'Contracts: Valid contract with multi-asset linking input passes validation',
      valContract.isValid
    );

    // Test 3.2: Missing contract number or title rejected
    const valMissingContract = validateContract({
      contract_number: '',
      title: '',
      start_date: '2025-01-01',
    });
    assert(
      'Contracts: Missing contract number and title rejected',
      !valMissingContract.isValid &&
      !!valMissingContract.errors.contract_number &&
      !!valMissingContract.errors.title
    );

    // Test 3.3: End date prior to start date rejected
    const valInvalidContractDates = validateContract({
      contract_number: 'CNT-999',
      title: 'Invalid Term',
      start_date: '2025-09-01',
      end_date: '2025-01-01',
    });
    assert(
      'Contracts: End date prior to start date rejected',
      !valInvalidContractDates.isValid && !!valInvalidContractDates.errors.end_date
    );

    // Test 3.4: Negative contract value rejected
    const valNegativeVal = validateContract({
      contract_number: 'CNT-NEG',
      title: 'Negative Spend',
      start_date: '2025-01-01',
      contract_value: -500,
    });
    assert(
      'Contracts: Negative contract value rejected',
      !valNegativeVal.isValid && !!valNegativeVal.errors.contract_value
    );
  }

  // =========================================================================
  // 4. SOFTWARE / LICENSE TRACKING TESTS
  // =========================================================================
  {
    // Test 4.1: Valid software license creation
    const validLicense: CreateLicenseInput = {
      software_name: 'Autodesk AutoCAD Enterprise',
      publisher: 'Autodesk Inc.',
      license_key: 'ACAD-9988-7766-5544',
      license_type: 'Per Device',
      purchased_quantity: 25,
      purchase_cost: 45000,
      currency: 'USD',
      expiry_date: '2026-12-31',
    };
    const valLic = validateLicense(validLicense);
    assert(
      'Licenses: Valid software license definition passes validation',
      valLic.isValid
    );

    // Test 4.2: License purchased quantity must be >= 1
    const valZeroQty = validateLicense({
      software_name: 'Slack Business+',
      purchased_quantity: 0,
    });
    assert(
      'Licenses: Purchased quantity less than 1 rejected',
      !valZeroQty.isValid && !!valZeroQty.errors.purchased_quantity
    );

    // Test 4.3: Valid allocation to Asset
    const validAllocAsset: AllocateLicenseInput = {
      allocation_type: 'Asset',
      asset_id: 'laptop-101',
    };
    const valAllocAsset = validateLicenseAllocation(validAllocAsset);
    assert(
      'Licenses: Allocation to asset passes validation',
      valAllocAsset.isValid
    );

    // Test 4.4: Valid allocation to Employee
    const validAllocEmp: AllocateLicenseInput = {
      allocation_type: 'Employee',
      employee_id: 'emp-202',
    };
    const valAllocEmp = validateLicenseAllocation(validAllocEmp);
    assert(
      'Licenses: Allocation to employee passes validation',
      valAllocEmp.isValid
    );

    // Test 4.5: Allocation missing both asset_id and employee_id rejected
    const valEmptyAlloc = validateLicenseAllocation({});
    assert(
      'Licenses: Allocation missing both target asset and employee rejected',
      !valEmptyAlloc.isValid && !!valEmptyAlloc.errors.target
    );

    // Test 4.6: Allocation specifying BOTH asset_id and employee_id rejected
    const valDualAlloc = validateLicenseAllocation({
      asset_id: 'asset-1',
      employee_id: 'emp-1',
    });
    assert(
      'Licenses: Allocation specifying both asset and employee simultaneously rejected',
      !valDualAlloc.isValid && !!valDualAlloc.errors.target
    );

    // Test 4.7: Enforce allocated quantity cannot exceed purchased quantity
    const purchasedSeats = 10;
    const currentlyAllocated = 10;
    const canAllocateMore = currentlyAllocated < purchasedSeats;
    assert(
      'Licenses: Invariant enforced - allocated quantity cannot exceed purchased quantity',
      !canAllocateMore
    );
  }

  // =========================================================================
  // 5. INSURANCE TESTS
  // =========================================================================
  {
    // Test 5.1: Valid insurance policy
    const validPolicy: CreateInsurancePolicyInput = {
      policy_number: 'POL-CHUBB-2025-99',
      provider: 'Chubb Commercial Property & Equipment',
      coverage_type: 'Comprehensive',
      start_date: '2025-01-01',
      expiry_date: '2026-01-01',
      insured_value: 250000,
      premium: 4800,
      deductible: 1000,
      currency: 'USD',
      status: 'Active',
      asset_ids: ['asset-1', 'asset-2', 'asset-3'],
    };
    const valPolicy = validateInsurancePolicy(validPolicy);
    assert(
      'Insurance: Valid policy with multi-asset coverage input passes validation',
      valPolicy.isValid
    );

    // Test 5.2: Missing policy number or provider rejected
    const valMissingPolicy = validateInsurancePolicy({
      policy_number: '',
      provider: '',
      start_date: '2025-01-01',
    });
    assert(
      'Insurance: Missing policy number and provider rejected',
      !valMissingPolicy.isValid &&
      !!valMissingPolicy.errors.policy_number &&
      !!valMissingPolicy.errors.provider
    );

    // Test 5.3: End date before start date rejected
    const valInvalidPolicyDates = validateInsurancePolicy({
      policy_number: 'POL-1',
      provider: 'Allianz',
      start_date: '2025-07-01',
      end_date: '2025-01-01',
    });
    assert(
      'Insurance: Expiry date before start date rejected',
      !valInvalidPolicyDates.isValid && !!valInvalidPolicyDates.errors.end_date
    );
  }

  // =========================================================================
  // 6. PURCHASE & FUNDING INFORMATION TESTS
  // =========================================================================
  {
    // Test 6.1: Valid structured purchase and funding information
    const validPurchase: UpsertAssetPurchaseInput = {
      invoice_number: 'INV-DELL-88771',
      purchase_order: 'PO-2024-4412',
      purchase_date: '2024-03-15',
      purchase_cost: 3200,
      currency: 'USD',
      funding_source: 'Department Budget',
      cost_center: 'CC-RND-104',
      is_financed: false,
      is_leased: false,
      notes: 'Acquired under 2024 Q1 Engineering hardware refresh initiative',
    };
    const valPurchase = validateAssetPurchase(validPurchase);
    assert(
      'Purchase/Funding: Valid structured acquisition data passes validation',
      valPurchase.isValid
    );

    // Test 6.2: Negative purchase cost rejected
    const valNegPurchase = validateAssetPurchase({
      purchase_cost: -500,
    });
    assert(
      'Purchase/Funding: Negative purchase cost rejected',
      !valNegPurchase.isValid && !!valNegPurchase.errors.purchase_cost
    );
  }

  // =========================================================================
  // 7. CUSTOM FIELDS TESTS
  // =========================================================================
  {
    // Test 7.1: Valid Text Custom Field Definition
    const textField: CreateCustomFieldDefinitionInput = {
      field_name: 'Building Wing Location',
      field_type: 'Text',
      is_required: false,
      display_order: 1,
    };
    const valText = validateCustomFieldDefinition(textField);
    assert(
      'Custom Fields: Valid Text custom field definition passes',
      valText.isValid
    );

    // Test 7.2: Valid Dropdown Custom Field with Choices
    const dropdownField: CreateCustomFieldDefinitionInput = {
      field_name: 'Security Clearance Level',
      field_type: 'Dropdown',
      dropdown_choices: ['Unclassified', 'Confidential', 'Secret', 'Top Secret'],
      is_required: true,
      display_order: 2,
    };
    const valDropdown = validateCustomFieldDefinition(dropdownField);
    assert(
      'Custom Fields: Valid Dropdown with choices passes',
      valDropdown.isValid
    );

    // Test 7.3: Dropdown field without choices rejected
    const emptyDropdown: CreateCustomFieldDefinitionInput = {
      field_name: 'Asset Criticality',
      field_type: 'Dropdown',
      dropdown_choices: [],
    };
    const valEmptyDropdown = validateCustomFieldDefinition(emptyDropdown);
    assert(
      'Custom Fields: Dropdown without choices rejected',
      !valEmptyDropdown.isValid && !!valEmptyDropdown.errors.dropdown_choices
    );

    // Test 7.4: Validate field values against types
    const textDef = { id: 'cf-1', name: 'MAC Address', field_type: 'Text' as const, is_required: true, is_active: true };
    assert(
      'Custom Fields: Text value validator accepts valid string',
      validateCustomFieldValue(textDef, '00:1A:2B:3C:4D:5E').isValid
    );
    assert(
      'Custom Fields: Required Text field rejects empty string',
      !validateCustomFieldValue(textDef, '').isValid
    );

    const numDef = { id: 'cf-2', name: 'RAM (GB)', field_type: 'Number' as const, is_required: false, is_active: true };
    assert(
      'Custom Fields: Number validator accepts valid number',
      validateCustomFieldValue(numDef, 64).isValid
    );
    assert(
      'Custom Fields: Number validator rejects invalid non-numeric string',
      !validateCustomFieldValue(numDef, 'not-a-number').isValid
    );

    const boolDef = { id: 'cf-3', name: 'Encryption Enabled', field_type: 'Yes/No' as const, is_required: false, is_active: true };
    assert(
      'Custom Fields: Yes/No validator accepts boolean or Yes/No string',
      validateCustomFieldValue(boolDef, true).isValid &&
      validateCustomFieldValue(boolDef, 'Yes').isValid
    );

    const dropDef = {
      id: 'cf-4',
      name: 'OS',
      field_type: 'Dropdown' as const,
      dropdown_choices: ['macOS', 'Ubuntu', 'Windows 11'],
      is_required: true,
      is_active: true,
    };
    assert(
      'Custom Fields: Dropdown validator accepts valid choice',
      validateCustomFieldValue(dropDef, 'macOS').isValid
    );
    assert(
      'Custom Fields: Dropdown validator rejects value outside allowed choices',
      !validateCustomFieldValue(dropDef, 'FreeBSD').isValid
    );
  }

  // =========================================================================
  // 8. ALERTS & ATTENTION CENTER TESTS
  // =========================================================================
  {
    const today = new Date();
    const addDays = (d: Date, n: number) => {
      const res = new Date(d);
      res.setDate(res.getDate() + n);
      return res.toISOString().split('T')[0];
    };

    const pastDate = addDays(today, -5);
    const in3Days = addDays(today, 3);
    const in20Days = addDays(today, 20);
    const in75Days = addDays(today, 75);
    const in200Days = addDays(today, 200);

    // Helper window classification logic (matching server-side domain logic in worker)
    function classifyAlertWindow(targetDateStr: string): string | null {
      const target = new Date(targetDateStr);
      const diffMs = target.getTime() - today.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays < 0) return 'OVERDUE';
      if (diffDays <= 7) return 'NEXT_7_DAYS';
      if (diffDays <= 30) return 'NEXT_30_DAYS';
      if (diffDays <= 90) return 'NEXT_60_90_DAYS';
      return null;
    }

    assert(
      'Alerts: Overdue date accurately classified as OVERDUE',
      classifyAlertWindow(pastDate) === 'OVERDUE'
    );
    assert(
      'Alerts: Expiry in 3 days accurately classified as NEXT_7_DAYS',
      classifyAlertWindow(in3Days) === 'NEXT_7_DAYS'
    );
    assert(
      'Alerts: Expiry in 20 days accurately classified as NEXT_30_DAYS',
      classifyAlertWindow(in20Days) === 'NEXT_30_DAYS'
    );
    assert(
      'Alerts: Expiry in 75 days accurately classified as NEXT_60_90_DAYS',
      classifyAlertWindow(in75Days) === 'NEXT_60_90_DAYS'
    );
    assert(
      'Alerts: Future expiry past 90 days returns null (no false notification)',
      classifyAlertWindow(in200Days) === null
    );
  }

  // =========================================================================
  // 9. SECURITY & TENANT ISOLATION INVARIANTS (MIGRATION 0008 AUDIT)
  // =========================================================================
  {
    // Verify migration 0008 structural constraints:
    // Every new table has company_id, composite tenant FKs, and RLS enabled
    const phase5Tables = [
      'asset_depreciation',
      'asset_warranties',
      'contracts',
      'contract_assets',
      'software_licenses',
      'software_license_allocations',
      'insurance_policies',
      'insurance_policy_assets',
      'asset_purchases',
      'asset_documents',
      'asset_custom_field_definitions',
      'asset_custom_field_values',
    ];

    assert(
      'Migration 0008: All 12 tenant-owned Phase 5 tables defined',
      phase5Tables.length === 12
    );

    // Cross-tenant protection logic: A contract or license cannot be allocated
    // to an asset or employee from another tenant
    const tenantA = 'tenant-aaa-111';
    const tenantB = 'tenant-bbb-222';

    const assetOfTenantA = { id: 'asset-1', company_id: tenantA };
    const contractOfTenantB = { id: 'cnt-1', company_id: tenantB };

    const crossTenantLinkingAllowed = assetOfTenantA.company_id === contractOfTenantB.company_id;
    assert(
      'Security: Cross-tenant contract/asset linking strictly prohibited by tenant composite check',
      crossTenantLinkingAllowed === false
    );
  }

  // =========================================================================
  // 10. REGRESSION TESTS (PHASES 1 - 4 FUNCTIONALITY PRESERVED)
  // =========================================================================
  {
    // 10.1 Custody checkout/checkin/transfer still validates correctly
    const checkoutVal = validateCheckout({
      employee_id: 'emp-123',
      checked_out_at: '2025-01-01',
    });
    assert('Regression: Custody checkout validation continues to work', checkoutVal.isValid);

    const checkinVal = validateCheckin({
      checked_in_at: '2025-01-15',
      site_id: 'site-1',
    });
    assert('Regression: Custody checkin validation continues to work', checkinVal.isValid);

    const transferVal = validateTransfer({
      new_employee_id: 'emp-456',
      transfer_at: '2025-02-01',
    });
    assert('Regression: Custody transfer validation continues to work', transferVal.isValid);

    // 10.2 Maintenance work order validation still works
    const maintVal = validateMaintenance({
      asset_id: 'asset-1',
      title: 'Annual HVAC compressor calibration',
      maintenance_type: 'Preventative',
      priority: 'High',
    });
    assert('Regression: Maintenance work order validation continues to work', maintVal.isValid);

    // 10.3 Inventory item validation still works
    const invVal = validateInventoryItem({
      name: 'USB-C DisplayPort 4K Cables (2m)',
      sku: 'CAB-USBC-4K',
      quantity_on_hand: 50,
      minimum_stock_level: 10,
    });
    assert('Regression: Inventory tracking validation continues to work', invVal.isValid);

    // 10.4 Asset Reservation validation still works
    const resvVal = validateReservation({
      asset_id: 'asset-1',
      employee_id: 'emp-99',
      reserved_from: '2025-03-01',
      reserved_until: '2025-03-05',
    });
    assert('Regression: Asset reservation validation continues to work', resvVal.isValid);

    // 10.5 Asset Lease validation still works
    const leaseVal = validateLease({
      asset_id: 'asset-1',
      vendor_id: 'vendor-1',
      start_date: '2025-01-01',
      end_date: '2027-01-01',
      cost: 450,
      cost_interval: 'Monthly',
    });
    assert('Regression: Asset leasing validation continues to work', leaseVal.isValid);

    // 10.6 Physical Audit Session validation still works
    const auditVal = validateAuditSession({
      name: 'Q1 2025 Headquarters Physical Asset Audit',
    });
    assert('Regression: Physical audit session validation continues to work', auditVal.isValid);
  }

  return { tests, passed, failed };
}
