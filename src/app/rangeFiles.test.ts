import { describe, it, expect } from 'vitest'
import { safeRangeFileName } from './rangeFiles'
import type { SavedRange } from '../types/range'

function makeRange(name: string): SavedRange {
  return {
    id: 'r1',
    name,
    hands: ['AA'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('safeRangeFileName', () => {
  it('slugs a name into a dash-separated file base', () => {
    expect(safeRangeFileName(makeRange('UTG open 2.5x'))).toBe('UTG-open-2-5x')
  })

  it('strips leading and trailing separator runs', () => {
    expect(safeRangeFileName(makeRange('  (BTN) open!  '))).toBe('BTN-open')
  })

  it('falls back to "range" when the name has no usable characters', () => {
    expect(safeRangeFileName(makeRange('!!!'))).toBe('range')
  })
})
