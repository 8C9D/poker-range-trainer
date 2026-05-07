import { describe, it, expect } from 'vitest'
import { filterRangesByName } from './rangeLibrary'

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
