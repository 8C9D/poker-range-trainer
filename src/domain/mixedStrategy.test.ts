import { describe, it, expect } from 'vitest'
import {
  isValidMixedStrategy,
  normalizeMixedStrategy,
  primaryAction,
  totalFrequency,
} from './mixedStrategy'

describe('normalizeMixedStrategy', () => {
  it('merges duplicate actions and returns canonical order', () => {
    const result = normalizeMixedStrategy([
      { action: 'fold', frequency: 20 },
      { action: 'fourBet', frequency: 30 },
      { action: 'fold', frequency: 30 },
    ])
    // RANGE_ACTIONS order is fold, call, raise, threeBet, fourBet, jam, mixed.
    expect(result).toEqual([
      { action: 'fold', frequency: 50 },
      { action: 'fourBet', frequency: 30 },
    ])
  })

  it('drops non-positive, non-finite, and unknown actions', () => {
    const result = normalizeMixedStrategy([
      { action: 'fold', frequency: 0 },
      { action: 'call', frequency: -5 },
      { action: 'raise', frequency: Number.NaN },
      { action: 'bogus' as never, frequency: 10 },
      { action: 'jam', frequency: 100 },
    ])
    expect(result).toEqual([{ action: 'jam', frequency: 100 }])
  })
})

describe('totalFrequency', () => {
  it('sums normalized frequencies', () => {
    expect(totalFrequency([
      { action: 'fold', frequency: 40 },
      { action: 'fold', frequency: 10 },
      { action: 'raise', frequency: 50 },
    ])).toBe(100)
  })
})

describe('isValidMixedStrategy', () => {
  it('is true when frequencies sum to 100', () => {
    expect(isValidMixedStrategy([
      { action: 'fourBet', frequency: 50 },
      { action: 'fold', frequency: 50 },
    ])).toBe(true)
  })

  it('is false when frequencies do not sum to 100', () => {
    expect(isValidMixedStrategy([{ action: 'fold', frequency: 70 }])).toBe(false)
    expect(isValidMixedStrategy([])).toBe(false)
  })
})

describe('primaryAction', () => {
  it('returns the highest-frequency action', () => {
    expect(primaryAction([
      { action: 'fold', frequency: 30 },
      { action: 'raise', frequency: 70 },
    ])).toBe('raise')
  })

  it('breaks ties by canonical RANGE_ACTIONS order', () => {
    expect(primaryAction([
      { action: 'raise', frequency: 50 },
      { action: 'fold', frequency: 50 },
    ])).toBe('fold')
  })

  it('returns null for an empty strategy', () => {
    expect(primaryAction([])).toBeNull()
  })
})
