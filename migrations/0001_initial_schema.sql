-- ============================================================================
-- AssetMT Database Schema & Security Architecture
-- Version: 0001_initial_schema.sql
-- Target: Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
-- ============================================================================

-- Ensure uuid-ossp or pgcrypto extension is active
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TABLES
-- ============================================================================

-- 1.1 Customer Companies (Tenants)
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.2 Memberships (Tenant Access Control)
CREATE TABLE IF NOT EXISTS public.memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('TENANT_ADMIN', 'MEMBER')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_company_user UNIQUE (company_id, user_id),
    -- Phase 1 restriction: initially support one workspace per user
    CONSTRAINT uq_user_workspace UNIQUE (user_id)
);

-- 1.3 Categories
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_category_tenant_id UNIQUE (company_id, id),
    CONSTRAINT uq_category_name_tenant UNIQUE (company_id, name)
);

-- 1.4 Sites
CREATE TABLE IF NOT EXISTS public.sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_site_tenant_id UNIQUE (company_id, id),
    CONSTRAINT uq_site_name_tenant UNIQUE (company_id, name)
);

-- 1.5 Locations (Nested under Site with composite tenant constraint)
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    site_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_location_tenant_id UNIQUE (company_id, id),
    CONSTRAINT uq_location_site_name UNIQUE (company_id, site_id, name),
    -- Strict DB constraint: prevent references to another tenant's site
    CONSTRAINT fk_location_site_tenant FOREIGN KEY (company_id, site_id)
        REFERENCES public.sites(company_id, id) ON DELETE CASCADE
);

-- 1.6 Assets
CREATE TABLE IF NOT EXISTS public.assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    asset_tag TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category_id UUID,
    site_id UUID,
    location_id UUID,
    serial_number TEXT,
    manufacturer TEXT,
    model TEXT,
    status TEXT NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'Under Repair', 'Retired', 'Disposed')),
    purchase_date DATE,
    purchase_cost NUMERIC(14, 2),
    currency TEXT NOT NULL DEFAULT 'USD',
    warranty_expiry DATE,
    notes TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_asset_tenant_id UNIQUE (company_id, id),
    -- Enforce unique asset tags within each tenant
    CONSTRAINT uq_asset_tag_tenant UNIQUE (company_id, asset_tag),
    -- Strict DB constraints: prevent references to another tenant's category/site/location
    CONSTRAINT fk_asset_category_tenant FOREIGN KEY (company_id, category_id)
        REFERENCES public.categories(company_id, id) ON DELETE SET NULL,
    CONSTRAINT fk_asset_site_tenant FOREIGN KEY (company_id, site_id)
        REFERENCES public.sites(company_id, id) ON DELETE SET NULL,
    CONSTRAINT fk_asset_location_tenant FOREIGN KEY (company_id, location_id)
        REFERENCES public.locations(company_id, id) ON DELETE SET NULL
);

-- 1.7 Asset Events (Audit Log)
CREATE TABLE IF NOT EXISTS public.asset_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('CREATED', 'UPDATED')),
    actor_id UUID NOT NULL REFERENCES auth.users(id),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_event_asset_tenant FOREIGN KEY (company_id, asset_id)
        REFERENCES public.assets(company_id, id) ON DELETE CASCADE
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_memberships_user ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_company ON public.memberships(company_id);
CREATE INDEX IF NOT EXISTS idx_assets_tenant_search ON public.assets(company_id, name, asset_tag);
CREATE INDEX IF NOT EXISTS idx_assets_category ON public.assets(company_id, category_id);
CREATE INDEX IF NOT EXISTS idx_assets_site ON public.assets(company_id, site_id);
CREATE INDEX IF NOT EXISTS idx_assets_location ON public.assets(company_id, location_id);
CREATE INDEX IF NOT EXISTS idx_events_asset ON public.asset_events(company_id, asset_id, created_at DESC);

-- ============================================================================
-- 3. FUNCTIONS & SECURITY DEFINER HELPERS
-- ============================================================================

-- Check if current authenticated user belongs to the tenant
CREATE OR REPLACE FUNCTION public.is_tenant_member(lookup_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.memberships
        WHERE company_id = lookup_company_id
          AND user_id = auth.uid()
    );
$$;

-- Check if current authenticated user is an admin for the tenant
CREATE OR REPLACE FUNCTION public.is_tenant_admin(lookup_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.memberships
        WHERE company_id = lookup_company_id
          AND user_id = auth.uid()
          AND role = 'TENANT_ADMIN'
    );
$$;

-- Trigger function: prevent ordinary clients from changing a record's tenant_id
CREATE OR REPLACE FUNCTION public.prevent_tenant_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.company_id <> OLD.company_id THEN
        RAISE EXCEPTION 'Changing company_id (tenant_id) is strictly forbidden';
    END IF;
    RETURN NEW;
END;
$$;

-- Apply tenant immutability triggers
DROP TRIGGER IF EXISTS trg_prevent_tenant_change_categories ON public.categories;
CREATE TRIGGER trg_prevent_tenant_change_categories
BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

