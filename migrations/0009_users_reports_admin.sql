-- ============================================================================
-- AssetMT Database Schema & Security Architecture
-- Version: 0009_users_reports_admin.sql
-- Target: Phase 6 Reports, Users, Permissions & Tenant Administration
-- Modules: Tenant Application Users, RBAC, User Invitations, Reports,
--          Tenant Settings & Branding, Platform Admin Foundation, Basic Quotas
-- Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
-- ============================================================================

-- ============================================================================
-- 1. EXTEND MEMBERSHIPS (ROLE EXPANSION & METADATA)
-- ============================================================================

-- Expand role to include TECHNICIAN
ALTER TABLE public.memberships DROP CONSTRAINT IF EXISTS memberships_role_check;
ALTER TABLE public.memberships ADD CONSTRAINT memberships_role_check 
    CHECK (role IN ('TENANT_ADMIN', 'TECHNICIAN', 'MEMBER'));

-- Add active status and optional custodian employee link
ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;
ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_memberships_tenant_active ON public.memberships (company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_memberships_tenant_employee ON public.memberships (company_id, employee_id);


-- ============================================================================
-- 2. EXTEND COMPANIES (TENANT STATUS, PLAN & QUOTA LIMITS)
-- ============================================================================

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE' 
    CHECK (status IN ('ACTIVE', 'SUSPENDED', 'TRIAL'));
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'BASIC'
    CHECK (plan IN ('BASIC', 'PRO', 'ENTERPRISE'));
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS max_assets INTEGER NOT NULL DEFAULT 500 CHECK (max_assets > 0);

CREATE INDEX IF NOT EXISTS idx_companies_status ON public.companies (status);


-- ============================================================================
-- 3. TENANT USER INVITATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('TENANT_ADMIN', 'TECHNICIAN', 'MEMBER')),
    token TEXT NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED')),
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_invitation_tenant UNIQUE (company_id, id)
);

