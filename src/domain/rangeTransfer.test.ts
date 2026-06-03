import { describe, it, expect } from 'vitest'
import type { SavedRange } from '../types/range'
import {
  RANGE_EXPORT_KIND,
  RANGE_EXPORT_VERSION,
  buildRangeExport,
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
