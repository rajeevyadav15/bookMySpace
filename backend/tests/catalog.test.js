const request = require("supertest");
const app = require("../src/app");
const pool = require("../src/config/db");
const redis = require("../src/config/redis");
const cache = require("../src/utils/cache");

const stamp = Date.now();
const adminEmail = `admin_${stamp}@example.com`;
const userEmail = `user_${stamp}@example.com`;
const password = "Password123";
const title = `Test Movie ${stamp}`;

let adminToken, userToken;
let movieId, theatreId, screenId, showId;

const hoursFromNow = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString();

async function register(email) {
  await request(app)
    .post("/api/auth/register")
    .send({ name: "Tester", email, password });
}

async function login(email) {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.token;
}

beforeAll(async () => {
  await register(adminEmail);
  await register(userEmail);
  await pool.query("UPDATE users SET role = 'admin' WHERE email = $1", [adminEmail]);
  // Login after role change, so the token has role = admin
  adminToken = await login(adminEmail);
  userToken = await login(userEmail);
});

afterAll(async () => {
  if (screenId) await pool.query("DELETE FROM shows WHERE screen_id = $1", [screenId]);
  if (theatreId) await pool.query("DELETE FROM theatres WHERE id = $1", [theatreId]);
  if (movieId) await pool.query("DELETE FROM movies WHERE id = $1", [movieId]);
  await pool.query("DELETE FROM users WHERE email IN ($1, $2)", [adminEmail, userEmail]);
  await cache.delByPrefix("movies:");
  await pool.end();
  redis.disconnect();
});

describe("Movies", () => {
  it("blocks normal user from creating movie", async () => {
    const res = await request(app)
      .post("/api/movies")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ title, durationMin: 120, language: "Hindi" });
    expect(res.statusCode).toBe(403);
  });

  it("blocks request without token", async () => {
    const res = await request(app)
      .post("/api/movies")
      .send({ title, durationMin: 120, language: "Hindi" });
    expect(res.statusCode).toBe(401);
  });

  it("rejects invalid body", async () => {
    const res = await request(app)
      .post("/api/movies")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "", durationMin: -5 });
    expect(res.statusCode).toBe(400);
  });

  it("admin creates movie", async () => {
    const res = await request(app)
      .post("/api/movies")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title,
        description: "Test description",
        durationMin: 120,
        language: "Hindi",
        genres: ["Action", "Drama"],
        certificate: "UA",
        releaseDate: "2026-11-01",
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.movie.title).toBe(title);
    movieId = res.body.movie.id;
  });

  it("lists movies with search", async () => {
    const res = await request(app).get(`/api/movies?q=${encodeURIComponent(title)}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].id).toBe(movieId);
  });

  it("gets movie by id", async () => {
    const res = await request(app).get(`/api/movies/${movieId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.movie.title).toBe(title);
  });

  it("rejects invalid uuid", async () => {
    const res = await request(app).get("/api/movies/abc");
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 for unknown movie", async () => {
    const res = await request(app).get(
      "/api/movies/00000000-0000-0000-0000-000000000000"
    );
    expect(res.statusCode).toBe(404);
  });

  it("updates movie", async () => {
    const res = await request(app)
      .put(`/api/movies/${movieId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ durationMin: 130 });
    expect(res.statusCode).toBe(200);
    expect(res.body.movie.duration_min).toBe(130);
  });
});

describe("Theatres and screens", () => {
  it("creates theatre", async () => {
    const res = await request(app)
      .post("/api/theatres")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "PVR Test", city: "Raipur", address: "Test Road, Raipur" });
    expect(res.statusCode).toBe(201);
    theatreId = res.body.theatre.id;
  });

  it("creates screen with 12 seats", async () => {
    const res = await request(app)
      .post(`/api/theatres/${theatreId}/screens`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Screen 1", rows: 3, seatsPerRow: 4, premiumRows: 1 });
    expect(res.statusCode).toBe(201);
    expect(res.body.screen.total_seats).toBe(12);
    screenId = res.body.screen.id;
  });
});

describe("Shows", () => {
  it("creates show", async () => {
    const res = await request(app)
      .post("/api/shows")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        movieId,
        screenId,
        startTime: hoursFromNow(24),
        priceRegular: 200,
        pricePremium: 300,
      });
    expect(res.statusCode).toBe(201);
    showId = res.body.show.id;
  });

  it("rejects overlapping show on same screen", async () => {
    const res = await request(app)
      .post("/api/shows")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        movieId,
        screenId,
        startTime: hoursFromNow(25),
        priceRegular: 200,
        pricePremium: 300,
      });
    expect(res.statusCode).toBe(409);
  });

  it("rejects show in the past", async () => {
    const res = await request(app)
      .post("/api/shows")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        movieId,
        screenId,
        startTime: hoursFromNow(-5),
        priceRegular: 200,
        pricePremium: 300,
      });
    expect(res.statusCode).toBe(400);
  });

  it("returns seat map with prices", async () => {
    const res = await request(app).get(`/api/shows/${showId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.seats.length).toBe(12);

    const premium = res.body.seats.filter((s) => s.seat_type === "premium");
    expect(premium.length).toBe(4);
    expect(Number(premium[0].price)).toBe(300);
  });

  it("lists shows by movie", async () => {
    const res = await request(app).get(`/api/shows?movieId=${movieId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.shows.length).toBe(1);
    expect(res.body.shows[0].city).toBe("Raipur");
  });
});

describe("Movie delete", () => {
  it("soft deletes movie", async () => {
    const res = await request(app)
      .delete(`/api/movies/${movieId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
  });

  it("deleted movie returns 404", async () => {
    const res = await request(app).get(`/api/movies/${movieId}`);
    expect(res.statusCode).toBe(404);
  });
});