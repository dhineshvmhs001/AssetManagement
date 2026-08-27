require('dotenv').config();

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query, pool } = require('../src/config/db');
const { ROLES } = require('../src/constants/roles');

const SEED_PASSWORD = 'Asset@123';

const SEED_USERS = [
  { name: 'Admin User', email: 'admin@internal.local', role: ROLES.ADMIN },
  { name: 'HR User', email: 'hr@internal.local', role: ROLES.HR },
  { name: 'Manager User', email: 'manager@internal.local', role: ROLES.MANAGER },
  { name: 'Asset Manager', email: 'asset.manager@internal.local', role: ROLES.ASSET_MANAGER },
  { name: 'Kavitha R.', email: 'asset.team@internal.local', role: ROLES.ASSET_TEAM },
  { name: 'Employee User', email: 'employee@internal.local', role: ROLES.EMPLOYEE },
];

async function seed() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  for (const user of SEED_USERS) {
    await query(
      `INSERT INTO users (id, name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         is_active = true`,
      [crypto.randomUUID(), user.name, user.email, passwordHash, user.role],
    );
  }

  console.log('Users table ready. Seed logins (password is the same for all):');
  for (const user of SEED_USERS) {
    console.log(`  ${user.role.padEnd(14)} ${user.email}  ${SEED_PASSWORD}`);
  }
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err.message || err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
