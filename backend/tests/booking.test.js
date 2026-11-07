const crypto = require("crypto");
const request = require("supertest");
const app = require("../src/app");
const env = require("../src/config/env");
const pool = require("../src/config/db");
const redis = require("../src/config/redis");
const cache = require("../src/utils/cache");

jest.setTimeout(20000);

const stamp = Date.now();
const password = "Password123";
const emails = {
  admin: `badmin_${stamp}@example.com`,
  a: `usera_${stamp}@example.com`,
  b: `userb_${stamp}@example.com`,
};

let adminToken, tokenA, tokenB;
let movieId, theatreId, screenId, showId;
let S = []; // seat ids in order: A1..A4, B1..B4, C1..C4
let holdA, bookingA, bookingB;

const hoursFromNow = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString();
const lockKey = (seatId) => `seatlock:${showId}:${seatId}`;
const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function register(email) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: "Tester", email, password });
  return res.body.token;
}

async function login(email) {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.token;
}

const hold = (token, seatIds) =>
  request(app)
    .post("/api/bookings/hold")
    .set(auth(token))
    .send({ showId, seatIds });

const confirm = (token, holdId) =>
  request(app).post("/api/bookings/confirm").set(auth(token)).send({ holdId });

const cancel = (token, bookingId) =>
  request(app).post(`/api/bookings/${bookingId}/cancel`).set(auth(token));

async function seatMap() {
  const res = await request(app).get(`/api/shows/${showId}`);
  return res.body.seats;
}

const statusOf = (seats, id) => seats.find((s) => s.id === id).status;

beforeAll(async () => {
  tokenA = await register(emails.a);
  tokenB = await register(emails.b);
  await register(emails.admin);
  await pool.query("UPDATE users SET role = 'admin' WHERE email = $1", [emails.admin]);
  adminToken = await login(emails.admin);

  const movie = await request(app)
    .post("/api/movies")
    .set(auth(adminToken))
    .send({ title: `Booking Test ${stamp}`, durationMin: 120, language: "Hindi" });
  movieId = movie.body.movie.id;

  const theatre = await request(app)
    .post("/api/theatres")
    .set(auth(adminToken))
    .send({ name: "Booking Test Hall", city: "Raipur", address: "Test Road, Raipur" });
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
  await pool.query("DELETE FROM bookings WHERE show_id = $1", [showId]);
  await pool.query("DELETE FROM shows WHERE id = $1", [showId]);
  await pool.query("DELETE FROM theatres WHERE id = $1", [theatreId]);
  await pool.query("DELETE FROM movies WHERE id = $1", [movieId]);
  await pool.query("DELETE FROM users WHERE email = ANY($1)", [Object.values(emails)]);
  await cache.delByPrefix(`seatlock:${showId}:`);
  await cache.delByPrefix("movies:");
  await pool.end();
  redis.disconnect();
});

describe("Hold seats", () => {
  it("blocks hold without login", async () => {
    const res = await request(app)
      .post("/api/bookings/hold")
      .send({ showId, seatIds: [S[0]] });
    expect(res.statusCode).toBe(401);
  });

  it("rejects more than 6 seats", async () => {
    const seatIds = Array.from({ length: 7 }, () => crypto.randomUUID());
    const res = await hold(tokenA, seatIds);
    expect(res.statusCode).toBe(400);
  });

  it("rejects seat that is not in this show", async () => {
    const res = await hold(tokenA, [crypto.randomUUID()]);
    expect(res.statusCode).toBe(400);
  });

  it("holds 2 seats and returns total", async () => {
    const res = await hold(tokenA, [S[0], S[1]]);
    expect(res.statusCode).toBe(201);
    expect(res.body.hold.seats.length).toBe(2);
    expect(res.body.hold.totalAmount).toBe(400);
    holdA = res.body.hold.holdId;
  });

  it("lock in Redis has a TTL", async () => {
    const ttl = await redis.ttl(lockKey(S[0]));
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(env.seatHoldSeconds);
  });

  it("other user cannot hold the same seat", async () => {
    const res = await hold(tokenB, [S[1]]);
    expect(res.statusCode).toBe(409);
  });

  it("other user can hold a different seat", async () => {
    const res = await hold(tokenB, [S[2]]);
    expect(res.statusCode).toBe(201);
  });

  it("seat map shows held and available seats", async () => {
    const seats = await seatMap();
    expect(statusOf(seats, S[0])).toBe("held");
    expect(statusOf(seats, S[1])).toBe("held");
    expect(statusOf(seats, S[2])).toBe("held");
    expect(statusOf(seats, S[3])).toBe("available");
  });
});

