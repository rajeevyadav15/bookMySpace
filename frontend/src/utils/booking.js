export const CANCEL_BEFORE_MS = 2 * 60 * 60 * 1000;

// Same rule as backend: confirmed and at least 2 hours before show
export function canCancel(booking, now = Date.now()) {
  return (
    booking.status === "confirmed" &&
    new Date(booking.start_time).getTime() - now >= CANCEL_BEFORE_MS
  );
}

export function refundMessage(refund) {
  if (refund === "refunded") return "Booking cancelled. Your refund has been started.";
  if (refund === "refund_failed") {
    return "Booking cancelled, but the refund could not be started. Please contact support.";
  }
  return "Booking cancelled.";
}