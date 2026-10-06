-- ============================================================================
-- AssetMT Database Schema & Security Architecture
-- Version: 0003_employees_and_departments.sql
-- Target: Phase 2A: Employees and Departments Directory
-- Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
-- ============================================================================

-- ============================================================================
-- 1. TABLES
-- ============================================================================

-- 1.1 Departments (Tenant-scoped organizational units)
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_department_tenant_id UNIQUE (company_id, id),
    CONSTRAINT uq_department_name_tenant UNIQUE (company_id, name)
);

-- 1.2 Employees (Tenant-scoped custodians who can hold assets; NOT login users)
-- Creating an employee does NOT create a Supabase Auth account, membership, or grant system access.
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    employee_code TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    job_title TEXT,
    department_id UUID,
    site_id UUID,
    location_id UUID,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_employee_tenant_id UNIQUE (company_id, id),
    -- Employee codes must be unique within each company (tenant)
    CONSTRAINT uq_employee_code_tenant UNIQUE (company_id, employee_code),
    -- Strict DB composite tenant constraints: prevent referencing another tenant's department, site, or location
    CONSTRAINT fk_employee_department_tenant FOREIGN KEY (company_id, department_id)
        REFERENCES public.departments(company_id, id) ON DELETE SET NULL,
    CONSTRAINT fk_employee_site_tenant FOREIGN KEY (company_id, site_id)
        REFERENCES public.sites(company_id, id) ON DELETE SET NULL,
    CONSTRAINT fk_employee_location_tenant FOREIGN KEY (company_id, location_id)
        REFERENCES public.locations(company_id, id) ON DELETE SET NULL
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_departments_company ON public.departments(company_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_employees_tenant_search ON public.employees(company_id, full_name, employee_code);
CREATE INDEX IF NOT EXISTS idx_employees_department ON public.employees(company_id, department_id);
CREATE INDEX IF NOT EXISTS idx_employees_site ON public.employees(company_id, site_id);
CREATE INDEX IF NOT EXISTS idx_employees_active ON public.employees(company_id, is_active);

-- ============================================================================
-- 3. TENANT IMMUTABILITY TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trg_prevent_tenant_change_departments ON public.departments;
CREATE TRIGGER trg_prevent_tenant_change_departments
BEFORE UPDATE ON public.departments
FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

DROP TRIGGER IF EXISTS trg_prevent_tenant_change_employees ON public.employees;
CREATE TRIGGER trg_prevent_tenant_change_employees
BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- 4.1 Departments RLS
CREATE POLICY "Tenants can select departments"
    ON public.departments FOR SELECT
    USING (public.is_tenant_member(company_id));

CREATE POLICY "Tenants can insert departments"
    ON public.departments FOR INSERT
    WITH CHECK (public.is_tenant_member(company_id));

CREATE POLICY "Tenants can update departments"
    ON public.departments FOR UPDATE
    USING (public.is_tenant_member(company_id))
    WITH CHECK (public.is_tenant_member(company_id));

CREATE POLICY "Tenant admins can delete departments"
    ON public.departments FOR DELETE
    USING (public.is_tenant_admin(company_id));

-- 4.2 Employees RLS
CREATE POLICY "Tenants can select employees"
    ON public.employees FOR SELECT
    USING (public.is_tenant_member(company_id));

CREATE POLICY "Tenants can insert employees"
    ON public.employees FOR INSERT
    WITH CHECK (public.is_tenant_member(company_id));

CREATE POLICY "Tenants can update employees"
    ON public.employees FOR UPDATE
    USING (public.is_tenant_member(company_id))
    WITH CHECK (public.is_tenant_member(company_id));

CREATE POLICY "Tenant admins can delete employees"
    ON public.employees FOR DELETE
    USING (public.is_tenant_admin(company_id));

-- ============================================================================
-- 5. PERMISSIONS & SCHEMA CACHE RELOAD
-- ============================================================================

GRANT ALL ON public.departments TO anon, authenticated, service_role;
GRANT ALL ON public.employees TO anon, authenticated, service_role;

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
