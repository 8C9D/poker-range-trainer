import { describe, it, expect } from 'vitest'
import { formatDayDistance, greetingFor } from './format'

const NOW = '2026-07-11T12:00:00.000Z'

describe('formatDayDistance', () => {
  it('returns empty for empty or invalid input', () => {
    expect(formatDayDistance('', NOW)).toBe('')
    expect(formatDayDistance('not-a-date', NOW)).toBe('')
  })

  it('formats same-day and future as today', () => {
    expect(formatDayDistance('2026-07-11T09:00:00.000Z', NOW)).toBe('today')
    expect(formatDayDistance('2026-07-11T13:00:00.000Z', NOW)).toBe('today')
  })

  it('formats one day back as yesterday and older as Nd ago', () => {
    expect(formatDayDistance('2026-07-10T09:00:00.000Z', NOW)).toBe('yesterday')
    expect(formatDayDistance('2026-07-06T09:00:00.000Z', NOW)).toBe('5d ago')
  })
})

describe('greetingFor', () => {
  it('greets by local time of day', () => {
    expect(greetingFor(new Date(2026, 6, 11, 8))).toBe('Good morning')
    expect(greetingFor(new Date(2026, 6, 11, 14))).toBe('Good afternoon')
    expect(greetingFor(new Date(2026, 6, 11, 21))).toBe('Good evening')
  })
})
