const request = require("supertest");
const app = require("../src/app");
const pool = require("../src/config/db");
const redis = require("../src/config/redis");

afterAll(async () => {
  await pool.end();
  redis.disconnect();
});

describe("Health and security", () => {
  it("live endpoint works", async () => {
    const res = await request(app).get("/live");
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("health works under /api too", async () => {
    const res = await request(app).get("/api/health");
    expect(res.statusCode).toBe(200);
    expect(res.body.db).toBe("ok");
    expect(res.body.redis).toBe("PONG");
  });

  it("hides x-powered-by header", async () => {
    const res = await request(app).get("/live");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("sets security headers", async () => {
    const res = await request(app).get("/live");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("rejects a very large body", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "a@b.com", password: "x".repeat(150000) });
    expect(res.statusCode).toBe(413);
  });
});