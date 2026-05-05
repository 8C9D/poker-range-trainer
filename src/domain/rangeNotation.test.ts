import { describe, it, expect } from 'vitest'
import { RANKS } from './pokerHands'
import { normalizeRangeHands } from './rangeMath'
import { parseRangeNotation, formatRangeNotation } from './rangeNotation'

/** All 13 pocket pairs in canonical order (AA … 22). */
const ALL_PAIRS = RANKS.map((rank) => `${rank}${rank}`)

describe('parseRangeNotation', () => {
  describe('empty and whitespace input', () => {
    it('parses an empty string to an empty array', () => {
      expect(parseRangeNotation('')).toEqual([])
    })

    it('parses whitespace-only input to an empty array', () => {
      expect(parseRangeNotation('   ')).toEqual([])
    })

    it('ignores empty tokens from stray commas', () => {
      expect(parseRangeNotation('AA, , KK,')).toEqual(['AA', 'KK'])
    })
  })

  describe('exact hands', () => {
    it('parses an exact pair', () => {
      expect(parseRangeNotation('AA')).toEqual(['AA'])
      expect(parseRangeNotation('77')).toEqual(['77'])
    })

    it('parses an exact suited hand', () => {
      expect(parseRangeNotation('AKs')).toEqual(['AKs'])
      expect(parseRangeNotation('QJs')).toEqual(['QJs'])
    })

    it('parses an exact offsuit hand', () => {
      expect(parseRangeNotation('AKo')).toEqual(['AKo'])
    })

    it('parses a comma-separated list of exact hands in canonical order', () => {
      expect(parseRangeNotation('AA, AKs, AKo')).toEqual(['AA', 'AKs', 'AKo'])
      // Input order does not matter; output is canonical 13x13 order.
      expect(parseRangeNotation('22, QQ, AA')).toEqual(['AA', 'QQ', '22'])
    })
  })

  describe('whitespace and duplicates', () => {
    it('ignores whitespace around tokens', () => {
      expect(parseRangeNotation('  AA ,   KK  ,QQ ')).toEqual(['AA', 'KK', 'QQ'])
    })

    it('dedupes repeated hands', () => {
      expect(parseRangeNotation('AA, AA, AA')).toEqual(['AA'])
      expect(parseRangeNotation('AKs, AKo, AKs')).toEqual(['AKs', 'AKo'])
    })

    it('dedupes hands that overlap across tokens', () => {
      // 88 is already covered by 77+, so it should appear once.
      expect(parseRangeNotation('77+, 88')).toEqual(
        normalizeRangeHands(['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77']),
      )
    })
  })

  describe('pair-plus expansion', () => {
    it('expands 77+ to 77 through AA in canonical order', () => {
      expect(parseRangeNotation('77+')).toEqual([
        'AA',
        'KK',
        'QQ',
        'JJ',
        'TT',
        '99',
        '88',
        '77',
      ])
    })

    it('expands TT+ to TT through AA', () => {
      expect(parseRangeNotation('TT+')).toEqual(['AA', 'KK', 'QQ', 'JJ', 'TT'])
    })

    it('expands 22+ to all 13 pairs', () => {
      expect(parseRangeNotation('22+')).toEqual(ALL_PAIRS)
    })

    it('expands AA+ to just AA', () => {
      expect(parseRangeNotation('AA+')).toEqual(['AA'])
    })
  })

  describe('suited-plus expansion (fixed high card, varying kicker)', () => {
    it('expands A5s+ to A5s through AKs', () => {
      expect(parseRangeNotation('A5s+')).toEqual([
        'AKs',
        'AQs',
        'AJs',
        'ATs',
        'A9s',
        'A8s',
        'A7s',
        'A6s',
        'A5s',
      ])
    })

    it('expands KTs+ to KTs through KQs', () => {
      expect(parseRangeNotation('KTs+')).toEqual(['KQs', 'KJs', 'KTs'])
    })

    it('expands A2s+ to every suited ace', () => {
      expect(parseRangeNotation('A2s+')).toEqual([
        'AKs',
        'AQs',
        'AJs',
        'ATs',
        'A9s',
        'A8s',
        'A7s',
        'A6s',
        'A5s',
        'A4s',
        'A3s',
        'A2s',
      ])
    })
  })

  describe('offsuit-plus expansion (fixed high card, varying kicker)', () => {
    it('expands ATo+ to ATo through AKo', () => {
      expect(parseRangeNotation('ATo+')).toEqual(['AKo', 'AQo', 'AJo', 'ATo'])
    })

    it('expands KJo+ to KJo through KQo', () => {
      expect(parseRangeNotation('KJo+')).toEqual(['KQo', 'KJo'])
    })

    it('expands QTo+ to QTo through QJo', () => {
      expect(parseRangeNotation('QTo+')).toEqual(['QJo', 'QTo'])
    })
  })

  describe('combined lists', () => {
    it('parses a mixed list of shortcuts and exact hands', () => {
      // 77+ pairs, AJs+ suited aces, plus a single offsuit hand.
      const expected = normalizeRangeHands([
        ...['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77'],
        ...['AKs', 'AQs', 'AJs'],
        'KQo',
      ])
      expect(parseRangeNotation('77+, AJs+, KQo')).toEqual(expected)
    })

    it('parses a four-token list with pair, suited, and offsuit shortcuts', () => {
      const result = parseRangeNotation('22+, A2s+, ATo+, KQs')
      // Sanity-check representative members rather than the full list.
      for (const hand of ['AA', '22', 'A2s', 'AKs', 'ATo', 'AKo', 'KQs']) {
        expect(result).toContain(hand)
      }
      // ATo+ is offsuit only and KQs is suited only — these must not appear.
      expect(result).not.toContain('A9o')
      expect(result).not.toContain('KJs')
      // Output is in canonical order.
      expect(result).toEqual(normalizeRangeHands(result))
    })
  })

  describe('dash-range expansion', () => {
    it('expands a suited dash range (A5s-A2s)', () => {
      expect(parseRangeNotation('A5s-A2s')).toEqual(['A5s', 'A4s', 'A3s', 'A2s'])
    })

    it('expands the same suited range regardless of endpoint order', () => {
      expect(parseRangeNotation('A2s-A5s')).toEqual(parseRangeNotation('A5s-A2s'))
    })

    it('expands an offsuit dash range (AJo-ATo)', () => {
      expect(parseRangeNotation('AJo-ATo')).toEqual(['AJo', 'ATo'])
    })

    it('expands a pair dash range (77-TT)', () => {
      expect(parseRangeNotation('77-TT')).toEqual(['TT', '99', '88', '77'])
    })

    it('expands the same pair range regardless of endpoint order', () => {
      expect(parseRangeNotation('TT-77')).toEqual(parseRangeNotation('77-TT'))
    })

    it('works inside a comma-separated list', () => {
      const expected = normalizeRangeHands([
        ...['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77'],
        ...['A5s', 'A4s', 'A3s', 'A2s'],
        'KQo',
      ])
      expect(parseRangeNotation('77+, A5s-A2s, KQo')).toEqual(expected)
    })

    it('ignores whitespace around the dash', () => {
      expect(parseRangeNotation('A5s - A2s')).toEqual(parseRangeNotation('A5s-A2s'))
    })

    it('dedupes hands shared by dash and plus notation', () => {
      // A5s-A2s sits entirely inside the low end of A2s+, so the union is A2s+.
      expect(parseRangeNotation('A2s+, A5s-A2s')).toEqual(parseRangeNotation('A2s+'))
    })
  })

  describe('invalid and not-yet-supported notation', () => {
    it('throws on an unrecognized token', () => {
      expect(() => parseRangeNotation('ZZ')).toThrow()
      expect(() => parseRangeNotation('hello')).toThrow()
    })

    it('throws on a hand with the ranks in the wrong order', () => {
      expect(() => parseRangeNotation('KAs')).toThrow()
    })

    it('throws on lowercase ranks (canonical casing required)', () => {
      expect(() => parseRangeNotation('aa')).toThrow()
    })

    it('throws on bare rank-pair notation like "AK" (no suit suffix yet)', () => {
      expect(() => parseRangeNotation('AK')).toThrow()
    })

    it('throws when dash endpoints have mismatched categories', () => {
      expect(() => parseRangeNotation('A5s-A5o')).toThrow()
    })

    it('throws when non-pair dash endpoints have different high cards', () => {
      expect(() => parseRangeNotation('A5s-K5s')).toThrow()
    })

    it('throws on an invalid dash endpoint', () => {
      expect(() => parseRangeNotation('A5s-Z2s')).toThrow()
      expect(() => parseRangeNotation('77-')).toThrow()
    })

    it('throws on weighted/mixed-frequency notation for now', () => {
      expect(() => parseRangeNotation('AA:0.5')).toThrow(/not supported yet/)
      expect(() => parseRangeNotation('AKs@50')).toThrow(/not supported yet/)
    })

    it('throws when one token in a list is invalid', () => {
      expect(() => parseRangeNotation('AA, ZZ, KK')).toThrow()
    })
  })
})

describe('formatRangeNotation', () => {
  it('formats an empty array as an empty string', () => {
    expect(formatRangeNotation([])).toBe('')
  })

  it('returns canonical, comma-separated hands regardless of input order', () => {
    expect(formatRangeNotation(['22', 'AA', 'AKs'])).toBe('AA, AKs, 22')
  })

  it('dedupes before formatting', () => {
    expect(formatRangeNotation(['AA', 'AA', 'KK'])).toBe('AA, KK')
  })

  it('validates and throws on invalid hands', () => {
    expect(() => formatRangeNotation(['ZZ'])).toThrow()
    expect(() => formatRangeNotation(['AA', 'notahand'])).toThrow()
  })

  it('round-trips with parseRangeNotation', () => {
    const hands = parseRangeNotation('77+, AJs+, KQo')
    expect(parseRangeNotation(formatRangeNotation(hands))).toEqual(hands)
  })
})
