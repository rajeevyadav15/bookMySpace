const IORedis = require("ioredis");
const env = require("../config/env");

// BullMQ needs maxRetriesPerRequest = null
function createConnection() {
  return new IORedis(env.redisUrl, { maxRetriesPerRequest: null });
}

module.exports = { createConnection };