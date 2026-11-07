CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE shows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE RESTRICT,
  screen_id UUID NOT NULL REFERENCES screens(id) ON DELETE RESTRICT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  price_regular NUMERIC(10,2) NOT NULL CHECK (price_regular >= 0),
  price_premium NUMERIC(10,2) NOT NULL CHECK (price_premium >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),
  -- Same screen pe time overlap not allowed
  EXCLUDE USING gist (
    screen_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  )
);

CREATE INDEX idx_shows_movie_start ON shows(movie_id, start_time);
CREATE INDEX idx_shows_screen_start ON shows(screen_id, start_time);