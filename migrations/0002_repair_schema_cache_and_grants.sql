-- ============================================================================
-- AssetMT - Schema Cache & Grants Repair Migration
-- File: migrations/0002_repair_schema_cache_and_grants.sql
-- Use when tables already exist in Supabase but PostgREST reports:
-- "Could not find the table 'public.memberships' in the schema cache"
-- ============================================================================

-- 1. Ensure PostgREST roles (anon, authenticated, service_role) have usage on schema and tables
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- 2. Configure default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 3. Explicitly verify execution grant on create_company_workspace
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'create_company_workspace'
    ) THEN
        GRANT EXECUTE ON FUNCTION public.create_company_workspace(TEXT, TEXT) TO authenticated;
    END IF;
END $$;

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
