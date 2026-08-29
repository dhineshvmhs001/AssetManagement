function isOn(value) {
  return ['on', 'true', '1', 'yes'].includes(String(value || '').trim().toLowerCase());
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

// A default signing key in production means anyone who has read the source
// can mint an admin token. Fail at boot rather than run wide open.
if (NODE_ENV === 'production' && (JWT_SECRET === 'change-me' || JWT_SECRET.length < 16)) {
  throw new Error('JWT_SECRET must be set to a strong value (16+ chars) when NODE_ENV=production');
}

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV,
  PRODUCTION_MODE: isOn(process.env.PRODUCTION_MODE),
  JWT_SECRET,
  PGHOST: process.env.PGHOST || 'localhost',
  PGPORT: Number(process.env.PGPORT) || 5432,
  PGUSER: process.env.PGUSER || 'asset',
  PGPASSWORD: process.env.PGPASSWORD || 'asset',
  PGDATABASE: process.env.PGDATABASE || 'Asset_Management',
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
  SMTP_SECURE: isOn(process.env.SMTP_SECURE),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: String(process.env.SMTP_PASS || '').replace(/\s/g, ''),
  MAIL_FROM: process.env.MAIL_FROM || process.env.SMTP_USER || '',
  MAIL_FROM_NAME: process.env.MAIL_FROM_NAME || 'Asset Management',
  EMPLOYEE_LOGIN_PASSWORD: process.env.EMPLOYEE_LOGIN_PASSWORD || 'Asset@123',
  APP_URL: String(process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, ''),
};


