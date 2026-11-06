const router = require("express").Router();
const controller = require("./auth.controller");
const validate = require("../../middlewares/validate");
const { authenticate } = require("../../middlewares/auth");
const { registerSchema, loginSchema } = require("./auth.validation");

router.post("/register", validate(registerSchema), controller.register);
router.post("/login", validate(loginSchema), controller.login);
router.get("/me", authenticate, controller.me);

module.exports = router;