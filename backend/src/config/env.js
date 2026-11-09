require("dotenv").config({ quiet: true });

const nodeEnv = process.env.NODE_ENV || "development";
const isProd = nodeEnv === "production";
const paymentMode = process.env.PAYMENT_MODE || "razorpay";
const isMock = paymentMode === "mock";
const allowDemoPayments = process.env.ALLOW_DEMO_PAYMENTS === "true";

const list = (value) =>
  (value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is missing in .env");
}
if (!["mock", "razorpay"].includes(paymentMode)) {
  throw new Error("PAYMENT_MODE must be 'mock' or 'razorpay'");
}
if (isProd && process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters in production");
}
if (isProd && list(process.env.CORS_ORIGIN).length === 0) {
  throw new Error("CORS_ORIGIN is required in production");
}
// Mock mode gives free tickets, so production needs an explicit demo flag
if (isMock && isProd && !allowDemoPayments) {
  throw new Error(
    "PAYMENT_MODE=mock in production needs ALLOW_DEMO_PAYMENTS=true (demo only)"
  );
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

  // Empty list in development means "allow any origin"
  corsOrigins: list(process.env.CORS_ORIGIN),
  // Number of proxies in front of the app (nginx = 1)
  trustProxy:
    process.env.TRUST_PROXY === undefined ? 1 : Number(process.env.TRUST_PROXY) || 0,

  paymentMode,
  allowDemoPayments,
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

  // AI (any OpenAI compatible provider: Gemini, Groq, OpenRouter...)
  aiApiKey: process.env.AI_API_KEY,
  aiBaseUrl:
    process.env.AI_BASE_URL ||
    "https://generativelanguage.googleapis.com/v1beta/openai/",
  aiModel: process.env.AI_MODEL || "gemini-3.1-flash-lite",
  aiFallbackModels: list(process.env.AI_FALLBACK_MODELS),
};
