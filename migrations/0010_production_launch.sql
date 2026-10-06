-- ============================================================================
-- AssetMT Database Schema & Production Architecture
-- Version: 0010_production_launch.sql
-- Target: Phase 7 Production Hardening, Storage, Subscription Entitlement & Launch
-- Modules: Subscription Lifecycle, Object Storage Keying, Platform Security & RLS
-- Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
-- ============================================================================

-- 1. SUBSCRIPTION LIFECYCLE & ENTITLEMENT METADATA
ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_status_check;
ALTER TABLE public.companies ADD CONSTRAINT companies_status_check 
    CHECK (status IN ('ACTIVE', 'TRIAL', 'PAST_DUE', 'SUSPENDED', 'CANCELLED'));

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS subscription_id TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS grace_period_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_companies_subscription ON public.companies (subscription_id);

-- 2. OBJECT STORAGE KEYING & BINARY METADATA
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS storage_key TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS content_type TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS is_quarantined BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_documents_storage_key ON public.documents (company_id, storage_key);

-- 3. PLATFORM SECURITY & AUTHORIZATION FUNCTION
CREATE OR REPLACE FUNCTION public.is_platform_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.platform_admins
        WHERE user_id = check_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. POSTGREST SCHEMA CACHE RELOAD
GRANT ALL ON public.documents TO anon, authenticated, service_role;
GRANT ALL ON public.companies TO anon, authenticated, service_role;
GRANT ALL ON public.tenant_settings TO anon, authenticated, service_role;
GRANT ALL ON public.tenant_invitations TO anon, authenticated, service_role;
GRANT ALL ON public.platform_admins TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
