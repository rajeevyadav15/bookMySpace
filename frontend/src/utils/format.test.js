import { describe, it, expect } from "vitest";
import { formatTime, formatPrice, formatDuration } from "./format";
import { qs } from "./qs";

describe("format helpers", () => {
  it("shows time in IST", () => {
    expect(formatTime("2026-11-20T09:00:00Z")).toMatch(/^2:30\s*pm$/i);
  });

  it("formats price in rupees", () => {
    expect(formatPrice(1500)).toBe("₹1,500");
  });

  it("formats duration", () => {
    expect(formatDuration(146)).toBe("2h 26m");
  });
});

describe("qs", () => {
  it("skips empty values", () => {
    expect(qs({ q: "", page: 2, city: undefined })).toBe("?page=2");
  });

  it("returns empty string for no params", () => {
    expect(qs({})).toBe("");
  });

  it("encodes text", () => {
    expect(qs({ q: "a b" })).toBe("?q=a+b");
  });
});