const service = require("./payments.service");
const bookingService = require("../booking/booking.service");
const asyncHandler = require("../../utils/asyncHandler");

exports.createOrder = asyncHandler(async (req, res) => {
  const order = await service.createOrder(req.user.id, req.body.holdId);
  res.status(201).json({ success: true, order });
});

exports.verify = asyncHandler(async (req, res) => {
  const result = await service.verifyPayment(req.user.id, req.body);

  if (result.status !== "paid") {
    return res.status(409).json({
      success: false,
      message: "Seats were taken by someone else. Your payment is being refunded",
      paymentStatus: result.status,
    });
  }

  const booking = await bookingService.getById(result.bookingId, req.user);
  res.status(result.alreadyDone ? 200 : 201).json({ success: true, booking });
});

// Body is a raw Buffer here (see app.js)
exports.webhook = asyncHandler(async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
  await service.handleWebhook(rawBody, signature);
  res.json({ success: true });
});