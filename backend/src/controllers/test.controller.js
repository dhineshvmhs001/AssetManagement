const { connectDb } = require('../config/db');
const { PGDATABASE } = require('../config/env');

function connectionError(err) {
  return (
    err.errors?.map((e) => e.message).join('; ') ||
    err.message ||
    err.code ||
    String(err)
  );
}

async function ping(req, res) {
  try {
    const now = await connectDb();
    res.json({
      ok: true,
      connected: true,
      database: PGDATABASE,
      now,
    });
  } catch (err) {
    res.json({
      ok: false,
      connected: false,
      database: PGDATABASE,
      error: connectionError(err),
    });
  }
}

module.exports = { ping };
