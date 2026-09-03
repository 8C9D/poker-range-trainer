import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  DAY_MS,
  isoDateOfDayNumber,
  localCalendarDay,
  localCalendarDays,
  localDayStart,
  zonedCalendarDays,
} from './calendarDay'

/**
 * Every "did I practice today" question in the app funnels through these two
 * helpers — the streak, the daily goal, the hands-per-day chart, the weekly
 * accuracy trend, and whether the daily workout is already done. They are the
 * only piece of the domain with no tests of their own, which is backwards: a
 * wrong day boundary here does not throw or look broken, it just silently
 * credits a session to the wrong day and the numbers stay plausible.
 *
 * The cases build their timestamps with the local-time `Date` constructor and
 * compare results to each other, so they assert the same thing in any zone the
 * suite happens to run in. The one case that has to pin an offset stubs
 * `getTimezoneOffset` instead of relying on where the machine is.
 */

afterEach(() => {
  vi.restoreAllMocks()
})

/** An ISO timestamp for a local wall-clock time, whatever the machine's zone. */
function localIso(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): string {
  return new Date(year, month - 1, day, hour, minute, second).toISOString()
}

describe('localCalendarDay', () => {
  it('gives the same day number to every hour of one local day', () => {
    const justAfterMidnight = localCalendarDay(localIso(2026, 6, 15, 0, 0, 1))
    expect(localCalendarDay(localIso(2026, 6, 15, 12))).toBe(justAfterMidnight)
    expect(localCalendarDay(localIso(2026, 6, 15, 23, 59, 59))).toBe(justAfterMidnight)
  })

  it('advances by exactly one across local midnight', () => {
    const before = localCalendarDay(localIso(2026, 6, 15, 23, 59, 59))
    const after = localCalendarDay(localIso(2026, 6, 16, 0, 0, 1))
    expect(after).toBe((before ?? 0) + 1)
  })

  it('counts whole days between two dates', () => {
    const first = localCalendarDay(localIso(2026, 6, 1, 9))
    const last = localCalendarDay(localIso(2026, 6, 30, 21))
    expect((last ?? 0) - (first ?? 0)).toBe(29)
  })

  /**
   * The reason this helper exists at all. Dividing the raw UTC timestamp by 24h
   * would split the day at UTC midnight, which for a player west of Greenwich
   * falls in the middle of their evening session — so an 8pm hand would start
   * tomorrow's streak and break today's.
   */
  it('splits the day at local midnight, not UTC midnight', () => {
    // UTC-5: the offset is the minutes to add to local time to reach UTC.
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(300)

    // Both are the evening of the 14th locally, either side of UTC midnight.
    const evening = localCalendarDay('2026-06-14T23:00:00.000Z') // 18:00 local
    const lateEvening = localCalendarDay('2026-06-15T03:00:00.000Z') // 22:00 local
    expect(lateEvening).toBe(evening)

    // And the boundary that does matter still moves the count on.
    expect(localCalendarDay('2026-06-15T05:00:00.000Z')).toBe((evening ?? 0) + 1) // 00:00 local
  })

  it('returns null for a timestamp it cannot read', () => {
    expect(localCalendarDay('not a date')).toBeNull()
    expect(localCalendarDay('')).toBeNull()
  })
})

describe('localDayStart', () => {
  it('returns the instant local midnight began', () => {
    const start = localDayStart(localIso(2026, 6, 15, 17, 42))
    expect(start).not.toBeNull()
    const asDate = new Date(start as string)
    expect(asDate.getFullYear()).toBe(2026)
    expect(asDate.getMonth()).toBe(5)
    expect(asDate.getDate()).toBe(15)
    expect(asDate.getHours()).toBe(0)
    expect(asDate.getMinutes()).toBe(0)
    expect(asDate.getSeconds()).toBe(0)
    expect(asDate.getMilliseconds()).toBe(0)
  })

  it('gives the same start for any time within the day', () => {
    expect(localDayStart(localIso(2026, 6, 15, 0, 0, 1))).toBe(
      localDayStart(localIso(2026, 6, 15, 23, 59, 59)),
    )
  })

  it('returns null for a timestamp it cannot read', () => {
    expect(localDayStart('not a date')).toBeNull()
  })
})

