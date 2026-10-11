-- ============================================================================
-- AssetMT Database Schema & Production Architecture
-- Version: 0012_supabase_storage_bucket.sql
-- Target: Private Tenant-Partitioned Supabase Storage Bucket (assetmt-files)
-- Replaces Cloudflare R2 so AssetMT deploys on Cloudflare Workers Free + Supabase Free
-- Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
-- ============================================================================

-- 1. PROVISION PRIVATE SUPABASE STORAGE BUCKET: assetmt-files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'assetmt-files',
    'assetmt-files',
    false,
    26214400,
    ARRAY[
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/svg+xml',
        'text/csv',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 26214400,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. SAFE TENANT EXTRACTION HELPER FOR STORAGE OBJECT KEYS
-- Enforces strict key prefix: tenants/{company_id}/{category}/{uuid}_{safe_filename}
CREATE OR REPLACE FUNCTION public.storage_object_company_id(object_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    parts TEXT[];
BEGIN
    IF object_name IS NULL THEN
        RETURN NULL;
    END IF;
    parts := string_to_array(object_name, '/');
    IF array_length(parts, 1) < 3 OR parts[1] <> 'tenants' THEN
        RETURN NULL;
    END IF;
    IF parts[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RETURN parts[2]::UUID;
    END IF;
    RETURN NULL;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.storage_object_company_id(TEXT) TO anon, authenticated, service_role;

-- 3. STRICT MULTI-TENANT RLS POLICIES ON storage.objects FOR assetmt-files
DROP POLICY IF EXISTS "Tenant members can read own tenant files in assetmt-files" ON storage.objects;
CREATE POLICY "Tenant members can read own tenant files in assetmt-files"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'assetmt-files'
        AND public.is_tenant_member(public.storage_object_company_id(name))
    );

DROP POLICY IF EXISTS "Tenant members can upload own tenant files in assetmt-files" ON storage.objects;
CREATE POLICY "Tenant members can upload own tenant files in assetmt-files"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'assetmt-files'
        AND public.is_tenant_member(public.storage_object_company_id(name))
    );

DROP POLICY IF EXISTS "Tenant admins can update own tenant files in assetmt-files" ON storage.objects;
CREATE POLICY "Tenant admins can update own tenant files in assetmt-files"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'assetmt-files'
        AND public.is_tenant_admin(public.storage_object_company_id(name))
    )
    WITH CHECK (
        bucket_id = 'assetmt-files'
        AND public.is_tenant_admin(public.storage_object_company_id(name))
    );

DROP POLICY IF EXISTS "Tenant admins can delete own tenant files in assetmt-files" ON storage.objects;
CREATE POLICY "Tenant admins can delete own tenant files in assetmt-files"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'assetmt-files'
        AND public.is_tenant_admin(public.storage_object_company_id(name))
    );

-- 4. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
