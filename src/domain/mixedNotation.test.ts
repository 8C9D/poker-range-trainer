import { describe, it, expect } from 'vitest'
import { formatMixedNotation, parseMixedNotation } from './mixedNotation'
import type { HandMixedStrategy } from './mixedStrategy'

// Stored in canonical RANGE_ACTIONS order (fold before raise) to match the
// normalizer's output, so the round-trip is exact.
const chart: Record<string, HandMixedStrategy> = {
  KK: [{ action: 'raise', frequency: 100 }],
  AA: [
    { action: 'fold', frequency: 40 },
    { action: 'raise', frequency: 60 },
  ],
}

describe('formatMixedNotation', () => {
  it('emits one line per hand in canonical matrix order', () => {
    expect(formatMixedNotation(chart)).toBe('AA: fold 40, raise 60\nKK: raise 100')
  })

  it('returns an empty string for an empty map', () => {
    expect(formatMixedNotation({})).toBe('')
  })
})

describe('parseMixedNotation', () => {
  it('round-trips with formatMixedNotation', () => {
    expect(parseMixedNotation(formatMixedNotation(chart))).toEqual(chart)
  })

  it('ignores blank lines', () => {
    expect(parseMixedNotation('\nAA: fold 100\n\n')).toEqual({
      AA: [{ action: 'fold', frequency: 100 }],
    })
  })

  it('throws on a colonless line', () => {
    expect(() => parseMixedNotation('AA raise 100')).toThrow(/missing ":"/)
  })

  it('throws on an invalid hand', () => {
    expect(() => parseMixedNotation('ZZ: fold 100')).toThrow(/Invalid hand/)
  })

  it('throws on an unknown action', () => {
    expect(() => parseMixedNotation('AA: limp 100')).toThrow(/Unknown action/)
  })

  it('throws on a non-numeric frequency', () => {
    expect(() => parseMixedNotation('AA: fold lots')).toThrow(/Invalid frequency/)
  })
})
