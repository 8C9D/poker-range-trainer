import { describe, it, expect } from 'vitest'
import type { SavedRange } from '../types/range'
import {
  RANGE_EXPORT_KIND,
  RANGE_EXPORT_VERSION,
  buildRangeExport,
  formatRangeCsv,
  parseRangeExport,
  serializeRangeExport,
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
