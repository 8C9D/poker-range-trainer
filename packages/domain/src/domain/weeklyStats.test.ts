import { describe, it, expect } from 'vitest'
import {
  dailyHandCounts,
  sessionsForLibrary,
  summarizeWeek,
  weeklyAccuracyTrend,
} from './weeklyStats'
import { isoDateOfDayNumber, localCalendarDay, zonedCalendarDays } from './calendarDay'
import type { PracticeSessionRecord } from '../types/practice'
import type { SavedRange } from '../types/range'

const NOW = '2026-07-11T12:00:00.000Z'

function session(rangeId: string, playedAt: string, total: number, correct: number): PracticeSessionRecord {
  return { rangeId, playedAt, totalQuestions: total, correctAnswers: correct }
}

function range(id: string): SavedRange {
  return { id, name: id, createdAt: NOW, updatedAt: NOW, hands: ['AA'] }
}

describe('summarizeWeek', () => {
  it('returns zeros and no sharpest range for empty history', () => {
    expect(summarizeWeek({}, NOW)).toEqual({
      handsAnswered: 0,
      correctAnswers: 0,
      accuracy: 0,
      sharpestRangeId: null,
      sharpestAccuracy: 0,
    })
  })

  it('sums hands and accuracy across ranges inside the window', () => {
    const history = {
      a: [session('a', '2026-07-10T10:00:00.000Z', 10, 9)],
      b: [session('b', '2026-07-08T10:00:00.000Z', 20, 10)],
    }
    const summary = summarizeWeek(history, NOW)
    expect(summary.handsAnswered).toBe(30)
    expect(summary.correctAnswers).toBe(19)
    expect(summary.accuracy).toBeCloseTo((19 / 30) * 100)
  })

  it('excludes sessions older than the window and in the future', () => {
    const history = {
      a: [
        session('a', '2026-07-01T10:00:00.000Z', 10, 10), // too old
        session('a', '2026-07-20T10:00:00.000Z', 10, 10), // future
        session('a', '2026-07-09T10:00:00.000Z', 5, 4),
      ],
    }
    const summary = summarizeWeek(history, NOW)
    expect(summary.handsAnswered).toBe(5)
    expect(summary.correctAnswers).toBe(4)
  })

  it('uses the same local calendar-day window as the daily chart', () => {
    const now = new Date(2026, 6, 11, 12).toISOString()
    const firstDay = new Date(2026, 6, 5, 0, 15).toISOString()
    const previousEvening = new Date(2026, 6, 4, 23, 45).toISOString()
    const history = {
      a: [
        session('a', previousEvening, 20, 20),
        session('a', firstDay, 7, 5),
      ],
    }

    const summary = summarizeWeek(history, now)
    const chartTotal = dailyHandCounts(history, now).reduce(
      (sum, day) => sum + day.handsAnswered,
      0,
    )

    expect(summary.handsAnswered).toBe(7)
    expect(summary.handsAnswered).toBe(chartTotal)
  })

  it('picks the range with the highest windowed accuracy as sharpest', () => {
    const history = {
      a: [session('a', '2026-07-10T10:00:00.000Z', 10, 6)],
      b: [session('b', '2026-07-10T11:00:00.000Z', 10, 9)],
    }
    const summary = summarizeWeek(history, NOW)
    expect(summary.sharpestRangeId).toBe('b')
    expect(summary.sharpestAccuracy).toBe(90)
  })

  it('breaks accuracy ties toward more hands answered', () => {
    const history = {
      a: [session('a', '2026-07-10T10:00:00.000Z', 4, 2)],
      b: [session('b', '2026-07-10T11:00:00.000Z', 10, 5)],
    }
    expect(summarizeWeek(history, NOW).sharpestRangeId).toBe('b')
  })

  it('aggregates multiple sessions of the same range before ranking', () => {
    const history = {
      a: [
        session('a', '2026-07-09T10:00:00.000Z', 10, 5),
        session('a', '2026-07-10T10:00:00.000Z', 10, 10),
      ],
      b: [session('b', '2026-07-10T11:00:00.000Z', 10, 8)],
    }
    const summary = summarizeWeek(history, NOW)
    expect(summary.sharpestRangeId).toBe('b')
    expect(summary.sharpestAccuracy).toBe(80)
  })

  it('drops a deleted range from the volume as well as the sharpest ranking', () => {
    const history = {
      live: [session('live', '2026-07-10T10:00:00.000Z', 10, 8)],
      deleted: [session('deleted', '2026-07-10T11:00:00.000Z', 10, 10)],
    }

    const summary = summarizeWeek(sessionsForLibrary(history, [range('live')]), NOW)

    // Reporting 20 hands while the sharpest cut sees only one range is the
    // contradiction Progress used to show: 40 hands this week, 0 all-time.
    expect(summary.handsAnswered).toBe(10)
    expect(summary.correctAnswers).toBe(8)
    expect(summary.sharpestRangeId).toBe('live')
  })
})

