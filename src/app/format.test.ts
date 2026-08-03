import { describe, it, expect } from 'vitest'
import { formatDayDistance, greetingFor } from './format'

const NOW = '2026-07-11T12:00:00.000Z'

describe('formatDayDistance', () => {
  it('returns empty for empty or invalid input', () => {
    expect(formatDayDistance('', NOW)).toBe('')
    expect(formatDayDistance('not-a-date', NOW)).toBe('')
  })

  // Local-time constructors keep these assertions true in any time zone. The
  // distance is measured in LOCAL calendar days, so UTC literals describe a
  // different pair of days once the zone is far enough from UTC, and these two
  // cases read '09:00Z is the same day as 12:00Z' — true in London, false in
  // Kiritimati, where both are the small hours of the next day.
  const localIso = (year: number, month: number, day: number, hour: number, minute: number) =>
    new Date(year, month, day, hour, minute).toISOString()

  it('formats same-day and future as today', () => {
    const now = localIso(2026, 6, 11, 12, 0)
    expect(formatDayDistance(localIso(2026, 6, 11, 9, 0), now)).toBe('today')
    expect(formatDayDistance(localIso(2026, 6, 11, 13, 0), now)).toBe('today')
  })

  it('formats one day back as yesterday and older as Nd ago', () => {
    const now = localIso(2026, 6, 11, 12, 0)
    expect(formatDayDistance(localIso(2026, 6, 10, 9, 0), now)).toBe('yesterday')
    expect(formatDayDistance(localIso(2026, 6, 6, 9, 0), now)).toBe('5d ago')
  })

  it('counts calendar days, so last night is yesterday even a few hours later', () => {
    const lastNight = localIso(2026, 6, 10, 23, 0)
    const thisMorning = localIso(2026, 6, 11, 8, 0)
    expect(formatDayDistance(lastNight, thisMorning)).toBe('yesterday')
  })

  it('counts calendar days for older timestamps too', () => {
    const fiveNightsAgo = localIso(2026, 6, 6, 23, 0)
    const thisMorning = localIso(2026, 6, 11, 8, 0)
    expect(formatDayDistance(fiveNightsAgo, thisMorning)).toBe('5d ago')
  })

  it('keeps a long same-day gap as today', () => {
    const earlyToday = localIso(2026, 6, 11, 0, 30)
    const lateToday = localIso(2026, 6, 11, 23, 0)
    expect(formatDayDistance(earlyToday, lateToday)).toBe('today')
  })
})

describe('greetingFor', () => {
  it('greets by local time of day', () => {
    expect(greetingFor(new Date(2026, 6, 11, 8))).toBe('Good morning')
    expect(greetingFor(new Date(2026, 6, 11, 14))).toBe('Good afternoon')
    expect(greetingFor(new Date(2026, 6, 11, 21))).toBe('Good evening')
  })
})
