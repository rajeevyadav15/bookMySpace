const env = require("../config/env");

function notFound(req, res) {
  res.status(404).json({ success: false, message: "Route not found" });
}

function errorHandler(err, req, res, next) {
  const status = err.status || 500;

  if (status === 500) console.error(err);

  res.status(status).json({
    success: false,
    message:
      status === 500 && env.nodeEnv === "production"
        ? "Internal Server Error"
        : err.message || "Internal Server Error",
  });
}

module.exports = { notFound, errorHandler };