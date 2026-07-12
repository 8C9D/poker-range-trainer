/** Small date/format helpers for the Coach UI. All take explicit "now" inputs. */

/**
 * A compact relative day description for list rows: 'today', 'yesterday',
 * 'Nd ago'; same-day and future timestamps are both 'today'. Empty or
 * invalid input yields ''.
 */
export function formatDayDistance(iso: string, nowIso: string): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  const now = new Date(nowIso).getTime()
  if (Number.isNaN(then) || Number.isNaN(now)) return ''
  const days = Math.floor((now - then) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

/** The Today screen's date line, e.g. "Friday, July 11". */
export function formatDateLine(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

/** Time-of-day greeting for the Today heading. */
export function greetingFor(date: Date): string {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
