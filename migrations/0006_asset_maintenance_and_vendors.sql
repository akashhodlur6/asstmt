-- ============================================================================
-- AssetMT Database Schema & Security Architecture
-- Version: 0006_asset_maintenance_and_vendors.sql
-- Target: Asset Maintenance Management, Work Orders & Vendors
-- Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
-- ============================================================================

-- 1. Create public.vendors table
CREATE TABLE IF NOT EXISTS public.vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    website TEXT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_vendor_tenant UNIQUE (company_id, id),
    CONSTRAINT uq_vendor_name_tenant UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_vendors_company_name 
    ON public.vendors (company_id, name);

CREATE INDEX IF NOT EXISTS idx_vendors_company_active 
    ON public.vendors (company_id, is_active);

-- 2. Tenant Immutability Trigger on Vendors
DROP TRIGGER IF EXISTS trg_prevent_tenant_change_vendors ON public.vendors;
CREATE TRIGGER trg_prevent_tenant_change_vendors
    BEFORE UPDATE ON public.vendors
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_id_change();

-- 3. Row Level Security on Vendors
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view company vendors" ON public.vendors;
CREATE POLICY "Tenants can view company vendors"
    ON public.vendors FOR SELECT
    USING (public.is_tenant_member(company_id));

DROP POLICY IF EXISTS "Tenant admins can insert company vendors" ON public.vendors;
CREATE POLICY "Tenant admins can insert company vendors"
    ON public.vendors FOR INSERT
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can update company vendors" ON public.vendors;
CREATE POLICY "Tenant admins can update company vendors"
    ON public.vendors FOR UPDATE
    USING (public.is_tenant_admin(company_id))
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can delete company vendors" ON public.vendors;
CREATE POLICY "Tenant admins can delete company vendors"
    ON public.vendors FOR DELETE
    USING (public.is_tenant_admin(company_id));

-- 4. Create public.maintenance_records table
CREATE TABLE IF NOT EXISTS public.maintenance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL,
    work_order_number TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    maintenance_type TEXT NOT NULL CHECK (maintenance_type IN ('Preventative', 'Corrective', 'Inspection', 'Upgrade', 'Calibration', 'Other')),
    priority TEXT NOT NULL CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
    status TEXT NOT NULL CHECK (status IN ('Open', 'Scheduled', 'In Progress', 'Completed', 'Cancelled')),
    scheduled_date DATE,
    due_date DATE,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    assigned_user_id UUID REFERENCES auth.users(id),
    vendor_id UUID,
    service_cost NUMERIC,
    currency TEXT NOT NULL DEFAULT 'USD',
    downtime_minutes INTEGER,
    resolution_notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_work_order_number_tenant UNIQUE (company_id, work_order_number),
    CONSTRAINT fk_maintenance_asset_tenant FOREIGN KEY (company_id, asset_id)
        REFERENCES public.assets(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_maintenance_vendor_tenant FOREIGN KEY (company_id, vendor_id)
        REFERENCES public.vendors(company_id, id) ON DELETE SET NULL
);

-- 5. Indexes on maintenance_records
CREATE INDEX IF NOT EXISTS idx_maintenance_company_status 
    ON public.maintenance_records (company_id, status);

CREATE INDEX IF NOT EXISTS idx_maintenance_company_asset 
    ON public.maintenance_records (company_id, asset_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_maintenance_company_vendor 
    ON public.maintenance_records (company_id, vendor_id);

CREATE INDEX IF NOT EXISTS idx_maintenance_company_due 
    ON public.maintenance_records (company_id, due_date) 
    WHERE (status NOT IN ('Completed', 'Cancelled'));

-- 6. Tenant Immutability Trigger on maintenance_records
DROP TRIGGER IF EXISTS trg_prevent_tenant_change_maintenance ON public.maintenance_records;
CREATE TRIGGER trg_prevent_tenant_change_maintenance
    BEFORE UPDATE ON public.maintenance_records
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_id_change();

-- 7. Row Level Security on maintenance_records
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view maintenance records" ON public.maintenance_records;
CREATE POLICY "Tenants can view maintenance records"
    ON public.maintenance_records FOR SELECT
    USING (public.is_tenant_member(company_id));

DROP POLICY IF EXISTS "Tenant admins can insert maintenance records" ON public.maintenance_records;
CREATE POLICY "Tenant admins can insert maintenance records"
    ON public.maintenance_records FOR INSERT
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can update maintenance records" ON public.maintenance_records;
CREATE POLICY "Tenant admins can update maintenance records"
    ON public.maintenance_records FOR UPDATE
    USING (public.is_tenant_admin(company_id))
    WITH CHECK (public.is_tenant_admin(company_id));

-- Note: DELETE is deliberately not granted to normal users to preserve permanent audit history.

-- 8. Extend asset_events constraint for maintenance event logging
ALTER TABLE public.asset_events DROP CONSTRAINT IF EXISTS asset_events_event_type_check;
ALTER TABLE public.asset_events ADD CONSTRAINT asset_events_event_type_check 
    CHECK (event_type IN (
        'CREATED', 
        'UPDATED', 
        'CHECKED_OUT', 
        'CHECKED_IN', 
        'TRANSFERRED',
        'MAINTENANCE_CREATED',
        'MAINTENANCE_SCHEDULED',
        'MAINTENANCE_STARTED',
        'MAINTENANCE_COMPLETED',
        'MAINTENANCE_CANCELLED'
    ));

-- 9. PostgREST Grants and Schema Reload
GRANT ALL ON public.vendors TO anon, authenticated, service_role;
GRANT ALL ON public.maintenance_records TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
