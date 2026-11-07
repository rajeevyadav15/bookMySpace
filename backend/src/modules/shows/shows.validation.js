const { z } = require("zod");

const createShowSchema = z.object({
  movieId: z.string().uuid(),
  screenId: z.string().uuid(),
  startTime: z.string().datetime({ offset: true }),
  priceRegular: z.number().min(0).max(10000),
  pricePremium: z.number().min(0).max(10000),
});

const listShowsQuerySchema = z.object({
  movieId: z.string().uuid().optional(),
  city: z.string().trim().min(2).max(60).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional(),
});

module.exports = { createShowSchema, listShowsQuerySchema };