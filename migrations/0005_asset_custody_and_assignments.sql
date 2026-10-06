-- ============================================================================
-- AssetMT Database Schema & Security Architecture
-- Version: 0005_asset_custody_and_assignments.sql
-- Target: Asset Custody (Check Out, Check In, Transfer, History & Invariants)
-- Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
-- ============================================================================

-- 1. Update status and event_type check constraints
ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS assets_status_check;
ALTER TABLE public.assets ADD CONSTRAINT assets_status_check 
    CHECK (status IN ('Available', 'Assigned', 'Under Repair', 'Retired', 'Disposed'));

ALTER TABLE public.asset_events DROP CONSTRAINT IF EXISTS asset_events_event_type_check;
ALTER TABLE public.asset_events ADD CONSTRAINT asset_events_event_type_check 
    CHECK (event_type IN ('CREATED', 'UPDATED', 'CHECKED_OUT', 'CHECKED_IN', 'TRANSFERRED'));

-- 2. Create public.asset_assignments table
CREATE TABLE IF NOT EXISTS public.asset_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    checked_out_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expected_return_at TIMESTAMPTZ,
    checked_in_at TIMESTAMPTZ,
    checkout_condition TEXT,
    checkin_condition TEXT,
    checkout_notes TEXT,
    checkin_notes TEXT,
    issued_by UUID REFERENCES auth.users(id),
    returned_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_assignment_asset_tenant FOREIGN KEY (company_id, asset_id)
        REFERENCES public.assets(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_assignment_employee_tenant FOREIGN KEY (company_id, employee_id)
        REFERENCES public.employees(company_id, id) ON DELETE RESTRICT
);

