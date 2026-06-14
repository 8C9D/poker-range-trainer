import { describe, it, expect } from 'vitest'
import { diffRanges, diffSummary } from './rangeDiff'

describe('diffRanges', () => {
  it('splits hands into common / onlyA / onlyB in canonical order', () => {
    const diff = diffRanges(['AA', 'KK', 'AKs'], ['KK', 'AKs', 'QQ'])
    // Canonical matrix order: AKs (row 1) precedes KK (row 2).
    expect(diff.common).toEqual(['AKs', 'KK'])
    expect(diff.onlyA).toEqual(['AA'])
    expect(diff.onlyB).toEqual(['QQ'])
  })

  it('returns all common for identical ranges', () => {
    const diff = diffRanges(['AA', 'KK'], ['KK', 'AA'])
    expect(diff.common).toEqual(['AA', 'KK'])
    expect(diff.onlyA).toEqual([])
    expect(diff.onlyB).toEqual([])
  })

  it('handles disjoint ranges', () => {
    const diff = diffRanges(['AA'], ['22'])
    expect(diff.common).toEqual([])
    expect(diff.onlyA).toEqual(['AA'])
    expect(diff.onlyB).toEqual(['22'])
  })

  it('de-duplicates inputs', () => {
    const diff = diffRanges(['AA', 'AA'], ['AA'])
    expect(diff.common).toEqual(['AA'])
    expect(diff.onlyA).toEqual([])
  })
})

describe('diffSummary', () => {
  it('counts each bucket', () => {
    const diff = diffRanges(['AA', 'KK', 'AKs'], ['KK', 'AKs', 'QQ'])
    expect(diffSummary(diff)).toEqual({ common: 2, onlyA: 1, onlyB: 1 })
  })
})
