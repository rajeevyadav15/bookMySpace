const pool = require("../config/db");
const redis = require("../config/redis");
const env = require("../config/env");
const cache = require("../utils/cache");

// Seed is for development. It must not run on a live database by mistake.
if (env.nodeEnv === "production" && !process.argv.includes("--force")) {
  console.error("Refusing to seed in production. Use --force if you really want to.");
  process.exit(1);
}

const CLEANING_BUFFER_MIN = 15;
// 4 hours apart, so even a 3 hour movie never overlaps the next show
const SLOTS = ["09:30", "13:30", "17:30", "21:30"];

const daysArg = process.argv.find((a) => /^\d+$/.test(a));
const DAYS = Math.min(Number(daysArg) || 7, 30);

const MOVIES = [
  {
    title: "Midnight Express",
    description: "A mystery on an overnight train where every passenger hides a secret.",
    durationMin: 138,
    language: "Hindi",
    genres: ["Thriller", "Mystery"],
    certificate: "UA",
    releaseDate: "2026-10-15",
  },
  {
    title: "Laugh Riot",
    description: "Three friends start a wedding planning business and everything goes wrong.",
    durationMin: 126,
    language: "Hindi",
    genres: ["Comedy", "Family"],
    certificate: "U",
    releaseDate: "2026-10-22",
  },
  {
    title: "Steel Horizon",
    description: "A rogue pilot must stop a sky fortress before it reaches the city.",
    durationMin: 152,
    language: "English",
    genres: ["Action", "Sci-Fi"],
    certificate: "UA",
    releaseDate: "2026-10-29",
  },
  {
    title: "Monsoon Letters",
    description: "Two strangers fall in love through letters during one long rainy season.",
    durationMin: 118,
    language: "Hindi",
    genres: ["Romance", "Drama"],
    certificate: "U",
    releaseDate: "2026-11-01",
  },
  {
    title: "Raja Vikram",
    description: "A fearless prince fights to win back his stolen kingdom.",
    durationMin: 165,
    language: "Telugu",
    genres: ["Action", "Drama"],
    certificate: "UA",
    releaseDate: "2026-11-03",
  },
  {
    title: "The Last Lighthouse",
    description: "A keeper discovers that the old lighthouse guards something from the sea.",
    durationMin: 112,
    language: "English",
    genres: ["Horror", "Thriller"],
    certificate: "A",
    releaseDate: "2026-11-05",
  },
  {
    title: "Chennai Nights",
    description: "A taxi driver gets pulled into one crazy night in the city.",
    durationMin: 134,
    language: "Tamil",
    genres: ["Crime", "Thriller"],
    certificate: "UA",
    releaseDate: "2026-11-06",
  },
  {
    title: "Little Explorers",
    description: "Four kids find a map in the attic and begin the adventure of their lives.",
    durationMin: 98,
    language: "English",
    genres: ["Animation", "Family", "Adventure"],
    certificate: "U",
    releaseDate: "2026-11-07",
  },
];

const THEATRES = [
  {
    name: "Galaxy Cinemas",
    city: "Raipur",
    address: "GE Road, Raipur",
    screens: [
      { name: "Screen 1", rows: 8, seatsPerRow: 12, premiumRows: 2, priceRegular: 200, pricePremium: 350 },
      { name: "Screen 2", rows: 6, seatsPerRow: 10, premiumRows: 1, priceRegular: 180, pricePremium: 300 },
      { name: "Screen 3", rows: 10, seatsPerRow: 14, premiumRows: 3, priceRegular: 250, pricePremium: 450 },
    ],
  },
  {
    name: "Star Multiplex",
    city: "Bhilai",
    address: "Nehru Nagar, Bhilai",
    screens: [
      { name: "Screen 1", rows: 7, seatsPerRow: 12, premiumRows: 2, priceRegular: 170, pricePremium: 280 },
      { name: "Screen 2", rows: 6, seatsPerRow: 10, premiumRows: 1, priceRegular: 150, pricePremium: 250 },
    ],
  },
  {
    name: "City Talkies",
    city: "Bilaspur",
    address: "Vyapar Vihar, Bilaspur",
    screens: [
      { name: "Screen 1", rows: 8, seatsPerRow: 10, premiumRows: 2, priceRegular: 160, pricePremium: 270 },
      { name: "Screen 2", rows: 5, seatsPerRow: 10, premiumRows: 1, priceRegular: 140, pricePremium: 240 },
    ],
  },
];

