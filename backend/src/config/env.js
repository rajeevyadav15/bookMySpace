require("dotenv").config();

const nodeEnv = process.env.NODE_ENV || "development";
const paymentMode = process.env.PAYMENT_MODE || "razorpay";
const isMock = paymentMode === "mock";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is missing in .env");
}
if (!["mock", "razorpay"].includes(paymentMode)) {
  throw new Error("PAYMENT_MODE must be 'mock' or 'razorpay'");
}
// Mock mode allows free booking, so it must never run in production
if (isMock && nodeEnv === "production") {
  throw new Error("PAYMENT_MODE=mock is not allowed in production");
}
if (!isMock && nodeEnv !== "test") {
  for (const key of ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"]) {
    if (!process.env[key]) {
      throw new Error(`${key} is missing in .env (or set PAYMENT_MODE=mock)`);
    }
  }
}

module.exports = {
  port: process.env.PORT || 5000,
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  nodeEnv,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  seatHoldSeconds: Number(process.env.SEAT_HOLD_SECONDS) || 300,

  paymentMode,
  // Direct confirm (without payment) only for tests and mock mode
  allowDirectConfirm: nodeEnv === "test" || isMock,
  paymentHoldSeconds: Number(process.env.PAYMENT_HOLD_SECONDS) || 600,
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || (isMock ? "rzp_test_mock" : undefined),
  razorpayKeySecret:
    process.env.RAZORPAY_KEY_SECRET || (isMock ? "mock_key_secret" : undefined),
  razorpayWebhookSecret:
    process.env.RAZORPAY_WEBHOOK_SECRET || (isMock ? "mock_webhook_secret" : undefined),

  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  mailFrom: process.env.MAIL_FROM || "BookMySpace <no-reply@bookmyspace.local>",
};