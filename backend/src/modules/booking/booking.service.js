const crypto = require("crypto");
const pool = require("../../config/db");
const env = require("../../config/env");
const ApiError = require("../../utils/ApiError");
const seatLock = require("./seatLock");

const CANCEL_BEFORE_HOURS = 2;

const toPaise = (value) => Math.round(Number(value) * 100);

const BOOKING_SELECT = `
  SELECT b.id, b.user_id, b.status, b.total_amount, b.created_at, b.cancelled_at,
         s.id AS show_id, s.start_time,
         m.title AS movie_title,
         sc.name AS screen_name,
         t.name AS theatre_name, t.city,
         COALESCE(
           json_agg(
             json_build_object(
               'seatId', seat.id,
               'row', seat.row_label,
               'number', seat.seat_number,
               'type', seat.seat_type,
               'price', bs.price
             ) ORDER BY seat.row_label, seat.seat_number
           ) FILTER (WHERE seat.id IS NOT NULL),
           '[]'
         ) AS seats
  FROM bookings b
  JOIN shows s ON s.id = b.show_id
  JOIN movies m ON m.id = s.movie_id
  JOIN screens sc ON sc.id = s.screen_id
  JOIN theatres t ON t.id = sc.theatre_id
  LEFT JOIN booking_seats bs ON bs.booking_id = b.id
  LEFT JOIN seats seat ON seat.id = bs.seat_id
`;

const BOOKING_GROUP = "GROUP BY b.id, s.id, m.id, sc.id, t.id";

async function getBookedSeatIds(showId, seatIds) {
  const { rows } = await pool.query(
    `SELECT seat_id FROM booking_seats
     WHERE show_id = $1 AND is_active = TRUE AND seat_id = ANY($2::uuid[])`,
    [showId, seatIds]
  );
  return rows.map((r) => r.seat_id);
}

// ---------- HOLD ----------
async function holdSeats(userId, { showId, seatIds }) {
  const showRes = await pool.query(
    `SELECT id, screen_id, start_time, price_regular, price_premium
     FROM shows WHERE id = $1`,
    [showId]
  );
  const show = showRes.rows[0];
  if (!show) throw new ApiError(404, "Show not found");
  if (new Date(show.start_time) <= new Date()) {
    throw new ApiError(400, "Show has already started");
  }

  // Seats must belong to the screen of this show
  const seatRes = await pool.query(
    `SELECT id, row_label, seat_number, seat_type
     FROM seats
     WHERE screen_id = $1 AND id = ANY($2::uuid[])`,
    [show.screen_id, seatIds]
  );
  if (seatRes.rowCount !== seatIds.length) {
    throw new ApiError(400, "Invalid seats for this show");
  }

  // Step 1: quick DB check
  if ((await getBookedSeatIds(showId, seatIds)).length) {
    throw new ApiError(409, "Some seats are already booked");
  }

  // Step 2: lock in Redis (atomic, all or nothing)
  const ttl = env.seatHoldSeconds;
  const locked = await seatLock.lockSeats(showId, seatIds, userId, ttl);
  if (!locked) {
    throw new ApiError(409, "Some seats are being held by another user");
  }

  try {
    // Step 3: check DB again. Someone may have booked between step 1 and 2.
    if ((await getBookedSeatIds(showId, seatIds)).length) {
      throw new ApiError(409, "Some seats are already booked");
    }

    const seats = seatRes.rows
      .sort(
        (a, b) =>
          a.row_label.localeCompare(b.row_label) || a.seat_number - b.seat_number
      )
      .map((s) => ({
        id: s.id,
        row: s.row_label,
        number: s.seat_number,
        type: s.seat_type,
        price: Number(
          s.seat_type === "premium" ? show.price_premium : show.price_regular
        ),
      }));

    // Calculated in paise (integer) to avoid float errors
    const totalAmount =
      seats.reduce((sum, s) => sum + toPaise(s.price), 0) / 100;

    // One active hold per user per show: free old seats
    const old = await seatLock.getUserHold(userId, showId);
    if (old) {
      const dropped = old.seatIds.filter((id) => !seatIds.includes(id));
      await seatLock.unlockSeats(showId, dropped, userId);
      await seatLock.deleteHold(old);
    }

    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    const hold = {
      holdId: crypto.randomUUID(),
      userId,
      showId,
      seatIds,
      seats,
      totalAmount,
      expiresAt,
    };
    await seatLock.saveHold(hold, ttl);

    return {
      holdId: hold.holdId,
      showId,
      seats,
      totalAmount,
      expiresAt,
    };
  } catch (err) {
    await seatLock.unlockSeats(showId, seatIds, userId).catch(() => {});
    throw err;
  }
}

async function releaseHold(userId, holdId) {
  const hold = await seatLock.getHold(holdId);
  if (!hold) throw new ApiError(404, "Hold not found or already expired");
  if (hold.userId !== userId) throw new ApiError(403, "This hold is not yours");

  await seatLock.unlockSeats(hold.showId, hold.seatIds, userId);
  await seatLock.deleteHold(hold);
}

