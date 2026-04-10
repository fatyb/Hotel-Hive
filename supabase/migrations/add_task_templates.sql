-- ============================================================
-- Migration: Add task_templates table + checklist column on tasks
-- Run in Supabase → SQL Editor if your DB already has the base schema
-- ============================================================

-- 1. Add checklist column to tasks (if not already present)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS checklist JSONB NOT NULL DEFAULT '[]';

-- 2. Create task_templates table
CREATE TABLE IF NOT EXISTS task_templates (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id      UUID        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  description   TEXT        NOT NULL DEFAULT '',
  department    TEXT        NOT NULL
                            CHECK (department IN ('housekeeping', 'maintenance', 'it', 'reception')),
  type          TEXT        NOT NULL DEFAULT 'routine'
                            CHECK (type IN ('routine', 'urgente')),
  priority      TEXT        NOT NULL DEFAULT 'normale'
                            CHECK (priority IN ('basse', 'normale', 'haute')),
  assigned_role TEXT        NOT NULL DEFAULT 'housekeeping'
                            CHECK (assigned_role IN ('manager', 'reception', 'housekeeping', 'maintenance', 'it')),
  checklist     JSONB       NOT NULL DEFAULT '[]',
  days_of_week  INT[]       NOT NULL DEFAULT '{1,2,3,4,5}',
  time_of_day   TIME        NOT NULL DEFAULT '08:00',
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. RLS
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_templates: same hotel" ON task_templates;

CREATE POLICY "task_templates: same hotel"
  ON task_templates FOR ALL
  USING (hotel_id = my_hotel_id());
