import { describe, it, expect } from "vitest";
import { formatCountdown, secondsUntil } from "./time";

describe("formatCountdown", () => {
  it("formats minutes and seconds", () => {
    expect(formatCountdown(299)).toBe("04:59");
  });

  it("never goes below zero", () => {
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(-5)).toBe("00:00");
  });
});

describe("secondsUntil", () => {
  it("rounds up partial seconds", () => {
    expect(secondsUntil(new Date(1500).toISOString(), 0)).toBe(2);
  });

  it("returns 0 for past or missing time", () => {
    expect(secondsUntil(new Date(0).toISOString(), 5000)).toBe(0);
    expect(secondsUntil(null)).toBe(0);
  });
});