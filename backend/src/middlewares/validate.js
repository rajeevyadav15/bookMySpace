// source can be "body", "query" or "params"
module.exports = (schema, source = "body") => (req, res, next) => {
  const result = schema.safeParse(req[source]);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: result.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
  }

  // Cleaned data is stored in req.valid (req.query is read only in Express 5)
  req.valid = req.valid || {};
  req.valid[source] = result.data;
  if (source === "body") req.body = result.data;

  next();
};