-- 3. Indexes & Uniqueness Invariants
-- Exactly one active custody assignment per asset within tenant
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_asset_assignment_tenant
    ON public.asset_assignments (company_id, asset_id)
    WHERE (checked_in_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_asset_assignments_asset 
    ON public.asset_assignments (company_id, asset_id, checked_out_at DESC);

CREATE INDEX IF NOT EXISTS idx_asset_assignments_employee 
    ON public.asset_assignments (company_id, employee_id, checked_out_at DESC);

CREATE INDEX IF NOT EXISTS idx_asset_assignments_active 
    ON public.asset_assignments (company_id, employee_id) 
    WHERE (checked_in_at IS NULL);

-- 4. Tenant Immutability Trigger
DROP TRIGGER IF EXISTS trg_prevent_tenant_change_assignments ON public.asset_assignments;
CREATE TRIGGER trg_prevent_tenant_change_assignments
    BEFORE UPDATE ON public.asset_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_id_change();

-- 5. Row Level Security Policies
ALTER TABLE public.asset_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view asset assignments" ON public.asset_assignments;
CREATE POLICY "Tenants can view asset assignments"
    ON public.asset_assignments FOR SELECT
    USING (public.is_tenant_member(company_id));

DROP POLICY IF EXISTS "Tenant admins can insert asset assignments" ON public.asset_assignments;
CREATE POLICY "Tenant admins can insert asset assignments"
    ON public.asset_assignments FOR INSERT
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can update asset assignments" ON public.asset_assignments;
CREATE POLICY "Tenant admins can update asset assignments"
    ON public.asset_assignments FOR UPDATE
    USING (public.is_tenant_admin(company_id))
    WITH CHECK (public.is_tenant_admin(company_id));

-- 6. Atomic Database RPC: checkout_asset
CREATE OR REPLACE FUNCTION public.checkout_asset(
    p_asset_id UUID,
    p_employee_id UUID,
    p_checked_out_at TIMESTAMPTZ DEFAULT NOW(),
    p_expected_return_at TIMESTAMPTZ DEFAULT NULL,
    p_condition TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_company_id UUID;
    v_asset_status TEXT;
    v_asset_name TEXT;
    v_asset_tag TEXT;
    v_emp_active BOOLEAN;
    v_emp_name TEXT;
    v_emp_code TEXT;
    v_new_assignment_id UUID;
    v_result JSONB;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: User session required';
    END IF;

    -- Lock and verify asset
    SELECT company_id, status, name, asset_tag
    INTO v_company_id, v_asset_status, v_asset_name, v_asset_tag
    FROM public.assets
    WHERE id = p_asset_id
    FOR UPDATE;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'ASSET_NOT_FOUND: Specified asset does not exist';
    END IF;

    -- Verify Tenant Admin permissions
    IF NOT public.is_tenant_admin(v_company_id) THEN
        RAISE EXCEPTION 'FORBIDDEN: Only Tenant Admins can check out assets';
    END IF;

    -- Verify Asset is Available
    IF v_asset_status <> 'Available' THEN
        RAISE EXCEPTION 'ASSET_NOT_AVAILABLE: Asset status is "%", only "Available" assets can be checked out', v_asset_status;
    END IF;

    -- Verify Employee belongs to same tenant and is active
    SELECT is_active, full_name, employee_code
    INTO v_emp_active, v_emp_name, v_emp_code
    FROM public.employees
    WHERE id = p_employee_id AND company_id = v_company_id;

    IF v_emp_active IS NULL THEN
        RAISE EXCEPTION 'EMPLOYEE_NOT_FOUND: Employee does not exist in this workspace';
    END IF;

    IF NOT v_emp_active THEN
        RAISE EXCEPTION 'EMPLOYEE_INACTIVE: Cannot check out assets to an inactive employee';
    END IF;

    -- Validate expected return date if provided
    IF p_expected_return_at IS NOT NULL AND p_expected_return_at < COALESCE(p_checked_out_at, NOW()) THEN
        RAISE EXCEPTION 'INVALID_RETURN_DATE: Expected return date cannot be before checkout date';
    END IF;

    -- Insert active assignment
    INSERT INTO public.asset_assignments (
        company_id,
        asset_id,
        employee_id,
        checked_out_at,
        expected_return_at,
        checkout_condition,
        checkout_notes,
        issued_by
    ) VALUES (
        v_company_id,
        p_asset_id,
        p_employee_id,
        COALESCE(p_checked_out_at, NOW()),
        p_expected_return_at,
        p_condition,
        p_notes,
        v_actor_id
    ) RETURNING id INTO v_new_assignment_id;

    -- Update asset status to Assigned
    UPDATE public.assets
    SET status = 'Assigned',
        updated_at = NOW()
    WHERE id = p_asset_id;

    -- Record Audit Event
    INSERT INTO public.asset_events (
        company_id,
        asset_id,
        event_type,
        actor_id,
        details
    ) VALUES (
        v_company_id,
        p_asset_id,
        'CHECKED_OUT',
        v_actor_id,
        jsonb_build_object(
            'assignment_id', v_new_assignment_id,
            'employee_id', p_employee_id,
            'employee_name', v_emp_name,
            'employee_code', v_emp_code,
            'checked_out_at', COALESCE(p_checked_out_at, NOW()),
            'expected_return_at', p_expected_return_at,
            'condition', p_condition,
            'notes', p_notes
        )
    );

    SELECT to_jsonb(a.*) INTO v_result
    FROM public.asset_assignments a
    WHERE a.id = v_new_assignment_id;

    RETURN v_result;
END;
$$;

-- 7. Atomic Database RPC: checkin_asset
CREATE OR REPLACE FUNCTION public.checkin_asset(
    p_asset_id UUID,
    p_checked_in_at TIMESTAMPTZ DEFAULT NOW(),
    p_condition TEXT DEFAULT NULL,
    p_site_id UUID DEFAULT NULL,
    p_location_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_company_id UUID;
    v_asset_status TEXT;
    v_assignment_id UUID;
    v_employee_id UUID;
    v_emp_name TEXT;
    v_emp_code TEXT;
    v_checked_out_at TIMESTAMPTZ;
    v_result JSONB;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: User session required';
    END IF;

    -- Lock and verify asset
    SELECT company_id, status
    INTO v_company_id, v_asset_status
    FROM public.assets
    WHERE id = p_asset_id
    FOR UPDATE;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'ASSET_NOT_FOUND: Specified asset does not exist';
    END IF;

    -- Verify Tenant Admin permissions
    IF NOT public.is_tenant_admin(v_company_id) THEN
        RAISE EXCEPTION 'FORBIDDEN: Only Tenant Admins can check in assets';
    END IF;

    -- Verify Asset is Assigned
    IF v_asset_status <> 'Assigned' THEN
        RAISE EXCEPTION 'ASSET_NOT_ASSIGNED: Asset status is "%", only "Assigned" assets can be checked in', v_asset_status;
    END IF;

    -- Lock active assignment
    SELECT a.id, a.employee_id, a.checked_out_at, e.full_name, e.employee_code
    INTO v_assignment_id, v_employee_id, v_checked_out_at, v_emp_name, v_emp_code
    FROM public.asset_assignments a
    JOIN public.employees e ON e.id = a.employee_id
    WHERE a.asset_id = p_asset_id 
      AND a.company_id = v_company_id 
      AND a.checked_in_at IS NULL
    FOR UPDATE OF a;

    IF v_assignment_id IS NULL THEN
        RAISE EXCEPTION 'NO_ACTIVE_ASSIGNMENT: No active custody assignment found for this asset';
    END IF;

    -- Verify destination site/location belong to tenant if provided
    IF p_site_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.sites WHERE id = p_site_id AND company_id = v_company_id) THEN
            RAISE EXCEPTION 'INVALID_SITE: Destination site does not belong to this company';
        END IF;
    END IF;

    IF p_location_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.locations WHERE id = p_location_id AND company_id = v_company_id) THEN
            RAISE EXCEPTION 'INVALID_LOCATION: Destination location does not belong to this company';
        END IF;
    END IF;

    -- Close the active assignment
    UPDATE public.asset_assignments
    SET checked_in_at = COALESCE(p_checked_in_at, NOW()),
        checkin_condition = p_condition,
        checkin_notes = p_notes,
        returned_by = v_actor_id,
        updated_at = NOW()
    WHERE id = v_assignment_id;

    -- Update asset status back to Available and optionally update site/location
    UPDATE public.assets
    SET status = 'Available',
        site_id = COALESCE(p_site_id, site_id),
        location_id = CASE 
            WHEN p_site_id IS NOT NULL AND p_location_id IS NULL THEN NULL 
            ELSE COALESCE(p_location_id, location_id) 
        END,
        updated_at = NOW()
    WHERE id = p_asset_id;

    -- Record Audit Event
    INSERT INTO public.asset_events (
        company_id,
        asset_id,
        event_type,
        actor_id,
        details
    ) VALUES (
        v_company_id,
        p_asset_id,
        'CHECKED_IN',
        v_actor_id,
        jsonb_build_object(
            'assignment_id', v_assignment_id,
            'employee_id', v_employee_id,
            'employee_name', v_emp_name,
            'employee_code', v_emp_code,
            'checked_out_at', v_checked_out_at,
            'checked_in_at', COALESCE(p_checked_in_at, NOW()),
            'returned_condition', p_condition,
            'destination_site_id', p_site_id,
            'destination_location_id', p_location_id,
            'notes', p_notes
        )
    );

    SELECT to_jsonb(a.*) INTO v_result
    FROM public.asset_assignments a
    WHERE a.id = v_assignment_id;

    RETURN v_result;
END;
$$;

-- 8. Atomic Database RPC: transfer_asset
CREATE OR REPLACE FUNCTION public.transfer_asset(
    p_asset_id UUID,
    p_new_employee_id UUID,
    p_transfer_at TIMESTAMPTZ DEFAULT NOW(),
    p_condition TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_company_id UUID;
    v_asset_status TEXT;
    v_old_assignment_id UUID;
    v_old_employee_id UUID;
    v_old_emp_name TEXT;
    v_old_emp_code TEXT;
    v_new_emp_active BOOLEAN;
    v_new_emp_name TEXT;
    v_new_emp_code TEXT;
    v_new_assignment_id UUID;
    v_result JSONB;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: User session required';
    END IF;

    -- Lock and verify asset
    SELECT company_id, status
    INTO v_company_id, v_asset_status
    FROM public.assets
    WHERE id = p_asset_id
    FOR UPDATE;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'ASSET_NOT_FOUND: Specified asset does not exist';
    END IF;

    -- Verify Tenant Admin permissions
    IF NOT public.is_tenant_admin(v_company_id) THEN
        RAISE EXCEPTION 'FORBIDDEN: Only Tenant Admins can transfer assets';
    END IF;

    -- Verify Asset is Assigned
    IF v_asset_status <> 'Assigned' THEN
        RAISE EXCEPTION 'ASSET_NOT_ASSIGNED: Asset status is "%", only "Assigned" assets can be transferred', v_asset_status;
    END IF;

    -- Lock current active assignment
    SELECT a.id, a.employee_id, e.full_name, e.employee_code
    INTO v_old_assignment_id, v_old_employee_id, v_old_emp_name, v_old_emp_code
    FROM public.asset_assignments a
    JOIN public.employees e ON e.id = a.employee_id
    WHERE a.asset_id = p_asset_id 
      AND a.company_id = v_company_id 
      AND a.checked_in_at IS NULL
    FOR UPDATE OF a;

    IF v_old_assignment_id IS NULL THEN
        RAISE EXCEPTION 'NO_ACTIVE_ASSIGNMENT: No active custody assignment found for this asset';
    END IF;

    -- Cannot transfer to the same employee
    IF v_old_employee_id = p_new_employee_id THEN
        RAISE EXCEPTION 'SAME_EMPLOYEE_TRANSFER: Cannot transfer asset to the current custodian';
    END IF;

    -- Verify new employee belongs to same tenant and is active
    SELECT is_active, full_name, employee_code
    INTO v_new_emp_active, v_new_emp_name, v_new_emp_code
    FROM public.employees
    WHERE id = p_new_employee_id AND company_id = v_company_id;

    IF v_new_emp_active IS NULL THEN
        RAISE EXCEPTION 'EMPLOYEE_NOT_FOUND: Target employee does not exist in this workspace';
    END IF;

    IF NOT v_new_emp_active THEN
        RAISE EXCEPTION 'EMPLOYEE_INACTIVE: Cannot transfer assets to an inactive employee';
    END IF;

    -- 1. Close current assignment
    UPDATE public.asset_assignments
    SET checked_in_at = COALESCE(p_transfer_at, NOW()),
        checkin_condition = p_condition,
        checkin_notes = 'Transferred custody to ' || v_new_emp_name || ' (' || v_new_emp_code || ')' || 
                        CASE WHEN p_notes IS NOT NULL AND length(trim(p_notes)) > 0 THEN ': ' || trim(p_notes) ELSE '' END,
        returned_by = v_actor_id,
        updated_at = NOW()
    WHERE id = v_old_assignment_id;

    -- 2. Create new active assignment
    INSERT INTO public.asset_assignments (
        company_id,
        asset_id,
        employee_id,
        checked_out_at,
        checkout_condition,
        checkout_notes,
        issued_by
    ) VALUES (
        v_company_id,
        p_asset_id,
        p_new_employee_id,
        COALESCE(p_transfer_at, NOW()),
        p_condition,
        'Transferred custody from ' || v_old_emp_name || ' (' || v_old_emp_code || ')' ||
        CASE WHEN p_notes IS NOT NULL AND length(trim(p_notes)) > 0 THEN ': ' || trim(p_notes) ELSE '' END,
        v_actor_id
    ) RETURNING id INTO v_new_assignment_id;

    -- Asset remains Assigned
    UPDATE public.assets
    SET status = 'Assigned',
        updated_at = NOW()
    WHERE id = p_asset_id;

    -- Record Audit Event
    INSERT INTO public.asset_events (
        company_id,
        asset_id,
        event_type,
        actor_id,
        details
    ) VALUES (
        v_company_id,
        p_asset_id,
        'TRANSFERRED',
        v_actor_id,
        jsonb_build_object(
            'previous_assignment_id', v_old_assignment_id,
            'previous_employee_id', v_old_employee_id,
            'previous_employee_name', v_old_emp_name,
            'previous_employee_code', v_old_emp_code,
            'new_assignment_id', v_new_assignment_id,
            'new_employee_id', p_new_employee_id,
            'new_employee_name', v_new_emp_name,
            'new_employee_code', v_new_emp_code,
            'transferred_at', COALESCE(p_transfer_at, NOW()),
            'condition', p_condition,
            'notes', p_notes
        )
    );

    SELECT to_jsonb(a.*) INTO v_result
    FROM public.asset_assignments a
    WHERE a.id = v_new_assignment_id;

    RETURN v_result;
END;
$$;

-- 9. PostgREST Grants and Schema Reload
GRANT ALL ON public.asset_assignments TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.checkout_asset TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.checkin_asset TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transfer_asset TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
