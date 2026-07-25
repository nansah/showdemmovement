-- ================================================================
-- SHOWDEM MOVEMENT FOUNDATION — Supabase Setup
-- Run this once in your Supabase project's SQL Editor:
--   supabase.com → your project → SQL Editor → New query → paste → Run
-- ================================================================

-- 1. Content table  (stores admin-edited timeline card text & media URLs)
CREATE TABLE IF NOT EXISTS content (
  id         integer     PRIMARY KEY DEFAULT 1,
  data       jsonb       NOT NULL DEFAULT '{"text":{},"media":{},"placeholder":{}}',
  updated_at timestamptz DEFAULT now()
);

-- Seed with an empty row so the first GET /api/content doesn't fail
INSERT INTO content (id, data)
VALUES (1, '{"text":{},"media":{},"placeholder":{}}')
ON CONFLICT (id) DO NOTHING;

-- 2. Applications table  (stores membership form submissions)
CREATE TABLE IF NOT EXISTS applications (
  id           text        PRIMARY KEY,
  submitted_at timestamptz DEFAULT now(),
  status       text        NOT NULL DEFAULT 'pending',
  notes        text        DEFAULT '',
  data         jsonb       NOT NULL DEFAULT '{}',
  updated_at   timestamptz
);

-- Access is controlled server-side using the service role key, so RLS is off.
ALTER TABLE content      DISABLE ROW LEVEL SECURITY;
ALTER TABLE applications DISABLE ROW LEVEL SECURITY;

-- ================================================================
-- STORAGE BUCKET
-- Do this in the Supabase dashboard (can't be done in SQL Editor):
--   Storage → New bucket → Name: media → check "Public bucket" → Create
-- ================================================================
