const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const env = require("./config/env");
const pool = require("./config/db");
const redis = require("./config/redis");
const rateLimit = require("./middlewares/rateLimit");
const authRoutes = require("./modules/auth/auth.routes");
const movieRoutes = require("./modules/movies/movies.routes");
const theatreRoutes = require("./modules/theatres/theatres.routes");
const showRoutes = require("./modules/shows/shows.routes");
const bookingRoutes = require("./modules/booking/booking.routes");
const paymentRoutes = require("./modules/payments/payments.routes");
const aiRoutes = require("./modules/ai/ai.routes");
const { notFound, errorHandler } = require("./middlewares/errorHandler");

const app = express();

// Behind nginx or a cloud proxy, this gives the real user IP (needed for rate limit)
app.set("trust proxy", env.trustProxy);

app.use(helmet());
app.use(cors({ origin: env.corsOrigins.length ? env.corsOrigins : true }));
if (env.nodeEnv !== "test") {
  app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
}

// Liveness: is the process alive. No DB or Redis, so it never fails by mistake
app.get(["/live", "/api/live"], (req, res) => {
  res.json({ success: true, status: "ok" });
});

// Webhook needs the RAW body to check the signature.
// This line must come BEFORE express.json()
app.use("/api/payments/webhook", express.raw({ type: "application/json", limit: "1mb" }));
app.use(express.json({ limit: "100kb" }));

// Readiness: can the app really serve requests (DB and Redis reachable)
app.get(["/health", "/api/health"], async (req, res, next) => {
  try {
    await pool.query("SELECT 1");
    const pong = await redis.ping();
    res.json({ success: true, db: "ok", redis: pong });
  } catch (err) {
    next(err);
  }
});

// Limits are skipped in tests, because Redis keeps counters between test runs
if (env.nodeEnv !== "test") {
  app.use("/api", rateLimit({ name: "api", max: 600, windowSec: 900 }));

  // Stricter limit for password endpoints (brute force protection)
  const authLimit = rateLimit({ name: "auth", max: 20, windowSec: 900 });
  app.use("/api/auth/login", authLimit);
  app.use("/api/auth/register", authLimit);
}

app.use("/api/auth", authRoutes);
app.use("/api/movies", movieRoutes);
app.use("/api/theatres", theatreRoutes);
app.use("/api/shows", showRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/ai", aiRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;