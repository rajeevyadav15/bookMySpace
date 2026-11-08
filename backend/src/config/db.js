const { Pool, types } = require("pg");
const env = require("./env");

// Return DATE columns as plain "YYYY-MM-DD" text (no timezone shift)
types.setTypeParser(1082, (value) => value);

const pool = new Pool({ connectionString: env.databaseUrl });

module.exports = pool;