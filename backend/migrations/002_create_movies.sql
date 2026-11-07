CREATE TABLE movies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  duration_min INT NOT NULL CHECK (duration_min > 0 AND duration_min <= 600),
  language VARCHAR(30) NOT NULL,
  genres TEXT[] NOT NULL DEFAULT '{}',
  certificate VARCHAR(5) CHECK (certificate IN ('U', 'UA', 'A', 'S')),
  release_date DATE,
  poster_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_movies_active_release ON movies(is_active, release_date DESC);