const chatService = require("./ai.service");
const recommendationService = require("./recommendations.service");
const asyncHandler = require("../../utils/asyncHandler");

exports.chat = asyncHandler(async (req, res) => {
  const data = await chatService.chat(req.body.messages);
  res.json({ success: true, ...data });
});

exports.recommendations = asyncHandler(async (req, res) => {
  const data = await recommendationService.recommend(req.user.id);
  res.json({ success: true, ...data });
});