import { describe, expect, it } from 'vitest'
import { rankSpotLeaks } from './spotLeaks'
import type { SpotAccuracyStat } from '../types/practice'

const BTN = 'sixMax|btn|foldedToYou|-|100'
const BB = 'sixMax|bb|facingOpen|co|100'
const SB = 'sixMax|sb|facingOpen|btn|100'

function record(...stats: SpotAccuracyStat[]): Record<string, SpotAccuracyStat> {
  return Object.fromEntries(stats.map((stat) => [stat.spotKey, stat]))
}

describe('rankSpotLeaks', () => {
  it('is empty without records', () => {
    expect(rankSpotLeaks({})).toEqual([])
  })

  it('ranks the weakest spot first and parses the spot back', () => {
    const leaks = rankSpotLeaks(
      record(
        { spotKey: BTN, attempts: 10, correct: 9 },
        { spotKey: BB, attempts: 10, correct: 4 },
      ),
    )

    expect(leaks.map((leak) => leak.accuracy)).toEqual([40, 90])
    expect(leaks[0].spot).toEqual({
      tableSize: 'sixMax',
      position: 'bb',
      situation: 'facingOpen',
      versusPosition: 'co',
      stackDepthBb: 100,
    })
  })

  it('hides spots below the attempt threshold', () => {
    expect(rankSpotLeaks(record({ spotKey: BTN, attempts: 4, correct: 0 }))).toEqual([])
    expect(rankSpotLeaks(record({ spotKey: BTN, attempts: 4, correct: 0 }), 4)).toHaveLength(1)
  })

  it('skips a record whose key is not a spot', () => {
    const leaks = rankSpotLeaks(
      record(
        { spotKey: 'tenMax|btn|foldedToYou|-|100', attempts: 10, correct: 0 },
        { spotKey: BTN, attempts: 10, correct: 5 },
      ),
    )

    expect(leaks.map((leak) => leak.spot.tableSize)).toEqual(['sixMax'])
  })

  it('breaks an accuracy tie toward the more practiced spot', () => {
    const leaks = rankSpotLeaks(
      record(
        { spotKey: BB, attempts: 10, correct: 5 },
        { spotKey: SB, attempts: 20, correct: 10 },
      ),
    )

    expect(leaks.map((leak) => leak.spot.position)).toEqual(['sb', 'bb'])
  })
})
