const { query } = require('../config/db');
const { logActivity, actionLabel } = require('../lib/activity');
const { ROLES, roleLabel } = require('../constants/roles');
const { STATUS, STATUS_LABELS, CATEGORIES, statusLabel } = require('../constants/assetStatus');
const { DEPARTMENTS } = require('../constants/employeeRequired');
const { istStamp, resolveWindow } = require('../lib/time');

const READ_ROLES = [ROLES.ADMIN, ROLES.ASSET_MANAGER, ROLES.ASSET_TEAM, ROLES.HR];
const PAGE_SIZE = 20;
const PAGE_CAP = 50;
const EXPORT_LIMIT = 5000;

const TICKET_LABELS = {
  AWAITING_MANAGER: 'Awaiting manager approval',
  WITH_ASSET_MANAGER: 'With Asset Manager',
  WITH_ASSET_TEAM: 'Assigned to Asset Team',
  CLOSED: 'Closed',
  REJECTED: 'Not approved',
  CANCELLED: 'Cancelled',
};

const FILTERS = { dates: true, category: true, department: true, status: true };

const CATALOG = [
  {
    group: 'asset',
    label: 'Asset',
    reports: [
      { slug: 'total', title: 'Total', uses: FILTERS, snapshot: true, defaultSort: { key: 'assetCode', dir: 'asc' } },
      {
        slug: 'available',
        title: 'Available',
        uses: FILTERS,
        snapshot: true,
        status: STATUS.AVAILABLE,
        defaultSort: { key: 'assetCode', dir: 'asc' },
      },
      {
        slug: 'assigned',
        title: 'Assigned',
        uses: FILTERS,
        snapshot: true,
        status: STATUS.ASSIGNED,
        defaultSort: { key: 'assetCode', dir: 'asc' },
      },
      {
        slug: 'maintenance',
        title: 'Maintenance',
        uses: FILTERS,
        snapshot: true,
        status: STATUS.MAINTENANCE,
        defaultSort: { key: 'assetCode', dir: 'asc' },
      },
      {
        slug: 'damaged',
        title: 'Damaged',
        uses: FILTERS,
        snapshot: true,
        status: STATUS.DAMAGED,
        defaultSort: { key: 'assetCode', dir: 'asc' },
      },
      {
        slug: 'lost',
        title: 'Lost',
        uses: FILTERS,
        snapshot: true,
        status: STATUS.LOST,
        defaultSort: { key: 'assetCode', dir: 'asc' },
      },
      {
        slug: 'retired',
        title: 'Retired',
        uses: FILTERS,
        snapshot: true,
        status: STATUS.RETIRED,
        defaultSort: { key: 'assetCode', dir: 'asc' },
      },
      {
        slug: 'category',
        title: 'Category-wise',
        uses: FILTERS,
        snapshot: true,
        kind: 'category',
        defaultSort: { key: 'count', dir: 'desc' },
      },
    ],
  },
  {
    group: 'history',
    label: 'History',
    reports: [
      { slug: 'assignment', title: 'Assignment', uses: FILTERS, defaultSort: { key: 'assignedAt', dir: 'desc' } },
      { slug: 'return', title: 'Return/Unassignment', uses: FILTERS, defaultSort: { key: 'returnedAt', dir: 'desc' } },
      { slug: 'maintenance', title: 'Maintenance', uses: FILTERS, defaultSort: { key: 'at', dir: 'desc' } },
      { slug: 'ticket', title: 'Ticket', uses: FILTERS, defaultSort: { key: 'createdAt', dir: 'desc' } },
      { slug: 'employee-asset', title: 'Employee Asset', uses: FILTERS, defaultSort: { key: 'employeeName', dir: 'asc' } },
      { slug: 'transaction', title: 'Complete Transaction', uses: FILTERS, defaultSort: { key: 'at', dir: 'desc' } },
    ],
  },
  {
    group: 'user',
    label: 'User',
    reports: [
      { slug: 'activity', title: 'User Activity', uses: FILTERS, defaultSort: { key: 'at', dir: 'desc' } },
      { slug: 'login', title: 'Login History', uses: FILTERS, defaultSort: { key: 'at', dir: 'desc' } },
      {
        slug: 'department',
        title: 'Department/User Activity',
        uses: FILTERS,
        kind: 'summary',
        defaultSort: { key: 'count', dir: 'desc' },
      },
      {
        slug: 'performance',
        title: 'User Performance',
        uses: FILTERS,
        kind: 'summary',
        defaultSort: { key: 'count', dir: 'desc' },
      },
    ],
  },
];

function findReport(group, slug) {
  const g = CATALOG.find((item) => item.group === group);
  const report = g?.reports.find((item) => item.slug === slug);
  return report ? { ...report, group, groupLabel: g.label } : null;
}

function canRead(user) {
  return user && READ_ROLES.includes(user.role);
}

function ownActivity(user) {
  return user?.role === ROLES.ASSET_TEAM || user?.role === ROLES.HR;
}

function ownHistory(user) {
  return user?.role === ROLES.ASSET_TEAM;
}

function hideFinancials(user) {
  return user?.role === ROLES.HR || user?.role === ROLES.EMPLOYEE;
}

// `cap` is passed by the caller, never taken from the query string: the paged
// endpoints keep PAGE_CAP, and only the export paths raise it. Reading a cap
// from req.query would let any client page 5,000 rows at a time.
function pageLimit(value, cap = PAGE_CAP) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) {
    return PAGE_SIZE;
  }
  return Math.min(cap, Math.floor(n));
}

function pageNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) {
    return 1;
  }
  return Math.floor(n);
}