async function ensureMovie(m) {
  const found = await pool.query("SELECT id, duration_min FROM movies WHERE title = $1", [m.title]);
  if (found.rows[0]) return found.rows[0];

  const { rows } = await pool.query(
    `INSERT INTO movies (title, description, duration_min, language, genres, certificate, release_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, duration_min`,
    [m.title, m.description, m.durationMin, m.language, m.genres, m.certificate, m.releaseDate]
  );
  return rows[0];
}

async function ensureTheatre(t) {
  const found = await pool.query(
    "SELECT id FROM theatres WHERE name = $1 AND LOWER(city) = LOWER($2)",
    [t.name, t.city]
  );
  if (found.rows[0]) return found.rows[0].id;

  const { rows } = await pool.query(
    "INSERT INTO theatres (name, city, address) VALUES ($1, $2, $3) RETURNING id",
    [t.name, t.city, t.address]
  );
  return rows[0].id;
}

// Screen and its seats are created together in one transaction
async function ensureScreen(theatreId, s) {
  const found = await pool.query(
    "SELECT id FROM screens WHERE theatre_id = $1 AND name = $2",
    [theatreId, s.name]
  );
  if (found.rows[0]) return found.rows[0].id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const screen = await client.query(
      `INSERT INTO screens (theatre_id, name, rows_count, seats_per_row)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [theatreId, s.name, s.rows, s.seatsPerRow]
    );
    const screenId = screen.rows[0].id;

    await client.query(
      `INSERT INTO seats (screen_id, row_label, seat_number, seat_type)
       SELECT $1::uuid, chr(64 + r), n,
              CASE WHEN r > $2::int THEN 'premium' ELSE 'regular' END
       FROM generate_series(1, $3::int) AS r,
            generate_series(1, $4::int) AS n`,
      [screenId, s.rows - s.premiumRows, s.rows, s.seatsPerRow]
    );

    await client.query("COMMIT");
    return screenId;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// "YYYY-MM-DD" of (today + offset days) in India time
function istDate(offsetDays) {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

async function main() {
  const movies = [];
  for (const m of MOVIES) movies.push(await ensureMovie(m));

  const screens = [];
  for (const t of THEATRES) {
    const theatreId = await ensureTheatre(t);
    for (const s of t.screens) {
      screens.push({ ...s, id: await ensureScreen(theatreId, s) });
    }
  }

  let created = 0;
  let skipped = 0;

  for (let day = 1; day <= DAYS; day++) {
    const dateStr = istDate(day);

    for (let si = 0; si < screens.length; si++) {
      const screen = screens[si];

      for (let k = 0; k < SLOTS.length; k++) {
        // Rotation gives variety: different movies on different screens and days
        const movie = movies[(si * 3 + day * 2 + k) % movies.length];

        const start = new Date(`${dateStr}T${SLOTS[k]}:00+05:30`);
        const end = new Date(
          start.getTime() + (movie.duration_min + CLEANING_BUFFER_MIN) * 60 * 1000
        );

        // DO NOTHING also covers the overlap rule, so reruns are safe
        const res = await pool.query(
          `INSERT INTO shows (movie_id, screen_id, start_time, end_time, price_regular, price_premium)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT DO NOTHING`,
          [movie.id, screen.id, start, end, screen.priceRegular, screen.pricePremium]
        );

        if (res.rowCount) created++;
        else skipped++;
      }
    }
  }

  // Movie lists are cached for 60 seconds. Clear it so new movies show at once.
  await cache.delByPrefix("movies:");

  console.log(
    `Seed done: ${movies.length} movies, ${THEATRES.length} theatres, ${screens.length} screens`
  );
  console.log(`Shows for next ${DAYS} days: ${created} created, ${skipped} already existed`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
    redis.disconnect();
  });