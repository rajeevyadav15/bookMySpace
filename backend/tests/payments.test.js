// Tests always use mock gateway, so no internet or keys needed
process.env.PAYMENT_MODE = "mock";

const crypto = require("crypto");
const request = require("supertest");
const app = require("../src/app");
const env = require("../src/config/env");
const pool = require("../src/config/db");
const redis = require("../src/config/redis");
const cache = require("../src/utils/cache");
const { getEmailQueue, closeQueues } = require("../src/jobs/queues");

jest.setTimeout(20000);

const stamp = Date.now();
const password = "Password123";
const emails = {
  admin: `padmin_${stamp}@example.com`,
  a: `paya_${stamp}@example.com`,
  b: `payb_${stamp}@example.com`,
};

let adminToken, tokenA, tokenB, idA;
let movieId, theatreId, screenId, showId;
let S = []; // seat ids: A1..A4, B1..B4, C1..C4
let holdA, orderA, bookingA;
let orderB, bookingB;

const hoursFromNow = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString();
const auth = (token) => ({ Authorization: `Bearer ${token}` });
const lockKey = (seatId) => `seatlock:${showId}:${seatId}`;
const hmac = (secret, data) =>
  crypto.createHmac("sha256", secret).update(data).digest("hex");
const newPayId = () => `pay_${crypto.randomBytes(6).toString("hex")}`;
const signPayment = (orderId, payId) =>
  hmac(env.razorpayKeySecret, `${orderId}|${payId}`);

async function register(email) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: "Tester", email, password });
  return res.body;
}

async function login(email) {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.token;
}

const hold = (token, seatIds) =>
  request(app).post("/api/bookings/hold").set(auth(token)).send({ showId, seatIds });

const createOrder = (token, holdId) =>
  request(app).post("/api/payments/order").set(auth(token)).send({ holdId });

const verify = (token, orderId, payId, signature) =>
  request(app)
    .post("/api/payments/verify")
    .set(auth(token))
    .send({
      razorpayOrderId: orderId,
      razorpayPaymentId: payId,
      razorpaySignature: signature,
    });

const sendWebhook = (payload, signature) => {
  const body = JSON.stringify(payload);
  return request(app)
    .post("/api/payments/webhook")
    .set("Content-Type", "application/json")
    .set("X-Razorpay-Signature", signature ?? hmac(env.razorpayWebhookSecret, body))
    .send(body);
};

const capturedEvent = (orderId, payId) => ({
  event: "payment.captured",
  payload: { payment: { entity: { id: payId, order_id: orderId, status: "captured" } } },
});

const paymentStatus = async (orderId) => {
  const { rows } = await pool.query(
    "SELECT status FROM payments WHERE gateway_order_id = $1",
    [orderId]
  );
  return rows[0] && rows[0].status;
};

async function seatMap() {
  const res = await request(app).get(`/api/shows/${showId}`);
  return res.body.seats;
}

beforeAll(async () => {
  const a = await register(emails.a);
  tokenA = a.token;
  idA = a.user.id;
  tokenB = (await register(emails.b)).token;
  await register(emails.admin);
  await pool.query("UPDATE users SET role = 'admin' WHERE email = $1", [emails.admin]);
  adminToken = await login(emails.admin);

  const movie = await request(app)
    .post("/api/movies")
    .set(auth(adminToken))
    .send({ title: `Payment Test ${stamp}`, durationMin: 120, language: "Hindi" });
  movieId = movie.body.movie.id;

  const theatre = await request(app)
    .post("/api/theatres")
    .set(auth(adminToken))
    .send({ name: "Payment Test Hall", city: "Raipur", address: "Test Road, Raipur" });
  theatreId = theatre.body.theatre.id;

  const screen = await request(app)
    .post(`/api/theatres/${theatreId}/screens`)
    .set(auth(adminToken))
    .send({ name: "Screen 1", rows: 3, seatsPerRow: 4, premiumRows: 1 });
  screenId = screen.body.screen.id;

  const show = await request(app)
    .post("/api/shows")
    .set(auth(adminToken))
    .send({
      movieId,
      screenId,
      startTime: hoursFromNow(24),
      priceRegular: 200,
      pricePremium: 300,
    });
  showId = show.body.show.id;

  S = (await seatMap()).map((s) => s.id);
});

afterAll(async () => {
  await pool.query("DELETE FROM payments WHERE show_id = $1", [showId]);
  await pool.query("DELETE FROM bookings WHERE show_id = $1", [showId]);
  await pool.query("DELETE FROM shows WHERE id = $1", [showId]);
  await pool.query("DELETE FROM theatres WHERE id = $1", [theatreId]);
  await pool.query("DELETE FROM movies WHERE id = $1", [movieId]);
  await pool.query("DELETE FROM users WHERE email = ANY($1)", [Object.values(emails)]);
  await cache.delByPrefix(`seatlock:${showId}:`);
  await cache.delByPrefix("movies:");
  await closeQueues();
  await pool.end();
  redis.disconnect();
});

