/**
 * The whole product reports in India Standard Time.
 *
 * Day boundaries used to be resolved in UTC, which put every "day" 5½ hours
 * out: a range picked as 31 Aug actually ran from 05:30 on the 31st to 05:29
 * on the 1st, so the morning's own events were missing from it. IST has a
 * fixed +05:30 offset and no daylight saving, so a literal offset is exact —
 * and it keeps the comparisons plain timestamptz ones the index can serve,
 * which `AT TIME ZONE` in the WHERE clause would not.
 */

const APP_TIME_ZONE = 'Asia/Kolkata';
const APP_UTC_OFFSET = '+05:30';
const APP_TIME_ZONE_LABEL = 'IST';

const DAY_RE = /^(\d{4}-\d{2}-\d{2})/;

function dayPart(value) {
  const match = String(value || '').trim().match(DAY_RE);
  return match ? match[1] : null;
}

/** First instant of an IST calendar day. */
function dayStart(value) {
  const day = dayPart(value);
  return day ? new Date(`${day}T00:00:00.000${APP_UTC_OFFSET}`) : null;
}

/** Last instant of an IST calendar day. */
function dayEnd(value) {
  const day = dayPart(value);
  return day ? new Date(`${day}T23:59:59.999${APP_UTC_OFFSET}`) : null;
}

const PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function partsOf(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  const out = {};
  for (const part of PARTS.formatToParts(d)) {
    out[part.type] = part.value;
  }
  return out;
}

/** YYYY-MM-DD for the IST day a moment falls on. */
function istDay(value = new Date()) {
  const parts = partsOf(value);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : '';
}

/**
 * "2026-08-31 14:35:02 +05:30" for exports. The offset is spelled out because
 * a bare timestamp in a CSV is read as whatever the reader's machine assumes.
 */
function istStamp(value) {
  const parts = partsOf(value);
  if (!parts) {
    return '';
  }
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} ${APP_UTC_OFFSET}`;
}

/** Calendar day arithmetic on a YYYY-MM-DD string. */
function addDays(value, days) {
  const day = dayPart(value);
  if (!day) {
    return '';
  }
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Calendar month arithmetic on a YYYY-MM-DD string. Clamps to the end of a
 * shorter month, so 31 March minus one month is 28 February, not 3 March.
 */
function addMonths(value, months) {
  const day = dayPart(value);
  if (!day) {
    return '';
  }
  const [y, m, d] = day.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/**
 * How far back the log stays queryable, and how wide one query may reach.
 *
 * These are two different limits and the PRD sets both: rows stay online for
 * 24 months (§12.8, and the NFR retention row), but any single query spans at
 * most 90 days (risk register — "Monthly partitioning, 90-day query cap,
 * keyset pagination, archival"). You reach older data by moving the 90-day
 * window backwards, not by widening it, so the scan stays bounded however
 * large the table grows.
 */
const WINDOW_DAYS = 90;
const ONLINE_MONTHS = 24;

/**
 * A YYYY-MM-DD from a client names an IST calendar day. Anything else is
 * taken as an instant and used as sent.
 */
function dayBound(value, endOfDay) {
  const bound = endOfDay ? dayEnd(value) : dayStart(value);
  if (bound) {
    return bound;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Resolves ?from/?to into an instant range, applying both limits above.
 * `spanCapped` tells the caller the request asked for more than it got, so a
 * client that ignored the cap can say so rather than quietly showing less.
 */
function resolveWindow(queryIn = {}) {
  const now = new Date();
  let to = dayBound(queryIn.to, true) || now;
  if (to > now) {
    to = now;
  }
  const requestedFrom = dayBound(queryIn.from, false);
  let from = requestedFrom || dayStart(addDays(istDay(to), -(WINDOW_DAYS - 1)));

  if (to < from) {
    const swap = from;
    from = to;
    to = swap;
  }

  // Retention is measured from today, not from the requested end date — rows
  // age out of the online window as the clock moves, wherever the query points.
  const oldest = dayStart(addMonths(istDay(now), -ONLINE_MONTHS));
  const outsideRetention = to < oldest;
  if (from < oldest) {
    from = oldest;
  }

  const widest = dayStart(addDays(istDay(to), -(WINDOW_DAYS - 1)));
  const spanCapped = from < widest;
  if (spanCapped) {
    from = widest;
  }

  // A range entirely before the online window leaves from > to, so the query
  // returns nothing — which is the truth: that data is archived, not missing.
  return {
    from,
    to,
    spanCapped,
    outsideRetention,
    windowDays: WINDOW_DAYS,
    onlineMonths: ONLINE_MONTHS,
  };
}

module.exports = {
  APP_TIME_ZONE,
  APP_TIME_ZONE_LABEL,
  APP_UTC_OFFSET,
  addDays,
  addMonths,
  dayBound,
  dayEnd,
  dayStart,
  istDay,
  istStamp,
  ONLINE_MONTHS,
  resolveWindow,
  WINDOW_DAYS,
};
