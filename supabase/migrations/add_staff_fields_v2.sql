-- ============================================================
-- Migration v2: Add email, assigned_floors (multi-floor support)
-- Run in Supabase → SQL Editor after add_staff_fields.sql
-- ============================================================

-- Drop single-floor column if it exists (from previous migration)
ALTER TABLE profiles
  DROP COLUMN IF EXISTS assigned_floor;

-- Add new columns
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email           TEXT,
  ADD COLUMN IF NOT EXISTS assigned_floors TEXT NOT NULL DEFAULT '';
  -- comma-separated floor numbers, e.g. "1,2,3"
