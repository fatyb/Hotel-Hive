-- ============================================================
-- Migration: Extend profiles with staff scheduling fields
-- Run in Supabase → SQL Editor
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone_number  TEXT,
  ADD COLUMN IF NOT EXISTS assigned_floor INT,
  ADD COLUMN IF NOT EXISTS shift_type    TEXT
    CHECK (shift_type IN ('matin', 'apres-midi', 'nuit', 'repos')),
  ADD COLUMN IF NOT EXISTS working_hours TEXT,   -- e.g. "07:00–15:00"
  ADD COLUMN IF NOT EXISTS pin_code      TEXT;   -- 6-digit manager-generated PIN
