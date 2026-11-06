const Redis = require("ioredis");
const env = require("./env");

const redis = new Redis(env.redisUrl);

module.exports = redis;