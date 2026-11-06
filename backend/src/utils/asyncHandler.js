// Wraps async route so errors go to errorHandler automatically
module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);