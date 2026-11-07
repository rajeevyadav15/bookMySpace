const { z } = require("zod");

const holdSchema = z
  .object({
    showId: z.uuid(),
    seatIds: z.array(z.uuid()).min(1).max(6),
  })
  .refine((d) => new Set(d.seatIds).size === d.seatIds.length, {
    message: "Duplicate seats are not allowed",
    path: ["seatIds"],
  });

const confirmSchema = z.object({
  holdId: z.uuid(),
});

const listBookingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

module.exports = { holdSchema, confirmSchema, listBookingsQuerySchema };