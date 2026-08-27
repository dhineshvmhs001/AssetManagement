const { Pool } = require('pg');
const { PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE } = require('./env');

const isLocal = PGHOST === 'localhost' || PGHOST === '127.0.0.1';

const pool = new Pool({
  host: PGHOST,
  port: PGPORT,
  user: PGUSER,
  password: String(PGPASSWORD),
  database: PGDATABASE,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

async function connectDb() {
  const result = await pool.query('SELECT NOW() AS now');
  return result.rows[0].now;
}

async function listDatabases() {
  const result = await pool.query(
    `SELECT datname
     FROM pg_database
     WHERE datistemplate = false
     ORDER BY datname`,
  );
  return result.rows.map((row) => row.datname);
}

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, connectDb, listDatabases, query };
