const { sendMail, mailConfigured } = require('../lib/mail');
const { MAIL_FROM } = require('../config/env');

async function sendTest(req, res) {
  const to = String(req.body?.to || MAIL_FROM || '').trim();
  if (!to) {
    return res.status(400).json({ ok: false, error: 'Enter a To address' });
  }
  if (!mailConfigured()) {
    return res.status(400).json({ ok: false, error: 'SMTP is not configured in .env' });
  }

  try {
    await sendMail({
      to,
      subject: 'Asset Management — SMTP test',
      text: 'This is a test mail from the Asset Management app. SMTP is working.',
    });
    return res.json({ ok: true, to });
  } catch (err) {
    console.error('SMTP test failed:', err);
    return res.status(err.statusCode || 500).json({
      ok: false,
      error: err.message || 'Could not send mail',
    });
  }
}

module.exports = { sendTest };
