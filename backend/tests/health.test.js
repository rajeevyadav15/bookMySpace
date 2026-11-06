const request = require("supertest");
const app = require("../src/app");
const pool = require("../src/config/db");
const redis = require("../src/config/redis");

afterAll(async () => {
  await pool.end();
  redis.disconnect();
});

describe("Health API", () => {
  it("should return ok for db and redis", async () => {
    const res = await request(app).get("/health");
    expect(res.statusCode).toBe(200);
    expect(res.body.db).toBe("ok");
    expect(res.body.redis).toBe("PONG");
  });

  it("should return 404 for unknown route", async () => {
    const res = await request(app).get("/abc");
    expect(res.statusCode).toBe(404);
  });
});