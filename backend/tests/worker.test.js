const { startWorker } = require("../src/worker");
const { migrate } = require("../src/db/migrate");

describe("module exports", () => {
  it("worker can be loaded without starting", () => {
    expect(typeof startWorker).toBe("function");
  });

  it("migrate can be loaded without running", () => {
    expect(typeof migrate).toBe("function");
  });
});