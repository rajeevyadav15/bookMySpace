const redis = require("../config/redis");
const ApiError = require("../utils/ApiError");

// Fixed window limit per user. Protects AI cost.
function rateLimit({ name, max, windowSec }) {
  return async (req, res, next) => {
    let retryAfter = null;

    try {
      const key = `rl:${name}:${req.user ? req.user.id : req.ip}`;
      const results = await redis
        .multi()
        .incr(key)
        .expire(key, windowSec, "NX") // set expiry only on first hit
        .ttl(key)
        .exec();

      const count = results[0][1];
      const ttl = results[2][1];

      res.set("X-RateLimit-Limit", String(max));
      res.set("X-RateLimit-Remaining", String(Math.max(max - count, 0)));

      if (count > max) retryAfter = Math.max(ttl, 1);
    } catch (err) {
      // If Redis is down, do not block users
      console.warn("rate limit skipped:", err.message);
    }

    if (retryAfter !== null) {
      res.set("Retry-After", String(retryAfter));
      return next(new ApiError(429, "Too many requests. Please try later"));
    }
    next();
  };
}

module.exports = rateLimit;