// ---------- CONFIRM ----------
async function cleanupHold(hold, userId) {
  try {
    await seatLock.unlockSeats(hold.showId, hold.seatIds, userId);
    await seatLock.deleteHold(hold);
  } catch (err) {
    // Not serious. Locks expire by TTL and DB is already safe.
    console.warn("hold cleanup failed:", err.message);
  }
}

async function confirmBooking(userId, holdId) {
  // Idempotency: same hold confirmed again returns the same booking
  const existing = await pool.query(
    "SELECT id, user_id FROM bookings WHERE hold_id = $1",
    [holdId]
  );
  if (existing.rows[0]) {
    if (existing.rows[0].user_id !== userId) {
      throw new ApiError(403, "This hold is not yours");
    }
    const booking = await getById(existing.rows[0].id, { id: userId });
    return { booking, replayed: true };
  }

  const hold = await seatLock.getHold(holdId);
  if (!hold) {
    throw new ApiError(410, "Hold expired. Please select seats again");
  }
  if (hold.userId !== userId) throw new ApiError(403, "This hold is not yours");

  const owners = await seatLock.getOwners(hold.showId, hold.seatIds);
  if (owners.some((owner) => owner !== userId)) {
    throw new ApiError(410, "Seat lock expired. Please select seats again");
  }

  let bookingId;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const bookingRes = await client.query(
      `INSERT INTO bookings (user_id, show_id, hold_id, total_amount)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [userId, hold.showId, holdId, hold.totalAmount]
    );
    bookingId = bookingRes.rows[0].id;

    await client.query(
      `INSERT INTO booking_seats (booking_id, show_id, seat_id, price)
       SELECT $1::uuid, $2::uuid, x.seat_id, x.price
       FROM unnest($3::uuid[], $4::numeric[]) AS x(seat_id, price)`,
      [
        bookingId,
        hold.showId,
        hold.seats.map((s) => s.id),
        hold.seats.map((s) => s.price),
      ]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");

    if (err.code === "23505") {
      if (err.constraint === "uniq_active_seat_per_show") {
        throw new ApiError(409, "Seat already booked");
      }
      // Same hold confirmed twice at the same moment
      const dup = await pool.query(
        "SELECT id FROM bookings WHERE hold_id = $1 AND user_id = $2",
        [holdId, userId]
      );
      if (dup.rows[0]) {
        const booking = await getById(dup.rows[0].id, { id: userId });
        return { booking, replayed: true };
      }
    }
    throw err;
  } finally {
    client.release();
  }

  await cleanupHold(hold, userId);

  const booking = await getById(bookingId, { id: userId });
  return { booking, replayed: false };
}

// ---------- READ ----------
async function getById(bookingId, user) {
  const { rows } = await pool.query(
    `${BOOKING_SELECT} WHERE b.id = $1 ${BOOKING_GROUP}`,
    [bookingId]
  );
  const booking = rows[0];

  // 404 (not 403) so nobody can guess which booking ids exist
  if (!booking || (booking.user_id !== user.id && user.role !== "admin")) {
    throw new ApiError(404, "Booking not found");
  }
  return booking;
}

async function listMine(userId, { page, limit }) {
  const { rows } = await pool.query(
    `${BOOKING_SELECT}
     WHERE b.user_id = $1
     ${BOOKING_GROUP}
     ORDER BY b.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, (page - 1) * limit]
  );
  return { items: rows, page, limit };
}

// ---------- CANCEL ----------
async function cancel(user, bookingId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Row lock: two cancel requests cannot run together
    const { rows } = await client.query(
      `SELECT b.id, b.user_id, b.status, s.start_time
       FROM bookings b
       JOIN shows s ON s.id = b.show_id
       WHERE b.id = $1
       FOR UPDATE OF b`,
      [bookingId]
    );
    const booking = rows[0];

    if (!booking || booking.user_id !== user.id) {
      throw new ApiError(404, "Booking not found");
    }
    if (booking.status !== "confirmed") {
      throw new ApiError(409, "Booking is already cancelled");
    }

    const deadline = new Date(Date.now() + CANCEL_BEFORE_HOURS * 3600 * 1000);
    if (new Date(booking.start_time) < deadline) {
      throw new ApiError(
        400,
        `Cannot cancel within ${CANCEL_BEFORE_HOURS} hours of show time`
      );
    }

    await client.query(
      "UPDATE bookings SET status = 'cancelled', cancelled_at = now() WHERE id = $1",
      [bookingId]
    );
    // Seats become free again (partial unique index only looks at active rows)
    await client.query(
      "UPDATE booking_seats SET is_active = FALSE WHERE booking_id = $1",
      [bookingId]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return getById(bookingId, user);
}

module.exports = {
  holdSeats,
  releaseHold,
  confirmBooking,
  getById,
  listMine,
  cancel,
};