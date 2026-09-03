/**
 * The IANA zone this browser believes it is in, e.g. `Europe/Berlin`.
 *
 * Today and Progress bucket practice into calendar days — a streak, a daily
 * goal, "hands this week" — and a day only means something in a zone. The
 * server owns the counting but not the zone, so the client names it on every
 * read rather than letting the API guess from an IP or the server's own clock.
 *
 * `UTC` is the fallback because it is the one zone every host has installed:
 * an environment that cannot resolve its own zone (a locked-down runtime, an
 * ICU-less build) should still get a coherent day boundary rather than a
 * rejected request.
 */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}
