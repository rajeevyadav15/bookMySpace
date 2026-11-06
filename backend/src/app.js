const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const pool = require("./config/db");
const redis = require("./config/redis");
const { notFound, errorHandler } = require("./middlewares/errorHandler");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Health check: checks DB and Redis both
app.get("/health", async (req, res, next) => {
  try {
    await pool.query("SELECT 1");
    const pong = await redis.ping();
    res.json({ success: true, db: "ok", redis: pong });
  } catch (err) {
    next(err);
  }
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
