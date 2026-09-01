/**
 * The one place a status becomes a colour.
 *
 * Colouring a status at the call site is how two screens end up disagreeing
 * about whether "Pending pre-check" is amber or grey. Everything that renders
 * a status goes through here.
 */

export const TONES = ['success', 'danger', 'warning', 'info', 'neutral'];

// Statuses this app actually stores, spelled exactly as the API sends them.
const EXPLICIT = {
  // Assets
  AVAILABLE: 'success',
  ASSIGNED: 'info',
  PENDING_PRECHECK: 'warning',
  MAINTENANCE: 'warning',
  DAMAGED: 'danger',
  LOST: 'danger',
  RETIRED: 'neutral',
  // Tickets
  AWAITING_MANAGER: 'warning',
  WITH_ASSET_MANAGER: 'info',
  WITH_ASSET_TEAM: 'info',
  CLOSED: 'neutral',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
  APPROVED: 'success',
  // People and records
  ACTIVE: 'success',
  INACTIVE: 'neutral',
};

// Fallback for statuses added later — better a sensible guess than a crash,
// but anything meaningful belongs in EXPLICIT above.
const KEYWORDS = [
  [/(fail|reject|damag|lost|error|overdue|breach|cancel)/, 'danger'],
  [/(await|pending|hold|review|due|expir|maint)/, 'warning'],
  [/(complete|approv|resolved|done|available|paid|success|active)/, 'success'],
  [/(progress|assigned|open|with_|in_)/, 'info'],
  [/(closed|retired|archiv|inactive|draft|unknown)/, 'neutral'],
];

export function statusTone(value) {
  const key = String(value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (!key) {
    return 'neutral';
  }
  if (EXPLICIT[key]) {
    return EXPLICIT[key];
  }
  const lower = key.toLowerCase();
  const hit = KEYWORDS.find(([re]) => re.test(lower));
  return hit ? hit[1] : 'neutral';
}

/** Turns AWAITING_MANAGER into "Awaiting manager" when the API sends no label. */
export function statusLabel(value) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return '';
  }
  const words = raw.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Each of these is a fixed map too, for the same reason: one value, one colour,
// everywhere in the app.
const ROLE_TONES = {
  ADMIN: 'danger',
  MANAGER: 'warning',
  ASSET_MANAGER: 'info',
  ASSET_TEAM: 'info',
  EMPLOYEE: 'neutral',
};

const PRIORITY_TONES = {
  URGENT: 'danger',
  HIGH: 'danger',
  MEDIUM: 'warning',
  NORMAL: 'info',
  LOW: 'neutral',
};

// The activity log's verbs. Same rule as statuses: one action, one colour, so
// "Reject" is never red on one screen and grey on the next.
const ACTION_TONES = {
  CREATE: 'success',
  APPROVE: 'success',
  ASSIGN: 'info',
  UPDATE: 'info',
  IMPORT: 'info',
  UNASSIGN: 'warning',
  STATUS_CHANGE: 'warning',
  REJECT: 'danger',
  ACKNOWLEDGE: 'success',
  TRANSFER: 'info',
  REPLACE: 'warning',
  ALLOCATE: 'info',
  CLOSE: 'neutral',
  CANCEL: 'danger',
  DEACTIVATE: 'warning',
  PRE_CHECK: 'warning',
  REPAIR: 'warning',
  FINAL_CHECK: 'success',
  EXPORT: 'neutral',
  LOGIN: 'neutral',
  LOGOUT: 'neutral',
};

export function actionTone(value) {
  const key = String(value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return ACTION_TONES[key] || 'neutral';
}

export function roleTone(value) {
  return ROLE_TONES[String(value ?? '').toUpperCase()] || 'neutral';
}

export function priorityTone(value) {
  return PRIORITY_TONES[String(value ?? '').toUpperCase()] || 'neutral';
}