-- Prevent duplicate active (pending) invitations to the same email within the same tenant
CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_pending_invite 
    ON public.tenant_invitations (company_id, LOWER(email)) 
    WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_invitations_tenant ON public.tenant_invitations (company_id, status);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.tenant_invitations (token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.tenant_invitations (LOWER(email));

-- Tenant immutability trigger
DROP TRIGGER IF EXISTS trg_prevent_tenant_change_invitations ON public.tenant_invitations;
CREATE TRIGGER trg_prevent_tenant_change_invitations
    BEFORE UPDATE ON public.tenant_invitations
    FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

-- RLS
ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view invitations" ON public.tenant_invitations;
CREATE POLICY "Tenants can view invitations"
    ON public.tenant_invitations FOR SELECT
    USING (public.is_tenant_member(company_id));

DROP POLICY IF EXISTS "Tenant admins can create invitations" ON public.tenant_invitations;
CREATE POLICY "Tenant admins can create invitations"
    ON public.tenant_invitations FOR INSERT
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can update invitations" ON public.tenant_invitations;
CREATE POLICY "Tenant admins can update invitations"
    ON public.tenant_invitations FOR UPDATE
    USING (public.is_tenant_admin(company_id))
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can delete invitations" ON public.tenant_invitations;
CREATE POLICY "Tenant admins can delete invitations"
    ON public.tenant_invitations FOR DELETE
    USING (public.is_tenant_admin(company_id));


-- ============================================================================
-- 4. TENANT SETTINGS & BRANDING
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    company_name TEXT,
    company_code TEXT,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    default_currency TEXT NOT NULL DEFAULT 'USD',
    date_format TEXT NOT NULL DEFAULT 'YYYY-MM-DD',
    logo_url TEXT,
    logo_storage_path TEXT,
    accent_color TEXT NOT NULL DEFAULT '#FF6A1A',
    display_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    asset_tag_prefix TEXT NOT NULL DEFAULT 'AST',
    asset_tag_next_number INTEGER NOT NULL DEFAULT 1001,
    default_category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    default_site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
    expiry_reminder_days JSONB NOT NULL DEFAULT '[7, 30, 90]'::jsonb,
    maintenance_reminder_days JSONB NOT NULL DEFAULT '[3, 7]'::jsonb,
    low_stock_threshold_alert BOOLEAN NOT NULL DEFAULT true,
    enforce_mfa BOOLEAN NOT NULL DEFAULT false,
    session_timeout_minutes INTEGER NOT NULL DEFAULT 480,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_settings_company UNIQUE (company_id),
    CONSTRAINT uq_tenant_settings_tenant UNIQUE (company_id, id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_settings_company ON public.tenant_settings (company_id);

-- Tenant immutability trigger
DROP TRIGGER IF EXISTS trg_prevent_tenant_change_settings ON public.tenant_settings;
CREATE TRIGGER trg_prevent_tenant_change_settings
    BEFORE UPDATE ON public.tenant_settings
    FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

-- RLS
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view settings" ON public.tenant_settings;
CREATE POLICY "Tenants can view settings"
    ON public.tenant_settings FOR SELECT
    USING (public.is_tenant_member(company_id));

DROP POLICY IF EXISTS "Tenant admins can insert settings" ON public.tenant_settings;
CREATE POLICY "Tenant admins can insert settings"
    ON public.tenant_settings FOR INSERT
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can update settings" ON public.tenant_settings;
CREATE POLICY "Tenant admins can update settings"
    ON public.tenant_settings FOR UPDATE
    USING (public.is_tenant_admin(company_id))
    WITH CHECK (public.is_tenant_admin(company_id));


-- ============================================================================
-- 5. PLATFORM ADMIN FOUNDATION (SEPARATE SAAS OWNER LAYER)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_admins_user ON public.platform_admins (user_id);

-- Strict RLS: regular authenticated tenant users cannot view platform admins
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- No public policies; only service_role and explicit security functions access platform_admins


-- ============================================================================
-- 6. VIEW ALIAS FOR ASSET CUSTOM FIELD DEFINITIONS
-- ============================================================================

CREATE OR REPLACE VIEW public.asset_custom_field_definitions AS 
SELECT 
    id,
    company_id,
    field_name,
    field_type,
    is_required,
    is_active,
    dropdown_choices,
    display_order,
    created_at,
    updated_at
FROM public.custom_field_definitions;


-- ============================================================================
-- 7. EXTEND ASSET_EVENTS EVENT_TYPE CHECK CONSTRAINT (PHASE 6 AUDIT EVENTS)
-- ============================================================================

ALTER TABLE public.asset_events DROP CONSTRAINT IF EXISTS asset_events_event_type_check;
ALTER TABLE public.asset_events ADD CONSTRAINT asset_events_event_type_check 
    CHECK (event_type IN (
        -- Phase 1 & 2
        'CREATED', 
        'UPDATED', 
        'CHECKED_OUT', 
        'CHECKED_IN', 
        'TRANSFERRED',
        -- Phase 3
        'MAINTENANCE_CREATED',
        'MAINTENANCE_SCHEDULED',
        'MAINTENANCE_STARTED',
        'MAINTENANCE_COMPLETED',
        'MAINTENANCE_CANCELLED',
        -- Phase 4
        'INVENTORY_STOCK_IN',
        'INVENTORY_STOCK_OUT',
        'INVENTORY_TRANSFER',
        'ASSET_RESERVED',
        'RESERVATION_CANCELLED',
        'LEASE_STARTED',
        'LEASE_RETURNED',
        'ASSET_MOVED',
        'ASSET_DISPOSED',
        'ASSET_LINKED',
        'AUDIT_STARTED',
        'AUDIT_COMPLETED',
        -- Phase 5
        'DEPRECIATION_CONFIGURED',
        'WARRANTY_ADDED',
        'WARRANTY_UPDATED',
        'CONTRACT_CREATED',
        'CONTRACT_UPDATED',
        'LICENSE_CREATED',
        'LICENSE_ALLOCATED',
        'LICENSE_RELEASED',
        'INSURANCE_ADDED',
        'DOCUMENT_ADDED',
        'CUSTOM_FIELD_CREATED',
        -- Phase 6
        'USER_INVITED',
        'USER_JOINED',
        'USER_ROLE_CHANGED',
        'USER_DEACTIVATED',
        'USER_REACTIVATED',
        'SETTINGS_UPDATED',
        'ASSET_IMPORTED',
        'EMPLOYEE_IMPORTED',
        'INVENTORY_IMPORTED',
        'REPORT_EXPORTED'
    ));


-- ============================================================================
-- 8. POSTGREST GRANTS AND NOTIFY
-- ============================================================================

GRANT ALL ON public.tenant_invitations TO anon, authenticated, service_role;
GRANT ALL ON public.tenant_settings TO anon, authenticated, service_role;
GRANT ALL ON public.platform_admins TO anon, authenticated, service_role;
GRANT ALL ON public.asset_custom_field_definitions TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
