import { describe, it, expect } from 'vitest'
import { ALL_HANDS, type PokerHand } from './pokerHands'
import {
  selectAllPairs,
  selectPairsAtOrAbove,
  selectSuitedBroadways,
  selectOffsuitBroadways,
  selectAllBroadways,
  mergeShortcutHands,
  removeShortcutHands,
} from './rangeShortcuts'

/** True when `hands` are strictly ascending by 13x13 row-major index (i.e. canonical, deduped). */
function isCanonicalOrder(hands: PokerHand[]): boolean {
  const indices = hands.map((hand) => ALL_HANDS.indexOf(hand))
  return indices.every((value, i) => value >= 0 && (i === 0 || indices[i - 1] < value))
}

describe('selectAllPairs', () => {
  it('returns all 13 pocket pairs', () => {
    const pairs = selectAllPairs()
    expect(pairs).toHaveLength(13)
    expect(pairs).toEqual(['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22'])
  })

  it('returns them in canonical order (AA first, 22 last)', () => {
    expect(isCanonicalOrder(selectAllPairs())).toBe(true)
  })
})

describe('selectPairsAtOrAbove', () => {
  it('returns exactly the pairs 77 and higher, in canonical order', () => {
    expect(selectPairsAtOrAbove('77')).toEqual(['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77'])
  })

  it('returns only AA for a threshold of AA', () => {
    expect(selectPairsAtOrAbove('AA')).toEqual(['AA'])
  })

  it('returns all pairs for a threshold of 22', () => {
    expect(selectPairsAtOrAbove('22')).toEqual(selectAllPairs())
  })

  it('rejects a suited hand', () => {
    expect(() => selectPairsAtOrAbove('AKs')).toThrow(/pocket pair/)
  })

  it('rejects an offsuit hand', () => {
    expect(() => selectPairsAtOrAbove('AKo')).toThrow(/pocket pair/)
  })

  it('rejects an invalid hand', () => {
    expect(() => selectPairsAtOrAbove('ZZ')).toThrow(/ZZ/)
  })
})

describe('selectSuitedBroadways', () => {
  it('returns the ten suited Broadway hands in canonical order', () => {
    expect(selectSuitedBroadways()).toEqual([
      'AKs',
      'AQs',
      'AJs',
      'ATs',
      'KQs',
      'KJs',
      'KTs',
      'QJs',
      'QTs',
      'JTs',
    ])
  })

  it('excludes pairs and contains no offsuit hands', () => {
    const suited = selectSuitedBroadways()
    expect(suited.every((hand) => hand.endsWith('s'))).toBe(true)
    expect(isCanonicalOrder(suited)).toBe(true)
  })
})

describe('selectOffsuitBroadways', () => {
  it('returns the ten offsuit Broadway hands in canonical order', () => {
    // Offsuit hands sit in the grid's lower triangle, so row-major order is not
    // simply grouped by high card.
    expect(selectOffsuitBroadways()).toEqual([
      'AKo',
      'AQo',
      'KQo',
      'AJo',
      'KJo',
      'QJo',
      'ATo',
      'KTo',
      'QTo',
      'JTo',
    ])
  })

  it('excludes pairs and contains no suited hands', () => {
    const offsuit = selectOffsuitBroadways()
    expect(offsuit.every((hand) => hand.endsWith('o'))).toBe(true)
    expect(isCanonicalOrder(offsuit)).toBe(true)
  })
})

describe('selectAllBroadways', () => {
  const broadways = selectAllBroadways()

  it('is the union of suited Broadways, offsuit Broadways, and TT+ pairs (25 hands)', () => {
    expect(broadways).toHaveLength(25)
    expect(isCanonicalOrder(broadways)).toBe(true)
  })

  it('includes the Broadway pocket pairs TT+ but no lower pairs', () => {
    expect(broadways).toEqual(expect.arrayContaining(['TT', 'JJ', 'QQ', 'KK', 'AA']))
    expect(broadways).not.toContain('99')
  })

  it('includes every suited and offsuit Broadway non-pair', () => {
    expect(broadways).toEqual(expect.arrayContaining(selectSuitedBroadways()))
    expect(broadways).toEqual(expect.arrayContaining(selectOffsuitBroadways()))
  })
})

describe('mergeShortcutHands', () => {
  it('dedupes overlapping hands and returns canonical order', () => {
    expect(mergeShortcutHands(['22', 'AKs'], ['AKs', 'AA'])).toEqual(['AA', 'AKs', '22'])
  })

  it('adds a shortcut group on top of an existing selection', () => {
    const result = mergeShortcutHands(['AA'], selectSuitedBroadways())
    expect(result).toEqual(['AA', ...selectSuitedBroadways()])
    expect(isCanonicalOrder(result)).toBe(true)
  })
})

describe('removeShortcutHands', () => {
  it('removes only the requested hands', () => {
    expect(removeShortcutHands(['AA', 'KK', 'QQ', 'AKs'], ['KK', 'QQ'])).toEqual(['AA', 'AKs'])
  })

  it('ignores hands that are not present', () => {
    expect(removeShortcutHands(['AA', 'KK'], ['QQ'])).toEqual(['AA', 'KK'])
  })

  it('can subtract a whole shortcut group', () => {
    const all = mergeShortcutHands(selectAllPairs(), selectSuitedBroadways())
    expect(removeShortcutHands(all, selectAllPairs())).toEqual(selectSuitedBroadways())
  })
})

describe('purity', () => {
  it('does not mutate its input arrays', () => {
    const existing: PokerHand[] = ['22', 'AKs', 'AA']
    const shortcut: PokerHand[] = ['AA', 'KK']
    const existingSnapshot = [...existing]
    const shortcutSnapshot = [...shortcut]

    mergeShortcutHands(existing, shortcut)
    removeShortcutHands(existing, shortcut)

    expect(existing).toEqual(existingSnapshot)
    expect(shortcut).toEqual(shortcutSnapshot)
  })
})
