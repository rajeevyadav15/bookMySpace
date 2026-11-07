const { z } = require("zod");

const createTheatreSchema = z.object({
  name: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(60),
  address: z.string().trim().min(5).max(300),
});

const createScreenSchema = z
  .object({
    name: z.string().trim().min(1).max(50),
    rows: z.number().int().min(1).max(26),
    seatsPerRow: z.number().int().min(1).max(30),
    premiumRows: z.number().int().min(0).max(26).optional(),
  })
  .refine((d) => (d.premiumRows ?? 0) <= d.rows, {
    message: "premiumRows cannot be more than rows",
    path: ["premiumRows"],
  });

const listTheatresQuerySchema = z.object({
  city: z.string().trim().min(2).max(60).optional(),
});

module.exports = {
  createTheatreSchema,
  createScreenSchema,
  listTheatresQuerySchema,
};