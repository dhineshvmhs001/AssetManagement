const nodemailer = require('nodemailer');
const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM,
  MAIL_FROM_NAME,
} = require('../config/env');

function mailConfigured() {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && MAIL_FROM);
}

function transporter() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

async function sendMail({ to, subject, text, html }) {
  if (!mailConfigured()) {
    const err = new Error('SMTP is not configured');
    err.statusCode = 400;
    throw err;
  }
  const info = await transporter().sendMail({
    from: MAIL_FROM_NAME ? `"${MAIL_FROM_NAME}" <${MAIL_FROM}>` : MAIL_FROM,
    to,
    subject,
    text,
    html,
  });
  return info;
}

module.exports = { mailConfigured, sendMail };