describe('the two helpers together', () => {
  /**
   * `dailyHandCounts` and `weeklyAccuracyTrend` bucket with one and label with
   * the other, so a day whose start fell in the previous bucket would put every
   * chart column under the wrong date.
   */
  it('puts a day and its own start in the same bucket', () => {
    for (const hour of [0, 6, 12, 23]) {
      const iso = localIso(2026, 6, 15, hour, 30)
      expect(localCalendarDay(localDayStart(iso) as string)).toBe(localCalendarDay(iso))
    }
  })
})

describe('DAY_MS', () => {
  it('is a fixed 24-hour interval', () => {
    expect(DAY_MS).toBe(24 * 60 * 60 * 1000)
  })
})

describe('localCalendarDays', () => {
  it('is the process-local helper behind the calendar interface', () => {
    const iso = localIso(2026, 6, 15, 9)
    expect(localCalendarDays.dayNumber(iso)).toBe(localCalendarDay(iso))
    expect(localCalendarDays.dayNumber('not a date')).toBeNull()
  })
})

/**
 * The server bucket. `localCalendarDay` asks the machine what day it is, which on
 * a server is a fact about the data centre, not about the user: someone in
 * Auckland finishing a session at 11:30 UTC has practiced on the 12th, and a
 * process in California would credit it to the 11th and silently break their
 * streak. These cases pin the two directions with real zones.
 */
describe('zonedCalendarDays', () => {
  it('reads the wall-clock day in the given zone, not the UTC one', () => {
    const lateUtcEvening = '2026-06-15T23:30:00.000Z'
    const dateIn = (timeZone: string, iso: string): string =>
      isoDateOfDayNumber(zonedCalendarDays(timeZone).dayNumber(iso) as number)

    // 11:30 on the 16th in Auckland, 16:30 on the 15th in Los Angeles.
    expect(dateIn('Pacific/Auckland', lateUtcEvening)).toBe('2026-06-16')
    expect(dateIn('UTC', lateUtcEvening)).toBe('2026-06-15')
    expect(dateIn('America/Los_Angeles', lateUtcEvening)).toBe('2026-06-15')

    // And just past UTC midnight it is still the previous day on the US west coast.
    const justPastUtcMidnight = '2026-06-16T00:30:00.000Z'
    expect(dateIn('Pacific/Auckland', justPastUtcMidnight)).toBe('2026-06-16')
    expect(dateIn('UTC', justPastUtcMidnight)).toBe('2026-06-16')
    expect(dateIn('America/Los_Angeles', justPastUtcMidnight)).toBe('2026-06-15')
  })

  it('gives one day number to a zone day and advances across its midnight', () => {
    const auckland = zonedCalendarDays('Pacific/Auckland')
    // 12:00 and 23:59 on 2026-06-16 in Auckland (UTC+12), then 00:01 the next day.
    const midday = auckland.dayNumber('2026-06-16T00:00:00.000Z')
    expect(auckland.dayNumber('2026-06-16T11:59:00.000Z')).toBe(midday)
    expect(auckland.dayNumber('2026-06-16T12:01:00.000Z')).toBe((midday ?? 0) + 1)
  })

  it('agrees with the local helper when asked for the machine zone', () => {
    const machineZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    for (const hour of [0, 6, 12, 23]) {
      const iso = localIso(2026, 6, 15, hour, 30)
      expect(zonedCalendarDays(machineZone).dayNumber(iso)).toBe(localCalendarDay(iso))
    }
  })

  it('returns null for a timestamp it cannot read', () => {
    expect(zonedCalendarDays('UTC').dayNumber('not a date')).toBeNull()
    expect(zonedCalendarDays('UTC').dayNumber('')).toBeNull()
  })

  it('refuses a zone the runtime does not know', () => {
    expect(() => zonedCalendarDays('Not/AZone')).toThrow(RangeError)
    expect(() => zonedCalendarDays('')).toThrow(RangeError)
  })
})

describe('isoDateOfDayNumber', () => {
  it('names the calendar date a day number stands for', () => {
    const utc = zonedCalendarDays('UTC')
    const endOfFebruary = utc.dayNumber('2026-02-28T12:00:00.000Z') as number
    expect(isoDateOfDayNumber(endOfFebruary)).toBe('2026-02-28')
    expect(isoDateOfDayNumber(endOfFebruary + 1)).toBe('2026-03-01')
  })
})
