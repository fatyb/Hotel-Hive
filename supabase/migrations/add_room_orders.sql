-- ============================================================
-- Migration: Add room_orders table for front office client requests
-- Run in Supabase → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS room_orders (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    UUID        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  room_id     UUID        REFERENCES rooms(id) ON DELETE SET NULL,
  room_number TEXT        NOT NULL DEFAULT '',
  title       TEXT        NOT NULL,
  notes       TEXT        NOT NULL DEFAULT '',
  status      TEXT        NOT NULL DEFAULT 'en_attente'
              CHECK (status IN ('en_attente', 'en_cours', 'livree', 'annulee')),
  priority    TEXT        NOT NULL DEFAULT 'normale'
              CHECK (priority IN ('normale', 'urgente')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE TRIGGER room_orders_updated_at
  BEFORE UPDATE ON room_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE room_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "room_orders: same hotel" ON room_orders;
CREATE POLICY "room_orders: same hotel"
  ON room_orders FOR ALL
  USING (hotel_id = my_hotel_id());
