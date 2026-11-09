import { describe, it, expect } from "vitest";
import { trimForApi } from "./chat";

describe("trimForApi", () => {
  it("drops the greeting at the start", () => {
    const result = trimForApi([
      { role: "assistant", content: "Hi" },
      { role: "user", content: "movies?" },
    ]);
    expect(result).toEqual([{ role: "user", content: "movies?" }]);
  });

  it("keeps a short valid list as it is", () => {
    const list = [
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
      { role: "user", content: "c" },
    ];
    expect(trimForApi(list)).toEqual(list);
  });

  it("keeps only recent messages and starts with a user message", () => {
    const list = Array.from({ length: 25 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `m${i}`,
    }));
    const result = trimForApi(list);

    expect(result.length).toBeLessThanOrEqual(20);
    expect(result[0].role).toBe("user");
    expect(result.at(-1).content).toBe("m24");
  });
});