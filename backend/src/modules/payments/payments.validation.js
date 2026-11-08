const { z } = require("zod");

const createOrderSchema = z.object({
  holdId: z.uuid(),
});

const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().trim().min(5).max(100),
  razorpayPaymentId: z.string().trim().min(5).max(100),
  razorpaySignature: z.string().trim().min(10).max(200),
});

module.exports = { createOrderSchema, verifyPaymentSchema };