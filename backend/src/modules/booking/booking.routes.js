const router = require("express").Router();
const controller = require("./booking.controller");
const validate = require("../../middlewares/validate");
const { authenticate } = require("../../middlewares/auth");
const { idParamSchema } = require("../../utils/schemas");
const {
  holdSchema,
  confirmSchema,
  listBookingsQuerySchema,
} = require("./booking.validation");

// Every booking route needs login
router.use(authenticate);

router.post("/hold", validate(holdSchema), controller.hold);
router.delete(
  "/hold/:id",
  validate(idParamSchema, "params"),
  controller.releaseHold
);
router.post("/confirm", validate(confirmSchema), controller.confirm);

router.get("/", validate(listBookingsQuerySchema, "query"), controller.list);
router.get("/:id", validate(idParamSchema, "params"), controller.getOne);
router.post(
  "/:id/cancel",
  validate(idParamSchema, "params"),
  controller.cancel
);

module.exports = router;