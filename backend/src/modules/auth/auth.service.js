const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../../config/db");
const env = require("../../config/env");
const ApiError = require("../../utils/ApiError");

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

async function register({ name, email, password }) {
  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rowCount > 0) {
    throw new ApiError(409, "Email already registered");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, role, created_at`,
      [name, email, passwordHash]
    );
    const user = rows[0];
    return { user, token: signToken(user) };
  } catch (err) {
    // 23505 = unique violation (two requests at same time)
    if (err.code === "23505") throw new ApiError(409, "Email already registered");
    throw err;
  }
}

async function login({ email, password }) {
  const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  const user = rows[0];

  // Same message for both cases, so attacker cannot guess which emails exist
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new ApiError(401, "Invalid email or password");
  }

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    created_at: user.created_at,
  };

  return { user: safeUser, token: signToken(safeUser) };
}

async function getMe(userId) {
  const { rows } = await pool.query(
    "SELECT id, name, email, role, created_at FROM users WHERE id = $1",
    [userId]
  );
  if (!rows[0]) throw new ApiError(404, "User not found");
  return rows[0];
}

module.exports = { register, login, getMe };