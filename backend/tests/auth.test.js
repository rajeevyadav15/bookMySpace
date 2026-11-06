const request = require("supertest");
const app = require("../src/app");
const pool = require("../src/config/db");
const redis = require("../src/config/redis");

const email = `test_${Date.now()}@example.com`;
const password = "Password123";
let token;

afterAll(async () => {
  await pool.query("DELETE FROM users WHERE email = $1", [email]);
  await pool.end();
  redis.disconnect();
});

describe("Auth API", () => {
  it("registers a new user", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test User", email, password });

    expect(res.statusCode).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it("rejects duplicate email", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test User", email, password });

    expect(res.statusCode).toBe(409);
  });

  it("rejects invalid email", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test User", email: "abc", password });

    expect(res.statusCode).toBe(400);
  });

  it("rejects short password", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test User", email: "short@example.com", password: "123" });

    expect(res.statusCode).toBe(400);
  });

  it("logs in with correct password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password });

    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
    token = res.body.token;
  });

  it("rejects wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "WrongPass999" });

    expect(res.statusCode).toBe(401);
  });

  it("blocks /me without token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.statusCode).toBe(401);
  });

  it("returns profile with token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.user.email).toBe(email);
  });
});