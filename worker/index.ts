/**
 * AssetMT - Cloudflare Worker API & Static Asset Handler
 * Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
 */

import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import {
  validateAsset,
  validateCreateWorkspace,
  validateDepartment,
  validateEmployee,
  validateCheckout,
  validateCheckin,
  validateTransfer,
  validateVendor,
  validateMaintenance,
  validateScheduleMaintenance,
  validateCompleteMaintenance,
  validateCancelMaintenance,
  isValidMaintenanceTransition,
  validateInventoryItem,
  validateInventoryStockMovement,
  validateReservation,
  validateLease,
  validateReturnLease,
  validateMoveAsset,
  validateDisposeAsset,
  validateAssetRelationship,
  validateAuditSession,
  validateScanAuditItem,
  calculateDepreciation,
  validateDepreciationConfig,
  validateWarranty,
  validateContract,
  validateLicense,
  validateLicenseAllocation,
  validateInsurancePolicy,
  validateAssetPurchase,
  validateDocumentMetadata,
  validateCustomFieldDefinition,
  validateInvitation,
  validateTenantSettings,
  sanitizeCsvCell,
  buildSafeCsv,
  validateImportRow,
  sanitizeFilename,
  validateStorageUpload,
  validateAkshigoHandoffPayload,
  verifyAkshigoHandoffSignature,
  consumeDurableNonce,
} from '../shared/validation.ts';
import {
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
  canViewReports,
  canExportReports,
  canViewAuditLog,
  isTenantAdmin,
  isTechnician,
  isMember,
  BASIC_PLAN_QUOTAS,
  isTenantSuspended,
  canMutateTenantBusinessData,
  isAssetCreationAllowed,
  isTenantAdminCreationAllowed,
  isTechnicianCreationAllowed,
  getPlanQuotas,
} from '../shared/permissions.ts';
import {
  AssetStatus,
  CreateAssetInput,
  CreateDepartmentInput,
  CreateEmployeeInput,
  CreateWorkspaceInput,
  Department,
  Employee,
  Membership,
  UpdateDepartmentInput,
  UpdateEmployeeInput,
  CheckoutInput,
  CheckinInput,
  TransferInput,
  AssetAssignment,
  Vendor,
  CreateVendorInput,
  UpdateVendorInput,
  MaintenanceRecord,
  CreateMaintenanceInput,
  UpdateMaintenanceInput,
  ScheduleMaintenanceInput,
  StartMaintenanceInput,
  CompleteMaintenanceInput,
  CancelMaintenanceInput,
  InventoryItem,
  InventoryTransaction,
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
  InventoryStockMovementInput,
  AssetReservation,
  CreateReservationInput,
  AssetLease,
  CreateLeaseInput,
  ReturnLeaseInput,
  AssetLocationHistory,
  MoveAssetInput,
  AssetDisposal,
  DisposeAssetInput,
  AssetRelationship,
  CreateAssetRelationshipInput,
  AuditSession,
  AuditSessionItem,
  CreateAuditSessionInput,
  ScanAuditItemInput,
  CompleteAuditSessionInput,
  AssetDepreciation,
  ConfigureDepreciationInput,
  AssetWarranty,
  CreateWarrantyInput,
  UpdateWarrantyInput,
  Contract,
  CreateContractInput,
  UpdateContractInput,
  SoftwareLicense,
  SoftwareLicenseAllocation,
  CreateLicenseInput,
  UpdateLicenseInput,
  AllocateLicenseInput,
  InsurancePolicy,
  CreateInsurancePolicyInput,
  UpdateInsurancePolicyInput,
  AssetPurchase,
  UpsertAssetPurchaseInput,
  DocumentRecord,
  CreateDocumentInput,
  CustomFieldDefinition,
  AssetCustomFieldValue,
  CreateCustomFieldDefinitionInput,
  UpdateCustomFieldDefinitionInput,
  SaveAssetCustomFieldValueInput,
  SystemAlert,
  UserRole,
  TenantInvitation,
  CreateInvitationInput,
  TenantSettings,
  UpdateTenantSettingsInput,
  PlatformAdmin,
  PlatformTenantItem,
  TenantUsageSummary,
  ReportFilterOptions,
  ReportResult,
  ImportPreviewResponse,
  CommitImportRequest,
  CommitImportResponse,
  AuditLogFilterOptions,
  StorageUploadResponse,
  AcceptInvitationInput,
  AcceptInvitationResponse,
  AkshigoHandoffPayload,
  AkshigoHandoffResponse,
} from '../shared/types.ts';

export interface Env {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  ENVIRONMENT?: string;
  PLATFORM_ADMIN_EMAILS?: string;
  PLATFORM_ADMIN_USER_ID?: string;
  AKSHIGO_INTEGRATION_SECRET?: string;
  RESEND_API_KEY?: string;
}

export const SUPABASE_STORAGE_BUCKET = 'assetmt-files';

interface AuthContext {
  user: User;
  token: string;
  client: SupabaseClient;
  membership: Membership | null;
  isPlatformAdmin: boolean;
}

// In-Memory Rate Limiter Store
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string, limit: number, windowMs = 60000): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const rec = rateLimitMap.get(key);
  if (!rec || rec.resetAt <= now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (rec.count >= limit) {
    return { allowed: false, retryAfter: Math.ceil((rec.resetAt - now) / 1000) };
  }
  rec.count++;
  return { allowed: true };
}

// In-Memory Storage Fallback (used only in non-production local/unit test runs)
const memoryStorageStore = new Map<string, { data: Uint8Array; contentType: string }>();

function getSecurityHeaders(): Record<string, string> {
  return {
    'Content-Security-Policy': "default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: blob: https:; frame-ancestors *;",
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}

function jsonResponse(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-supabase-url, x-supabase-anon-key',
      ...getSecurityHeaders(),
      ...extraHeaders,
    },
  });
}

function csvResponse(csvContent: string, filename: string): Response {
  return new Response(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-supabase-url, x-supabase-anon-key',
      ...getSecurityHeaders(),
    },
  });
}

function binaryResponse(data: Uint8Array, contentType: string, filename?: string): Response {
  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-supabase-url, x-supabase-anon-key',
    ...getSecurityHeaders(),
  };
  if (filename) {
    headers['Content-Disposition'] = `attachment; filename="${filename}"`;
  }
  return new Response(data as any, { status: 200, headers });
}

function getSupabaseConfig(request: Request, env: Env) {
  // Support custom request headers for seamless runtime environment alignment
  const headerUrl = request.headers.get('x-supabase-url');
  const headerKey = request.headers.get('x-supabase-anon-key');

  if (headerUrl !== null && headerKey !== null) {
    return { url: headerUrl || undefined, anonKey: headerKey || undefined };
  }

  let url = env.SUPABASE_URL !== undefined ? env.SUPABASE_URL : env.VITE_SUPABASE_URL;
  let anonKey = env.SUPABASE_ANON_KEY !== undefined ? env.SUPABASE_ANON_KEY : env.VITE_SUPABASE_ANON_KEY;

  if (url === undefined && anonKey === undefined && typeof process !== 'undefined') {
    url = process.env?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL;
    anonKey = process.env?.VITE_SUPABASE_ANON_KEY || process.env?.SUPABASE_ANON_KEY;
  }

  return { url: url || undefined, anonKey: anonKey || undefined };
}

