const pool = require("../../config/db");
const ApiError = require("../../utils/ApiError");

const CLEANING_BUFFER_MIN = 15; // gap after movie for cleaning

async function create({ movieId, screenId, startTime, priceRegular, pricePremium }) {
  const start = new Date(startTime);
  if (start <= new Date()) {
    throw new ApiError(400, "Show time must be in the future");
  }

  const movie = await pool.query(
    "SELECT duration_min FROM movies WHERE id = $1 AND is_active = TRUE",
    [movieId]
  );
  if (!movie.rowCount) throw new ApiError(404, "Movie not found");

  const screen = await pool.query("SELECT id FROM screens WHERE id = $1", [screenId]);
  if (!screen.rowCount) throw new ApiError(404, "Screen not found");

  const totalMin = movie.rows[0].duration_min + CLEANING_BUFFER_MIN;
  const end = new Date(start.getTime() + totalMin * 60 * 1000);

  try {
    const { rows } = await pool.query(
      `INSERT INTO shows (movie_id, screen_id, start_time, end_time, price_regular, price_premium)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [movieId, screenId, start, end, priceRegular, pricePremium]
    );
    return rows[0];
  } catch (err) {
    // 23P01 = exclusion violation (time overlap on same screen)
    if (err.code === "23P01") {
      throw new ApiError(409, "Screen is already booked for this time");
    }
    throw err;
  }
}

async function list({ movieId, city, date }) {
  const where = ["s.start_time > now()"];
  const params = [];

  if (movieId) {
    params.push(movieId);
    where.push(`s.movie_id = $${params.length}`);
  }
  if (city) {
    params.push(city);
    where.push(`LOWER(t.city) = LOWER($${params.length})`);
  }
  if (date) {
    params.push(date);
    where.push(
      `(s.start_time AT TIME ZONE 'Asia/Kolkata')::date = $${params.length}::date`
    );
  }

  const { rows } = await pool.query(
    `SELECT s.id, s.start_time, s.end_time, s.price_regular, s.price_premium,
            m.id AS movie_id, m.title AS movie_title,
            sc.id AS screen_id, sc.name AS screen_name,
            t.id AS theatre_id, t.name AS theatre_name, t.city
     FROM shows s
     JOIN movies m ON m.id = s.movie_id
     JOIN screens sc ON sc.id = s.screen_id
     JOIN theatres t ON t.id = sc.theatre_id
     WHERE ${where.join(" AND ")}
     ORDER BY s.start_time
     LIMIT 100`,
    params
  );
  return rows;
}

// Show details + full seat map with price per seat
async function getById(id) {
  const showRes = await pool.query(
    `SELECT s.id, s.start_time, s.end_time, s.price_regular, s.price_premium,
            m.id AS movie_id, m.title AS movie_title,
            sc.id AS screen_id, sc.name AS screen_name,
            t.id AS theatre_id, t.name AS theatre_name, t.city
     FROM shows s
     JOIN movies m ON m.id = s.movie_id
     JOIN screens sc ON sc.id = s.screen_id
     JOIN theatres t ON t.id = sc.theatre_id
     WHERE s.id = $1`,
    [id]
  );
  if (!showRes.rows[0]) throw new ApiError(404, "Show not found");

  const seatsRes = await pool.query(
    `SELECT seat.id, seat.row_label, seat.seat_number, seat.seat_type,
            CASE WHEN seat.seat_type = 'premium'
                 THEN s.price_premium ELSE s.price_regular END AS price
     FROM seats seat
     JOIN shows s ON s.screen_id = seat.screen_id
     WHERE s.id = $1
     ORDER BY seat.row_label, seat.seat_number`,
    [id]
  );

  return { show: showRes.rows[0], seats: seatsRes.rows };
}

module.exports = { create, list, getById };