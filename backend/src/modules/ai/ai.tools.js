const { z } = require("zod");
const ApiError = require("../../utils/ApiError");
const moviesService = require("../movies/movies.service");
const showsService = require("../shows/shows.service");

// Only READ tools. The chatbot cannot book, pay or see any user data.
const tools = [
  {
    name: "search_movies",
    description:
      "Search movies that are currently listed. Use it for questions about movies, genres or languages.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Part of the movie title" },
        language: { type: "string", description: "For example Hindi, English" },
        genre: { type: "string", description: "For example Action, Comedy" },
      },
    },
  },
  {
    name: "find_shows",
    description:
      "Find upcoming shows with theatre, time and price. Filter by movie_id, city and date (YYYY-MM-DD).",
    input_schema: {
      type: "object",
      properties: {
        movie_id: { type: "string", description: "Movie id from search_movies" },
        city: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
      },
    },
  },
  {
    name: "check_availability",
    description: "Check how many seats are available for one show.",
    input_schema: {
      type: "object",
      properties: {
        show_id: { type: "string", description: "Show id from find_shows" },
      },
      required: ["show_id"],
    },
  },
];

// Model can send empty strings or null. Remove them before validation.
const clean = (input) =>
  Object.fromEntries(
    Object.entries(input && typeof input === "object" ? input : {}).filter(
      ([, v]) => v !== "" && v !== null && v !== undefined
    )
  );

const text = (max) => z.string().trim().min(1).max(max);

// AI output is untrusted input, so we validate it like user input
const schemas = {
  search_movies: z.object({
    query: text(100).optional(),
    language: text(30).optional(),
    genre: text(30).optional(),
  }),
  find_shows: z.object({
    movie_id: z.uuid().optional(),
    city: text(60).optional(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  }),
  check_availability: z.object({
    show_id: z.uuid(),
  }),
};

const formatIst = (value) =>
  new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

const handlers = {
  async search_movies(input) {
    const data = await moviesService.list({
      q: input.query,
      language: input.language,
      genre: input.genre,
      page: 1,
      limit: 5,
    });

    return {
      total: data.total,
      movies: data.items.map((m) => ({
        id: m.id,
        title: m.title,
        language: m.language,
        genres: m.genres,
        certificate: m.certificate,
        duration_min: m.duration_min,
        release_date: m.release_date,
      })),
    };
  },

  async find_shows(input) {
    const shows = await showsService.list({
      movieId: input.movie_id,
      city: input.city,
      date: input.date,
    });

    // Keep result small, it costs tokens
    return {
      count: shows.length,
      shows: shows.slice(0, 10).map((s) => ({
        show_id: s.id,
        movie: s.movie_title,
        theatre: s.theatre_name,
        city: s.city,
        screen: s.screen_name,
        start_time: formatIst(s.start_time),
        price_regular: Number(s.price_regular),
        price_premium: Number(s.price_premium),
      })),
    };
  },

  async check_availability(input) {
    const { show, seats } = await showsService.getById(input.show_id);
    const count = (status, type) =>
      seats.filter((s) => s.status === status && (!type || s.seat_type === type))
        .length;

    const available = count("available");

    return {
      movie: show.movie_title,
      theatre: show.theatre_name,
      start_time: formatIst(show.start_time),
      total_seats: seats.length,
      available_seats: available,
      available_regular: count("available", "regular"),
      available_premium: count("available", "premium"),
      sold_out: available === 0,
    };
  },
};

async function executeTool(name, rawInput) {
  const schema = schemas[name];
  if (!schema) return { ok: false, error: `Unknown tool: ${name}` };

  const parsed = schema.safeParse(clean(rawInput));
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".")} ${i.message}`)
      .join(", ");
    return { ok: false, error: `Invalid input: ${detail}` };
  }

  try {
    return { ok: true, data: await handlers[name](parsed.data) };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    console.error("tool failed:", name, err.message);
    return { ok: false, error: "Tool failed. Try again later" };
  }
}

const openaiTools = tools.map((t) => ({
  type: "function",
  function: {
    name: t.name,
    description: t.description,
    parameters: t.input_schema,
  },
}));

module.exports = { tools: openaiTools, executeTool };