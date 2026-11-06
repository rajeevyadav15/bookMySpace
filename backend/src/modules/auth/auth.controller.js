const authService = require("./auth.service");
const asyncHandler = require("../../utils/asyncHandler");

exports.register = asyncHandler(async (req, res) => {
  const data = await authService.register(req.body);
  res.status(201).json({ success: true, ...data });
});

exports.login = asyncHandler(async (req, res) => {
  const data = await authService.login(req.body);
  res.json({ success: true, ...data });
});

exports.me = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user.id);
  res.json({ success: true, user });
});