function csvCell(value) {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

// expected_return is a DATE column, which node-postgres hands back as a Date at
// LOCAL midnight. Reading it with local getters returns the day that was
// stored; converting it through IST would shift it. Do not "fix" this to match
// the timestamp formatting elsewhere — these are different column types.
function isoDate(value) {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sortDir(value, fallback = 'DESC') {
  const text = String(value || '').toLowerCase();
  if (text === 'asc') {
    return 'ASC';
  }
  if (text === 'desc') {
    return 'DESC';
  }
  return fallback;
}

function pickSort(allowed, requested, fallback) {
  return allowed[requested] ? requested : fallback;
}

function orderBy(allowed, queryIn, fallback, fallbackDir = 'DESC') {
  const sort = pickSort(allowed, queryIn.sort, fallback);
  const dir = sortDir(queryIn.dir, fallbackDir);
  return { clause: `${allowed[sort]} ${dir} NULLS LAST`, sort, dir };
}

function columns(list) {
  return list.map((col) => ({ ...col, sortable: col.sortable !== false }));
}

function pushEq(where, params, sql, value, allowed) {
  const text = String(value || '').trim();
  if (!text) {
    return;
  }
  if (allowed && !allowed.includes(text)) {
    return;
  }
  params.push(text);
  where.push(`${sql} = $${params.length}`);
}

function scopeAssignments(user, where, params) {
  if (!ownHistory(user)) {
    return;
  }
  params.push(user.id);
  where.push(`aa.assigned_by_user_id = $${params.length}`);
}

function scopeMaintenance(user, where, params) {
  if (!ownHistory(user)) {
    return;
  }
  params.push(user.id);
  where.push(`mc.checked_by_user_id = $${params.length}`);
}

function scopeTickets(user, where, params) {
  if (!ownHistory(user)) {
    return;
  }
  params.push(user.id);
  where.push(
    `(t.created_by_user_id = $${params.length} OR EXISTS (
        SELECT 1 FROM asset_assignments aa
        WHERE aa.ticket_id = t.id AND aa.assigned_by_user_id = $${params.length}
     ))`,
  );
}

async function dashboardCounts() {
  const result = await query(`SELECT status, COUNT(*)::int AS n FROM assets GROUP BY status`);
  const byStatus = Object.fromEntries(Object.keys(STATUS).map((key) => [key, 0]));
  let total = 0;
  result.rows.forEach((row) => {
    if (row.status in byStatus) {
      byStatus[row.status] = row.n;
    }
    total += row.n;
  });
  return { total, byStatus };
}

function assetWhere(queryIn, impliedStatus) {
  const where = [];
  const params = [];
  pushEq(where, params, 'a.category', queryIn.category, CATEGORIES);
  pushEq(where, params, 'e.department', queryIn.department, DEPARTMENTS);
  const status = impliedStatus || String(queryIn.status || '').trim();
  if (status && STATUS[status]) {
    params.push(status);
    where.push(`a.status = $${params.length}`);
  }
  return { where, params };
}

const ASSET_FROM = `assets a LEFT JOIN employees e ON e.id = a.employee_id`;

const ASSET_SORT = {
  assetCode: 'a.asset_code',
  category: 'a.category',
  brand: 'a.brand',
  model: 'a.model',
  serialNumber: 'a.serial_number',
  status: 'a.status',
  employeeName: 'e.name',
  department: 'e.department',
  location: 'a.location',
};

const CATEGORY_SORT = {
  category: 'a.category',
  count: 'n',
  share: 'n',
};

function mapAsset(row) {
  return {
    id: row.id,
    assetCode: row.asset_code,
    category: row.category,
    brand: row.brand,
    model: row.model,
    serialNumber: row.serial_number,
    status: row.status,
    statusLabel: statusLabel(row.status),
    employeeName: row.employee_name || null,
    department: row.department || null,
    location: row.location,
    createdAt: row.created_at,
  };
}

const ASSET_COLUMNS = columns([
  { key: 'assetCode', label: 'Asset' },
  { key: 'category', label: 'Category' },
  { key: 'brand', label: 'Brand' },
  { key: 'model', label: 'Model' },
  { key: 'serialNumber', label: 'Serial' },
  { key: 'status', label: 'Status' },
  { key: 'employeeName', label: 'Employee' },
  { key: 'location', label: 'Location' },
]);

async function runAsset(spec, queryIn) {
  const { where, params } = assetWhere(queryIn, spec.status);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const dashboard = await dashboardCounts();
  const extraFilter = Boolean(queryIn.category || queryIn.department || (!spec.status && queryIn.status));

  if (spec.kind === 'category') {
    const { clause } = orderBy(CATEGORY_SORT, queryIn, 'count', 'DESC');
    const result = await query(
      `SELECT a.category, COUNT(*)::int AS n
       FROM ${ASSET_FROM} ${whereSql}
       GROUP BY a.category
       ORDER BY ${clause}, a.category`,
      params,
    );
    const total = result.rows.reduce((sum, row) => sum + row.n, 0);
    const rows = result.rows.map((row) => ({
      id: row.category,
      category: row.category,
      count: row.n,
      share: total ? Math.round((row.n / total) * 1000) / 10 : 0,
    }));
    return {
      columns: columns([
        { key: 'category', label: 'Category' },
        { key: 'count', label: 'Assets' },
        { key: 'share', label: 'Share %' },
      ]),
      rows,
      total: rows.length,
      page: 1,
      pages: 1,
      totals: { n: total, dashboard, reconciles: !extraFilter && total === dashboard.total },
    };
  }

  const { clause } = orderBy(ASSET_SORT, queryIn, 'assetCode', 'ASC');
  const page = pageNumber(queryIn.page);
  const limit = pageLimit(queryIn.limit);
  const offset = (page - 1) * limit;

  const count = await query(`SELECT COUNT(*)::int AS n FROM ${ASSET_FROM} ${whereSql}`, params);
  const total = count.rows[0]?.n || 0;
  const result = await query(
    `SELECT a.id, a.asset_code, a.category, a.brand, a.model, a.serial_number,
            a.status, a.location, a.created_at, e.name AS employee_name, e.department
     FROM ${ASSET_FROM} ${whereSql}
     ORDER BY ${clause}, a.asset_code ASC
     LIMIT ${limit} OFFSET ${offset}`,
    params,
  );

  const expected = spec.status ? dashboard.byStatus[spec.status] : dashboard.total;
  return {
    columns: ASSET_COLUMNS,
    rows: result.rows.map(mapAsset),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    totals: { n: total, dashboard, reconciles: !extraFilter && total === expected },
  };
}

async function allAssetRows(spec, queryIn) {
  const { where, params } = assetWhere(queryIn, spec.status);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  if (spec.kind === 'category') {
    const { clause } = orderBy(CATEGORY_SORT, queryIn, 'count', 'DESC');
    const result = await query(
      `SELECT a.category, COUNT(*)::int AS n
       FROM ${ASSET_FROM} ${whereSql}
       GROUP BY a.category
       ORDER BY ${clause}, a.category`,
      params,
    );
    const total = result.rows.reduce((sum, row) => sum + row.n, 0);
    return result.rows.map((row) => ({
      Category: row.category,
      Assets: row.n,
      'Share %': total ? Math.round((row.n / total) * 1000) / 10 : 0,
    }));
  }
  const { clause } = orderBy(ASSET_SORT, queryIn, 'assetCode', 'ASC');
  const result = await query(
    `SELECT a.asset_code, a.category, a.brand, a.model, a.serial_number,
            a.status, a.location, e.name AS employee_name, e.department
     FROM ${ASSET_FROM} ${whereSql}
     ORDER BY ${clause}, a.asset_code ASC
     LIMIT ${EXPORT_LIMIT + 1}`,
    params,
  );
  return result.rows.map((row) => ({
    Asset: row.asset_code,
    Category: row.category,
    Brand: row.brand,
    Model: row.model,
    Serial: row.serial_number,
    Status: statusLabel(row.status),
    Employee: row.employee_name,
    Department: row.department,
    Location: row.location,
  }));
}

function historyWindow(queryIn, column) {
  const { from, to } = resolveWindow(queryIn);
  const where = [];
  const params = [];
  params.push(from.toISOString());
  where.push(`${column} >= $${params.length}`);
  params.push(to.toISOString());
  where.push(`${column} <= $${params.length}`);
  return { where, params, from, to };
}

const ASSIGNMENT_SORT = {
  assignmentCode: 'aa.assignment_code',
  assetCode: 'a.asset_code',
  category: 'a.category',
  employeeName: 'e.name',
  department: 'e.department',
  assignedAt: 'aa.assigned_at',
  expectedReturn: 'aa.expected_return',
  acknowledgedAt: 'aa.acknowledged_at',
  returnedAt: 'aa.returned_at',
  returnReason: 'aa.return_reason',
  returnCondition: 'aa.return_condition',
};

function mapAssignment(row) {
  return {
    id: row.id,
    assignmentCode: row.assignment_code,
    assetCode: row.asset_code,
    category: row.category,
    employeeName: row.employee_name,
    employeeCode: row.employee_code,
    department: row.department,
    assignedAt: row.assigned_at,
    expectedReturn: row.expected_return,
    acknowledgedAt: row.acknowledged_at,
    returnedAt: row.returned_at,
    returnReason: row.return_reason,
    returnCondition: row.return_condition,
  };
}

async function runAssignmentHistory(queryIn, user, { returned }) {
  const { where, params, from, to } = historyWindow(queryIn, returned ? 'aa.returned_at' : 'aa.assigned_at');
  if (returned) {
    where.push('aa.returned_at IS NOT NULL');
  }
  pushEq(where, params, 'a.category', queryIn.category, CATEGORIES);
  pushEq(where, params, 'e.department', queryIn.department, DEPARTMENTS);
  scopeAssignments(user, where, params);
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const fallback = returned ? 'returnedAt' : 'assignedAt';
  const { clause } = orderBy(ASSIGNMENT_SORT, queryIn, fallback, 'DESC');
  const page = pageNumber(queryIn.page);
  const limit = pageLimit(queryIn.limit);
  const offset = (page - 1) * limit;
  const count = await query(
    `SELECT COUNT(*)::int AS n
     FROM asset_assignments aa
     JOIN assets a ON a.id = aa.asset_id
     JOIN employees e ON e.id = aa.employee_id
     ${whereSql}`,
    params,
  );
  const total = count.rows[0]?.n || 0;
  const result = await query(
    `SELECT aa.id, aa.assignment_code, aa.assigned_at, aa.expected_return, aa.acknowledged_at,
            aa.returned_at, aa.return_reason, aa.return_condition,
            a.asset_code, a.category, e.employee_code, e.name AS employee_name, e.department
     FROM asset_assignments aa
     JOIN assets a ON a.id = aa.asset_id
     JOIN employees e ON e.id = aa.employee_id
     ${whereSql}
     ORDER BY ${clause}, aa.id DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  return {
    columns: returned
      ? columns([
          { key: 'assignmentCode', label: 'Assignment' },
          { key: 'assetCode', label: 'Asset' },
          { key: 'employeeName', label: 'Employee' },
          { key: 'department', label: 'Department' },
          { key: 'returnedAt', label: 'Returned' },
          { key: 'returnReason', label: 'Reason' },
          { key: 'returnCondition', label: 'Condition' },
        ])
      : columns([
          { key: 'assignmentCode', label: 'Assignment' },
          { key: 'assetCode', label: 'Asset' },
          { key: 'category', label: 'Category' },
          { key: 'employeeName', label: 'Employee' },
          { key: 'department', label: 'Department' },
          { key: 'assignedAt', label: 'Assigned' },
          { key: 'expectedReturn', label: 'Expected return' },
          { key: 'acknowledgedAt', label: 'Ack' },
          { key: 'returnedAt', label: 'Returned' },
        ]),
    rows: result.rows.map(mapAssignment),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    totals: { n: total },
    window: { from: from.toISOString(), to: to.toISOString() },
  };
}

async function exportAssignmentHistory(queryIn, user, { returned }) {
  const { where, params } = historyWindow(queryIn, returned ? 'aa.returned_at' : 'aa.assigned_at');
  if (returned) {
    where.push('aa.returned_at IS NOT NULL');
  }
  pushEq(where, params, 'a.category', queryIn.category, CATEGORIES);
  pushEq(where, params, 'e.department', queryIn.department, DEPARTMENTS);
  scopeAssignments(user, where, params);
  const fallback = returned ? 'returnedAt' : 'assignedAt';
  const { clause } = orderBy(ASSIGNMENT_SORT, queryIn, fallback, 'DESC');
  const result = await query(
    `SELECT aa.assignment_code, aa.assigned_at, aa.expected_return, aa.acknowledged_at,
            aa.returned_at, aa.return_reason, aa.return_condition,
            a.asset_code, a.category, e.employee_code, e.name AS employee_name, e.department
     FROM asset_assignments aa
     JOIN assets a ON a.id = aa.asset_id
     JOIN employees e ON e.id = aa.employee_id
     WHERE ${where.join(' AND ')}
     ORDER BY ${clause}, aa.id DESC
     LIMIT ${EXPORT_LIMIT + 1}`,
    params,
  );
  return result.rows.map((row) => ({
    Assignment: row.assignment_code,
    Asset: row.asset_code,
    Category: row.category,
    Employee: row.employee_name,
    'Employee ID': row.employee_code,
    Department: row.department,
    Assigned: istStamp(row.assigned_at),
    'Expected return': isoDate(row.expected_return),
    Ack: istStamp(row.acknowledged_at),
    Returned: istStamp(row.returned_at),
    Reason: row.return_reason,
    Condition: row.return_condition,
  }));
}

const EMPLOYEE_ASSET_SORT = {
  employeeName: 'e.name',
  employeeCode: 'e.employee_code',
  department: 'e.department',
  assetCode: 'a.asset_code',
  category: 'a.category',
  assignedAt: 'aa.assigned_at',
  expectedReturn: 'aa.expected_return',
  returnedAt: 'aa.returned_at',
  days: 'days_held',
  holding: 'holding',
};

async function employeeAssetWhere(queryIn, user) {
  const { from, to } = resolveWindow(queryIn);
  const where = ['aa.assigned_at <= $2', '(aa.returned_at IS NULL OR aa.returned_at >= $1)'];
  const params = [from.toISOString(), to.toISOString()];
  pushEq(where, params, 'a.category', queryIn.category, CATEGORIES);
  pushEq(where, params, 'e.department', queryIn.department, DEPARTMENTS);
  const holding = String(queryIn.status || '').trim().toUpperCase();
  if (holding === 'HELD' || holding === 'ASSIGNED') {
    where.push('aa.returned_at IS NULL');
  } else if (holding === 'RETURNED' || holding === 'AVAILABLE') {
    where.push('aa.returned_at IS NOT NULL');
  }
  scopeAssignments(user, where, params);
  return { where, params, from, to };
}

const EMPLOYEE_ASSET_SELECT = `
  aa.id, aa.assigned_at, aa.expected_return, aa.returned_at,
  a.asset_code, a.category, e.employee_code, e.name AS employee_name, e.department,
  CASE WHEN aa.returned_at IS NULL THEN 'Held' ELSE 'Returned' END AS holding,
  GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (COALESCE(aa.returned_at, NOW()) - aa.assigned_at)) / 86400))::int AS days_held
`;

async function runEmployeeAsset(queryIn, user, { maxLimit } = {}) {
  const { where, params, from, to } = await employeeAssetWhere(queryIn, user);
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const { clause } = orderBy(EMPLOYEE_ASSET_SORT, queryIn, 'employeeName', 'ASC');
  const page = pageNumber(queryIn.page);
  const limit = pageLimit(queryIn.limit, maxLimit);
  const count = await query(
    `SELECT COUNT(*)::int AS n
     FROM asset_assignments aa
     JOIN assets a ON a.id = aa.asset_id
     JOIN employees e ON e.id = aa.employee_id
     ${whereSql}`,
    params,
  );
  const total = count.rows[0]?.n || 0;
  const result = await query(
    `SELECT ${EMPLOYEE_ASSET_SELECT}
     FROM asset_assignments aa
     JOIN assets a ON a.id = aa.asset_id
     JOIN employees e ON e.id = aa.employee_id
     ${whereSql}
     ORDER BY ${clause}, e.name ASC, aa.assigned_at DESC
     LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
    params,
  );
  return {
    columns: columns([
      { key: 'employeeName', label: 'Employee' },
      { key: 'employeeCode', label: 'Employee ID' },
      { key: 'department', label: 'Department' },
      { key: 'assetCode', label: 'Asset' },
      { key: 'category', label: 'Category' },
      { key: 'assignedAt', label: 'Assigned' },
      { key: 'expectedReturn', label: 'Expected return' },
      { key: 'returnedAt', label: 'Returned' },
      { key: 'days', label: 'Days' },
      { key: 'holding', label: 'Holding' },
    ]),
    rows: result.rows.map((row) => ({
      id: row.id,
      employeeName: row.employee_name,
      employeeCode: row.employee_code,
      department: row.department,
      assetCode: row.asset_code,
      category: row.category,
      assignedAt: row.assigned_at,
      expectedReturn: row.expected_return,
      returnedAt: row.returned_at,
      days: row.days_held,
      holding: row.holding,
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    totals: { n: total },
    window: { from: from.toISOString(), to: to.toISOString() },
  };
}

async function exportEmployeeAsset(queryIn, user) {
  const data = await runEmployeeAsset({ ...queryIn, page: 1, limit: EXPORT_LIMIT + 1 }, user, { maxLimit: EXPORT_LIMIT + 1 });
  return data.rows.map((row) => ({
    Employee: row.employeeName,
    'Employee ID': row.employeeCode,
    Department: row.department,
    Asset: row.assetCode,
    Category: row.category,
    Assigned: istStamp(row.assignedAt),
    'Expected return': isoDate(row.expectedReturn),
    Returned: istStamp(row.returnedAt),
    Days: row.days,
    Holding: row.holding,
  }));
}

const MAINTENANCE_SORT = {
  assetCode: 'a.asset_code',
  category: 'a.category',
  result: 'mc.result',
  repairStatus: 'mc.repair_status',
  repairCost: 'mc.repair_cost',
  checkedBy: 'mc.checked_by',
  at: 'mc.created_at',
  completedAt: 'mc.completed_at',
};

async function runMaintenanceHistory(queryIn, user, { maxLimit } = {}) {
  const { where, params, from, to } = historyWindow(queryIn, 'mc.created_at');
  pushEq(where, params, 'a.category', queryIn.category, CATEGORIES);
  scopeMaintenance(user, where, params);
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const allowedSort = hideFinancials(user) ? { ...MAINTENANCE_SORT } : MAINTENANCE_SORT;
  if (hideFinancials(user)) {
    delete allowedSort.repairCost;
  }
  const { clause } = orderBy(allowedSort, queryIn, 'at', 'DESC');
  const page = pageNumber(queryIn.page);
  const limit = pageLimit(queryIn.limit, maxLimit);
  const count = await query(
    `SELECT COUNT(*)::int AS n
     FROM maintenance_checks mc
     JOIN assets a ON a.id = mc.asset_id
     ${whereSql}`,
    params,
  );
  const total = count.rows[0]?.n || 0;
  const result = await query(
    `SELECT mc.id, mc.result, mc.repair_status, mc.repair_cost, mc.created_at, mc.completed_at, mc.checked_by,
            a.asset_code, a.category, a.status
     FROM maintenance_checks mc
     JOIN assets a ON a.id = mc.asset_id
     ${whereSql}
     ORDER BY ${clause}, mc.id DESC
     LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
    params,
  );
  const financial = !hideFinancials(user);
  const cols = [
    { key: 'assetCode', label: 'Asset' },
    { key: 'category', label: 'Category' },
    { key: 'result', label: 'Result' },
    { key: 'repairStatus', label: 'Repair' },
  ];
  if (financial) {
    cols.push({ key: 'repairCost', label: 'Repair cost' });
  }
  cols.push({ key: 'checkedBy', label: 'Checked by' }, { key: 'at', label: 'When' });
  return {
    columns: columns(cols),
    rows: result.rows.map((row) => {
      const item = {
        id: row.id,
        assetCode: row.asset_code,
        category: row.category,
        result: row.result,
        repairStatus: row.repair_status,
        checkedBy: row.checked_by,
        at: row.created_at,
        completedAt: row.completed_at,
      };
      if (financial) {
        item.repairCost = row.repair_cost;
      }
      return item;
    }),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    totals: { n: total },
    window: { from: from.toISOString(), to: to.toISOString() },
  };
}

async function exportMaintenanceHistory(queryIn, user) {
  const data = await runMaintenanceHistory({ ...queryIn, page: 1, limit: EXPORT_LIMIT + 1 }, user, { maxLimit: EXPORT_LIMIT + 1 });
  return data.rows.map((row) => {
    const item = {
      Asset: row.assetCode,
      Category: row.category,
      Result: row.result,
      Repair: row.repairStatus,
    };
    if (!hideFinancials(user)) {
      item['Repair cost'] = row.repairCost;
    }
    item['Checked by'] = row.checkedBy;
    item.When = istStamp(row.at);
    item.Completed = istStamp(row.completedAt);
    return item;
  });
}

const TICKET_SORT = {
  ticketCode: 't.ticket_code',
  employeeName: 'e.name',
  department: 'e.department',
  need: 't.category',
  status: 't.status',
  createdAt: 't.created_at',
};

async function runTicketHistory(queryIn, user, { maxLimit } = {}) {
  const { where, params, from, to } = historyWindow(queryIn, 't.created_at');
  pushEq(where, params, 'e.department', queryIn.department, DEPARTMENTS);
  const status = String(queryIn.status || '').trim();
  if (status && TICKET_LABELS[status]) {
    params.push(status);
    where.push(`t.status = $${params.length}`);
  }
  scopeTickets(user, where, params);
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const { clause } = orderBy(TICKET_SORT, queryIn, 'createdAt', 'DESC');
  const page = pageNumber(queryIn.page);
  const limit = pageLimit(queryIn.limit, maxLimit);
  const count = await query(
    `SELECT COUNT(*)::int AS n
     FROM tickets t
     LEFT JOIN employees e ON e.id = t.employee_id
     ${whereSql}`,
    params,
  );
  const total = count.rows[0]?.n || 0;
  const result = await query(
    `SELECT t.id, t.ticket_code, t.status, t.created_at, t.closed_at, t.category, t.quantity,
            e.name AS employee_name, e.employee_code, e.department
     FROM tickets t
     LEFT JOIN employees e ON e.id = t.employee_id
     ${whereSql}
     ORDER BY ${clause}, t.id DESC
     LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
    params,
  );
  return {
    columns: columns([
      { key: 'ticketCode', label: 'Ticket' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'department', label: 'Department' },
      { key: 'need', label: 'Need' },
      { key: 'status', label: 'Status' },
      { key: 'createdAt', label: 'Created' },
    ]),
    rows: result.rows.map((row) => ({
      id: row.id,
      ticketCode: row.ticket_code,
      employeeName: row.employee_name,
      employeeCode: row.employee_code,
      department: row.department,
      need: row.category ? `${row.category} × ${row.quantity || 1}` : '—',
      status: row.status,
      statusLabel: TICKET_LABELS[row.status] || row.status,
      createdAt: row.created_at,
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    totals: { n: total },
    window: { from: from.toISOString(), to: to.toISOString() },
  };
}

async function exportTicketHistory(queryIn, user) {
  const data = await runTicketHistory({ ...queryIn, page: 1, limit: EXPORT_LIMIT + 1 }, user, { maxLimit: EXPORT_LIMIT + 1 });
  return data.rows.map((row) => ({
    Ticket: row.ticketCode,
    Employee: row.employeeName,
    'Employee ID': row.employeeCode,
    Department: row.department,
    Need: row.need === '—' ? '' : row.need,
    Status: row.statusLabel,
    Created: istStamp(row.createdAt),
  }));
}

const TRANSACTION_SORT = {
  at: 'at',
  kind: 'kind',
  ref: 'ref',
  assetCode: 'asset_code',
  who: 'who',
  department: 'department',
  category: 'category',
};

function transactionSql(queryIn, user) {
  const { from, to } = resolveWindow(queryIn);
  const params = [from.toISOString(), to.toISOString()];
  let ownSql = '';
  if (ownHistory(user)) {
    params.push(user.id);
    ownSql = `AND actor_id = $${params.length}`;
  }
  const extra = [];
  if (queryIn.category && CATEGORIES.includes(queryIn.category)) {
    params.push(queryIn.category);
    extra.push(`AND category = $${params.length}`);
  }
  if (queryIn.department && DEPARTMENTS.includes(queryIn.department)) {
    params.push(queryIn.department);
    extra.push(`AND department = $${params.length}`);
  }
  const extraSql = extra.join(' ');
  const sql = `
    SELECT * FROM (
      SELECT aa.id::text AS id, 'Assignment' AS kind, aa.assigned_at AS at,
             a.asset_code, a.category, e.name AS who, e.department,
             aa.assignment_code AS ref, aa.assigned_by_user_id AS actor_id
      FROM asset_assignments aa
      JOIN assets a ON a.id = aa.asset_id
      JOIN employees e ON e.id = aa.employee_id
      UNION ALL
      SELECT aa.id::text || ':r', 'Return', aa.returned_at,
             a.asset_code, a.category, e.name, e.department, aa.assignment_code,
             aa.assigned_by_user_id
      FROM asset_assignments aa
      JOIN assets a ON a.id = aa.asset_id
      JOIN employees e ON e.id = aa.employee_id
      WHERE aa.returned_at IS NOT NULL
      UNION ALL
      SELECT mc.id::text, 'Maintenance', mc.created_at,
             a.asset_code, a.category, mc.checked_by, NULL, mc.result,
             mc.checked_by_user_id
      FROM maintenance_checks mc
      JOIN assets a ON a.id = mc.asset_id
      UNION ALL
      SELECT t.id::text, 'Ticket', t.created_at,
             NULL, t.category, e.name, e.department, t.ticket_code,
             t.created_by_user_id
      FROM tickets t
      LEFT JOIN employees e ON e.id = t.employee_id
    ) x
    WHERE at >= $1 AND at <= $2 ${ownSql} ${extraSql}
  `;
  return { sql, params, from, to };
}

async function runTransactions(queryIn, user, { maxLimit } = {}) {
  const { sql, params, from, to } = transactionSql(queryIn, user);
  const { clause } = orderBy(TRANSACTION_SORT, queryIn, 'at', 'DESC');
  const page = pageNumber(queryIn.page);
  const limit = pageLimit(queryIn.limit, maxLimit);
  const counted = await query(`SELECT COUNT(*)::int AS n FROM (${sql}) q`, params);
  const total = counted.rows[0]?.n || 0;
  const result = await query(`${sql} ORDER BY ${clause}, id DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`, params);
  return {
    columns: columns([
      { key: 'at', label: 'When' },
      { key: 'kind', label: 'Type' },
      { key: 'ref', label: 'Reference' },
      { key: 'assetCode', label: 'Asset' },
      { key: 'who', label: 'Who' },
      { key: 'department', label: 'Department' },
    ]),
    rows: result.rows.map((row) => ({
      id: row.id,
      at: row.at,
      kind: row.kind,
      ref: row.ref,
      assetCode: row.asset_code,
      category: row.category,
      who: row.who,
      department: row.department,
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    totals: { n: total },
    window: { from: from.toISOString(), to: to.toISOString() },
  };
}

async function exportTransactions(queryIn, user) {
  const data = await runTransactions({ ...queryIn, page: 1, limit: EXPORT_LIMIT + 1 }, user, { maxLimit: EXPORT_LIMIT + 1 });
  return data.rows.map((row) => ({
    When: istStamp(row.at),
    Type: row.kind,
    Reference: row.ref,
    Asset: row.assetCode,
    Who: row.who,
    Department: row.department,
  }));
}

function activityBase(queryIn, user, extraWhere = []) {
  const { from, to } = resolveWindow(queryIn);
  const where = ['l.created_at >= $1', 'l.created_at <= $2'];
  const params = [from.toISOString(), to.toISOString()];
  if (ownActivity(user)) {
    params.push(user.id);
    where.push(`l.user_id = $${params.length}`);
  }
  extraWhere.forEach((clause) => where.push(clause));
  pushEq(where, params, 'e.department', queryIn.department, DEPARTMENTS);
  return { where, params, from, to };
}

const ACTIVITY_FROM = `
  FROM activity_log l
  LEFT JOIN users u ON u.id = l.user_id
  LEFT JOIN employees e ON e.user_id = u.id
`;

const ACTIVITY_SORT = {
  at: 'l.created_at',
  userName: 'u.name',
  role: 'l.role',
  module: 'l.module',
  action: 'l.action',
  description: 'l.description',
  department: 'e.department',
};

async function runUserActivity(queryIn, user, { loginOnly, maxLimit } = {}) {
  const extra = loginOnly ? [`l.action IN ('Login', 'Logout')`] : [];
  const { where, params, from, to } = activityBase(queryIn, user, extra);
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const { clause } = orderBy(ACTIVITY_SORT, queryIn, 'at', 'DESC');
  const page = pageNumber(queryIn.page);
  const limit = pageLimit(queryIn.limit, maxLimit);
  const count = await query(`SELECT COUNT(*)::int AS n ${ACTIVITY_FROM} ${whereSql}`, params);
  const total = count.rows[0]?.n || 0;
  const result = await query(
    `SELECT l.id, l.created_at, l.module, l.action, l.description, l.role,
            u.name AS user_name, e.department
     ${ACTIVITY_FROM} ${whereSql}
     ORDER BY ${clause}, l.id DESC
     LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
    params,
  );
  return {
    columns: columns([
      { key: 'at', label: 'When' },
      { key: 'userName', label: 'User' },
      { key: 'role', label: 'Role' },
      { key: 'module', label: 'Module' },
      { key: 'action', label: 'Activity' },
      { key: 'description', label: 'Description' },
    ]),
    rows: result.rows.map((row) => ({
      id: row.id,
      at: row.created_at,
      userName: row.user_name || 'System',
      role: row.role,
      roleLabel: roleLabel(row.role),
      module: row.module,
      action: row.action,
      actionLabel: actionLabel(row.action),
      description: row.description,
      department: row.department,
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    totals: { n: total },
    window: { from: from.toISOString(), to: to.toISOString() },
  };
}

async function exportUserActivity(queryIn, user, { loginOnly } = {}) {
  const data = await runUserActivity({ ...queryIn, page: 1, limit: EXPORT_LIMIT + 1 }, user, { loginOnly, maxLimit: EXPORT_LIMIT + 1 });
  return data.rows.map((row) => ({
    When: istStamp(row.at),
    User: row.userName,
    Role: row.roleLabel,
    Department: row.department,
    Module: row.module,
    Activity: row.actionLabel,
    Description: row.description,
  }));
}

const DEPARTMENT_SORT = {
  department: 'department',
  users: 'users',
  count: 'n',
};

async function runDepartmentSummary(queryIn, user) {
  const { where, params, from, to } = activityBase(queryIn, user);
  const { clause } = orderBy(DEPARTMENT_SORT, queryIn, 'count', 'DESC');
  const result = await query(
    `SELECT COALESCE(e.department, '—') AS department, COUNT(*)::int AS n,
            COUNT(DISTINCT l.user_id)::int AS users
     ${ACTIVITY_FROM}
     WHERE ${where.join(' AND ')}
     GROUP BY COALESCE(e.department, '—')
     ORDER BY ${clause}, department`,
    params,
  );
  const total = result.rows.reduce((sum, row) => sum + row.n, 0);
  return {
    columns: columns([
      { key: 'department', label: 'Department' },
      { key: 'users', label: 'People' },
      { key: 'count', label: 'Actions' },
    ]),
    rows: result.rows.map((row) => ({
      id: row.department,
      department: row.department,
      users: row.users,
      count: row.n,
    })),
    total: result.rows.length,
    page: 1,
    pages: 1,
    totals: { n: total },
    window: { from: from.toISOString(), to: to.toISOString() },
  };
}

const PERFORMANCE_SORT = {
  userName: 'user_name',
  role: 'role',
  department: 'department',
  count: 'n',
};

async function runPerformance(queryIn, user) {
  const { where, params, from, to } = activityBase(queryIn, user);
  const { clause } = orderBy(PERFORMANCE_SORT, queryIn, 'count', 'DESC');
  const result = await query(
    `SELECT COALESCE(u.name, u.email, 'System') AS user_name, l.role,
            COALESCE(e.department, '—') AS department, COUNT(*)::int AS n
     ${ACTIVITY_FROM}
     WHERE ${where.join(' AND ')}
     GROUP BY COALESCE(u.name, u.email, 'System'), l.role, COALESCE(e.department, '—')
     ORDER BY ${clause}, user_name`,
    params,
  );
  const total = result.rows.reduce((sum, row) => sum + row.n, 0);
  return {
    columns: columns([
      { key: 'userName', label: 'User' },
      { key: 'role', label: 'Role' },
      { key: 'department', label: 'Department' },
      { key: 'count', label: 'Actions' },
    ]),
    rows: result.rows.map((row, i) => ({
      id: `${row.user_name}-${i}`,
      userName: row.user_name,
      role: row.role,
      roleLabel: roleLabel(row.role),
      department: row.department,
      count: row.n,
    })),
    total: result.rows.length,
    page: 1,
    pages: 1,
    totals: { n: total },
    window: { from: from.toISOString(), to: to.toISOString() },
  };
}

async function runReport(spec, queryIn, user) {
  if (spec.group === 'asset') {
    return runAsset(spec, queryIn);
  }
  if (spec.slug === 'assignment') {
    return runAssignmentHistory(queryIn, user, { returned: false });
  }
  if (spec.slug === 'return') {
    return runAssignmentHistory(queryIn, user, { returned: true });
  }
  if (spec.slug === 'employee-asset') {
    return runEmployeeAsset(queryIn, user);
  }
  if (spec.group === 'history' && spec.slug === 'maintenance') {
    return runMaintenanceHistory(queryIn, user);
  }
  if (spec.slug === 'ticket') {
    return runTicketHistory(queryIn, user);
  }
  if (spec.slug === 'transaction') {
    return runTransactions(queryIn, user);
  }
  if (spec.slug === 'activity') {
    return runUserActivity(queryIn, user);
  }
  if (spec.slug === 'login') {
    return runUserActivity(queryIn, user, { loginOnly: true });
  }
  if (spec.slug === 'department') {
    return runDepartmentSummary(queryIn, user);
  }
  if (spec.slug === 'performance') {
    return runPerformance(queryIn, user);
  }
  const err = new Error('Unknown report');
  err.statusCode = 404;
  throw err;
}

async function exportRows(spec, queryIn, user) {
  if (spec.group === 'asset') {
    return allAssetRows(spec, queryIn);
  }
  if (spec.slug === 'assignment') {
    return exportAssignmentHistory(queryIn, user, { returned: false });
  }
  if (spec.slug === 'return') {
    return exportAssignmentHistory(queryIn, user, { returned: true });
  }
  if (spec.slug === 'employee-asset') {
    return exportEmployeeAsset(queryIn, user);
  }
  if (spec.group === 'history' && spec.slug === 'maintenance') {
    return exportMaintenanceHistory(queryIn, user);
  }
  if (spec.slug === 'ticket') {
    return exportTicketHistory(queryIn, user);
  }
  if (spec.slug === 'transaction') {
    return exportTransactions(queryIn, user);
  }
  if (spec.slug === 'activity') {
    return exportUserActivity(queryIn, user);
  }
  if (spec.slug === 'login') {
    return exportUserActivity(queryIn, user, { loginOnly: true });
  }
  if (spec.slug === 'department') {
    const data = await runDepartmentSummary(queryIn, user);
    return data.rows.map((row) => ({ Department: row.department, People: row.users, Actions: row.count }));
  }
  if (spec.slug === 'performance') {
    const data = await runPerformance(queryIn, user);
    return data.rows.map((row) => ({
      User: row.userName,
      Role: row.roleLabel,
      Department: row.department,
      Actions: row.count,
    }));
  }
  return [];
}

function catalog(_req, res) {
  if (!canRead(_req.user)) {
    return res.status(403).json({ ok: false, error: 'Not allowed for this role' });
  }
  res.json({
    ok: true,
    groups: CATALOG,
    exportLimit: EXPORT_LIMIT,
    filters: {
      categories: CATEGORIES,
      departments: DEPARTMENTS,
      assetStatuses: Object.keys(STATUS).map((value) => ({ value, label: STATUS_LABELS[value] })),
      ticketStatuses: Object.entries(TICKET_LABELS).map(([value, label]) => ({ value, label })),
    },
  });
}

async function run(req, res) {
  if (!canRead(req.user)) {
    return res.status(403).json({ ok: false, error: 'Not allowed for this role' });
  }
  const spec = findReport(req.params.group, req.params.slug);
  if (!spec) {
    return res.status(404).json({ ok: false, error: 'Report not found' });
  }
  try {
    const data = await runReport(spec, req.query, req.user);
    res.json({
      ok: true,
      group: spec.group,
      slug: spec.slug,
      title: spec.title,
      uses: spec.uses || {},
      snapshot: Boolean(spec.snapshot),
      defaultSort: spec.defaultSort || null,
      ...data,
    });
  } catch (err) {
    console.error('Report failed:', err);
    res.status(err.statusCode || 500).json({ ok: false, error: err.statusCode ? err.message : 'Could not run report' });
  }
}

async function exportCsv(req, res) {
  if (!canRead(req.user)) {
    return res.status(403).json({ ok: false, error: 'Not allowed for this role' });
  }
  const spec = findReport(req.params.group, req.params.slug);
  if (!spec) {
    return res.status(404).json({ ok: false, error: 'Report not found' });
  }
  try {
    // Ask for one row past the cap: without it, a result of exactly
    // EXPORT_LIMIT rows is indistinguishable from one that was cut short, and
    // the caller is handed a short file believing it is the whole set.
    const fetched = await exportRows(spec, req.query, req.user);
    const truncated = fetched.length > EXPORT_LIMIT;
    const rows = truncated ? fetched.slice(0, EXPORT_LIMIT) : fetched;
    const headers = rows[0] ? Object.keys(rows[0]) : ['Empty'];
    const lines = [
      headers.map(csvCell).join(','),
      ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(',')),
    ];
    await logActivity({
      user: req.user,
      module: 'Reports',
      action: 'Export',
      description: `Exported ${spec.title} (${rows.length} rows${truncated ? `, capped at ${EXPORT_LIMIT}` : ''})`,
      entityType: 'Report',
      ip: req.ip,
    });
    const file = `${spec.group}-${spec.slug}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
    res.setHeader('X-Export-Limit', String(EXPORT_LIMIT));
    res.setHeader('X-Export-Truncated', truncated ? 'true' : 'false');
    res.send(`\uFEFF${lines.join('\n')}\n`);
  } catch (err) {
    console.error('Report export failed:', err);
    res.status(500).json({ ok: false, error: 'Could not export report' });
  }
}

module.exports = { catalog, run, exportCsv };