describe('sessionsForLibrary', () => {
  const history = {
    live: [session('live', '2026-07-10T10:00:00.000Z', 10, 8)],
    deleted: [session('deleted', '2026-07-10T11:00:00.000Z', 10, 10)],
  }

  it('keeps only the sessions of ranges the library still holds', () => {
    expect(sessionsForLibrary(history, [range('live')])).toEqual({ live: history.live })
  })

  it('keeps archived ranges — they are put away, not gone', () => {
    const archived = { ...range('deleted'), archived: true }
    expect(Object.keys(sessionsForLibrary(history, [range('live'), archived]))).toEqual([
      'live',
      'deleted',
    ])
  })

  it('drops everything when the library is empty, and never mutates its input', () => {
    expect(sessionsForLibrary(history, [])).toEqual({})
    expect(Object.keys(history)).toEqual(['live', 'deleted'])
  })
})

describe('dailyHandCounts', () => {
  it('returns seven zeroed days for empty history, ending today', () => {
    // Local wall-clock noon: the buckets are local days, so a UTC literal is a
    // different date in a far enough zone and the window slides by one.
    const localNoon = new Date(2026, 6, 11, 12).toISOString()
    const days = dailyHandCounts({}, localNoon)
    expect(days).toHaveLength(7)
    expect(days.every((day) => day.handsAnswered === 0)).toBe(true)
    expect(new Date(days[6].dayStart).getDate()).toBe(11)
    expect(new Date(days[0].dayStart).getDate()).toBe(5)
    expect(new Date(days[6].dayStart).getHours()).toBe(0)
    expect(new Date(days[0].dayStart).getHours()).toBe(0)
  })

  it('buckets sessions into their local calendar day', () => {
    const localNow = new Date(2026, 6, 11, 12).toISOString()
    const days = dailyHandCounts(
      {
        a: [
          session('a', new Date(2026, 6, 11, 1).toISOString(), 10, 8),
          session('a', new Date(2026, 6, 11, 23).toISOString(), 5, 5),
          session('a', new Date(2026, 6, 9, 12).toISOString(), 7, 6),
        ],
        b: [session('b', new Date(2026, 6, 9, 13).toISOString(), 3, 1)],
      },
      localNow,
    )
    expect(days[6].handsAnswered).toBe(15)
    expect(days[4].handsAnswered).toBe(10)
    expect(days[5].handsAnswered).toBe(0)
  })

  it('does not pull the previous local evening into today near a UTC boundary', () => {
    const now = new Date(2026, 6, 11, 0, 30).toISOString()
    const previousEvening = new Date(2026, 6, 10, 23, 30).toISOString()
    const afterMidnight = new Date(2026, 6, 11, 0, 15).toISOString()

    const days = dailyHandCounts(
      {
        a: [
          session('a', previousEvening, 9, 9),
          session('a', afterMidnight, 4, 4),
        ],
      },
      now,
      1,
    )

    expect(days[0].handsAnswered).toBe(4)
  })

  it('ignores sessions outside the window', () => {
    const days = dailyHandCounts(
      {
        a: [
          session('a', '2026-07-04T12:00:00.000Z', 10, 8), // day before window
          session('a', '2026-07-12T12:00:00.000Z', 10, 8), // tomorrow
        ],
      },
      NOW,
    )
    expect(days.every((day) => day.handsAnswered === 0)).toBe(true)
  })
})

