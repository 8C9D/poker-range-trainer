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

/**
 * A calendar to count days in.
 *
 * `localCalendarDay` answers "which day is this instant on" for the machine the
 * code happens to run on, which is the right answer on a phone and the wrong one
 * on a server: the API buckets a user's streak, goal and charts by the day THEY
 * were living in, which the process's own zone knows nothing about. Every
 * bucketing helper therefore takes one of these, defaulting to the local one so
 * the on-device callers keep their exact behaviour.
 */
export interface CalendarDays {
  /** The calendar-day number for an ISO timestamp, or null when it cannot be read. */
  dayNumber(iso: string): number | null
}

/** The process-local calendar — the historical (and default) bucketing. */
export const localCalendarDays: CalendarDays = { dayNumber: localCalendarDay }

/**
 * A calendar that buckets by wall-clock days in `timeZone` (an IANA identifier
 * such as `Pacific/Auckland`).
 *
 * The zone's wall-clock date and time are read back through `Intl` and then
 * treated as if they were UTC, which is exactly what `localCalendarDay` does
 * with the process offset — so the two produce the same numbers whenever the
 * zone matches the machine, and day numbers stay comparable across calendars.
 *
 * Throws `RangeError` for a zone this runtime does not know; callers validate
 * the identifier by constructing one.
 */
export function zonedCalendarDays(timeZone: string): CalendarDays {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  return {
    dayNumber(iso: string): number | null {
      const date = new Date(iso)
      if (!Number.isFinite(date.getTime())) return null
      const parts = new Map(
        formatter.formatToParts(date).map((part) => [part.type, part.value] as const),
      )
      // A part the formatter did not produce reads back as NaN and fails the guard.
      const partValue = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.get(type))
      const year = partValue('year')
      const month = partValue('month')
      const day = partValue('day')
      const hour = partValue('hour')
      const minute = partValue('minute')
      const second = partValue('second')
      if (![year, month, day, hour, minute, second].every((value) => Number.isFinite(value))) {
        return null
      }
      return Math.floor(Date.UTC(year, month - 1, day, hour, minute, second) / DAY_MS)
    },
  }
}

/** The `YYYY-MM-DD` calendar date a day number stands for. */
export function isoDateOfDayNumber(dayNumber: number): string {
  return new Date(dayNumber * DAY_MS).toISOString().slice(0, 10)
}
