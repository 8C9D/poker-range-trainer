import { describe, it, expect } from 'vitest'
import { filterRangesByName, filterRangesByPosition } from './rangeLibrary'

/** Minimal stand-ins for saved ranges — only the name matters to the filter. */
const ranges = [
  { name: 'Button open' },
  { name: 'BB defend vs CO' },
  { name: 'SB 3-bet vs BTN' },
]

describe('filterRangesByName', () => {
  it('matches names containing the query as a substring', () => {
    expect(filterRangesByName(ranges, 'defend')).toEqual([{ name: 'BB defend vs CO' }])
  })

  it('is case-insensitive in both directions', () => {
    expect(filterRangesByName(ranges, 'BUTTON')).toEqual([{ name: 'Button open' }])
    expect(filterRangesByName(ranges, 'co')).toEqual([{ name: 'BB defend vs CO' }])
  })

  it('returns every range for an empty query', () => {
    expect(filterRangesByName(ranges, '')).toEqual(ranges)
  })

  it('treats a whitespace-only query as empty and returns every range', () => {
    expect(filterRangesByName(ranges, '   ')).toEqual(ranges)
  })

  it('ignores whitespace around the query', () => {
    expect(filterRangesByName(ranges, '  button  ')).toEqual([{ name: 'Button open' }])
  })

  it('returns an empty array when nothing matches', () => {
    expect(filterRangesByName(ranges, 'zzz')).toEqual([])
  })

  it('preserves the input order of the matches', () => {
    expect(filterRangesByName(ranges, 'b')).toEqual([
      { name: 'Button open' },
      { name: 'BB defend vs CO' },
      { name: 'SB 3-bet vs BTN' },
    ])
  })

  it('does not mutate the input array', () => {
    const input = [{ name: 'Button open' }, { name: 'BB defend vs CO' }]
    const snapshot = [...input]
    filterRangesByName(input, 'open')
    filterRangesByName(input, '')
    expect(input).toEqual(snapshot)
  })

  it('returns a fresh array rather than the original reference', () => {
    expect(filterRangesByName(ranges, '')).not.toBe(ranges)
  })
})

/** Mixed metadata so each filtering branch has a distinct case. */
const positioned = [
  { name: 'BTN open', metadata: { position: 'btn' } },
  { name: 'CO open', metadata: { position: 'co' } },
  { name: 'Another BTN', metadata: { position: 'btn' } },
  { name: 'Position-less metadata', metadata: {} },
  { name: 'No metadata' },
]

describe('filterRangesByPosition', () => {
  it('returns only the ranges whose metadata.position matches', () => {
    expect(filterRangesByPosition(positioned, 'btn')).toEqual([
      { name: 'BTN open', metadata: { position: 'btn' } },
      { name: 'Another BTN', metadata: { position: 'btn' } },
    ])
  })

  it('excludes ranges without metadata or without a position', () => {
    // 'co' matches a single positioned range; the metadata-less and
    // position-less entries are never included.
    expect(filterRangesByPosition(positioned, 'co')).toEqual([
      { name: 'CO open', metadata: { position: 'co' } },
    ])
  })

  it('returns every range for a null position', () => {
    expect(filterRangesByPosition(positioned, null)).toEqual(positioned)
  })

  it('treats an empty position as "all" and returns every range', () => {
    expect(filterRangesByPosition(positioned, '')).toEqual(positioned)
  })

  it('returns an empty array when no range has the position', () => {
    expect(filterRangesByPosition(positioned, 'sb')).toEqual([])
  })

  it('preserves the input order of the matches', () => {
    expect(filterRangesByPosition(positioned, 'btn')).toEqual([
      { name: 'BTN open', metadata: { position: 'btn' } },
      { name: 'Another BTN', metadata: { position: 'btn' } },
    ])
  })

  it('does not mutate the input array', () => {
    const input = [
      { name: 'BTN open', metadata: { position: 'btn' } },
      { name: 'No metadata' },
    ]
    const snapshot = structuredClone(input)
    filterRangesByPosition(input, 'btn')
    filterRangesByPosition(input, null)
    expect(input).toEqual(snapshot)
  })

  it('returns a fresh array rather than the original reference', () => {
    expect(filterRangesByPosition(positioned, null)).not.toBe(positioned)
  })
})
