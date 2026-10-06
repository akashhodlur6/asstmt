-- ============================================================================
-- AssetMT Database Schema & Production Architecture
-- Version: 0011_akshigo_handoff_nonces.sql
-- Target: Durable Distributed Replay Protection for Akshigo Subscription Handoff
-- Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.handoff_nonces (
    nonce_hash TEXT PRIMARY KEY,
    tenant_name TEXT NOT NULL,
    admin_email TEXT NOT NULL,
    consumed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- Index for background cleanup of expired nonces
CREATE INDEX IF NOT EXISTS idx_handoff_nonces_expires ON public.handoff_nonces (expires_at);

-- RLS: Protect nonce table
ALTER TABLE public.handoff_nonces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to insert handoff nonces"
    ON public.handoff_nonces
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to view handoff nonces"
    ON public.handoff_nonces
    FOR SELECT
    TO authenticated
    USING (true);

GRANT ALL ON public.handoff_nonces TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