describe("Confirm booking", () => {
  it("other user cannot confirm someone else's hold", async () => {
    const res = await confirm(tokenB, holdA);
    expect(res.statusCode).toBe(403);
  });

  it("owner confirms booking", async () => {
    const res = await confirm(tokenA, holdA);
    expect(res.statusCode).toBe(201);
    expect(res.body.booking.status).toBe("confirmed");
    expect(res.body.booking.seats.length).toBe(2);
    expect(Number(res.body.booking.total_amount)).toBe(400);
    bookingA = res.body.booking;
  });

  it("confirming again returns the same booking (idempotent)", async () => {
    const res = await confirm(tokenA, holdA);
    expect(res.statusCode).toBe(200);
    expect(res.body.booking.id).toBe(bookingA.id);
  });

  it("seat map shows booked seats", async () => {
    const seats = await seatMap();
    expect(statusOf(seats, S[0])).toBe("booked");
    expect(statusOf(seats, S[1])).toBe("booked");
  });

  it("cannot hold an already booked seat", async () => {
    const res = await hold(tokenB, [S[0]]);
    expect(res.statusCode).toBe(409);
  });

  it("expired hold returns 410", async () => {
    const h = await hold(tokenA, [S[8]]);
    expect(h.statusCode).toBe(201);
    await redis.del(`hold:${h.body.hold.holdId}`);

    const res = await confirm(tokenA, h.body.hold.holdId);
    expect(res.statusCode).toBe(410);
  });
});

describe("Race and release", () => {
  it("only one user wins when both hold the same seat together", async () => {
    const [ra, rb] = await Promise.all([
      hold(tokenA, [S[5]]),
      hold(tokenB, [S[5]]),
    ]);

    expect([ra.statusCode, rb.statusCode].sort()).toEqual([201, 409]);

    const winner = ra.statusCode === 201 ? { token: tokenA, res: ra } : { token: tokenB, res: rb };
    const del = await request(app)
      .delete(`/api/bookings/hold/${winner.res.body.hold.holdId}`)
      .set(auth(winner.token));
    expect(del.statusCode).toBe(200);
  });

  it("released hold can be taken by another user", async () => {
    const h = await hold(tokenA, [S[7]]);
    expect(h.statusCode).toBe(201);

    const del = await request(app)
      .delete(`/api/bookings/hold/${h.body.hold.holdId}`)
      .set(auth(tokenA));
    expect(del.statusCode).toBe(200);

    const h2 = await hold(tokenB, [S[7]]);
    expect(h2.statusCode).toBe(201);
  });

  it("keeps only one active hold per user per show", async () => {
    const h1 = await hold(tokenB, [S[2]]);
    expect(h1.statusCode).toBe(201);
    expect(await redis.get(lockKey(S[2]))).not.toBeNull();

    const h2 = await hold(tokenB, [S[3]]);
    expect(h2.statusCode).toBe(201);
    expect(await redis.get(lockKey(S[2]))).toBeNull();
    expect(await redis.get(lockKey(S[3]))).not.toBeNull();
  });
});

describe("My bookings and cancel", () => {
  it("lists my bookings", async () => {
    const res = await request(app).get("/api/bookings").set(auth(tokenA));
    expect(res.statusCode).toBe(200);
    expect(res.body.items.some((b) => b.id === bookingA.id)).toBe(true);
  });

  it("other user cannot see my booking", async () => {
    const res = await request(app)
      .get(`/api/bookings/${bookingA.id}`)
      .set(auth(tokenB));
    expect(res.statusCode).toBe(404);
  });

  it("other user cannot cancel my booking", async () => {
    const res = await cancel(tokenB, bookingA.id);
    expect(res.statusCode).toBe(404);
  });

  it("owner cancels booking", async () => {
    const res = await cancel(tokenA, bookingA.id);
    expect(res.statusCode).toBe(200);
    expect(res.body.booking.status).toBe("cancelled");
  });

  it("cancelling twice returns 409", async () => {
    const res = await cancel(tokenA, bookingA.id);
    expect(res.statusCode).toBe(409);
  });

  it("freed seat can be booked by another user", async () => {
    const h = await hold(tokenB, [S[0]]);
    expect(h.statusCode).toBe(201);

    const res = await confirm(tokenB, h.body.hold.holdId);
    expect(res.statusCode).toBe(201);
    bookingB = res.body.booking;
  });

  it("cannot cancel within 2 hours of show time", async () => {
    await pool.query(
      `UPDATE shows
       SET start_time = now() + interval '1 hour',
           end_time = now() + interval '3 hours'
       WHERE id = $1`,
      [showId]
    );

    const res = await cancel(tokenB, bookingB.id);
    expect(res.statusCode).toBe(400);
  });
});