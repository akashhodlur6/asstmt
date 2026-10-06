/**
 * AssetMT - Shared Validation Logic
 * Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
 */

import {
  GENERIC_FORM_ALLOWED_STATUSES,
  AssetStatus,
  CreateAssetInput,
  CreateDepartmentInput,
  CreateEmployeeInput,
  CreateWorkspaceInput,
  CheckoutInput,
  CheckinInput,
  TransferInput,
  CreateVendorInput,
  CreateMaintenanceInput,
  ScheduleMaintenanceInput,
  CompleteMaintenanceInput,
  CancelMaintenanceInput,
  MaintenanceStatus,
  MaintenancePriority,
  MaintenanceType,
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
  DepreciationMethod,
  ConfigureDepreciationInput,
  DepreciationSchedulePeriod,
  CreateWarrantyInput,
  CreateContractInput,
  CreateLicenseInput,
  AllocateLicenseInput,
  CreateInsurancePolicyInput,
  UpsertAssetPurchaseInput,
  CreateDocumentInput,
  CreateCustomFieldDefinitionInput,
} from './types.ts';

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateCreateWorkspace(input: Partial<CreateWorkspaceInput>): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.name || input.name.trim().length === 0) {
    errors.name = 'Company workspace name is required';
  } else if (input.name.trim().length < 2) {
    errors.name = 'Company workspace name must be at least 2 characters';
  } else if (input.name.trim().length > 100) {
    errors.name = 'Company workspace name cannot exceed 100 characters';
  }

  if (input.code && input.code.trim().length > 0) {
    const cleanCode = input.code.trim();
    if (!/^[A-Za-z0-9_-]+$/.test(cleanCode)) {
      errors.code = 'Company code can only contain letters, numbers, hyphens, and underscores';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateAsset(input: Partial<CreateAssetInput>, isUpdate = false): ValidationResult {
  const errors: Record<string, string> = {};

  // Asset Tag validation
  if (!isUpdate || input.asset_tag !== undefined) {
    if (!input.asset_tag || input.asset_tag.trim().length === 0) {
      errors.asset_tag = 'Asset tag is required';
    } else if (input.asset_tag.trim().length > 50) {
      errors.asset_tag = 'Asset tag cannot exceed 50 characters';
    } else if (!/^[A-Za-z0-9_.\-]+$/.test(input.asset_tag.trim())) {
      errors.asset_tag = 'Asset tag may only contain letters, numbers, dashes, periods, or underscores';
    }
  }

  // Asset Name validation
  if (!isUpdate || input.name !== undefined) {
    if (!input.name || input.name.trim().length === 0) {
      errors.name = 'Asset description / name is required';
    } else if (input.name.trim().length < 2) {
      errors.name = 'Asset name must be at least 2 characters';
    } else if (input.name.trim().length > 200) {
      errors.name = 'Asset name cannot exceed 200 characters';
    }
  }

  // Status validation:
  // "Do not allow users to manually change an asset to 'Assigned' from the generic asset edit form. Assigned status must result only from the custody workflow."
  if (input.status !== undefined) {
    if (input.status === 'Assigned') {
      errors.status = 'Asset cannot be marked as "Assigned" from the generic form. Please use the Check Out / Assign custody workflow.';
    } else if (!GENERIC_FORM_ALLOWED_STATUSES.includes(input.status as AssetStatus)) {
      errors.status = `Invalid asset status. Permitted values: ${GENERIC_FORM_ALLOWED_STATUSES.join(', ')}`;
    }
  }

  // Cost validation
  if (input.purchase_cost !== undefined && input.purchase_cost !== null) {
    const cost = Number(input.purchase_cost);
    if (isNaN(cost) || cost < 0) {
      errors.purchase_cost = 'Purchase cost must be a non-negative number';
    }
  }

  // Date validations
  if (input.purchase_date && isNaN(Date.parse(input.purchase_date))) {
    errors.purchase_date = 'Invalid purchase date';
  }

  if (input.warranty_expiry && isNaN(Date.parse(input.warranty_expiry))) {
    errors.warranty_expiry = 'Invalid warranty expiry date';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateCheckout(input: Partial<CheckoutInput>): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.employee_id || input.employee_id.trim().length === 0) {
    errors.employee_id = 'Target employee custodian is required';
  }

  if (input.checked_out_at && isNaN(Date.parse(input.checked_out_at))) {
    errors.checked_out_at = 'Invalid checkout date';
  }

  if (input.expected_return_at && input.expected_return_at.trim().length > 0) {
    if (isNaN(Date.parse(input.expected_return_at))) {
      errors.expected_return_at = 'Invalid expected return date';
    } else if (input.checked_out_at) {
      const checkoutTime = new Date(input.checked_out_at).getTime();
      const returnTime = new Date(input.expected_return_at).getTime();
      if (returnTime < checkoutTime) {
        errors.expected_return_at = 'Expected return date cannot be before checkout date';
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateCheckin(input: Partial<CheckinInput>): ValidationResult {
  const errors: Record<string, string> = {};

  if (input.checked_in_at && isNaN(Date.parse(input.checked_in_at))) {
    errors.checked_in_at = 'Invalid check-in date';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateTransfer(input: Partial<TransferInput>, currentEmployeeId?: string): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.new_employee_id || input.new_employee_id.trim().length === 0) {
    errors.new_employee_id = 'New employee custodian is required';
  } else if (currentEmployeeId && input.new_employee_id === currentEmployeeId) {
    errors.new_employee_id = 'Cannot transfer asset to the current custodian. Please select a different employee.';
  }

  if (input.transfer_at && isNaN(Date.parse(input.transfer_at))) {
    errors.transfer_at = 'Invalid transfer date';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateDepartment(
  input: Partial<CreateDepartmentInput>,
  isUpdate = false
): ValidationResult {
  const errors: Record<string, string> = {};

  if (!isUpdate || input.name !== undefined) {
    if (!input.name || input.name.trim().length === 0) {
      errors.name = 'Department name is required';
    } else if (input.name.trim().length < 2) {
      errors.name = 'Department name must be at least 2 characters';
    } else if (input.name.trim().length > 100) {
      errors.name = 'Department name cannot exceed 100 characters';
    }
  }

  if (input.code !== undefined && input.code !== null && input.code.trim().length > 0) {
    const cleanCode = input.code.trim();
    if (cleanCode.length > 50) {
      errors.code = 'Department code cannot exceed 50 characters';
    } else if (!/^[A-Za-z0-9_.\-]+$/.test(cleanCode)) {
      errors.code = 'Department code may only contain letters, numbers, dashes, periods, or underscores';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateEmployee(
  input: Partial<CreateEmployeeInput>,
  isUpdate = false
): ValidationResult {
  const errors: Record<string, string> = {};

  // Employee Code / ID validation
  if (!isUpdate || input.employee_code !== undefined) {
    if (!input.employee_code || input.employee_code.trim().length === 0) {
      errors.employee_code = 'Employee ID / Code is required';
    } else if (input.employee_code.trim().length < 1) {
      errors.employee_code = 'Employee ID / Code cannot be empty';
    } else if (input.employee_code.trim().length > 50) {
      errors.employee_code = 'Employee ID / Code cannot exceed 50 characters';
    } else if (!/^[A-Za-z0-9_.\-]+$/.test(input.employee_code.trim())) {
      errors.employee_code = 'Employee ID / Code may only contain letters, numbers, dashes, periods, or underscores';
    }
  }

  // Full Name validation
  if (!isUpdate || input.full_name !== undefined) {
    if (!input.full_name || input.full_name.trim().length === 0) {
      errors.full_name = 'Full name is required';
    } else if (input.full_name.trim().length < 2) {
      errors.full_name = 'Full name must be at least 2 characters';
    } else if (input.full_name.trim().length > 150) {
      errors.full_name = 'Full name cannot exceed 150 characters';
    }
  }

  // Work Email (optional, but must be valid format if provided)
  if (input.email !== undefined && input.email !== null && input.email.trim().length > 0) {
    const cleanEmail = input.email.trim();
    if (cleanEmail.length > 255) {
      errors.email = 'Email address cannot exceed 255 characters';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errors.email = 'Please provide a valid email address';
    }
  }

  // Job Title (optional)
  if (input.job_title !== undefined && input.job_title !== null && input.job_title.trim().length > 0) {
    if (input.job_title.trim().length > 100) {
      errors.job_title = 'Job title cannot exceed 100 characters';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export const VALID_MAINTENANCE_TYPES: MaintenanceType[] = [
  'Preventative',
  'Corrective',
  'Inspection',
  'Upgrade',
  'Calibration',
  'Other',
];

export const VALID_MAINTENANCE_PRIORITIES: MaintenancePriority[] = [
  'Low',
  'Medium',
  'High',
  'Critical',
];

export const VALID_MAINTENANCE_STATUSES: MaintenanceStatus[] = [
  'Open',
  'Scheduled',
  'In Progress',
  'Completed',
  'Cancelled',
];

export function isValidMaintenanceTransition(
  currentStatus: MaintenanceStatus,
  targetStatus: MaintenanceStatus
): { isValid: boolean; message?: string } {
  if (currentStatus === targetStatus) {
    return { isValid: true };
  }

  // Terminal states cannot transition to any other state
  if (currentStatus === 'Completed') {
    return {
      isValid: false,
      message: 'Completed work orders are archived and cannot be transitioned to another state.',
    };
  }

  if (currentStatus === 'Cancelled') {
    return {
      isValid: false,
      message: 'Cancelled work orders cannot be reopened or transitioned to another state.',
    };
  }

  // Transitions from Open
  if (currentStatus === 'Open') {
    if (['Scheduled', 'In Progress', 'Cancelled'].includes(targetStatus)) {
      return { isValid: true };
    }
    return {
      isValid: false,
      message: `Cannot transition work order directly from "Open" to "${targetStatus}". Please start work first.`,
    };
  }

  // Transitions from Scheduled
  if (currentStatus === 'Scheduled') {
    if (['Open', 'In Progress', 'Cancelled'].includes(targetStatus)) {
      return { isValid: true };
    }
    return {
      isValid: false,
      message: `Cannot complete a work order directly from "Scheduled" without starting it ("In Progress").`,
    };
  }

  // Transitions from In Progress
  if (currentStatus === 'In Progress') {
    if (['Completed', 'Cancelled'].includes(targetStatus)) {
      return { isValid: true };
    }
    return {
      isValid: false,
      message: `Cannot revert an "In Progress" work order back to "${targetStatus}".`,
    };
  }

  return { isValid: false, message: 'Invalid status transition.' };
}

export function validateVendor(
  input: Partial<CreateVendorInput>,
  isUpdate = false
): ValidationResult {
  const errors: Record<string, string> = {};

  if (!isUpdate || input.name !== undefined) {
    if (!input.name || input.name.trim().length === 0) {
      errors.name = 'Vendor name is required';
    } else if (input.name.trim().length < 2) {
      errors.name = 'Vendor name must be at least 2 characters';
    } else if (input.name.trim().length > 100) {
      errors.name = 'Vendor name cannot exceed 100 characters';
    }
  }

  if (input.email !== undefined && input.email !== null && input.email.trim().length > 0) {
    const cleanEmail = input.email.trim();
    if (cleanEmail.length > 255) {
      errors.email = 'Email address cannot exceed 255 characters';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errors.email = 'Please provide a valid email address';
    }
  }

  if (input.website !== undefined && input.website !== null && input.website.trim().length > 0) {
    const cleanWeb = input.website.trim();
    if (cleanWeb.length > 255) {
      errors.website = 'Website URL cannot exceed 255 characters';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateMaintenance(
  input: Partial<CreateMaintenanceInput>,
  isUpdate = false
): ValidationResult {
  const errors: Record<string, string> = {};

  if (!isUpdate || input.asset_id !== undefined) {
    if (!input.asset_id || input.asset_id.trim().length === 0) {
      errors.asset_id = 'Target asset is required';
    }
  }

  if (!isUpdate || input.title !== undefined) {
    if (!input.title || input.title.trim().length === 0) {
      errors.title = 'Work order title is required';
    } else if (input.title.trim().length < 3) {
      errors.title = 'Work order title must be at least 3 characters';
    } else if (input.title.trim().length > 200) {
      errors.title = 'Work order title cannot exceed 200 characters';
    }
  }

  if (input.work_order_number !== undefined && input.work_order_number !== null && input.work_order_number.trim().length > 0) {
    const cleanWo = input.work_order_number.trim();
    if (cleanWo.length > 50) {
      errors.work_order_number = 'Work order number cannot exceed 50 characters';
    } else if (!/^[A-Za-z0-9_.\-]+$/.test(cleanWo)) {
      errors.work_order_number = 'Work order number may only contain letters, numbers, dashes, periods, or underscores';
    }
  }

  if (!isUpdate || input.maintenance_type !== undefined) {
    if (!input.maintenance_type || !VALID_MAINTENANCE_TYPES.includes(input.maintenance_type)) {
      errors.maintenance_type = `Maintenance type must be one of: ${VALID_MAINTENANCE_TYPES.join(', ')}`;
    }
  }

  if (!isUpdate || input.priority !== undefined) {
    if (!input.priority || !VALID_MAINTENANCE_PRIORITIES.includes(input.priority)) {
      errors.priority = `Priority must be one of: ${VALID_MAINTENANCE_PRIORITIES.join(', ')}`;
    }
  }

  if (input.service_cost !== undefined && input.service_cost !== null) {
    const cost = Number(input.service_cost);
    if (isNaN(cost) || cost < 0) {
      errors.service_cost = 'Service cost must be a non-negative number';
    }
  }

  if (input.scheduled_date && isNaN(Date.parse(input.scheduled_date))) {
    errors.scheduled_date = 'Invalid scheduled date';
  }

  if (input.due_date && isNaN(Date.parse(input.due_date))) {
    errors.due_date = 'Invalid due date';
  }

  if (input.scheduled_date && input.due_date) {
    if (new Date(input.due_date).getTime() < new Date(input.scheduled_date).getTime()) {
      errors.due_date = 'Due date cannot be before scheduled date';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateScheduleMaintenance(input: Partial<ScheduleMaintenanceInput>): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.scheduled_date || isNaN(Date.parse(input.scheduled_date))) {
    errors.scheduled_date = 'A valid scheduled date is required';
  }

  if (input.due_date && isNaN(Date.parse(input.due_date))) {
    errors.due_date = 'Invalid due date';
  }

  if (input.scheduled_date && input.due_date) {
    if (new Date(input.due_date).getTime() < new Date(input.scheduled_date).getTime()) {
      errors.due_date = 'Due date cannot be before scheduled date';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateCompleteMaintenance(input: Partial<CompleteMaintenanceInput>): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.resolution_notes || input.resolution_notes.trim().length === 0) {
    errors.resolution_notes = 'Resolution notes are required when completing a work order';
  } else if (input.resolution_notes.trim().length < 3) {
    errors.resolution_notes = 'Resolution notes must be at least 3 characters';
  }

  if (input.completed_at && isNaN(Date.parse(input.completed_at))) {
    errors.completed_at = 'Invalid completion timestamp';
  }

  if (input.service_cost !== undefined && input.service_cost !== null) {
    const cost = Number(input.service_cost);
    if (isNaN(cost) || cost < 0) {
      errors.service_cost = 'Final service cost must be a non-negative number';
    }
  }

  if (input.downtime_minutes !== undefined && input.downtime_minutes !== null) {
    const dt = Number(input.downtime_minutes);
    if (isNaN(dt) || dt < 0) {
      errors.downtime_minutes = 'Downtime minutes must be a non-negative number';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateCancelMaintenance(input: Partial<CancelMaintenanceInput>): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.reason || input.reason.trim().length === 0) {
    errors.reason = 'Cancellation reason is required';
  } else if (input.reason.trim().length < 3) {
    errors.reason = 'Cancellation reason must be at least 3 characters';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

// ============================================================================
// Phase 4 Validation Functions
// ============================================================================

export function validateInventoryItem(
  input: Partial<CreateInventoryItemInput>,
  isUpdate = false
): ValidationResult {
  const errors: Record<string, string> = {};

  if (!isUpdate || input.sku !== undefined) {
    if (!input.sku || input.sku.trim().length === 0) {
      errors.sku = 'SKU is required';
    } else if (input.sku.trim().length > 50) {
      errors.sku = 'SKU cannot exceed 50 characters';
    }
  }

  if (!isUpdate || input.name !== undefined) {
    if (!input.name || input.name.trim().length === 0) {
      errors.name = 'Item name is required';
    } else if (input.name.trim().length < 2) {
      errors.name = 'Item name must be at least 2 characters';
    } else if (input.name.trim().length > 150) {
      errors.name = 'Item name cannot exceed 150 characters';
    }
  }

  if (input.quantity_on_hand !== undefined && input.quantity_on_hand !== null) {
    const qty = Number(input.quantity_on_hand);
    if (isNaN(qty) || !Number.isInteger(qty) || qty < 0) {
      errors.quantity_on_hand = 'Quantity on hand must be a non-negative integer';
    }
  }

  if (input.minimum_stock_level !== undefined && input.minimum_stock_level !== null) {
    const minLevel = Number(input.minimum_stock_level);
    if (isNaN(minLevel) || !Number.isInteger(minLevel) || minLevel < 0) {
      errors.minimum_stock_level = 'Minimum stock level must be a non-negative integer';
    }
  }

  if (input.unit_cost !== undefined && input.unit_cost !== null) {
    const cost = Number(input.unit_cost);
    if (isNaN(cost) || cost < 0) {
      errors.unit_cost = 'Unit cost must be a non-negative number';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateInventoryStockMovement(
  input: Partial<InventoryStockMovementInput>,
  currentStock?: number
): ValidationResult {
  const errors: Record<string, string> = {};

  const allowedTypes = ['STOCK_IN', 'STOCK_OUT', 'TRANSFER', 'ADJUSTMENT'];
  if (!input.transaction_type || !allowedTypes.includes(input.transaction_type)) {
    errors.transaction_type = 'Valid transaction type (STOCK_IN, STOCK_OUT, TRANSFER, ADJUSTMENT) is required';
  }

  if (input.quantity === undefined || input.quantity === null) {
    errors.quantity = 'Quantity is required';
  } else {
    const qty = Number(input.quantity);
    if (isNaN(qty) || !Number.isInteger(qty)) {
      errors.quantity = 'Quantity must be an integer';
    } else if (input.transaction_type === 'ADJUSTMENT') {
      if (qty < 0) {
        errors.quantity = 'Adjusted quantity cannot be negative';
      }
    } else if (qty <= 0) {
      errors.quantity = 'Quantity must be greater than zero';
    } else if (
      (input.transaction_type === 'STOCK_OUT' || input.transaction_type === 'TRANSFER') &&
      currentStock !== undefined &&
      qty > currentStock
    ) {
      errors.quantity = `Insufficient stock on hand (current stock: ${currentStock})`;
    }
  }

  if (input.unit_cost !== undefined && input.unit_cost !== null) {
    const cost = Number(input.unit_cost);
    if (isNaN(cost) || cost < 0) {
      errors.unit_cost = 'Unit cost must be a non-negative number';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateReservation(input: Partial<CreateReservationInput>): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.asset_id || input.asset_id.trim().length === 0) {
    errors.asset_id = 'Asset is required for reservation';
  }

  if (!input.employee_id || input.employee_id.trim().length === 0) {
    errors.employee_id = 'Target employee is required for reservation';
  }

  if (!input.reserved_from || isNaN(Date.parse(input.reserved_from))) {
    errors.reserved_from = 'Valid reservation start date is required';
  }

  if (!input.reserved_until || isNaN(Date.parse(input.reserved_until))) {
    errors.reserved_until = 'Valid reservation end date is required';
  }

  if (
    input.reserved_from &&
    input.reserved_until &&
    !isNaN(Date.parse(input.reserved_from)) &&
    !isNaN(Date.parse(input.reserved_until))
  ) {
    if (new Date(input.reserved_until).getTime() < new Date(input.reserved_from).getTime()) {
      errors.reserved_until = 'Reservation end date cannot be earlier than start date';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateLease(input: Partial<CreateLeaseInput>): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.asset_id || input.asset_id.trim().length === 0) {
    errors.asset_id = 'Asset is required for lease';
  }

  if (!input.vendor_id || input.vendor_id.trim().length === 0) {
    errors.vendor_id = 'Lessor vendor is required for lease';
  }

  if (!input.start_date || isNaN(Date.parse(input.start_date))) {
    errors.start_date = 'Valid lease start date is required';
  }

  if (!input.end_date || isNaN(Date.parse(input.end_date))) {
    errors.end_date = 'Valid lease end date is required';
  }

  if (
    input.start_date &&
    input.end_date &&
    !isNaN(Date.parse(input.start_date)) &&
    !isNaN(Date.parse(input.end_date))
  ) {
    if (new Date(input.end_date).getTime() < new Date(input.start_date).getTime()) {
      errors.end_date = 'Lease end date cannot be earlier than start date';
    }
  }

  if (input.cost !== undefined && input.cost !== null) {
    const cost = Number(input.cost);
    if (isNaN(cost) || cost < 0) {
      errors.cost = 'Lease cost must be a non-negative number';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateReturnLease(input: Partial<ReturnLeaseInput>): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.return_date || isNaN(Date.parse(input.return_date))) {
    errors.return_date = 'Valid lease return date is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateMoveAsset(input: Partial<MoveAssetInput>): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.to_site_id && !input.to_location_id) {
    errors.target = 'Target site or location is required to move asset';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateDisposeAsset(input: Partial<DisposeAssetInput>): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.disposal_date || isNaN(Date.parse(input.disposal_date))) {
    errors.disposal_date = 'Valid disposal date is required';
  }

  const allowedMethods = ['Sold', 'Recycled', 'Scrapped', 'Donated', 'Lost', 'Other'];
  if (!input.disposal_method || !allowedMethods.includes(input.disposal_method)) {
    errors.disposal_method = 'Valid disposal method is required';
  }

  if (!input.reason || input.reason.trim().length === 0) {
    errors.reason = 'Disposal reason is required';
  }

  if (input.recovery_value !== undefined && input.recovery_value !== null) {
    const recVal = Number(input.recovery_value);
    if (isNaN(recVal) || recVal < 0) {
      errors.recovery_value = 'Recovery value must be a non-negative number';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateAssetRelationship(
  input: Partial<CreateAssetRelationshipInput>
): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.child_asset_id || input.child_asset_id.trim().length === 0) {
    errors.child_asset_id = 'Related asset is required';
  }

  if (input.parent_asset_id && input.child_asset_id && input.parent_asset_id === input.child_asset_id) {
    errors.child_asset_id = 'Asset cannot be linked to itself';
  }

  const allowedTypes = ['Component Of', 'Accessory Of', 'Related To'];
  if (!input.relationship_type || !allowedTypes.includes(input.relationship_type)) {
    errors.relationship_type = 'Valid relationship type (Component Of, Accessory Of, Related To) is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateAuditSession(input: Partial<CreateAuditSessionInput>): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.name || input.name.trim().length === 0) {
    errors.name = 'Audit session name is required';
  } else if (input.name.trim().length < 2) {
    errors.name = 'Audit session name must be at least 2 characters';
  } else if (input.name.trim().length > 100) {
    errors.name = 'Audit session name cannot exceed 100 characters';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateScanAuditItem(input: Partial<ScanAuditItemInput>): ValidationResult {
  const errors: Record<string, string> = {};

  if (
    (!input.asset_id || input.asset_id.trim().length === 0) &&
    (!input.asset_tag || input.asset_tag.trim().length === 0)
  ) {
    errors.asset = 'Asset ID or Asset Tag is required for audit scan';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

// ============================================================================
// Phase 5: Financial, Compliance & Asset Records Validation & Calculations
// ============================================================================

// 1. Depreciation Calculation & Validation
export interface DepreciationCalculationResult {
  originalCost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  method: DepreciationMethod;
  accumulatedDepreciation: number;
  currentBookValue: number;
  depreciationToDate: number;
  monthlyDepreciation: number;
  isFullyDepreciated: boolean;
  schedule: DepreciationSchedulePeriod[];
}

export interface CalculateDepreciationOptions {
  cost: number;
  salvageValue?: number;
  salvage_value?: number;
  usefulLifeMonths?: number;
  useful_life_months?: number;
  startDate?: string | null;
  depreciation_start_date?: string | null;
  method?: DepreciationMethod;
  depreciation_method?: DepreciationMethod;
  depreciationRate?: number | null;
  rate?: number | null;
  asOfDate?: string | null;
}

export function calculateDepreciation(
  costOrOptions: number | CalculateDepreciationOptions,
  salvageArg?: number,
  usefulLifeMonthsArg?: number,
  startDateStrArg?: string | null,
  methodArg: DepreciationMethod = 'STRAIGHT_LINE',
  rateArg?: number | null,
  asOfDateStrArg?: string
): DepreciationCalculationResult {
  let cost = 0;
  let salvage = 0;
  let usefulLifeMonths = 60;
  let startDateStr: string | null | undefined = null;
  let method: DepreciationMethod = 'STRAIGHT_LINE';
  let rate: number | null | undefined = null;
  let asOfDateStr: string | undefined = undefined;

  if (typeof costOrOptions === 'object' && costOrOptions !== null) {
    cost = costOrOptions.cost;
    salvage = costOrOptions.salvageValue ?? costOrOptions.salvage_value ?? 0;
    usefulLifeMonths = costOrOptions.usefulLifeMonths ?? costOrOptions.useful_life_months ?? 60;
    startDateStr = costOrOptions.startDate ?? costOrOptions.depreciation_start_date;
    method = costOrOptions.method ?? costOrOptions.depreciation_method ?? 'STRAIGHT_LINE';
    rate = costOrOptions.depreciationRate ?? costOrOptions.rate;
    asOfDateStr = costOrOptions.asOfDate ?? undefined;
  } else {
    cost = costOrOptions;
    salvage = salvageArg ?? 0;
    usefulLifeMonths = usefulLifeMonthsArg ?? 60;
    startDateStr = startDateStrArg;
    method = methodArg;
    rate = rateArg;
    asOfDateStr = asOfDateStrArg;
  }

  const safeCost = Math.max(0, Number(cost) || 0);
  const safeSalvage = Math.max(0, Math.min(safeCost, Number(salvage) || 0));
  const safeMonths = Math.max(1, Number(usefulLifeMonths) || 60);

  if (method === 'NO_DEPRECIATION' || safeCost <= safeSalvage) {
    return {
      originalCost: safeCost,
      salvageValue: safeSalvage,
      usefulLifeMonths: safeMonths,
      method,
      accumulatedDepreciation: 0,
      currentBookValue: safeCost,
      depreciationToDate: 0,
      monthlyDepreciation: 0,
      isFullyDepreciated: safeCost <= safeSalvage,
      schedule: [],
    };
  }

  const startDate = startDateStr ? new Date(startDateStr) : new Date();
  const asOfDate = asOfDateStr ? new Date(asOfDateStr) : new Date();

  // Months elapsed calculation
  let elapsedMonths =
    (asOfDate.getFullYear() - startDate.getFullYear()) * 12 +
    (asOfDate.getMonth() - startDate.getMonth());
  if (asOfDate.getDate() < startDate.getDate()) {
    elapsedMonths = Math.max(0, elapsedMonths - 1);
  }
  elapsedMonths = Math.max(0, Math.min(safeMonths, elapsedMonths));

  const depreciableBase = safeCost - safeSalvage;
  const monthlyStraight = depreciableBase / safeMonths;
  let accumulatedDep = 0;
  let currentBookVal = safeCost;

  if (method === 'STRAIGHT_LINE') {
    accumulatedDep = Math.min(depreciableBase, Math.round(monthlyStraight * elapsedMonths * 100) / 100);
    currentBookVal = Math.max(safeSalvage, Math.round((safeCost - accumulatedDep) * 100) / 100);
  } else if (method === 'DECLINING_BALANCE') {
    // Annual rate fallback: double declining = 2 / (safeMonths / 12)
    const effectiveAnnualRate =
      rate && rate > 0
        ? rate > 1 ? rate / 100 : rate
        : Math.min(0.99, 2 / (safeMonths / 12));
    const monthlyRate = effectiveAnnualRate / 12;

    let balance = safeCost;
    for (let m = 0; m < elapsedMonths; m++) {
      const monthExp = balance * monthlyRate;
      if (balance - monthExp < safeSalvage) {
        balance = safeSalvage;
        break;
      }
      balance -= monthExp;
    }
    currentBookVal = Math.max(safeSalvage, Math.round(balance * 100) / 100);
    accumulatedDep = Math.round((safeCost - currentBookVal) * 100) / 100;
  }

  // Generate Annual / Multi-Year Schedule
  const schedule: any[] = [];
  const totalYears = Math.ceil(safeMonths / 12);
  let schBookValue = safeCost;
  let schAccumulated = 0;

  for (let year = 1; year <= totalYears; year++) {
    const startingVal = schBookValue;
    let yearExpense = 0;

    if (method === 'STRAIGHT_LINE') {
      const annualStraight = (depreciableBase / safeMonths) * 12;
      yearExpense = Math.min(startingVal - safeSalvage, annualStraight);
    } else if (method === 'DECLINING_BALANCE') {
      const effectiveAnnualRate =
        rate && rate > 0
          ? rate > 1 ? rate / 100 : rate
          : Math.min(0.99, 2 / (safeMonths / 12));
      yearExpense = Math.min(startingVal - safeSalvage, startingVal * effectiveAnnualRate);
    }

    if (yearExpense < 0) yearExpense = 0;
    yearExpense = Math.round(yearExpense * 100) / 100;
    schAccumulated = Math.min(depreciableBase, Math.round((schAccumulated + yearExpense) * 100) / 100);
    schBookValue = Math.max(safeSalvage, Math.round((safeCost - schAccumulated) * 100) / 100);

    const periodYear = startDate.getFullYear() + year - 1;
    schedule.push({
      period: year,
      year: periodYear,
      periodYear,
      period_label: `Year ${year}`,
      period_name: `Year ${year}`,
      starting_book_value: startingVal,
      startingBookValue: startingVal,
      depreciation_expense: yearExpense,
      depreciationExpense: yearExpense,
      accumulated_depreciation: schAccumulated,
      accumulatedDepreciation: schAccumulated,
      ending_book_value: schBookValue,
      endingBookValue: schBookValue,
    });

    if (schBookValue <= safeSalvage) break;
  }

  return {
    originalCost: safeCost,
    salvageValue: safeSalvage,
    usefulLifeMonths: safeMonths,
    method,
    accumulatedDepreciation: accumulatedDep,
    currentBookValue: currentBookVal,
    depreciationToDate: accumulatedDep,
    monthlyDepreciation: Math.round(monthlyStraight * 100) / 100,
    isFullyDepreciated: currentBookVal <= safeSalvage,
    schedule,
  };
}

export function validateDepreciationConfig(
  input: Partial<ConfigureDepreciationInput & { depreciation_method?: DepreciationMethod }>,
  purchaseCost?: number
): ValidationResult {
  const errors: Record<string, string> = {};

  const method = input.method || input.depreciation_method;
  const allowedMethods: DepreciationMethod[] = ['STRAIGHT_LINE', 'DECLINING_BALANCE', 'NO_DEPRECIATION'];
  if (!method || !allowedMethods.includes(method)) {
    errors.method = 'Valid depreciation method (STRAIGHT_LINE, DECLINING_BALANCE, NO_DEPRECIATION) is required';
  }

  if (input.salvage_value !== undefined && input.salvage_value !== null) {
    const val = Number(input.salvage_value);
    if (isNaN(val) || val < 0) {
      errors.salvage_value = 'Salvage value must be a non-negative number';
    } else if (purchaseCost !== undefined && purchaseCost >= 0 && val > purchaseCost) {
      errors.salvage_value = 'Salvage value cannot exceed asset purchase cost';
    }
  }

  if (input.useful_life_months !== undefined && input.useful_life_months !== null) {
    const months = Number(input.useful_life_months);
    if (isNaN(months) || !Number.isInteger(months) || months < 0) {
      errors.useful_life_months = 'Useful life must be a non-negative integer in months';
    }
  }

  if (input.rate !== undefined && input.rate !== null) {
    const r = Number(input.rate);
    if (isNaN(r) || r < 0) {
      errors.rate = 'Depreciation rate must be a non-negative percentage';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

// 2. Warranty Validation
export function validateWarranty(
  input: Partial<CreateWarrantyInput & { provider?: string }>
): ValidationResult {
  const errors: Record<string, string> = {};

  const provider = input.provider_name || input.provider;
  if (!provider || provider.trim().length === 0) {
    errors.provider = 'Warranty provider or manufacturer name is required';
    errors.provider_name = 'Warranty provider or manufacturer name is required';
  }

  if (input.end_date && input.start_date && input.end_date < input.start_date) {
    errors.end_date = 'Warranty expiration date cannot be before start date';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

// 3. Contract Validation
export function validateContract(input: Partial<CreateContractInput>): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.contract_number || input.contract_number.trim().length === 0) {
    errors.contract_number = 'Contract number is required';
  }

  if (!input.title || input.title.trim().length === 0) {
    errors.title = 'Contract title is required';
  } else if (input.title.trim().length < 2) {
    errors.title = 'Contract title must be at least 2 characters';
  }

  if (input.start_date && input.end_date && input.end_date < input.start_date) {
    errors.end_date = 'Contract end date cannot be before start date';
  }

  if (input.contract_value !== undefined && input.contract_value !== null) {
    const val = Number(input.contract_value);
    if (isNaN(val) || val < 0) {
      errors.contract_value = 'Contract value must be a non-negative number';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

// 4. Software License Validation
export function validateLicense(input: Partial<CreateLicenseInput>): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.software_name || input.software_name.trim().length === 0) {
    errors.software_name = 'Software or product name is required';
  }

  if (input.purchased_quantity === undefined || input.purchased_quantity === null) {
    errors.purchased_quantity = 'Purchased quantity is required';
  } else {
    const qty = Number(input.purchased_quantity);
    if (isNaN(qty) || !Number.isInteger(qty) || qty <= 0) {
      errors.purchased_quantity = 'Purchased quantity must be a positive integer';
    }
  }

  if (input.purchase_cost !== undefined && input.purchase_cost !== null) {
    const cost = Number(input.purchase_cost);
    if (isNaN(cost) || cost < 0) {
      errors.purchase_cost = 'Purchase cost must be a non-negative number';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateLicenseAllocation(
  input: Partial<AllocateLicenseInput & { asset_id?: string; employee_id?: string }>,
  availableQuantity?: number
): ValidationResult {
  const errors: Record<string, string> = {};

  const hasAsset = Boolean(input.asset_id && input.asset_id.trim().length > 0);
  const hasEmp = Boolean(input.employee_id && input.employee_id.trim().length > 0);

  if (!hasAsset && !hasEmp && !input.allocation_type) {
    errors.target = 'Must specify either asset_id or employee_id';
  } else if (hasAsset && hasEmp) {
    errors.target = 'Cannot allocate to both asset and employee simultaneously';
  }

  if (availableQuantity !== undefined && availableQuantity <= 0) {
    errors.quantity = 'No license seats available to allocate (purchased quota reached)';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

// 5. Insurance Policy Validation
export function validateInsurancePolicy(
  input: Partial<CreateInsurancePolicyInput & { end_date?: string }>
): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.policy_number || input.policy_number.trim().length === 0) {
    errors.policy_number = 'Insurance policy number is required';
  }

  if (!input.provider || input.provider.trim().length === 0) {
    errors.provider = 'Insurance provider name is required';
  }

  const effectiveExpiry = input.expiry_date || input.end_date;
  if (effectiveExpiry && input.start_date && effectiveExpiry < input.start_date) {
    errors.end_date = 'Insurance expiry date cannot be before start date';
    errors.expiry_date = 'Insurance expiry date cannot be before start date';
  }

  if (input.insured_value !== undefined && input.insured_value !== null) {
    const val = Number(input.insured_value);
    if (isNaN(val) || val < 0) {
      errors.insured_value = 'Insured value must be a non-negative number';
    }
  }

  if (input.premium !== undefined && input.premium !== null) {
    const p = Number(input.premium);
    if (isNaN(p) || p < 0) {
      errors.premium = 'Insurance premium must be a non-negative number';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

// 6. Asset Purchase / Funding Information Validation
export function validateAssetPurchase(input: Partial<UpsertAssetPurchaseInput>): ValidationResult {
  const errors: Record<string, string> = {};

  if (input.purchase_cost !== undefined && input.purchase_cost !== null) {
    const cost = Number(input.purchase_cost);
    if (isNaN(cost) || cost < 0) {
      errors.purchase_cost = 'Purchase cost must be a non-negative number';
    }
  }

  const allowedSources = [
    'Company Purchase',
    'Department Budget',
    'Grant',
    'Donation',
    'Finance',
    'Lease',
    'Other',
  ];
  if (input.funding_source && !allowedSources.includes(input.funding_source)) {
    errors.funding_source = 'Valid funding source is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

// 7. Document Metadata Validation
export function validateDocumentMetadata(input: Partial<CreateDocumentInput>): ValidationResult {
  const errors: Record<string, string> = {};

  const allowedEntities = ['ASSET', 'WARRANTY', 'CONTRACT', 'INSURANCE', 'LICENSE', 'MAINTENANCE', 'PURCHASE'];
  if (!input.entity_type || !allowedEntities.includes(input.entity_type)) {
    errors.entity_type = 'Valid entity type is required';
  }

  if (!input.entity_id || input.entity_id.trim().length === 0) {
    errors.entity_id = 'Entity ID is required';
  }

  if (!input.original_filename || input.original_filename.trim().length === 0) {
    errors.original_filename = 'File name is required';
  }

  if (input.file_size === undefined || input.file_size === null || Number(input.file_size) < 0) {
    errors.file_size = 'File size must be a non-negative number';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

// 8. Custom Field Definition Validation
export function validateCustomFieldDefinition(input: Partial<CreateCustomFieldDefinitionInput>): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.field_name || input.field_name.trim().length === 0) {
    errors.field_name = 'Custom field name is required';
  } else if (input.field_name.trim().length < 2) {
    errors.field_name = 'Field name must be at least 2 characters';
  } else if (input.field_name.trim().length > 50) {
    errors.field_name = 'Field name cannot exceed 50 characters';
  }

  const allowedTypes = ['Text', 'Number', 'Date', 'Yes/No', 'Dropdown'];
  if (!input.field_type || !allowedTypes.includes(input.field_type)) {
    errors.field_type = 'Valid field type (Text, Number, Date, Yes/No, Dropdown) is required';
  }

  if (input.field_type === 'Dropdown') {
    if (!input.dropdown_choices || !Array.isArray(input.dropdown_choices) || input.dropdown_choices.length === 0) {
      errors.dropdown_choices = 'Dropdown custom fields require at least one choice';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateCustomFieldValue(
  def: { field_type: string; is_required?: boolean; dropdown_choices?: string[] | null },
  val: unknown
): ValidationResult {
  const errors: Record<string, string> = {};

  const isNil = val === null || val === undefined || (typeof val === 'string' && val.trim() === '');
  if (def.is_required && isNil) {
    errors.value = 'This custom field is required';
    return { isValid: false, errors };
  }

  if (isNil) {
    return { isValid: true, errors: {} };
  }

  if (def.field_type === 'Number') {
    const num = Number(val);
    if (isNaN(num)) {
      errors.value = 'Value must be a valid number';
    }
  } else if (def.field_type === 'Date') {
    const d = new Date(String(val));
    if (isNaN(d.getTime())) {
      errors.value = 'Value must be a valid date';
    }
  } else if (def.field_type === 'Dropdown') {
    if (def.dropdown_choices && !def.dropdown_choices.includes(String(val))) {
      errors.value = `Value must be one of: ${def.dropdown_choices.join(', ')}`;
    }
  } else if (def.field_type === 'Yes/No') {
    const s = String(val).toLowerCase();
    if (!['true', 'false', 'yes', 'no', '1', '0'].includes(s)) {
      errors.value = 'Value must be Yes or No';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

// ============================================================================
// PHASE 6 VALIDATORS: USERS, INVITATIONS, SETTINGS, CSV SECURITY & IMPORT
// ============================================================================

// 1. User Invitations Validation
export function validateInvitation(input: { email?: string; role?: string; employee_id?: string | null }): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.email || input.email.trim().length === 0) {
    errors.email = 'Invitation email is required';
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email.trim())) {
      errors.email = 'Invalid email address format';
    }
  }

  const validRoles = ['TENANT_ADMIN', 'TECHNICIAN', 'MEMBER'];
  if (!input.role || !validRoles.includes(input.role)) {
    errors.role = 'Valid role (TENANT_ADMIN, TECHNICIAN, MEMBER) is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

// 2. Tenant Settings Validation
export function validateTenantSettings(input: {
  company_name?: string;
  timezone?: string;
  default_currency?: string;
  date_format?: string;
  asset_tag_prefix?: string;
  asset_tag_next_number?: number;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (input.company_name !== undefined) {
    if (!input.company_name || input.company_name.trim().length < 2) {
      errors.company_name = 'Company name must be at least 2 characters';
    }
  }

  if (input.default_currency !== undefined) {
    if (!input.default_currency || input.default_currency.trim().length < 2 || input.default_currency.trim().length > 5) {
      errors.default_currency = 'Currency code must be 2 to 5 characters (e.g. USD, EUR, GBP)';
    }
  }

  if (input.asset_tag_prefix !== undefined) {
    if (!input.asset_tag_prefix || input.asset_tag_prefix.trim().length === 0) {
      errors.asset_tag_prefix = 'Asset tag prefix is required';
    } else if (input.asset_tag_prefix.trim().length > 10) {
      errors.asset_tag_prefix = 'Asset tag prefix cannot exceed 10 characters';
    }
  }

  if (input.asset_tag_next_number !== undefined) {
    const num = Number(input.asset_tag_next_number);
    if (isNaN(num) || num < 1) {
      errors.asset_tag_next_number = 'Asset tag starting number must be at least 1';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

// 3. Formula Injection Sanitizer for CSV Export
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str = String(value);

  // Strip carriage returns
  str = str.replace(/\r/g, '');

  // Prevent spreadsheet formula injection (=, +, -, @, tab, newline)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape quotes if string contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export function buildSafeCsv(headers: string[], rows: Record<string, any>[], columnKeys: string[]): string {
  const headerRow = headers.map(sanitizeCsvCell).join(',');
  const dataRows = rows.map((row) =>
    columnKeys.map((key) => sanitizeCsvCell(row[key])).join(',')
  );
  return [headerRow, ...dataRows].join('\n');
}

// 4. CSV Import Row Validation
export function validateImportRow(
  target: 'ASSETS' | 'EMPLOYEES' | 'INVENTORY',
  row: Record<string, any>
): { isValid: boolean; errors: string[]; parsed: Record<string, any> } {
  const errors: string[] = [];
  const parsed: Record<string, any> = { ...row };

  if (target === 'ASSETS') {
    const name = row.name || row.asset_name || row['Asset Name'] || row.Name;
    if (!name || String(name).trim().length < 2) {
      errors.push('Asset name must be at least 2 characters');
    } else {
      parsed.name = String(name).trim();
    }

    const tag = row.asset_tag || row['Asset Tag'] || row.tag;
    if (tag && String(tag).trim().length > 0) {
      parsed.asset_tag = String(tag).trim();
    }

    const cost = row.purchase_cost || row.cost || row['Purchase Cost'];
    if (cost !== undefined && cost !== '') {
      const num = Number(cost);
      if (isNaN(num) || num < 0) {
        errors.push('Purchase cost must be a non-negative number');
      } else {
        parsed.purchase_cost = num;
      }
    }

    const status = row.status || row.Status;
    if (status) {
      const allowed = ['Available', 'Checked Out', 'In Maintenance', 'Disposed', 'Reserved', 'Leased'];
      if (!allowed.includes(String(status).trim())) {
        errors.push(`Status must be one of: ${allowed.join(', ')}`);
      } else {
        parsed.status = String(status).trim();
      }
    }
  } else if (target === 'EMPLOYEES') {
    const fullName = row.full_name || row.name || row['Full Name'] || row.FullName;
    if (!fullName || String(fullName).trim().length < 2) {
      errors.push('Full name is required (minimum 2 characters)');
    } else {
      parsed.full_name = String(fullName).trim();
    }

    const code = row.employee_code || row.code || row['Employee Code'];
    if (code && String(code).trim().length > 0) {
      parsed.employee_code = String(code).trim();
    }

    const email = row.email || row['Email'] || row.Email;
    if (email && String(email).trim().length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(String(email).trim())) {
        errors.push('Invalid email format');
      } else {
        parsed.email = String(email).trim().toLowerCase();
      }
    }
  } else if (target === 'INVENTORY') {
    const sku = row.sku || row.SKU || row['Part Number'];
    if (!sku || String(sku).trim().length < 2) {
      errors.push('SKU is required (minimum 2 characters)');
    } else {
      parsed.sku = String(sku).trim();
    }

    const name = row.name || row.item_name || row['Item Name'];
    if (!name || String(name).trim().length < 2) {
      errors.push('Item name is required (minimum 2 characters)');
    } else {
      parsed.name = String(name).trim();
    }

    const qty = row.quantity_on_hand || row.quantity || row['Quantity'];
    if (qty !== undefined && qty !== '') {
      const num = Number(qty);
      if (isNaN(num) || num < 0) {
        errors.push('Quantity must be a non-negative number');
      } else {
        parsed.quantity_on_hand = num;
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    parsed,
  };
}

// ============================================================================
// PHASE 7: STORAGE UPLOAD & FILENAME SANITIZATION
// ============================================================================

export function sanitizeFilename(rawFilename: string): string {
  if (!rawFilename) return 'file.bin';

  // Strip null bytes and control characters
  let clean = rawFilename.replace(/[\0\x00-\x1F\x7F]/g, '');

  // Strip directory paths and traversal (Unix / and Windows \)
  clean = clean.split('/').pop() || '';
  clean = clean.split('\\').pop() || '';

  // Remove dangerous characters
  clean = clean.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Prevent hidden file names (.bashrc) and double dots (..)
  clean = clean.replace(/^\.+/, '');
  clean = clean.replace(/\.{2,}/g, '.');

  if (!clean || clean === '.') {
    clean = `upload_${Date.now()}.bin`;
  }

  // Max 100 characters
  if (clean.length > 100) {
    const ext = clean.includes('.') ? '.' + clean.split('.').pop() : '';
    clean = clean.slice(0, 100 - ext.length) + ext;
  }

  return clean;
}

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.ms-excel',
];

export const ALLOWED_LOGO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
];

export function validateStorageUpload(
  fileMeta: { filename: string; size: number; mimeType?: string },
  type: 'DOCUMENT' | 'LOGO' = 'DOCUMENT'
): ValidationResult {
  const errors: Record<string, string> = {};

  if (!fileMeta.filename || fileMeta.filename.trim().length === 0) {
    errors.filename = 'Filename is required';
  }

  const maxSize = type === 'LOGO' ? 2 * 1024 * 1024 : 25 * 1024 * 1024; // 2MB for logo, 25MB for docs
  if (fileMeta.size <= 0) {
    errors.size = 'File cannot be empty';
  } else if (fileMeta.size > maxSize) {
    errors.size = `File size (${(fileMeta.size / (1024 * 1024)).toFixed(1)}MB) exceeds the maximum limit of ${maxSize / (1024 * 1024)}MB`;
  }

  const allowedMimes = type === 'LOGO' ? ALLOWED_LOGO_MIME_TYPES : ALLOWED_DOCUMENT_MIME_TYPES;
  if (fileMeta.mimeType && !allowedMimes.includes(fileMeta.mimeType.toLowerCase())) {
    errors.mimeType = `File type "${fileMeta.mimeType}" is not permitted. Allowed types: ${type === 'LOGO' ? 'PNG, JPG, WebP, SVG' : 'PDF, JPEG, PNG, WebP, SVG, DOCX, XLSX, CSV, TXT'}`;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateAkshigoHandoffPayload(input: {
  tenant_name?: string;
  admin_email?: string;
  plan?: string;
  subscription_id?: string;
  timestamp?: number;
  signature?: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.tenant_name || input.tenant_name.trim().length < 2) {
    errors.tenant_name = 'Tenant organization name must be at least 2 characters';
  }

  if (!input.admin_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.admin_email.trim())) {
    errors.admin_email = 'Valid administrator email address required';
  }

  if (!input.subscription_id || input.subscription_id.trim().length < 3) {
    errors.subscription_id = 'Valid Akshigo subscription identifier required';
  }

  const allowedPlans = ['BASIC', 'PRO', 'ENTERPRISE'];
  if (!input.plan || !allowedPlans.includes(input.plan)) {
    errors.plan = 'Valid plan tier required (BASIC, PRO, ENTERPRISE)';
  }

  if (!input.signature || input.signature.trim().length < 16) {
    errors.signature = 'Cryptographic HMAC signature required';
  }

  if (!input.timestamp || typeof input.timestamp !== 'number') {
    errors.timestamp = 'Handoff timestamp required';
  } else {
    const ageSeconds = Math.abs(Date.now() - input.timestamp) / 1000;
    if (ageSeconds > 300) {
      // 5 minutes expiry
      errors.timestamp = 'Handoff token expired (exceeds 5 minute validity window)';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export async function generateAkshigoHandoffSignature(
  secret: string,
  payload: {
    timestamp: number;
    tenant_name: string;
    admin_email: string;
    plan: string;
    subscription_id: string;
  }
): Promise<string> {
  const canonical = `${payload.timestamp}.${payload.tenant_name.trim()}.${payload.admin_email.trim().toLowerCase()}.${payload.plan}.${payload.subscription_id.trim()}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(canonical));
  return Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyAkshigoHandoffSignature(
  secret: string,
  payload: {
    timestamp: number;
    tenant_name: string;
    admin_email: string;
    plan: string;
    subscription_id: string;
    signature: string;
  }
): Promise<boolean> {
  if (!payload.signature || typeof payload.signature !== 'string') return false;
  const canonical = `${payload.timestamp}.${payload.tenant_name.trim()}.${payload.admin_email.trim().toLowerCase()}.${payload.plan}.${payload.subscription_id.trim()}`;
  const enc = new TextEncoder();
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const sigBytes = new Uint8Array(
      payload.signature.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
    );
    if (sigBytes.length !== 32) return false;
    return await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(canonical));
  } catch {
    return false;
  }
}

export async function hashHandoffNonce(signature: string): Promise<string> {
  const enc = new TextEncoder();
  const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(signature));
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function consumeDurableNonce(
  client: { from: (table: string) => any },
  signature: string,
  timestamp: number
): Promise<{ isReplay: boolean; error?: string }> {
  try {
    const nonceHash = await hashHandoffNonce(signature);
    const expiresAt = new Date(timestamp + 300000).toISOString();

    const { error } = await client
      .from('consumed_handoff_nonces')
      .insert({
        nonce_hash: nonceHash,
        consumed_at: new Date().toISOString(),
        expires_at: expiresAt,
      });

    if (error) {
      const isUniqueViolation =
        error.code === '23505' ||
        error.message?.toLowerCase().includes('unique') ||
        error.message?.toLowerCase().includes('duplicate') ||
        error.message?.toLowerCase().includes('conflict');

      if (isUniqueViolation) {
        return { isReplay: true };
      }
      return { isReplay: false, error: error.message };
    }

    return { isReplay: false };
  } catch (err: any) {
    return { isReplay: false, error: err?.message || 'Database error during durable nonce check' };
  }
}


