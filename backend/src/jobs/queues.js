const { Queue } = require("bullmq");
const { createConnection } = require("./connection");

let connection;
let emailQueue;

// Created only when first needed, so tests that do not use it stay clean
function getEmailQueue() {
  if (!emailQueue) {
    connection = createConnection();
    emailQueue = new Queue("email", { connection });
  }
  return emailQueue;
}

// Same jobId for same booking, so duplicate emails are not queued
function enqueueTicketEmail(bookingId) {
  return getEmailQueue().add(
    "ticket",
    { bookingId },
    {
      jobId: `ticket-${bookingId}`,
      attempts: 5,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    }
  );
}

async function closeQueues() {
  if (emailQueue) {
    await emailQueue.close();
    await connection.quit();
    emailQueue = null;
    connection = null;
  }
}

module.exports = { getEmailQueue, enqueueTicketEmail, closeQueues };