DROP TRIGGER IF EXISTS trg_prevent_tenant_change_sites ON public.sites;
CREATE TRIGGER trg_prevent_tenant_change_sites
BEFORE UPDATE ON public.sites
FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

DROP TRIGGER IF EXISTS trg_prevent_tenant_change_locations ON public.locations;
CREATE TRIGGER trg_prevent_tenant_change_locations
BEFORE UPDATE ON public.locations
FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

DROP TRIGGER IF EXISTS trg_prevent_tenant_change_assets ON public.assets;
CREATE TRIGGER trg_prevent_tenant_change_assets
BEFORE UPDATE ON public.assets
FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

-- ============================================================================
-- 4. TRANSACTIONAL AUDIT LOG TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_asset_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_actor UUID;
    diff_json JSONB := '{}'::jsonb;
BEGIN
    current_actor := COALESCE(auth.uid(), NEW.created_by);
    
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.asset_events (
            company_id,
            asset_id,
            event_type,
            actor_id,
            details,
            created_at
        ) VALUES (
            NEW.company_id,
            NEW.id,
            'CREATED',
            current_actor,
            jsonb_build_object(
                'asset_tag', NEW.asset_tag,
                'name', NEW.name,
                'status', NEW.status,
                'purchase_cost', NEW.purchase_cost,
                'currency', NEW.currency
            ),
            NOW()
        );
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Compute diff
        IF NEW.name <> OLD.name THEN
            diff_json := diff_json || jsonb_build_object('name', jsonb_build_object('old', OLD.name, 'new', NEW.name));
        END IF;
        IF NEW.status <> OLD.status THEN
            diff_json := diff_json || jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status));
        END IF;
        IF NEW.category_id IS DISTINCT FROM OLD.category_id THEN
            diff_json := diff_json || jsonb_build_object('category_id', jsonb_build_object('old', OLD.category_id, 'new', NEW.category_id));
        END IF;
        IF NEW.site_id IS DISTINCT FROM OLD.site_id THEN
            diff_json := diff_json || jsonb_build_object('site_id', jsonb_build_object('old', OLD.site_id, 'new', NEW.site_id));
        END IF;
        IF NEW.location_id IS DISTINCT FROM OLD.location_id THEN
            diff_json := diff_json || jsonb_build_object('location_id', jsonb_build_object('old', OLD.location_id, 'new', NEW.location_id));
        END IF;
        IF NEW.purchase_cost IS DISTINCT FROM OLD.purchase_cost THEN
            diff_json := diff_json || jsonb_build_object('purchase_cost', jsonb_build_object('old', OLD.purchase_cost, 'new', NEW.purchase_cost));
        END IF;
        IF NEW.notes IS DISTINCT FROM OLD.notes THEN
            diff_json := diff_json || jsonb_build_object('notes', jsonb_build_object('old', OLD.notes, 'new', NEW.notes));
        END IF;
        
        NEW.updated_at := NOW();

        INSERT INTO public.asset_events (
            company_id,
            asset_id,
            event_type,
            actor_id,
            details,
            created_at
        ) VALUES (
            NEW.company_id,
            NEW.id,
            'UPDATED',
            current_actor,
            diff_json,
            NOW()
        );
        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_asset_audit ON public.assets;
CREATE TRIGGER trg_asset_audit
AFTER INSERT OR UPDATE ON public.assets
FOR EACH ROW EXECUTE FUNCTION public.record_asset_audit_event();

