const pool = require("../../config/db");
const env = require("../../config/env");
const ApiError = require("../../utils/ApiError");
const seatLock = require("../booking/seatLock");
const bookingService = require("../booking/booking.service");
const gateway = require("./gateway");
const { enqueueTicketEmail } = require("../../jobs/queues");

const toPaise = (value) => Math.round(Number(value) * 100);

function orderResponse(payment, expiresAt) {
  return {
    orderId: payment.gateway_order_id,
    amount: payment.amount_paise,
    currency: payment.currency,
    keyId: env.razorpayKeyId,
    holdId: payment.hold_id,
    expiresAt,
  };
}

// ---------- CREATE ORDER ----------
async function createOrder(userId, holdId) {
  const hold = await seatLock.getHold(holdId);
  if (!hold) throw new ApiError(410, "Hold expired. Please select seats again");
  if (hold.userId !== userId) throw new ApiError(403, "This hold is not yours");

  const booked = await pool.query("SELECT id FROM bookings WHERE hold_id = $1", [
    holdId,
  ]);
  if (booked.rowCount) throw new ApiError(409, "This hold is already booked");

  // Give the user more time to pay (refresh lock and hold TTL)
  const ttl = env.paymentHoldSeconds;
  const stillMine = await seatLock.lockSeats(
    hold.showId,
    hold.seatIds,
    userId,
    ttl
  );
  if (!stillMine) throw new ApiError(410, "Seat lock lost. Please select seats again");

  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
  await seatLock.saveHold({ ...hold, expiresAt }, ttl);

  // Same hold again returns the same open order
  const open = await pool.query(
    "SELECT * FROM payments WHERE hold_id = $1 AND status = 'created'",
    [holdId]
  );
  if (open.rows[0]) return orderResponse(open.rows[0], expiresAt);

  // Amount comes from server side hold, never from the client
  const amountPaise = toPaise(hold.totalAmount);
  const order = await gateway.createOrder({ amountPaise, receipt: holdId });

  try {
    const { rows } = await pool.query(
      `INSERT INTO payments (user_id, show_id, hold_id, gateway_order_id, amount_paise, seats)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING *`,
      [userId, hold.showId, holdId, order.id, amountPaise, JSON.stringify(hold.seats)]
    );
    return orderResponse(rows[0], expiresAt);
  } catch (err) {
    // Two requests at the same moment: use the one that won
    if (err.code === "23505") {
      const again = await pool.query(
        "SELECT * FROM payments WHERE hold_id = $1 AND status = 'created'",
        [holdId]
      );
      if (again.rows[0]) return orderResponse(again.rows[0], expiresAt);
    }
    throw err;
  }
}

// ---------- REFUND ----------
async function markRefundResult(paymentId, status) {
  await pool.query(
    "UPDATE payments SET status = $2, updated_at = now() WHERE id = $1",
    [paymentId, status]
  );
}

// Payment received but seat is gone: give the money back
async function refundPayment(payment, gatewayPaymentId) {
  // Atomic claim: only one request can move created to refund_pending
  const claimed = await pool.query(
    `UPDATE payments
     SET status = 'refund_pending',
         gateway_payment_id = COALESCE($2, gateway_payment_id),
         updated_at = now()
     WHERE id = $1 AND status = 'created'
     RETURNING *`,
    [payment.id, gatewayPaymentId]
  );

  if (!claimed.rowCount) {
    const current = await pool.query("SELECT status FROM payments WHERE id = $1", [
      payment.id,
    ]);
    return current.rows[0].status;
  }

  const row = claimed.rows[0];
  try {
    if (!row.gateway_payment_id) throw new Error("payment id missing");
    await gateway.refund(row.gateway_payment_id, row.amount_paise);
    await markRefundResult(row.id, "refunded");
    return "refunded";
  } catch (err) {
    console.error("Refund failed for payment", row.id, err.message);
    await markRefundResult(row.id, "refund_failed");
    return "refund_failed";
  }
}

