const router = require("express").Router();
const controller = require("./theatres.controller");
const validate = require("../../middlewares/validate");
const { authenticate, authorize } = require("../../middlewares/auth");
const { idParamSchema } = require("../../utils/schemas");
const {
  createTheatreSchema,
  createScreenSchema,
  listTheatresQuerySchema,
} = require("./theatres.validation");

const adminOnly = [authenticate, authorize("admin")];

router.get("/", validate(listTheatresQuerySchema, "query"), controller.list);
router.get("/:id", validate(idParamSchema, "params"), controller.getOne);

router.post("/", ...adminOnly, validate(createTheatreSchema), controller.create);
router.post(
  "/:id/screens",
  ...adminOnly,
  validate(idParamSchema, "params"),
  validate(createScreenSchema),
  controller.createScreen
);

module.exports = router;