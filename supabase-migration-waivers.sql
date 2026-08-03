-- ================================================================
-- SHOWDEM MOVEMENT FOUNDATION — Waivers Table Migration
-- Run this once in your Supabase project's SQL Editor:
--   supabase.com → your project → SQL Editor → New query → paste → Run
-- ================================================================

-- Waivers table  (stores participation waiver submissions)
CREATE TABLE IF NOT EXISTS waivers (
  id           text        PRIMARY KEY,
  submitted_at timestamptz DEFAULT now(),
  data         jsonb       NOT NULL DEFAULT '{}'
);

-- Access is controlled server-side using the service role key, so RLS is off.
ALTER TABLE waivers DISABLE ROW LEVEL SECURITY;
