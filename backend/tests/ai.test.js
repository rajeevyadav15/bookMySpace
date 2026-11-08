const crypto = require("crypto");
const request = require("supertest");
const app = require("../src/app");
const pool = require("../src/config/db");
const redis = require("../src/config/redis");
const cache = require("../src/utils/cache");
const llm = require("../src/modules/ai/llm");

jest.setTimeout(20000);

const stamp = Date.now();
const password = "Password123";
const emails = {
  admin: `aadmin_${stamp}@example.com`,
  a: `aia_${stamp}@example.com`,
  b: `aib_${stamp}@example.com`,
};
const title = `AI Test Movie ${stamp}`;

let adminToken, tokenA, tokenB, idA, idB;
let movieId, theatreId, screenId, showId;
let createSpy;

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const hoursFromNow = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString();

const usage = { prompt_tokens: 10, completion_tokens: 5 };
const toolUse = (name, input, id = "call_test_1") => ({
  choices: [
    {
      finish_reason: "tool_calls",
      message: {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id,
            type: "function",
            function: { name, arguments: JSON.stringify(input) },
          },
        ],
      },
    },
  ],
  usage,
});
const textReply = (text) => ({
  choices: [
    { finish_reason: "stop", message: { role: "assistant", content: text } },
  ],
  usage,
});

const userMsg = (content) => ({ role: "user", content });
const chat = (token, messages) =>
  request(app).post("/api/ai/chat").set(auth(token)).send({ messages });
const recommendations = (token) =>
  request(app).get("/api/ai/recommendations").set(auth(token));

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

beforeAll(async () => {
  const a = await register(emails.a);
  tokenA = a.token;
  idA = a.user.id;
  const b = await register(emails.b);
  tokenB = b.token;
  idB = b.user.id;

  await register(emails.admin);
  await pool.query("UPDATE users SET role = 'admin' WHERE email = $1", [emails.admin]);
  adminToken = await login(emails.admin);

  // Far future release date, so this movie is always in top candidates
  const movie = await request(app)
    .post("/api/movies")
    .set(auth(adminToken))
    .send({
      title,
      durationMin: 120,
      language: "Hindi",
      genres: ["Action"],
      releaseDate: "2099-12-31",
    });
  movieId = movie.body.movie.id;

  const theatre = await request(app)
    .post("/api/theatres")
    .set(auth(adminToken))
    .send({ name: "AI Test Hall", city: "Raipur", address: "Test Road, Raipur" });
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
});

afterAll(async () => {
  await pool.query("DELETE FROM shows WHERE id = $1", [showId]);
  await pool.query("DELETE FROM theatres WHERE id = $1", [theatreId]);
  await pool.query("DELETE FROM movies WHERE id = $1", [movieId]);
  await pool.query("DELETE FROM users WHERE email = ANY($1)", [Object.values(emails)]);
  await redis.del(
    `ai:rec:${idA}`,
    `ai:rec:${idB}`,
    `rl:ai-chat:${idA}`,
    `rl:ai-chat:${idB}`,
    `rl:ai-rec:${idA}`,
    `rl:ai-rec:${idB}`
  );
  await cache.delByPrefix("movies:");
  await pool.end();
  redis.disconnect();
});

beforeEach(() => {
  jest.spyOn(llm, "isConfigured").mockReturnValue(true);
  // Any AI call without a planned answer fails, so tests stay honest
  createSpy = jest
    .spyOn(llm, "createMessage")
    .mockRejectedValue(new Error("unexpected AI call"));
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("AI chat", () => {
  it("blocks chat without login", async () => {
    const res = await request(app)
      .post("/api/ai/chat")
      .send({ messages: [userMsg("hi")] });
    expect(res.statusCode).toBe(401);
  });

  it("rejects when last message is not from user", async () => {
    const res = await chat(tokenA, [
      userMsg("hi"),
      { role: "assistant", content: "hello" },
    ]);
    expect(res.statusCode).toBe(400);
  });

  it("returns 503 when AI is not configured", async () => {
    llm.isConfigured.mockReturnValue(false);
    const res = await chat(tokenA, [userMsg("hi")]);
    expect(res.statusCode).toBe(503);
  });

  it("answers using a tool", async () => {
    createSpy
      .mockResolvedValueOnce(toolUse("search_movies", { query: title }))
      .mockResolvedValueOnce(textReply("Found it"));

    const res = await chat(tokenA, [userMsg(`find ${title}`)]);

    expect(res.statusCode).toBe(200);
    expect(res.body.reply).toBe("Found it");
    expect(res.body.toolsUsed).toEqual(["search_movies"]);

    // Second AI call must contain the real DB result
        const last = createSpy.mock.calls[1][0].messages.at(-1);
    expect(last.role).toBe("tool");
    expect(last.content).toContain(title);
  });

  it("sends tool error back to AI for bad input", async () => {
    createSpy
      .mockResolvedValueOnce(toolUse("check_availability", { show_id: "abc" }))
      .mockResolvedValueOnce(textReply("Sorry, I could not check"));

    const res = await chat(tokenA, [userMsg("seats?")]);

    expect(res.statusCode).toBe(200);
      const last = createSpy.mock.calls[1][0].messages.at(-1);
    expect(last.role).toBe("tool");
    expect(last.content).toContain("Invalid input");
  });

  it("stops after max tool steps", async () => {
    createSpy.mockResolvedValue(toolUse("search_movies", { query: title }));

    const res = await chat(tokenA, [userMsg("loop")]);

    expect(res.statusCode).toBe(200);
    expect(res.body.reply).toContain("too many steps");
    expect(createSpy).toHaveBeenCalledTimes(5);
    expect(res.body.toolsUsed.length).toBe(5);
  });

  it("returns 502 when AI service fails", async () => {
    const res = await chat(tokenA, [userMsg("hi")]);
    expect(res.statusCode).toBe(502);
  });

  it("blocks after rate limit", async () => {
    await redis.set(`rl:ai-chat:${idB}`, 20, "EX", 60);

    const res = await chat(tokenB, [userMsg("hi")]);

    expect(res.statusCode).toBe(429);
    expect(res.headers["retry-after"]).toBeDefined();
    expect(createSpy).not.toHaveBeenCalled();
    await redis.del(`rl:ai-chat:${idB}`);
  });
});

describe("AI recommendations", () => {
  it("blocks recommendations without login", async () => {
    const res = await request(app).get("/api/ai/recommendations");
    expect(res.statusCode).toBe(401);
  });

  it("returns AI picks and drops fake ids", async () => {
    createSpy.mockResolvedValueOnce(
      toolUse("submit_recommendations", {
        picks: [
          { movie_id: movieId, reason: "Great action movie" },
          { movie_id: crypto.randomUUID(), reason: "This movie does not exist" },
        ],
      })
    );

    const res = await recommendations(tokenA);

    expect(res.statusCode).toBe(200);
    expect(res.body.source).toBe("ai");
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].movie.id).toBe(movieId);
    expect(res.body.items[0].reason).toBe("Great action movie");
  });

  it("falls back when AI fails", async () => {
    const res = await recommendations(tokenB);

    expect(res.statusCode).toBe(200);
    expect(res.body.source).toBe("fallback");
    expect(res.body.items.length).toBeLessThanOrEqual(5);
    expect(res.body.items.some((i) => i.movie.id === movieId)).toBe(true);
  });
});