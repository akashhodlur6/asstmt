-- ============================================================================
-- AssetMT Database Schema & Security Architecture
-- Version: 0004_restrict_directory_mutations_to_tenant_admin.sql
-- Target: Restrict department and employee mutations to authorized Tenant Admins
-- Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
-- ============================================================================

-- Drop permissive policies that previously allowed plain tenant members to mutate records
DROP POLICY IF EXISTS "Tenants can insert departments" ON public.departments;
DROP POLICY IF EXISTS "Tenants can update departments" ON public.departments;

DROP POLICY IF EXISTS "Tenants can insert employees" ON public.employees;
DROP POLICY IF EXISTS "Tenants can update employees" ON public.employees;

-- ============================================================================
-- 1. Departments Policies: Restrict INSERT, UPDATE, DELETE to TENANT_ADMIN
-- ============================================================================

CREATE POLICY "Tenant admins can insert departments"
    ON public.departments FOR INSERT
    WITH CHECK (public.is_tenant_admin(company_id));

CREATE POLICY "Tenant admins can update departments"
    ON public.departments FOR UPDATE
    USING (public.is_tenant_admin(company_id))
    WITH CHECK (public.is_tenant_admin(company_id));

-- Note: "Tenant admins can delete departments" already exists from 0003

-- ============================================================================
-- 2. Employees Policies: Restrict INSERT, UPDATE, DELETE to TENANT_ADMIN
-- ============================================================================

CREATE POLICY "Tenant admins can insert employees"
    ON public.employees FOR INSERT
    WITH CHECK (public.is_tenant_admin(company_id));

CREATE POLICY "Tenant admins can update employees"
    ON public.employees FOR UPDATE
    USING (public.is_tenant_admin(company_id))
    WITH CHECK (public.is_tenant_admin(company_id));

-- Note: "Tenant admins can delete employees" already exists from 0003

-- ============================================================================
-- 3. PostgREST Schema Cache Reload
-- ============================================================================

NOTIFY pgrst, 'reload schema';
