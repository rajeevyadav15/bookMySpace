const router = require("express").Router();
const controller = require("./payments.controller");
const validate = require("../../middlewares/validate");
const { authenticate } = require("../../middlewares/auth");
const { createOrderSchema, verifyPaymentSchema } = require("./payments.validation");

// No login here. Razorpay calls it, and signature is the proof
router.post("/webhook", controller.webhook);

router.post("/order", authenticate, validate(createOrderSchema), controller.createOrder);
router.post("/verify", authenticate, validate(verifyPaymentSchema), controller.verify);

module.exports = router;