import { describe, expect, it } from 'vitest'
import { buildSpotCoverage, inferLibraryContext } from './spotCoverage'
import { standardSpots } from './spot'
import type { RangeMetadata, SavedRange } from '../types/range'

function range(name: string, metadata: RangeMetadata, overrides: Partial<SavedRange> = {}): SavedRange {
  return {
    id: name,
    name,
    hands: ['AA'],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    metadata,
    ...overrides,
  }
}

describe('buildSpotCoverage', () => {
  it('reports nothing covered for an empty library', () => {
    const report = buildSpotCoverage([], 'sixMax', 100)

    expect(report.total).toBe(standardSpots('sixMax', 100).length)
    expect(report.covered).toBe(0)
    expect(report.coveragePercentage).toBe(0)
    expect(report.cells.every((cell) => cell.covered === 0)).toBe(true)
  })

  it('drops seat/situation pairs that hold no standard spot', () => {
    const cells = buildSpotCoverage([], 'sixMax', 100).cells

    expect(cells.every((cell) => cell.total > 0)).toBe(true)
    expect(cells.some((cell) => cell.position === 'bb' && cell.situation === 'foldedToYou')).toBe(
      false,
    )
    expect(cells.some((cell) => cell.position === 'utg' && cell.situation === 'facingOpen')).toBe(
      false,
    )
  })

  it('covers every spot in a cell with one generic chart', () => {
    const report = buildSpotCoverage(
      [range('btn open', { position: 'btn', actionType: 'open' })],
      'sixMax',
      100,
    )
    const cell = report.cells.find((c) => c.position === 'btn' && c.situation === 'foldedToYou')

    expect(cell).toMatchObject({ covered: 1, total: 1 })
    expect(cell?.entries[0].match?.range.name).toBe('btn open')
    expect(report.covered).toBe(1)
  })

  it('covers only the named opponent when the range pins one', () => {
    const report = buildSpotCoverage(
      [range('bb vs co', { position: 'bb', actionType: 'defend', versusPosition: 'co' })],
      'sixMax',
      100,
    )
    const cell = report.cells.find((c) => c.position === 'bb' && c.situation === 'facingOpen')

    expect(cell?.total).toBe(5)
    expect(cell?.covered).toBe(1)
    expect(cell?.entries.filter((e) => e.match).map((e) => e.spot.versusPosition)).toEqual(['co'])
  })

  it('leaves a spot uncovered when the range is for another depth', () => {
    const report = buildSpotCoverage(
      [range('short', { position: 'btn', actionType: 'open', stackDepthBb: 20 })],
      'sixMax',
      100,
    )

    expect(report.covered).toBe(0)
  })

  it('computes the coverage percentage over all standard spots', () => {
    const spots = standardSpots('headsUp', 100)
    const report = buildSpotCoverage(
      [range('btn open', { position: 'btn', actionType: 'open' })],
      'headsUp',
      100,
    )

    expect(report.coveragePercentage).toBeCloseTo((1 / spots.length) * 100)
  })
})

describe('inferLibraryContext', () => {
  it('defaults to 6-max 100bb for a library that declares nothing', () => {
    expect(inferLibraryContext([])).toEqual({ tableSize: 'sixMax', stackDepthBb: 100 })
    expect(inferLibraryContext([range('bare', {})])).toEqual({
      tableSize: 'sixMax',
      stackDepthBb: 100,
    })
  })

  it('takes the most common declared table size and stack depth', () => {
    const ranges = [
      range('a', { tableSize: 'headsUp', stackDepthBb: 20 }),
      range('b', { tableSize: 'headsUp', stackDepthBb: 20 }),
      range('c', { tableSize: 'nineMax', stackDepthBb: 100 }),
    ]

    expect(inferLibraryContext(ranges)).toEqual({ tableSize: 'headsUp', stackDepthBb: 20 })
  })

  it('ignores archived ranges and non-positive depths', () => {
    const ranges = [
      range('old', { tableSize: 'headsUp', stackDepthBb: 20 }, { archived: true }),
      range('live', { tableSize: 'nineMax', stackDepthBb: 0 }),
    ]

    expect(inferLibraryContext(ranges)).toEqual({ tableSize: 'nineMax', stackDepthBb: 100 })
  })
})
