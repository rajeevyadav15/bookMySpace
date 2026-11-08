const service = require("./booking.service");
const paymentService = require("../payments/payments.service");
const env = require("../../config/env");
const ApiError = require("../../utils/ApiError");
const asyncHandler = require("../../utils/asyncHandler");

exports.hold = asyncHandler(async (req, res) => {
  const hold = await service.holdSeats(req.user.id, req.body);
  res.status(201).json({ success: true, hold });
});

exports.releaseHold = asyncHandler(async (req, res) => {
  await service.releaseHold(req.user.id, req.params.id);
  res.json({ success: true, message: "Hold released" });
});

// Without this guard anyone could get free tickets
exports.confirm = asyncHandler(async (req, res) => {
  if (!env.allowDirectConfirm) {
    throw new ApiError(403, "Direct confirm is disabled. Please pay first");
  }

  const { booking, replayed } = await service.confirmBooking(
    req.user.id,
    req.body.holdId
  );
  res.status(replayed ? 200 : 201).json({ success: true, booking });
});

exports.list = asyncHandler(async (req, res) => {
  const data = await service.listMine(req.user.id, req.valid.query);
  res.json({ success: true, ...data });
});

exports.getOne = asyncHandler(async (req, res) => {
  const booking = await service.getById(req.params.id, req.user);
  res.json({ success: true, booking });
});

exports.cancel = asyncHandler(async (req, res) => {
  const booking = await service.cancel(req.user, req.params.id);
  // Money goes back if this booking was paid
  const refund = await paymentService.refundForBooking(booking.id);
  res.json({ success: true, booking, refund });
});