const pool = require("../../config/db");
const ApiError = require("../../utils/ApiError");
const cache = require("../../utils/cache");

const LIST_TTL = 60; // seconds
const ONE_TTL = 300;

// Only these columns can be updated (safe, no user input in column names)
const COLUMNS = {
  title: "title",
  description: "description",
  durationMin: "duration_min",
  language: "language",
  genres: "genres",
  certificate: "certificate",
  releaseDate: "release_date",
  posterUrl: "poster_url",
  isActive: "is_active",
};

async function list({ q, language, genre, page, limit }) {
  const key = `movies:list:${JSON.stringify({ q, language, genre, page, limit })}`;
  const cached = await cache.getJson(key);
  if (cached) return cached;

  const where = ["is_active = TRUE"];
  const params = [];

  if (q) {
    params.push(`%${q}%`);
    where.push(`title ILIKE $${params.length}`);
  }
  if (language) {
    params.push(language);
    where.push(`LOWER(language) = LOWER($${params.length})`);
  }
  if (genre) {
    params.push(genre);
    where.push(
      `EXISTS (SELECT 1 FROM unnest(genres) g WHERE LOWER(g) = LOWER($${params.length}))`
    );
  }

  const whereSql = where.join(" AND ");

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS total FROM movies WHERE ${whereSql}`,
    params
  );

  const offset = (page - 1) * limit;
  const itemsRes = await pool.query(
    `SELECT * FROM movies
     WHERE ${whereSql}
     ORDER BY release_date DESC NULLS LAST, created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const result = {
    items: itemsRes.rows,
    page,
    limit,
    total: countRes.rows[0].total,
  };

  await cache.setJson(key, result, LIST_TTL);
  return result;
}

async function getById(id) {
  const key = `movies:one:${id}`;
  const cached = await cache.getJson(key);
  if (cached) return cached;

  const { rows } = await pool.query(
    "SELECT * FROM movies WHERE id = $1 AND is_active = TRUE",
    [id]
  );
  if (!rows[0]) throw new ApiError(404, "Movie not found");

  await cache.setJson(key, rows[0], ONE_TTL);
  return rows[0];
}

async function create(data) {
  const { rows } = await pool.query(
    `INSERT INTO movies
      (title, description, duration_min, language, genres, certificate, release_date, poster_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      data.title,
      data.description ?? null,
      data.durationMin,
      data.language,
      data.genres ?? [],
      data.certificate ?? null,
      data.releaseDate ?? null,
      data.posterUrl ?? null,
    ]
  );

  await cache.delByPrefix("movies:");
  return rows[0];
}

async function update(id, data) {
  const sets = [];
  const params = [];

  for (const [key, column] of Object.entries(COLUMNS)) {
    if (data[key] !== undefined) {
      params.push(data[key]);
      sets.push(`${column} = $${params.length}`);
    }
  }

  params.push(id);
  const { rows } = await pool.query(
    `UPDATE movies SET ${sets.join(", ")}, updated_at = now()
     WHERE id = $${params.length}
     RETURNING *`,
    params
  );
  if (!rows[0]) throw new ApiError(404, "Movie not found");

  await cache.delByPrefix("movies:");
  return rows[0];
}

// Soft delete: row stays, only hidden
async function remove(id) {
  const { rowCount } = await pool.query(
    "UPDATE movies SET is_active = FALSE, updated_at = now() WHERE id = $1 AND is_active = TRUE",
    [id]
  );
  if (!rowCount) throw new ApiError(404, "Movie not found");

  await cache.delByPrefix("movies:");
}

module.exports = { list, getById, create, update, remove };