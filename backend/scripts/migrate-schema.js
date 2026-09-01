require('dotenv').config();

const crypto = require('crypto');
const { query, pool } = require('../src/config/db');

async function migrate() {
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
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS vendors (
      id UUID PRIMARY KEY,
      vendor_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      contact TEXT,
      email TEXT,
      mobile TEXT,
      location TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      account_number TEXT,
      branch TEXT,
      ifsc_code TEXT,
      account_holder_name TEXT,
      documents TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS account_number TEXT`);
  await query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS branch TEXT`);
  await query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS ifsc_code TEXT`);
  await query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS account_holder_name TEXT`);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS vendors_name_lower
      ON vendors (lower(name))
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS vendors_email_lower
      ON vendors (lower(email))
      WHERE email IS NOT NULL
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS vendors_mobile_digits
      ON vendors (regexp_replace(mobile, '[^0-9]', '', 'g'))
      WHERE mobile IS NOT NULL AND regexp_replace(mobile, '[^0-9]', '', 'g') <> ''
  `);

  await query(`
    ALTER TABLE assets
      ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id)
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS employees (
      id UUID PRIMARY KEY,
      employee_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      department TEXT,
      designation TEXT,
      email TEXT UNIQUE,
      mobile TEXT,
      joining_date DATE,
      manager_id UUID REFERENCES users(id),
      location TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      documents TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS employees_email_lower
      ON employees (lower(email))
      WHERE email IS NOT NULL
  `);

  await query(`
    ALTER TABLE employees
      ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id)
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS employees_user_id_unique
      ON employees (user_id)
      WHERE user_id IS NOT NULL
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS employees_mobile_digits
      ON employees (regexp_replace(mobile, '[^0-9]', '', 'g'))
      WHERE mobile IS NOT NULL AND regexp_replace(mobile, '[^0-9]', '', 'g') <> ''
  `);

  await query(`
    ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_manager_id_fkey
  `);

  await query(`
    UPDATE employees e
    SET manager_id = NULL
    WHERE e.manager_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = e.manager_id)
  `);

  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'employees_manager_id_users_fkey'
      ) THEN
        ALTER TABLE employees
          ADD CONSTRAINT employees_manager_id_users_fkey
          FOREIGN KEY (manager_id) REFERENCES users(id);
      END IF;
    END $$
  `);

  await query(`
    ALTER TABLE assets
      ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id)
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS tickets (
      id UUID PRIMARY KEY,
      ticket_code TEXT NOT NULL UNIQUE,
      employee_id UUID REFERENCES employees(id),
      category TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      priority TEXT,
      need_date DATE,
      remarks TEXT,
      attachments TEXT,
      status TEXT NOT NULL DEFAULT 'OPEN',
      assigned_to_user_id UUID REFERENCES users(id),
      created_by TEXT,
      created_by_user_id UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      closed_at TIMESTAMPTZ
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ticket_items (
      id UUID PRIMARY KEY,
      ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ticket_items_ticket_category
      ON ticket_items (ticket_id, category)
  `);

  const legacyTickets = await query(`
    SELECT t.id, t.category, COALESCE(t.quantity, 1) AS quantity
    FROM tickets t
    WHERE t.category IS NOT NULL
      AND t.category <> ''
      AND NOT EXISTS (
        SELECT 1 FROM ticket_items ti WHERE ti.ticket_id = t.id
      )
  `);
  for (const row of legacyTickets.rows) {
    await query(
      `INSERT INTO ticket_items (id, ticket_id, category, quantity)
       VALUES ($1, $2, $3, $4)`,
      [crypto.randomUUID(), row.id, row.category, row.quantity],
    );
  }

  await query(`
    CREATE TABLE IF NOT EXISTS asset_assignments (
      id UUID PRIMARY KEY,
      asset_id UUID NOT NULL REFERENCES assets(id),
      employee_id UUID NOT NULL REFERENCES employees(id),
      ticket_id UUID REFERENCES tickets(id),
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expected_return DATE,
      purpose TEXT,
      condition TEXT,
      location TEXT,
      remarks TEXT,
      accessories TEXT,
      assigned_by TEXT,
      assigned_by_user_id UUID REFERENCES users(id),
      returned_at TIMESTAMPTZ,
      return_reason TEXT,
      return_condition TEXT
    )
  `);

  await query(`ALTER TABLE asset_assignments ADD COLUMN IF NOT EXISTS assignment_code TEXT`);
  await query(`ALTER TABLE asset_assignments ADD COLUMN IF NOT EXISTS assignment_type TEXT`);
  await query(`ALTER TABLE asset_assignments ADD COLUMN IF NOT EXISTS documents TEXT`);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS asset_assignments_code_unique
      ON asset_assignments (assignment_code)
      WHERE assignment_code IS NOT NULL
  `);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS asset_assignments_open_asset
      ON asset_assignments (asset_id)
      WHERE returned_at IS NULL
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ticket_assets (
      ticket_id UUID NOT NULL REFERENCES tickets(id),
      asset_id UUID NOT NULL REFERENCES assets(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (ticket_id, asset_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS maintenance_checks (
      id UUID PRIMARY KEY,
      asset_id UUID NOT NULL REFERENCES assets(id),
      assignment_id UUID REFERENCES asset_assignments(id),
      result TEXT,
      notes TEXT,
      accessories TEXT,
      photos TEXT,
      warranty_applicable BOOLEAN,
      warranty_status TEXT,
      warranty_expiry DATE,
      claim_number TEXT,
      service_provider TEXT,
      repair_cost NUMERIC,
      repair_details TEXT,
      repair_status TEXT,
      checked_by TEXT,
      checked_by_user_id UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMPTZ
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id UUID PRIMARY KEY,
      user_id UUID REFERENCES users(id),
      role TEXT,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      description TEXT,
      entity_type TEXT,
      entity_id UUID,
      ip TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS assets_employee_id_idx ON assets (employee_id)`);
  await query(`CREATE INDEX IF NOT EXISTS assets_status_idx ON assets (status)`);
  await query(`CREATE INDEX IF NOT EXISTS assets_vendor_id_idx ON assets (vendor_id)`);
  await query(`CREATE INDEX IF NOT EXISTS asset_assignments_asset_id_idx ON asset_assignments (asset_id)`);
  await query(`CREATE INDEX IF NOT EXISTS asset_assignments_employee_id_idx ON asset_assignments (employee_id)`);
  await query(`CREATE INDEX IF NOT EXISTS maintenance_checks_asset_id_idx ON maintenance_checks (asset_id)`);
  await query(`CREATE INDEX IF NOT EXISTS tickets_employee_id_idx ON tickets (employee_id)`);
  await query(`ALTER TABLE asset_assignments ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ`);
  await query(`
    UPDATE asset_assignments
    SET acknowledged_at = COALESCE(assigned_at, now())
    WHERE acknowledged_at IS NULL
  `);

  await query(`CREATE INDEX IF NOT EXISTS activity_log_created_at_idx ON activity_log (created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS activity_log_created_id_idx ON activity_log (created_at DESC, id DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS activity_log_user_id_idx ON activity_log (user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS activity_log_module_idx ON activity_log (module)`);
  await query(`
    CREATE INDEX IF NOT EXISTS activity_log_entity_idx
    ON activity_log (lower(entity_type), entity_id, created_at DESC)
  `);

  await query(`
    ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_user_id_fkey
  `);
  await query(`
    ALTER TABLE activity_log
      ADD CONSTRAINT activity_log_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  `);

  await query(`
    CREATE OR REPLACE FUNCTION activity_log_no_mutate()
    RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'activity_log is append-only';
    END;
    $$ LANGUAGE plpgsql
  `);
  await query(`DROP TRIGGER IF EXISTS activity_log_no_update ON activity_log`);
  await query(`
    CREATE TRIGGER activity_log_no_update
      BEFORE UPDATE OR DELETE ON activity_log
      FOR EACH ROW EXECUTE PROCEDURE activity_log_no_mutate()
  `);

  console.log('Schema ready: users, vendors, assets, employees, tickets, ticket_items, asset_assignments, ticket_assets, maintenance_checks, activity_log');
}

migrate()
  .catch((err) => {
    console.error('Migrate failed:', err.message || err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
