const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const pool = require("./config/db");
const redis = require("./config/redis");
const authRoutes = require("./modules/auth/auth.routes");
const movieRoutes = require("./modules/movies/movies.routes");
const theatreRoutes = require("./modules/theatres/theatres.routes");
const showRoutes = require("./modules/shows/shows.routes");
const { notFound, errorHandler } = require("./middlewares/errorHandler");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

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

app.use(notFound);
app.use(errorHandler);

module.exports = app;