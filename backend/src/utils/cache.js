const redis = require("../config/redis");

// If Redis fails, app still works from DB. Cache is only a speed boost.

async function getJson(key) {
  try {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    console.warn("cache get failed:", err.message);
    return null;
  }
}

async function setJson(key, value, ttlSeconds) {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    console.warn("cache set failed:", err.message);
  }
}

async function delByPrefix(prefix) {
  try {
    const keys = [];
    const stream = redis.scanStream({ match: `${prefix}*`, count: 100 });
    for await (const batch of stream) keys.push(...batch);
    if (keys.length) await redis.del(...keys);
  } catch (err) {
    console.warn("cache delete failed:", err.message);
  }
}

module.exports = { getJson, setJson, delByPrefix };