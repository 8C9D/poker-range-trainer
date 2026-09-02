/** Milliseconds in a fixed 24-hour interval. */
export const DAY_MS = 86_400_000

/**
 * The local calendar-day number for an ISO timestamp.
 *
 * Subtracting the offset turns the instant into its local wall-clock time before
 * bucketing it. Unlike dividing the raw UTC timestamp by 24 hours, this keeps
 * "today" aligned with midnight on the user's device.
 */
export function localCalendarDay(iso: string): number | null {
  const date = new Date(iso)
  const timestamp = date.getTime()
  if (!Number.isFinite(timestamp)) return null
  return Math.floor((timestamp - date.getTimezoneOffset() * 60_000) / DAY_MS)
}

/** Start of the local day containing `iso`, as an ISO timestamp. */
export function localDayStart(iso: string): string | null {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}
