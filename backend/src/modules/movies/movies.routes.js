const router = require("express").Router();
const controller = require("./movies.controller");
const validate = require("../../middlewares/validate");
const { authenticate, authorize } = require("../../middlewares/auth");
const { idParamSchema } = require("../../utils/schemas");
const {
  createMovieSchema,
  updateMovieSchema,
  listMoviesQuerySchema,
} = require("./movies.validation");

const adminOnly = [authenticate, authorize("admin")];

router.get("/", validate(listMoviesQuerySchema, "query"), controller.list);
router.get("/:id", validate(idParamSchema, "params"), controller.getOne);

router.post("/", ...adminOnly, validate(createMovieSchema), controller.create);
router.put(
  "/:id",
  ...adminOnly,
  validate(idParamSchema, "params"),
  validate(updateMovieSchema),
  controller.update
);
router.delete(
  "/:id",
  ...adminOnly,
  validate(idParamSchema, "params"),
  controller.remove
);

module.exports = router;