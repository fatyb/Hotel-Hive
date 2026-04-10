-- ============================================================
-- HotelHive — Database Schema
-- Run this entire file in Supabase → SQL Editor → New query
-- ============================================================


-- ============================================================
-- 1. HOTELS
-- One row per hotel (SaaS tenant)
-- ============================================================
CREATE TABLE hotels (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  slug       TEXT        NOT NULL UNIQUE,
  plan       TEXT        NOT NULL DEFAULT 'basic'
                         CHECK (plan IN ('basic', 'pro', 'enterprise')),
  timezone   TEXT        NOT NULL DEFAULT 'Europe/Paris',
  settings   JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 2. PROFILES
-- One row per user, linked to Supabase auth.users
-- ============================================================
CREATE TABLE profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  hotel_id   UUID        REFERENCES hotels(id) ON DELETE CASCADE,
  full_name  TEXT        NOT NULL DEFAULT '',
  role       TEXT        NOT NULL DEFAULT 'housekeeping'
                         CHECK (role IN ('manager', 'reception', 'housekeeping', 'maintenance', 'it')),
  avatar_url TEXT,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  push_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create a profile row whenever a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ============================================================
-- 3. ROOMS
-- ============================================================
CREATE TABLE rooms (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    UUID        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  number      TEXT        NOT NULL,
  floor       INT         NOT NULL DEFAULT 1,
  type        TEXT        NOT NULL DEFAULT 'double'
                          CHECK (type IN ('simple', 'double', 'suite')),
  status      TEXT        NOT NULL DEFAULT 'disponible'
                          CHECK (status IN ('disponible', 'occupee', 'nettoyage', 'maintenance')),
  is_occupied BOOLEAN     NOT NULL DEFAULT FALSE,
  notes       TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on every change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 4. TASKS
-- ============================================================
CREATE TABLE tasks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id     UUID        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  created_by   UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_to  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  room_id      UUID        REFERENCES rooms(id) ON DELETE SET NULL,
  title        TEXT        NOT NULL,
  description  TEXT        NOT NULL DEFAULT '',
  type         TEXT        NOT NULL DEFAULT 'routine'
                           CHECK (type IN ('routine', 'urgente')),
  status       TEXT        NOT NULL DEFAULT 'a_faire'
                           CHECK (status IN ('a_faire', 'en_cours', 'terminee', 'annulee')),
  priority     TEXT        NOT NULL DEFAULT 'normale'
                           CHECK (priority IN ('basse', 'normale', 'haute')),
  department   TEXT        NOT NULL
                           CHECK (department IN ('housekeeping', 'maintenance', 'it', 'reception')),
  due_at       TIMESTAMPTZ,
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  is_recurring BOOLEAN     NOT NULL DEFAULT FALSE,
  location     TEXT,
  photos       TEXT[]      NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 5. TASK COMMENTS
-- ============================================================
CREATE TABLE task_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 6. NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id   UUID        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL
                         CHECK (type IN ('task_assigned', 'urgent', 'completed', 'task_late', 'room_ready', 'issue_reported')),
  title      TEXT        NOT NULL,
  message    TEXT        NOT NULL,
  data       JSONB       NOT NULL DEFAULT '{}',
  is_read    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Each user only sees data from their own hotel
-- ============================================================

-- Enable RLS on every table
ALTER TABLE hotels       ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper: get the hotel_id of the currently logged-in user
CREATE OR REPLACE FUNCTION my_hotel_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT hotel_id FROM public.profiles WHERE id = auth.uid()
$$;


-- HOTELS: a user can only see their own hotel
CREATE POLICY "hotel: own hotel only"
  ON hotels FOR SELECT
  USING (id = my_hotel_id());

-- PROFILES: see all profiles in the same hotel
CREATE POLICY "profiles: same hotel"
  ON profiles FOR SELECT
  USING (hotel_id = my_hotel_id());

CREATE POLICY "profiles: update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- ROOMS: full access within same hotel
CREATE POLICY "rooms: same hotel"
  ON rooms FOR ALL
  USING (hotel_id = my_hotel_id());

-- TASKS: full access within same hotel
CREATE POLICY "tasks: same hotel"
  ON tasks FOR ALL
  USING (hotel_id = my_hotel_id());

-- TASK COMMENTS: access via task's hotel
CREATE POLICY "task_comments: same hotel"
  ON task_comments FOR ALL
  USING (
    task_id IN (SELECT id FROM tasks WHERE hotel_id = my_hotel_id())
  );

-- NOTIFICATIONS: only see your own notifications
CREATE POLICY "notifications: own only"
  ON notifications FOR ALL
  USING (user_id = auth.uid());


-- ============================================================
-- SAMPLE DATA — One hotel + sample rooms
-- Run this block after the schema above to have data to test with
-- ============================================================

INSERT INTO hotels (id, name, slug, plan)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Hôtel Bellevue',
  'bellevue',
  'pro'
);

INSERT INTO rooms (hotel_id, number, floor, type, status, is_occupied)
VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '101', 1, 'simple',  'disponible', FALSE),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '102', 1, 'double',  'occupee',    TRUE),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '201', 2, 'double',  'nettoyage',  FALSE),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '202', 2, 'suite',   'disponible', FALSE),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '301', 3, 'simple',  'maintenance',FALSE),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '302', 3, 'double',  'disponible', FALSE);
