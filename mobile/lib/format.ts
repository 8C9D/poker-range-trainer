// Small date/format helpers for the Coach UI — the mobile port of the web app's
// src/app/format.ts (which is web-only, not part of the @core API). All take explicit
// "now" inputs. Date-line formatting is done from name tables rather than Intl so it is
// deterministic and independent of Hermes' Intl build.

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/**
 * A compact relative day description for list rows: 'today', 'yesterday', 'Nd ago',
 * counted in local calendar days. Same-day and future timestamps are both 'today'.
 * Empty or invalid input yields ''.
 */
export function formatDayDistance(iso: string, nowIso: string): string {
  if (!iso) return '';
  const then = new Date(iso);
  const now = new Date(nowIso);
  if (Number.isNaN(then.getTime()) || Number.isNaN(now.getTime())) return '';
  // Calendar days apart, not 24-hour buckets: an 11pm session is "yesterday" the next
  // morning, not "today". Local midnights (like the greeting) and rounded so a DST
  // shift can't turn a whole day into 0 or 2.
  const days = Math.round((startOfLocalDay(now) - startOfLocalDay(then)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** The Today screen's date line, e.g. "Friday, July 11". */
export function formatDateLine(date: Date): string {
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** Time-of-day greeting for the Today heading. */
export function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
