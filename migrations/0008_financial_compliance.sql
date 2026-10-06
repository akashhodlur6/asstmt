-- ============================================================================
-- AssetMT Database Schema & Security Architecture
-- Version: 0008_financial_compliance.sql
-- Target: Phase 5 Financial, Compliance & Asset Records
-- Modules: Depreciation, Warranties, Contracts, Software Licenses,
--          Insurance, Purchase/Funding, Documents, Custom Fields, Alerts
-- Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
-- ============================================================================

-- ============================================================================
-- 1. ASSET DEPRECIATION CONFIGURATION & SCHEDULE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.asset_depreciation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL,
    method TEXT NOT NULL DEFAULT 'NO_DEPRECIATION' CHECK (method IN ('STRAIGHT_LINE', 'DECLINING_BALANCE', 'NO_DEPRECIATION')),
    salvage_value NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (salvage_value >= 0),
    useful_life_months INTEGER NOT NULL DEFAULT 60 CHECK (useful_life_months >= 0),
    depreciation_start_date DATE,
    rate NUMERIC(8, 4) CHECK (rate IS NULL OR (rate >= 0 AND rate <= 1)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_asset_depreciation_asset UNIQUE (company_id, asset_id),
    CONSTRAINT uq_asset_depreciation_tenant UNIQUE (company_id, id),
    CONSTRAINT fk_asset_depr_asset_tenant FOREIGN KEY (company_id, asset_id)
        REFERENCES public.assets(company_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_asset_depr_tenant_asset ON public.asset_depreciation (company_id, asset_id);

-- Tenant immutability trigger
DROP TRIGGER IF EXISTS trg_prevent_tenant_change_asset_depr ON public.asset_depreciation;
CREATE TRIGGER trg_prevent_tenant_change_asset_depr
    BEFORE UPDATE ON public.asset_depreciation
    FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

-- RLS
ALTER TABLE public.asset_depreciation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view asset depreciation" ON public.asset_depreciation;
CREATE POLICY "Tenants can view asset depreciation"
    ON public.asset_depreciation FOR SELECT
    USING (public.is_tenant_member(company_id));

DROP POLICY IF EXISTS "Tenant admins can insert asset depreciation" ON public.asset_depreciation;
CREATE POLICY "Tenant admins can insert asset depreciation"
    ON public.asset_depreciation FOR INSERT
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can update asset depreciation" ON public.asset_depreciation;
CREATE POLICY "Tenant admins can update asset depreciation"
    ON public.asset_depreciation FOR UPDATE
    USING (public.is_tenant_admin(company_id))
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can delete asset depreciation" ON public.asset_depreciation;
CREATE POLICY "Tenant admins can delete asset depreciation"
    ON public.asset_depreciation FOR DELETE
    USING (public.is_tenant_admin(company_id));


-- ============================================================================
-- 2. ASSET WARRANTIES (HISTORY & ACTIVE MANAGEMENT)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.asset_warranties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL,
    vendor_id UUID,
    warranty_number TEXT NOT NULL,
    provider_name TEXT NOT NULL,
    warranty_type TEXT NOT NULL DEFAULT 'Manufacturer' CHECK (warranty_type IN ('Manufacturer', 'Extended', 'Vendor', 'Third-Party', 'Replacement', 'Labor Only', 'Parts & Labor')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    coverage_details TEXT,
    contact_details TEXT,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Expired', 'Voided')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_warranty_tenant UNIQUE (company_id, id),
    CONSTRAINT fk_warranty_asset_tenant FOREIGN KEY (company_id, asset_id)
        REFERENCES public.assets(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_warranty_vendor_tenant FOREIGN KEY (company_id, vendor_id)
        REFERENCES public.vendors(company_id, id) ON DELETE SET NULL,
    CONSTRAINT chk_warranty_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_warranties_tenant_asset ON public.asset_warranties (company_id, asset_id);
CREATE INDEX IF NOT EXISTS idx_warranties_tenant_expiry ON public.asset_warranties (company_id, end_date);
CREATE INDEX IF NOT EXISTS idx_warranties_tenant_status ON public.asset_warranties (company_id, status);

-- Tenant immutability trigger
DROP TRIGGER IF EXISTS trg_prevent_tenant_change_warranties ON public.asset_warranties;
CREATE TRIGGER trg_prevent_tenant_change_warranties
    BEFORE UPDATE ON public.asset_warranties
    FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

-- RLS
ALTER TABLE public.asset_warranties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view asset warranties" ON public.asset_warranties;
CREATE POLICY "Tenants can view asset warranties"
    ON public.asset_warranties FOR SELECT
    USING (public.is_tenant_member(company_id));

DROP POLICY IF EXISTS "Tenant admins can insert asset warranties" ON public.asset_warranties;
CREATE POLICY "Tenant admins can insert asset warranties"
    ON public.asset_warranties FOR INSERT
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can update asset warranties" ON public.asset_warranties;
CREATE POLICY "Tenant admins can update asset warranties"
    ON public.asset_warranties FOR UPDATE
    USING (public.is_tenant_admin(company_id))
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can delete asset warranties" ON public.asset_warranties;
CREATE POLICY "Tenant admins can delete asset warranties"
    ON public.asset_warranties FOR DELETE
    USING (public.is_tenant_admin(company_id));


-- ============================================================================
-- 3. CONTRACTS & CONTRACT LINKED ASSETS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    contract_number TEXT NOT NULL,
    title TEXT NOT NULL,
    vendor_id UUID,
    contract_type TEXT NOT NULL CHECK (contract_type IN ('Maintenance', 'Lease', 'Software License', 'Service Level Agreement', 'Warranty', 'Procurement', 'Master Services', 'Other')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    renewal_date DATE,
    contract_value NUMERIC(14, 2) CHECK (contract_value IS NULL OR contract_value >= 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    auto_renew BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Draft', 'Active', 'Expired', 'Terminated')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_contract_number_tenant UNIQUE (company_id, contract_number),
    CONSTRAINT uq_contract_tenant UNIQUE (company_id, id),
    CONSTRAINT fk_contract_vendor_tenant FOREIGN KEY (company_id, vendor_id)
        REFERENCES public.vendors(company_id, id) ON DELETE SET NULL,
    CONSTRAINT chk_contract_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_contracts_tenant_number ON public.contracts (company_id, contract_number);
CREATE INDEX IF NOT EXISTS idx_contracts_tenant_end_date ON public.contracts (company_id, end_date);
CREATE INDEX IF NOT EXISTS idx_contracts_tenant_status ON public.contracts (company_id, status);

-- Tenant immutability trigger
DROP TRIGGER IF EXISTS trg_prevent_tenant_change_contracts ON public.contracts;
CREATE TRIGGER trg_prevent_tenant_change_contracts
    BEFORE UPDATE ON public.contracts
    FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

-- RLS
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view contracts" ON public.contracts;
CREATE POLICY "Tenants can view contracts"
    ON public.contracts FOR SELECT
    USING (public.is_tenant_member(company_id));

DROP POLICY IF EXISTS "Tenant admins can insert contracts" ON public.contracts;
CREATE POLICY "Tenant admins can insert contracts"
    ON public.contracts FOR INSERT
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can update contracts" ON public.contracts;
CREATE POLICY "Tenant admins can update contracts"
    ON public.contracts FOR UPDATE
    USING (public.is_tenant_admin(company_id))
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can delete contracts" ON public.contracts;
CREATE POLICY "Tenant admins can delete contracts"
    ON public.contracts FOR DELETE
    USING (public.is_tenant_admin(company_id));


-- Contract Assets Junction Table
CREATE TABLE IF NOT EXISTS public.contract_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL,
    asset_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_contract_asset_tenant UNIQUE (company_id, contract_id, asset_id),
    CONSTRAINT uq_contract_asset_id_tenant UNIQUE (company_id, id),
    CONSTRAINT fk_ca_contract_tenant FOREIGN KEY (company_id, contract_id)
        REFERENCES public.contracts(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_ca_asset_tenant FOREIGN KEY (company_id, asset_id)
        REFERENCES public.assets(company_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ca_contract ON public.contract_assets (company_id, contract_id);
CREATE INDEX IF NOT EXISTS idx_ca_asset ON public.contract_assets (company_id, asset_id);

-- Tenant immutability trigger
DROP TRIGGER IF EXISTS trg_prevent_tenant_change_ca ON public.contract_assets;
CREATE TRIGGER trg_prevent_tenant_change_ca
    BEFORE UPDATE ON public.contract_assets
    FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

-- RLS
ALTER TABLE public.contract_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view contract assets" ON public.contract_assets;
CREATE POLICY "Tenants can view contract assets"
    ON public.contract_assets FOR SELECT
    USING (public.is_tenant_member(company_id));

DROP POLICY IF EXISTS "Tenant admins can insert contract assets" ON public.contract_assets;
CREATE POLICY "Tenant admins can insert contract assets"
    ON public.contract_assets FOR INSERT
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can delete contract assets" ON public.contract_assets;
CREATE POLICY "Tenant admins can delete contract assets"
    ON public.contract_assets FOR DELETE
    USING (public.is_tenant_admin(company_id));


-- ============================================================================
-- 4. SOFTWARE / LICENSE TRACKING & ALLOCATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.software_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    software_name TEXT NOT NULL,
    vendor_id UUID,
    publisher TEXT,
    license_key TEXT,
    license_type TEXT NOT NULL CHECK (license_type IN ('Per User', 'Per Device', 'Subscription', 'Site', 'Enterprise', 'Volume', 'Other')),
    purchased_quantity INTEGER NOT NULL DEFAULT 1 CHECK (purchased_quantity > 0),
    allocated_quantity INTEGER NOT NULL DEFAULT 0 CHECK (allocated_quantity >= 0),
    renewal_date DATE,
    expiry_date DATE,
    purchase_cost NUMERIC(14, 2) CHECK (purchase_cost IS NULL OR purchase_cost >= 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_license_tenant UNIQUE (company_id, id),
    CONSTRAINT chk_license_allocated_le_purchased CHECK (allocated_quantity <= purchased_quantity),
    CONSTRAINT fk_license_vendor_tenant FOREIGN KEY (company_id, vendor_id)
        REFERENCES public.vendors(company_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_licenses_tenant_name ON public.software_licenses (company_id, software_name);
CREATE INDEX IF NOT EXISTS idx_licenses_tenant_expiry ON public.software_licenses (company_id, expiry_date);

-- Tenant immutability trigger
DROP TRIGGER IF EXISTS trg_prevent_tenant_change_licenses ON public.software_licenses;
CREATE TRIGGER trg_prevent_tenant_change_licenses
    BEFORE UPDATE ON public.software_licenses
    FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

-- RLS
ALTER TABLE public.software_licenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view software licenses" ON public.software_licenses;
CREATE POLICY "Tenants can view software licenses"
    ON public.software_licenses FOR SELECT
    USING (public.is_tenant_member(company_id));

DROP POLICY IF EXISTS "Tenant admins can insert software licenses" ON public.software_licenses;
CREATE POLICY "Tenant admins can insert software licenses"
    ON public.software_licenses FOR INSERT
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can update software licenses" ON public.software_licenses;
CREATE POLICY "Tenant admins can update software licenses"
    ON public.software_licenses FOR UPDATE
    USING (public.is_tenant_admin(company_id))
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can delete software licenses" ON public.software_licenses;
CREATE POLICY "Tenant admins can delete software licenses"
    ON public.software_licenses FOR DELETE
    USING (public.is_tenant_admin(company_id));


-- Software License Allocations
CREATE TABLE IF NOT EXISTS public.software_license_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    license_id UUID NOT NULL,
    allocation_type TEXT NOT NULL CHECK (allocation_type IN ('Asset', 'Employee')),
    asset_id UUID,
    employee_id UUID,
    allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Released')),
    notes TEXT,
    CONSTRAINT uq_license_alloc_tenant UNIQUE (company_id, id),
    CONSTRAINT fk_sla_license_tenant FOREIGN KEY (company_id, license_id)
        REFERENCES public.software_licenses(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_sla_asset_tenant FOREIGN KEY (company_id, asset_id)
        REFERENCES public.assets(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_sla_employee_tenant FOREIGN KEY (company_id, employee_id)
        REFERENCES public.employees(company_id, id) ON DELETE CASCADE,
    CONSTRAINT chk_alloc_target CHECK (
        (allocation_type = 'Asset' AND asset_id IS NOT NULL) OR
        (allocation_type = 'Employee' AND employee_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_sla_tenant_license ON public.software_license_allocations (company_id, license_id);
CREATE INDEX IF NOT EXISTS idx_sla_tenant_asset ON public.software_license_allocations (company_id, asset_id);
CREATE INDEX IF NOT EXISTS idx_sla_tenant_emp ON public.software_license_allocations (company_id, employee_id);

-- Tenant immutability trigger
DROP TRIGGER IF EXISTS trg_prevent_tenant_change_sla ON public.software_license_allocations;
CREATE TRIGGER trg_prevent_tenant_change_sla
    BEFORE UPDATE ON public.software_license_allocations
    FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

-- RLS
ALTER TABLE public.software_license_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view license allocations" ON public.software_license_allocations;
CREATE POLICY "Tenants can view license allocations"
    ON public.software_license_allocations FOR SELECT
    USING (public.is_tenant_member(company_id));

DROP POLICY IF EXISTS "Tenant admins can insert license allocations" ON public.software_license_allocations;
CREATE POLICY "Tenant admins can insert license allocations"
    ON public.software_license_allocations FOR INSERT
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can update license allocations" ON public.software_license_allocations;
CREATE POLICY "Tenant admins can update license allocations"
    ON public.software_license_allocations FOR UPDATE
    USING (public.is_tenant_admin(company_id))
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can delete license allocations" ON public.software_license_allocations;
CREATE POLICY "Tenant admins can delete license allocations"
    ON public.software_license_allocations FOR DELETE
    USING (public.is_tenant_admin(company_id));


-- ============================================================================
-- 5. INSURANCE POLICIES & COVERED ASSETS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.insurance_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    policy_number TEXT NOT NULL,
    provider TEXT NOT NULL,
    coverage_type TEXT NOT NULL CHECK (coverage_type IN ('Comprehensive', 'Liability', 'Property', 'Theft', 'Equipment Floater', 'Business Interruption', 'Cyber Risk', 'Other')),
    start_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    insured_value NUMERIC(14, 2) CHECK (insured_value IS NULL OR insured_value >= 0),
    premium NUMERIC(14, 2) CHECK (premium IS NULL OR premium >= 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    deductible NUMERIC(14, 2) CHECK (deductible IS NULL OR deductible >= 0),
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Expired', 'Cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_insurance_policy_tenant UNIQUE (company_id, policy_number),
    CONSTRAINT uq_insurance_tenant UNIQUE (company_id, id),
    CONSTRAINT chk_insurance_dates CHECK (expiry_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_ins_tenant_policy ON public.insurance_policies (company_id, policy_number);
CREATE INDEX IF NOT EXISTS idx_ins_tenant_expiry ON public.insurance_policies (company_id, expiry_date);
CREATE INDEX IF NOT EXISTS idx_ins_tenant_status ON public.insurance_policies (company_id, status);

-- Tenant immutability trigger
DROP TRIGGER IF EXISTS trg_prevent_tenant_change_ins ON public.insurance_policies;
CREATE TRIGGER trg_prevent_tenant_change_ins
    BEFORE UPDATE ON public.insurance_policies
    FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

-- RLS
ALTER TABLE public.insurance_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view insurance policies" ON public.insurance_policies;
CREATE POLICY "Tenants can view insurance policies"
    ON public.insurance_policies FOR SELECT
    USING (public.is_tenant_member(company_id));

DROP POLICY IF EXISTS "Tenant admins can insert insurance policies" ON public.insurance_policies;
CREATE POLICY "Tenant admins can insert insurance policies"
    ON public.insurance_policies FOR INSERT
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can update insurance policies" ON public.insurance_policies;
CREATE POLICY "Tenant admins can update insurance policies"
    ON public.insurance_policies FOR UPDATE
    USING (public.is_tenant_admin(company_id))
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can delete insurance policies" ON public.insurance_policies;
CREATE POLICY "Tenant admins can delete insurance policies"
    ON public.insurance_policies FOR DELETE
    USING (public.is_tenant_admin(company_id));


-- Insurance Covered Assets
CREATE TABLE IF NOT EXISTS public.insurance_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    policy_id UUID NOT NULL,
    asset_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_insurance_asset_tenant UNIQUE (company_id, policy_id, asset_id),
    CONSTRAINT uq_insurance_asset_id_tenant UNIQUE (company_id, id),
    CONSTRAINT fk_ia_policy_tenant FOREIGN KEY (company_id, policy_id)
        REFERENCES public.insurance_policies(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_ia_asset_tenant FOREIGN KEY (company_id, asset_id)
        REFERENCES public.assets(company_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ia_tenant_policy ON public.insurance_assets (company_id, policy_id);
CREATE INDEX IF NOT EXISTS idx_ia_tenant_asset ON public.insurance_assets (company_id, asset_id);

-- Tenant immutability trigger
DROP TRIGGER IF EXISTS trg_prevent_tenant_change_ia ON public.insurance_assets;
CREATE TRIGGER trg_prevent_tenant_change_ia
    BEFORE UPDATE ON public.insurance_assets
    FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

-- RLS
ALTER TABLE public.insurance_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view insurance assets" ON public.insurance_assets;
CREATE POLICY "Tenants can view insurance assets"
    ON public.insurance_assets FOR SELECT
    USING (public.is_tenant_member(company_id));

DROP POLICY IF EXISTS "Tenant admins can insert insurance assets" ON public.insurance_assets;
CREATE POLICY "Tenant admins can insert insurance assets"
    ON public.insurance_assets FOR INSERT
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can delete insurance assets" ON public.insurance_assets;
CREATE POLICY "Tenant admins can delete insurance assets"
    ON public.insurance_assets FOR DELETE
    USING (public.is_tenant_admin(company_id));


-- ============================================================================
-- 6. ASSET ACQUISITION & FUNDING INFORMATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.asset_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL,
    vendor_id UUID,
    invoice_number TEXT,
    purchase_order TEXT,
    purchase_date DATE,
    purchase_cost NUMERIC(14, 2) CHECK (purchase_cost IS NULL OR purchase_cost >= 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    funding_source TEXT NOT NULL DEFAULT 'Company Purchase' CHECK (funding_source IN ('Company Purchase', 'Department Budget', 'Grant', 'Donation', 'Finance', 'Lease', 'Other')),
    department_id UUID,
    cost_center TEXT,
    is_financed BOOLEAN NOT NULL DEFAULT false,
    is_leased BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_asset_purchase_tenant UNIQUE (company_id, asset_id),
    CONSTRAINT uq_asset_purchase_id_tenant UNIQUE (company_id, id),
    CONSTRAINT fk_ap_asset_tenant FOREIGN KEY (company_id, asset_id)
        REFERENCES public.assets(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_ap_vendor_tenant FOREIGN KEY (company_id, vendor_id)
        REFERENCES public.vendors(company_id, id) ON DELETE SET NULL,
    CONSTRAINT fk_ap_department_tenant FOREIGN KEY (company_id, department_id)
        REFERENCES public.departments(company_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_asset_purchases_tenant_asset ON public.asset_purchases (company_id, asset_id);

-- Tenant immutability trigger
DROP TRIGGER IF EXISTS trg_prevent_tenant_change_ap ON public.asset_purchases;
CREATE TRIGGER trg_prevent_tenant_change_ap
    BEFORE UPDATE ON public.asset_purchases
    FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

-- RLS
ALTER TABLE public.asset_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view asset purchases" ON public.asset_purchases;
CREATE POLICY "Tenants can view asset purchases"
    ON public.asset_purchases FOR SELECT
    USING (public.is_tenant_member(company_id));

DROP POLICY IF EXISTS "Tenant admins can insert asset purchases" ON public.asset_purchases;
CREATE POLICY "Tenant admins can insert asset purchases"
    ON public.asset_purchases FOR INSERT
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can update asset purchases" ON public.asset_purchases;
CREATE POLICY "Tenant admins can update asset purchases"
    ON public.asset_purchases FOR UPDATE
    USING (public.is_tenant_admin(company_id))
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can delete asset purchases" ON public.asset_purchases;
CREATE POLICY "Tenant admins can delete asset purchases"
    ON public.asset_purchases FOR DELETE
    USING (public.is_tenant_admin(company_id));


-- ============================================================================
-- 7. DOCUMENTS & ATTACHMENTS (SECURE TENANT-SCOPED METADATA)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('ASSET', 'WARRANTY', 'CONTRACT', 'INSURANCE', 'LICENSE', 'MAINTENANCE', 'PURCHASE')),
    entity_id UUID NOT NULL,
    original_filename TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
    file_size BIGINT NOT NULL CHECK (file_size >= 0),
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_document_tenant UNIQUE (company_id, id)
);

CREATE INDEX IF NOT EXISTS idx_docs_tenant_entity ON public.documents (company_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_docs_tenant_uploaded_at ON public.documents (company_id, created_at DESC);

-- Tenant immutability trigger
DROP TRIGGER IF EXISTS trg_prevent_tenant_change_docs ON public.documents;
CREATE TRIGGER trg_prevent_tenant_change_docs
    BEFORE UPDATE ON public.documents
    FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

-- RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view documents" ON public.documents;
CREATE POLICY "Tenants can view documents"
    ON public.documents FOR SELECT
    USING (public.is_tenant_member(company_id));

DROP POLICY IF EXISTS "Tenant members can upload documents" ON public.documents;
CREATE POLICY "Tenant members can upload documents"
    ON public.documents FOR INSERT
    WITH CHECK (public.is_tenant_member(company_id));

DROP POLICY IF EXISTS "Tenant admins can delete documents" ON public.documents;
CREATE POLICY "Tenant admins can delete documents"
    ON public.documents FOR DELETE
    USING (public.is_tenant_admin(company_id));


-- ============================================================================
-- 8. CUSTOM FIELD DEFINITIONS & ASSET VALUES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.custom_field_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    field_type TEXT NOT NULL CHECK (field_type IN ('Text', 'Number', 'Date', 'Yes/No', 'Dropdown')),
    is_required BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    dropdown_choices JSONB NOT NULL DEFAULT '[]'::jsonb,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_cf_def_tenant_name UNIQUE (company_id, field_name),
    CONSTRAINT uq_cf_def_tenant UNIQUE (company_id, id)
);

CREATE INDEX IF NOT EXISTS idx_cf_defs_tenant_active ON public.custom_field_definitions (company_id, is_active, display_order);

-- Tenant immutability trigger
DROP TRIGGER IF EXISTS trg_prevent_tenant_change_cf_defs ON public.custom_field_definitions;
CREATE TRIGGER trg_prevent_tenant_change_cf_defs
    BEFORE UPDATE ON public.custom_field_definitions
    FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

-- RLS
ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view custom field definitions" ON public.custom_field_definitions;
CREATE POLICY "Tenants can view custom field definitions"
    ON public.custom_field_definitions FOR SELECT
    USING (public.is_tenant_member(company_id));

DROP POLICY IF EXISTS "Tenant admins can insert custom field definitions" ON public.custom_field_definitions;
CREATE POLICY "Tenant admins can insert custom field definitions"
    ON public.custom_field_definitions FOR INSERT
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can update custom field definitions" ON public.custom_field_definitions;
CREATE POLICY "Tenant admins can update custom field definitions"
    ON public.custom_field_definitions FOR UPDATE
    USING (public.is_tenant_admin(company_id))
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can delete custom field definitions" ON public.custom_field_definitions;
CREATE POLICY "Tenant admins can delete custom field definitions"
    ON public.custom_field_definitions FOR DELETE
    USING (public.is_tenant_admin(company_id));


-- Asset Custom Field Values
CREATE TABLE IF NOT EXISTS public.asset_custom_field_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL,
    field_definition_id UUID NOT NULL,
    field_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_asset_cf_val_tenant UNIQUE (company_id, asset_id, field_definition_id),
    CONSTRAINT uq_asset_cf_val_id_tenant UNIQUE (company_id, id),
    CONSTRAINT fk_cfv_asset_tenant FOREIGN KEY (company_id, asset_id)
        REFERENCES public.assets(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_cfv_def_tenant FOREIGN KEY (company_id, field_definition_id)
        REFERENCES public.custom_field_definitions(company_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cf_vals_tenant_asset ON public.asset_custom_field_values (company_id, asset_id);

-- Tenant immutability trigger
DROP TRIGGER IF EXISTS trg_prevent_tenant_change_cf_vals ON public.asset_custom_field_values;
CREATE TRIGGER trg_prevent_tenant_change_cf_vals
    BEFORE UPDATE ON public.asset_custom_field_values
    FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

-- RLS
ALTER TABLE public.asset_custom_field_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view custom field values" ON public.asset_custom_field_values;
CREATE POLICY "Tenants can view custom field values"
    ON public.asset_custom_field_values FOR SELECT
    USING (public.is_tenant_member(company_id));

DROP POLICY IF EXISTS "Tenant admins can insert custom field values" ON public.asset_custom_field_values;
CREATE POLICY "Tenant admins can insert custom field values"
    ON public.asset_custom_field_values FOR INSERT
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can update custom field values" ON public.asset_custom_field_values;
CREATE POLICY "Tenant admins can update custom field values"
    ON public.asset_custom_field_values FOR UPDATE
    USING (public.is_tenant_admin(company_id))
    WITH CHECK (public.is_tenant_admin(company_id));

DROP POLICY IF EXISTS "Tenant admins can delete custom field values" ON public.asset_custom_field_values;
CREATE POLICY "Tenant admins can delete custom field values"
    ON public.asset_custom_field_values FOR DELETE
    USING (public.is_tenant_admin(company_id));


-- ============================================================================
-- 9. EXTEND ASSET_EVENTS EVENT_TYPE CHECK CONSTRAINT
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
        'CUSTOM_FIELD_CREATED'
    ));


-- ============================================================================
-- 10. POSTGREST GRANTS AND NOTIFY
-- ============================================================================

GRANT ALL ON public.asset_depreciation TO anon, authenticated, service_role;
GRANT ALL ON public.asset_warranties TO anon, authenticated, service_role;
GRANT ALL ON public.contracts TO anon, authenticated, service_role;
GRANT ALL ON public.contract_assets TO anon, authenticated, service_role;
GRANT ALL ON public.software_licenses TO anon, authenticated, service_role;
GRANT ALL ON public.software_license_allocations TO anon, authenticated, service_role;
GRANT ALL ON public.insurance_policies TO anon, authenticated, service_role;
GRANT ALL ON public.insurance_assets TO anon, authenticated, service_role;
GRANT ALL ON public.asset_purchases TO anon, authenticated, service_role;
GRANT ALL ON public.documents TO anon, authenticated, service_role;
GRANT ALL ON public.custom_field_definitions TO anon, authenticated, service_role;
GRANT ALL ON public.asset_custom_field_values TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