describe("Create order", () => {
  it("blocks order without login", async () => {
    const res = await request(app)
      .post("/api/payments/order")
      .send({ holdId: crypto.randomUUID() });
    expect(res.statusCode).toBe(401);
  });

  it("rejects invalid holdId", async () => {
    const res = await createOrder(tokenA, "abc");
    expect(res.statusCode).toBe(400);
  });

  it("returns 410 for unknown hold", async () => {
    const res = await createOrder(tokenA, crypto.randomUUID());
    expect(res.statusCode).toBe(410);
  });

  it("creates order with amount in paise", async () => {
    const h = await hold(tokenA, [S[0], S[1]]);
    expect(h.statusCode).toBe(201);
    holdA = h.body.hold.holdId;

    const res = await createOrder(tokenA, holdA);
    expect(res.statusCode).toBe(201);
    expect(res.body.order.amount).toBe(40000);
    expect(res.body.order.orderId).toMatch(/^order_mock_/);
    orderA = res.body.order;
  });

  it("other user cannot create order for my hold", async () => {
    const res = await createOrder(tokenB, holdA);
    expect(res.statusCode).toBe(403);
  });

  it("same hold returns the same open order", async () => {
    const res = await createOrder(tokenA, holdA);
    expect(res.statusCode).toBe(201);
    expect(res.body.order.orderId).toBe(orderA.orderId);
  });

  it("extends seat lock time for payment", async () => {
    const ttl = await redis.ttl(lockKey(S[0]));
    expect(ttl).toBeGreaterThan(env.seatHoldSeconds);
  });
});

describe("Verify payment", () => {
  it("rejects wrong signature", async () => {
    const res = await verify(tokenA, orderA.orderId, newPayId(), "f".repeat(64));
    expect(res.statusCode).toBe(400);
  });

  it("other user cannot verify my order", async () => {
    const payId = newPayId();
    const res = await verify(tokenB, orderA.orderId, payId, signPayment(orderA.orderId, payId));
    expect(res.statusCode).toBe(404);
  });

  it("confirms booking with valid signature", async () => {
    const payId = newPayId();
    const res = await verify(tokenA, orderA.orderId, payId, signPayment(orderA.orderId, payId));
    expect(res.statusCode).toBe(201);
    expect(res.body.booking.status).toBe("confirmed");
    expect(res.body.booking.seats.length).toBe(2);
    expect(Number(res.body.booking.total_amount)).toBe(400);
    bookingA = res.body.booking;
    expect(await paymentStatus(orderA.orderId)).toBe("paid");
  });

  it("verify again returns the same booking", async () => {
    const payId = newPayId();
    const res = await verify(tokenA, orderA.orderId, payId, signPayment(orderA.orderId, payId));
    expect(res.statusCode).toBe(200);
    expect(res.body.booking.id).toBe(bookingA.id);
  });

  it("ticket email job is queued", async () => {
    const job = await getEmailQueue().getJob(`ticket-${bookingA.id}`);
    expect(job).toBeTruthy();
    expect(job.data.bookingId).toBe(bookingA.id);
    await job.remove().catch(() => {});
  });

  it("seat map shows booked seats", async () => {
    const seats = await seatMap();
    expect(seats.find((s) => s.id === S[0]).status).toBe("booked");
    expect(seats.find((s) => s.id === S[1]).status).toBe("booked");
  });
});

describe("Webhook", () => {
  it("rejects wrong signature", async () => {
    const res = await sendWebhook(capturedEvent("order_x", newPayId()), "bad".repeat(10));
    expect(res.statusCode).toBe(400);
  });

  it("creates booking from webhook alone", async () => {
    const h = await hold(tokenB, [S[2]]);
    expect(h.statusCode).toBe(201);

    const o = await createOrder(tokenB, h.body.hold.holdId);
    orderB = o.body.order;

    const res = await sendWebhook(capturedEvent(orderB.orderId, newPayId()));
    expect(res.statusCode).toBe(200);
    expect(await paymentStatus(orderB.orderId)).toBe("paid");

    const list = await request(app).get("/api/bookings").set(auth(tokenB));
    expect(list.body.items.length).toBe(1);
    bookingB = list.body.items[0];
  });

  it("same webhook again does not create a second booking", async () => {
    const res = await sendWebhook(capturedEvent(orderB.orderId, newPayId()));
    expect(res.statusCode).toBe(200);

    const list = await request(app).get("/api/bookings").set(auth(tokenB));
    expect(list.body.items.length).toBe(1);
  });

  it("ignores webhook for unknown order", async () => {
    const res = await sendWebhook(capturedEvent("order_unknown_123", newPayId()));
    expect(res.statusCode).toBe(200);
  });
});

describe("Refund", () => {
  it("refunds when seat was taken by someone else", async () => {
    // A holds seat and creates order
    const h = await hold(tokenA, [S[4]]);
    const o = await createOrder(tokenA, h.body.hold.holdId);
    const order = o.body.order;

    // Simulate hold expiry
    await redis.del(
      `hold:${h.body.hold.holdId}`,
      `userhold:${idA}:${showId}`,
      lockKey(S[4])
    );

    // B takes the same seat
    const hb = await hold(tokenB, [S[4]]);
    expect(hb.statusCode).toBe(201);
    const cb = await request(app)
      .post("/api/bookings/confirm")
      .set(auth(tokenB))
      .send({ holdId: hb.body.hold.holdId });
    expect(cb.statusCode).toBe(201);

    // A pays late
    const payId = newPayId();
    const res = await verify(tokenA, order.orderId, payId, signPayment(order.orderId, payId));
    expect(res.statusCode).toBe(409);
    expect(res.body.paymentStatus).toBe("refunded");
    expect(await paymentStatus(order.orderId)).toBe("refunded");
  });

  it("cancel booking refunds the payment", async () => {
    const res = await request(app)
      .post(`/api/bookings/${bookingB.id}/cancel`)
      .set(auth(tokenB));
    expect(res.statusCode).toBe(200);
    expect(res.body.booking.status).toBe("cancelled");
    expect(res.body.refund).toBe("refunded");
    expect(await paymentStatus(orderB.orderId)).toBe("refunded");
  });
});