async function refundForBooking(bookingId) {
  const claimed = await pool.query(
    `UPDATE payments
     SET status = 'refund_pending', updated_at = now()
     WHERE booking_id = $1 AND status = 'paid'
     RETURNING *`,
    [bookingId]
  );
  if (!claimed.rowCount) return null;

  const row = claimed.rows[0];
  try {
    await gateway.refund(row.gateway_payment_id, row.amount_paise);
    await markRefundResult(row.id, "refunded");
    return "refunded";
  } catch (err) {
    console.error("Refund failed for payment", row.id, err.message);
    await markRefundResult(row.id, "refund_failed");
    return "refund_failed";
  }
}

// ---------- FULFILL (used by verify and webhook, safe to repeat) ----------
async function fulfillPayment(payment, gatewayPaymentId) {
  if (payment.status === "paid") {
    return { status: "paid", bookingId: payment.booking_id, alreadyDone: true };
  }
  if (payment.status !== "created") {
    return { status: payment.status };
  }

  let created;
  try {
    created = await bookingService.createBooking({
      userId: payment.user_id,
      showId: payment.show_id,
      holdId: payment.hold_id,
      seats: payment.seats,
      totalAmount: payment.amount_paise / 100,
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      const status = await refundPayment(payment, gatewayPaymentId);
      return { status };
    }
    throw err;
  }

  await pool.query(
    `UPDATE payments
     SET status = 'paid',
         gateway_payment_id = COALESCE($2, gateway_payment_id),
         booking_id = $3,
         updated_at = now()
     WHERE id = $1 AND status = 'created'`,
    [payment.id, gatewayPaymentId, created.bookingId]
  );

  // Free the Redis hold (not serious if this fails, TTL will clean it)
  try {
    const seatIds = payment.seats.map((s) => s.id);
    await seatLock.unlockSeats(payment.show_id, seatIds, payment.user_id);
    const hold = await seatLock.getHold(payment.hold_id);
    if (hold) await seatLock.deleteHold(hold);
  } catch (err) {
    console.warn("hold cleanup failed:", err.message);
  }

  // Email failure must never break the booking
  try {
    await enqueueTicketEmail(created.bookingId);
  } catch (err) {
    console.error("Could not queue ticket email:", err.message);
  }

  return {
    status: "paid",
    bookingId: created.bookingId,
    alreadyDone: created.replayed,
  };
}

// ---------- VERIFY (called by frontend after payment) ----------
async function verifyPayment(userId, { razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  const { rows } = await pool.query(
    "SELECT * FROM payments WHERE gateway_order_id = $1 AND user_id = $2",
    [razorpayOrderId, userId]
  );
  if (!rows[0]) throw new ApiError(404, "Payment order not found");

  if (
    !gateway.verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)
  ) {
    throw new ApiError(400, "Invalid payment signature");
  }

  return fulfillPayment(rows[0], razorpayPaymentId);
}

// ---------- WEBHOOK (called by Razorpay) ----------
async function handleWebhook(rawBody, signature) {
  if (!signature || !gateway.verifyWebhookSignature(rawBody, signature)) {
    throw new ApiError(400, "Invalid webhook signature");
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch (err) {
    throw new ApiError(400, "Invalid webhook body");
  }

  if (!["payment.captured", "order.paid"].includes(event.event)) {
    return { ignored: true };
  }

  const entity = event.payload && event.payload.payment && event.payload.payment.entity;
  if (!entity || !entity.order_id) return { ignored: true };

  const { rows } = await pool.query(
    "SELECT * FROM payments WHERE gateway_order_id = $1",
    [entity.order_id]
  );
  if (!rows[0]) return { ignored: true };

  await fulfillPayment(rows[0], entity.id);
  return { ok: true };
}

module.exports = {
  createOrder,
  verifyPayment,
  handleWebhook,
  refundForBooking,
};