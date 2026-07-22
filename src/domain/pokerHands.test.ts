import { describe, it, expect } from 'vitest'
import {
  RANKS,
  generateHandMatrix,
  ALL_HANDS,
  classifyHand,
  comboCount,
  isValidHand,
  areValidHands,
} from './pokerHands'

describe('RANKS', () => {
  it('orders ranks from highest to lowest', () => {
    expect(RANKS).toEqual(['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'])
  })
})

describe('generateHandMatrix', () => {
  const matrix = generateHandMatrix()
  const flat = matrix.flat()

  it('is a 13x13 matrix', () => {
    expect(matrix).toHaveLength(13)
    for (const row of matrix) {
      expect(row).toHaveLength(13)
    }
  })

  it('contains 169 unique hands', () => {
    expect(flat).toHaveLength(169)
    expect(new Set(flat).size).toBe(169)
  })

  it('places pairs on the diagonal', () => {
    expect(matrix[0][0]).toBe('AA')
    expect(matrix[1][1]).toBe('KK')
    expect(matrix[12][12]).toBe('22')
  })

  it('places suited hands in the upper triangle', () => {
    expect(matrix[0][1]).toBe('AKs')
    expect(matrix[0][12]).toBe('A2s')
    expect(matrix[1][2]).toBe('KQs')
  })

  it('places offsuit hands in the lower triangle', () => {
    expect(matrix[1][0]).toBe('AKo')
    expect(matrix[12][0]).toBe('A2o')
    expect(matrix[12][11]).toBe('32o')
  })

  it('has 13 pairs, 78 suited, and 78 offsuit hands', () => {
    const counts = { pair: 0, suited: 0, offsuit: 0 }
    for (const hand of flat) {
      counts[classifyHand(hand)] += 1
    }
    expect(counts).toEqual({ pair: 13, suited: 78, offsuit: 78 })
  })
})

describe('classifyHand', () => {
  it('classifies pairs', () => {
    expect(classifyHand('AA')).toBe('pair')
    expect(classifyHand('22')).toBe('pair')
  })

  it('classifies suited hands', () => {
    expect(classifyHand('AKs')).toBe('suited')
    expect(classifyHand('72s')).toBe('suited')
  })

  it('classifies offsuit hands', () => {
    expect(classifyHand('AKo')).toBe('offsuit')
    expect(classifyHand('32o')).toBe('offsuit')
  })
})

describe('comboCount', () => {
  it('returns 6 for pairs', () => {
    expect(comboCount('AA')).toBe(6)
  })

  it('returns 4 for suited hands', () => {
    expect(comboCount('AKs')).toBe(4)
  })

  it('returns 12 for offsuit hands', () => {
    expect(comboCount('AKo')).toBe(12)
  })

  it('totals 1326 combos across the full matrix', () => {
    const total = ALL_HANDS.reduce((sum, hand) => sum + comboCount(hand), 0)
    expect(total).toBe(1326)
  })
})

describe('isValidHand', () => {
  it('accepts every one of the 169 canonical hands', () => {
    for (const hand of ALL_HANDS) {
      expect(isValidHand(hand)).toBe(true)
    }
    expect(ALL_HANDS).toHaveLength(169)
  })

  it('accepts canonical pair, suited, and offsuit notation', () => {
    expect(isValidHand('AA')).toBe(true)
    expect(isValidHand('AKs')).toBe(true)
    expect(isValidHand('72o')).toBe(true)
  })

  it('rejects malformed or non-canonical hands', () => {
    // Unknown ranks, non-canonical rank order, lowercase, wrong/absent suffix,
    // stray whitespace, and empty string are all invalid.
    for (const hand of ['ZZ', 'KAs', 'aa', 'aks', 'AAs', 'AK', 'AKo ', '']) {
      expect(isValidHand(hand)).toBe(false)
    }
  })
})

describe('areValidHands', () => {
  it('accepts an array of canonical hands (including empty)', () => {
    expect(areValidHands([])).toBe(true)
    expect(areValidHands(['AA', 'AKs', '72o'])).toBe(true)
  })

  it('rejects arrays with any non-canonical or non-string entry', () => {
    expect(areValidHands(['AA', 'ZZ'])).toBe(false)
    expect(areValidHands(['AA', 42])).toBe(false)
    expect(areValidHands(['AA', null])).toBe(false)
  })

  it('rejects non-array payloads', () => {
    expect(areValidHands(undefined)).toBe(false)
    expect(areValidHands(null)).toBe(false)
    expect(areValidHands('AA')).toBe(false)
    expect(areValidHands({ 0: 'AA' })).toBe(false)
  })
})
