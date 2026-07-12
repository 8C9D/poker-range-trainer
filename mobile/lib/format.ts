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
 * A compact relative day description for list rows: 'today', 'yesterday', 'Nd ago';
 * same-day and future timestamps are both 'today'. Empty or invalid input yields ''.
 */
export function formatDayDistance(iso: string, nowIso: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const now = new Date(nowIso).getTime();
  if (Number.isNaN(then) || Number.isNaN(now)) return '';
  const days = Math.floor((now - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
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
