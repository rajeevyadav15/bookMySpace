const { z } = require("zod");

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const createMovieSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(3000).optional(),
  durationMin: z.number().int().min(1).max(600),
  language: z.string().trim().min(2).max(30),
  genres: z.array(z.string().trim().min(1).max(30)).max(6).optional(),
  certificate: z.enum(["U", "UA", "A", "S"]).optional(),
  releaseDate: z.string().regex(dateRegex, "Use YYYY-MM-DD").optional(),
  posterUrl: z.string().url().optional(),
});

const updateMovieSchema = createMovieSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field is required",
  });

const listMoviesQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  language: z.string().trim().min(1).max(30).optional(),
  genre: z.string().trim().min(1).max(30).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

module.exports = { createMovieSchema, updateMovieSchema, listMoviesQuerySchema };