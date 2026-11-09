const app = require("./app");
const env = require("./config/env");
const pool = require("./config/db");
const redis = require("./config/redis");
const { closeQueues } = require("./jobs/queues");
const { migrate } = require("./db/migrate");
const { startWorker } = require("./worker");

async function main() {
  // Free hosting has no pre deploy step, so migrations run at startup
  if (env.runMigrations) {
    console.log("Running migrations...");
    await migrate();
  }

  if (env.nodeEnv === "production" && env.paymentMode === "mock") {
    console.warn(
      "WARNING: demo payments are ON. Tickets are free. Use only for demos with fake data."
    );
  }

  const server = app.listen(env.port, () => {
    console.log(`Server running on port ${env.port} (${env.nodeEnv})`);
  });

  // Free hosting has no separate worker service, so it can run inside the API
  const worker = env.embedWorker ? startWorker() : null;

  let shuttingDown = false;

  // Docker and Render send SIGTERM on stop. Finish running requests, then close.
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down`);

    // If something hangs, do not wait forever
    const force = setTimeout(() => {
      console.error("Forced exit after timeout");
      process.exit(1);
    }, 10000);
    force.unref();

    server.close(async () => {
      try {
        if (worker) await worker.close();
        await closeQueues();
        await pool.end();
        await redis.quit();
      } catch (err) {
        console.error("Error while closing:", err.message);
      }
      process.exit(0);
    });
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});

main().catch((err) => {
  console.error("Startup failed:", err);
  process.exit(1);
});