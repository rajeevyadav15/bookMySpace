const service = require("./theatres.service");
const asyncHandler = require("../../utils/asyncHandler");

exports.create = asyncHandler(async (req, res) => {
  const theatre = await service.createTheatre(req.body);
  res.status(201).json({ success: true, theatre });
});

exports.list = asyncHandler(async (req, res) => {
  const theatres = await service.listTheatres(req.valid.query);
  res.json({ success: true, theatres });
});

exports.getOne = asyncHandler(async (req, res) => {
  const theatre = await service.getTheatre(req.params.id);
  res.json({ success: true, theatre });
});

exports.createScreen = asyncHandler(async (req, res) => {
  const screen = await service.createScreen(req.params.id, req.body);
  res.status(201).json({ success: true, screen });
});