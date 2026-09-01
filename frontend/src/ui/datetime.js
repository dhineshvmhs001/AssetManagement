/**
 * Every date this app shows, and every day boundary it asks the API for, is
 * resolved in India Standard Time — not in whatever timezone the browser
 * happens to sit in. Two people looking at the same log should be reading the
 * same rows under the same day headings.
 *
 * Two kinds of value live here and they are not interchangeable:
 *   - an *instant* (what the API stores): formatted through IST.
 *   - a *calendar day* string, YYYY-MM-DD (what the filters send): pure
 *     calendar arithmetic, done in UTC so no local offset can shift it.
 */

export const APP_TIME_ZONE = 'Asia/Kolkata';
export const APP_TIME_ZONE_LABEL = 'IST';

const DAY_RE = /^(\d{4}-\d{2}-\d{2})/;

const DAY_PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function toDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** YYYY-MM-DD for the IST day an instant falls on. Defaults to right now. */
export function istDay(value = new Date()) {
  const d = toDate(value);
  if (!d) {
    return '';
  }
  const parts = {};
  for (const part of DAY_PARTS.formatToParts(d)) {
    parts[part.type] = part.value;
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// ---------------------------------------------------------------------------
// Calendar-day arithmetic. A YYYY-MM-DD is a label, not a moment, so it is
// parsed and rebuilt in UTC — `new Date('2026-08-31')` in a negative-offset
// timezone is the 30th, and that is how off-by-one days get shipped.
// ---------------------------------------------------------------------------

function dayToUtc(iso) {
  const match = String(iso || '').match(DAY_RE);
  return match ? new Date(`${match[1]}T00:00:00Z`) : null;
}

function utcToDay(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso, days) {
  const d = dayToUtc(iso);
  if (!d) {
    return '';
  }
  d.setUTCDate(d.getUTCDate() + days);
  return utcToDay(d);
}

/** Clamps to the end of a shorter month: 31 March minus one month is 28 Feb. */
export function addMonths(iso, months) {
  const d = dayToUtc(iso);
  if (!d) {
    return '';
  }
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return utcToDay(target);
}

export function startOfMonth(iso) {
  const d = dayToUtc(iso);
  if (!d) {
    return '';
  }
  d.setUTCDate(1);
  return utcToDay(d);
}

export function endOfMonth(iso) {
  const d = dayToUtc(iso);
  if (!d) {
    return '';
  }
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return utcToDay(d);
}

export function weekdayIndex(iso) {
  const d = dayToUtc(iso);
  // Monday-first, matching the calendar grid.
  return d ? (d.getUTCDay() + 6) % 7 : 0;
}

export function dayOfMonth(iso) {
  return Number(String(iso).slice(8, 10));
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

const DATE_STYLE = { day: 'numeric', month: 'short', year: 'numeric' };
const TIME_STYLE = { hour: '2-digit', minute: '2-digit' };

/** Formats a calendar-day string as itself — no timezone conversion applies. */
export function formatDay(iso, options = DATE_STYLE) {
  const d = dayToUtc(iso);
  return d ? d.toLocaleDateString(undefined, { ...options, timeZone: 'UTC' }) : '—';
}

/** "31 Aug 2026" for the IST day an instant falls on. */
export function formatDate(value, options = DATE_STYLE) {
  const d = toDate(value);
  return d ? d.toLocaleDateString(undefined, { ...options, timeZone: APP_TIME_ZONE }) : '—';
}

/** "14:35" in IST. */
export function formatTime(value, options = TIME_STYLE) {
  const d = toDate(value);
  return d ? d.toLocaleTimeString(undefined, { ...options, timeZone: APP_TIME_ZONE }) : '—';
}

/** "31 Aug 2026, 14:35" in IST — for anywhere a single string is wanted. */
export function formatDateTime(value) {
  const d = toDate(value);
  return d ? `${formatDate(d)}, ${formatTime(d)}` : '—';
}

/**
 * A day range as one phrase. The year is stated once when both ends share it,
 * which is the common case and keeps the trigger button on a single line.
 */
export function formatDayRange(from, to) {
  if (!from && !to) {
    return '—';
  }
  if (!to || from === to) {
    return formatDay(from || to);
  }
  const sameYear = String(from).slice(0, 4) === String(to).slice(0, 4);
  const start = sameYear ? formatDay(from, { day: 'numeric', month: 'short' }) : formatDay(from);
  return `${start} – ${formatDay(to)}`;
}

/** Inclusive day count, the way people count "how long is this range". */
export function daysBetween(from, to) {
  const a = dayToUtc(from);
  const b = dayToUtc(to);
  if (!a || !b) {
    return 0;
  }
  return Math.round(Math.abs(b - a) / 86400000) + 1;
}
