import { describe, it, expect } from 'vitest'
import type { SavedRange } from '../types/range'
import {
  RANGE_EXPORT_KIND,
  RANGE_EXPORT_VERSION,
  SVG_PALETTE,
  buildRangeExport,
  decodeRangeFromHash,
  encodeRangeToHash,
  formatRangeCsv,
  formatRangeSvg,
  isValidRangePack,
  isValidSavedRange,
  parseRangeCsv,
  parseRangeExport,
  parseRangePack,
  serializeRangeExport,
  serializeRangePack,
  RANGE_PACK_KIND,
  RANGE_PACK_VERSION,
} from './rangeTransfer'

function makeRange(overrides: Partial<SavedRange> = {}): SavedRange {
  return {
    id: 'r1',
    name: 'Test',
    hands: ['AA', 'KK'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  }
}

describe('isValidSavedRange', () => {
  it('accepts a well-formed range', () => {
    expect(isValidSavedRange(makeRange())).toBe(true)
  })

  it.each([
    ['not an object', 'nope'],
    ['null', null],
    ['a missing id', { ...makeRange(), id: undefined }],
    ['an empty id', { ...makeRange(), id: '' }],
    ['a non-string name', { ...makeRange(), name: { toString: 1 } }],
    ['non-canonical hands', { ...makeRange(), hands: ['ZZ'] }],
    ['hands that are not an array', { ...makeRange(), hands: 'AA' }],
    ['an unparseable createdAt', { ...makeRange(), createdAt: 'whenever' }],
    ['a missing updatedAt', { ...makeRange(), updatedAt: undefined }],
    // The overlays are read straight off the payload by the shared pages, before
    // the storage layer ever gets a chance to sanitize them.
    ['a comboSelections entry that is not a list', { ...makeRange(), comboSelections: { AA: 5 } }],
    [
      'a comboSelections entry holding non-strings',
      { ...makeRange(), comboSelections: { AA: [5] } },
    ],
    ['comboSelections that is not a record', { ...makeRange(), comboSelections: ['AhAs'] }],
    ['a handActions entry that is not a string', { ...makeRange(), handActions: { AA: {} } }],
    ['a handNotes entry that is not a string', { ...makeRange(), handNotes: { AA: 3 } }],
    ['a mixedStrategies entry that is not a list', { ...makeRange(), mixedStrategies: { AA: {} } }],
  ])('rejects %s', (_label, value) => {
    expect(isValidSavedRange(value)).toBe(false)
  })

  it('accepts well-formed overlays', () => {
    expect(
      isValidSavedRange({
        ...makeRange(),
        comboSelections: { AA: ['AhAs'] },
        handActions: { AA: 'raise' },
        handNotes: { AA: 'always' },
        mixedStrategies: { AA: [{ action: 'raise', frequency: 100 }] },
      }),
    ).toBe(true)
  })

  it('leaves overlay CONTENTS to the storage layer', () => {
    // An unrecognized action or an impossible combo key is dropped on save, not
    // grounds to reject the whole payload — a range from a later version of the
    // app has to degrade rather than fail.
    expect(
      isValidSavedRange({
        ...makeRange(),
        handActions: { AA: 'squeeze' },
        comboSelections: { AA: ['not-a-combo'] },
      }),
    ).toBe(true)
  })
})

describe('isValidRangePack', () => {
  function makePack(overrides: Record<string, unknown> = {}) {
    return {
      kind: RANGE_PACK_KIND,
      version: RANGE_PACK_VERSION,
      name: 'Cash openers',
      ranges: [makeRange()],
      ...overrides,
    }
  }

  it('accepts a well-formed pack, named or not', () => {
    expect(isValidRangePack(makePack())).toBe(true)
    expect(isValidRangePack(makePack({ name: undefined }))).toBe(true)
    expect(isValidRangePack(makePack({ ranges: [] }))).toBe(true)
  })

  it.each([
    ['not an object', 'nope'],
    ['null', null],
    ['the wrong kind', { ...makePack(), kind: 'poker-range' }],
    ['an unsupported version', { ...makePack(), version: 99 }],
    // The envelope's own name goes straight into a heading on both platforms.
    ['a non-string name', { ...makePack(), name: { toString: 1 } }],
    ['ranges that are not an array', { ...makePack(), ranges: {} }],
    ['a structurally broken range', { ...makePack(), ranges: [{ ...makeRange(), name: 1 }] }],
  ])('rejects %s', (_label, value) => {
    expect(isValidRangePack(value)).toBe(false)
  })
})

describe('buildRangeExport', () => {
  it('wraps the range in a versioned envelope', () => {
    const range = makeRange()
    expect(buildRangeExport(range)).toEqual({
      kind: RANGE_EXPORT_KIND,
      version: RANGE_EXPORT_VERSION,
      range,
    })
  })
})

describe('serializeRangeExport', () => {
  it('pretty-prints round-trippable JSON', () => {
    const range = makeRange()
    const json = serializeRangeExport(range)
    expect(json).toContain('\n  ')
    expect(JSON.parse(json)).toEqual(buildRangeExport(range))
  })
})

describe('parseRangeExport', () => {
  it('round-trips a serialized range', () => {
    const range = makeRange()
    expect(parseRangeExport(serializeRangeExport(range))).toEqual(range)
  })

  it('rejects invalid JSON', () => {
    expect(() => parseRangeExport('{nope')).toThrow(/valid JSON/)
  })

  it('rejects a non-object payload', () => {
    expect(() => parseRangeExport('42')).toThrow(/range export/)
  })

  it('rejects the wrong kind', () => {
    expect(() =>
      parseRangeExport(JSON.stringify({ kind: 'something-else', version: 1, range: {} })),
    ).toThrow(/poker-range/)
  })

  it('rejects an unsupported version', () => {
    expect(() =>
      parseRangeExport(JSON.stringify({ kind: RANGE_EXPORT_KIND, version: 999, range: {} })),
    ).toThrow(/version/)
  })

  it('rejects a structurally invalid range', () => {
    expect(() =>
      parseRangeExport(
        JSON.stringify({ kind: RANGE_EXPORT_KIND, version: RANGE_EXPORT_VERSION, range: { id: 1 } }),
      ),
    ).toThrow(/valid range/)
  })

  it('rejects a range with non-canonical hands or missing or invalid timestamps', () => {
    for (const range of [
      makeRange({ hands: ['AA', 'ZZ'] }),
      { id: 'r1', name: 'No timestamps', hands: ['AA'] },
      makeRange({ createdAt: 'not-a-date' }),
      makeRange({ updatedAt: '  ' }),
    ]) {
      expect(() =>
        parseRangeExport(
          JSON.stringify({ kind: RANGE_EXPORT_KIND, version: RANGE_EXPORT_VERSION, range }),
        ),
      ).toThrow(/valid range/)
    }
  })
})

describe('formatRangeCsv', () => {
  it('emits a summary block and a hand column', () => {
    const range = makeRange({ name: 'Pairs', hands: ['AA', 'KK'] })
    const csv = formatRangeCsv(range)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('field,value')
    expect(lines).toContain('name,Pairs')
    expect(lines).toContain('hands,2')
    expect(lines).toContain('combos,12')
    expect(lines).toContain('hand')
    expect(lines).toContain('AA')
    expect(lines).toContain('KK')
  })

  it('CSV-escapes names containing commas', () => {
    const csv = formatRangeCsv(makeRange({ name: 'BTN, vs BB', hands: ['AA'] }))
    expect(csv).toContain('name,"BTN, vs BB"')
  })
})

describe('parseRangeCsv', () => {
  it('round-trips name and hands from formatRangeCsv (name with a comma)', () => {
    const range = makeRange({ name: 'BTN, 100bb', hands: ['AA', 'KK', 'AKs'] })
    const parsed = parseRangeCsv(formatRangeCsv(range))
    expect(parsed.name).toBe('BTN, 100bb')
    expect(parsed.hands).toEqual(['AA', 'KK', 'AKs'])
  })

  it('round-trips a quoted name containing a newline and quotes', () => {
    const range = makeRange({ name: 'BTN,\nvs BB "special"', hands: ['AA', 'AKs'] })

    expect(parseRangeCsv(formatRangeCsv(range))).toEqual({
      name: range.name,
      hands: range.hands,
    })
  })

  it('rejects an unterminated quoted field', () => {
    expect(() => parseRangeCsv('name,"broken\n\nhand\nAA')).toThrow(/unterminated/)
  })

  it('imports the hand column from a BOM-prefixed multi-column CSV', () => {
    expect(parseRangeCsv('\uFEFFWeight,Hand,Note\r\n100,AA,premium\r\n50,AKs,mixed')).toEqual({
      hands: ['AA', 'AKs'],
    })
  })

  it('round-trips a name with an embedded double-quote (CSV "" escaping)', () => {
    // A comma name only exercises quote-wrapping; an embedded quote also
    // exercises the doubling on write and un-doubling on read.
    const range = makeRange({ name: 'He said "3-bet"', hands: ['AA', 'KK'] })
    const csv = formatRangeCsv(range)
    expect(csv).toContain('name,"He said ""3-bet"""')
    const parsed = parseRangeCsv(csv)
    expect(parsed.name).toBe('He said "3-bet"')
    expect(parsed.hands).toEqual(['AA', 'KK'])
  })

  it('parses a bare hand column with no summary block', () => {
    const parsed = parseRangeCsv('hand\nAA\nAKo\n')
    expect(parsed.name).toBeUndefined()
    expect(parsed.hands).toEqual(['AA', 'AKo'])
  })

  it('throws on an invalid hand', () => {
    expect(() => parseRangeCsv('hand\nAA\nZZ')).toThrow(/invalid hand/i)
  })

  it('throws when there is no hand column', () => {
    expect(() => parseRangeCsv('field,value\nname,Foo')).toThrow(/hand/i)
  })

  it('throws when the hand column is empty', () => {
    expect(() => parseRangeCsv('hand\n')).toThrow(/empty/i)
  })
})

describe('formatRangeSvg', () => {
  it('produces an SVG with one cell per starting hand', () => {
    const svg = formatRangeSvg(makeRange({ hands: ['AA'] }))
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    expect((svg.match(/<rect /g) ?? []).length).toBe(169)
    expect((svg.match(/<text /g) ?? []).length).toBe(169)
  })

  it('fills in-range hands with the selected-cell fill and others muted', () => {
    const svg = formatRangeSvg(makeRange({ hands: ['AA'] }))
    expect(svg).toContain(`fill="${SVG_PALETTE['--gold-fill']}"`)
    expect(svg).toContain(`fill="${SVG_PALETTE['--cellbg']}"`)
  })

  it('uses action colors when handActions are present', () => {
    const svg = formatRangeSvg(makeRange({ hands: ['AA'], handActions: { AA: 'raise' } }))
    expect(svg).toContain(`fill="${SVG_PALETTE['--act-raise']}"`)
  })

  it('inks each fill with the color that reads on it', () => {
    const svg = formatRangeSvg(
      makeRange({ hands: ['AA', 'KK'], handActions: { KK: 'call' } }),
    )
    // AA is selected, KK carries an action, and the other 167 cells are plain.
    // Both are IN the range: an action on a hand the range does not hold is
    // inert, so it no longer supplies a colour (see the case below).
    expect(svg).toContain(`fill="${SVG_PALETTE['--on-accent']}"`)
    expect(svg).toContain(`fill="${SVG_PALETTE['--on-action']}"`)
    expect(svg).toContain(`fill="${SVG_PALETTE['--ink']}"`)
    // The old export inked every unselected cell mid-grey on near-black.
    expect(svg).not.toContain('fill="#888"')
  })

  it('leaves a hand outside the range uncoloured, action or not', () => {
    // `hands` is the membership list. Colouring an action stranded on a hand the
    // range does not hold drew a cell the "N hands" count leaves out — and the
    // recognition drill grades that same hand a fold.
    const svg = formatRangeSvg(makeRange({ hands: ['AA'], handActions: { QQ: 'threeBet' } }))

    expect(svg).not.toContain(`fill="${SVG_PALETTE['--act-3bet']}"`)
    expect(svg).toContain(`fill="${SVG_PALETTE['--gold-fill']}"`)
  })

  it('shades the pocket-pair diagonal the way the on-screen grid does', () => {
    const svg = formatRangeSvg(makeRange({ hands: [] }))
    // 13 pairs on the diagonal, 156 hands off it.
    expect((svg.match(new RegExp(`fill="${SVG_PALETTE['--pairbg']}"`, 'g')) ?? []).length).toBe(13)
    expect((svg.match(new RegExp(`fill="${SVG_PALETTE['--cellbg']}"`, 'g')) ?? []).length).toBe(156)
  })

  it('escapes the range name in the title', () => {
    const svg = formatRangeSvg(makeRange({ name: 'A & B <x>' }))
    expect(svg).toContain('<title>A &amp; B &lt;x&gt;</title>')
  })
})

describe('encodeRangeToHash / decodeRangeFromHash', () => {
  it('round-trips a range through a URL-safe hash', () => {
    const range = makeRange({ name: 'BTN open ♠', hands: ['AA', 'AKs'] })
    const hash = encodeRangeToHash(range)
    expect(hash).not.toMatch(/[+/=]/)
    expect(decodeRangeFromHash(hash)).toEqual(range)
  })

  it('rejects a malformed hash', () => {
    expect(() => decodeRangeFromHash('!!!not base64!!!')).toThrow(/Share link|valid/)
  })

  it('still decodes links minted by the original browser btoa encoding', () => {
    const range = makeRange({ name: 'BTN open ♠', hands: ['AA', 'AKs'] })
    const legacy = btoa(unescape(encodeURIComponent(serializeRangeExport(range))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    expect(decodeRangeFromHash(legacy)).toEqual(range)
  })
})

describe('range packs', () => {
  it('round-trips multiple ranges with an optional name', () => {
    const ranges = [makeRange({ id: 'a', name: 'A' }), makeRange({ id: 'b', name: 'B' })]
    const json = serializeRangePack('My pack', ranges)
    expect(json).toContain('\n  ')
    expect(parseRangePack(json)).toEqual({ name: 'My pack', ranges })
  })

  it('omits a blank name', () => {
    const json = serializeRangePack('  ', [makeRange()])
    expect(parseRangePack(json).name).toBeUndefined()
  })

  it('rejects invalid JSON', () => {
    expect(() => parseRangePack('{nope')).toThrow(/valid JSON/)
  })

  it('rejects the wrong kind', () => {
    expect(() =>
      parseRangePack(JSON.stringify({ kind: 'nope', version: 1, ranges: [] })),
    ).toThrow(/poker-range-pack/)
  })

  it('rejects an unsupported version', () => {
    expect(() =>
      parseRangePack(JSON.stringify({ kind: RANGE_PACK_KIND, version: 99, ranges: [] })),
    ).toThrow(/version/)
  })

  it('rejects a non-array or invalid ranges list', () => {
    expect(() =>
      parseRangePack(
        JSON.stringify({ kind: RANGE_PACK_KIND, version: RANGE_PACK_VERSION, ranges: [{ id: 1 }] }),
      ),
    ).toThrow(/valid ranges/)
  })

  it('rejects a pack containing an invalid hand', () => {
    expect(() =>
      parseRangePack(
        JSON.stringify({
          kind: RANGE_PACK_KIND,
          version: RANGE_PACK_VERSION,
          ranges: [makeRange({ hands: ['AA', 'ZZ'] })],
        }),
      ),
    ).toThrow(/valid ranges/)
  })

  it('rejects a pack containing an invalid timestamp', () => {
    expect(() =>
      parseRangePack(
        JSON.stringify({
          kind: RANGE_PACK_KIND,
          version: RANGE_PACK_VERSION,
          ranges: [makeRange({ updatedAt: 'yesterday-ish' })],
        }),
      ),
    ).toThrow(/valid ranges/)
  })
})
