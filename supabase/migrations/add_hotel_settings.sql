-- Extend hotels table with new fields
ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS address         TEXT,
  ADD COLUMN IF NOT EXISTS phone           TEXT,
  ADD COLUMN IF NOT EXISTS website         TEXT,
  ADD COLUMN IF NOT EXISTS currency        TEXT    NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS checkin_time    TEXT    NOT NULL DEFAULT '14:00',
  ADD COLUMN IF NOT EXISTS checkout_time   TEXT    NOT NULL DEFAULT '11:00',
  ADD COLUMN IF NOT EXISTS vat_rate        NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tourism_tax     NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_bed_price NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancellation_hours INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS logo_url        TEXT,
  ADD COLUMN IF NOT EXISTS brand_color     TEXT    NOT NULL DEFAULT '#FA7866',
  ADD COLUMN IF NOT EXISTS social_instagram TEXT,
  ADD COLUMN IF NOT EXISTS social_facebook  TEXT;

-- Room types table
CREATE TABLE IF NOT EXISTS room_types (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id    UUID        REFERENCES hotels(id) ON DELETE CASCADE NOT NULL,
  name        TEXT        NOT NULL,
  icon        TEXT        NOT NULL DEFAULT 'double',
  description TEXT,
  capacity    INTEGER     NOT NULL DEFAULT 2,
  base_price  NUMERIC     NOT NULL DEFAULT 0,
  amenities   JSONB       NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Link rooms to room types
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS room_type_id UUID REFERENCES room_types(id) ON DELETE SET NULL;

-- Hotel facilities
CREATE TABLE IF NOT EXISTS hotel_facilities (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id     UUID        REFERENCES hotels(id) ON DELETE CASCADE NOT NULL,
  name         TEXT        NOT NULL,
  icon         TEXT        NOT NULL,
  is_available BOOLEAN     NOT NULL DEFAULT true
);
