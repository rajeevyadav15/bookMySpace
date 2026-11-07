CREATE TABLE theatres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  city VARCHAR(60) NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_theatres_city ON theatres(LOWER(city));

CREATE TABLE screens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theatre_id UUID NOT NULL REFERENCES theatres(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  rows_count INT NOT NULL CHECK (rows_count BETWEEN 1 AND 26),
  seats_per_row INT NOT NULL CHECK (seats_per_row BETWEEN 1 AND 30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (theatre_id, name)
);

CREATE TABLE seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id UUID NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  row_label CHAR(1) NOT NULL,
  seat_number INT NOT NULL,
  seat_type VARCHAR(10) NOT NULL DEFAULT 'regular'
    CHECK (seat_type IN ('regular', 'premium')),
  UNIQUE (screen_id, row_label, seat_number)
);