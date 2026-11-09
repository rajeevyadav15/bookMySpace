export const MAX_SEATS = 6;

// Groups seats by row (A, B, C...) and sorts seats inside each row
export function groupSeatsByRow(seats) {
  const map = new Map();
  for (const seat of seats) {
    if (!map.has(seat.row_label)) map.set(seat.row_label, []);
    map.get(seat.row_label).push(seat);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([row, list]) => ({
      row,
      seats: [...list].sort((x, y) => x.seat_number - y.seat_number),
    }));
}

// Sum in paise (integers), so float errors never happen
export function seatTotal(seats) {
  const paise = seats.reduce((sum, s) => sum + Math.round(Number(s.price) * 100), 0);
  return paise / 100;
}

// Keep only seats that are still free
export function pruneSelection(selectedIds, seats) {
  const free = new Set(seats.filter((s) => s.status === "available").map((s) => s.id));
  return selectedIds.filter((id) => free.has(id));
}