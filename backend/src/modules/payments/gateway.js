const crypto = require("crypto");
const env = require("../../config/env");

let client;

function getClient() {
  if (!client) {
    const Razorpay = require("razorpay");
    client = new Razorpay({
      key_id: env.razorpayKeyId,
      key_secret: env.razorpayKeySecret,
    });
  }
  return client;
}

const isMock = () => env.paymentMode === "mock";

function hmac(secret, data) {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

// Timing safe compare, so attacker cannot guess signature slowly
function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

async function createOrder({ amountPaise, receipt }) {
  if (isMock()) {
    return {
      id: `order_mock_${crypto.randomBytes(8).toString("hex")}`,
      amount: amountPaise,
      currency: "INR",
    };
  }
  return getClient().orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt,
  });
}

async function refund(paymentId, amountPaise) {
  if (isMock()) {
    return { id: `rfnd_mock_${crypto.randomBytes(6).toString("hex")}` };
  }
  return getClient().payments.refund(paymentId, { amount: amountPaise });
}

// Razorpay rule: HMAC_SHA256(order_id + "|" + payment_id, key_secret)
function verifyPaymentSignature(orderId, paymentId, signature) {
  return safeEqual(
    hmac(env.razorpayKeySecret, `${orderId}|${paymentId}`),
    signature
  );
}

// Webhook rule: HMAC_SHA256(raw body, webhook_secret)
function verifyWebhookSignature(rawBody, signature) {
  if (!env.razorpayWebhookSecret) return false;
  return safeEqual(hmac(env.razorpayWebhookSecret, rawBody), signature);
}

module.exports = {
  createOrder,
  refund,
  verifyPaymentSignature,
  verifyWebhookSignature,
};