const router = require("express").Router();
const controller = require("./shows.controller");
const validate = require("../../middlewares/validate");
const { authenticate, authorize } = require("../../middlewares/auth");
const { idParamSchema } = require("../../utils/schemas");
const { createShowSchema, listShowsQuerySchema } = require("./shows.validation");

router.get("/", validate(listShowsQuerySchema, "query"), controller.list);
router.get("/:id", validate(idParamSchema, "params"), controller.getOne);

router.post(
  "/",
  authenticate,
  authorize("admin"),
  validate(createShowSchema),
  controller.create
);

module.exports = router;