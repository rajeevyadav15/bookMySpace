const service = require("./movies.service");
const asyncHandler = require("../../utils/asyncHandler");

exports.list = asyncHandler(async (req, res) => {
  const data = await service.list(req.valid.query);
  res.json({ success: true, ...data });
});

exports.getOne = asyncHandler(async (req, res) => {
  const movie = await service.getById(req.params.id);
  res.json({ success: true, movie });
});

exports.create = asyncHandler(async (req, res) => {
  const movie = await service.create(req.body);
  res.status(201).json({ success: true, movie });
});

exports.update = asyncHandler(async (req, res) => {
  const movie = await service.update(req.params.id, req.body);
  res.json({ success: true, movie });
});

exports.remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id);
  res.json({ success: true, message: "Movie removed" });
});