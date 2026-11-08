const router = require("express").Router();
const controller = require("./ai.controller");
const validate = require("../../middlewares/validate");
const rateLimit = require("../../middlewares/rateLimit");
const { authenticate } = require("../../middlewares/auth");
const { chatSchema } = require("./ai.validation");

// Login needed, so every AI call is tied to a user (limit and cost control)
router.use(authenticate);

router.post(
  "/chat",
  rateLimit({ name: "ai-chat", max: 20, windowSec: 3600 }),
  validate(chatSchema),
  controller.chat
);

router.get(
  "/recommendations",
  rateLimit({ name: "ai-rec", max: 10, windowSec: 3600 }),
  controller.recommendations
);

module.exports = router;