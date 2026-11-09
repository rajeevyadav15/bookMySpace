const { Worker } = require("bullmq");
const pool = require("./config/db");
const { createConnection } = require("./jobs/connection");
const { sendMail } = require("./jobs/mailer");

// Escape user text before putting it in HTML email
const esc = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

async function sendTicket(bookingId) {
  const { rows } = await pool.query(
    `SELECT b.id, b.status, b.total_amount,
            u.name AS user_name, u.email,
            s.start_time,
            m.title AS movie_title,
            sc.name AS screen_name,
            t.name AS theatre_name, t.city,
            (SELECT string_agg(seat.row_label || seat.seat_number::text, ', '
                               ORDER BY seat.row_label, seat.seat_number)
             FROM booking_seats bs
             JOIN seats seat ON seat.id = bs.seat_id
             WHERE bs.booking_id = b.id) AS seats
     FROM bookings b
     JOIN users u ON u.id = b.user_id
     JOIN shows s ON s.id = b.show_id
     JOIN movies m ON m.id = s.movie_id
     JOIN screens sc ON sc.id = s.screen_id
     JOIN theatres t ON t.id = sc.theatre_id
     WHERE b.id = $1`,
    [bookingId]
  );

  const b = rows[0];
  // Do not throw here, retrying will not help
  if (!b || b.status !== "confirmed") {
    console.log("Skip email, booking missing or not confirmed:", bookingId);
    return;
  }

  const when = new Date(b.start_time).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const html = `
    <h2>Booking confirmed</h2>
    <p>Hi ${esc(b.user_name)}, your tickets are ready.</p>
    <table cellpadding="6">
      <tr><td><b>Movie</b></td><td>${esc(b.movie_title)}</td></tr>
      <tr><td><b>Theatre</b></td><td>${esc(b.theatre_name)}, ${esc(b.city)}</td></tr>
      <tr><td><b>Screen</b></td><td>${esc(b.screen_name)}</td></tr>
      <tr><td><b>Show time</b></td><td>${esc(when)}</td></tr>
      <tr><td><b>Seats</b></td><td>${esc(b.seats)}</td></tr>
      <tr><td><b>Amount</b></td><td>Rs ${esc(b.total_amount)}</td></tr>
      <tr><td><b>Booking ID</b></td><td>${esc(b.id)}</td></tr>
    </table>
  `;

  await sendMail({
    to: b.email,
    subject: `Your tickets for ${b.movie_title}`,
    html,
  });
}

// Used by server.js (embedded) and by the standalone worker below
function startWorker() {
  const connection = createConnection();

  const worker = new Worker(
    "email",
    async (job) => {
      if (job.name === "ticket") await sendTicket(job.data.bookingId);
    },
    { connection, concurrency: 5 }
  );

  worker.on("completed", (job) => console.log("Job done:", job.id));
  worker.on("failed", (job, err) =>
    console.error("Job failed:", job && job.id, err.message)
  );
  worker.on("error", (err) => console.error("Worker error:", err.message));

  console.log("Email worker started");

  return {
    async close() {
      await worker.close();
      await connection.quit().catch(() => {});
    },
  };
}

module.exports = { startWorker };

// Direct run: npm run worker
if (require.main === module) {
  const handle = startWorker();

  async function shutdown() {
    await handle.close();
    await pool.end();
    process.exit(0);
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}