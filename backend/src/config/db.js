const { Pool, types } = require("pg");
const env = require("./env");

// Return DATE columns as plain "YYYY-MM-DD" text (no timezone shift)
types.setTypeParser(1082, (value) => value);

const pool = new Pool({
  connectionString: env.databaseUrl,
  max: Number(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Without this handler an idle connection error would crash the whole app
pool.on("error", (err) => {
  console.error("Postgres pool error:", err.message);
});

module.exports = pool;