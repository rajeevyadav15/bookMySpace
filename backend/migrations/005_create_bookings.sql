CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  show_id UUID NOT NULL REFERENCES shows(id) ON DELETE RESTRICT,
  -- hold_id is unique, so same hold can never create 2 bookings
  hold_id UUID NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'cancelled')),
  total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX idx_bookings_user_created ON bookings(user_id, created_at DESC);
CREATE INDEX idx_bookings_show ON bookings(show_id);

CREATE TABLE booking_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  show_id UUID NOT NULL REFERENCES shows(id) ON DELETE RESTRICT,
  seat_id UUID NOT NULL REFERENCES seats(id) ON DELETE RESTRICT,
  price NUMERIC(10,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Final safety: one seat can have only ONE active booking per show.
-- Even if Redis fails, double booking is impossible.
CREATE UNIQUE INDEX uniq_active_seat_per_show
  ON booking_seats(show_id, seat_id)
  WHERE is_active;

CREATE INDEX idx_booking_seats_booking ON booking_seats(booking_id);