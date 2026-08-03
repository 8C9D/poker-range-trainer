import { describe, it, expect, afterEach, vi } from 'vitest'
import { DAY_MS, localCalendarDay, localDayStart } from './calendarDay'

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
