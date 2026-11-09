import { describe, it, expect } from "vitest";
import { groupSeatsByRow, seatTotal, pruneSelection } from "./seats";

const seat = (row, n, extra = {}) => ({
  id: `${row}${n}`,
  row_label: row,
  seat_number: n,
  seat_type: "regular",
  price: "200.00",
  status: "available",
  ...extra,
});

describe("groupSeatsByRow", () => {
  it("groups seats by row and sorts seat numbers", () => {
    const rows = groupSeatsByRow([seat("A", 2), seat("A", 1), seat("B", 1)]);
    expect(rows.length).toBe(2);
    expect(rows[0].seats.map((s) => s.seat_number)).toEqual([1, 2]);
  });

  it("sorts rows alphabetically", () => {
    const rows = groupSeatsByRow([seat("C", 1), seat("A", 1), seat("B", 1)]);
    expect(rows.map((r) => r.row)).toEqual(["A", "B", "C"]);
  });
});

describe("seatTotal", () => {
  it("adds prices without float errors", () => {
    const seats = [seat("A", 1, { price: "0.10" }), seat("A", 2, { price: "0.20" })];
    expect(seatTotal(seats)).toBe(0.3);
  });

  it("returns 0 for no seats", () => {
    expect(seatTotal([])).toBe(0);
  });
});

describe("pruneSelection", () => {
  it("keeps only available seats", () => {
    const seats = [
      seat("A", 1),
      seat("A", 2, { status: "held" }),
      seat("A", 3, { status: "booked" }),
    ];
    expect(pruneSelection(["A1", "A2", "A3"], seats)).toEqual(["A1"]);
  });
});