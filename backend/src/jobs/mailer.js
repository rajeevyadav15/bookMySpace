const nodemailer = require("nodemailer");
const env = require("../config/env");

let transporterPromise;

function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = (async () => {
      if (env.smtp.host) {
        return nodemailer.createTransport({
          host: env.smtp.host,
          port: env.smtp.port,
          secure: env.smtp.port === 465,
          auth: { user: env.smtp.user, pass: env.smtp.pass },
        });
      }
      // No SMTP set: use Ethereal (fake inbox for development)
      const account = await nodemailer.createTestAccount();
      console.log("Using Ethereal test mail account:", account.user);
      return nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: { user: account.user, pass: account.pass },
      });
    })().catch((err) => {
      transporterPromise = null;
      throw err;
    });
  }
  return transporterPromise;
}

async function sendMail({ to, subject, html }) {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({ from: env.mailFrom, to, subject, html });

  const preview = nodemailer.getTestMessageUrl(info);
  if (preview) console.log("Email preview:", preview);

  return info;
}

module.exports = { sendMail };