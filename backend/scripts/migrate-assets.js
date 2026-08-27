require('dotenv').config();

const { query, pool } = require('../src/config/db');

async function migrate() {
  await query(`
    CREATE TABLE IF NOT EXISTS assets (
      id UUID PRIMARY KEY,
      asset_code TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      brand TEXT NOT NULL,
      model TEXT,
      serial_number TEXT NOT NULL UNIQUE,
      asset_type TEXT NOT NULL DEFAULT 'Own',
      purchase_date DATE,
      purchase_cost NUMERIC,
      invoice_number TEXT,
      invoice_date DATE,
      vendor TEXT,
      location TEXT,
      condition TEXT,
      status TEXT NOT NULL DEFAULT 'AVAILABLE',
      warranty_start DATE,
      warranty_end DATE,
      documents TEXT,
      images TEXT,
      employee_name TEXT,
      employee_id UUID,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await query(`
    ALTER TABLE assets
      ADD COLUMN IF NOT EXISTS employee_id UUID
  `);
  console.log('assets table ready');
}

migrate()
  .catch((err) => {
    console.error('Migrate failed:', err.message || err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
