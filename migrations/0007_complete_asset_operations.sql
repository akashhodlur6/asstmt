-- ============================================================================
-- AssetMT Database Schema & Security Architecture
-- Version: 0007_complete_asset_operations.sql
-- Target: Phase 4 Complete Asset Operations
-- Modules: Inventory/Stock, Barcode/QR, Audits, Reservations, Leases,
--          Asset Moves, Asset Disposals, and Linked Assets.
-- Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
-- ============================================================================

-- ============================================================================
-- 1. INVENTORY / STOCK
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    category_id UUID,
    site_id UUID,
    location_id UUID,
    quantity_on_hand INTEGER NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
    minimum_stock_level INTEGER NOT NULL DEFAULT 0 CHECK (minimum_stock_level >= 0),
    unit_cost NUMERIC(14, 2) CHECK (unit_cost IS NULL OR unit_cost >= 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    vendor_id UUID,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inventory_sku_tenant UNIQUE (company_id, sku),
    CONSTRAINT uq_inventory_tenant UNIQUE (company_id, id),
    CONSTRAINT fk_inv_category_tenant FOREIGN KEY (company_id, category_id)
        REFERENCES public.categories(company_id, id) ON DELETE SET NULL,
    CONSTRAINT fk_inv_site_tenant FOREIGN KEY (company_id, site_id)
        REFERENCES public.sites(company_id, id) ON DELETE SET NULL,
    CONSTRAINT fk_inv_location_tenant FOREIGN KEY (company_id, location_id)
        REFERENCES public.locations(company_id, id) ON DELETE SET NULL,
    CONSTRAINT fk_inv_vendor_tenant FOREIGN KEY (company_id, vendor_id)
        REFERENCES public.vendors(company_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_inv_items_company_sku ON public.inventory_items (company_id, sku);
CREATE INDEX IF NOT EXISTS idx_inv_items_company_active ON public.inventory_items (company_id, is_active);

-- Tenant immutability trigger
DROP TRIGGER IF EXISTS trg_prevent_tenant_change_inv_items ON public.inventory_items;
CREATE TRIGGER trg_prevent_tenant_change_inv_items
    BEFORE UPDATE ON public.inventory_items
    FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

-- RLS
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view inventory items" ON public.inventory_items;
CREATE POLICY "Tenants can view inventory items"
    ON public.inventory_items FOR SELECT
    USING (public.is_tenant_member(company_id));

DROP POLICY IF EXISTS "Tenant admins can insert inventory items" ON public.inventory_items;
CREATE POLICY "Tenant admins can insert inventory items"
    ON public.inventory_items FOR INSERT
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can update inventory items" ON public.inventory_items;
CREATE POLICY "Tenant admins can update inventory items"
    ON public.inventory_items FOR UPDATE
    USING (public.is_tenant_admin(company_id))
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can delete inventory items" ON public.inventory_items;
CREATE POLICY "Tenant admins can delete inventory items"
    ON public.inventory_items FOR DELETE
    USING (public.is_tenant_admin(company_id));

-- Inventory Transactions (Immutable History)
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('STOCK_IN', 'STOCK_OUT', 'TRANSFER', 'ADJUSTMENT')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(14, 2) CHECK (unit_cost IS NULL OR unit_cost >= 0),
    from_location_id UUID,
    to_location_id UUID,
    reference_number TEXT,
    notes TEXT,
    performed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_inv_txn_item_tenant FOREIGN KEY (company_id, inventory_item_id)
        REFERENCES public.inventory_items(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_inv_txn_from_loc_tenant FOREIGN KEY (company_id, from_location_id)
        REFERENCES public.locations(company_id, id) ON DELETE SET NULL,
    CONSTRAINT fk_inv_txn_to_loc_tenant FOREIGN KEY (company_id, to_location_id)
        REFERENCES public.locations(company_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_inv_txns_item ON public.inventory_transactions (company_id, inventory_item_id, created_at DESC);

-- Tenant immutability trigger
DROP TRIGGER IF EXISTS trg_prevent_tenant_change_inv_txns ON public.inventory_transactions;
CREATE TRIGGER trg_prevent_tenant_change_inv_txns
    BEFORE UPDATE ON public.inventory_transactions
    FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

-- RLS (Select and Insert only, NO Delete to preserve permanent history)
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view inventory transactions" ON public.inventory_transactions;
CREATE POLICY "Tenants can view inventory transactions"
    ON public.inventory_transactions FOR SELECT
    USING (public.is_tenant_member(company_id));

DROP POLICY IF EXISTS "Tenant admins can insert inventory transactions" ON public.inventory_transactions;
CREATE POLICY "Tenant admins can insert inventory transactions"
    ON public.inventory_transactions FOR INSERT
    WITH CHECK (public.is_tenant_admin(company_id));

-- ============================================================================
-- 2. ASSET RESERVATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.asset_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    reserved_from TIMESTAMPTZ NOT NULL,
    reserved_until TIMESTAMPTZ NOT NULL,
    purpose TEXT,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Fulfilled', 'Cancelled', 'Expired')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_reservation_tenant UNIQUE (company_id, id),
    CONSTRAINT fk_reservation_asset_tenant FOREIGN KEY (company_id, asset_id)
        REFERENCES public.assets(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_reservation_employee_tenant FOREIGN KEY (company_id, employee_id)
        REFERENCES public.employees(company_id, id) ON DELETE CASCADE,
    CONSTRAINT chk_reservation_dates CHECK (reserved_until >= reserved_from)
);

-- Unique index preventing overlapping Active reservations for the same asset
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_asset_reservation
    ON public.asset_reservations (company_id, asset_id)
    WHERE (status = 'Active');

CREATE INDEX IF NOT EXISTS idx_asset_reservations_company_asset 
    ON public.asset_reservations (company_id, asset_id, status);

CREATE INDEX IF NOT EXISTS idx_asset_reservations_company_employee 
    ON public.asset_reservations (company_id, employee_id, status);

-- Tenant immutability trigger
DROP TRIGGER IF EXISTS trg_prevent_tenant_change_reservations ON public.asset_reservations;
CREATE TRIGGER trg_prevent_tenant_change_reservations
    BEFORE UPDATE ON public.asset_reservations
    FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

-- RLS
ALTER TABLE public.asset_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view asset reservations" ON public.asset_reservations;
CREATE POLICY "Tenants can view asset reservations"
    ON public.asset_reservations FOR SELECT
    USING (public.is_tenant_member(company_id));

DROP POLICY IF EXISTS "Tenant admins can insert asset reservations" ON public.asset_reservations;
CREATE POLICY "Tenant admins can insert asset reservations"
    ON public.asset_reservations FOR INSERT
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can update asset reservations" ON public.asset_reservations;
CREATE POLICY "Tenant admins can update asset reservations"
    ON public.asset_reservations FOR UPDATE
    USING (public.is_tenant_admin(company_id))
    WITH CHECK (public.is_tenant_admin(company_id));

-- ============================================================================
-- 3. LEASE / LEASE RETURN
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.asset_leases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL,
    vendor_id UUID NOT NULL,
    lease_reference TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    cost NUMERIC(14, 2) CHECK (cost IS NULL OR cost >= 0),
    cost_interval TEXT CHECK (cost_interval IS NULL OR cost_interval IN ('Monthly', 'Quarterly', 'Annual', 'Total')),
    currency TEXT NOT NULL DEFAULT 'USD',
    notes TEXT,
    return_date DATE,
    return_condition TEXT,
    return_notes TEXT,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Returned', 'Terminated', 'Expired')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_lease_tenant UNIQUE (company_id, id),
    CONSTRAINT fk_lease_asset_tenant FOREIGN KEY (company_id, asset_id)
        REFERENCES public.assets(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_lease_vendor_tenant FOREIGN KEY (company_id, vendor_id)
        REFERENCES public.vendors(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT chk_lease_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_asset_leases_company_asset ON public.asset_leases (company_id, asset_id, status);
CREATE INDEX IF NOT EXISTS idx_asset_leases_company_vendor ON public.asset_leases (company_id, vendor_id);

-- Tenant immutability trigger
DROP TRIGGER IF EXISTS trg_prevent_tenant_change_leases ON public.asset_leases;
CREATE TRIGGER trg_prevent_tenant_change_leases
    BEFORE UPDATE ON public.asset_leases
    FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

-- RLS
ALTER TABLE public.asset_leases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view asset leases" ON public.asset_leases;
CREATE POLICY "Tenants can view asset leases"
    ON public.asset_leases FOR SELECT
    USING (public.is_tenant_member(company_id));

DROP POLICY IF EXISTS "Tenant admins can insert asset leases" ON public.asset_leases;
CREATE POLICY "Tenant admins can insert asset leases"
    ON public.asset_leases FOR INSERT
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can update asset leases" ON public.asset_leases;
CREATE POLICY "Tenant admins can update asset leases"
    ON public.asset_leases FOR UPDATE
    USING (public.is_tenant_admin(company_id))
    WITH CHECK (public.is_tenant_admin(company_id));

-- ============================================================================
-- 4. ASSET MOVE / LOCATION HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.asset_location_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL,
    from_site_id UUID,
    from_location_id UUID,
    to_site_id UUID,
    to_location_id UUID,
    moved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    moved_by UUID REFERENCES auth.users(id),
    notes TEXT,
    CONSTRAINT fk_loc_hist_asset_tenant FOREIGN KEY (company_id, asset_id)
        REFERENCES public.assets(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_loc_hist_from_site_tenant FOREIGN KEY (company_id, from_site_id)
        REFERENCES public.sites(company_id, id) ON DELETE SET NULL,
    CONSTRAINT fk_loc_hist_from_loc_tenant FOREIGN KEY (company_id, from_location_id)
        REFERENCES public.locations(company_id, id) ON DELETE SET NULL,
    CONSTRAINT fk_loc_hist_to_site_tenant FOREIGN KEY (company_id, to_site_id)
        REFERENCES public.sites(company_id, id) ON DELETE SET NULL,
    CONSTRAINT fk_loc_hist_to_loc_tenant FOREIGN KEY (company_id, to_location_id)
        REFERENCES public.locations(company_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_asset_loc_hist_asset ON public.asset_location_history (company_id, asset_id, moved_at DESC);

-- Tenant immutability trigger
DROP TRIGGER IF EXISTS trg_prevent_tenant_change_loc_hist ON public.asset_location_history;
CREATE TRIGGER trg_prevent_tenant_change_loc_hist
    BEFORE UPDATE ON public.asset_location_history
    FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

-- RLS (Select and Insert only, NO Delete)
ALTER TABLE public.asset_location_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view asset location history" ON public.asset_location_history;
CREATE POLICY "Tenants can view asset location history"
    ON public.asset_location_history FOR SELECT
    USING (public.is_tenant_member(company_id));

DROP POLICY IF EXISTS "Tenant admins can insert asset location history" ON public.asset_location_history;
CREATE POLICY "Tenant admins can insert asset location history"
    ON public.asset_location_history FOR INSERT
    WITH CHECK (public.is_tenant_admin(company_id));

-- ============================================================================
-- 5. ASSET DISPOSAL
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.asset_disposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL,
    disposal_date DATE NOT NULL,
    disposal_method TEXT NOT NULL CHECK (disposal_method IN ('Sold', 'Recycled', 'Scrapped', 'Donated', 'Lost', 'Other')),
    reason TEXT NOT NULL,
    recovery_value NUMERIC(14, 2) CHECK (recovery_value IS NULL OR recovery_value >= 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    notes TEXT,
    disposed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_asset_disposal_tenant UNIQUE (company_id, asset_id),
    CONSTRAINT fk_disposal_asset_tenant FOREIGN KEY (company_id, asset_id)
        REFERENCES public.assets(company_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_asset_disposals_asset ON public.asset_disposals (company_id, asset_id);

-- Tenant immutability trigger
DROP TRIGGER IF EXISTS trg_prevent_tenant_change_disposals ON public.asset_disposals;
CREATE TRIGGER trg_prevent_tenant_change_disposals
    BEFORE UPDATE ON public.asset_disposals
    FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

-- RLS (Select and Insert only, NO Delete to preserve permanent disposal record)
ALTER TABLE public.asset_disposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view asset disposals" ON public.asset_disposals;
CREATE POLICY "Tenants can view asset disposals"
    ON public.asset_disposals FOR SELECT
    USING (public.is_tenant_member(company_id));

DROP POLICY IF EXISTS "Tenant admins can insert asset disposals" ON public.asset_disposals;
CREATE POLICY "Tenant admins can insert asset disposals"
    ON public.asset_disposals FOR INSERT
    WITH CHECK (public.is_tenant_admin(company_id));

-- ============================================================================
-- 6. LINKED / RELATED ASSETS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.asset_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    parent_asset_id UUID NOT NULL,
    child_asset_id UUID NOT NULL,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN ('Component Of', 'Accessory Of', 'Related To')),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_no_self_link CHECK (parent_asset_id <> child_asset_id),
    CONSTRAINT uq_asset_relationship_tenant UNIQUE (company_id, parent_asset_id, child_asset_id),
    CONSTRAINT fk_rel_parent_asset_tenant FOREIGN KEY (company_id, parent_asset_id)
        REFERENCES public.assets(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_rel_child_asset_tenant FOREIGN KEY (company_id, child_asset_id)
        REFERENCES public.assets(company_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_asset_rel_parent ON public.asset_relationships (company_id, parent_asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_rel_child ON public.asset_relationships (company_id, child_asset_id);

-- Tenant immutability trigger
DROP TRIGGER IF EXISTS trg_prevent_tenant_change_asset_rel ON public.asset_relationships;
CREATE TRIGGER trg_prevent_tenant_change_asset_rel
    BEFORE UPDATE ON public.asset_relationships
    FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

-- RLS
ALTER TABLE public.asset_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view asset relationships" ON public.asset_relationships;
CREATE POLICY "Tenants can view asset relationships"
    ON public.asset_relationships FOR SELECT
    USING (public.is_tenant_member(company_id));

DROP POLICY IF EXISTS "Tenant admins can insert asset relationships" ON public.asset_relationships;
CREATE POLICY "Tenant admins can insert asset relationships"
    ON public.asset_relationships FOR INSERT
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can delete asset relationships" ON public.asset_relationships;
CREATE POLICY "Tenant admins can delete asset relationships"
    ON public.asset_relationships FOR DELETE
    USING (public.is_tenant_admin(company_id));

-- ============================================================================
-- 7. PHYSICAL ASSET AUDITS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    site_id UUID,
    location_id UUID,
    status TEXT NOT NULL DEFAULT 'In Progress' CHECK (status IN ('In Progress', 'Completed', 'Cancelled')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    started_by UUID REFERENCES auth.users(id),
    completed_by UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_audit_session_tenant UNIQUE (company_id, id),
    CONSTRAINT fk_audit_site_tenant FOREIGN KEY (company_id, site_id)
        REFERENCES public.sites(company_id, id) ON DELETE SET NULL,
    CONSTRAINT fk_audit_location_tenant FOREIGN KEY (company_id, location_id)
        REFERENCES public.locations(company_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_sessions_company_status ON public.audit_sessions (company_id, status);

-- Tenant immutability trigger
DROP TRIGGER IF EXISTS trg_prevent_tenant_change_audit_sess ON public.audit_sessions;
CREATE TRIGGER trg_prevent_tenant_change_audit_sess
    BEFORE UPDATE ON public.audit_sessions
    FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

-- RLS (Select, Insert, Update; NO Delete for normal users to preserve permanent audit history)
ALTER TABLE public.audit_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view audit sessions" ON public.audit_sessions;
CREATE POLICY "Tenants can view audit sessions"
    ON public.audit_sessions FOR SELECT
    USING (public.is_tenant_member(company_id));

DROP POLICY IF EXISTS "Tenant admins can insert audit sessions" ON public.audit_sessions;
CREATE POLICY "Tenant admins can insert audit sessions"
    ON public.audit_sessions FOR INSERT
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can update audit sessions" ON public.audit_sessions;
CREATE POLICY "Tenant admins can update audit sessions"
    ON public.audit_sessions FOR UPDATE
    USING (public.is_tenant_admin(company_id))
    WITH CHECK (public.is_tenant_admin(company_id));

-- Audit Session Items
CREATE TABLE IF NOT EXISTS public.audit_session_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    asset_id UUID NOT NULL,
    expected_site_id UUID,
    expected_location_id UUID,
    scanned_site_id UUID,
    scanned_location_id UUID,
    status TEXT NOT NULL DEFAULT 'Found' CHECK (status IN ('Found', 'Missing', 'Wrong Location', 'Unexpected')),
    notes TEXT,
    scanned_by UUID REFERENCES auth.users(id),
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_audit_item_tenant UNIQUE (company_id, session_id, asset_id),
    CONSTRAINT fk_audit_item_session_tenant FOREIGN KEY (company_id, session_id)
        REFERENCES public.audit_sessions(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_audit_item_asset_tenant FOREIGN KEY (company_id, asset_id)
        REFERENCES public.assets(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_audit_item_exp_site FOREIGN KEY (company_id, expected_site_id)
        REFERENCES public.sites(company_id, id) ON DELETE SET NULL,
    CONSTRAINT fk_audit_item_exp_loc FOREIGN KEY (company_id, expected_location_id)
        REFERENCES public.locations(company_id, id) ON DELETE SET NULL,
    CONSTRAINT fk_audit_item_scn_site FOREIGN KEY (company_id, scanned_site_id)
        REFERENCES public.sites(company_id, id) ON DELETE SET NULL,
    CONSTRAINT fk_audit_item_scn_loc FOREIGN KEY (company_id, scanned_location_id)
        REFERENCES public.locations(company_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_items_session ON public.audit_session_items (company_id, session_id, status);

-- Tenant immutability trigger
DROP TRIGGER IF EXISTS trg_prevent_tenant_change_audit_items ON public.audit_session_items;
CREATE TRIGGER trg_prevent_tenant_change_audit_items
    BEFORE UPDATE ON public.audit_session_items
    FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

-- RLS (Select, Insert, Update; NO Delete)
ALTER TABLE public.audit_session_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view audit items" ON public.audit_session_items;
CREATE POLICY "Tenants can view audit items"
    ON public.audit_session_items FOR SELECT
    USING (public.is_tenant_member(company_id));

DROP POLICY IF EXISTS "Tenant admins can insert audit items" ON public.audit_session_items;
CREATE POLICY "Tenant admins can insert audit items"
    ON public.audit_session_items FOR INSERT
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can update audit items" ON public.audit_session_items;
CREATE POLICY "Tenant admins can update audit items"
    ON public.audit_session_items FOR UPDATE
    USING (public.is_tenant_admin(company_id))
    WITH CHECK (public.is_tenant_admin(company_id));

-- ============================================================================
-- 8. EXTEND ASSET_EVENTS EVENT_TYPE CHECK CONSTRAINT
-- ============================================================================

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
        'MAINTENANCE_CANCELLED',
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
        'AUDIT_COMPLETED'
    ));

-- ============================================================================
-- 9. POSTGREST GRANTS AND NOTIFY
-- ============================================================================

GRANT ALL ON public.inventory_items TO anon, authenticated, service_role;
GRANT ALL ON public.inventory_transactions TO anon, authenticated, service_role;
GRANT ALL ON public.asset_reservations TO anon, authenticated, service_role;
GRANT ALL ON public.asset_leases TO anon, authenticated, service_role;
GRANT ALL ON public.asset_location_history TO anon, authenticated, service_role;
GRANT ALL ON public.asset_disposals TO anon, authenticated, service_role;
GRANT ALL ON public.asset_relationships TO anon, authenticated, service_role;
GRANT ALL ON public.audit_sessions TO anon, authenticated, service_role;
GRANT ALL ON public.audit_session_items TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
