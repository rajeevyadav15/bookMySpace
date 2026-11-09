const keyFor = (showId) => `bms_hold_${showId}`;

// Keeps the active hold so a page refresh does not lose it.
// userId is stored so another user in the same tab never sees it.
export function saveHold(showId, hold) {
  try {
    sessionStorage.setItem(keyFor(showId), JSON.stringify(hold));
  } catch (err) {
    // storage blocked, hold still works until refresh
  }
}

export function loadHold(showId, userId) {
  try {
    const raw = sessionStorage.getItem(keyFor(showId));
    if (!raw) return null;

    const hold = JSON.parse(raw);
    const expired = new Date(hold.expiresAt).getTime() <= Date.now();
    if (expired || hold.userId !== userId) {
      sessionStorage.removeItem(keyFor(showId));
      return null;
    }
    return hold;
  } catch (err) {
    return null;
  }
}

export function clearHold(showId) {
  try {
    sessionStorage.removeItem(keyFor(showId));
  } catch (err) {
    // ignore
  }
}