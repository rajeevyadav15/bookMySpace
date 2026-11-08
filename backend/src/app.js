const express = require("express");
const cors = require("cors");
const aiRoutes = require("./modules/ai/ai.routes");
const helmet = require("helmet");
const morgan = require("morgan");
const pool = require("./config/db");
const redis = require("./config/redis");
const authRoutes = require("./modules/auth/auth.routes");
const movieRoutes = require("./modules/movies/movies.routes");
const theatreRoutes = require("./modules/theatres/theatres.routes");
const showRoutes = require("./modules/shows/shows.routes");
const bookingRoutes = require("./modules/booking/booking.routes");
const paymentRoutes = require("./modules/payments/payments.routes");
const { notFound, errorHandler } = require("./middlewares/errorHandler");

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));

// Webhook needs the RAW body to check the signature.
// This line must come BEFORE express.json()
app.use("/api/payments/webhook", express.raw({ type: "application/json", limit: "1mb" }));
app.use(express.json());

app.get("/health", async (req, res, next) => {
  try {
    await pool.query("SELECT 1");
    const pong = await redis.ping();
    res.json({ success: true, db: "ok", redis: pong });
  } catch (err) {
    next(err);
  }
});

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