const redis = require("../../config/redis");

const lockKey = (showId, seatId) => `seatlock:${showId}:${seatId}`;
const holdKey = (holdId) => `hold:${holdId}`;
const userHoldKey = (userId, showId) => `userhold:${userId}:${showId}`;

// All or nothing. Runs atomically inside Redis.
// Same user can lock his own seats again (TTL refresh).
const LOCK_SCRIPT = `
for i = 1, #KEYS do
  local owner = redis.call('GET', KEYS[i])
  if owner and owner ~= ARGV[1] then
    return 0
  end
end
for i = 1, #KEYS do
  redis.call('SET', KEYS[i], ARGV[1], 'EX', ARGV[2])
end
return 1
`;

// Deletes only the locks owned by this user
const UNLOCK_SCRIPT = `
for i = 1, #KEYS do
  if redis.call('GET', KEYS[i]) == ARGV[1] then
    redis.call('DEL', KEYS[i])
  end
end
return 1
`;

async function lockSeats(showId, seatIds, userId, ttl) {
  const keys = seatIds.map((id) => lockKey(showId, id));
  const result = await redis.eval(LOCK_SCRIPT, keys.length, ...keys, userId, ttl);
  return result === 1;
}

async function unlockSeats(showId, seatIds, userId) {
  if (!seatIds.length) return;
  const keys = seatIds.map((id) => lockKey(showId, id));
  await redis.eval(UNLOCK_SCRIPT, keys.length, ...keys, userId);
}

// Returns owner userId (or null) for each seat, same order as seatIds
async function getOwners(showId, seatIds) {
  if (!seatIds.length) return [];
  const keys = seatIds.map((id) => lockKey(showId, id));
  return redis.mget(keys);
}

// Lock keys are created first, hold record after.
// So hold record never expires before the locks.
async function saveHold(hold, ttl) {
  await redis
    .multi()
    .set(holdKey(hold.holdId), JSON.stringify(hold), "EX", ttl)
    .set(userHoldKey(hold.userId, hold.showId), hold.holdId, "EX", ttl)
    .exec();
}

async function getHold(holdId) {
  const value = await redis.get(holdKey(holdId));
  return value ? JSON.parse(value) : null;
}

async function getUserHold(userId, showId) {
  const holdId = await redis.get(userHoldKey(userId, showId));
  return holdId ? getHold(holdId) : null;
}

async function deleteHold(hold) {
  const uKey = userHoldKey(hold.userId, hold.showId);
  const current = await redis.get(uKey);
  const pipe = redis.multi().del(holdKey(hold.holdId));
  if (current === hold.holdId) pipe.del(uKey);
  await pipe.exec();
}

module.exports = {
  lockSeats,
  unlockSeats,
  getOwners,
  saveHold,
  getHold,
  getUserHold,
  deleteHold,
};