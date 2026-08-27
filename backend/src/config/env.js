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
};