describe('weeklyAccuracyTrend', () => {
  it('returns one empty bucket per week for empty history', () => {
    const trend = weeklyAccuracyTrend({}, NOW, 4)

    expect(trend).toHaveLength(4)
    expect(trend.every((point) => point.handsAnswered === 0 && point.accuracy === 0)).toBe(true)
  })

  it('is empty for a non-positive window or an unreadable now', () => {
    expect(weeklyAccuracyTrend({}, NOW, 0)).toEqual([])
    expect(weeklyAccuracyTrend({}, 'not-a-date')).toEqual([])
  })

  it('buckets sessions into trailing weeks, oldest first', () => {
    // This week 8/10, last week 4/10.
    const trend = weeklyAccuracyTrend(
      {
        a: [
          session('a', '2026-07-10T12:00:00.000Z', 10, 8),
          session('a', '2026-07-03T12:00:00.000Z', 10, 4),
        ],
      },
      NOW,
      2,
    )

    expect(trend.map((point) => point.accuracy)).toEqual([40, 80])
    expect(trend.map((point) => point.handsAnswered)).toEqual([10, 10])
  })

  it('pools every range answered in a week into one accuracy', () => {
    const trend = weeklyAccuracyTrend(
      {
        a: [session('a', NOW, 10, 10)],
        b: [session('b', NOW, 10, 0)],
      },
      NOW,
      1,
    )

    expect(trend[0]).toMatchObject({ handsAnswered: 20, correctAnswers: 10, accuracy: 50 })
  })

  it('keeps a week with no practice in the series rather than dropping it', () => {
    const trend = weeklyAccuracyTrend({ a: [session('a', NOW, 10, 7)] }, NOW, 3)

    expect(trend.map((point) => point.handsAnswered)).toEqual([0, 0, 10])
    expect(trend[2].accuracy).toBe(70)
  })

  it('ignores sessions older than the window', () => {
    const trend = weeklyAccuracyTrend(
      { a: [session('a', '2026-01-01T12:00:00.000Z', 10, 10)] },
      NOW,
      2,
    )

    expect(trend.every((point) => point.handsAnswered === 0)).toBe(true)
  })

  it('starts each bucket seven days before the next one', () => {
    const trend = weeklyAccuracyTrend({}, NOW, 3)
    const starts = trend.map((point) => new Date(point.weekStart).getTime())

    expect(starts[1] - starts[0]).toBe(7 * 86_400_000)
    expect(starts[2] - starts[1]).toBe(7 * 86_400_000)
  })
})

/**
 * The API buckets by the day the USER was living in, which is never the day the
 * server process happens to be on. These cases pin one instant that falls on
 * different calendar days for two real users: 2026-07-11T11:00Z is 23:00 on the
 * 11th in Auckland and 04:00 on the 11th in Los Angeles, while the `now` an hour
 * later is already 01:00 on the 12th in Auckland and still the morning of the
 * 11th in Los Angeles.
 */
describe('bucketing in a supplied calendar', () => {
  const auckland = zonedCalendarDays('Pacific/Auckland')
  const losAngeles = zonedCalendarDays('America/Los_Angeles')
  const now = '2026-07-11T13:00:00.000Z'
  const history = { a: [session('a', '2026-07-11T11:00:00.000Z', 12, 9)] }

  it('moves what counts as today without moving what counts as this week', () => {
    expect(summarizeWeek(history, now, 1, losAngeles).handsAnswered).toBe(12)
    expect(summarizeWeek(history, now, 1, auckland).handsAnswered).toBe(0)
    expect(summarizeWeek(history, now, 7, auckland).handsAnswered).toBe(12)
    expect(summarizeWeek(history, now, 7, auckland).sharpestRangeId).toBe('a')
  })

  it('fills and numbers the daily chart from the days of the given zone', () => {
    const inAuckland = dailyHandCounts(history, now, 7, auckland)
    const inLosAngeles = dailyHandCounts(history, now, 7, losAngeles)

    expect(isoDateOfDayNumber(inAuckland[6].dayNumber)).toBe('2026-07-12')
    expect(isoDateOfDayNumber(inLosAngeles[6].dayNumber)).toBe('2026-07-11')
    // The same session is yesterday in Auckland and today in Los Angeles.
    expect(inAuckland.map((day) => day.handsAnswered)).toEqual([0, 0, 0, 0, 0, 12, 0])
    expect(inLosAngeles.map((day) => day.handsAnswered)).toEqual([0, 0, 0, 0, 0, 0, 12])
  })

  it('numbers each accuracy bucket from the first day of the zone week', () => {
    const [inAuckland] = weeklyAccuracyTrend(history, now, 1, auckland)
    const [inLosAngeles] = weeklyAccuracyTrend(history, now, 1, losAngeles)

    expect(isoDateOfDayNumber(inAuckland.weekStartDayNumber)).toBe('2026-07-06')
    expect(isoDateOfDayNumber(inLosAngeles.weekStartDayNumber)).toBe('2026-07-05')
    expect([inAuckland.handsAnswered, inLosAngeles.handsAnswered]).toEqual([12, 12])
  })
})

describe('the day numbers beside the local labels', () => {
  it('agree with the local timestamps the charts have always carried', () => {
    for (const day of dailyHandCounts({ a: [session('a', NOW, 10, 8)] }, NOW)) {
      expect(day.dayNumber).toBe(localCalendarDay(day.dayStart))
    }
    for (const point of weeklyAccuracyTrend({ a: [session('a', NOW, 10, 8)] }, NOW, 3)) {
      expect(point.weekStartDayNumber).toBe(localCalendarDay(point.weekStart))
    }
  })
})
