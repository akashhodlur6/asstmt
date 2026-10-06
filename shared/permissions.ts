/**
 * AssetMT - Centralized Role-Based Access Control (RBAC) & Quota Rules
 * Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
 */

import { UserRole } from './types.ts';

export const ROLES: Record<string, UserRole> = {
  TENANT_ADMIN: 'TENANT_ADMIN',
  TECHNICIAN: 'TECHNICIAN',
  MEMBER: 'MEMBER',
};

// Hierarchy level for comparative permission checking
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  TENANT_ADMIN: 30,
  TECHNICIAN: 20,
  MEMBER: 10,
};

export function isTenantAdmin(role: string | null | undefined): boolean {
  return role === 'TENANT_ADMIN';
}

export function isTechnician(role: string | null | undefined): boolean {
  return role === 'TECHNICIAN';
}

export function isMember(role: string | null | undefined): boolean {
  return role === 'MEMBER';
}

/**
 * Administrative Permissions (Tenant Admin Only)
 */
export function canManageUsers(role: string | null | undefined): boolean {
  return isTenantAdmin(role);
}

export function canManageSettings(role: string | null | undefined): boolean {
  return isTenantAdmin(role);
}

export function canImportData(role: string | null | undefined): boolean {
  return isTenantAdmin(role);
}

export function canDisposeAsset(role: string | null | undefined): boolean {
  return isTenantAdmin(role);
}

export function canConfigureFinancials(role: string | null | undefined): boolean {
  return isTenantAdmin(role);
}

export function canManageAudits(role: string | null | undefined): boolean {
  return isTenantAdmin(role);
}

/**
 * Operational Permissions (Tenant Admin & Technician)
 */
export function canPerformCustody(role: string | null | undefined): boolean {
  return role === 'TENANT_ADMIN' || role === 'TECHNICIAN';
}

export function canPerformMaintenance(role: string | null | undefined): boolean {
  return role === 'TENANT_ADMIN' || role === 'TECHNICIAN';
}

export function canManageInventory(role: string | null | undefined): boolean {
  return role === 'TENANT_ADMIN' || role === 'TECHNICIAN';
}

export function canMoveAsset(role: string | null | undefined): boolean {
  return role === 'TENANT_ADMIN' || role === 'TECHNICIAN';
}

export function canCreateAsset(role: string | null | undefined): boolean {
  return role === 'TENANT_ADMIN' || role === 'TECHNICIAN';
}

export function canUpdateAsset(role: string | null | undefined): boolean {
  return role === 'TENANT_ADMIN' || role === 'TECHNICIAN';
}

export function canScanAudits(role: string | null | undefined): boolean {
  return role === 'TENANT_ADMIN' || role === 'TECHNICIAN';
}

/**
 * Read & Compliance Permissions
 */
export function canViewReports(role: string | null | undefined): boolean {
  return Boolean(role);
}

export function canExportReports(role: string | null | undefined): boolean {
  return Boolean(role);
}

export function canViewAuditLog(role: string | null | undefined): boolean {
  return role === 'TENANT_ADMIN' || role === 'TECHNICIAN';
}

/**
 * Basic Plan Quotas
 */
export interface PlanQuotas {
  maxAssets: number;
  maxTenantAdmins: number;
  maxTechnicians: number;
  maxEmployees: number; // Infinity
}

export const BASIC_PLAN_QUOTAS: PlanQuotas = {
  maxAssets: 500,
  maxTenantAdmins: 1,
  maxTechnicians: 1,
  maxEmployees: Infinity,
};

export const PRO_PLAN_QUOTAS: PlanQuotas = {
  maxAssets: 5000,
  maxTenantAdmins: 5,
  maxTechnicians: 10,
  maxEmployees: Infinity,
};

export const ENTERPRISE_PLAN_QUOTAS: PlanQuotas = {
  maxAssets: 100000,
  maxTenantAdmins: 50,
  maxTechnicians: 200,
  maxEmployees: Infinity,
};

export function getPlanQuotas(plan: string | null | undefined): PlanQuotas {
  if (plan === 'PRO') return PRO_PLAN_QUOTAS;
  if (plan === 'ENTERPRISE') return ENTERPRISE_PLAN_QUOTAS;
  return BASIC_PLAN_QUOTAS;
}

/**
 * Subscription Lifecycle & State Verification
 */
export function isTenantSuspended(status: string | null | undefined): boolean {
  return status === 'SUSPENDED';
}

export function isTenantPastDue(status: string | null | undefined): boolean {
  return status === 'PAST_DUE';
}

export function isTenantCancelled(status: string | null | undefined): boolean {
  return status === 'CANCELLED';
}

export function canMutateTenantBusinessData(status: string | null | undefined): boolean {
  // Only ACTIVE and TRIAL tenants can create or modify business resources
  if (!status) return true; // Default fallback to active if unconfigured
  return status === 'ACTIVE' || status === 'TRIAL';
}

/**
 * Plan Quota Boundary Checks
 */
export function isAssetCreationAllowed(currentAssetCount: number, maxAssetsLimit: number): boolean {
  return currentAssetCount < maxAssetsLimit;
}

export function isTenantAdminCreationAllowed(currentAdminCount: number, plan: string | null | undefined): boolean {
  const quotas = getPlanQuotas(plan);
  return currentAdminCount < quotas.maxTenantAdmins;
}

export function isTechnicianCreationAllowed(currentTechCount: number, plan: string | null | undefined): boolean {
  const quotas = getPlanQuotas(plan);
  return currentTechCount < quotas.maxTechnicians;
}

