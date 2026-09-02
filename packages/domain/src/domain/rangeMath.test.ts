import { describe, it, expect } from 'vitest'
import { ALL_HANDS } from './pokerHands'
import {
  TOTAL_HOLDEM_COMBOS,
  countSelectedCombos,
  calculateRangePercentage,
  normalizeRangeHands,
} from './rangeMath'

describe('TOTAL_HOLDEM_COMBOS', () => {
  it('is 1326', () => {
    expect(TOTAL_HOLDEM_COMBOS).toBe(1326)
  })
})

describe('countSelectedCombos', () => {
  it('treats an empty range as 0 combos', () => {
    expect(countSelectedCombos([])).toBe(0)
  })

  it('counts a single pair as 6 combos', () => {
    expect(countSelectedCombos(['AA'])).toBe(6)
  })

  it('counts a single suited hand as 4 combos', () => {
    expect(countSelectedCombos(['AKs'])).toBe(4)
  })

  it('counts a single offsuit hand as 12 combos', () => {
    expect(countSelectedCombos(['AKo'])).toBe(12)
  })

  it('sums combos across a small mixed range', () => {
    // 6 (pair) + 4 (suited) + 12 (offsuit) = 22
    expect(countSelectedCombos(['AA', 'AKs', 'AKo'])).toBe(22)
  })

  it('does not double-count duplicate hands', () => {
    expect(countSelectedCombos(['AA', 'AA', 'AA'])).toBe(6)
    expect(countSelectedCombos(['AKs', 'AKo', 'AKs', 'AKo'])).toBe(16)
  })

  it('counts the full 169-hand range as 1326 combos', () => {
    expect(countSelectedCombos(ALL_HANDS)).toBe(1326)
  })

  it('throws on invalid hands and names them', () => {
    expect(() => countSelectedCombos(['ZZ'])).toThrow(/ZZ/)
    expect(() => countSelectedCombos(['AA', 'notahand'])).toThrow(/notahand/)
    expect(() => countSelectedCombos(['KAs'])).toThrow() // wrong rank order
    expect(() => countSelectedCombos(['aks'])).toThrow() // lowercase
    expect(() => countSelectedCombos(['AAs'])).toThrow() // pairs cannot be suited
    expect(() => countSelectedCombos([''])).toThrow() // empty string
  })
})

describe('calculateRangePercentage', () => {
  it('is 0 for an empty range', () => {
    expect(calculateRangePercentage([])).toBe(0)
  })

  it('is selectedCombos / 1326 * 100', () => {
    expect(calculateRangePercentage(['AA'])).toBeCloseTo((6 / 1326) * 100, 10)
    expect(calculateRangePercentage(['AKo'])).toBeCloseTo((12 / 1326) * 100, 10)
  })

  it('is exactly 100 for the full range', () => {
    expect(calculateRangePercentage(ALL_HANDS)).toBe(100)
  })

  it('throws on invalid hands', () => {
    expect(() => calculateRangePercentage(['AKx'])).toThrow()
  })
})

describe('normalizeRangeHands', () => {
  it('returns an empty array for an empty range', () => {
    expect(normalizeRangeHands([])).toEqual([])
  })

  it('removes duplicates and sorts by 13x13 order', () => {
    // AA is first in matrix order, AKs second, 22 last.
    expect(normalizeRangeHands(['22', 'AKs', 'AA', 'AKs', '22'])).toEqual(['AA', 'AKs', '22'])
  })

  it('restores standard 13x13 order regardless of input order', () => {
    const shuffled = [...ALL_HANDS].reverse()
    expect(normalizeRangeHands(shuffled)).toEqual(ALL_HANDS)
  })

  it('throws on invalid hands', () => {
    expect(() => normalizeRangeHands(['AA', 'ZZ'])).toThrow(/ZZ/)
  })
})