-- ============================================================================
-- 5. ATOMIC ONBOARDING PROCEDURE (SECURITY DEFINER)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_company_workspace(
    p_name TEXT,
    p_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_company_id UUID;
    v_membership_id UUID;
    v_site_id UUID;
    v_location_id UUID;
    v_existing_comp_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to create a company workspace';
    END IF;

    -- Concurrency & retry safety: check if user already has an active workspace
    SELECT company_id INTO v_existing_comp_id
    FROM public.memberships
    WHERE user_id = v_user_id;

    IF v_existing_comp_id IS NOT NULL THEN
        -- User already has a workspace, return existing details safely
        RETURN jsonb_build_object(
            'company_id', v_existing_comp_id,
            'status', 'EXISTING'
        );
    END IF;

    -- 1. Create company
    INSERT INTO public.companies (name, code, created_by)
    VALUES (TRIM(p_name), NULLIF(TRIM(p_code), ''), v_user_id)
    RETURNING id INTO v_company_id;

    -- 2. Create initial membership as TENANT_ADMIN
    INSERT INTO public.memberships (company_id, user_id, role)
    VALUES (v_company_id, v_user_id, 'TENANT_ADMIN')
    RETURNING id INTO v_membership_id;

    -- 3. Seed starter categories
    INSERT INTO public.categories (company_id, name, description)
    VALUES
        (v_company_id, 'Computer / IT Equipment', 'Laptops, desktops, servers, and monitors'),
        (v_company_id, 'Office Furniture', 'Desks, chairs, conference tables, and cabinets'),
        (v_company_id, 'Electronics & Audio/Visual', 'Projectors, cameras, and audio systems'),
        (v_company_id, 'Vehicles & Fleet', 'Company cars, vans, and transport assets');

    -- 4. Seed default headquarters site & main office location
    INSERT INTO public.sites (company_id, name, address)
    VALUES (v_company_id, 'Headquarters', 'Primary facility')
    RETURNING id INTO v_site_id;

    INSERT INTO public.locations (company_id, site_id, name, description)
    VALUES (v_company_id, v_site_id, 'Main Office', 'Primary floor operations')
    RETURNING id INTO v_location_id;

    RETURN jsonb_build_object(
        'company_id', v_company_id,
        'membership_id', v_membership_id,
        'role', 'TENANT_ADMIN',
        'status', 'CREATED'
    );
END;
$$;

-- Grant execution only to authenticated users
REVOKE ALL ON FUNCTION public.create_company_workspace(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_company_workspace(TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_events ENABLE ROW LEVEL SECURITY;

-- 6.1 Companies RLS
CREATE POLICY "Tenants can view own company"
    ON public.companies FOR SELECT
    USING (public.is_tenant_member(id));

CREATE POLICY "Tenant admin can update own company"
    ON public.companies FOR UPDATE
    USING (public.is_tenant_admin(id))
    WITH CHECK (public.is_tenant_admin(id));

-- 6.2 Memberships RLS
CREATE POLICY "Users can view memberships in their companies"
    ON public.memberships FOR SELECT
    USING (user_id = auth.uid() OR public.is_tenant_member(company_id));

-- Direct client insertion/updates/deletions on memberships are blocked to prevent self-elevation.
-- Memberships are managed via atomic security definer functions.

-- 6.3 Categories RLS
CREATE POLICY "Tenants can select categories"
    ON public.categories FOR SELECT
    USING (public.is_tenant_member(company_id));

CREATE POLICY "Tenants can insert categories"
    ON public.categories FOR INSERT
    WITH CHECK (public.is_tenant_member(company_id));

CREATE POLICY "Tenants can update categories"
    ON public.categories FOR UPDATE
    USING (public.is_tenant_member(company_id))
    WITH CHECK (public.is_tenant_member(company_id));

CREATE POLICY "Tenant admins can delete categories"
    ON public.categories FOR DELETE
    USING (public.is_tenant_admin(company_id));

-- 6.4 Sites RLS
CREATE POLICY "Tenants can select sites"
    ON public.sites FOR SELECT
    USING (public.is_tenant_member(company_id));

CREATE POLICY "Tenants can insert sites"
    ON public.sites FOR INSERT
    WITH CHECK (public.is_tenant_member(company_id));

CREATE POLICY "Tenants can update sites"
    ON public.sites FOR UPDATE
    USING (public.is_tenant_member(company_id))
    WITH CHECK (public.is_tenant_member(company_id));

CREATE POLICY "Tenant admins can delete sites"
    ON public.sites FOR DELETE
    USING (public.is_tenant_admin(company_id));

-- 6.5 Locations RLS
CREATE POLICY "Tenants can select locations"
    ON public.locations FOR SELECT
    USING (public.is_tenant_member(company_id));

CREATE POLICY "Tenants can insert locations"
    ON public.locations FOR INSERT
    WITH CHECK (public.is_tenant_member(company_id));

CREATE POLICY "Tenants can update locations"
    ON public.locations FOR UPDATE
    USING (public.is_tenant_member(company_id))
    WITH CHECK (public.is_tenant_member(company_id));

CREATE POLICY "Tenant admins can delete locations"
    ON public.locations FOR DELETE
    USING (public.is_tenant_admin(company_id));

-- 6.6 Assets RLS
CREATE POLICY "Tenants can select assets"
    ON public.assets FOR SELECT
    USING (public.is_tenant_member(company_id));

CREATE POLICY "Tenants can insert assets"
    ON public.assets FOR INSERT
    WITH CHECK (public.is_tenant_member(company_id));

CREATE POLICY "Tenants can update assets"
    ON public.assets FOR UPDATE
    USING (public.is_tenant_member(company_id))
    WITH CHECK (public.is_tenant_member(company_id));

CREATE POLICY "Tenant admins can delete assets"
    ON public.assets FOR DELETE
    USING (public.is_tenant_admin(company_id));

-- 6.7 Asset Events RLS (Audit Log)
CREATE POLICY "Tenants can select asset events"
    ON public.asset_events FOR SELECT
    USING (public.is_tenant_member(company_id));

-- Normal users CANNOT insert, update, or delete asset_events directly.
-- Insertion happens exclusively via the database trigger record_asset_audit_event().

-- ============================================================================
-- 7. PERMISSIONS & SCHEMA CACHE RELOAD
-- ============================================================================

-- Ensure PostgREST roles (anon, authenticated) have usage on schema and tables
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated;

-- Force PostgREST to reload schema cache immediately
NOTIFY pgrst, 'reload schema';

