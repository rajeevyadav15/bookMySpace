CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  show_id UUID NOT NULL REFERENCES shows(id) ON DELETE RESTRICT,
  hold_id UUID NOT NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  gateway_order_id VARCHAR(100) NOT NULL UNIQUE,
  gateway_payment_id VARCHAR(100),
  amount_paise INT NOT NULL CHECK (amount_paise > 0),
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  -- Snapshot of seats. Booking can be created even if Redis hold expired
  seats JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'paid', 'refund_pending', 'refunded', 'refund_failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one open order per hold
CREATE UNIQUE INDEX uniq_open_payment_per_hold
  ON payments(hold_id) WHERE status = 'created';

CREATE INDEX idx_payments_user ON payments(user_id, created_at DESC);
CREATE INDEX idx_payments_booking ON payments(booking_id);