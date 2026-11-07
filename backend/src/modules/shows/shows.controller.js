const service = require("./shows.service");
const asyncHandler = require("../../utils/asyncHandler");

exports.create = asyncHandler(async (req, res) => {
  const show = await service.create(req.body);
  res.status(201).json({ success: true, show });
});

exports.list = asyncHandler(async (req, res) => {
  const shows = await service.list(req.valid.query);
  res.json({ success: true, shows });
});

exports.getOne = asyncHandler(async (req, res) => {
  const data = await service.getById(req.params.id);
  res.json({ success: true, ...data });
});