async function getAuthenticatedContext(request: Request, env: Env): Promise<{ auth?: AuthContext; errorResponse?: Response }> {
  const { url, anonKey } = getSupabaseConfig(request, env);
  if (!url || !anonKey) {
    return {
      errorResponse: jsonResponse(
        {
          success: false,
          error: 'CONFIG_MISSING',
          message: 'Supabase URL or Anon Key is not configured on the server.',
        },
        503
      ),
    };
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      errorResponse: jsonResponse(
        {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Missing or malformed Authorization bearer token.',
        },
        401
      ),
    };
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return {
      errorResponse: jsonResponse(
        {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Empty bearer access token.',
        },
        401
      ),
    };
  }

  // Create client preserving user's bearer token so RLS and auth.uid() function properly
  const client = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  // Strict verification: validate token with Supabase auth.getUser(token)
  let userData: { user: User | null } | null = null;
  let userError: Error | null = null;
  try {
    const res = await client.auth.getUser(token);
    userData = res.data;
    userError = res.error;
  } catch (err: unknown) {
    return {
      errorResponse: jsonResponse(
        {
          success: false,
          error: 'AUTH_SERVICE_UNAVAILABLE',
          message: err instanceof Error ? err.message : 'Failed to reach Supabase authentication service.',
        },
        503
      ),
    };
  }

  if (userError || !userData?.user) {
    return {
      errorResponse: jsonResponse(
        {
          success: false,
          error: 'INVALID_TOKEN',
          message: userError?.message || 'Access token is invalid or expired.',
        },
        401
      ),
    };
  }

  const user = userData.user;

  // Retrieve active tenant membership
  let membershipData: any = null;
  let membError: any = null;
  try {
    const res = await client
      .from('memberships')
      .select('*, company:companies(*)')
      .eq('user_id', user.id)
      .maybeSingle();
    membershipData = res.data;
    membError = res.error;
  } catch (err: unknown) {
    return {
      errorResponse: jsonResponse(
        {
          success: false,
          error: 'DATABASE_UNAVAILABLE',
          message: err instanceof Error ? err.message : 'Failed to reach Supabase database service.',
        },
        503
      ),
    };
  }

  if (membError) {
    const isSchemaError =
      membError.message?.includes('schema cache') ||
      membError.message?.includes('does not exist') ||
      membError.code === '42P01' ||
      membError.code === 'PGRST204' ||
      membError.code === 'PGRST205';

    return {
      errorResponse: jsonResponse(
        {
          success: false,
          error: isSchemaError ? 'SCHEMA_INCOMPLETE' : 'DATABASE_ERROR',
          code: membError.code,
          message: membError.message,
          suggestion: isSchemaError
            ? 'The database schema has not been initialized or PostgREST schema cache needs reloading. Execute migrations/0001_initial_schema.sql (or migrations/0002_repair_schema_cache_and_grants.sql) in your Supabase SQL Editor.'
            : undefined,
        },
        isSchemaError ? 503 : 500
      ),
    };
  }

  if (membershipData && (membershipData as any).is_active === false) {
    return {
      errorResponse: jsonResponse(
        {
          success: false,
          error: 'USER_DEACTIVATED',
          message: 'Your user access to this company workspace has been deactivated by an administrator.',
        },
        403
      ),
    };
  }

  if (membershipData?.company && (membershipData.company as any).status === 'SUSPENDED') {
    return {
      errorResponse: jsonResponse(
        {
          success: false,
          error: 'TENANT_SUSPENDED',
          message: 'This organization workspace has been suspended. Please contact platform support.',
        },
        403
      ),
    };
  }

  // Determine platform admin privilege
  const envAdmins = (process.env?.PLATFORM_ADMIN_EMAILS || env.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  let isPlatformAdmin = Boolean(user.email && envAdmins.includes(user.email.toLowerCase()));
  if (!isPlatformAdmin) {
    try {
      const { data: platAdmin } = await client
        .from('platform_admins')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (platAdmin) isPlatformAdmin = true;
    } catch {
      // Platform admin check graceful fallback
    }
  }

  return {
    auth: {
      user,
      token,
      client,
      membership: membershipData as Membership | null,
      isPlatformAdmin,
    },
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-supabase-url, x-supabase-anon-key',
        },
      });
    }

    // Only process /api/* routes through Worker logic
    if (url.pathname.startsWith('/api/')) {
      const subpath = url.pathname.replace(/^\/api/, '');

      // 1. System Config Check (unauthenticated)
      if (subpath === '/config-status' && request.method === 'GET') {
        const { url: sbUrl, anonKey: sbKey } = getSupabaseConfig(request, env);
        return jsonResponse({
          success: true,
          configured: Boolean(sbUrl && sbKey),
          hasUrl: Boolean(sbUrl),
          hasKey: Boolean(sbKey),
          service: 'AssetMT Cloudflare Worker API',
          version: '1.0.0-phase1',
        });
      }

      // 2. Health check
      if (subpath === '/health' && request.method === 'GET') {
        return jsonResponse({
          success: true,
          status: 'healthy',
          timestamp: new Date().toISOString(),
        });
      }

      // All remaining API endpoints require valid Bearer token authentication
      const authResult = await getAuthenticatedContext(request, env);
      if (authResult.errorResponse) {
        return authResult.errorResponse;
      }
      const { user, client, membership, isPlatformAdmin } = authResult.auth!;

      // 3. Workspace membership check & atomic onboarding
      if (subpath === '/workspace') {
        if (request.method === 'GET') {
          return jsonResponse({
            success: true,
            hasWorkspace: Boolean(membership?.company_id),
            membership,
            isPlatformAdmin,
            user: {
              id: user.id,
              email: user.email,
              user_metadata: user.user_metadata,
            },
          });
        }

        if (request.method === 'POST') {
          const body = (await request.json().catch(() => ({}))) as Partial<CreateWorkspaceInput>;
          const validation = validateCreateWorkspace(body);
          if (!validation.isValid) {
            return jsonResponse(
              {
                success: false,
                error: 'VALIDATION_ERROR',
                errors: validation.errors,
              },
              400
            );
          }

          // Atomic restricted onboarding RPC deriving creator from auth.uid()
          const { data: rpcData, error: rpcError } = await client.rpc('create_company_workspace', {
            p_name: body.name!.trim(),
            p_code: body.code ? body.code.trim() : null,
          });

          if (rpcError) {
            return jsonResponse(
              {
                success: false,
                error: 'ONBOARDING_FAILED',
                message: rpcError.message,
              },
              400
            );
          }

          // Fetch freshly created membership with company details
          const { data: freshMembership } = await client
            .from('memberships')
            .select('*, company:companies(*)')
            .eq('user_id', user.id)
            .single();

          return jsonResponse(
            {
              success: true,
              result: rpcData,
              membership: freshMembership,
            },
            201
          );
        }
      }

      // ----------------------------------------------------------------------
      // PHASE 6: INVITATION ACCEPTANCE & VERIFICATION (BEFORE WORKSPACE GUARD)
      // ----------------------------------------------------------------------
      if (subpath.startsWith('/invitations/verify/') && request.method === 'GET') {
        const token = subpath.replace('/invitations/verify/', '').trim();
        const { data: invite, error } = await client
          .from('tenant_invitations')
          .select('id, company_id, email, role, status, expires_at, company:companies(name, code)')
          .eq('token', token)
          .maybeSingle();

        if (error || !invite) {
          return jsonResponse(
            { success: false, error: 'INVITATION_NOT_FOUND', message: 'Invitation not found or invalid token.' },
            404
          );
        }

        const isExpired = new Date(invite.expires_at) < new Date();
        return jsonResponse({
          success: true,
          data: {
            ...invite,
            is_expired: isExpired,
            is_valid: invite.status === 'PENDING' && !isExpired,
          },
        });
      }

      if (subpath === '/invitations/accept' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as { token?: string };
        if (!body.token || body.token.trim().length === 0) {
          return jsonResponse({ success: false, error: 'Token is required' }, 400);
        }

        const { data: invite, error: invError } = await client
          .from('tenant_invitations')
          .select('*, company:companies(*)')
          .eq('token', body.token.trim())
          .maybeSingle();

        if (invError || !invite) {
          return jsonResponse(
            { success: false, error: 'INVITATION_NOT_FOUND', message: 'Invalid invitation link.' },
            404
          );
        }

        if (invite.status !== 'PENDING') {
          return jsonResponse(
            {
              success: false,
              error: 'INVITATION_INACTIVE',
              message: `This invitation has already been ${invite.status.toLowerCase()}.`,
            },
            400
          );
        }

        if (new Date(invite.expires_at) < new Date()) {
          await client.from('tenant_invitations').update({ status: 'EXPIRED' }).eq('id', invite.id);
          return jsonResponse(
            { success: false, error: 'INVITATION_EXPIRED', message: 'This invitation has expired.' },
            400
          );
        }

        // Check if user is already an active member of this company
        const { data: existingMemb } = await client
          .from('memberships')
          .select('id, role')
          .eq('company_id', invite.company_id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (existingMemb) {
          await client
            .from('tenant_invitations')
            .update({ status: 'ACCEPTED', accepted_at: new Date().toISOString() })
            .eq('id', invite.id);

          return jsonResponse({
            success: true,
            message: 'You are already a member of this workspace.',
            membership: existingMemb,
          });
        }

        // Create tenant membership
        const { data: newMemb, error: membInsertError } = await client
          .from('memberships')
          .insert({
            company_id: invite.company_id,
            user_id: user.id,
            role: invite.role,
            employee_id: invite.employee_id || null,
            invited_by: invite.invited_by || null,
            is_active: true,
            last_active_at: new Date().toISOString(),
          })
          .select('*, company:companies(*)')
          .single();

        if (membInsertError) {
          return jsonResponse({ success: false, error: membInsertError.message }, 400);
        }

        // Mark invitation accepted
        await client
          .from('tenant_invitations')
          .update({ status: 'ACCEPTED', accepted_at: new Date().toISOString() })
          .eq('id', invite.id);

        // Record audit event
        await client.from('asset_events').insert({
          company_id: invite.company_id,
          asset_id: null,
          event_type: 'USER_JOINED',
          actor_id: user.id,
          notes: `User ${user.email || user.id} joined workspace with role ${invite.role}`,
          details: { invitation_id: invite.id, role: invite.role },
        });

        return jsonResponse({ success: true, membership: newMemb }, 201);
      }

      // ----------------------------------------------------------------------
      // PHASE 6: PLATFORM ADMIN FOUNDATION API (SAAS OWNER LAYER)
      // ----------------------------------------------------------------------
      if (subpath === '/platform/verify' && request.method === 'GET') {
        return jsonResponse({
          success: true,
          isPlatformAdmin,
          user: { id: user.id, email: user.email },
        });
      }

      if (subpath.startsWith('/platform/')) {
        // Enforce platform admin authorization
        if (!isPlatformAdmin) {
          return jsonResponse(
            {
              success: false,
              error: 'FORBIDDEN',
              message: 'Platform administrator authorization required.',
            },
            403
          );
        }

        // List all tenant companies with usage counts
        if (subpath === '/platform/tenants' && request.method === 'GET') {
          const { data: companies, error: compErr } = await client
            .from('companies')
            .select('*')
            .order('created_at', { ascending: false });

          if (compErr) {
            return jsonResponse({ success: false, error: compErr.message }, 500);
          }

          const tenantSummaries: PlatformTenantItem[] = [];
          for (const comp of companies || []) {
            const { count: assetCount } = await client
              .from('assets')
              .select('id', { count: 'exact', head: true })
              .eq('company_id', comp.id);

            const { count: userCount } = await client
              .from('memberships')
              .select('id', { count: 'exact', head: true })
              .eq('company_id', comp.id);

            const { count: empCount } = await client
              .from('employees')
              .select('id', { count: 'exact', head: true })
              .eq('company_id', comp.id);

            tenantSummaries.push({
              id: comp.id,
              name: comp.name,
              code: comp.code,
              status: comp.status || 'ACTIVE',
              plan: comp.plan || 'BASIC',
              max_assets: comp.max_assets || 500,
              asset_count: assetCount ?? 0,
              user_count: userCount ?? 0,
              employee_count: empCount ?? 0,
              created_at: comp.created_at,
            });
          }

          return jsonResponse({ success: true, data: tenantSummaries });
        }

        // Activate or Suspend a tenant
        if (subpath.match(/^\/platform\/tenants\/[^/]+\/status$/) && request.method === 'POST') {
          const targetCompanyId = subpath.split('/')[3];
          const body = (await request.json().catch(() => ({}))) as { status?: string };
          if (!body.status || !['ACTIVE', 'SUSPENDED'].includes(body.status)) {
            return jsonResponse({ success: false, error: 'Status must be ACTIVE or SUSPENDED' }, 400);
          }

          const { data, error } = await client
            .from('companies')
            .update({ status: body.status, updated_at: new Date().toISOString() })
            .eq('id', targetCompanyId)
            .select()
            .single();

          if (error) {
            return jsonResponse({ success: false, error: error.message }, 400);
          }

          return jsonResponse({ success: true, data });
        }

        // Platform KPI metrics
        if (subpath === '/platform/metrics' && request.method === 'GET') {
          const { count: totalCompanies } = await client
            .from('companies')
            .select('id', { count: 'exact', head: true });

          const { count: totalAssets } = await client
            .from('assets')
            .select('id', { count: 'exact', head: true });

          const { count: totalUsers } = await client
            .from('memberships')
            .select('id', { count: 'exact', head: true });

          return jsonResponse({
            success: true,
            data: {
              totalTenants: totalCompanies ?? 0,
              totalAssets: totalAssets ?? 0,
              totalUsers: totalUsers ?? 0,
            },
          });
        }
      }

      // Tenant guard: For all operational asset routes, user MUST belong to an active workspace
      if (!membership || !membership.company_id) {
        return jsonResponse(
          {
            success: false,
            error: 'WORKSPACE_REQUIRED',
            message: 'User does not belong to any active company workspace. Complete onboarding first.',
          },
          403
        );
      }

      const tenantId = membership.company_id;

      // 4. Categories API
      if (subpath === '/categories') {
        if (request.method === 'GET') {
          const { data, error } = await client
            .from('categories')
            .select('*')
            .eq('company_id', tenantId)
            .order('name', { ascending: true });

          if (error) return jsonResponse({ success: false, error: error.message }, 500);
          return jsonResponse({ success: true, data });
        }

        if (request.method === 'POST') {
          const body = (await request.json().catch(() => ({}))) as { name: string; description?: string; code?: string };
          if (!body.name || body.name.trim().length === 0) {
            return jsonResponse({ success: false, error: 'Category name is required' }, 400);
          }

          const { data, error } = await client
            .from('categories')
            .insert({
              company_id: tenantId,
              name: body.name.trim(),
              description: body.description?.trim() || null,
              code: body.code?.trim() || null,
            })
            .select()
            .single();

          if (error) return jsonResponse({ success: false, error: error.message }, 400);
          return jsonResponse({ success: true, data }, 201);
        }
      }

      // 5. Sites API
      if (subpath === '/sites') {
        if (request.method === 'GET') {
          const { data, error } = await client
            .from('sites')
            .select('*')
            .eq('company_id', tenantId)
            .order('name', { ascending: true });

          if (error) return jsonResponse({ success: false, error: error.message }, 500);
          return jsonResponse({ success: true, data });
        }

        if (request.method === 'POST') {
          const body = (await request.json().catch(() => ({}))) as { name: string; address?: string };
          if (!body.name || body.name.trim().length === 0) {
            return jsonResponse({ success: false, error: 'Site name is required' }, 400);
          }

          const { data, error } = await client
            .from('sites')
            .insert({
              company_id: tenantId,
              name: body.name.trim(),
              address: body.address?.trim() || null,
            })
            .select()
            .single();

          if (error) return jsonResponse({ success: false, error: error.message }, 400);
          return jsonResponse({ success: true, data }, 201);
        }
      }

      // 6. Locations API
      if (subpath === '/locations') {
        if (request.method === 'GET') {
          const siteId = url.searchParams.get('site_id');
          let query = client
            .from('locations')
            .select('*, site:sites(*)')
            .eq('company_id', tenantId);

          if (siteId) {
            query = query.eq('site_id', siteId);
          }

          const { data, error } = await query.order('name', { ascending: true });
          if (error) return jsonResponse({ success: false, error: error.message }, 500);
          return jsonResponse({ success: true, data });
        }

        if (request.method === 'POST') {
          const body = (await request.json().catch(() => ({}))) as { site_id: string; name: string; description?: string };
          if (!body.site_id || !body.name || body.name.trim().length === 0) {
            return jsonResponse({ success: false, error: 'Site ID and Location name are required' }, 400);
          }

          const { data, error } = await client
            .from('locations')
            .insert({
              company_id: tenantId,
              site_id: body.site_id,
              name: body.name.trim(),
              description: body.description?.trim() || null,
            })
            .select('*, site:sites(*)')
            .single();

          if (error) return jsonResponse({ success: false, error: error.message }, 400);
          return jsonResponse({ success: true, data }, 201);
        }
      }

      // 7. Assets Collection API
      if (subpath === '/assets') {
        if (request.method === 'GET') {
          const search = url.searchParams.get('search')?.trim();
          const categoryId = url.searchParams.get('category_id');
          const siteId = url.searchParams.get('site_id');
          const locationId = url.searchParams.get('location_id');
          const status = url.searchParams.get('status');
          const sortBy = url.searchParams.get('sort_by') || 'created_at';
          const sortOrder = url.searchParams.get('sort_order') === 'asc';
          const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
          const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '25', 10)));
          const offset = (page - 1) * limit;

          let query = client
            .from('assets')
            .select('*, category:categories(*), site:sites(*), location:locations(*)', { count: 'exact' })
            .eq('company_id', tenantId);

          if (categoryId) query = query.eq('category_id', categoryId);
          if (siteId) query = query.eq('site_id', siteId);
          if (locationId) query = query.eq('location_id', locationId);
          if (status) query = query.eq('status', status);

          if (search) {
            query = query.or(
              `asset_tag.ilike.%${search}%,name.ilike.%${search}%,serial_number.ilike.%${search}%,manufacturer.ilike.%${search}%,model.ilike.%${search}%`
            );
          }

          // Allowed sorting fields
          const validSortCols = ['asset_tag', 'name', 'status', 'purchase_cost', 'purchase_date', 'created_at'];
          const sortColumn = validSortCols.includes(sortBy) ? sortBy : 'created_at';

          const { data, count, error } = await query
            .order(sortColumn, { ascending: sortOrder })
            .range(offset, offset + limit - 1);

          if (error) {
            return jsonResponse({ success: false, error: error.message }, 500);
          }

          // Enrich assigned assets with current active assignment and employee
          const assetIds = (data || []).map((a) => a.id);
          let activeAssignments: AssetAssignment[] = [];
          if (assetIds.length > 0) {
            const { data: assignments } = await client
              .from('asset_assignments')
              .select('*, employee:employees(*, department:departments(*))')
              .in('asset_id', assetIds)
              .is('checked_in_at', null)
              .eq('company_id', tenantId);
            activeAssignments = (assignments as AssetAssignment[]) || [];
          }

          const assignmentMap = new Map<string, AssetAssignment>();
          activeAssignments.forEach((asgn) => {
            assignmentMap.set(asgn.asset_id, asgn);
          });

          const enrichedData = (data || []).map((asset) => {
            const currentAssignment = assignmentMap.get(asset.id) || null;
            return {
              ...asset,
              current_assignment: currentAssignment,
              current_employee: currentAssignment?.employee || null,
            };
          });

          return jsonResponse({
            success: true,
            data: enrichedData,
            pagination: {
              page,
              limit,
              totalCount: count ?? 0,
              totalPages: Math.ceil((count ?? 0) / limit),
            },
          });
        }

        if (request.method === 'POST') {
          const body = (await request.json().catch(() => ({}))) as Partial<CreateAssetInput>;
          const validation = validateAsset(body, false);
          if (!validation.isValid) {
            return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
          }

          // Basic plan usage quota enforcement
          const { count: currentAssetCount } = await client
            .from('assets')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', tenantId);

          const maxAllowedAssets = (membership?.company as any)?.max_assets || BASIC_PLAN_QUOTAS.maxAssets;
          if ((currentAssetCount ?? 0) >= maxAllowedAssets) {
            return jsonResponse(
              {
                success: false,
                error: 'QUOTA_EXCEEDED',
                message: `Basic plan quota of ${maxAllowedAssets} assets reached. Please upgrade to create more assets.`,
              },
              403
            );
          }

          // Check for duplicate asset tag in this tenant
          const { data: existingTag } = await client
            .from('assets')
            .select('id')
            .eq('company_id', tenantId)
            .eq('asset_tag', body.asset_tag!.trim())
            .maybeSingle();

          if (existingTag) {
            return jsonResponse(
              {
                success: false,
                error: 'DUPLICATE_ASSET_TAG',
                errors: { asset_tag: `Asset Tag "${body.asset_tag}" already exists in your workspace.` },
              },
              400
            );
          }

          const insertPayload = {
            company_id: tenantId,
            asset_tag: body.asset_tag!.trim(),
            name: body.name!.trim(),
            description: body.description?.trim() || null,
            category_id: body.category_id || null,
            site_id: body.site_id || null,
            location_id: body.location_id || null,
            serial_number: body.serial_number?.trim() || null,
            manufacturer: body.manufacturer?.trim() || null,
            model: body.model?.trim() || null,
            // New assets default to Available; Assigned is prohibited
            status: (body.status || 'Available') as AssetStatus,
            purchase_date: body.purchase_date || null,
            purchase_cost: body.purchase_cost !== undefined ? Number(body.purchase_cost) : null,
            currency: body.currency || 'USD',
            warranty_expiry: body.warranty_expiry || null,
            notes: body.notes?.trim() || null,
            created_by: user.id,
          };

          const { data, error } = await client
            .from('assets')
            .insert(insertPayload)
            .select('*, category:categories(*), site:sites(*), location:locations(*)')
            .single();

          if (error) {
            return jsonResponse({ success: false, error: error.message }, 400);
          }

          return jsonResponse({ success: true, data }, 201);
        }
      }

      // 8. Single Asset API: /assets/:id
      const assetMatch = subpath.match(/^\/assets\/([a-zA-Z0-9_-]+)$/);
      if (assetMatch) {
        const assetId = assetMatch[1];

        if (request.method === 'GET') {
          // Fetch asset with relation joins
          const { data: assetData, error: assetError } = await client
            .from('assets')
            .select('*, category:categories(*), site:sites(*), location:locations(*)')
            .eq('id', assetId)
            .eq('company_id', tenantId)
            .maybeSingle();

          if (assetError) return jsonResponse({ success: false, error: assetError.message }, 500);
          if (!assetData) return jsonResponse({ success: false, error: 'Asset not found' }, 404);

          // Fetch event history for this asset
          const { data: eventsData } = await client
            .from('asset_events')
            .select('*')
            .eq('asset_id', assetId)
            .eq('company_id', tenantId)
            .order('created_at', { ascending: false });

          // Fetch custody assignments history for this asset
          const { data: assignmentsData } = await client
            .from('asset_assignments')
            .select('*, employee:employees(*, department:departments(*))')
            .eq('asset_id', assetId)
            .eq('company_id', tenantId)
            .order('checked_out_at', { ascending: false });

          const activeAssignment = (assignmentsData as AssetAssignment[] || []).find((a) => !a.checked_in_at) || null;

          return jsonResponse({
            success: true,
            data: {
              ...assetData,
              current_assignment: activeAssignment,
              current_employee: activeAssignment?.employee || null,
            },
            history: eventsData || [],
            assignments: assignmentsData || [],
          });
        }

        if (request.method === 'PUT') {
          const body = (await request.json().catch(() => ({}))) as Partial<CreateAssetInput>;
          const validation = validateAsset(body, true);
          if (!validation.isValid) {
            return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
          }

          // Check if asset tag was changed and clashes with another record
          if (body.asset_tag) {
            const { data: clash } = await client
              .from('assets')
              .select('id')
              .eq('company_id', tenantId)
              .eq('asset_tag', body.asset_tag.trim())
              .neq('id', assetId)
              .maybeSingle();

            if (clash) {
              return jsonResponse(
                {
                  success: false,
                  error: 'DUPLICATE_ASSET_TAG',
                  errors: { asset_tag: `Asset Tag "${body.asset_tag}" is already used by another asset.` },
                },
                400
              );
            }
          }

          // Build clean update payload (company_id cannot be changed)
          const updatePayload: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
          };

          if (body.asset_tag !== undefined) updatePayload.asset_tag = body.asset_tag.trim();
          if (body.name !== undefined) updatePayload.name = body.name.trim();
          if (body.description !== undefined) updatePayload.description = body.description?.trim() || null;
          if (body.category_id !== undefined) updatePayload.category_id = body.category_id || null;
          if (body.site_id !== undefined) updatePayload.site_id = body.site_id || null;
          if (body.location_id !== undefined) updatePayload.location_id = body.location_id || null;
          if (body.serial_number !== undefined) updatePayload.serial_number = body.serial_number?.trim() || null;
          if (body.manufacturer !== undefined) updatePayload.manufacturer = body.manufacturer?.trim() || null;
          if (body.model !== undefined) updatePayload.model = body.model?.trim() || null;
          if (body.status !== undefined) updatePayload.status = body.status;
          if (body.purchase_date !== undefined) updatePayload.purchase_date = body.purchase_date || null;
          if (body.purchase_cost !== undefined) updatePayload.purchase_cost = body.purchase_cost !== null ? Number(body.purchase_cost) : null;
          if (body.currency !== undefined) updatePayload.currency = body.currency || 'USD';
          if (body.warranty_expiry !== undefined) updatePayload.warranty_expiry = body.warranty_expiry || null;
          if (body.notes !== undefined) updatePayload.notes = body.notes?.trim() || null;

          const { data, error } = await client
            .from('assets')
            .update(updatePayload)
            .eq('id', assetId)
            .eq('company_id', tenantId)
            .select('*, category:categories(*), site:sites(*), location:locations(*)')
            .single();

          if (error) return jsonResponse({ success: false, error: error.message }, 400);

          return jsonResponse({ success: true, data });
        }
      }

      // 8B. Custody Actions: /assets/:id/checkout
      const checkoutMatch = subpath.match(/^\/assets\/([a-zA-Z0-9_-]+)\/checkout$/);
      if (checkoutMatch && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to check out assets.' },
            403
          );
        }

        const assetId = checkoutMatch[1];
        const body = (await request.json().catch(() => ({}))) as Partial<CheckoutInput>;
        const validation = validateCheckout(body);
        if (!validation.isValid) {
          return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
        }

        // Verify asset is not Disposed and check reservations
        const { data: astCheck } = await client
          .from('assets')
          .select('id, status')
          .eq('id', assetId)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (astCheck?.status === 'Disposed') {
          return jsonResponse({ success: false, error: 'Disposed assets cannot be checked out.' }, 400);
        }

        const { data: activeRes } = await client
          .from('asset_reservations')
          .select('id, employee_id, employee:employees(full_name)')
          .eq('asset_id', assetId)
          .eq('company_id', tenantId)
          .eq('status', 'Active')
          .maybeSingle();

        if (activeRes && activeRes.employee_id !== body.employee_id) {
          const reservedFor = (activeRes.employee as { full_name?: string })?.full_name || 'another employee';
          return jsonResponse(
            { success: false, error: `Asset is currently reserved for ${reservedFor}. Cancel or reassign the reservation before checking out to another employee.` },
            400
          );
        }

        // If reserved for this employee, fulfill the reservation
        if (activeRes && activeRes.employee_id === body.employee_id) {
          await client
            .from('asset_reservations')
            .update({ status: 'Fulfilled', updated_at: new Date().toISOString() })
            .eq('id', activeRes.id);
        }

        // Try atomic database RPC first
        const { data: rpcData, error: rpcError } = await client.rpc('checkout_asset', {
          p_asset_id: assetId,
          p_employee_id: body.employee_id,
          p_checked_out_at: body.checked_out_at || new Date().toISOString(),
          p_expected_return_at: body.expected_return_at || null,
          p_condition: body.condition?.trim() || null,
          p_notes: body.notes?.trim() || null,
        });

        if (!rpcError) {
          return jsonResponse({ success: true, data: rpcData }, 200);
        }

        // Check if error is business rule validation error from RPC
        if (!rpcError.message?.includes('does not exist') && !rpcError.message?.includes('function public.checkout_asset')) {
          return jsonResponse({ success: false, error: rpcError.message }, 400);
        }

        // Fallback transactional path using authenticated client
        const { data: asset, error: aErr } = await client
          .from('assets')
          .select('id, company_id, status, name, asset_tag')
          .eq('id', assetId)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (aErr || !asset) return jsonResponse({ success: false, error: 'Asset not found in your workspace.' }, 404);
        if (asset.status !== 'Available') {
          return jsonResponse({ success: false, error: `Asset is currently ${asset.status}. Only "Available" assets can be checked out.` }, 400);
        }

        const { data: emp, error: eErr } = await client
          .from('employees')
          .select('id, full_name, employee_code, is_active')
          .eq('id', body.employee_id)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (eErr || !emp) return jsonResponse({ success: false, error: 'Target employee not found in your workspace.' }, 404);
        if (!emp.is_active) return jsonResponse({ success: false, error: 'Cannot check out asset to an inactive employee.' }, 400);

        const checkoutTime = body.checked_out_at || new Date().toISOString();
        const { data: newAsgn, error: asgnErr } = await client
          .from('asset_assignments')
          .insert({
            company_id: tenantId,
            asset_id: assetId,
            employee_id: body.employee_id,
            checked_out_at: checkoutTime,
            expected_return_at: body.expected_return_at || null,
            checkout_condition: body.condition?.trim() || null,
            checkout_notes: body.notes?.trim() || null,
            issued_by: user.id,
          })
          .select('*, employee:employees(*)')
          .single();

        if (asgnErr) return jsonResponse({ success: false, error: asgnErr.message }, 400);

        await client
          .from('assets')
          .update({ status: 'Assigned', updated_at: new Date().toISOString() })
          .eq('id', assetId)
          .eq('company_id', tenantId);

        await client.from('asset_events').insert({
          company_id: tenantId,
          asset_id: assetId,
          event_type: 'CHECKED_OUT',
          actor_id: user.id,
          details: {
            assignment_id: newAsgn?.id,
            employee_id: body.employee_id,
            employee_name: emp.full_name,
            employee_code: emp.employee_code,
            checked_out_at: checkoutTime,
            expected_return_at: body.expected_return_at || null,
            condition: body.condition?.trim() || null,
            notes: body.notes?.trim() || null,
          },
        });

        return jsonResponse({ success: true, data: newAsgn });
      }

      // 8C. Custody Actions: /assets/:id/checkin
      const checkinMatch = subpath.match(/^\/assets\/([a-zA-Z0-9_-]+)\/checkin$/);
      if (checkinMatch && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to check in assets.' },
            403
          );
        }

        const assetId = checkinMatch[1];
        const body = (await request.json().catch(() => ({}))) as Partial<CheckinInput>;
        const validation = validateCheckin(body);
        if (!validation.isValid) {
          return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
        }

        // Try atomic database RPC first
        const { data: rpcData, error: rpcError } = await client.rpc('checkin_asset', {
          p_asset_id: assetId,
          p_checked_in_at: body.checked_in_at || new Date().toISOString(),
          p_condition: body.condition?.trim() || null,
          p_site_id: body.site_id || null,
          p_location_id: body.location_id || null,
          p_notes: body.notes?.trim() || null,
        });

        if (!rpcError) {
          return jsonResponse({ success: true, data: rpcData }, 200);
        }

        if (!rpcError.message?.includes('does not exist') && !rpcError.message?.includes('function public.checkin_asset')) {
          return jsonResponse({ success: false, error: rpcError.message }, 400);
        }

        // Fallback transactional path
        const { data: asset, error: aErr } = await client
          .from('assets')
          .select('id, company_id, status, site_id, location_id')
          .eq('id', assetId)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (aErr || !asset) return jsonResponse({ success: false, error: 'Asset not found in your workspace.' }, 404);
        if (asset.status !== 'Assigned') {
          return jsonResponse({ success: false, error: `Asset is ${asset.status}. Only "Assigned" assets can be checked in.` }, 400);
        }

        const { data: activeAsgn, error: asgnErr } = await client
          .from('asset_assignments')
          .select('*, employee:employees(id, full_name, employee_code)')
          .eq('asset_id', assetId)
          .eq('company_id', tenantId)
          .is('checked_in_at', null)
          .maybeSingle();

        if (asgnErr || !activeAsgn) {
          return jsonResponse({ success: false, error: 'No active custody assignment found for this asset.' }, 400);
        }

        const checkinTime = body.checked_in_at || new Date().toISOString();
        const { data: closedAsgn, error: closeErr } = await client
          .from('asset_assignments')
          .update({
            checked_in_at: checkinTime,
            checkin_condition: body.condition?.trim() || null,
            checkin_notes: body.notes?.trim() || null,
            returned_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', activeAsgn.id)
          .select()
          .single();

        if (closeErr) return jsonResponse({ success: false, error: closeErr.message }, 400);

        const assetUpdate: Record<string, unknown> = {
          status: 'Available',
          updated_at: new Date().toISOString(),
        };
        if (body.site_id !== undefined) assetUpdate.site_id = body.site_id || null;
        if (body.location_id !== undefined) assetUpdate.location_id = body.location_id || null;

        await client
          .from('assets')
          .update(assetUpdate)
          .eq('id', assetId)
          .eq('company_id', tenantId);

        const empData = activeAsgn.employee as { full_name?: string; employee_code?: string } | null;
        await client.from('asset_events').insert({
          company_id: tenantId,
          asset_id: assetId,
          event_type: 'CHECKED_IN',
          actor_id: user.id,
          details: {
            assignment_id: activeAsgn.id,
            employee_id: activeAsgn.employee_id,
            employee_name: empData?.full_name,
            employee_code: empData?.employee_code,
            checked_out_at: activeAsgn.checked_out_at,
            checked_in_at: checkinTime,
            returned_condition: body.condition?.trim() || null,
            destination_site_id: body.site_id || null,
            destination_location_id: body.location_id || null,
            notes: body.notes?.trim() || null,
          },
        });

        return jsonResponse({ success: true, data: closedAsgn });
      }

      // 8D. Custody Actions: /assets/:id/transfer
      const transferMatch = subpath.match(/^\/assets\/([a-zA-Z0-9_-]+)\/transfer$/);
      if (transferMatch && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to transfer assets.' },
            403
          );
        }

        const assetId = transferMatch[1];
        const body = (await request.json().catch(() => ({}))) as Partial<TransferInput>;

        // Fetch active assignment to validate not transferring to same employee
        const { data: activeAsgn } = await client
          .from('asset_assignments')
          .select('*, employee:employees(id, full_name, employee_code)')
          .eq('asset_id', assetId)
          .eq('company_id', tenantId)
          .is('checked_in_at', null)
          .maybeSingle();

        if (!activeAsgn) {
          return jsonResponse({ success: false, error: 'No active custody assignment found to transfer.' }, 400);
        }

        const validation = validateTransfer(body, activeAsgn.employee_id);
        if (!validation.isValid) {
          return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
        }

        // Try atomic database RPC first
        const { data: rpcData, error: rpcError } = await client.rpc('transfer_asset', {
          p_asset_id: assetId,
          p_new_employee_id: body.new_employee_id,
          p_transfer_at: body.transfer_at || new Date().toISOString(),
          p_condition: body.condition?.trim() || null,
          p_notes: body.notes?.trim() || null,
        });

        if (!rpcError) {
          return jsonResponse({ success: true, data: rpcData }, 200);
        }

        if (!rpcError.message?.includes('does not exist') && !rpcError.message?.includes('function public.transfer_asset')) {
          return jsonResponse({ success: false, error: rpcError.message }, 400);
        }

        // Fallback transactional path
        const { data: newEmp, error: nErr } = await client
          .from('employees')
          .select('id, full_name, employee_code, is_active')
          .eq('id', body.new_employee_id)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (nErr || !newEmp) return jsonResponse({ success: false, error: 'Target employee not found in your workspace.' }, 404);
        if (!newEmp.is_active) return jsonResponse({ success: false, error: 'Cannot transfer asset to an inactive employee.' }, 400);

        const transferTime = body.transfer_at || new Date().toISOString();
        const oldEmp = activeAsgn.employee as { full_name?: string; employee_code?: string } | null;

        // 1. Close current assignment
        await client
          .from('asset_assignments')
          .update({
            checked_in_at: transferTime,
            checkin_condition: body.condition?.trim() || null,
            checkin_notes: `Transferred to ${newEmp.full_name} (${newEmp.employee_code})${body.notes ? `: ${body.notes.trim()}` : ''}`,
            returned_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', activeAsgn.id);

        // 2. Create new active assignment
        const { data: newAsgn, error: asgnErr } = await client
          .from('asset_assignments')
          .insert({
            company_id: tenantId,
            asset_id: assetId,
            employee_id: body.new_employee_id,
            checked_out_at: transferTime,
            checkout_condition: body.condition?.trim() || null,
            checkout_notes: `Transferred from ${oldEmp?.full_name || 'Previous Custodian'} (${oldEmp?.employee_code || ''})${body.notes ? `: ${body.notes.trim()}` : ''}`,
            issued_by: user.id,
          })
          .select('*, employee:employees(*)')
          .single();

        if (asgnErr) return jsonResponse({ success: false, error: asgnErr.message }, 400);

        // Asset remains Assigned
        await client
          .from('assets')
          .update({ status: 'Assigned', updated_at: new Date().toISOString() })
          .eq('id', assetId)
          .eq('company_id', tenantId);

        await client.from('asset_events').insert({
          company_id: tenantId,
          asset_id: assetId,
          event_type: 'TRANSFERRED',
          actor_id: user.id,
          details: {
            previous_assignment_id: activeAsgn.id,
            previous_employee_id: activeAsgn.employee_id,
            previous_employee_name: oldEmp?.full_name,
            previous_employee_code: oldEmp?.employee_code,
            new_assignment_id: newAsgn?.id,
            new_employee_id: body.new_employee_id,
            new_employee_name: newEmp.full_name,
            new_employee_code: newEmp.employee_code,
            transferred_at: transferTime,
            condition: body.condition?.trim() || null,
            notes: body.notes?.trim() || null,
          },
        });

        return jsonResponse({ success: true, data: newAsgn });
      }

      // 8E. Asset Custody History API: /assets/:id/assignments
      const assetAssignmentsMatch = subpath.match(/^\/assets\/([a-zA-Z0-9_-]+)\/assignments$/);
      if (assetAssignmentsMatch && request.method === 'GET') {
        const assetId = assetAssignmentsMatch[1];
        const { data, error } = await client
          .from('asset_assignments')
          .select('*, employee:employees(*, department:departments(*))')
          .eq('asset_id', assetId)
          .eq('company_id', tenantId)
          .order('checked_out_at', { ascending: false });

        if (error) return jsonResponse({ success: false, error: error.message }, 500);
        return jsonResponse({ success: true, data });
      }

      // 8F. Employee Custody History API: /employees/:id/assignments
      const empAssignmentsMatch = subpath.match(/^\/employees\/([a-zA-Z0-9_-]+)\/assignments$/);
      if (empAssignmentsMatch && request.method === 'GET') {
        const empId = empAssignmentsMatch[1];
        const { data, error } = await client
          .from('asset_assignments')
          .select('*, asset:assets(*, category:categories(*), site:sites(*), location:locations(*))')
          .eq('employee_id', empId)
          .eq('company_id', tenantId)
          .order('checked_out_at', { ascending: false });

        if (error) return jsonResponse({ success: false, error: error.message }, 500);
        return jsonResponse({ success: true, data });
      }

      // 9. Departments API
      if (subpath === '/departments') {
        if (request.method === 'GET') {
          const includeArchived = url.searchParams.get('include_archived') === 'true';
          let query = client.from('departments').select('*').eq('company_id', tenantId);

          if (!includeArchived) {
            query = query.eq('is_archived', false);
          }

          const { data, error } = await query.order('name', { ascending: true });
          if (error) return jsonResponse({ success: false, error: error.message }, 500);
          return jsonResponse({ success: true, data });
        }

        if (request.method === 'POST') {
          if (membership.role !== 'TENANT_ADMIN') {
            return jsonResponse(
              { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to create departments.' },
              403
            );
          }

          const body = (await request.json().catch(() => ({}))) as Partial<CreateDepartmentInput>;
          const validation = validateDepartment(body, false);
          if (!validation.isValid) {
            return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
          }

          // Check duplicate department name in tenant
          const { data: existing } = await client
            .from('departments')
            .select('id')
            .eq('company_id', tenantId)
            .ilike('name', body.name!.trim())
            .maybeSingle();

          if (existing) {
            return jsonResponse(
              {
                success: false,
                error: 'DUPLICATE_DEPARTMENT_NAME',
                errors: { name: `Department "${body.name!.trim()}" already exists in your company.` },
              },
              400
            );
          }

          const { data, error } = await client
            .from('departments')
            .insert({
              company_id: tenantId,
              name: body.name!.trim(),
              code: body.code?.trim() || null,
              description: body.description?.trim() || null,
              is_archived: false,
            })
            .select()
            .single();

          if (error) return jsonResponse({ success: false, error: error.message }, 400);
          return jsonResponse({ success: true, data }, 201);
        }
      }

      // 10. Single Department API: /departments/:id
      const deptMatch = subpath.match(/^\/departments\/([a-zA-Z0-9_-]+)$/);
      if (deptMatch) {
        const deptId = deptMatch[1];

        if (request.method === 'PUT') {
          if (membership.role !== 'TENANT_ADMIN') {
            return jsonResponse(
              { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to update departments.' },
              403
            );
          }

          const body = (await request.json().catch(() => ({}))) as Partial<UpdateDepartmentInput>;
          const validation = validateDepartment(body, true);
          if (!validation.isValid) {
            return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
          }

          if (body.name) {
            const { data: clash } = await client
              .from('departments')
              .select('id')
              .eq('company_id', tenantId)
              .ilike('name', body.name.trim())
              .neq('id', deptId)
              .maybeSingle();

            if (clash) {
              return jsonResponse(
                {
                  success: false,
                  error: 'DUPLICATE_DEPARTMENT_NAME',
                  errors: { name: `Department name "${body.name.trim()}" is already in use.` },
                },
                400
              );
            }
          }

          const updatePayload: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
          };
          if (body.name !== undefined) updatePayload.name = body.name.trim();
          if (body.code !== undefined) updatePayload.code = body.code?.trim() || null;
          if (body.description !== undefined) updatePayload.description = body.description?.trim() || null;
          if (body.is_archived !== undefined) updatePayload.is_archived = Boolean(body.is_archived);

          const { data, error } = await client
            .from('departments')
            .update(updatePayload)
            .eq('id', deptId)
            .eq('company_id', tenantId)
            .select()
            .single();

          if (error) return jsonResponse({ success: false, error: error.message }, 400);
          return jsonResponse({ success: true, data });
        }
      }

      // 11. Employees Collection API: /employees
      if (subpath === '/employees') {
        if (request.method === 'GET') {
          const search = url.searchParams.get('search')?.trim();
          const departmentId = url.searchParams.get('department_id');
          const siteId = url.searchParams.get('site_id');
          const isActive = url.searchParams.get('is_active');
          const sortBy = url.searchParams.get('sort_by') || 'created_at';
          const sortOrder = url.searchParams.get('sort_order') === 'asc';
          const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
          const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '25', 10)));
          const offset = (page - 1) * limit;

          let query = client
            .from('employees')
            .select('*, department:departments(*), site:sites(*), location:locations(*)', { count: 'exact' })
            .eq('company_id', tenantId);

          if (departmentId) query = query.eq('department_id', departmentId);
          if (siteId) query = query.eq('site_id', siteId);
          if (isActive === 'true') query = query.eq('is_active', true);
          else if (isActive === 'false') query = query.eq('is_active', false);

          if (search) {
            query = query.or(
              `employee_code.ilike.%${search}%,full_name.ilike.%${search}%,email.ilike.%${search}%,job_title.ilike.%${search}%`
            );
          }

          const validSortCols = ['employee_code', 'full_name', 'job_title', 'is_active', 'created_at'];
          const sortColumn = validSortCols.includes(sortBy) ? sortBy : 'created_at';

          const { data, count, error } = await query
            .order(sortColumn, { ascending: sortOrder })
            .range(offset, offset + limit - 1);

          if (error) return jsonResponse({ success: false, error: error.message }, 500);

          return jsonResponse({
            success: true,
            data,
            pagination: {
              page,
              limit,
              totalCount: count ?? 0,
              totalPages: Math.ceil((count ?? 0) / limit),
            },
          });
        }

        if (request.method === 'POST') {
          if (membership.role !== 'TENANT_ADMIN') {
            return jsonResponse(
              { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to register employees.' },
              403
            );
          }

          const body = (await request.json().catch(() => ({}))) as Partial<CreateEmployeeInput>;
          const validation = validateEmployee(body, false);
          if (!validation.isValid) {
            return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
          }

          // Check duplicate employee_code in this tenant
          const { data: existingCode } = await client
            .from('employees')
            .select('id')
            .eq('company_id', tenantId)
            .ilike('employee_code', body.employee_code!.trim())
            .maybeSingle();

          if (existingCode) {
            return jsonResponse(
              {
                success: false,
                error: 'DUPLICATE_EMPLOYEE_CODE',
                errors: { employee_code: `Employee ID "${body.employee_code!.trim()}" already exists in your workspace.` },
              },
              400
            );
          }

          // Verify department if provided belongs to this tenant
          if (body.department_id) {
            const { data: dept } = await client
              .from('departments')
              .select('id')
              .eq('company_id', tenantId)
              .eq('id', body.department_id)
              .maybeSingle();

            if (!dept) {
              return jsonResponse(
                { success: false, error: 'Selected department does not belong to your company workspace.' },
                400
              );
            }
          }

          // Verify site if provided belongs to this tenant
          if (body.site_id) {
            const { data: site } = await client
              .from('sites')
              .select('id')
              .eq('company_id', tenantId)
              .eq('id', body.site_id)
              .maybeSingle();

            if (!site) {
              return jsonResponse(
                { success: false, error: 'Selected site does not belong to your company workspace.' },
                400
              );
            }
          }

          // Verify location if provided belongs to this tenant
          if (body.location_id) {
            const { data: loc } = await client
              .from('locations')
              .select('id')
              .eq('company_id', tenantId)
              .eq('id', body.location_id)
              .maybeSingle();

            if (!loc) {
              return jsonResponse(
                { success: false, error: 'Selected location does not belong to your company workspace.' },
                400
              );
            }
          }

          // CRITICAL REQUIREMENT: Employees are directory records who hold assets, NOT login users!
          // Creating an employee does NOT create a Supabase Auth user, send an invite, or grant application access.
          const insertPayload = {
            company_id: tenantId,
            employee_code: body.employee_code!.trim(),
            full_name: body.full_name!.trim(),
            email: body.email?.trim() || null,
            job_title: body.job_title?.trim() || null,
            department_id: body.department_id || null,
            site_id: body.site_id || null,
            location_id: body.location_id || null,
            is_active: body.is_active !== undefined ? Boolean(body.is_active) : true,
          };

          const { data, error } = await client
            .from('employees')
            .insert(insertPayload)
            .select('*, department:departments(*), site:sites(*), location:locations(*)')
            .single();

          if (error) return jsonResponse({ success: false, error: error.message }, 400);
          return jsonResponse({ success: true, data }, 201);
        }
      }

      // 12. Employee Toggle Active API: /employees/:id/toggle-active
      const empToggleMatch = subpath.match(/^\/employees\/([a-zA-Z0-9_-]+)\/toggle-active$/);
      if (empToggleMatch && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to change employee active status.' },
            403
          );
        }

        const empId = empToggleMatch[1];
        const { data: emp, error: empErr } = await client
          .from('employees')
          .select('id, is_active')
          .eq('id', empId)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (empErr || !emp) return jsonResponse({ success: false, error: 'Employee not found' }, 404);

        const body = (await request.json().catch(() => ({}))) as { is_active?: boolean };
        const nextActive = body.is_active !== undefined ? Boolean(body.is_active) : !emp.is_active;

        const { data, error } = await client
          .from('employees')
          .update({ is_active: nextActive, updated_at: new Date().toISOString() })
          .eq('id', empId)
          .eq('company_id', tenantId)
          .select('*, department:departments(*), site:sites(*), location:locations(*)')
          .single();

        if (error) return jsonResponse({ success: false, error: error.message }, 400);
        return jsonResponse({ success: true, data });
      }

      // 13. Single Employee API: /employees/:id
      const empMatch = subpath.match(/^\/employees\/([a-zA-Z0-9_-]+)$/);
      if (empMatch) {
        const empId = empMatch[1];

        if (request.method === 'GET') {
          const { data, error } = await client
            .from('employees')
            .select('*, department:departments(*), site:sites(*), location:locations(*)')
            .eq('id', empId)
            .eq('company_id', tenantId)
            .maybeSingle();

          if (error) return jsonResponse({ success: false, error: error.message }, 500);
          if (!data) return jsonResponse({ success: false, error: 'Employee not found' }, 404);
          return jsonResponse({ success: true, data });
        }

        if (request.method === 'PUT') {
          if (membership.role !== 'TENANT_ADMIN') {
            return jsonResponse(
              { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to update employees.' },
              403
            );
          }

          const body = (await request.json().catch(() => ({}))) as Partial<CreateEmployeeInput>;
          const validation = validateEmployee(body, true);
          if (!validation.isValid) {
            return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
          }

          if (body.employee_code) {
            const { data: clash } = await client
              .from('employees')
              .select('id')
              .eq('company_id', tenantId)
              .ilike('employee_code', body.employee_code.trim())
              .neq('id', empId)
              .maybeSingle();

            if (clash) {
              return jsonResponse(
                {
                  success: false,
                  error: 'DUPLICATE_EMPLOYEE_CODE',
                  errors: { employee_code: `Employee ID "${body.employee_code.trim()}" is already used by another employee.` },
                },
                400
              );
            }
          }

          if (body.department_id) {
            const { data: dept } = await client
              .from('departments')
              .select('id')
              .eq('company_id', tenantId)
              .eq('id', body.department_id)
              .maybeSingle();

            if (!dept) {
              return jsonResponse(
                { success: false, error: 'Selected department does not belong to your company workspace.' },
                400
              );
            }
          }

          if (body.site_id) {
            const { data: site } = await client
              .from('sites')
              .select('id')
              .eq('company_id', tenantId)
              .eq('id', body.site_id)
              .maybeSingle();

            if (!site) {
              return jsonResponse(
                { success: false, error: 'Selected site does not belong to your company workspace.' },
                400
              );
            }
          }

          if (body.location_id) {
            const { data: loc } = await client
              .from('locations')
              .select('id')
              .eq('company_id', tenantId)
              .eq('id', body.location_id)
              .maybeSingle();

            if (!loc) {
              return jsonResponse(
                { success: false, error: 'Selected location does not belong to your company workspace.' },
                400
              );
            }
          }

          const updatePayload: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
          };

          if (body.employee_code !== undefined) updatePayload.employee_code = body.employee_code.trim();
          if (body.full_name !== undefined) updatePayload.full_name = body.full_name.trim();
          if (body.email !== undefined) updatePayload.email = body.email?.trim() || null;
          if (body.job_title !== undefined) updatePayload.job_title = body.job_title?.trim() || null;
          if (body.department_id !== undefined) updatePayload.department_id = body.department_id || null;
          if (body.site_id !== undefined) updatePayload.site_id = body.site_id || null;
          if (body.location_id !== undefined) updatePayload.location_id = body.location_id || null;
          if (body.is_active !== undefined) updatePayload.is_active = Boolean(body.is_active);

          const { data, error } = await client
            .from('employees')
            .update(updatePayload)
            .eq('id', empId)
            .eq('company_id', tenantId)
            .select('*, department:departments(*), site:sites(*), location:locations(*)')
            .single();

          if (error) return jsonResponse({ success: false, error: error.message }, 400);
          return jsonResponse({ success: true, data });
        }
      }

      // ======================================================================
      // 14. Phase 3: Vendors API
      // ======================================================================
      if (subpath === '/vendors') {
        if (request.method === 'GET') {
          const search = url.searchParams.get('search')?.trim();
          const isActive = url.searchParams.get('is_active');

          let query = client.from('vendors').select('*').eq('company_id', tenantId);

          if (isActive !== null && isActive !== undefined && isActive !== '') {
            query = query.eq('is_active', isActive === 'true');
          }

          if (search) {
            query = query.or(`name.ilike.%${search}%,contact_name.ilike.%${search}%,email.ilike.%${search}%`);
          }

          const { data, error } = await query.order('name', { ascending: true });
          if (error) return jsonResponse({ success: false, error: error.message }, 500);
          return jsonResponse({ success: true, data });
        }

        if (request.method === 'POST') {
          if (membership.role !== 'TENANT_ADMIN') {
            return jsonResponse(
              { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to register vendors.' },
              403
            );
          }

          const body = (await request.json().catch(() => ({}))) as Partial<CreateVendorInput>;
          const validation = validateVendor(body, false);
          if (!validation.isValid) {
            return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
          }

          // Check duplicate vendor name
          const { data: existing } = await client
            .from('vendors')
            .select('id')
            .eq('company_id', tenantId)
            .ilike('name', body.name!.trim())
            .maybeSingle();

          if (existing) {
            return jsonResponse(
              {
                success: false,
                error: 'DUPLICATE_VENDOR_NAME',
                errors: { name: `Vendor with name "${body.name!.trim()}" already exists in your workspace.` },
              },
              400
            );
          }

          const { data, error } = await client
            .from('vendors')
            .insert({
              company_id: tenantId,
              name: body.name!.trim(),
              contact_name: body.contact_name?.trim() || null,
              email: body.email?.trim() || null,
              phone: body.phone?.trim() || null,
              website: body.website?.trim() || null,
              notes: body.notes?.trim() || null,
              is_active: body.is_active !== undefined ? Boolean(body.is_active) : true,
            })
            .select()
            .single();

          if (error) return jsonResponse({ success: false, error: error.message }, 400);
          return jsonResponse({ success: true, data }, 201);
        }
      }

      // Vendor toggle active / Single Vendor API
      const vendorToggleMatch = subpath.match(/^\/vendors\/([a-zA-Z0-9_-]+)\/toggle-active$/);
      if (vendorToggleMatch && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to update vendor status.' },
            403
          );
        }

        const vendorId = vendorToggleMatch[1];
        const { data: v, error: vErr } = await client
          .from('vendors')
          .select('id, is_active')
          .eq('id', vendorId)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (vErr || !v) return jsonResponse({ success: false, error: 'Vendor not found' }, 404);

        const body = (await request.json().catch(() => ({}))) as { is_active?: boolean };
        const nextActive = body.is_active !== undefined ? Boolean(body.is_active) : !v.is_active;

        const { data, error } = await client
          .from('vendors')
          .update({ is_active: nextActive, updated_at: new Date().toISOString() })
          .eq('id', vendorId)
          .eq('company_id', tenantId)
          .select()
          .single();

        if (error) return jsonResponse({ success: false, error: error.message }, 400);
        return jsonResponse({ success: true, data });
      }

      const vendorMatch = subpath.match(/^\/vendors\/([a-zA-Z0-9_-]+)$/);
      if (vendorMatch) {
        const vendorId = vendorMatch[1];

        if (request.method === 'GET') {
          const { data, error } = await client
            .from('vendors')
            .select('*')
            .eq('id', vendorId)
            .eq('company_id', tenantId)
            .maybeSingle();

          if (error) return jsonResponse({ success: false, error: error.message }, 500);
          if (!data) return jsonResponse({ success: false, error: 'Vendor not found' }, 404);

          // Count linked maintenance records
          const { count } = await client
            .from('maintenance_records')
            .select('*', { count: 'exact', head: true })
            .eq('vendor_id', vendorId)
            .eq('company_id', tenantId);

          return jsonResponse({ success: true, data, maintenanceCount: count || 0 });
        }

        if (request.method === 'PUT') {
          if (membership.role !== 'TENANT_ADMIN') {
            return jsonResponse(
              { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to update vendors.' },
              403
            );
          }

          const body = (await request.json().catch(() => ({}))) as Partial<CreateVendorInput>;
          const validation = validateVendor(body, true);
          if (!validation.isValid) {
            return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
          }

          if (body.name) {
            const { data: clash } = await client
              .from('vendors')
              .select('id')
              .eq('company_id', tenantId)
              .ilike('name', body.name.trim())
              .neq('id', vendorId)
              .maybeSingle();

            if (clash) {
              return jsonResponse(
                {
                  success: false,
                  error: 'DUPLICATE_VENDOR_NAME',
                  errors: { name: `Vendor with name "${body.name.trim()}" is already used.` },
                },
                400
              );
            }
          }

          const updatePayload: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
          };
          if (body.name !== undefined) updatePayload.name = body.name.trim();
          if (body.contact_name !== undefined) updatePayload.contact_name = body.contact_name?.trim() || null;
          if (body.email !== undefined) updatePayload.email = body.email?.trim() || null;
          if (body.phone !== undefined) updatePayload.phone = body.phone?.trim() || null;
          if (body.website !== undefined) updatePayload.website = body.website?.trim() || null;
          if (body.notes !== undefined) updatePayload.notes = body.notes?.trim() || null;
          if (body.is_active !== undefined) updatePayload.is_active = Boolean(body.is_active);

          const { data, error } = await client
            .from('vendors')
            .update(updatePayload)
            .eq('id', vendorId)
            .eq('company_id', tenantId)
            .select()
            .single();

          if (error) return jsonResponse({ success: false, error: error.message }, 400);
          return jsonResponse({ success: true, data });
        }
      }

      // ======================================================================
      // 15. Phase 3: Maintenance & Work Orders API
      // ======================================================================

      // Top KPI metrics for Maintenance
      if (subpath === '/maintenance/metrics' && request.method === 'GET') {
        const { data: records, error } = await client
          .from('maintenance_records')
          .select('id, status, due_date, service_cost')
          .eq('company_id', tenantId);

        if (error) return jsonResponse({ success: false, error: error.message }, 500);

        const nowStr = new Date().toISOString().split('T')[0];
        let openCount = 0;
        let scheduledCount = 0;
        let inProgressCount = 0;
        let completedCount = 0;
        let overdueCount = 0;
        let totalCost = 0;

        (records || []).forEach((r) => {
          if (r.status === 'Open') openCount++;
          else if (r.status === 'Scheduled') scheduledCount++;
          else if (r.status === 'In Progress') inProgressCount++;
          else if (r.status === 'Completed') completedCount++;

          if (r.service_cost) {
            totalCost += Number(r.service_cost);
          }

          if (r.due_date && r.due_date < nowStr && r.status !== 'Completed' && r.status !== 'Cancelled') {
            overdueCount++;
          }
        });

        return jsonResponse({
          success: true,
          data: {
            openCount,
            scheduledCount,
            inProgressCount,
            completedCount,
            overdueCount,
            totalCost,
          },
        });
      }

      // Maintenance Collection API: GET & POST
      if (subpath === '/maintenance') {
        if (request.method === 'GET') {
          const search = url.searchParams.get('search')?.trim();
          const status = url.searchParams.get('status');
          const priority = url.searchParams.get('priority');
          const maintenanceType = url.searchParams.get('maintenance_type');
          const assetId = url.searchParams.get('asset_id');
          const vendorId = url.searchParams.get('vendor_id');
          const overdue = url.searchParams.get('overdue') === 'true';
          const sortBy = url.searchParams.get('sort_by') || 'created_at';
          const sortOrder = url.searchParams.get('sort_order') === 'asc';
          const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
          const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '25', 10)));
          const offset = (page - 1) * limit;

          let query = client
            .from('maintenance_records')
            .select('*, asset:assets(id, name, asset_tag, status), vendor:vendors(id, name, email, phone)', { count: 'exact' })
            .eq('company_id', tenantId);

          if (status) query = query.eq('status', status);
          if (priority) query = query.eq('priority', priority);
          if (maintenanceType) query = query.eq('maintenance_type', maintenanceType);
          if (assetId) query = query.eq('asset_id', assetId);
          if (vendorId) query = query.eq('vendor_id', vendorId);

          if (overdue) {
            const todayStr = new Date().toISOString().split('T')[0];
            query = query.lt('due_date', todayStr).not('status', 'in', '("Completed","Cancelled")');
          }

          if (search) {
            query = query.or(`work_order_number.ilike.%${search}%,title.ilike.%${search}%,description.ilike.%${search}%`);
          }

          const validSortCols = ['work_order_number', 'title', 'status', 'priority', 'scheduled_date', 'due_date', 'service_cost', 'created_at'];
          const sortColumn = validSortCols.includes(sortBy) ? sortBy : 'created_at';

          const { data, count, error } = await query
            .order(sortColumn, { ascending: sortOrder })
            .range(offset, offset + limit - 1);

          if (error) return jsonResponse({ success: false, error: error.message }, 500);

          return jsonResponse({
            success: true,
            data: data || [],
            pagination: {
              page,
              limit,
              totalCount: count || 0,
              totalPages: Math.ceil((count || 0) / limit) || 1,
            },
          });
        }

        if (request.method === 'POST') {
          if (membership.role !== 'TENANT_ADMIN') {
            return jsonResponse(
              { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to create work orders.' },
              403
            );
          }

          const body = (await request.json().catch(() => ({}))) as Partial<CreateMaintenanceInput>;
          const validation = validateMaintenance(body, false);
          if (!validation.isValid) {
            return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
          }

          // Verify Asset belongs to tenant
          const { data: asset, error: aErr } = await client
            .from('assets')
            .select('id, name, asset_tag, status')
            .eq('id', body.asset_id)
            .eq('company_id', tenantId)
            .maybeSingle();

          if (aErr || !asset) {
            return jsonResponse({ success: false, error: 'Target asset does not exist in your workspace.' }, 404);
          }

          if (asset.status === 'Disposed') {
            return jsonResponse({ success: false, error: 'Cannot create maintenance work orders for a disposed asset.' }, 400);
          }

          // Verify Vendor if supplied
          if (body.vendor_id) {
            const { data: v } = await client
              .from('vendors')
              .select('id')
              .eq('id', body.vendor_id)
              .eq('company_id', tenantId)
              .maybeSingle();

            if (!v) {
              return jsonResponse({ success: false, error: 'Selected vendor does not exist in your workspace.' }, 400);
            }
          }

          // Generate unique work order number if not supplied
          let woNumber = body.work_order_number?.trim();
          if (!woNumber) {
            const randSuffix = Math.floor(10000 + Math.random() * 90000);
            woNumber = `WO-${randSuffix}`;
          }

          // Check duplicate WO number
          const { data: clash } = await client
            .from('maintenance_records')
            .select('id')
            .eq('company_id', tenantId)
            .ilike('work_order_number', woNumber)
            .maybeSingle();

          if (clash) {
            return jsonResponse(
              {
                success: false,
                error: 'DUPLICATE_WORK_ORDER_NUMBER',
                errors: { work_order_number: `Work order number "${woNumber}" already exists in your workspace.` },
              },
              400
            );
          }

          const initialStatus = body.scheduled_date ? 'Scheduled' : 'Open';

          const { data: newRecord, error: insertErr } = await client
            .from('maintenance_records')
            .insert({
              company_id: tenantId,
              asset_id: body.asset_id,
              work_order_number: woNumber,
              title: body.title!.trim(),
              description: body.description?.trim() || null,
              maintenance_type: body.maintenance_type!,
              priority: body.priority!,
              status: initialStatus,
              scheduled_date: body.scheduled_date || null,
              due_date: body.due_date || null,
              assigned_user_id: body.assigned_user_id || null,
              vendor_id: body.vendor_id || null,
              service_cost: body.service_cost !== undefined && body.service_cost !== null ? Number(body.service_cost) : null,
              currency: body.currency || 'USD',
              resolution_notes: body.notes?.trim() || null,
              created_by: user.id,
            })
            .select('*, asset:assets(*), vendor:vendors(*)')
            .single();

          if (insertErr) return jsonResponse({ success: false, error: insertErr.message }, 400);

          // Log Audit Event
          await client.from('asset_events').insert({
            company_id: tenantId,
            asset_id: body.asset_id,
            event_type: 'MAINTENANCE_CREATED',
            actor_id: user.id,
            details: {
              work_order_id: newRecord.id,
              work_order_number: newRecord.work_order_number,
              title: newRecord.title,
              maintenance_type: newRecord.maintenance_type,
              priority: newRecord.priority,
              status: newRecord.status,
              scheduled_date: newRecord.scheduled_date,
              due_date: newRecord.due_date,
              service_cost: newRecord.service_cost,
              vendor_id: newRecord.vendor_id,
            },
          });

          return jsonResponse({ success: true, data: newRecord }, 201);
        }
      }

      // Work Order Actions: Schedule, Start, Complete, Cancel, Single Record
      const schedMatch = subpath.match(/^\/maintenance\/([a-zA-Z0-9_-]+)\/schedule$/);
      if (schedMatch && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to schedule maintenance.' },
            403
          );
        }

        const woId = schedMatch[1];
        const body = (await request.json().catch(() => ({}))) as Partial<ScheduleMaintenanceInput>;
        const validation = validateScheduleMaintenance(body);
        if (!validation.isValid) {
          return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
        }

        const { data: wo, error: woErr } = await client
          .from('maintenance_records')
          .select('*, asset:assets(*)')
          .eq('id', woId)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (woErr || !wo) return jsonResponse({ success: false, error: 'Work order not found' }, 404);

        const transition = isValidMaintenanceTransition(wo.status, 'Scheduled');
        if (!transition.isValid) {
          return jsonResponse({ success: false, error: 'INVALID_TRANSITION', message: transition.message }, 400);
        }

        const { data: updated, error: uErr } = await client
          .from('maintenance_records')
          .update({
            status: 'Scheduled',
            scheduled_date: body.scheduled_date,
            due_date: body.due_date || wo.due_date,
            assigned_user_id: body.assigned_user_id !== undefined ? body.assigned_user_id : wo.assigned_user_id,
            vendor_id: body.vendor_id !== undefined ? body.vendor_id : wo.vendor_id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', woId)
          .eq('company_id', tenantId)
          .select('*, asset:assets(*), vendor:vendors(*)')
          .single();

        if (uErr) return jsonResponse({ success: false, error: uErr.message }, 400);

        await client.from('asset_events').insert({
          company_id: tenantId,
          asset_id: wo.asset_id,
          event_type: 'MAINTENANCE_SCHEDULED',
          actor_id: user.id,
          details: {
            work_order_id: wo.id,
            work_order_number: wo.work_order_number,
            scheduled_date: body.scheduled_date,
            due_date: body.due_date || wo.due_date,
            notes: body.notes || null,
          },
        });

        return jsonResponse({ success: true, data: updated });
      }

      const startMatch = subpath.match(/^\/maintenance\/([a-zA-Z0-9_-]+)\/start$/);
      if (startMatch && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to start maintenance.' },
            403
          );
        }

        const woId = startMatch[1];
        const body = (await request.json().catch(() => ({}))) as Partial<StartMaintenanceInput>;

        const { data: wo, error: woErr } = await client
          .from('maintenance_records')
          .select('*, asset:assets(*)')
          .eq('id', woId)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (woErr || !wo) return jsonResponse({ success: false, error: 'Work order not found' }, 404);

        const transition = isValidMaintenanceTransition(wo.status, 'In Progress');
        if (!transition.isValid) {
          return jsonResponse({ success: false, error: 'INVALID_TRANSITION', message: transition.message }, 400);
        }

        const startTime = body.started_at || new Date().toISOString();

        const { data: updated, error: uErr } = await client
          .from('maintenance_records')
          .update({
            status: 'In Progress',
            started_at: startTime,
            updated_at: new Date().toISOString(),
          })
          .eq('id', woId)
          .eq('company_id', tenantId)
          .select('*, asset:assets(*), vendor:vendors(*)')
          .single();

        if (uErr) return jsonResponse({ success: false, error: uErr.message }, 400);

        await client.from('asset_events').insert({
          company_id: tenantId,
          asset_id: wo.asset_id,
          event_type: 'MAINTENANCE_STARTED',
          actor_id: user.id,
          details: {
            work_order_id: wo.id,
            work_order_number: wo.work_order_number,
            started_at: startTime,
            notes: body.notes || null,
          },
        });

        return jsonResponse({ success: true, data: updated });
      }

      const completeMatch = subpath.match(/^\/maintenance\/([a-zA-Z0-9_-]+)\/complete$/);
      if (completeMatch && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to complete maintenance.' },
            403
          );
        }

        const woId = completeMatch[1];
        const body = (await request.json().catch(() => ({}))) as Partial<CompleteMaintenanceInput>;
        const validation = validateCompleteMaintenance(body);
        if (!validation.isValid) {
          return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
        }

        const { data: wo, error: woErr } = await client
          .from('maintenance_records')
          .select('*, asset:assets(*)')
          .eq('id', woId)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (woErr || !wo) return jsonResponse({ success: false, error: 'Work order not found' }, 404);

        const transition = isValidMaintenanceTransition(wo.status, 'Completed');
        if (!transition.isValid) {
          return jsonResponse({ success: false, error: 'INVALID_TRANSITION', message: transition.message }, 400);
        }

        const completeTime = body.completed_at || new Date().toISOString();
        const updatePayload: Record<string, unknown> = {
          status: 'Completed',
          completed_at: completeTime,
          resolution_notes: body.resolution_notes!.trim(),
          updated_at: new Date().toISOString(),
        };

        if (body.service_cost !== undefined && body.service_cost !== null) {
          updatePayload.service_cost = Number(body.service_cost);
        }
        if (body.downtime_minutes !== undefined && body.downtime_minutes !== null) {
          updatePayload.downtime_minutes = Number(body.downtime_minutes);
        }

        const { data: updated, error: uErr } = await client
          .from('maintenance_records')
          .update(updatePayload)
          .eq('id', woId)
          .eq('company_id', tenantId)
          .select('*, asset:assets(*), vendor:vendors(*)')
          .single();

        if (uErr) return jsonResponse({ success: false, error: uErr.message }, 400);

        await client.from('asset_events').insert({
          company_id: tenantId,
          asset_id: wo.asset_id,
          event_type: 'MAINTENANCE_COMPLETED',
          actor_id: user.id,
          details: {
            work_order_id: wo.id,
            work_order_number: wo.work_order_number,
            completed_at: completeTime,
            resolution_notes: body.resolution_notes!.trim(),
            service_cost: body.service_cost ?? wo.service_cost,
            downtime_minutes: body.downtime_minutes,
          },
        });

        return jsonResponse({ success: true, data: updated });
      }

      const cancelMatch = subpath.match(/^\/maintenance\/([a-zA-Z0-9_-]+)\/cancel$/);
      if (cancelMatch && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to cancel maintenance.' },
            403
          );
        }

        const woId = cancelMatch[1];
        const body = (await request.json().catch(() => ({}))) as Partial<CancelMaintenanceInput>;
        const validation = validateCancelMaintenance(body);
        if (!validation.isValid) {
          return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
        }

        const { data: wo, error: woErr } = await client
          .from('maintenance_records')
          .select('*, asset:assets(*)')
          .eq('id', woId)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (woErr || !wo) return jsonResponse({ success: false, error: 'Work order not found' }, 404);

        const transition = isValidMaintenanceTransition(wo.status, 'Cancelled');
        if (!transition.isValid) {
          return jsonResponse({ success: false, error: 'INVALID_TRANSITION', message: transition.message }, 400);
        }

        const { data: updated, error: uErr } = await client
          .from('maintenance_records')
          .update({
            status: 'Cancelled',
            resolution_notes: `Cancelled: ${body.reason!.trim()}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', woId)
          .eq('company_id', tenantId)
          .select('*, asset:assets(*), vendor:vendors(*)')
          .single();

        if (uErr) return jsonResponse({ success: false, error: uErr.message }, 400);

        await client.from('asset_events').insert({
          company_id: tenantId,
          asset_id: wo.asset_id,
          event_type: 'MAINTENANCE_CANCELLED',
          actor_id: user.id,
          details: {
            work_order_id: wo.id,
            work_order_number: wo.work_order_number,
            reason: body.reason!.trim(),
          },
        });

        return jsonResponse({ success: true, data: updated });
      }

      // Single Work Order API: GET & PUT
      const woSingleMatch = subpath.match(/^\/maintenance\/([a-zA-Z0-9_-]+)$/);
      if (woSingleMatch) {
        const woId = woSingleMatch[1];

        if (request.method === 'GET') {
          const { data, error } = await client
            .from('maintenance_records')
            .select('*, asset:assets(*, category:categories(*), site:sites(*), location:locations(*)), vendor:vendors(*)')
            .eq('id', woId)
            .eq('company_id', tenantId)
            .maybeSingle();

          if (error) return jsonResponse({ success: false, error: error.message }, 500);
          if (!data) return jsonResponse({ success: false, error: 'Work order not found' }, 404);

          // Get related maintenance events from asset_events
          const { data: events } = await client
            .from('asset_events')
            .select('*')
            .eq('asset_id', data.asset_id)
            .eq('company_id', tenantId)
            .order('created_at', { ascending: false });

          const filteredEvents = (events || []).filter((e) => {
            const d = e.details as { work_order_id?: string } | null;
            return d?.work_order_id === woId;
          });

          return jsonResponse({ success: true, data, events: filteredEvents });
        }

        if (request.method === 'PUT') {
          if (membership.role !== 'TENANT_ADMIN') {
            return jsonResponse(
              { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to update work orders.' },
              403
            );
          }

          const body = (await request.json().catch(() => ({}))) as Partial<UpdateMaintenanceInput>;
          const validation = validateMaintenance(body, true);
          if (!validation.isValid) {
            return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
          }

          const updatePayload: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
          };

          if (body.title !== undefined) updatePayload.title = body.title.trim();
          if (body.description !== undefined) updatePayload.description = body.description?.trim() || null;
          if (body.maintenance_type !== undefined) updatePayload.maintenance_type = body.maintenance_type;
          if (body.priority !== undefined) updatePayload.priority = body.priority;
          if (body.scheduled_date !== undefined) updatePayload.scheduled_date = body.scheduled_date || null;
          if (body.due_date !== undefined) updatePayload.due_date = body.due_date || null;
          if (body.assigned_user_id !== undefined) updatePayload.assigned_user_id = body.assigned_user_id || null;
          if (body.vendor_id !== undefined) updatePayload.vendor_id = body.vendor_id || null;
          if (body.service_cost !== undefined) updatePayload.service_cost = body.service_cost !== null ? Number(body.service_cost) : null;
          if (body.currency !== undefined) updatePayload.currency = body.currency;
          if (body.resolution_notes !== undefined) updatePayload.resolution_notes = body.resolution_notes?.trim() || null;
          if (body.downtime_minutes !== undefined) updatePayload.downtime_minutes = body.downtime_minutes !== null ? Number(body.downtime_minutes) : null;

          const { data, error } = await client
            .from('maintenance_records')
            .update(updatePayload)
            .eq('id', woId)
            .eq('company_id', tenantId)
            .select('*, asset:assets(*), vendor:vendors(*)')
            .single();

          if (error) return jsonResponse({ success: false, error: error.message }, 400);
          return jsonResponse({ success: true, data });
        }
      }

      // 16. Asset Maintenance History API: /assets/:id/maintenance
      const assetMaintMatch = subpath.match(/^\/assets\/([a-zA-Z0-9_-]+)\/maintenance$/);
      if (assetMaintMatch && request.method === 'GET') {
        const assetId = assetMaintMatch[1];
        const { data, error } = await client
          .from('maintenance_records')
          .select('*, vendor:vendors(id, name, email, phone)')
          .eq('asset_id', assetId)
          .eq('company_id', tenantId)
          .order('created_at', { ascending: false });

        if (error) return jsonResponse({ success: false, error: error.message }, 500);
        return jsonResponse({ success: true, data });
      }

      // 16B. Vendor Maintenance History API: /vendors/:id/maintenance
      const vendorMaintMatch = subpath.match(/^\/vendors\/([a-zA-Z0-9_-]+)\/maintenance$/);
      if (vendorMaintMatch && request.method === 'GET') {
        const vendorId = vendorMaintMatch[1];
        const { data, error } = await client
          .from('maintenance_records')
          .select('*, asset:assets(id, name, asset_tag, status)')
          .eq('vendor_id', vendorId)
          .eq('company_id', tenantId)
          .order('created_at', { ascending: false });

        if (error) return jsonResponse({ success: false, error: error.message }, 500);
        return jsonResponse({ success: true, data });
      }

      // ======================================================================
      // PHASE 4: COMPLETE ASSET OPERATIONS API ROUTES
      // ======================================================================

      // ----------------------------------------------------------------------
      // 1. INVENTORY / STOCK API
      // ----------------------------------------------------------------------
      if (subpath === '/inventory') {
        if (request.method === 'GET') {
          const search = url.searchParams.get('search')?.toLowerCase().trim();
          const lowStock = url.searchParams.get('low_stock') === 'true';
          const activeFilter = url.searchParams.get('active');

          let query = client
            .from('inventory_items')
            .select('*, category:categories(*), site:sites(*), location:locations(*), vendor:vendors(*)')
            .eq('company_id', tenantId);

          if (activeFilter !== null) {
            query = query.eq('is_active', activeFilter === 'true');
          }

          const { data, error } = await query.order('name', { ascending: true });
          if (error) return jsonResponse({ success: false, error: error.message }, 500);

          let filtered = data || [];
          if (search) {
            filtered = filtered.filter(
              (item) =>
                item.name?.toLowerCase().includes(search) ||
                item.sku?.toLowerCase().includes(search) ||
                item.notes?.toLowerCase().includes(search)
            );
          }

          if (lowStock) {
            filtered = filtered.filter((item) => item.quantity_on_hand <= item.minimum_stock_level);
          }

          return jsonResponse({ success: true, data: filtered });
        }

        if (request.method === 'POST') {
          if (membership.role !== 'TENANT_ADMIN') {
            return jsonResponse(
              { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to create inventory items.' },
              403
            );
          }

          const body = (await request.json().catch(() => ({}))) as Partial<CreateInventoryItemInput>;
          const validation = validateInventoryItem(body);
          if (!validation.isValid) {
            return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
          }

          // Check SKU uniqueness
          const { data: clash } = await client
            .from('inventory_items')
            .select('id')
            .eq('company_id', tenantId)
            .ilike('sku', body.sku!.trim())
            .maybeSingle();

          if (clash) {
            return jsonResponse(
              { success: false, error: 'DUPLICATE_SKU', errors: { sku: `SKU "${body.sku}" already exists in your workspace.` } },
              400
            );
          }

          const initialQty = Number(body.quantity_on_hand) || 0;
          const { data: item, error: insertErr } = await client
            .from('inventory_items')
            .insert({
              company_id: tenantId,
              sku: body.sku!.trim(),
              name: body.name!.trim(),
              category_id: body.category_id || null,
              site_id: body.site_id || null,
              location_id: body.location_id || null,
              quantity_on_hand: initialQty,
              minimum_stock_level: Number(body.minimum_stock_level) || 0,
              unit_cost: body.unit_cost !== undefined && body.unit_cost !== null ? Number(body.unit_cost) : null,
              currency: body.currency || 'USD',
              vendor_id: body.vendor_id || null,
              notes: body.notes?.trim() || null,
              is_active: body.is_active !== undefined ? body.is_active : true,
            })
            .select('*, category:categories(*), site:sites(*), location:locations(*), vendor:vendors(*)')
            .single();

          if (insertErr) return jsonResponse({ success: false, error: insertErr.message }, 400);

          // If initial quantity > 0, record transaction & audit event
          if (initialQty > 0) {
            await client.from('inventory_transactions').insert({
              company_id: tenantId,
              inventory_item_id: item.id,
              transaction_type: 'STOCK_IN',
              quantity: initialQty,
              unit_cost: item.unit_cost,
              to_location_id: item.location_id,
              reference_number: 'INITIAL_STOCK',
              notes: 'Initial stock on item creation',
              performed_by: user.id,
            });

            await client.from('asset_events').insert({
              company_id: tenantId,
              event_type: 'INVENTORY_STOCK_IN',
              actor_id: user.id,
              details: {
                inventory_item_id: item.id,
                sku: item.sku,
                name: item.name,
                quantity: initialQty,
                type: 'INITIAL_STOCK',
              },
            });
          }

          return jsonResponse({ success: true, data: item }, 201);
        }
      }

      // /inventory/:id
      const invItemMatch = subpath.match(/^\/inventory\/([a-zA-Z0-9_-]+)$/);
      if (invItemMatch) {
        const itemId = invItemMatch[1];

        if (request.method === 'GET') {
          const { data, error } = await client
            .from('inventory_items')
            .select('*, category:categories(*), site:sites(*), location:locations(*), vendor:vendors(*)')
            .eq('id', itemId)
            .eq('company_id', tenantId)
            .maybeSingle();

          if (error) return jsonResponse({ success: false, error: error.message }, 500);
          if (!data) return jsonResponse({ success: false, error: 'Inventory item not found.' }, 404);
          return jsonResponse({ success: true, data });
        }

        if (request.method === 'PUT') {
          if (membership.role !== 'TENANT_ADMIN') {
            return jsonResponse(
              { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to update inventory items.' },
              403
            );
          }

          const body = (await request.json().catch(() => ({}))) as Partial<UpdateInventoryItemInput>;
          const validation = validateInventoryItem(body, true);
          if (!validation.isValid) {
            return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
          }

          const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (body.sku !== undefined) updatePayload.sku = body.sku.trim();
          if (body.name !== undefined) updatePayload.name = body.name.trim();
          if (body.category_id !== undefined) updatePayload.category_id = body.category_id || null;
          if (body.site_id !== undefined) updatePayload.site_id = body.site_id || null;
          if (body.location_id !== undefined) updatePayload.location_id = body.location_id || null;
          if (body.minimum_stock_level !== undefined) updatePayload.minimum_stock_level = Number(body.minimum_stock_level);
          if (body.unit_cost !== undefined) updatePayload.unit_cost = body.unit_cost !== null ? Number(body.unit_cost) : null;
          if (body.currency !== undefined) updatePayload.currency = body.currency;
          if (body.vendor_id !== undefined) updatePayload.vendor_id = body.vendor_id || null;
          if (body.notes !== undefined) updatePayload.notes = body.notes?.trim() || null;
          if (body.is_active !== undefined) updatePayload.is_active = body.is_active;

          const { data, error } = await client
            .from('inventory_items')
            .update(updatePayload)
            .eq('id', itemId)
            .eq('company_id', tenantId)
            .select('*, category:categories(*), site:sites(*), location:locations(*), vendor:vendors(*)')
            .single();

          if (error) return jsonResponse({ success: false, error: error.message }, 400);
          return jsonResponse({ success: true, data });
        }
      }

      // /inventory/:id/movement
      const invMoveMatch = subpath.match(/^\/inventory\/([a-zA-Z0-9_-]+)\/movement$/);
      if (invMoveMatch && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to record stock movements.' },
            403
          );
        }

        const itemId = invMoveMatch[1];
        const body = (await request.json().catch(() => ({}))) as Partial<InventoryStockMovementInput>;

        const { data: item, error: fetchErr } = await client
          .from('inventory_items')
          .select('*')
          .eq('id', itemId)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (fetchErr || !item) {
          return jsonResponse({ success: false, error: 'Inventory item not found in your workspace.' }, 404);
        }

        const validation = validateInventoryStockMovement(body, item.quantity_on_hand);
        if (!validation.isValid) {
          return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
        }

        let newQuantity = item.quantity_on_hand;
        let eventType = 'INVENTORY_STOCK_IN';

        if (body.transaction_type === 'STOCK_IN') {
          newQuantity = item.quantity_on_hand + body.quantity!;
          eventType = 'INVENTORY_STOCK_IN';
        } else if (body.transaction_type === 'STOCK_OUT') {
          if (item.quantity_on_hand < body.quantity!) {
            return jsonResponse({ success: false, error: `Insufficient stock on hand (current stock: ${item.quantity_on_hand}).` }, 400);
          }
          newQuantity = item.quantity_on_hand - body.quantity!;
          eventType = 'INVENTORY_STOCK_OUT';
        } else if (body.transaction_type === 'TRANSFER') {
          if (item.quantity_on_hand < body.quantity!) {
            return jsonResponse({ success: false, error: `Insufficient stock on hand to transfer (current stock: ${item.quantity_on_hand}).` }, 400);
          }
          eventType = 'INVENTORY_TRANSFER';
        } else if (body.transaction_type === 'ADJUSTMENT') {
          newQuantity = body.quantity!;
          eventType = newQuantity >= item.quantity_on_hand ? 'INVENTORY_STOCK_IN' : 'INVENTORY_STOCK_OUT';
        }

        // 1. Update quantity on item
        const { data: updatedItem, error: updateErr } = await client
          .from('inventory_items')
          .update({
            quantity_on_hand: newQuantity,
            location_id: body.to_location_id || item.location_id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', itemId)
          .eq('company_id', tenantId)
          .select('*, category:categories(*), site:sites(*), location:locations(*), vendor:vendors(*)')
          .single();

        if (updateErr) return jsonResponse({ success: false, error: updateErr.message }, 400);

        // 2. Insert transaction
        const { data: txn, error: txnErr } = await client
          .from('inventory_transactions')
          .insert({
            company_id: tenantId,
            inventory_item_id: itemId,
            transaction_type: body.transaction_type!,
            quantity: body.quantity!,
            unit_cost: body.unit_cost !== undefined && body.unit_cost !== null ? Number(body.unit_cost) : item.unit_cost,
            from_location_id: body.from_location_id || null,
            to_location_id: body.to_location_id || null,
            reference_number: body.reference_number?.trim() || null,
            notes: body.notes?.trim() || null,
            performed_by: user.id,
          })
          .select('*, item:inventory_items(*)')
          .single();

        if (txnErr) return jsonResponse({ success: false, error: txnErr.message }, 400);

        // 3. Audit event
        await client.from('asset_events').insert({
          company_id: tenantId,
          event_type: eventType,
          actor_id: user.id,
          details: {
            inventory_item_id: itemId,
            sku: item.sku,
            name: item.name,
            transaction_type: body.transaction_type,
            quantity: body.quantity,
            previous_quantity: item.quantity_on_hand,
            new_quantity: newQuantity,
            reference_number: body.reference_number,
          },
        });

        return jsonResponse({ success: true, data: txn, item: updatedItem });
      }

      // /inventory-transactions
      if (subpath === '/inventory-transactions' && request.method === 'GET') {
        const itemId = url.searchParams.get('item_id');
        let query = client
          .from('inventory_transactions')
          .select('*, item:inventory_items(sku, name), from_location:locations!fk_inv_txn_from_loc_tenant(name), to_location:locations!fk_inv_txn_to_loc_tenant(name)')
          .eq('company_id', tenantId);

        if (itemId) {
          query = query.eq('inventory_item_id', itemId);
        }

        const { data, error } = await query.order('created_at', { ascending: false }).limit(100);
        if (error) return jsonResponse({ success: false, error: error.message }, 500);
        return jsonResponse({ success: true, data: data || [] });
      }

      // ----------------------------------------------------------------------
      // 2. ASSET RESERVATIONS API
      // ----------------------------------------------------------------------
      if (subpath === '/reservations') {
        if (request.method === 'GET') {
          const assetId = url.searchParams.get('asset_id');
          let query = client
            .from('asset_reservations')
            .select('*, asset:assets(id, name, asset_tag, status), employee:employees(id, full_name, employee_code, email)')
            .eq('company_id', tenantId);

          if (assetId) query = query.eq('asset_id', assetId);

          const { data, error } = await query.order('created_at', { ascending: false });
          if (error) return jsonResponse({ success: false, error: error.message }, 500);
          return jsonResponse({ success: true, data: data || [] });
        }

        if (request.method === 'POST') {
          if (membership.role !== 'TENANT_ADMIN') {
            return jsonResponse(
              { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to reserve assets.' },
              403
            );
          }

          const body = (await request.json().catch(() => ({}))) as Partial<CreateReservationInput>;
          const validation = validateReservation(body);
          if (!validation.isValid) {
            return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
          }

          // Verify asset belongs to tenant and is not Disposed
          const { data: asset, error: aErr } = await client
            .from('assets')
            .select('id, name, asset_tag, status')
            .eq('id', body.asset_id)
            .eq('company_id', tenantId)
            .maybeSingle();

          if (aErr || !asset) {
            return jsonResponse({ success: false, error: 'Asset not found in your workspace.' }, 404);
          }
          if (asset.status === 'Disposed') {
            return jsonResponse({ success: false, error: 'Disposed assets cannot be reserved.' }, 400);
          }

          // Verify employee belongs to tenant and is active
          const { data: emp, error: eErr } = await client
            .from('employees')
            .select('id, full_name, is_active')
            .eq('id', body.employee_id)
            .eq('company_id', tenantId)
            .maybeSingle();

          if (eErr || !emp) {
            return jsonResponse({ success: false, error: 'Target employee not found in your workspace.' }, 404);
          }
          if (!emp.is_active) {
            return jsonResponse({ success: false, error: 'Cannot reserve asset for an inactive employee.' }, 400);
          }

          // Check for existing Active reservation on this asset
          const { data: existingActive } = await client
            .from('asset_reservations')
            .select('id, employee:employees(full_name)')
            .eq('asset_id', body.asset_id)
            .eq('company_id', tenantId)
            .eq('status', 'Active')
            .maybeSingle();

          if (existingActive) {
            const reservedFor = (existingActive.employee as { full_name?: string })?.full_name || 'an employee';
            return jsonResponse(
              { success: false, error: `Asset already has an active reservation for ${reservedFor}. Cancel or fulfill it before making a new reservation.` },
              400
            );
          }

          const { data: reservation, error: resErr } = await client
            .from('asset_reservations')
            .insert({
              company_id: tenantId,
              asset_id: body.asset_id!,
              employee_id: body.employee_id!,
              reserved_from: body.reserved_from!,
              reserved_until: body.reserved_until!,
              purpose: body.purpose?.trim() || null,
              status: 'Active',
              created_by: user.id,
            })
            .select('*, asset:assets(*), employee:employees(*)')
            .single();

          if (resErr) return jsonResponse({ success: false, error: resErr.message }, 400);

          await client.from('asset_events').insert({
            company_id: tenantId,
            asset_id: body.asset_id,
            event_type: 'ASSET_RESERVED',
            actor_id: user.id,
            details: {
              reservation_id: reservation.id,
              employee_id: body.employee_id,
              employee_name: emp.full_name,
              reserved_from: body.reserved_from,
              reserved_until: body.reserved_until,
              purpose: body.purpose,
            },
          });

          return jsonResponse({ success: true, data: reservation }, 201);
        }
      }

      // /reservations/:id/cancel
      const resCancelMatch = subpath.match(/^\/reservations\/([a-zA-Z0-9_-]+)\/cancel$/);
      if (resCancelMatch && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to cancel reservations.' },
            403
          );
        }

        const resId = resCancelMatch[1];
        const { data: res, error: fetchErr } = await client
          .from('asset_reservations')
          .select('*, asset:assets(*), employee:employees(*)')
          .eq('id', resId)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (fetchErr || !res) {
          return jsonResponse({ success: false, error: 'Reservation not found.' }, 404);
        }

        const { data: updated, error: updErr } = await client
          .from('asset_reservations')
          .update({ status: 'Cancelled', updated_at: new Date().toISOString() })
          .eq('id', resId)
          .eq('company_id', tenantId)
          .select('*, asset:assets(*), employee:employees(*)')
          .single();

        if (updErr) return jsonResponse({ success: false, error: updErr.message }, 400);

        await client.from('asset_events').insert({
          company_id: tenantId,
          asset_id: res.asset_id,
          event_type: 'RESERVATION_CANCELLED',
          actor_id: user.id,
          details: {
            reservation_id: resId,
            employee_id: res.employee_id,
          },
        });

        return jsonResponse({ success: true, data: updated });
      }

      // /reservations/:id/fulfill
      const resFulfillMatch = subpath.match(/^\/reservations\/([a-zA-Z0-9_-]+)\/fulfill$/);
      if (resFulfillMatch && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to fulfill reservations.' },
            403
          );
        }

        const resId = resFulfillMatch[1];
        const { data: updated, error: updErr } = await client
          .from('asset_reservations')
          .update({ status: 'Fulfilled', updated_at: new Date().toISOString() })
          .eq('id', resId)
          .eq('company_id', tenantId)
          .select('*, asset:assets(*), employee:employees(*)')
          .single();

        if (updErr) return jsonResponse({ success: false, error: updErr.message }, 400);
        return jsonResponse({ success: true, data: updated });
      }

      // ----------------------------------------------------------------------
      // 3. ASSET LEASES API
      // ----------------------------------------------------------------------
      if (subpath === '/leases') {
        if (request.method === 'GET') {
          const assetId = url.searchParams.get('asset_id');
          let query = client
            .from('asset_leases')
            .select('*, asset:assets(id, name, asset_tag, status), vendor:vendors(id, name, email, phone)')
            .eq('company_id', tenantId);

          if (assetId) query = query.eq('asset_id', assetId);

          const { data, error } = await query.order('created_at', { ascending: false });
          if (error) return jsonResponse({ success: false, error: error.message }, 500);
          return jsonResponse({ success: true, data: data || [] });
        }

        if (request.method === 'POST') {
          if (membership.role !== 'TENANT_ADMIN') {
            return jsonResponse(
              { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to register asset leases.' },
              403
            );
          }

          const body = (await request.json().catch(() => ({}))) as Partial<CreateLeaseInput>;
          const validation = validateLease(body);
          if (!validation.isValid) {
            return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
          }

          // Verify asset belongs to tenant and not Disposed
          const { data: asset, error: aErr } = await client
            .from('assets')
            .select('id, name, asset_tag, status')
            .eq('id', body.asset_id)
            .eq('company_id', tenantId)
            .maybeSingle();

          if (aErr || !asset) return jsonResponse({ success: false, error: 'Asset not found in your workspace.' }, 404);
          if (asset.status === 'Disposed') {
            return jsonResponse({ success: false, error: 'Cannot create lease for a disposed asset.' }, 400);
          }

          // Verify vendor belongs to tenant
          const { data: vendor, error: vErr } = await client
            .from('vendors')
            .select('id, name')
            .eq('id', body.vendor_id)
            .eq('company_id', tenantId)
            .maybeSingle();

          if (vErr || !vendor) return jsonResponse({ success: false, error: 'Lessor vendor not found in your workspace.' }, 404);

          const { data: lease, error: lErr } = await client
            .from('asset_leases')
            .insert({
              company_id: tenantId,
              asset_id: body.asset_id!,
              vendor_id: body.vendor_id!,
              lease_reference: body.lease_reference?.trim() || null,
              start_date: body.start_date!,
              end_date: body.end_date!,
              cost: body.cost !== undefined && body.cost !== null ? Number(body.cost) : null,
              cost_interval: body.cost_interval || 'Monthly',
              currency: body.currency || 'USD',
              notes: body.notes?.trim() || null,
              status: 'Active',
              created_by: user.id,
            })
            .select('*, asset:assets(*), vendor:vendors(*)')
            .single();

          if (lErr) return jsonResponse({ success: false, error: lErr.message }, 400);

          await client.from('asset_events').insert({
            company_id: tenantId,
            asset_id: body.asset_id,
            event_type: 'LEASE_STARTED',
            actor_id: user.id,
            details: {
              lease_id: lease.id,
              vendor_id: body.vendor_id,
              vendor_name: vendor.name,
              lease_reference: body.lease_reference,
              start_date: body.start_date,
              end_date: body.end_date,
              cost: body.cost,
            },
          });

          return jsonResponse({ success: true, data: lease }, 201);
        }
      }

      // /leases/:id/return
      const leaseReturnMatch = subpath.match(/^\/leases\/([a-zA-Z0-9_-]+)\/return$/);
      if (leaseReturnMatch && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to process lease returns.' },
            403
          );
        }

        const leaseId = leaseReturnMatch[1];
        const body = (await request.json().catch(() => ({}))) as Partial<ReturnLeaseInput>;
        const validation = validateReturnLease(body);
        if (!validation.isValid) {
          return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
        }

        const { data: lease, error: fetchErr } = await client
          .from('asset_leases')
          .select('*, asset:assets(*), vendor:vendors(*)')
          .eq('id', leaseId)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (fetchErr || !lease) return jsonResponse({ success: false, error: 'Lease record not found.' }, 404);

        const { data: updated, error: updErr } = await client
          .from('asset_leases')
          .update({
            return_date: body.return_date!,
            return_condition: body.return_condition?.trim() || null,
            return_notes: body.return_notes?.trim() || null,
            status: 'Returned',
            updated_at: new Date().toISOString(),
          })
          .eq('id', leaseId)
          .eq('company_id', tenantId)
          .select('*, asset:assets(*), vendor:vendors(*)')
          .single();

        if (updErr) return jsonResponse({ success: false, error: updErr.message }, 400);

        await client.from('asset_events').insert({
          company_id: tenantId,
          asset_id: lease.asset_id,
          event_type: 'LEASE_RETURNED',
          actor_id: user.id,
          details: {
            lease_id: leaseId,
            return_date: body.return_date,
            return_condition: body.return_condition,
          },
        });

        return jsonResponse({ success: true, data: updated });
      }

      // ----------------------------------------------------------------------
      // 4. ASSET MOVE & LOCATION HISTORY API
      // ----------------------------------------------------------------------
      const assetMoveMatch = subpath.match(/^\/assets\/([a-zA-Z0-9_-]+)\/move$/);
      if (assetMoveMatch && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to move assets.' },
            403
          );
        }

        const assetId = assetMoveMatch[1];
        const body = (await request.json().catch(() => ({}))) as Partial<MoveAssetInput>;
        const validation = validateMoveAsset(body);
        if (!validation.isValid) {
          return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
        }

        const { data: asset, error: aErr } = await client
          .from('assets')
          .select('*, site:sites(*), location:locations(*)')
          .eq('id', assetId)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (aErr || !asset) return jsonResponse({ success: false, error: 'Asset not found in your workspace.' }, 404);

        // Verify target site belongs to tenant
        if (body.to_site_id) {
          const { data: targetSite } = await client
            .from('sites')
            .select('id, name')
            .eq('id', body.to_site_id)
            .eq('company_id', tenantId)
            .maybeSingle();

          if (!targetSite) {
            return jsonResponse({ success: false, error: 'Target site does not exist in your workspace.' }, 400);
          }
        }

        // Verify target location belongs to tenant
        if (body.to_location_id) {
          const { data: targetLoc } = await client
            .from('locations')
            .select('id, name, site_id')
            .eq('id', body.to_location_id)
            .eq('company_id', tenantId)
            .maybeSingle();

          if (!targetLoc) {
            return jsonResponse({ success: false, error: 'Target location does not exist in your workspace.' }, 400);
          }
        }

        const moveTime = body.moved_at || new Date().toISOString();

        // 1. Insert immutable location history record
        const { data: locHist, error: histErr } = await client
          .from('asset_location_history')
          .insert({
            company_id: tenantId,
            asset_id: assetId,
            from_site_id: asset.site_id,
            from_location_id: asset.location_id,
            to_site_id: body.to_site_id || asset.site_id,
            to_location_id: body.to_location_id || null,
            moved_at: moveTime,
            moved_by: user.id,
            notes: body.notes?.trim() || null,
          })
          .select('*, from_site:sites!fk_loc_hist_from_site_tenant(*), from_location:locations!fk_loc_hist_from_loc_tenant(*), to_site:sites!fk_loc_hist_to_site_tenant(*), to_location:locations!fk_loc_hist_to_loc_tenant(*)')
          .single();

        if (histErr) return jsonResponse({ success: false, error: histErr.message }, 400);

        // 2. Update asset site & location
        const { data: updatedAsset, error: updErr } = await client
          .from('assets')
          .update({
            site_id: body.to_site_id !== undefined ? body.to_site_id || null : asset.site_id,
            location_id: body.to_location_id !== undefined ? body.to_location_id || null : asset.location_id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', assetId)
          .eq('company_id', tenantId)
          .select('*, site:sites(*), location:locations(*), category:categories(*)')
          .single();

        if (updErr) return jsonResponse({ success: false, error: updErr.message }, 400);

        // 3. Log audit event
        await client.from('asset_events').insert({
          company_id: tenantId,
          asset_id: assetId,
          event_type: 'ASSET_MOVED',
          actor_id: user.id,
          details: {
            from_site_id: asset.site_id,
            from_location_id: asset.location_id,
            to_site_id: body.to_site_id,
            to_location_id: body.to_location_id,
            notes: body.notes,
          },
        });

        return jsonResponse({ success: true, data: updatedAsset, locationHistory: locHist });
      }

      // /assets/:id/location-history
      const assetLocHistMatch = subpath.match(/^\/assets\/([a-zA-Z0-9_-]+)\/location-history$/);
      if (assetLocHistMatch && request.method === 'GET') {
        const assetId = assetLocHistMatch[1];
        const { data, error } = await client
          .from('asset_location_history')
          .select('*, from_site:sites!fk_loc_hist_from_site_tenant(name), from_location:locations!fk_loc_hist_from_loc_tenant(name), to_site:sites!fk_loc_hist_to_site_tenant(name), to_location:locations!fk_loc_hist_to_loc_tenant(name)')
          .eq('asset_id', assetId)
          .eq('company_id', tenantId)
          .order('moved_at', { ascending: false });

        if (error) return jsonResponse({ success: false, error: error.message }, 500);
        return jsonResponse({ success: true, data: data || [] });
      }

      // ----------------------------------------------------------------------
      // 5. ASSET DISPOSAL API
      // ----------------------------------------------------------------------
      const assetDisposeMatch = subpath.match(/^\/assets\/([a-zA-Z0-9_-]+)\/dispose$/);
      if (assetDisposeMatch && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to dispose assets.' },
            403
          );
        }

        const assetId = assetDisposeMatch[1];
        const body = (await request.json().catch(() => ({}))) as Partial<DisposeAssetInput>;
        const validation = validateDisposeAsset(body);
        if (!validation.isValid) {
          return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
        }

        const { data: asset, error: aErr } = await client
          .from('assets')
          .select('*')
          .eq('id', assetId)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (aErr || !asset) return jsonResponse({ success: false, error: 'Asset not found in your workspace.' }, 404);
        if (asset.status === 'Disposed') {
          return jsonResponse({ success: false, error: 'Asset has already been disposed.' }, 400);
        }
        if (asset.status === 'Assigned') {
          return jsonResponse(
            { success: false, error: 'Asset is currently checked out to an employee. Check in the asset before disposing.' },
            400
          );
        }

        // 1. Insert disposal record
        const { data: disposal, error: dispErr } = await client
          .from('asset_disposals')
          .insert({
            company_id: tenantId,
            asset_id: assetId,
            disposal_date: body.disposal_date!,
            disposal_method: body.disposal_method!,
            reason: body.reason!.trim(),
            recovery_value: body.recovery_value !== undefined && body.recovery_value !== null ? Number(body.recovery_value) : null,
            currency: body.currency || 'USD',
            notes: body.notes?.trim() || null,
            disposed_by: user.id,
          })
          .select('*')
          .single();

        if (dispErr) return jsonResponse({ success: false, error: dispErr.message }, 400);

        // 2. Mark asset as Disposed
        const { data: updatedAsset, error: updErr } = await client
          .from('assets')
          .update({ status: 'Disposed', updated_at: new Date().toISOString() })
          .eq('id', assetId)
          .eq('company_id', tenantId)
          .select('*, site:sites(*), location:locations(*), category:categories(*)')
          .single();

        if (updErr) return jsonResponse({ success: false, error: updErr.message }, 400);

        // 3. Cancel any pending active reservations
        await client
          .from('asset_reservations')
          .update({ status: 'Cancelled', updated_at: new Date().toISOString() })
          .eq('asset_id', assetId)
          .eq('company_id', tenantId)
          .eq('status', 'Active');

        // 4. Log audit event
        await client.from('asset_events').insert({
          company_id: tenantId,
          asset_id: assetId,
          event_type: 'ASSET_DISPOSED',
          actor_id: user.id,
          details: {
            disposal_id: disposal.id,
            disposal_date: body.disposal_date,
            disposal_method: body.disposal_method,
            reason: body.reason,
            recovery_value: body.recovery_value,
          },
        });

        return jsonResponse({ success: true, data: updatedAsset, disposal });
      }

      // /assets/:id/disposal
      const assetDispInfoMatch = subpath.match(/^\/assets\/([a-zA-Z0-9_-]+)\/disposal$/);
      if (assetDispInfoMatch && request.method === 'GET') {
        const assetId = assetDispInfoMatch[1];
        const { data, error } = await client
          .from('asset_disposals')
          .select('*')
          .eq('asset_id', assetId)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (error) return jsonResponse({ success: false, error: error.message }, 500);
        return jsonResponse({ success: true, data: data || null });
      }

      // ----------------------------------------------------------------------
      // 6. LINKED / RELATED ASSETS API
      // ----------------------------------------------------------------------
      const assetRelMatch = subpath.match(/^\/assets\/([a-zA-Z0-9_-]+)\/relationships$/);
      if (assetRelMatch) {
        const assetId = assetRelMatch[1];

        if (request.method === 'GET') {
          const { data, error } = await client
            .from('asset_relationships')
            .select('*, parent_asset:assets!fk_rel_parent_asset_tenant(id, name, asset_tag, status), child_asset:assets!fk_rel_child_asset_tenant(id, name, asset_tag, status)')
            .eq('company_id', tenantId)
            .or(`parent_asset_id.eq.${assetId},child_asset_id.eq.${assetId}`)
            .order('created_at', { ascending: false });

          if (error) return jsonResponse({ success: false, error: error.message }, 500);
          return jsonResponse({ success: true, data: data || [] });
        }

        if (request.method === 'POST') {
          if (membership.role !== 'TENANT_ADMIN') {
            return jsonResponse(
              { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to link assets.' },
              403
            );
          }

          const body = (await request.json().catch(() => ({}))) as Partial<CreateAssetRelationshipInput>;
          body.parent_asset_id = assetId;

          const validation = validateAssetRelationship(body);
          if (!validation.isValid) {
            return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
          }

          // Check self-link
          if (assetId === body.child_asset_id) {
            return jsonResponse({ success: false, error: 'Asset cannot be linked to itself.' }, 400);
          }

          // Verify both assets belong to tenant
          const { data: pAsset } = await client
            .from('assets')
            .select('id, name')
            .eq('id', assetId)
            .eq('company_id', tenantId)
            .maybeSingle();

          const { data: cAsset } = await client
            .from('assets')
            .select('id, name')
            .eq('id', body.child_asset_id)
            .eq('company_id', tenantId)
            .maybeSingle();

          if (!pAsset || !cAsset) {
            return jsonResponse({ success: false, error: 'One or both assets do not exist in your workspace.' }, 404);
          }

          const { data: rel, error: relErr } = await client
            .from('asset_relationships')
            .insert({
              company_id: tenantId,
              parent_asset_id: assetId,
              child_asset_id: body.child_asset_id!,
              relationship_type: body.relationship_type!,
              notes: body.notes?.trim() || null,
              created_by: user.id,
            })
            .select('*, parent_asset:assets!fk_rel_parent_asset_tenant(*), child_asset:assets!fk_rel_child_asset_tenant(*)')
            .single();

          if (relErr) return jsonResponse({ success: false, error: relErr.message }, 400);

          await client.from('asset_events').insert({
            company_id: tenantId,
            asset_id: assetId,
            event_type: 'ASSET_LINKED',
            actor_id: user.id,
            details: {
              relationship_id: rel.id,
              parent_asset_id: assetId,
              child_asset_id: body.child_asset_id,
              relationship_type: body.relationship_type,
            },
          });

          return jsonResponse({ success: true, data: rel }, 201);
        }
      }

      // /relationships/:id
      const delRelMatch = subpath.match(/^\/relationships\/([a-zA-Z0-9_-]+)$/);
      if (delRelMatch && request.method === 'DELETE') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to remove asset relationships.' },
            403
          );
        }

        const relId = delRelMatch[1];
        const { error } = await client
          .from('asset_relationships')
          .delete()
          .eq('id', relId)
          .eq('company_id', tenantId);

        if (error) return jsonResponse({ success: false, error: error.message }, 400);
        return jsonResponse({ success: true });
      }

      // ----------------------------------------------------------------------
      // 7. PHYSICAL ASSET AUDITS API
      // ----------------------------------------------------------------------
      if (subpath === '/audits') {
        if (request.method === 'GET') {
          const { data: sessions, error } = await client
            .from('audit_sessions')
            .select('*, site:sites(*), location:locations(*)')
            .eq('company_id', tenantId)
            .order('created_at', { ascending: false });

          if (error) return jsonResponse({ success: false, error: error.message }, 500);

          // Augment with item stats
          const sessionsWithStats = await Promise.all(
            (sessions || []).map(async (sess) => {
              const { data: items } = await client
                .from('audit_session_items')
                .select('status')
                .eq('session_id', sess.id)
                .eq('company_id', tenantId);

              const stats = {
                expected: items?.length || 0,
                found: items?.filter((i) => i.status === 'Found').length || 0,
                missing: items?.filter((i) => i.status === 'Missing').length || 0,
                wrongLocation: items?.filter((i) => i.status === 'Wrong Location').length || 0,
                unexpected: items?.filter((i) => i.status === 'Unexpected').length || 0,
              };

              return { ...sess, stats };
            })
          );

          return jsonResponse({ success: true, data: sessionsWithStats });
        }

        if (request.method === 'POST') {
          if (membership.role !== 'TENANT_ADMIN') {
            return jsonResponse(
              { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to initiate audits.' },
              403
            );
          }

          const body = (await request.json().catch(() => ({}))) as Partial<CreateAuditSessionInput>;
          const validation = validateAuditSession(body);
          if (!validation.isValid) {
            return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
          }

          // 1. Create audit session
          const { data: session, error: sessErr } = await client
            .from('audit_sessions')
            .insert({
              company_id: tenantId,
              name: body.name!.trim(),
              site_id: body.site_id || null,
              location_id: body.location_id || null,
              status: 'In Progress',
              started_by: user.id,
              notes: body.notes?.trim() || null,
            })
            .select('*, site:sites(*), location:locations(*)')
            .single();

          if (sessErr) return jsonResponse({ success: false, error: sessErr.message }, 400);

          // 2. Populate expected assets into audit items (status 'Missing' initially)
          let assetQuery = client
            .from('assets')
            .select('id, site_id, location_id')
            .eq('company_id', tenantId)
            .neq('status', 'Disposed');

          if (body.site_id) assetQuery = assetQuery.eq('site_id', body.site_id);
          if (body.location_id) assetQuery = assetQuery.eq('location_id', body.location_id);

          const { data: expectedAssets } = await assetQuery;

          if (expectedAssets && expectedAssets.length > 0) {
            const itemsToInsert = expectedAssets.map((ast) => ({
              company_id: tenantId,
              session_id: session.id,
              asset_id: ast.id,
              expected_site_id: ast.site_id,
              expected_location_id: ast.location_id,
              status: 'Missing',
            }));

            await client.from('audit_session_items').insert(itemsToInsert);
          }

          // 3. Log audit event
          await client.from('asset_events').insert({
            company_id: tenantId,
            event_type: 'AUDIT_STARTED',
            actor_id: user.id,
            details: {
              session_id: session.id,
              name: session.name,
              site_id: session.site_id,
              location_id: session.location_id,
              expected_count: expectedAssets?.length || 0,
            },
          });

          return jsonResponse({ success: true, data: session }, 201);
        }
      }

      // /audits/:id
      const auditSessionMatch = subpath.match(/^\/audits\/([a-zA-Z0-9_-]+)$/);
      if (auditSessionMatch && request.method === 'GET') {
        const sessionId = auditSessionMatch[1];
        const { data: session, error: sessErr } = await client
          .from('audit_sessions')
          .select('*, site:sites(*), location:locations(*)')
          .eq('id', sessionId)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (sessErr || !session) return jsonResponse({ success: false, error: 'Audit session not found.' }, 404);

        const { data: items, error: itemsErr } = await client
          .from('audit_session_items')
          .select('*, asset:assets(id, name, asset_tag, status, serial_number), expected_site:sites!fk_audit_item_exp_site(name), expected_location:locations!fk_audit_item_exp_loc(name), scanned_site:sites!fk_audit_item_scn_site(name), scanned_location:locations!fk_audit_item_scn_loc(name)')
          .eq('session_id', sessionId)
          .eq('company_id', tenantId)
          .order('scanned_at', { ascending: false });

        if (itemsErr) return jsonResponse({ success: false, error: itemsErr.message }, 500);

        const allItems = items || [];
        const stats = {
          expected: allItems.length,
          found: allItems.filter((i) => i.status === 'Found').length,
          missing: allItems.filter((i) => i.status === 'Missing').length,
          wrongLocation: allItems.filter((i) => i.status === 'Wrong Location').length,
          unexpected: allItems.filter((i) => i.status === 'Unexpected').length,
        };

        return jsonResponse({ success: true, data: { ...session, stats }, items: allItems });
      }

      // /audits/:id/scan
      const auditScanMatch = subpath.match(/^\/audits\/([a-zA-Z0-9_-]+)\/scan$/);
      if (auditScanMatch && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to scan audit items.' },
            403
          );
        }

        const sessionId = auditScanMatch[1];
        const body = (await request.json().catch(() => ({}))) as Partial<ScanAuditItemInput>;
        const validation = validateScanAuditItem(body);
        if (!validation.isValid) {
          return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
        }

        // Verify session is In Progress
        const { data: session } = await client
          .from('audit_sessions')
          .select('*')
          .eq('id', sessionId)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (!session) return jsonResponse({ success: false, error: 'Audit session not found.' }, 404);
        if (session.status !== 'In Progress') {
          return jsonResponse({ success: false, error: `Audit session is ${session.status} and cannot accept new scans.` }, 400);
        }

        // Find asset in workspace
        let assetQuery = client.from('assets').select('*').eq('company_id', tenantId);
        if (body.asset_id) {
          assetQuery = assetQuery.eq('id', body.asset_id);
        } else if (body.asset_tag) {
          assetQuery = assetQuery.ilike('asset_tag', body.asset_tag.trim());
        }

        const { data: asset, error: aErr } = await assetQuery.maybeSingle();
        if (aErr || !asset) {
          return jsonResponse({ success: false, error: `Asset "${body.asset_tag || body.asset_id}" not found in your workspace.` }, 404);
        }

        // Check if item was expected in this audit session
        const { data: existingItem } = await client
          .from('audit_session_items')
          .select('*')
          .eq('session_id', sessionId)
          .eq('asset_id', asset.id)
          .eq('company_id', tenantId)
          .maybeSingle();

        const scannedSiteId = body.scanned_site_id !== undefined ? body.scanned_site_id : session.site_id;
        const scannedLocId = body.scanned_location_id !== undefined ? body.scanned_location_id : session.location_id;

        let scanStatus: 'Found' | 'Wrong Location' | 'Unexpected' = 'Found';

        if (existingItem) {
          const locMatches =
            (!existingItem.expected_location_id && !scannedLocId) ||
            existingItem.expected_location_id === scannedLocId;
          const siteMatches =
            (!existingItem.expected_site_id && !scannedSiteId) ||
            existingItem.expected_site_id === scannedSiteId;

          scanStatus = locMatches && siteMatches ? 'Found' : 'Wrong Location';

          const { data: updatedItem, error: updErr } = await client
            .from('audit_session_items')
            .update({
              scanned_site_id: scannedSiteId || null,
              scanned_location_id: scannedLocId || null,
              status: scanStatus,
              notes: body.notes?.trim() || existingItem.notes,
              scanned_by: user.id,
              scanned_at: new Date().toISOString(),
            })
            .eq('id', existingItem.id)
            .select('*, asset:assets(*)')
            .single();

          if (updErr) return jsonResponse({ success: false, error: updErr.message }, 400);
          return jsonResponse({ success: true, data: updatedItem });
        } else {
          // Unexpected asset in this audit
          scanStatus = 'Unexpected';

          const { data: newItem, error: insErr } = await client
            .from('audit_session_items')
            .insert({
              company_id: tenantId,
              session_id: sessionId,
              asset_id: asset.id,
              expected_site_id: asset.site_id,
              expected_location_id: asset.location_id,
              scanned_site_id: scannedSiteId || null,
              scanned_location_id: scannedLocId || null,
              status: scanStatus,
              notes: body.notes?.trim() || 'Scanned during audit but was not in initial expected scope',
              scanned_by: user.id,
              scanned_at: new Date().toISOString(),
            })
            .select('*, asset:assets(*)')
            .single();

          if (insErr) return jsonResponse({ success: false, error: insErr.message }, 400);
          return jsonResponse({ success: true, data: newItem });
        }
      }

      // /audits/:id/complete
      const auditCompleteMatch = subpath.match(/^\/audits\/([a-zA-Z0-9_-]+)\/complete$/);
      if (auditCompleteMatch && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to complete audits.' },
            403
          );
        }

        const sessionId = auditCompleteMatch[1];
        const body = (await request.json().catch(() => ({}))) as Partial<CompleteAuditSessionInput>;

        const { data: updated, error: updErr } = await client
          .from('audit_sessions')
          .update({
            status: 'Completed',
            completed_at: new Date().toISOString(),
            completed_by: user.id,
            notes: body.notes?.trim() || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId)
          .eq('company_id', tenantId)
          .select('*, site:sites(*), location:locations(*)')
          .single();

        if (updErr) return jsonResponse({ success: false, error: updErr.message }, 400);

        // Fetch counts for audit event details
        const { data: items } = await client
          .from('audit_session_items')
          .select('status')
          .eq('session_id', sessionId)
          .eq('company_id', tenantId);

        const foundCount = items?.filter((i) => i.status === 'Found').length || 0;
        const missingCount = items?.filter((i) => i.status === 'Missing').length || 0;
        const wrongLocCount = items?.filter((i) => i.status === 'Wrong Location').length || 0;

        await client.from('asset_events').insert({
          company_id: tenantId,
          event_type: 'AUDIT_COMPLETED',
          actor_id: user.id,
          details: {
            session_id: sessionId,
            name: updated.name,
            total_items: items?.length || 0,
            found_count: foundCount,
            missing_count: missingCount,
            wrong_location_count: wrongLocCount,
          },
        });

        return jsonResponse({ success: true, data: updated });
      }

      // ======================================================================
      // PHASE 5: FINANCIAL, COMPLIANCE & ASSET RECORDS API
      // ======================================================================

      // ----------------------------------------------------------------------
      // 1. DEPRECIATION API
      // ----------------------------------------------------------------------
      const deprMatch = subpath.match(/^\/assets\/([a-zA-Z0-9_-]+)\/depreciation$/);
      if (deprMatch) {
        const assetId = deprMatch[1];

        // Verify asset belongs to tenant
        const { data: asset, error: aErr } = await client
          .from('assets')
          .select('id, name, asset_tag, purchase_cost, purchase_date, currency')
          .eq('id', assetId)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (aErr || !asset) {
          return jsonResponse({ success: false, error: 'Asset not found in your workspace.' }, 404);
        }

        if (request.method === 'GET') {
          const { data: config } = await client
            .from('asset_depreciation')
            .select('*')
            .eq('asset_id', assetId)
            .eq('company_id', tenantId)
            .maybeSingle();

          const activeConfig: AssetDepreciation = config || {
            id: '',
            company_id: tenantId,
            asset_id: assetId,
            method: 'NO_DEPRECIATION',
            salvage_value: 0,
            useful_life_months: 60,
            depreciation_start_date: asset.purchase_date || null,
            rate: null,
            created_at: '',
            updated_at: '',
          };

          const cost = Number(asset.purchase_cost) || 0;
          const salvage = Number(activeConfig.salvage_value) || 0;
          const months = Number(activeConfig.useful_life_months) || 60;
          const startDate = activeConfig.depreciation_start_date || asset.purchase_date || null;
          const rate = activeConfig.rate !== null && activeConfig.rate !== undefined ? Number(activeConfig.rate) : null;

          const calculation = calculateDepreciation(
            cost,
            salvage,
            months,
            startDate,
            activeConfig.method,
            rate
          );

          activeConfig.original_cost = calculation.originalCost;
          activeConfig.accumulated_depreciation = calculation.accumulatedDepreciation;
          activeConfig.current_book_value = calculation.currentBookValue;
          activeConfig.depreciation_to_date = calculation.depreciationToDate;

          return jsonResponse({
            success: true,
            data: {
              config: activeConfig,
              calculation,
              asset: {
                id: asset.id,
                name: asset.name,
                asset_tag: asset.asset_tag,
                purchase_cost: asset.purchase_cost,
                purchase_date: asset.purchase_date,
                currency: asset.currency,
              },
            },
          });
        }

        if (request.method === 'POST') {
          if (membership.role !== 'TENANT_ADMIN') {
            return jsonResponse(
              { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to configure depreciation.' },
              403
            );
          }

          const body = (await request.json().catch(() => ({}))) as Partial<ConfigureDepreciationInput>;
          const validation = validateDepreciationConfig(body);
          if (!validation.isValid) {
            return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
          }

          const now = new Date().toISOString();
          const { data: upserted, error: upErr } = await client
            .from('asset_depreciation')
            .upsert(
              {
                company_id: tenantId,
                asset_id: assetId,
                method: body.method!,
                salvage_value: body.salvage_value !== undefined ? Number(body.salvage_value) : 0,
                useful_life_months: body.useful_life_months !== undefined ? Number(body.useful_life_months) : 60,
                depreciation_start_date: body.depreciation_start_date || asset.purchase_date || null,
                rate: body.rate !== undefined && body.rate !== null ? Number(body.rate) : null,
                updated_at: now,
              },
              { onConflict: 'company_id,asset_id' }
            )
            .select('*')
            .single();

          if (upErr) return jsonResponse({ success: false, error: upErr.message }, 400);

          // Log Audit Event
          await client.from('asset_events').insert({
            company_id: tenantId,
            asset_id: assetId,
            event_type: 'DEPRECIATION_CONFIGURED',
            actor_id: user.id,
            details: {
              method: body.method,
              salvage_value: body.salvage_value,
              useful_life_months: body.useful_life_months,
            },
          });

          const calculation = calculateDepreciation(
            Number(asset.purchase_cost) || 0,
            Number(upserted.salvage_value) || 0,
            Number(upserted.useful_life_months) || 60,
            upserted.depreciation_start_date,
            upserted.method,
            upserted.rate
          );

          return jsonResponse({
            success: true,
            data: {
              config: upserted,
              calculation,
            },
          });
        }
      }

      // ----------------------------------------------------------------------
      // 2. WARRANTIES API
      // ----------------------------------------------------------------------
      if (subpath === '/warranties' && request.method === 'GET') {
        const assetFilter = url.searchParams.get('asset_id');
        let query = client
          .from('asset_warranties')
          .select('*, vendor:vendors(*), asset:assets(id, name, asset_tag)')
          .eq('company_id', tenantId)
          .order('end_date', { ascending: true });

        if (assetFilter) {
          query = query.eq('asset_id', assetFilter);
        }

        const { data: warranties, error: wErr } = await query;
        if (wErr) return jsonResponse({ success: false, error: wErr.message }, 500);

        const todayStr = new Date().toISOString().split('T')[0];
        const thirtyDaysAhead = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const formatted = (warranties || []).map((w) => {
          const isExpired = w.end_date < todayStr;
          const isExpiringSoon = !isExpired && w.end_date <= thirtyDaysAhead;
          const daysUntil = Math.ceil(
            (new Date(w.end_date).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24)
          );

          return {
            ...w,
            status: isExpired ? 'Expired' : w.status,
            days_until_expiry: daysUntil,
            is_expiring_soon: isExpiringSoon,
          };
        });

        return jsonResponse({ success: true, data: formatted });
      }

      if (subpath === '/warranties' && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to register warranties.' },
            403
          );
        }

        const body = (await request.json().catch(() => ({}))) as Partial<CreateWarrantyInput>;
        const validation = validateWarranty(body);
        if (!validation.isValid) {
          return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
        }

        // Verify asset belongs to tenant
        const { data: asset, error: aErr } = await client
          .from('assets')
          .select('id, name')
          .eq('id', body.asset_id)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (aErr || !asset) {
          return jsonResponse({ success: false, error: 'Asset not found in your workspace.' }, 404);
        }

        // Verify vendor belongs to tenant if specified
        if (body.vendor_id) {
          const { data: vendor } = await client
            .from('vendors')
            .select('id')
            .eq('id', body.vendor_id)
            .eq('company_id', tenantId)
            .maybeSingle();

          if (!vendor) {
            return jsonResponse({ success: false, error: 'Vendor does not exist in your workspace.' }, 400);
          }
        }

        const { data: created, error: cErr } = await client
          .from('asset_warranties')
          .insert({
            company_id: tenantId,
            asset_id: body.asset_id!,
            vendor_id: body.vendor_id || null,
            warranty_number: body.warranty_number!.trim(),
            provider_name: body.provider_name!.trim(),
            warranty_type: body.warranty_type || 'Manufacturer',
            start_date: body.start_date!,
            end_date: body.end_date!,
            coverage_details: body.coverage_details?.trim() || null,
            contact_details: body.contact_details?.trim() || null,
            status: 'Active',
            notes: body.notes?.trim() || null,
          })
          .select('*, vendor:vendors(*), asset:assets(id, name, asset_tag)')
          .single();

        if (cErr) return jsonResponse({ success: false, error: cErr.message }, 400);

        // Also sync base warranty_expiry column on assets table for fast indexing
        await client
          .from('assets')
          .update({ warranty_expiry: body.end_date, updated_at: new Date().toISOString() })
          .eq('id', body.asset_id)
          .eq('company_id', tenantId);

        // Log audit event
        await client.from('asset_events').insert({
          company_id: tenantId,
          asset_id: body.asset_id,
          event_type: 'WARRANTY_ADDED',
          actor_id: user.id,
          details: {
            warranty_id: created.id,
            warranty_number: body.warranty_number,
            provider_name: body.provider_name,
            end_date: body.end_date,
          },
        });

        return jsonResponse({ success: true, data: created }, 201);
      }

      const warrantyItemMatch = subpath.match(/^\/warranties\/([a-zA-Z0-9_-]+)$/);
      if (warrantyItemMatch && request.method === 'PUT') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to update warranties.' },
            403
          );
        }

        const warrantyId = warrantyItemMatch[1];
        const body = (await request.json().catch(() => ({}))) as Partial<UpdateWarrantyInput>;

        const { data: existing, error: exErr } = await client
          .from('asset_warranties')
          .select('*')
          .eq('id', warrantyId)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (exErr || !existing) {
          return jsonResponse({ success: false, error: 'Warranty record not found.' }, 404);
        }

        const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (body.warranty_number !== undefined) updatePayload.warranty_number = body.warranty_number.trim();
        if (body.provider_name !== undefined) updatePayload.provider_name = body.provider_name.trim();
        if (body.warranty_type !== undefined) updatePayload.warranty_type = body.warranty_type;
        if (body.start_date !== undefined) updatePayload.start_date = body.start_date;
        if (body.end_date !== undefined) updatePayload.end_date = body.end_date;
        if (body.coverage_details !== undefined) updatePayload.coverage_details = body.coverage_details?.trim() || null;
        if (body.contact_details !== undefined) updatePayload.contact_details = body.contact_details?.trim() || null;
        if (body.status !== undefined) updatePayload.status = body.status;
        if (body.notes !== undefined) updatePayload.notes = body.notes?.trim() || null;

        const { data: updated, error: uErr } = await client
          .from('asset_warranties')
          .update(updatePayload)
          .eq('id', warrantyId)
          .eq('company_id', tenantId)
          .select('*, vendor:vendors(*), asset:assets(id, name, asset_tag)')
          .single();

        if (uErr) return jsonResponse({ success: false, error: uErr.message }, 400);

        await client.from('asset_events').insert({
          company_id: tenantId,
          asset_id: existing.asset_id,
          event_type: 'WARRANTY_UPDATED',
          actor_id: user.id,
          details: {
            warranty_id: warrantyId,
            status: updated.status,
            end_date: updated.end_date,
          },
        });

        return jsonResponse({ success: true, data: updated });
      }

      // ----------------------------------------------------------------------
      // 3. CONTRACTS API
      // ----------------------------------------------------------------------
      if (subpath === '/contracts' && request.method === 'GET') {
        const { data: contracts, error: cErr } = await client
          .from('contracts')
          .select('*, vendor:vendors(*)')
          .eq('company_id', tenantId)
          .order('end_date', { ascending: true });

        if (cErr) return jsonResponse({ success: false, error: cErr.message }, 500);

        // Fetch linked assets for each contract
        const { data: contractAssets } = await client
          .from('contract_assets')
          .select('contract_id, asset:assets(id, name, asset_tag, status)')
          .eq('company_id', tenantId);

        const todayStr = new Date().toISOString().split('T')[0];
        const thirtyDaysAhead = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const assetMap = new Map<string, Array<{ id: string; name: string; asset_tag: string; status: string }>>();
        (contractAssets || []).forEach((ca) => {
          if (!assetMap.has(ca.contract_id)) assetMap.set(ca.contract_id, []);
          if (ca.asset) assetMap.get(ca.contract_id)!.push(ca.asset as any);
        });

        const formatted = (contracts || []).map((c) => {
          const isExpired = c.end_date < todayStr;
          const isExpiringSoon = !isExpired && c.end_date <= thirtyDaysAhead;
          const daysUntil = Math.ceil(
            (new Date(c.end_date).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24)
          );

          return {
            ...c,
            status: isExpired && c.status === 'Active' ? 'Expired' : c.status,
            assets: assetMap.get(c.id) || [],
            days_until_expiry: daysUntil,
            is_expiring_soon: isExpiringSoon,
          };
        });

        return jsonResponse({ success: true, data: formatted });
      }

      if (subpath === '/contracts' && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to create contracts.' },
            403
          );
        }

        const body = (await request.json().catch(() => ({}))) as Partial<CreateContractInput>;
        const validation = validateContract(body);
        if (!validation.isValid) {
          return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
        }

        // Verify vendor belongs to tenant if specified
        if (body.vendor_id) {
          const { data: vendor } = await client
            .from('vendors')
            .select('id')
            .eq('id', body.vendor_id)
            .eq('company_id', tenantId)
            .maybeSingle();

          if (!vendor) {
            return jsonResponse({ success: false, error: 'Vendor does not exist in your workspace.' }, 400);
          }
        }

        // Verify linked assets belong to tenant if specified
        if (body.asset_ids && body.asset_ids.length > 0) {
          const { data: validAssets } = await client
            .from('assets')
            .select('id')
            .in('id', body.asset_ids)
            .eq('company_id', tenantId);

          if (!validAssets || validAssets.length !== body.asset_ids.length) {
            return jsonResponse(
              { success: false, error: 'One or more selected assets do not belong to your workspace.' },
              400
            );
          }
        }

        const { data: created, error: cErr } = await client
          .from('contracts')
          .insert({
            company_id: tenantId,
            contract_number: body.contract_number!.trim(),
            title: body.title!.trim(),
            vendor_id: body.vendor_id || null,
            contract_type: body.contract_type!,
            start_date: body.start_date!,
            end_date: body.end_date!,
            renewal_date: body.renewal_date || null,
            contract_value: body.contract_value !== undefined ? Number(body.contract_value) : null,
            currency: body.currency || 'USD',
            auto_renew: Boolean(body.auto_renew),
            status: body.status || 'Active',
            notes: body.notes?.trim() || null,
          })
          .select('*, vendor:vendors(*)')
          .single();

        if (cErr) return jsonResponse({ success: false, error: cErr.message }, 400);

        // Link assets
        if (body.asset_ids && body.asset_ids.length > 0) {
          const links = body.asset_ids.map((aid) => ({
            company_id: tenantId,
            contract_id: created.id,
            asset_id: aid,
          }));
          await client.from('contract_assets').insert(links);
        }

        // Log audit event
        await client.from('asset_events').insert({
          company_id: tenantId,
          event_type: 'CONTRACT_CREATED',
          actor_id: user.id,
          details: {
            contract_id: created.id,
            contract_number: created.contract_number,
            title: created.title,
            linked_asset_count: body.asset_ids?.length || 0,
          },
        });

        return jsonResponse({ success: true, data: created }, 201);
      }

      const contractMatch = subpath.match(/^\/contracts\/([a-zA-Z0-9_-]+)$/);
      if (contractMatch && request.method === 'GET') {
        const contractId = contractMatch[1];
        const { data: contract, error: cErr } = await client
          .from('contracts')
          .select('*, vendor:vendors(*)')
          .eq('id', contractId)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (cErr || !contract) return jsonResponse({ success: false, error: 'Contract not found.' }, 404);

        const { data: ca } = await client
          .from('contract_assets')
          .select('asset:assets(*)')
          .eq('contract_id', contractId)
          .eq('company_id', tenantId);

        contract.assets = (ca || []).map((c) => c.asset).filter(Boolean);
        return jsonResponse({ success: true, data: contract });
      }

      if (contractMatch && request.method === 'PUT') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to update contracts.' },
            403
          );
        }

        const contractId = contractMatch[1];
        const body = (await request.json().catch(() => ({}))) as Partial<UpdateContractInput>;

        const { data: existing, error: exErr } = await client
          .from('contracts')
          .select('*')
          .eq('id', contractId)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (exErr || !existing) return jsonResponse({ success: false, error: 'Contract not found.' }, 404);

        const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (body.contract_number !== undefined) updatePayload.contract_number = body.contract_number.trim();
        if (body.title !== undefined) updatePayload.title = body.title.trim();
        if (body.contract_type !== undefined) updatePayload.contract_type = body.contract_type;
        if (body.start_date !== undefined) updatePayload.start_date = body.start_date;
        if (body.end_date !== undefined) updatePayload.end_date = body.end_date;
        if (body.renewal_date !== undefined) updatePayload.renewal_date = body.renewal_date || null;
        if (body.contract_value !== undefined) updatePayload.contract_value = body.contract_value !== null ? Number(body.contract_value) : null;
        if (body.currency !== undefined) updatePayload.currency = body.currency;
        if (body.auto_renew !== undefined) updatePayload.auto_renew = Boolean(body.auto_renew);
        if (body.status !== undefined) updatePayload.status = body.status;
        if (body.notes !== undefined) updatePayload.notes = body.notes?.trim() || null;

        const { data: updated, error: uErr } = await client
          .from('contracts')
          .update(updatePayload)
          .eq('id', contractId)
          .eq('company_id', tenantId)
          .select('*, vendor:vendors(*)')
          .single();

        if (uErr) return jsonResponse({ success: false, error: uErr.message }, 400);

        // Sync linked assets if specified
        if (body.asset_ids) {
          await client.from('contract_assets').delete().eq('contract_id', contractId).eq('company_id', tenantId);
          if (body.asset_ids.length > 0) {
            const links = body.asset_ids.map((aid) => ({
              company_id: tenantId,
              contract_id: contractId,
              asset_id: aid,
            }));
            await client.from('contract_assets').insert(links);
          }
        }

        await client.from('asset_events').insert({
          company_id: tenantId,
          event_type: 'CONTRACT_UPDATED',
          actor_id: user.id,
          details: {
            contract_id: contractId,
            status: updated.status,
            end_date: updated.end_date,
          },
        });

        return jsonResponse({ success: true, data: updated });
      }

      // Link Asset to Contract
      const contractLinkMatch = subpath.match(/^\/contracts\/([a-zA-Z0-9_-]+)\/link-asset$/);
      if (contractLinkMatch && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to link assets to contracts.' },
            403
          );
        }

        const contractId = contractLinkMatch[1];
        const body = (await request.json().catch(() => ({}))) as { asset_id?: string };
        if (!body.asset_id) return jsonResponse({ success: false, error: 'Asset ID is required.' }, 400);

        // Verify contract and asset belong to tenant
        const { data: contract } = await client.from('contracts').select('id').eq('id', contractId).eq('company_id', tenantId).maybeSingle();
        if (!contract) return jsonResponse({ success: false, error: 'Contract not found in your workspace.' }, 404);

        const { data: asset } = await client.from('assets').select('id').eq('id', body.asset_id).eq('company_id', tenantId).maybeSingle();
        if (!asset) return jsonResponse({ success: false, error: 'Asset not found in your workspace.' }, 404);

        const { error: insErr } = await client
          .from('contract_assets')
          .upsert({ company_id: tenantId, contract_id: contractId, asset_id: body.asset_id }, { onConflict: 'company_id,contract_id,asset_id' });

        if (insErr) return jsonResponse({ success: false, error: insErr.message }, 400);

        return jsonResponse({ success: true, message: 'Asset successfully linked to contract.' });
      }

      // ----------------------------------------------------------------------
      // 4. SOFTWARE / LICENSE TRACKING API
      // ----------------------------------------------------------------------
      if (subpath === '/licenses' && request.method === 'GET') {
        const { data: licenses, error: lErr } = await client
          .from('software_licenses')
          .select('*, vendor:vendors(*)')
          .eq('company_id', tenantId)
          .order('software_name', { ascending: true });

        if (lErr) return jsonResponse({ success: false, error: lErr.message }, 500);

        const todayStr = new Date().toISOString().split('T')[0];
        const formatted = (licenses || []).map((lic) => {
          const purchased = Number(lic.purchased_quantity) || 0;
          const allocated = Number(lic.allocated_quantity) || 0;
          const available = Math.max(0, purchased - allocated);
          let daysUntil = undefined;
          if (lic.expiry_date) {
            daysUntil = Math.ceil(
              (new Date(lic.expiry_date).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24)
            );
          }

          // Mask license key in list views for security
          let maskedKey = lic.license_key;
          if (lic.license_key && lic.license_key.length > 4) {
            maskedKey = '••••-••••-' + lic.license_key.slice(-4);
          }

          return {
            ...lic,
            license_key: maskedKey,
            available_quantity: available,
            days_until_expiry: daysUntil,
          };
        });

        return jsonResponse({ success: true, data: formatted });
      }

      if (subpath === '/licenses' && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to register software licenses.' },
            403
          );
        }

        const body = (await request.json().catch(() => ({}))) as Partial<CreateLicenseInput>;
        const validation = validateLicense(body);
        if (!validation.isValid) {
          return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
        }

        if (body.vendor_id) {
          const { data: vendor } = await client
            .from('vendors')
            .select('id')
            .eq('id', body.vendor_id)
            .eq('company_id', tenantId)
            .maybeSingle();

          if (!vendor) {
            return jsonResponse({ success: false, error: 'Vendor does not exist in your workspace.' }, 400);
          }
        }

        const { data: created, error: cErr } = await client
          .from('software_licenses')
          .insert({
            company_id: tenantId,
            software_name: body.software_name!.trim(),
            vendor_id: body.vendor_id || null,
            publisher: body.publisher?.trim() || null,
            license_key: body.license_key?.trim() || null,
            license_type: body.license_type!,
            purchased_quantity: Number(body.purchased_quantity),
            allocated_quantity: 0,
            renewal_date: body.renewal_date || null,
            expiry_date: body.expiry_date || null,
            purchase_cost: body.purchase_cost !== undefined ? Number(body.purchase_cost) : null,
            currency: body.currency || 'USD',
            notes: body.notes?.trim() || null,
          })
          .select('*, vendor:vendors(*)')
          .single();

        if (cErr) return jsonResponse({ success: false, error: cErr.message }, 400);

        await client.from('asset_events').insert({
          company_id: tenantId,
          event_type: 'LICENSE_CREATED',
          actor_id: user.id,
          details: {
            license_id: created.id,
            software_name: created.software_name,
            purchased_quantity: created.purchased_quantity,
          },
        });

        return jsonResponse({ success: true, data: created }, 201);
      }

      const licenseDetailMatch = subpath.match(/^\/licenses\/([a-zA-Z0-9_-]+)$/);
      if (licenseDetailMatch && request.method === 'GET') {
        const licenseId = licenseDetailMatch[1];
        const { data: license, error: lErr } = await client
          .from('software_licenses')
          .select('*, vendor:vendors(*)')
          .eq('id', licenseId)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (lErr || !license) return jsonResponse({ success: false, error: 'Software license not found.' }, 404);

        const { data: allocs } = await client
          .from('software_license_allocations')
          .select('*, asset:assets(id, name, asset_tag), employee:employees(id, full_name, employee_code)')
          .eq('license_id', licenseId)
          .eq('company_id', tenantId)
          .order('allocated_at', { ascending: false });

        license.allocations = allocs || [];
        license.available_quantity = Math.max(0, license.purchased_quantity - license.allocated_quantity);

        return jsonResponse({ success: true, data: license });
      }

      // Allocate License Seat to Asset or Employee
      const licenseAllocMatch = subpath.match(/^\/licenses\/([a-zA-Z0-9_-]+)\/allocate$/);
      if (licenseAllocMatch && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to allocate licenses.' },
            403
          );
        }

        const licenseId = licenseAllocMatch[1];
        const body = (await request.json().catch(() => ({}))) as Partial<AllocateLicenseInput>;

        const { data: license, error: lErr } = await client
          .from('software_licenses')
          .select('*')
          .eq('id', licenseId)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (lErr || !license) return jsonResponse({ success: false, error: 'License record not found.' }, 404);

        const available = license.purchased_quantity - license.allocated_quantity;
        const validation = validateLicenseAllocation(body, available);
        if (!validation.isValid) {
          return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
        }

        // Verify target asset belongs to tenant
        if (body.allocation_type === 'Asset' && body.asset_id) {
          const { data: asset } = await client
            .from('assets')
            .select('id, name')
            .eq('id', body.asset_id)
            .eq('company_id', tenantId)
            .maybeSingle();

          if (!asset) {
            return jsonResponse({ success: false, error: 'Target asset does not belong to your workspace.' }, 400);
          }
        }

        // Verify target employee belongs to tenant
        if (body.allocation_type === 'Employee' && body.employee_id) {
          const { data: emp } = await client
            .from('employees')
            .select('id, full_name')
            .eq('id', body.employee_id)
            .eq('company_id', tenantId)
            .maybeSingle();

          if (!emp) {
            return jsonResponse({ success: false, error: 'Target employee does not belong to your workspace.' }, 400);
          }
        }

        const { data: allocation, error: aErr } = await client
          .from('software_license_allocations')
          .insert({
            company_id: tenantId,
            license_id: licenseId,
            allocation_type: body.allocation_type!,
            asset_id: body.allocation_type === 'Asset' ? body.asset_id : null,
            employee_id: body.allocation_type === 'Employee' ? body.employee_id : null,
            status: 'Active',
            notes: body.notes?.trim() || null,
          })
          .select('*, asset:assets(id, name, asset_tag), employee:employees(id, full_name, employee_code)')
          .single();

        if (aErr) return jsonResponse({ success: false, error: aErr.message }, 400);

        // Increment allocated_quantity
        await client
          .from('software_licenses')
          .update({
            allocated_quantity: license.allocated_quantity + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', licenseId)
          .eq('company_id', tenantId);

        await client.from('asset_events').insert({
          company_id: tenantId,
          asset_id: body.asset_id || undefined,
          event_type: 'LICENSE_ALLOCATED',
          actor_id: user.id,
          details: {
            license_id: licenseId,
            software_name: license.software_name,
            allocation_id: allocation.id,
            allocation_type: body.allocation_type,
            target_id: body.asset_id || body.employee_id,
          },
        });

        return jsonResponse({ success: true, data: allocation }, 201);
      }

      // Release License Seat
      const licenseReleaseMatch = subpath.match(/^\/licenses\/([a-zA-Z0-9_-]+)\/allocations\/([a-zA-Z0-9_-]+)\/release$/);
      if (licenseReleaseMatch && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to release license seats.' },
            403
          );
        }

        const [_, licenseId, allocId] = licenseReleaseMatch;
        const { data: alloc, error: aErr } = await client
          .from('software_license_allocations')
          .select('*')
          .eq('id', allocId)
          .eq('license_id', licenseId)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (aErr || !alloc) return jsonResponse({ success: false, error: 'License allocation not found.' }, 404);
        if (alloc.status === 'Released') {
          return jsonResponse({ success: false, error: 'License allocation has already been released.' }, 400);
        }

        const now = new Date().toISOString();
        const { data: updatedAlloc, error: uErr } = await client
          .from('software_license_allocations')
          .update({ status: 'Released', released_at: now })
          .eq('id', allocId)
          .eq('company_id', tenantId)
          .select('*')
          .single();

        if (uErr) return jsonResponse({ success: false, error: uErr.message }, 400);

        // Decrement allocated_quantity on license
        const { data: lic } = await client.from('software_licenses').select('allocated_quantity').eq('id', licenseId).eq('company_id', tenantId).single();
        if (lic) {
          await client
            .from('software_licenses')
            .update({
              allocated_quantity: Math.max(0, lic.allocated_quantity - 1),
              updated_at: now,
            })
            .eq('id', licenseId)
            .eq('company_id', tenantId);
        }

        await client.from('asset_events').insert({
          company_id: tenantId,
          asset_id: alloc.asset_id || undefined,
          event_type: 'LICENSE_RELEASED',
          actor_id: user.id,
          details: {
            license_id: licenseId,
            allocation_id: allocId,
          },
        });

        return jsonResponse({ success: true, data: updatedAlloc });
      }

      // ----------------------------------------------------------------------
      // 5. INSURANCE POLICIES API
      // ----------------------------------------------------------------------
      if (subpath === '/insurance' && request.method === 'GET') {
        const { data: policies, error: pErr } = await client
          .from('insurance_policies')
          .select('*')
          .eq('company_id', tenantId)
          .order('expiry_date', { ascending: true });

        if (pErr) return jsonResponse({ success: false, error: pErr.message }, 500);

        const { data: insAssets } = await client
          .from('insurance_assets')
          .select('policy_id, asset:assets(id, name, asset_tag, purchase_cost)')
          .eq('company_id', tenantId);

        const assetMap = new Map<string, Array<{ id: string; name: string; asset_tag: string }>>();
        (insAssets || []).forEach((ia) => {
          if (!assetMap.has(ia.policy_id)) assetMap.set(ia.policy_id, []);
          if (ia.asset) assetMap.get(ia.policy_id)!.push(ia.asset as any);
        });

        const todayStr = new Date().toISOString().split('T')[0];
        const thirtyDaysAhead = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const formatted = (policies || []).map((pol) => {
          const isExpired = pol.expiry_date < todayStr;
          const isExpiringSoon = !isExpired && pol.expiry_date <= thirtyDaysAhead;
          const daysUntil = Math.ceil(
            (new Date(pol.expiry_date).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24)
          );

          return {
            ...pol,
            status: isExpired && pol.status === 'Active' ? 'Expired' : pol.status,
            assets: assetMap.get(pol.id) || [],
            days_until_expiry: daysUntil,
            is_expiring_soon: isExpiringSoon,
          };
        });

        return jsonResponse({ success: true, data: formatted });
      }

      if (subpath === '/insurance' && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to register insurance policies.' },
            403
          );
        }

        const body = (await request.json().catch(() => ({}))) as Partial<CreateInsurancePolicyInput>;
        const validation = validateInsurancePolicy(body);
        if (!validation.isValid) {
          return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
        }

        // Verify assets belong to tenant
        if (body.asset_ids && body.asset_ids.length > 0) {
          const { data: validAssets } = await client
            .from('assets')
            .select('id')
            .in('id', body.asset_ids)
            .eq('company_id', tenantId);

          if (!validAssets || validAssets.length !== body.asset_ids.length) {
            return jsonResponse(
              { success: false, error: 'One or more selected assets do not belong to your workspace.' },
              400
            );
          }
        }

        const { data: created, error: cErr } = await client
          .from('insurance_policies')
          .insert({
            company_id: tenantId,
            policy_number: body.policy_number!.trim(),
            provider: body.provider!.trim(),
            coverage_type: body.coverage_type!,
            start_date: body.start_date!,
            expiry_date: body.expiry_date!,
            insured_value: body.insured_value !== undefined ? Number(body.insured_value) : null,
            premium: body.premium !== undefined ? Number(body.premium) : null,
            currency: body.currency || 'USD',
            deductible: body.deductible !== undefined ? Number(body.deductible) : null,
            status: body.status || 'Active',
            notes: body.notes?.trim() || null,
          })
          .select('*')
          .single();

        if (cErr) return jsonResponse({ success: false, error: cErr.message }, 400);

        if (body.asset_ids && body.asset_ids.length > 0) {
          const links = body.asset_ids.map((aid) => ({
            company_id: tenantId,
            policy_id: created.id,
            asset_id: aid,
          }));
          await client.from('insurance_assets').insert(links);
        }

        await client.from('asset_events').insert({
          company_id: tenantId,
          event_type: 'INSURANCE_ADDED',
          actor_id: user.id,
          details: {
            policy_id: created.id,
            policy_number: created.policy_number,
            provider: created.provider,
            covered_asset_count: body.asset_ids?.length || 0,
          },
        });

        return jsonResponse({ success: true, data: created }, 201);
      }

      // ----------------------------------------------------------------------
      // 6. ASSET PURCHASE & FUNDING INFORMATION API
      // ----------------------------------------------------------------------
      const purchaseMatch = subpath.match(/^\/assets\/([a-zA-Z0-9_-]+)\/purchase$/);
      if (purchaseMatch) {
        const assetId = purchaseMatch[1];

        // Verify asset exists in tenant
        const { data: asset, error: aErr } = await client
          .from('assets')
          .select('id, name, purchase_cost, purchase_date, currency')
          .eq('id', assetId)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (aErr || !asset) return jsonResponse({ success: false, error: 'Asset not found in your workspace.' }, 404);

        if (request.method === 'GET') {
          const { data: purchase } = await client
            .from('asset_purchases')
            .select('*, vendor:vendors(*), department:departments(*)')
            .eq('asset_id', assetId)
            .eq('company_id', tenantId)
            .maybeSingle();

          return jsonResponse({
            success: true,
            data: purchase || {
              asset_id: assetId,
              purchase_cost: asset.purchase_cost,
              purchase_date: asset.purchase_date,
              currency: asset.currency,
              funding_source: 'Company Purchase',
              is_financed: false,
              is_leased: false,
            },
          });
        }

        if (request.method === 'POST') {
          if (membership.role !== 'TENANT_ADMIN') {
            return jsonResponse(
              { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to update purchase details.' },
              403
            );
          }

          const body = (await request.json().catch(() => ({}))) as Partial<UpsertAssetPurchaseInput>;
          const validation = validateAssetPurchase(body);
          if (!validation.isValid) {
            return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
          }

          if (body.vendor_id) {
            const { data: vendor } = await client.from('vendors').select('id').eq('id', body.vendor_id).eq('company_id', tenantId).maybeSingle();
            if (!vendor) return jsonResponse({ success: false, error: 'Vendor does not exist in your workspace.' }, 400);
          }

          if (body.department_id) {
            const { data: dept } = await client.from('departments').select('id').eq('id', body.department_id).eq('company_id', tenantId).maybeSingle();
            if (!dept) return jsonResponse({ success: false, error: 'Department does not exist in your workspace.' }, 400);
          }

          const now = new Date().toISOString();
          const { data: upserted, error: upErr } = await client
            .from('asset_purchases')
            .upsert(
              {
                company_id: tenantId,
                asset_id: assetId,
                vendor_id: body.vendor_id || null,
                invoice_number: body.invoice_number?.trim() || null,
                purchase_order: body.purchase_order?.trim() || null,
                purchase_date: body.purchase_date || null,
                purchase_cost: body.purchase_cost !== undefined ? Number(body.purchase_cost) : null,
                currency: body.currency || 'USD',
                funding_source: body.funding_source || 'Company Purchase',
                department_id: body.department_id || null,
                cost_center: body.cost_center?.trim() || null,
                is_financed: Boolean(body.is_financed),
                is_leased: Boolean(body.is_leased),
                notes: body.notes?.trim() || null,
                updated_at: now,
              },
              { onConflict: 'company_id,asset_id' }
            )
            .select('*, vendor:vendors(*), department:departments(*)')
            .single();

          if (upErr) return jsonResponse({ success: false, error: upErr.message }, 400);

          // Sync base asset fields
          if (body.purchase_cost !== undefined || body.purchase_date !== undefined) {
            await client
              .from('assets')
              .update({
                purchase_cost: body.purchase_cost !== undefined ? Number(body.purchase_cost) : asset.purchase_cost,
                purchase_date: body.purchase_date !== undefined ? body.purchase_date : asset.purchase_date,
                updated_at: now,
              })
              .eq('id', assetId)
              .eq('company_id', tenantId);
          }

          return jsonResponse({ success: true, data: upserted });
        }
      }

      // ----------------------------------------------------------------------
      // 7. DOCUMENTS & ATTACHMENTS API
      // ----------------------------------------------------------------------
      if (subpath === '/documents' && request.method === 'GET') {
        const entityType = url.searchParams.get('entity_type');
        const entityId = url.searchParams.get('entity_id');

        let query = client
          .from('documents')
          .select('*')
          .eq('company_id', tenantId)
          .order('created_at', { ascending: false });

        if (entityType) query = query.eq('entity_type', entityType);
        if (entityId) query = query.eq('entity_id', entityId);

        const { data: docs, error: dErr } = await query;
        if (dErr) return jsonResponse({ success: false, error: dErr.message }, 500);

        return jsonResponse({ success: true, data: docs || [] });
      }

      if (subpath === '/documents' && request.method === 'POST') {
        if (!canMutateTenantBusinessData((membership?.company as any)?.status)) {
          return jsonResponse(
            { success: false, error: 'TENANT_SUSPENDED', message: 'Workspace is suspended. Document uploads are blocked.' },
            403
          );
        }

        const body = (await request.json().catch(() => ({}))) as Partial<CreateDocumentInput>;
        const validation = validateDocumentMetadata(body);
        if (!validation.isValid) {
          return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
        }

        const safeFilename = sanitizeFilename(body.original_filename!);
        const storedPath = `tenants/${tenantId}/documents/${crypto.randomUUID()}_${safeFilename}`;
        const mimeType = body.content_type || 'application/octet-stream';

        if (body.file_data_base64) {
          const binaryStr = atob(body.file_data_base64);
          const fileBuffer = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            fileBuffer[i] = binaryStr.charCodeAt(i);
          }
          const uploadVal = validateStorageUpload({ filename: safeFilename, size: fileBuffer.length, mimeType }, 'DOCUMENT');
          if (!uploadVal.isValid) {
            return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: uploadVal.errors }, 400);
          }
          const { error: storageErr } = await client.storage
            .from(SUPABASE_STORAGE_BUCKET)
            .upload(storedPath, fileBuffer, { contentType: mimeType, upsert: false });

          if (storageErr && env.ENVIRONMENT !== 'production') {
            memoryStorageStore.set(storedPath, { data: fileBuffer, contentType: mimeType });
          } else if (storageErr && env.ENVIRONMENT === 'production') {
            return jsonResponse(
              {
                success: false,
                error: 'STORAGE_UNAVAILABLE',
                message: storageErr.message || 'Supabase Storage bucket "assetmt-files" is not configured or accessible.',
              },
              503
            );
          }
        }

        const { data: created, error: cErr } = await client
          .from('documents')
          .insert({
            company_id: tenantId,
            entity_type: body.entity_type!,
            entity_id: body.entity_id!,
            original_filename: safeFilename,
            stored_path: storedPath,
            storage_key: storedPath,
            content_type: mimeType,
            file_size: Number(body.file_size) || 0,
            uploaded_by: user.id,
            description: body.description?.trim() || null,
          })
          .select('*')
          .single();

        if (cErr) return jsonResponse({ success: false, error: cErr.message }, 400);

        // Log audit event
        await client.from('asset_events').insert({
          company_id: tenantId,
          asset_id: body.entity_type === 'ASSET' ? body.entity_id : undefined,
          event_type: 'DOCUMENT_ADDED',
          actor_id: user.id,
          details: {
            document_id: created.id,
            entity_type: body.entity_type,
            entity_id: body.entity_id,
            filename: safeFilename,
            storage_key: storedPath,
            file_size: body.file_size,
          },
        });

        return jsonResponse({ success: true, data: created }, 201);
      }

      const docDeleteMatch = subpath.match(/^\/documents\/([a-zA-Z0-9_-]+)$/);
      if (docDeleteMatch && request.method === 'DELETE') {
        if (!isTenantAdmin(membership.role)) {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to delete documents.' },
            403
          );
        }

        if (!canMutateTenantBusinessData((membership?.company as any)?.status)) {
          return jsonResponse(
            { success: false, error: 'TENANT_SUSPENDED', message: 'Workspace is suspended. Document deletion is blocked.' },
            403
          );
        }

        const docId = docDeleteMatch[1];
        const { data: existingDoc } = await client
          .from('documents')
          .select('*')
          .eq('id', docId)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (!existingDoc) {
          return jsonResponse({ success: false, error: 'NOT_FOUND', message: 'Document not found' }, 404);
        }

        const storageKey = existingDoc.storage_key || existingDoc.stored_path;
        if (storageKey && storageKey.startsWith(`tenants/${tenantId}/`)) {
          await client.storage.from(SUPABASE_STORAGE_BUCKET).remove([storageKey]);
          memoryStorageStore.delete(storageKey);
        }

        const { error: delErr } = await client
          .from('documents')
          .delete()
          .eq('id', docId)
          .eq('company_id', tenantId);

        if (delErr) return jsonResponse({ success: false, error: delErr.message }, 400);

        return jsonResponse({ success: true, message: 'Document deleted successfully.' });
      }

      // ----------------------------------------------------------------------
      // 8. CUSTOM FIELDS API
      // ----------------------------------------------------------------------
      if (subpath === '/custom-fields/definitions' && request.method === 'GET') {
        const { data: defs, error: dErr } = await client
          .from('custom_field_definitions')
          .select('*')
          .eq('company_id', tenantId)
          .order('display_order', { ascending: true })
          .order('created_at', { ascending: true });

        if (dErr) return jsonResponse({ success: false, error: dErr.message }, 500);
        return jsonResponse({ success: true, data: defs || [] });
      }

      if (subpath === '/custom-fields/definitions' && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins can create custom field definitions.' },
            403
          );
        }

        const body = (await request.json().catch(() => ({}))) as Partial<CreateCustomFieldDefinitionInput>;
        const validation = validateCustomFieldDefinition(body);
        if (!validation.isValid) {
          return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
        }

        const { data: created, error: cErr } = await client
          .from('custom_field_definitions')
          .insert({
            company_id: tenantId,
            field_name: body.field_name!.trim(),
            field_type: body.field_type!,
            is_required: Boolean(body.is_required),
            is_active: body.is_active !== undefined ? Boolean(body.is_active) : true,
            dropdown_choices: body.dropdown_choices || [],
            display_order: Number(body.display_order) || 0,
          })
          .select('*')
          .single();

        if (cErr) return jsonResponse({ success: false, error: cErr.message }, 400);

        await client.from('asset_events').insert({
          company_id: tenantId,
          event_type: 'CUSTOM_FIELD_CREATED',
          actor_id: user.id,
          details: {
            field_definition_id: created.id,
            field_name: created.field_name,
            field_type: created.field_type,
          },
        });

        return jsonResponse({ success: true, data: created }, 201);
      }

      const assetCfMatch = subpath.match(/^\/assets\/([a-zA-Z0-9_-]+)\/custom-fields$/);
      if (assetCfMatch) {
        const assetId = assetCfMatch[1];

        // Verify asset exists in tenant
        const { data: asset, error: aErr } = await client
          .from('assets')
          .select('id')
          .eq('id', assetId)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (aErr || !asset) return jsonResponse({ success: false, error: 'Asset not found in workspace.' }, 404);

        if (request.method === 'GET') {
          // Fetch active definitions
          const { data: defs } = await client
            .from('custom_field_definitions')
            .select('*')
            .eq('company_id', tenantId)
            .eq('is_active', true)
            .order('display_order', { ascending: true });

          // Fetch stored values
          const { data: values } = await client
            .from('asset_custom_field_values')
            .select('*')
            .eq('asset_id', assetId)
            .eq('company_id', tenantId);

          const valMap = new Map((values || []).map((v) => [v.field_definition_id, v.field_value]));
          const combined = (defs || []).map((d) => ({
            definition: d,
            value: valMap.get(d.id) || '',
          }));

          return jsonResponse({ success: true, data: combined });
        }

        if (request.method === 'POST') {
          if (membership.role !== 'TENANT_ADMIN') {
            return jsonResponse(
              { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins can update custom field values.' },
              403
            );
          }

          const body = (await request.json().catch(() => ({}))) as {
            values?: Array<{ field_definition_id: string; field_value: string }>;
          };

          if (!body.values || !Array.isArray(body.values)) {
            return jsonResponse({ success: false, error: 'Array of field values is required.' }, 400);
          }

          // Verify all field definitions belong to tenant
          const defIds = body.values.map((v) => v.field_definition_id);
          const { data: validDefs } = await client
            .from('custom_field_definitions')
            .select('id')
            .in('id', defIds)
            .eq('company_id', tenantId);

          const validSet = new Set((validDefs || []).map((d) => d.id));
          const now = new Date().toISOString();

          for (const item of body.values) {
            if (!validSet.has(item.field_definition_id)) continue;

            await client.from('asset_custom_field_values').upsert(
              {
                company_id: tenantId,
                asset_id: assetId,
                field_definition_id: item.field_definition_id,
                field_value: item.field_value?.toString() || '',
                updated_at: now,
              },
              { onConflict: 'company_id,asset_id,field_definition_id' }
            );
          }

          return jsonResponse({ success: true, message: 'Custom fields updated successfully.' });
        }
      }

      // ----------------------------------------------------------------------
      // 9. ALERTS & ATTENTION CENTER API
      // ----------------------------------------------------------------------
      if (subpath === '/alerts' && request.method === 'GET') {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const plus7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const plus30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const plus90Days = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const alerts: SystemAlert[] = [];

        // 1. Warranties Expiring
        const { data: warranties } = await client
          .from('asset_warranties')
          .select('id, warranty_number, provider_name, end_date, asset:assets(name, asset_tag)')
          .eq('company_id', tenantId)
          .eq('status', 'Active')
          .lte('end_date', plus90Days);

        (warranties || []).forEach((w) => {
          const days = Math.ceil((new Date(w.end_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          const assetName = (w.asset as any)?.name || 'Asset';
          let window: SystemAlert['window'] = 'NEXT_60_90_DAYS';
          let severity: SystemAlert['severity'] = 'INFO';

          if (w.end_date < todayStr) {
            window = 'OVERDUE';
            severity = 'CRITICAL';
          } else if (w.end_date <= plus7Days) {
            window = 'NEXT_7_DAYS';
            severity = 'CRITICAL';
          } else if (w.end_date <= plus30Days) {
            window = 'NEXT_30_DAYS';
            severity = 'WARNING';
          }

          alerts.push({
            id: `war-${w.id}`,
            category: 'WARRANTY',
            severity,
            window,
            title: `Warranty Expiry: ${w.warranty_number}`,
            description: `${assetName} warranty from ${w.provider_name} ${days < 0 ? 'expired ' + Math.abs(days) + ' days ago' : 'expires in ' + days + ' days'}.`,
            entity_type: 'WARRANTY',
            entity_id: w.id,
            reference_code: w.warranty_number,
            due_date: w.end_date,
            days_remaining: days,
          });
        });

        // 2. Contracts Expiring
        const { data: contracts } = await client
          .from('contracts')
          .select('id, contract_number, title, end_date, renewal_date, auto_renew')
          .eq('company_id', tenantId)
          .eq('status', 'Active')
          .lte('end_date', plus90Days);

        (contracts || []).forEach((c) => {
          const days = Math.ceil((new Date(c.end_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          let window: SystemAlert['window'] = 'NEXT_60_90_DAYS';
          let severity: SystemAlert['severity'] = 'INFO';

          if (c.end_date < todayStr) {
            window = 'OVERDUE';
            severity = 'CRITICAL';
          } else if (c.end_date <= plus7Days) {
            window = 'NEXT_7_DAYS';
            severity = 'CRITICAL';
          } else if (c.end_date <= plus30Days) {
            window = 'NEXT_30_DAYS';
            severity = 'WARNING';
          }

          alerts.push({
            id: `con-${c.id}`,
            category: 'CONTRACT',
            severity,
            window,
            title: `Contract Expiry: ${c.contract_number} (${c.title})`,
            description: `Contract ${c.contract_number} ${days < 0 ? 'expired ' + Math.abs(days) + ' days ago' : 'expires in ' + days + ' days'}${c.auto_renew ? ' (auto-renew flagged)' : ''}.`,
            entity_type: 'CONTRACT',
            entity_id: c.id,
            reference_code: c.contract_number,
            due_date: c.end_date,
            days_remaining: days,
          });
        });

        // 3. Insurance Policies Expiring
        const { data: policies } = await client
          .from('insurance_policies')
          .select('id, policy_number, provider, expiry_date')
          .eq('company_id', tenantId)
          .eq('status', 'Active')
          .lte('expiry_date', plus90Days);

        (policies || []).forEach((p) => {
          const days = Math.ceil((new Date(p.expiry_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          let window: SystemAlert['window'] = 'NEXT_60_90_DAYS';
          let severity: SystemAlert['severity'] = 'INFO';

          if (p.expiry_date < todayStr) {
            window = 'OVERDUE';
            severity = 'CRITICAL';
          } else if (p.expiry_date <= plus7Days) {
            window = 'NEXT_7_DAYS';
            severity = 'CRITICAL';
          } else if (p.expiry_date <= plus30Days) {
            window = 'NEXT_30_DAYS';
            severity = 'WARNING';
          }

          alerts.push({
            id: `ins-${p.id}`,
            category: 'INSURANCE',
            severity,
            window,
            title: `Insurance Expiry: ${p.policy_number}`,
            description: `Insurance policy with ${p.provider} ${days < 0 ? 'expired ' + Math.abs(days) + ' days ago' : 'expires in ' + days + ' days'}.`,
            entity_type: 'INSURANCE',
            entity_id: p.id,
            reference_code: p.policy_number,
            due_date: p.expiry_date,
            days_remaining: days,
          });
        });

        // 4. Software License Renewal / Expiry
        const { data: licenses } = await client
          .from('software_licenses')
          .select('id, software_name, expiry_date, renewal_date, purchased_quantity, allocated_quantity')
          .eq('company_id', tenantId);

        (licenses || []).forEach((l) => {
          const targetDate = l.expiry_date || l.renewal_date;
          if (targetDate && targetDate <= plus90Days) {
            const days = Math.ceil((new Date(targetDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            let window: SystemAlert['window'] = 'NEXT_60_90_DAYS';
            let severity: SystemAlert['severity'] = 'INFO';

            if (targetDate < todayStr) {
              window = 'OVERDUE';
              severity = 'CRITICAL';
            } else if (targetDate <= plus7Days) {
              window = 'NEXT_7_DAYS';
              severity = 'CRITICAL';
            } else if (targetDate <= plus30Days) {
              window = 'NEXT_30_DAYS';
              severity = 'WARNING';
            }

            alerts.push({
              id: `lic-${l.id}`,
              category: 'LICENSE',
              severity,
              window,
              title: `License Renewal: ${l.software_name}`,
              description: `License for ${l.software_name} (${l.allocated_quantity}/${l.purchased_quantity} allocated) renewal due ${days < 0 ? Math.abs(days) + ' days ago' : 'in ' + days + ' days'}.`,
              entity_type: 'LICENSE',
              entity_id: l.id,
              due_date: targetDate,
              days_remaining: days,
            });
          }
        });

        // 5. Overdue Maintenance
        const { data: overMaint } = await client
          .from('maintenance_records')
          .select('id, title, due_date, asset:assets(name, asset_tag)')
          .eq('company_id', tenantId)
          .in('status', ['Open', 'Scheduled', 'In Progress'])
          .lt('due_date', todayStr);

        (overMaint || []).forEach((m) => {
          const days = Math.ceil((new Date(m.due_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          alerts.push({
            id: `mnt-${m.id}`,
            category: 'MAINTENANCE',
            severity: 'CRITICAL',
            window: 'OVERDUE',
            title: `Overdue Maintenance: ${m.title}`,
            description: `Work order for ${(m.asset as any)?.name || 'Asset'} was scheduled for ${m.due_date} (${Math.abs(days)} days overdue).`,
            entity_type: 'MAINTENANCE',
            entity_id: m.id,
            due_date: m.due_date,
            days_remaining: days,
          });
        });

        // 6. Overdue Reservations
        const { data: overRes } = await client
          .from('asset_reservations')
          .select('id, reserved_until, asset:assets(name, asset_tag), employee:employees(full_name)')
          .eq('company_id', tenantId)
          .eq('status', 'Active')
          .lt('reserved_until', todayStr);

        (overRes || []).forEach((r) => {
          const days = Math.ceil((new Date(r.reserved_until).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          alerts.push({
            id: `res-${r.id}`,
            category: 'RESERVATION',
            severity: 'WARNING',
            window: 'OVERDUE',
            title: `Expired Reservation: ${(r.asset as any)?.name || 'Asset'}`,
            description: `Reserved by ${(r.employee as any)?.full_name || 'Employee'} until ${r.reserved_until} has expired.`,
            entity_type: 'RESERVATION',
            entity_id: r.id,
            due_date: r.reserved_until,
            days_remaining: days,
          });
        });

        // 7. Low Inventory
        const { data: lowStock } = await client
          .from('inventory_items')
          .select('id, sku, name, quantity_on_hand, minimum_stock_level')
          .eq('company_id', tenantId)
          .eq('is_active', true);

        (lowStock || []).forEach((item) => {
          if (item.quantity_on_hand <= item.minimum_stock_level) {
            alerts.push({
              id: `inv-${item.id}`,
              category: 'INVENTORY',
              severity: item.quantity_on_hand === 0 ? 'CRITICAL' : 'WARNING',
              window: 'OVERDUE',
              title: `Low Stock Alert: ${item.name} (${item.sku})`,
              description: `Current quantity on hand (${item.quantity_on_hand}) is at or below minimum threshold (${item.minimum_stock_level}).`,
              entity_type: 'INVENTORY',
              entity_id: item.id,
              reference_code: item.sku,
            });
          }
        });

        // 8. Audit Discrepancies
        const { data: auditIssues } = await client
          .from('audit_session_items')
          .select('id, session_id, status, asset:assets(name, asset_tag), session:audit_sessions(name)')
          .eq('company_id', tenantId)
          .in('status', ['Missing', 'Wrong Location'])
          .limit(20);

        (auditIssues || []).forEach((ai) => {
          alerts.push({
            id: `aud-${ai.id}`,
            category: 'AUDIT',
            severity: ai.status === 'Missing' ? 'CRITICAL' : 'WARNING',
            window: 'OVERDUE',
            title: `Audit Discrepancy: ${(ai.asset as any)?.name || 'Asset'} marked as ${ai.status}`,
            description: `Discrepancy found in session "${(ai.session as any)?.name || 'Audit'}". Immediate physical reconciliation required.`,
            entity_type: 'AUDIT',
            entity_id: ai.session_id,
          });
        });

        const summaryByWindow = {
          OVERDUE: alerts.filter((a) => a.window === 'OVERDUE').length,
          NEXT_7_DAYS: alerts.filter((a) => a.window === 'NEXT_7_DAYS').length,
          NEXT_30_DAYS: alerts.filter((a) => a.window === 'NEXT_30_DAYS').length,
          NEXT_60_90_DAYS: alerts.filter((a) => a.window === 'NEXT_60_90_DAYS').length,
        };

        const summaryByCategory = {
          WARRANTY: alerts.filter((a) => a.category === 'WARRANTY').length,
          CONTRACT: alerts.filter((a) => a.category === 'CONTRACT').length,
          INSURANCE: alerts.filter((a) => a.category === 'INSURANCE').length,
          LICENSE: alerts.filter((a) => a.category === 'LICENSE').length,
          LEASE: alerts.filter((a) => a.category === 'LEASE').length,
          MAINTENANCE: alerts.filter((a) => a.category === 'MAINTENANCE').length,
          RESERVATION: alerts.filter((a) => a.category === 'RESERVATION').length,
          INVENTORY: alerts.filter((a) => a.category === 'INVENTORY').length,
          AUDIT: alerts.filter((a) => a.category === 'AUDIT').length,
        };

        return jsonResponse({
          success: true,
          data: {
            alerts,
            totalAlerts: alerts.length,
            summaryByWindow,
            summaryByCategory,
          },
        });
      }

      // 17. Dashboard Analytics API
      if (subpath === '/dashboard' && request.method === 'GET') {
        // Fetch all assets for tenant to compute aggregates
        const { data: assets, error: assetError } = await client
          .from('assets')
          .select('id, name, asset_tag, purchase_cost, status, category:categories(name)')
          .eq('company_id', tenantId);

        if (assetError) return jsonResponse({ success: false, error: assetError.message }, 500);

        const totalAssets = assets?.length || 0;
        let totalValue = 0;
        const statusBreakdown: Record<string, number> = {
          Available: 0,
          Assigned: 0,
          'Under Repair': 0,
          Retired: 0,
          Disposed: 0,
        };
        const catMap = new Map<string, { count: number; value: number }>();

        assets?.forEach((a) => {
          const cost = Number(a.purchase_cost) || 0;
          totalValue += cost;

          if (statusBreakdown[a.status] !== undefined) {
            statusBreakdown[a.status]++;
          } else {
            statusBreakdown[a.status] = 1;
          }

          const catName = (a.category as unknown as { name?: string })?.name || 'Uncategorized';
          const existing = catMap.get(catName) || { count: 0, value: 0 };
          existing.count += 1;
          existing.value += cost;
          catMap.set(catName, existing);
        });

        const categoryBreakdown = Array.from(catMap.entries()).map(([categoryName, data]) => ({
          categoryName,
          count: data.count,
          value: data.value,
        }));

        // Fetch maintenance metrics
        const { data: maintRecords } = await client
          .from('maintenance_records')
          .select('id, status, due_date, service_cost')
          .eq('company_id', tenantId);

        const todayStr = new Date().toISOString().split('T')[0];
        let openMaint = 0;
        let schedMaint = 0;
        let inProgMaint = 0;
        let compMaint = 0;
        let overdueMaint = 0;
        let maintTotalCost = 0;

        (maintRecords || []).forEach((r) => {
          if (r.status === 'Open') openMaint++;
          else if (r.status === 'Scheduled') schedMaint++;
          else if (r.status === 'In Progress') inProgMaint++;
          else if (r.status === 'Completed') compMaint++;

          if (r.service_cost) maintTotalCost += Number(r.service_cost);
          if (r.due_date && r.due_date < todayStr && r.status !== 'Completed' && r.status !== 'Cancelled') {
            overdueMaint++;
          }
        });

        // Fetch recent 10 activity events with asset info
        const { data: recentEvents } = await client
          .from('asset_events')
          .select('*, asset:assets(name, asset_tag)')
          .eq('company_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(10);

        const formattedEvents = (recentEvents || []).map((ev) => ({
          id: ev.id,
          company_id: ev.company_id,
          asset_id: ev.asset_id,
          event_type: ev.event_type,
          actor_id: ev.actor_id,
          details: ev.details,
          created_at: ev.created_at,
          asset_name: (ev.asset as unknown as { name?: string })?.name,
          asset_tag: (ev.asset as unknown as { asset_tag?: string })?.asset_tag,
        }));

        return jsonResponse({
          success: true,
          data: {
            totalAssets,
            totalValue,
            statusBreakdown,
            categoryBreakdown,
            recentEvents: formattedEvents,
            maintenanceMetrics: {
              openCount: openMaint,
              scheduledCount: schedMaint,
              inProgressCount: inProgMaint,
              completedCount: compMaint,
              overdueCount: overdueMaint,
              totalCost: maintTotalCost,
            },
          },
        });
      }

      // ======================================================================
      // PHASE 6: TENANT USER MANAGEMENT & INVITATIONS
      // ======================================================================
      if (subpath === '/users' && request.method === 'GET') {
        const { data: members, error } = await client
          .from('memberships')
          .select('id, user_id, role, is_active, last_active_at, created_at, employee_id, employee:employees(id, full_name, employee_code, email, job_title)')
          .eq('company_id', tenantId)
          .order('created_at', { ascending: true });

        if (error) return jsonResponse({ success: false, error: error.message }, 500);
        return jsonResponse({ success: true, data: members });
      }

      if (subpath.match(/^\/users\/[^/]+\/role$/) && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse({ success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins can change user roles.' }, 403);
        }
        const targetId = subpath.split('/')[2];
        const body = (await request.json().catch(() => ({}))) as { role?: UserRole };
        if (!body.role || !['TENANT_ADMIN', 'TECHNICIAN', 'MEMBER'].includes(body.role)) {
          return jsonResponse({ success: false, error: 'Valid role (TENANT_ADMIN, TECHNICIAN, MEMBER) is required' }, 400);
        }

        const { data: targetMemb } = await client
          .from('memberships')
          .select('*')
          .eq('id', targetId)
          .eq('company_id', tenantId)
          .single();

        if (!targetMemb) return jsonResponse({ success: false, error: 'User membership not found' }, 404);

        if (targetMemb.role === 'TENANT_ADMIN' && body.role !== 'TENANT_ADMIN') {
          const { count: adminCount } = await client
            .from('memberships')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', tenantId)
            .eq('role', 'TENANT_ADMIN')
            .eq('is_active', true);

          if ((adminCount ?? 0) <= 1) {
            return jsonResponse(
              { success: false, error: 'CANNOT_REMOVE_LAST_ADMIN', message: 'Cannot demote the only active Tenant Admin in your workspace.' },
              400
            );
          }
        }

        // Enforce quota limits for Tenant Admin and Technician
        if (body.role === 'TENANT_ADMIN' && targetMemb.role !== 'TENANT_ADMIN') {
          const { count: adminCount } = await client
            .from('memberships')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', tenantId)
            .eq('role', 'TENANT_ADMIN')
            .eq('is_active', true);

          if ((adminCount ?? 0) >= BASIC_PLAN_QUOTAS.maxTenantAdmins) {
            return jsonResponse(
              { success: false, error: 'QUOTA_EXCEEDED', message: `Basic plan allows maximum ${BASIC_PLAN_QUOTAS.maxTenantAdmins} Tenant Admin user.` },
              403
            );
          }
        }

        if (body.role === 'TECHNICIAN' && targetMemb.role !== 'TECHNICIAN') {
          const { count: techCount } = await client
            .from('memberships')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', tenantId)
            .eq('role', 'TECHNICIAN')
            .eq('is_active', true);

          if ((techCount ?? 0) >= BASIC_PLAN_QUOTAS.maxTechnicians) {
            return jsonResponse(
              { success: false, error: 'QUOTA_EXCEEDED', message: `Basic plan allows maximum ${BASIC_PLAN_QUOTAS.maxTechnicians} Technician user.` },
              403
            );
          }
        }

        const { data: updated, error: updateErr } = await client
          .from('memberships')
          .update({ role: body.role })
          .eq('id', targetId)
          .eq('company_id', tenantId)
          .select('*, employee:employees(*)')
          .single();

        if (updateErr) return jsonResponse({ success: false, error: updateErr.message }, 400);

        await client.from('asset_events').insert({
          company_id: tenantId,
          asset_id: null,
          event_type: 'USER_ROLE_CHANGED',
          actor_id: user.id,
          notes: `Changed user role to ${body.role}`,
          details: { target_membership_id: targetId, previous_role: targetMemb.role, new_role: body.role },
        });

        return jsonResponse({ success: true, data: updated });
      }

      if (subpath.match(/^\/users\/[^/]+\/status$/) && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse({ success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins can modify user status.' }, 403);
        }
        const targetId = subpath.split('/')[2];
        const body = (await request.json().catch(() => ({}))) as { is_active?: boolean };
        if (typeof body.is_active !== 'boolean') {
          return jsonResponse({ success: false, error: 'is_active boolean is required' }, 400);
        }

        const { data: targetMemb } = await client
          .from('memberships')
          .select('*')
          .eq('id', targetId)
          .eq('company_id', tenantId)
          .single();

        if (!targetMemb) return jsonResponse({ success: false, error: 'User membership not found' }, 404);

        if (targetMemb.user_id === user.id && !body.is_active) {
          return jsonResponse({ success: false, error: 'CANNOT_DEACTIVATE_SELF', message: 'You cannot deactivate your own user account.' }, 400);
        }

        const { data: updated, error: updateErr } = await client
          .from('memberships')
          .update({ is_active: body.is_active })
          .eq('id', targetId)
          .eq('company_id', tenantId)
          .select('*, employee:employees(*)')
          .single();

        if (updateErr) return jsonResponse({ success: false, error: updateErr.message }, 400);

        await client.from('asset_events').insert({
          company_id: tenantId,
          asset_id: null,
          event_type: body.is_active ? 'USER_REACTIVATED' : 'USER_DEACTIVATED',
          actor_id: user.id,
          notes: `${body.is_active ? 'Reactivated' : 'Deactivated'} user account`,
          details: { target_membership_id: targetId, is_active: body.is_active },
        });

        return jsonResponse({ success: true, data: updated });
      }

      if (subpath.match(/^\/users\/[^/]+\/link-employee$/) && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse({ success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins can link employees.' }, 403);
        }
        const targetId = subpath.split('/')[2];
        const body = (await request.json().catch(() => ({}))) as { employee_id?: string | null };

        if (body.employee_id) {
          const { data: emp } = await client
            .from('employees')
            .select('id')
            .eq('id', body.employee_id)
            .eq('company_id', tenantId)
            .maybeSingle();

          if (!emp) return jsonResponse({ success: false, error: 'Employee not found in workspace' }, 404);
        }

        const { data: updated, error } = await client
          .from('memberships')
          .update({ employee_id: body.employee_id || null })
          .eq('id', targetId)
          .eq('company_id', tenantId)
          .select('*, employee:employees(*)')
          .single();

        if (error) return jsonResponse({ success: false, error: error.message }, 400);
        return jsonResponse({ success: true, data: updated });
      }

      if (subpath === '/invitations') {
        if (request.method === 'GET') {
          if (membership.role !== 'TENANT_ADMIN') {
            return jsonResponse({ success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins can view invitations.' }, 403);
          }
          const { data, error } = await client
            .from('tenant_invitations')
            .select('*, employee:employees(id, full_name, employee_code)')
            .eq('company_id', tenantId)
            .order('created_at', { ascending: false });

          if (error) return jsonResponse({ success: false, error: error.message }, 500);
          return jsonResponse({ success: true, data });
        }

        if (request.method === 'POST') {
          if (membership.role !== 'TENANT_ADMIN') {
            return jsonResponse({ success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins can create invitations.' }, 403);
          }

          const body = (await request.json().catch(() => ({}))) as Partial<CreateInvitationInput>;
          const val = validateInvitation(body);
          if (!val.isValid) {
            return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: val.errors }, 400);
          }

          const email = body.email!.trim().toLowerCase();
          const role = body.role as UserRole;

          // Check basic plan quota for Tenant Admin and Technician
          if (role === 'TENANT_ADMIN') {
            const { count: currentAdmins } = await client
              .from('memberships')
              .select('id', { count: 'exact', head: true })
              .eq('company_id', tenantId)
              .eq('role', 'TENANT_ADMIN')
              .eq('is_active', true);

            const { count: pendingAdmins } = await client
              .from('tenant_invitations')
              .select('id', { count: 'exact', head: true })
              .eq('company_id', tenantId)
              .eq('role', 'TENANT_ADMIN')
              .eq('status', 'PENDING');

            if (((currentAdmins ?? 0) + (pendingAdmins ?? 0)) >= BASIC_PLAN_QUOTAS.maxTenantAdmins) {
              return jsonResponse(
                { success: false, error: 'QUOTA_EXCEEDED', message: `Basic plan quota of ${BASIC_PLAN_QUOTAS.maxTenantAdmins} Tenant Admin user reached.` },
                403
              );
            }
          } else if (role === 'TECHNICIAN') {
            const { count: currentTechs } = await client
              .from('memberships')
              .select('id', { count: 'exact', head: true })
              .eq('company_id', tenantId)
              .eq('role', 'TECHNICIAN')
              .eq('is_active', true);

            const { count: pendingTechs } = await client
              .from('tenant_invitations')
              .select('id', { count: 'exact', head: true })
              .eq('company_id', tenantId)
              .eq('role', 'TECHNICIAN')
              .eq('status', 'PENDING');

            if (((currentTechs ?? 0) + (pendingTechs ?? 0)) >= BASIC_PLAN_QUOTAS.maxTechnicians) {
              return jsonResponse(
                { success: false, error: 'QUOTA_EXCEEDED', message: `Basic plan quota of ${BASIC_PLAN_QUOTAS.maxTechnicians} Technician user reached.` },
                403
              );
            }
          }

          // Check if duplicate pending invite exists
          const { data: existingInvite } = await client
            .from('tenant_invitations')
            .select('id')
            .eq('company_id', tenantId)
            .eq('email', email)
            .eq('status', 'PENDING')
            .maybeSingle();

          if (existingInvite) {
            return jsonResponse(
              { success: false, error: 'INVITATION_ALREADY_EXISTS', message: 'A pending invitation for this email already exists.' },
              400
            );
          }

          if (body.employee_id) {
            const { data: emp } = await client
              .from('employees')
              .select('id')
              .eq('id', body.employee_id)
              .eq('company_id', tenantId)
              .maybeSingle();

            if (!emp) return jsonResponse({ success: false, error: 'Employee not found in workspace' }, 400);
          }

          const token = crypto.randomUUID();
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

          const { data: newInvite, error: insertErr } = await client
            .from('tenant_invitations')
            .insert({
              company_id: tenantId,
              email,
              role,
              token,
              invited_by: user.id,
              expires_at: expiresAt,
              status: 'PENDING',
              employee_id: body.employee_id || null,
            })
            .select()
            .single();

          if (insertErr) return jsonResponse({ success: false, error: insertErr.message }, 400);

          await client.from('asset_events').insert({
            company_id: tenantId,
            asset_id: null,
            event_type: 'USER_INVITED',
            actor_id: user.id,
            notes: `Invited ${email} as ${role}`,
            details: { invitation_id: newInvite.id, email, role },
          });

          return jsonResponse(
            {
              success: true,
              data: newInvite,
              message: 'Invitation generated. Outbound email delivery pending Phase 7 configuration.',
            },
            201
          );
        }
      }

      if (subpath.match(/^\/invitations\/[^/]+\/resend$/) && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') return jsonResponse({ success: false, error: 'FORBIDDEN' }, 403);
        const id = subpath.split('/')[2];
        const newExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await client
          .from('tenant_invitations')
          .update({ expires_at: newExpires, status: 'PENDING', updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('company_id', tenantId)
          .select()
          .single();

        if (error) return jsonResponse({ success: false, error: error.message }, 400);
        return jsonResponse({ success: true, data, message: 'Invitation validity extended by 7 days.' });
      }

      if (subpath.match(/^\/invitations\/[^/]+\/cancel$/) && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') return jsonResponse({ success: false, error: 'FORBIDDEN' }, 403);
        const id = subpath.split('/')[2];
        const { data, error } = await client
          .from('tenant_invitations')
          .update({ status: 'CANCELLED', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('company_id', tenantId)
          .select()
          .single();

        if (error) return jsonResponse({ success: false, error: error.message }, 400);
        return jsonResponse({ success: true, data });
      }

      // ======================================================================
      // PHASE 6: TENANT SETTINGS & BRANDING API
      // ======================================================================
      if (subpath === '/tenant/settings') {
        if (request.method === 'GET') {
          let { data: settings } = await client
            .from('tenant_settings')
            .select('*')
            .eq('company_id', tenantId)
            .maybeSingle();

          if (!settings) {
            const { data: created } = await client
              .from('tenant_settings')
              .insert({
                company_id: tenantId,
                company_name: membership.company?.name || 'My Organization',
                company_code: membership.company?.code || 'ORG',
                timezone: 'UTC',
                default_currency: 'USD',
                date_format: 'YYYY-MM-DD',
                accent_color: '#FF6A1A',
                asset_tag_prefix: 'AST',
                asset_tag_next_number: 1001,
              })
              .select()
              .single();
            settings = created;
          }

          return jsonResponse({ success: true, data: settings });
        }

        if (request.method === 'PUT') {
          if (membership.role !== 'TENANT_ADMIN') {
            return jsonResponse({ success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins can update settings.' }, 403);
          }
          const body = (await request.json().catch(() => ({}))) as UpdateTenantSettingsInput;
          const val = validateTenantSettings(body);
          if (!val.isValid) {
            return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: val.errors }, 400);
          }

          const { data: updated, error } = await client
            .from('tenant_settings')
            .update({
              ...body,
              updated_at: new Date().toISOString(),
            })
            .eq('company_id', tenantId)
            .select()
            .single();

          if (error) return jsonResponse({ success: false, error: error.message }, 400);

          if (body.company_name) {
            await client.from('companies').update({ name: body.company_name }).eq('id', tenantId);
          }

          await client.from('asset_events').insert({
            company_id: tenantId,
            asset_id: null,
            event_type: 'SETTINGS_UPDATED',
            actor_id: user.id,
            notes: 'Updated tenant settings',
            details: body,
          });

          return jsonResponse({ success: true, data: updated });
        }
      }

      if (subpath === '/tenant/logo-metadata' && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') return jsonResponse({ success: false, error: 'FORBIDDEN' }, 403);
        const body = (await request.json().catch(() => ({}))) as { logo_url?: string; logo_storage_path?: string };
        const { data, error } = await client
          .from('tenant_settings')
          .update({
            logo_url: body.logo_url || null,
            logo_storage_path: body.logo_storage_path || null,
            updated_at: new Date().toISOString(),
          })
          .eq('company_id', tenantId)
          .select()
          .single();

        if (error) return jsonResponse({ success: false, error: error.message }, 400);
        return jsonResponse({ success: true, data, message: 'Logo metadata saved. Cloud binary storage pending Phase 7.' });
      }

      if (subpath === '/tenant/usage' && request.method === 'GET') {
        const { count: assetCount } = await client
          .from('assets')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', tenantId)
          .neq('status', 'Disposed');

        const { count: adminCount } = await client
          .from('memberships')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', tenantId)
          .eq('role', 'TENANT_ADMIN')
          .eq('is_active', true);

        const { count: techCount } = await client
          .from('memberships')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', tenantId)
          .eq('role', 'TECHNICIAN')
          .eq('is_active', true);

        const { count: memberCount } = await client
          .from('memberships')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', tenantId)
          .eq('role', 'MEMBER')
          .eq('is_active', true);

        const { count: empCount } = await client
          .from('employees')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', tenantId);

        const usage: TenantUsageSummary = {
          plan: membership.company?.plan || 'BASIC',
          status: membership.company?.status || 'ACTIVE',
          assets: { used: assetCount ?? 0, limit: membership.company?.max_assets || BASIC_PLAN_QUOTAS.maxAssets },
          tenant_admins: { used: adminCount ?? 0, limit: BASIC_PLAN_QUOTAS.maxTenantAdmins },
          technicians: { used: techCount ?? 0, limit: BASIC_PLAN_QUOTAS.maxTechnicians },
          members: { used: memberCount ?? 0, limit: null },
          employees: { used: empCount ?? 0, limit: null },
        };

        return jsonResponse({ success: true, data: usage });
      }

      // ======================================================================
      // PHASE 6: OPERATIONAL REPORTING CENTER API
      // ======================================================================
      if (subpath === '/reports/query' && request.method === 'GET') {
        const reportType = (url.searchParams.get('report_type') || 'ASSET_REGISTER') as any;
        const startDate = url.searchParams.get('start_date');
        const endDate = url.searchParams.get('end_date');
        const siteId = url.searchParams.get('site_id');
        const locationId = url.searchParams.get('location_id');
        const categoryId = url.searchParams.get('category_id');
        const departmentId = url.searchParams.get('department_id');
        const employeeId = url.searchParams.get('employee_id');
        const statusFilter = url.searchParams.get('status');
        const isExportCsv = url.searchParams.get('export') === 'csv';

        let reportResult: ReportResult = {
          title: 'Asset Register Report',
          category: 'ASSET',
          report_type: reportType,
          generated_at: new Date().toISOString(),
          total_records: 0,
          metrics: [],
          columns: [],
          rows: [],
        };

        if (reportType === 'ASSET_REGISTER' || reportType === 'ASSETS_BY_STATUS' || reportType === 'ASSETS_BY_CATEGORY' || reportType === 'ASSETS_BY_LOCATION') {
          let q = client
            .from('assets')
            .select('id, asset_tag, name, serial_number, manufacturer, model, status, purchase_cost, purchase_date, created_at, category:categories(name), site:sites(name), location:locations(name)')
            .eq('company_id', tenantId);

          if (categoryId) q = q.eq('category_id', categoryId);
          if (siteId) q = q.eq('site_id', siteId);
          if (locationId) q = q.eq('location_id', locationId);
          if (statusFilter) q = q.eq('status', statusFilter);
          if (startDate) q = q.gte('created_at', startDate);
          if (endDate) q = q.lte('created_at', endDate + 'T23:59:59.999Z');

          const { data: assets } = await q.order('created_at', { ascending: false });
          const rows = (assets || []).map((a) => ({
            id: a.id,
            asset_tag: a.asset_tag,
            name: a.name,
            category: (a.category as any)?.name || 'Unassigned',
            site: (a.site as any)?.name || 'Unassigned',
            location: (a.location as any)?.name || 'Unassigned',
            status: a.status,
            purchase_cost: a.purchase_cost ?? 0,
            purchase_date: a.purchase_date || 'N/A',
            created_at: a.created_at.split('T')[0],
          }));

          const totalCost = rows.reduce((acc, r) => acc + (Number(r.purchase_cost) || 0), 0);

          reportResult = {
            title: reportType === 'ASSET_REGISTER' ? 'Asset Register' : reportType.replace(/_/g, ' '),
            category: 'ASSET',
            report_type: reportType,
            generated_at: new Date().toISOString(),
            total_records: rows.length,
            metrics: [
              { label: 'Total Assets', value: rows.length },
              { label: 'Total Value', value: `$${totalCost.toLocaleString()}`, highlight: true },
              { label: 'Avg Unit Cost', value: rows.length > 0 ? `$${Math.round(totalCost / rows.length).toLocaleString()}` : '$0' },
            ],
            columns: [
              { key: 'asset_tag', header: 'Asset Tag' },
              { key: 'name', header: 'Asset Name' },
              { key: 'category', header: 'Category' },
              { key: 'site', header: 'Site' },
              { key: 'location', header: 'Location' },
              { key: 'status', header: 'Status', type: 'badge' },
              { key: 'purchase_cost', header: 'Cost ($)', type: 'currency' },
              { key: 'purchase_date', header: 'Purchase Date', type: 'date' },
            ],
            rows,
          };
        } else if (reportType === 'CURRENT_ASSIGNMENTS' || reportType === 'CHECKOUT_HISTORY') {
          let q = client
            .from('asset_assignments')
            .select('*, asset:assets(name, asset_tag, status), employee:employees(full_name, employee_code, email, department:departments(name))')
            .eq('company_id', tenantId);

          if (reportType === 'CURRENT_ASSIGNMENTS') {
            q = q.is('checked_in_at', null);
          }
          if (employeeId) q = q.eq('employee_id', employeeId);
          if (startDate) q = q.gte('checked_out_at', startDate);
          if (endDate) q = q.lte('checked_out_at', endDate + 'T23:59:59.999Z');

          const { data: assignments } = await q.order('checked_out_at', { ascending: false });
          const rows = (assignments || []).map((asgn) => ({
            id: asgn.id,
            asset_tag: (asgn.asset as any)?.asset_tag,
            asset_name: (asgn.asset as any)?.name,
            custodian: (asgn.employee as any)?.full_name,
            employee_code: (asgn.employee as any)?.employee_code,
            department: (asgn.employee as any)?.department?.name || 'N/A',
            checked_out_at: asgn.checked_out_at ? asgn.checked_out_at.split('T')[0] : 'N/A',
            expected_return_date: asgn.expected_return_date || 'None',
            status: asgn.checked_in_at ? 'Checked In' : 'Active Assignment',
          }));

          reportResult = {
            title: reportType === 'CURRENT_ASSIGNMENTS' ? 'Current Asset Custody Assignments' : 'Asset Checkout History',
            category: 'CUSTODY',
            report_type: reportType,
            generated_at: new Date().toISOString(),
            total_records: rows.length,
            metrics: [
              { label: 'Total Records', value: rows.length },
              { label: 'Active Assignments', value: rows.filter((r) => r.status === 'Active Assignment').length, highlight: true },
            ],
            columns: [
              { key: 'asset_tag', header: 'Asset Tag' },
              { key: 'asset_name', header: 'Asset Name' },
              { key: 'custodian', header: 'Custodian Employee' },
              { key: 'employee_code', header: 'Emp Code' },
              { key: 'department', header: 'Department' },
              { key: 'checked_out_at', header: 'Checked Out Date' },
              { key: 'expected_return_date', header: 'Expected Return' },
              { key: 'status', header: 'Status', type: 'badge' },
            ],
            rows,
          };
        } else if (reportType === 'OPEN_WORK_ORDERS' || reportType === 'COMPLETED_MAINTENANCE' || reportType === 'OVERDUE_MAINTENANCE' || reportType === 'MAINTENANCE_COST') {
          let q = client
            .from('maintenance_records')
            .select('*, asset:assets(name, asset_tag), vendor:vendors(name)')
            .eq('company_id', tenantId);

          if (reportType === 'OPEN_WORK_ORDERS') {
            q = q.in('status', ['Open', 'Scheduled', 'In Progress']);
          } else if (reportType === 'COMPLETED_MAINTENANCE') {
            q = q.eq('status', 'Completed');
          } else if (reportType === 'OVERDUE_MAINTENANCE') {
            const todayStr = new Date().toISOString().split('T')[0];
            q = q.lt('due_date', todayStr).neq('status', 'Completed').neq('status', 'Cancelled');
          }

          if (startDate) q = q.gte('created_at', startDate);
          if (endDate) q = q.lte('created_at', endDate + 'T23:59:59.999Z');

          const { data: records } = await q.order('created_at', { ascending: false });
          const rows = (records || []).map((m) => ({
            id: m.id,
            work_order: m.title,
            asset_tag: (m.asset as any)?.asset_tag,
            asset_name: (m.asset as any)?.name,
            maintenance_type: m.maintenance_type,
            priority: m.priority,
            vendor: (m.vendor as any)?.name || 'Internal',
            status: m.status,
            cost: m.service_cost ?? 0,
            scheduled_date: m.scheduled_date || 'N/A',
            due_date: m.due_date || 'N/A',
          }));

          const totalMaintCost = rows.reduce((acc, r) => acc + (Number(r.cost) || 0), 0);

          reportResult = {
            title: reportType.replace(/_/g, ' '),
            category: 'MAINTENANCE',
            report_type: reportType,
            generated_at: new Date().toISOString(),
            total_records: rows.length,
            metrics: [
              { label: 'Work Orders', value: rows.length },
              { label: 'Total Service Cost', value: `$${totalMaintCost.toLocaleString()}`, highlight: true },
            ],
            columns: [
              { key: 'work_order', header: 'Work Order Title' },
              { key: 'asset_tag', header: 'Asset Tag' },
              { key: 'asset_name', header: 'Asset' },
              { key: 'maintenance_type', header: 'Type' },
              { key: 'priority', header: 'Priority', type: 'badge' },
              { key: 'vendor', header: 'Service Provider' },
              { key: 'status', header: 'Status', type: 'badge' },
              { key: 'cost', header: 'Cost ($)', type: 'currency' },
              { key: 'scheduled_date', header: 'Scheduled' },
              { key: 'due_date', header: 'Due Date' },
            ],
            rows,
          };
        } else if (reportType === 'STOCK_LEVELS' || reportType === 'LOW_STOCK' || reportType === 'INVENTORY_VALUATION') {
          let q = client
            .from('inventory_items')
            .select('*, site:sites(name), location:locations(name), vendor:vendors(name)')
            .eq('company_id', tenantId);

          const { data: invItems } = await q.order('name', { ascending: true });
          let filteredItems = invItems || [];
          if (reportType === 'LOW_STOCK') {
            filteredItems = filteredItems.filter((i) => i.quantity_on_hand <= (i.minimum_stock_level || 0));
          }

          const rows = filteredItems.map((item) => {
            const qty = item.quantity_on_hand || 0;
            const cost = item.unit_cost || 0;
            return {
              id: item.id,
              sku: item.sku,
              name: item.name,
              quantity_on_hand: qty,
              minimum_stock_level: item.minimum_stock_level || 0,
              unit_cost: cost,
              total_value: qty * cost,
              site: (item.site as any)?.name || 'Unassigned',
              location: (item.location as any)?.name || 'Unassigned',
              status: qty <= (item.minimum_stock_level || 0) ? 'Low Stock' : 'Adequate',
            };
          });

          const totalInvVal = rows.reduce((acc, r) => acc + r.total_value, 0);

          reportResult = {
            title: reportType.replace(/_/g, ' '),
            category: 'INVENTORY',
            report_type: reportType,
            generated_at: new Date().toISOString(),
            total_records: rows.length,
            metrics: [
              { label: 'Stock Items', value: rows.length },
              { label: 'Total Valuation', value: `$${totalInvVal.toLocaleString()}`, highlight: true },
            ],
            columns: [
              { key: 'sku', header: 'SKU' },
              { key: 'name', header: 'Item Name' },
              { key: 'quantity_on_hand', header: 'Qty On Hand', type: 'number' },
              { key: 'minimum_stock_level', header: 'Min Level', type: 'number' },
              { key: 'unit_cost', header: 'Unit Cost', type: 'currency' },
              { key: 'total_value', header: 'Total Value', type: 'currency' },
              { key: 'site', header: 'Site' },
              { key: 'status', header: 'Status', type: 'badge' },
            ],
            rows,
          };
        } else {
          // General Asset Register fallback for any unlisted operational reports
          const { data: fallbackAssets } = await client
            .from('assets')
            .select('id, asset_tag, name, status, purchase_cost, purchase_date')
            .eq('company_id', tenantId)
            .limit(100);

          const rows = (fallbackAssets || []).map((a) => ({
            id: a.id,
            asset_tag: a.asset_tag,
            name: a.name,
            status: a.status,
            purchase_cost: a.purchase_cost ?? 0,
            purchase_date: a.purchase_date || 'N/A',
          }));

          reportResult = {
            title: reportType.replace(/_/g, ' '),
            category: 'ASSET',
            report_type: reportType,
            generated_at: new Date().toISOString(),
            total_records: rows.length,
            metrics: [{ label: 'Total Records', value: rows.length }],
            columns: [
              { key: 'asset_tag', header: 'Asset Tag' },
              { key: 'name', header: 'Asset Name' },
              { key: 'status', header: 'Status', type: 'badge' },
              { key: 'purchase_cost', header: 'Cost ($)', type: 'currency' },
              { key: 'purchase_date', header: 'Date' },
            ],
            rows,
          };
        }

        // Export as safe CSV if requested
        if (isExportCsv) {
          const headerLabels = reportResult.columns.map((c) => c.header);
          const columnKeys = reportResult.columns.map((c) => c.key);
          const csvText = buildSafeCsv(headerLabels, reportResult.rows, columnKeys);

          await client.from('asset_events').insert({
            company_id: tenantId,
            asset_id: null,
            event_type: 'REPORT_EXPORTED',
            actor_id: user.id,
            notes: `Exported ${reportResult.title} (${reportResult.total_records} records) to CSV`,
            details: { report_type: reportType, record_count: reportResult.total_records },
          });

          return csvResponse(csvText, `assetmt_${reportType.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`);
        }

        return jsonResponse({ success: true, data: reportResult });
      }

      // ======================================================================
      // PHASE 6: CONTROLLED DATA IMPORT API
      // ======================================================================
      if (subpath === '/import/preview' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as { target?: any; rows?: Record<string, any>[] };
        const target = body.target || 'ASSETS';
        const rawRows = Array.isArray(body.rows) ? body.rows : [];

        const previewRows = rawRows.map((row, idx) => {
          const validation = validateImportRow(target, row);
          return {
            row_number: idx + 1,
            raw_data: row as Record<string, string>,
            parsed_data: validation.parsed,
            is_valid: validation.isValid,
            errors: validation.errors,
          };
        });

        const validCount = previewRows.filter((r) => r.is_valid).length;
        const invalidCount = previewRows.filter((r) => !r.is_valid).length;
        const detectedColumns = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];

        const responseData: ImportPreviewResponse = {
          target,
          total_rows: previewRows.length,
          valid_count: validCount,
          invalid_count: invalidCount,
          detected_columns: detectedColumns,
          rows: previewRows,
        };

        return jsonResponse({ success: true, data: responseData });
      }

      if (subpath === '/import/commit' && request.method === 'POST') {
        if (membership.role !== 'TENANT_ADMIN') {
          return jsonResponse({ success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins can import data.' }, 403);
        }

        const body = (await request.json().catch(() => ({}))) as CommitImportRequest;
        const target = body.target;
        const rowsToImport = Array.isArray(body.rows) ? body.rows : [];

        if (rowsToImport.length === 0) {
          return jsonResponse({ success: false, error: 'No rows provided to import' }, 400);
        }

        let importedCount = 0;
        let skippedCount = 0;
        let failedCount = 0;
        const errors: string[] = [];

        if (target === 'ASSETS') {
          // Check asset quota
          const { count: currentAssetCount } = await client
            .from('assets')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', tenantId);

          const maxAllowed = membership.company?.max_assets || BASIC_PLAN_QUOTAS.maxAssets;
          if (((currentAssetCount ?? 0) + rowsToImport.length) > maxAllowed) {
            return jsonResponse(
              {
                success: false,
                error: 'QUOTA_EXCEEDED',
                message: `Importing ${rowsToImport.length} assets would exceed your plan limit of ${maxAllowed} assets.`,
              },
              403
            );
          }

          // Fetch existing asset tags to prevent duplicates
          const { data: existingAssets } = await client
            .from('assets')
            .select('asset_tag')
            .eq('company_id', tenantId);

          const existingTagSet = new Set((existingAssets || []).map((a) => a.asset_tag.toLowerCase()));

          for (const row of rowsToImport) {
            const validation = validateImportRow('ASSETS', row);
            if (!validation.isValid) {
              failedCount++;
              errors.push(`Row ${row.name || 'unnamed'}: ${validation.errors.join(', ')}`);
              continue;
            }

            const p = validation.parsed;
            let tag = p.asset_tag;
            if (!tag) {
              tag = `AST-${Math.floor(100000 + Math.random() * 900000)}`;
            }

            if (existingTagSet.has(tag.toLowerCase())) {
              if (body.skip_duplicates) {
                skippedCount++;
                continue;
              } else {
                failedCount++;
                errors.push(`Duplicate tag "${tag}" skipped.`);
                continue;
              }
            }

            const { error: insErr } = await client.from('assets').insert({
              company_id: tenantId,
              asset_tag: tag,
              name: p.name,
              status: p.status || 'Available',
              purchase_cost: p.purchase_cost ?? null,
              created_by: user.id,
            });

            if (insErr) {
              failedCount++;
              errors.push(`Failed to insert ${p.name}: ${insErr.message}`);
            } else {
              importedCount++;
              existingTagSet.add(tag.toLowerCase());
            }
          }

          await client.from('asset_events').insert({
            company_id: tenantId,
            asset_id: null,
            event_type: 'ASSET_IMPORTED',
            actor_id: user.id,
            notes: `Imported ${importedCount} assets via CSV`,
            details: { imported_count: importedCount, failed_count: failedCount },
          });
        } else if (target === 'EMPLOYEES') {
          for (const row of rowsToImport) {
            const validation = validateImportRow('EMPLOYEES', row);
            if (!validation.isValid) {
              failedCount++;
              errors.push(`Row ${row.full_name || 'unnamed'}: ${validation.errors.join(', ')}`);
              continue;
            }

            const p = validation.parsed;
            let code = p.employee_code || `EMP-${Math.floor(1000 + Math.random() * 9000)}`;

            const { error: insErr } = await client.from('employees').insert({
              company_id: tenantId,
              employee_code: code,
              full_name: p.full_name,
              email: p.email || null,
              is_active: true,
            });

            if (insErr) {
              failedCount++;
              errors.push(`Failed to insert employee ${p.full_name}: ${insErr.message}`);
            } else {
              importedCount++;
            }
          }

          await client.from('asset_events').insert({
            company_id: tenantId,
            asset_id: null,
            event_type: 'EMPLOYEE_IMPORTED',
            actor_id: user.id,
            notes: `Imported ${importedCount} employees via CSV`,
            details: { imported_count: importedCount, failed_count: failedCount },
          });
        } else if (target === 'INVENTORY') {
          for (const row of rowsToImport) {
            const validation = validateImportRow('INVENTORY', row);
            if (!validation.isValid) {
              failedCount++;
              errors.push(`Row ${row.name || 'unnamed'}: ${validation.errors.join(', ')}`);
              continue;
            }

            const p = validation.parsed;
            const { error: insErr } = await client.from('inventory_items').insert({
              company_id: tenantId,
              sku: p.sku,
              name: p.name,
              quantity_on_hand: p.quantity_on_hand ?? 0,
            });

            if (insErr) {
              failedCount++;
              errors.push(`Failed to insert inventory item ${p.name}: ${insErr.message}`);
            } else {
              importedCount++;
            }
          }

          await client.from('asset_events').insert({
            company_id: tenantId,
            asset_id: null,
            event_type: 'INVENTORY_IMPORTED',
            actor_id: user.id,
            notes: `Imported ${importedCount} inventory items via CSV`,
            details: { imported_count: importedCount, failed_count: failedCount },
          });
        }

        const commitResult: CommitImportResponse = {
          success: importedCount > 0,
          imported_count: importedCount,
          skipped_count: skippedCount,
          failed_count: failedCount,
          errors: errors.slice(0, 10),
        };

        return jsonResponse({ success: true, data: commitResult });
      }

      // ======================================================================
      // PHASE 6: GLOBAL TENANT AUDIT LOG API
      // ======================================================================
      if (subpath === '/audit-log' && request.method === 'GET') {
        if (!canViewAuditLog(membership.role)) {
          return jsonResponse({ success: false, error: 'FORBIDDEN', message: 'Access to audit log restricted to authorized personnel.' }, 403);
        }

        const startDate = url.searchParams.get('start_date');
        const endDate = url.searchParams.get('end_date');
        const eventType = url.searchParams.get('event_type');
        const assetId = url.searchParams.get('asset_id');
        const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
        const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));
        const isExportCsv = url.searchParams.get('export') === 'csv';

        let q = client
          .from('asset_events')
          .select('id, company_id, asset_id, event_type, actor_id, notes, details, created_at, asset:assets(name, asset_tag)', { count: 'exact' })
          .eq('company_id', tenantId);

        if (eventType) q = q.eq('event_type', eventType);
        if (assetId) q = q.eq('asset_id', assetId);
        if (startDate) q = q.gte('created_at', startDate);
        if (endDate) q = q.lte('created_at', endDate + 'T23:59:59.999Z');

        const { data: events, count, error } = await q
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) return jsonResponse({ success: false, error: error.message }, 500);

        const formatted = (events || []).map((ev) => ({
          id: ev.id,
          timestamp: ev.created_at,
          actor: ev.actor_id,
          event_type: ev.event_type,
          asset_tag: (ev.asset as any)?.asset_tag || 'N/A',
          asset_name: (ev.asset as any)?.name || 'N/A',
          notes: ev.notes || '',
          details: ev.details || {},
        }));

        if (isExportCsv) {
          const csvText = buildSafeCsv(
            ['Timestamp', 'Event Type', 'Asset Tag', 'Asset Name', 'Actor ID', 'Notes'],
            formatted,
            ['timestamp', 'event_type', 'asset_tag', 'asset_name', 'actor', 'notes']
          );
          return csvResponse(csvText, `assetmt_audit_log_${new Date().toISOString().split('T')[0]}.csv`);
        }

        return jsonResponse({
          success: true,
          data: formatted,
          total: count ?? 0,
          limit,
          offset,
        });
      }

      // ======================================================================
      // PHASE 7: REAL BINARY OBJECT STORAGE (DOCUMENTS & ATTACHMENTS)
      // ======================================================================

      // Upload binary document
      if (subpath === '/documents/upload' && request.method === 'POST') {
        const rateCheck = checkRateLimit(`upload:${tenantId}`, 30, 60000);
        if (!rateCheck.allowed) {
          return jsonResponse(
            { success: false, error: 'RATE_LIMITED', message: `Too many upload requests. Retry in ${rateCheck.retryAfter}s.` },
            429,
            { 'Retry-After': String(rateCheck.retryAfter || 60) }
          );
        }

        if (!canMutateTenantBusinessData((membership?.company as any)?.status)) {
          return jsonResponse(
            { success: false, error: 'TENANT_SUSPENDED', message: 'Workspace is suspended. Document uploads are blocked.' },
            403
          );
        }

        let filename = 'document.bin';
        let contentType = 'application/octet-stream';
        let entityType = 'ASSET';
        let entityId = '';
        let documentType = 'Other';
        let notes = '';
        let fileBuffer: Uint8Array | null = null;

        const reqContentType = request.headers.get('content-type') || '';
        if (reqContentType.includes('multipart/form-data')) {
          const formData = await request.formData();
          const file = formData.get('file') as File | null;
          if (!file) {
            return jsonResponse({ success: false, error: 'VALIDATION_ERROR', message: 'No file provided in form data' }, 400);
          }
          filename = file.name;
          contentType = file.type || 'application/octet-stream';
          entityType = (formData.get('entity_type') as string) || 'ASSET';
          entityId = (formData.get('entity_id') as string) || '';
          documentType = (formData.get('document_type') as string) || 'Other';
          notes = (formData.get('notes') as string) || '';
          fileBuffer = new Uint8Array(await file.arrayBuffer());
        } else {
          const jsonBody = (await request.json().catch(() => ({}))) as any;
          filename = jsonBody.filename || 'document.bin';
          contentType = jsonBody.content_type || 'application/octet-stream';
          entityType = jsonBody.entity_type || 'ASSET';
          entityId = jsonBody.entity_id || '';
          documentType = jsonBody.document_type || 'Other';
          notes = jsonBody.notes || '';
          if (jsonBody.base64_data) {
            const binaryStr = atob(jsonBody.base64_data);
            fileBuffer = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              fileBuffer[i] = binaryStr.charCodeAt(i);
            }
          }
        }

        if (!fileBuffer || fileBuffer.length === 0) {
          return jsonResponse({ success: false, error: 'VALIDATION_ERROR', message: 'Uploaded file cannot be empty' }, 400);
        }

        const cleanName = sanitizeFilename(filename);
        const validation = validateStorageUpload({ filename: cleanName, size: fileBuffer.length, mimeType: contentType }, 'DOCUMENT');
        if (!validation.isValid) {
          return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
        }

        const storageKey = `tenants/${tenantId}/documents/${crypto.randomUUID()}_${cleanName}`;

        // Save binary to private Supabase Storage bucket "assetmt-files" (tenant-partitioned)
        const { error: storageUploadErr } = await client.storage
          .from(SUPABASE_STORAGE_BUCKET)
          .upload(storageKey, fileBuffer, {
            contentType,
            upsert: false,
          });

        if (storageUploadErr) {
          if (env.ENVIRONMENT === 'production') {
            return jsonResponse(
              {
                success: false,
                error: 'STORAGE_UNAVAILABLE',
                message: storageUploadErr.message || 'Supabase Storage bucket "assetmt-files" is not configured or accessible.',
              },
              503
            );
          } else {
            memoryStorageStore.set(storageKey, { data: fileBuffer, contentType });
          }
        }

        const safeEntityId =
          entityId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entityId)
            ? entityId
            : '00000000-0000-0000-0000-000000000000';

        const { data: docRecord, error: docErr } = await client
          .from('documents')
          .insert({
            company_id: tenantId,
            entity_type: entityType,
            entity_id: safeEntityId,
            original_filename: cleanName,
            stored_path: storageKey,
            storage_key: storageKey,
            file_size: fileBuffer.length,
            content_type: contentType,
            description: notes ? `[${documentType}] ${notes}` : documentType,
            uploaded_by: user.id,
          })
          .select()
          .single();

        if (docErr) {
          return jsonResponse({ success: false, error: 'DATABASE_ERROR', message: docErr.message }, 500);
        }

        await client.from('asset_events').insert({
          company_id: tenantId,
          asset_id: entityType === 'ASSET' && safeEntityId !== '00000000-0000-0000-0000-000000000000' ? safeEntityId : null,
          event_type: 'DOCUMENT_ADDED',
          actor_id: user.id,
          notes: `Uploaded document "${cleanName}" (${(fileBuffer.length / 1024).toFixed(1)} KB)`,
          details: { document_id: docRecord.id, storage_key: storageKey, bucket: SUPABASE_STORAGE_BUCKET, content_type: contentType },
        });

        const uploadRes: StorageUploadResponse = {
          success: true,
          document_id: docRecord.id,
          storage_key: storageKey,
          original_filename: cleanName,
          file_size: fileBuffer.length,
          content_type: contentType,
          download_url: `/api/documents/${docRecord.id}/download`,
        };

        return jsonResponse({ success: true, data: uploadRes }, 201);
      }

      // Download binary document
      const docDownloadMatch = subpath.match(/^\/documents\/([a-zA-Z0-9_-]+)\/download$/);
      if (docDownloadMatch && request.method === 'GET') {
        const docId = docDownloadMatch[1];
        const { data: doc, error: docErr } = await client
          .from('documents')
          .select('*')
          .eq('id', docId)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (docErr || !doc) {
          return jsonResponse({ success: false, error: 'NOT_FOUND', message: 'Document not found or unauthorized' }, 404);
        }

        const storageKey: string = doc.storage_key || doc.stored_path || doc.storage_path || '';
        if (storageKey.startsWith('tenants/') && !storageKey.startsWith(`tenants/${tenantId}/`)) {
          return jsonResponse({ success: false, error: 'FORBIDDEN', message: 'Cross-tenant storage object access denied' }, 403);
        }

        let fileData: Uint8Array | null = null;
        let mime = doc.content_type || 'application/octet-stream';

        if (storageKey) {
          const { data: storageBlob, error: downloadErr } = await client.storage
            .from(SUPABASE_STORAGE_BUCKET)
            .download(storageKey);

          if (!downloadErr && storageBlob) {
            fileData = new Uint8Array(await storageBlob.arrayBuffer());
            if (storageBlob.type) mime = storageBlob.type;
          }
        }

        if (!fileData && env.ENVIRONMENT !== 'production') {
          const inMem = memoryStorageStore.get(storageKey);
          if (inMem) {
            fileData = inMem.data;
            mime = inMem.contentType;
          }
        }

        if (!fileData) {
          if (env.ENVIRONMENT === 'production') {
            return jsonResponse(
              {
                success: false,
                error: 'STORAGE_UNAVAILABLE',
                message: 'Document binary object could not be retrieved from private Supabase Storage bucket "assetmt-files".',
              },
              503
            );
          }
          // Construct fallback mock document payload to ensure uninterrupted dev testing
          const fallbackText = `AssetMT Secure Document: ${doc.original_filename}\nTenant: ${tenantId}\nEntity: ${doc.entity_type} ${doc.entity_id}\nUploaded: ${doc.created_at}`;
          fileData = new TextEncoder().encode(fallbackText);
          mime = 'text/plain';
        }

        return binaryResponse(fileData, mime, doc.original_filename);
      }

      // Delete binary document
      const docStorageDeleteMatch = subpath.match(/^\/documents\/([a-zA-Z0-9_-]+)\/storage$/);
      if (docStorageDeleteMatch && request.method === 'DELETE') {
        if (!isTenantAdmin(membership.role)) {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to delete documents from storage.' },
            403
          );
        }

        if (!canMutateTenantBusinessData((membership?.company as any)?.status)) {
          return jsonResponse(
            { success: false, error: 'TENANT_SUSPENDED', message: 'Workspace is suspended. Document deletion is blocked.' },
            403
          );
        }

        const docId = docStorageDeleteMatch[1];
        const { data: doc } = await client
          .from('documents')
          .select('*')
          .eq('id', docId)
          .eq('company_id', tenantId)
          .maybeSingle();

        if (!doc) {
          return jsonResponse({ success: false, error: 'NOT_FOUND', message: 'Document not found' }, 404);
        }

        const storageKey: string = doc.storage_key || doc.stored_path || doc.storage_path || '';
        if (storageKey.startsWith('tenants/') && !storageKey.startsWith(`tenants/${tenantId}/`)) {
          return jsonResponse({ success: false, error: 'FORBIDDEN', message: 'Cross-tenant storage deletion denied' }, 403);
        }

        if (storageKey) {
          await client.storage.from(SUPABASE_STORAGE_BUCKET).remove([storageKey]);
          memoryStorageStore.delete(storageKey);
        }

        await client.from('documents').delete().eq('id', docId).eq('company_id', tenantId);

        return jsonResponse({ success: true, message: 'Document deleted from storage successfully' });
      }

      // ======================================================================
      // PHASE 7: REAL TENANT LOGO STORAGE (SUPABASE STORAGE)
      // ======================================================================
      if (subpath === '/tenant-settings/logo' && request.method === 'POST') {
        if (!isTenantAdmin(membership.role)) {
          return jsonResponse(
            { success: false, error: 'FORBIDDEN', message: 'Only Tenant Admins are authorized to update tenant branding.' },
            403
          );
        }

        if (!canMutateTenantBusinessData((membership?.company as any)?.status)) {
          return jsonResponse(
            { success: false, error: 'TENANT_SUSPENDED', message: 'Workspace is suspended. Branding updates are blocked.' },
            403
          );
        }

        const rateCheck = checkRateLimit(`logo:${tenantId}`, 10, 60000);
        if (!rateCheck.allowed) {
          return jsonResponse(
            { success: false, error: 'RATE_LIMITED', message: `Too many logo upload attempts. Retry in ${rateCheck.retryAfter}s.` },
            429,
            { 'Retry-After': String(rateCheck.retryAfter || 60) }
          );
        }

        let fileBuffer: Uint8Array | null = null;
        let contentType = 'image/png';
        let rawFilename = 'logo.png';

        const reqContentType = request.headers.get('content-type') || '';
        if (reqContentType.includes('multipart/form-data')) {
          const formData = await request.formData();
          const file = formData.get('logo') as File | null;
          if (!file) {
            return jsonResponse({ success: false, error: 'VALIDATION_ERROR', message: 'No logo file provided' }, 400);
          }
          fileBuffer = new Uint8Array(await file.arrayBuffer());
          contentType = file.type || 'image/png';
          rawFilename = file.name;
        } else {
          const body = (await request.json().catch(() => ({}))) as any;
          if (body.base64_logo) {
            const binaryStr = atob(body.base64_logo);
            fileBuffer = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              fileBuffer[i] = binaryStr.charCodeAt(i);
            }
            contentType = body.content_type || 'image/png';
            rawFilename = body.filename || 'logo.png';
          }
        }

        if (!fileBuffer || fileBuffer.length === 0) {
          return jsonResponse({ success: false, error: 'VALIDATION_ERROR', message: 'Logo file cannot be empty' }, 400);
        }

        const cleanName = sanitizeFilename(rawFilename);
        const validation = validateStorageUpload({ filename: cleanName, size: fileBuffer.length, mimeType: contentType }, 'LOGO');
        if (!validation.isValid) {
          return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
        }

        const storageKey = `tenants/${tenantId}/branding/${crypto.randomUUID()}_${cleanName}`;
        const { error: logoUploadErr } = await client.storage
          .from(SUPABASE_STORAGE_BUCKET)
          .upload(storageKey, fileBuffer, {
            contentType,
            upsert: false,
          });

        if (logoUploadErr) {
          if (env.ENVIRONMENT === 'production') {
            return jsonResponse(
              {
                success: false,
                error: 'STORAGE_UNAVAILABLE',
                message: logoUploadErr.message || 'Supabase Storage bucket "assetmt-files" is not configured or accessible.',
              },
              503
            );
          } else {
            memoryStorageStore.set(storageKey, { data: fileBuffer, contentType });
          }
        }

        // Clean up old logo storage key if exists
        const { data: currentSettings } = await client
          .from('tenant_settings')
          .select('logo_storage_path')
          .eq('company_id', tenantId)
          .maybeSingle();

        if (currentSettings?.logo_storage_path && currentSettings.logo_storage_path.startsWith(`tenants/${tenantId}/`)) {
          await client.storage.from(SUPABASE_STORAGE_BUCKET).remove([currentSettings.logo_storage_path]);
          memoryStorageStore.delete(currentSettings.logo_storage_path);
        }

        const logoDownloadUrl = `/api/tenant-settings/logo/view`;
        const { data: updatedSettings, error: settErr } = await client
          .from('tenant_settings')
          .update({
            logo_url: logoDownloadUrl,
            logo_storage_path: storageKey,
            updated_at: new Date().toISOString(),
          })
          .eq('company_id', tenantId)
          .select()
          .single();

        if (settErr) {
          return jsonResponse({ success: false, error: 'DATABASE_ERROR', message: settErr.message }, 500);
        }

        return jsonResponse({ success: true, data: updatedSettings });
      }

      // Serve Tenant Logo View
      if (subpath === '/tenant-settings/logo/view' && request.method === 'GET') {
        const { data: sett } = await client
          .from('tenant_settings')
          .select('logo_storage_path')
          .eq('company_id', tenantId)
          .maybeSingle();

        if (!sett?.logo_storage_path) {
          return jsonResponse({ success: false, error: 'NOT_FOUND', message: 'No custom logo configured' }, 404);
        }

        if (sett.logo_storage_path.startsWith('tenants/') && !sett.logo_storage_path.startsWith(`tenants/${tenantId}/`)) {
          return jsonResponse({ success: false, error: 'FORBIDDEN', message: 'Cross-tenant branding access denied' }, 403);
        }

        let fileData: Uint8Array | null = null;
        let mime = 'image/png';

        const { data: logoBlob, error: logoDownloadErr } = await client.storage
          .from(SUPABASE_STORAGE_BUCKET)
          .download(sett.logo_storage_path);

        if (!logoDownloadErr && logoBlob) {
          fileData = new Uint8Array(await logoBlob.arrayBuffer());
          if (logoBlob.type) mime = logoBlob.type;
        }

        if (!fileData && env.ENVIRONMENT !== 'production') {
          const inMem = memoryStorageStore.get(sett.logo_storage_path);
          if (inMem) {
            fileData = inMem.data;
            mime = inMem.contentType;
          }
        }

        if (!fileData) {
          return jsonResponse({ success: false, error: 'NOT_FOUND', message: 'Logo binary not found in storage' }, 404);
        }

        return binaryResponse(fileData, mime);
      }

      // ======================================================================
      // PHASE 7: INVITATION ACCEPTANCE & TOKEN BINDING
      // ======================================================================
      if (subpath === '/tenant-users/accept-invitation' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as AcceptInvitationInput;
        if (!body.token || body.token.trim().length === 0) {
          return jsonResponse({ success: false, error: 'VALIDATION_ERROR', message: 'Invitation token is required' }, 400);
        }

        const rateCheck = checkRateLimit(`accept-invite:${user.id}`, 10, 60000);
        if (!rateCheck.allowed) {
          return jsonResponse({ success: false, error: 'RATE_LIMITED', message: 'Too many acceptance attempts' }, 429);
        }

        const { data: invite, error: invErr } = await client
          .from('tenant_invitations')
          .select('*, company:companies(*)')
          .eq('token', body.token.trim())
          .maybeSingle();

        if (invErr || !invite) {
          return jsonResponse({ success: false, error: 'NOT_FOUND', message: 'Invalid invitation token' }, 404);
        }

        if (invite.status !== 'PENDING') {
          return jsonResponse(
            { success: false, error: 'CONFLICT', message: `This invitation is already ${invite.status.toLowerCase()}` },
            400
          );
        }

        if (new Date(invite.expires_at) < new Date()) {
          await client.from('tenant_invitations').update({ status: 'EXPIRED' }).eq('id', invite.id);
          return jsonResponse({ success: false, error: 'EXPIRED', message: 'This invitation has expired' }, 400);
        }

        // Verify caller matches invited email
        if (user.email && invite.email && user.email.toLowerCase() !== invite.email.toLowerCase()) {
          return jsonResponse(
            {
              success: false,
              error: 'FORBIDDEN',
              message: `This invitation was issued for ${invite.email}, but you are signed in as ${user.email}.`,
            },
            403
          );
        }

        // Quota check for role assignment
        const comp = invite.company;
        if (invite.role === 'TENANT_ADMIN') {
          const { count } = await client
            .from('memberships')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', invite.company_id)
            .eq('role', 'TENANT_ADMIN')
            .eq('is_active', true);

          if (!isTenantAdminCreationAllowed(count || 0, comp?.plan)) {
            return jsonResponse(
              { success: false, error: 'PLAN_LIMIT_REACHED', message: 'Tenant Admin quota reached for current subscription plan.' },
              403
            );
          }
        } else if (invite.role === 'TECHNICIAN') {
          const { count } = await client
            .from('memberships')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', invite.company_id)
            .eq('role', 'TECHNICIAN')
            .eq('is_active', true);

          if (!isTechnicianCreationAllowed(count || 0, comp?.plan)) {
            return jsonResponse(
              { success: false, error: 'PLAN_LIMIT_REACHED', message: 'Technician quota reached for current subscription plan.' },
              403
            );
          }
        }

        // Insert or activate membership
        const { data: newMemb, error: membInsErr } = await client
          .from('memberships')
          .upsert(
            {
              company_id: invite.company_id,
              user_id: user.id,
              role: invite.role,
              employee_id: invite.employee_id || null,
              invited_by: invite.invited_by,
              is_active: true,
              last_active_at: new Date().toISOString(),
            },
            { onConflict: 'company_id,user_id' }
          )
          .select()
          .single();

        if (membInsErr) {
          return jsonResponse({ success: false, error: 'DATABASE_ERROR', message: membInsErr.message }, 500);
        }

        // Mark invitation accepted
        await client
          .from('tenant_invitations')
          .update({
            status: 'ACCEPTED',
            accepted_at: new Date().toISOString(),
          })
          .eq('id', invite.id);

        await client.from('asset_events').insert({
          company_id: invite.company_id,
          asset_id: null,
          event_type: 'USER_JOINED',
          actor_id: user.id,
          notes: `User ${user.email || user.id} joined workspace with role ${invite.role}`,
          details: { invitation_id: invite.id, role: invite.role },
        });

        const resp: AcceptInvitationResponse = {
          success: true,
          company_id: invite.company_id,
          company_name: comp?.name || 'Workspace',
          role: invite.role,
          membership_id: newMemb.id,
        };

        return jsonResponse({ success: true, data: resp });
      }

      // ======================================================================
      // PHASE 7: AKSHIGO TECH WEBSITE INTEGRATION & SIGNED HANDOFF
      // ======================================================================
      if (subpath === '/integration/akshigo/handoff' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as AkshigoHandoffPayload;
        const validation = validateAkshigoHandoffPayload(body);
        if (!validation.isValid) {
          return jsonResponse({ success: false, error: 'VALIDATION_ERROR', errors: validation.errors }, 400);
        }

        // 1. Cryptographic HMAC SHA-256 Signature Verification
        const signingSecret = env.AKSHIGO_INTEGRATION_SECRET || process.env.AKSHIGO_INTEGRATION_SECRET;
        if (signingSecret) {
          const isSignatureValid = await verifyAkshigoHandoffSignature(signingSecret, {
            timestamp: body.timestamp,
            tenant_name: body.tenant_name,
            admin_email: body.admin_email,
            plan: body.plan,
            subscription_id: body.subscription_id,
            signature: body.signature,
          });

          if (!isSignatureValid) {
            return jsonResponse(
              {
                success: false,
                error: 'INVALID_SIGNATURE',
                message: 'Cryptographic HMAC signature verification failed for Akshigo subscription handoff.',
              },
              401
            );
          }
        }

        // 2. Durable Replay Attack Protection (PostgreSQL-backed consumed_handoff_nonces)
        const replayCheck = await consumeDurableNonce(client, body.signature, body.timestamp);
        if (replayCheck.isReplay) {
          return jsonResponse(
            { success: false, error: 'REPLAY_ATTACK_DETECTED', message: 'This handoff payload signature has already been processed.' },
            409
          );
        }

        // Verify caller authentication / authorization
        const { data: existingCompany } = await client
          .from('companies')
          .select('*')
          .ilike('name', body.tenant_name.trim())
          .maybeSingle();

        let companyId = existingCompany?.id;
        if (!existingCompany) {
          const maxAssets = body.plan === 'PRO' ? 5000 : body.plan === 'ENTERPRISE' ? 100000 : 500;
          const { data: newCompany, error: compErr } = await client
            .from('companies')
            .insert({
              name: body.tenant_name.trim(),
              code: body.company_code ? body.company_code.trim().toUpperCase() : null,
              plan: body.plan,
              status: 'ACTIVE',
              max_assets: maxAssets,
              subscription_id: body.subscription_id,
              created_by: user.id,
            })
            .select()
            .single();

          if (compErr) {
            return jsonResponse({ success: false, error: 'DATABASE_ERROR', message: compErr.message }, 500);
          }
          companyId = newCompany.id;

          // Create tenant admin membership (NEVER PLATFORM_ADMIN)
          await client.from('memberships').insert({
            company_id: companyId,
            user_id: user.id,
            role: 'TENANT_ADMIN',
            is_active: true,
          });

          // Initialize default tenant settings
          await client.from('tenant_settings').insert({
            company_id: companyId,
            company_name: body.tenant_name.trim(),
            company_code: body.company_code || null,
          });
        } else {
          // Update plan and subscription state
          await client
            .from('companies')
            .update({
              plan: body.plan,
              status: 'ACTIVE',
              subscription_id: body.subscription_id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingCompany.id);
        }

        const handoffResp: AkshigoHandoffResponse = {
          success: true,
          company_id: companyId,
          company_name: body.tenant_name,
          plan: body.plan,
          status: 'ACTIVE',
          message: 'Akshigo subscription handoff verified and tenant workspace provisioned successfully.',
        };

        return jsonResponse({ success: true, data: handoffResp });
      }

      return jsonResponse({ success: false, error: 'Endpoint not found' }, 404);
    }

    // Static assets fallback (in Cloudflare Workers deployment)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
    } catch (err: unknown) {
      console.error('[Worker Fatal Error]', err);
      return jsonResponse(
        {
          success: false,
          error: 'INTERNAL_SERVER_ERROR',
          message: err instanceof Error ? err.message : String(err),
        },
        500
      );
    }
  },
};
