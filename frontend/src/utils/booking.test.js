import { describe, it, expect } from "vitest";
import { canCancel, refundMessage } from "./booking";

const now = Date.parse("2026-11-20T10:00:00Z");
const booking = (start, status = "confirmed") => ({ status, start_time: start });

describe("canCancel", () => {
  it("allows cancel when show is far away", () => {
    expect(canCancel(booking("2026-11-20T15:00:00Z"), now)).toBe(true);
  });

  it("blocks cancel within 2 hours", () => {
    expect(canCancel(booking("2026-11-20T11:00:00Z"), now)).toBe(false);
  });

  it("allows cancel at exactly 2 hours", () => {
    expect(canCancel(booking("2026-11-20T12:00:00Z"), now)).toBe(true);
  });

  it("blocks cancel for cancelled booking", () => {
    expect(canCancel(booking("2026-11-20T15:00:00Z", "cancelled"), now)).toBe(false);
  });
});

describe("refundMessage", () => {
  it("returns the right message for each result", () => {
    expect(refundMessage("refunded")).toContain("refund has been started");
    expect(refundMessage("refund_failed")).toContain("contact support");
    expect(refundMessage(null)).toBe("Booking cancelled.");
  });
});