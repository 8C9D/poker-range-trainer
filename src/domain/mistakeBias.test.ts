import { describe, expect, it } from 'vitest'
import {
  describeMistakeBias,
  describePositionBias,
  mistakeBiasByPosition,
  summarizeMistakeBias,
} from './mistakeBias'
import type { HandAccuracyStat, RangeHandAccuracy } from '../types/practice'
import type { Position, SavedRange } from '../types/range'

function stat(hand: string, loose: number, tight: number, correct = 0): HandAccuracyStat {
  return {
    hand,
    attempts: correct + loose + tight,
    correct,
    falsePositives: loose,
    falseNegatives: tight,
  }
}

function handsFor(...stats: HandAccuracyStat[]): RangeHandAccuracy {
  return Object.fromEntries(stats.map((entry) => [entry.hand, entry]))
}

function range(id: string, position?: Position, over: Partial<SavedRange> = {}): SavedRange {
  return {
    id,
    name: id,
    hands: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...(position ? { metadata: { position } } : {}),
    ...over,
  }
}

describe('summarizeMistakeBias', () => {
  it('reports nothing to call before the evidence floor', () => {
    const summary = summarizeMistakeBias({ r1: handsFor(stat('AA', 3, 1)) })
    expect(summary).toMatchObject({ loose: 3, tight: 1, mistakes: 4, bias: 'unknown' })
  })

  it('is unknown with no recorded misses at all', () => {
    const summary = summarizeMistakeBias({ r1: handsFor(stat('AA', 0, 0, 5)) })
    expect(summary).toMatchObject({ mistakes: 0, loosePercentage: 0, bias: 'unknown' })
  })

  it('calls a loose lean once enough misses play hands the chart folds', () => {
    const summary = summarizeMistakeBias({ r1: handsFor(stat('72o', 4, 2)) })
    expect(summary.bias).toBe('loose')
    expect(summary.loosePercentage).toBeCloseTo(66.7, 1)
  })

  it('calls a tight lean the other way', () => {
    const summary = summarizeMistakeBias({ r1: handsFor(stat('A5s', 2, 6)) })
    expect(summary.bias).toBe('tight')
    expect(summary.loosePercentage).toBe(25)
  })

  it('stays balanced when the split is close', () => {
    const summary = summarizeMistakeBias({ r1: handsFor(stat('KJo', 5, 5)) })
    expect(summary).toMatchObject({ loosePercentage: 50, bias: 'balanced' })
  })

  it('sums across every range and hand in the map', () => {
    const summary = summarizeMistakeBias({
      r1: handsFor(stat('AA', 2, 0), stat('KK', 1, 1)),
      r2: handsFor(stat('QQ', 3, 0)),
    })
    expect(summary).toMatchObject({ loose: 6, tight: 1, mistakes: 7, bias: 'loose' })
  })

  it('honours a caller-supplied evidence floor', () => {
    const summary = summarizeMistakeBias({ r1: handsFor(stat('AA', 3, 0)) }, 3)
    expect(summary.bias).toBe('loose')
  })
})

describe('mistakeBiasByPosition', () => {
  it('returns the seats with a decisive lean, most lopsided first', () => {
    const ranges = [range('utgOpen', 'utg'), range('bbDefend', 'bb')]
    const leans = mistakeBiasByPosition(ranges, {
      utgOpen: handsFor(stat('T8s', 5, 2)),
      bbDefend: handsFor(stat('K4o', 0, 8)),
    })
    expect(leans.map((lean) => [lean.position, lean.summary.bias])).toEqual([
      ['bb', 'tight'],
      ['utg', 'loose'],
    ])
  })

  it('drops balanced and under-evidenced seats', () => {
    const ranges = [range('even', 'co'), range('thin', 'btn')]
    const leans = mistakeBiasByPosition(ranges, {
      even: handsFor(stat('QJo', 4, 4)),
      thin: handsFor(stat('J9s', 2, 0)),
    })
    expect(leans).toEqual([])
  })

  it('pools every chart saved at the same seat', () => {
    const ranges = [range('open', 'co'), range('threeBet', 'co')]
    const leans = mistakeBiasByPosition(ranges, {
      open: handsFor(stat('K9o', 3, 1)),
      threeBet: handsFor(stat('A2s', 2, 0)),
    })
    expect(leans).toEqual([
      { position: 'co', summary: expect.objectContaining({ loose: 5, tight: 1, bias: 'loose' }) },
    ])
  })

  it('skips archived charts and charts with no declared seat', () => {
    const ranges = [
      range('archived', 'utg', { archived: true }),
      range('seatless'),
      range('live', 'sb'),
    ]
    const leans = mistakeBiasByPosition(ranges, {
      archived: handsFor(stat('AA', 9, 0)),
      seatless: handsFor(stat('KK', 9, 0)),
      live: handsFor(stat('QQ', 6, 1)),
    })
    expect(leans.map((lean) => lean.position)).toEqual(['sb'])
  })

  it('ignores accuracy records whose range is gone', () => {
    const leans = mistakeBiasByPosition([range('live', 'hj')], {
      live: handsFor(stat('AA', 6, 0)),
      deleted: handsFor(stat('KK', 0, 9)),
    })
    expect(leans.map((lean) => lean.position)).toEqual(['hj'])
  })
})

describe('wording', () => {
  it('names each direction in plain words', () => {
    expect(describeMistakeBias(summarizeMistakeBias({ r1: handsFor(stat('AA', 6, 0)) }))).toContain(
      'lean loose',
    )
    expect(describeMistakeBias(summarizeMistakeBias({ r1: handsFor(stat('AA', 0, 6)) }))).toContain(
      'lean tight',
    )
    expect(describeMistakeBias(summarizeMistakeBias({ r1: handsFor(stat('AA', 3, 3)) }))).toContain(
      'split evenly',
    )
    expect(describeMistakeBias(summarizeMistakeBias({}))).toContain('Practice a little more')
  })

  it('describes a seat lean as the correction to make', () => {
    const [loose] = mistakeBiasByPosition([range('r', 'utg')], { r: handsFor(stat('AA', 6, 0)) })
    const [tight] = mistakeBiasByPosition([range('r', 'bb')], { r: handsFor(stat('AA', 0, 6)) })
    expect(describePositionBias(loose)).toBe('plays too many hands')
    expect(describePositionBias(tight)).toBe('folds too many hands')
  })
})
