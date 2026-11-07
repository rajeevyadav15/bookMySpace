const service = require("./booking.service");
const asyncHandler = require("../../utils/asyncHandler");

exports.hold = asyncHandler(async (req, res) => {
  const hold = await service.holdSeats(req.user.id, req.body);
  res.status(201).json({ success: true, hold });
});

exports.releaseHold = asyncHandler(async (req, res) => {
  await service.releaseHold(req.user.id, req.params.id);
  res.json({ success: true, message: "Hold released" });
});

exports.confirm = asyncHandler(async (req, res) => {
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
  res.json({ success: true, booking });
});