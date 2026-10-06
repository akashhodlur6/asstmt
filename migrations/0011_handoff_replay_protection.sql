-- ============================================================================
-- AssetMT Database Schema & Production Architecture
-- Version: 0011_handoff_replay_protection.sql
-- Target: Durable Distributed Replay Attack Protection for Akshigo Handoffs
-- Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
-- ============================================================================

-- 1. CONSUMED HANDOFF NONCES TABLE
CREATE TABLE IF NOT EXISTS public.consumed_handoff_nonces (
    nonce_hash TEXT PRIMARY KEY,
    consumed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- Index on expires_at for efficient cleanup queries
CREATE INDEX IF NOT EXISTS idx_consumed_handoff_expires ON public.consumed_handoff_nonces (expires_at);

-- 2. ROW LEVEL SECURITY & PERMISSIONS
ALTER TABLE public.consumed_handoff_nonces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow backend access to consumed handoff nonces"
    ON public.consumed_handoff_nonces
    FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

GRANT ALL ON public.consumed_handoff_nonces TO anon, authenticated, service_role;

-- 3. EXPIRED NONCE SAFE CLEANUP FUNCTION
CREATE OR REPLACE FUNCTION public.cleanup_expired_handoff_nonces()
RETURNS void AS $$
BEGIN
    DELETE FROM public.consumed_handoff_nonces
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_handoff_nonces() TO anon, authenticated, service_role;

-- 4. NOTIFY SCHEMA CACHE RELOAD
NOTIFY pgrst, 'reload schema';
