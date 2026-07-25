import { describe, expect, it } from 'vitest'
import {
  defaultActionTypeForSpot,
  followUpSpots,
  describeSpot,
  matchRangeToSpot,
  scoreRangeForSpot,
  seatsForTableSize,
  spotKey,
  standardSpots,
  villainsForSituation,
  type Spot,
} from './spot'
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

const btnOpen: Spot = {
  tableSize: 'sixMax',
  position: 'btn',
  situation: 'foldedToYou',
  stackDepthBb: 100,
}

const bbVsCo: Spot = {
  tableSize: 'sixMax',
  position: 'bb',
  situation: 'facingOpen',
  versusPosition: 'co',
  stackDepthBb: 100,
}

describe('seatsForTableSize', () => {
  it('gives heads-up only the button and the big blind', () => {
    expect(seatsForTableSize('headsUp')).toEqual(['btn', 'bb'])
  })

  it('shares the six-seat vocabulary between 6-max and 9-max', () => {
    expect(seatsForTableSize('sixMax')).toEqual(['utg', 'hj', 'co', 'btn', 'sb', 'bb'])
    expect(seatsForTableSize('nineMax')).toEqual(seatsForTableSize('sixMax'))
  })
})

describe('villainsForSituation', () => {
  it('has no opponent when the pot is folded to hero', () => {
    expect(villainsForSituation('sixMax', 'btn', 'foldedToYou')).toEqual([])
  })

  it('takes an open or a 4-bet from the seats acting before hero', () => {
    expect(villainsForSituation('sixMax', 'btn', 'facingOpen')).toEqual(['utg', 'hj', 'co'])
    expect(villainsForSituation('sixMax', 'btn', 'facingFourBet')).toEqual(['utg', 'hj', 'co'])
    expect(villainsForSituation('sixMax', 'utg', 'facingOpen')).toEqual([])
  })

  it('takes a 3-bet or a jam from the seats acting behind hero', () => {
    expect(villainsForSituation('sixMax', 'co', 'facingThreeBet')).toEqual(['btn', 'sb', 'bb'])
    expect(villainsForSituation('sixMax', 'co', 'facingJam')).toEqual(['btn', 'sb', 'bb'])
    expect(villainsForSituation('sixMax', 'bb', 'facingThreeBet')).toEqual([])
  })
})

describe('standardSpots', () => {
  it('skips the folded-to-you spot in the big blind', () => {
    const foldedTo = standardSpots('sixMax', 100).filter((s) => s.situation === 'foldedToYou')

    expect(foldedTo.map((s) => s.position)).toEqual(['utg', 'hj', 'co', 'btn', 'sb'])
  })

  it('names an opponent on every spot except folded-to-you', () => {
    for (const spot of standardSpots('sixMax', 100)) {
      expect(spot.versusPosition === undefined).toBe(spot.situation === 'foldedToYou')
    }
  })

  it('carries the requested table size and stack depth onto every spot', () => {
    const spots = standardSpots('headsUp', 20)

    expect(spots.length).toBeGreaterThan(0)
    expect(spots.every((s) => s.tableSize === 'headsUp' && s.stackDepthBb === 20)).toBe(true)
  })
})

describe('spotKey', () => {
  it('separates spots that differ only by opponent', () => {
    expect(spotKey(bbVsCo)).not.toEqual(spotKey({ ...bbVsCo, versusPosition: 'btn' }))
  })

  it('is stable for the same spot', () => {
    expect(spotKey(btnOpen)).toEqual(spotKey({ ...btnOpen }))
  })
})

describe('describeSpot', () => {
  it('describes a pot folded to hero without an opponent', () => {
    expect(describeSpot(btnOpen)).toBe('6-max, 100bb. Folded to you in the BTN.')
  })

  it('names the opponent and the action faced', () => {
    expect(describeSpot(bbVsCo)).toBe('6-max, 100bb. You are in the BB facing an open from the CO.')
  })
})

describe('followUpSpots', () => {
  it('offers a 3-bet from every seat behind an opener', () => {
    expect(followUpSpots(btnOpen)).toEqual([
      { ...btnOpen, situation: 'facingThreeBet', versusPosition: 'sb' },
      { ...btnOpen, situation: 'facingThreeBet', versusPosition: 'bb' },
    ])
  })

  it('sends a 3-bet back to the original raiser as a 4-bet', () => {
    expect(followUpSpots(bbVsCo)).toEqual([{ ...bbVsCo, situation: 'facingFourBet' }])
  })

  it('sends a 4-bet back to the 3-bettor as a jam', () => {
    const vsThreeBet: Spot = { ...btnOpen, situation: 'facingThreeBet', versusPosition: 'bb' }

    expect(followUpSpots(vsThreeBet)).toEqual([{ ...vsThreeBet, situation: 'facingJam' }])
  })

  it('ends the hand where there is nothing left to face', () => {
    expect(followUpSpots({ ...bbVsCo, situation: 'facingFourBet' })).toEqual([])
    expect(followUpSpots({ ...bbVsCo, situation: 'facingJam' })).toEqual([])
    // The big blind opening (nobody behind) has no 3-bet to face.
    expect(followUpSpots({ ...btnOpen, position: 'bb' })).toEqual([])
  })
})

describe('defaultActionTypeForSpot', () => {
  it('defends from the big blind and 3-bets from everywhere else', () => {
    expect(defaultActionTypeForSpot(bbVsCo)).toBe('defend')
    expect(defaultActionTypeForSpot({ ...bbVsCo, position: 'btn' })).toBe('threeBet')
  })

  it('takes the first allowed action type for the other situations', () => {
    expect(defaultActionTypeForSpot(btnOpen)).toBe('open')
    expect(defaultActionTypeForSpot({ ...btnOpen, situation: 'facingJam' })).toBe('callJam')
  })
})

describe('scoreRangeForSpot', () => {
  it('rejects a range with no seat or action type recorded', () => {
    expect(scoreRangeForSpot(range('bare', {}), btnOpen)).toBeNull()
    expect(scoreRangeForSpot(range('seat only', { position: 'btn' }), btnOpen)).toBeNull()
  })

  it('rejects a range saved for a different seat', () => {
    expect(scoreRangeForSpot(range('co', { position: 'co', actionType: 'open' }), btnOpen)).toBeNull()
  })

  it('rejects a range whose action type answers another situation', () => {
    const threeBet = range('3bet', { position: 'btn', actionType: 'threeBet' })

    expect(scoreRangeForSpot(threeBet, btnOpen)).toBeNull()
    expect(scoreRangeForSpot(threeBet, { ...bbVsCo, position: 'btn' })).toBe(60)
  })

  it('accepts a generic chart that records nothing beyond seat and action', () => {
    expect(scoreRangeForSpot(range('open', { position: 'btn', actionType: 'open' }), btnOpen)).toBe(60)
  })

  it('scores a fully pinned range highest', () => {
    const exact = range('exact', {
      position: 'bb',
      actionType: 'defend',
      tableSize: 'sixMax',
      versusPosition: 'co',
      stackDepthBb: 100,
    })

    expect(scoreRangeForSpot(exact, bbVsCo)).toBe(100)
  })

  it('rejects a range recorded for a different table size or opponent', () => {
    const wrongTable = range('hu', { position: 'btn', actionType: 'open', tableSize: 'headsUp' })
    const wrongVillain = range('vs btn', { position: 'bb', actionType: 'defend', versusPosition: 'btn' })

    expect(scoreRangeForSpot(wrongTable, btnOpen)).toBeNull()
    expect(scoreRangeForSpot(wrongVillain, bbVsCo)).toBeNull()
  })

  it('never answers a folded-to-you spot with a range saved against an opponent', () => {
    const vsCo = range('vs co', { position: 'btn', actionType: 'open', versusPosition: 'co' })

    expect(scoreRangeForSpot(vsCo, btnOpen)).toBeNull()
  })

  it('accepts a stack depth within tolerance and rejects one outside it', () => {
    const near = range('near', { position: 'btn', actionType: 'open', stackDepthBb: 80 })
    const far = range('far', { position: 'btn', actionType: 'open', stackDepthBb: 20 })

    expect(scoreRangeForSpot(near, btnOpen)).toBe(70)
    expect(scoreRangeForSpot(far, btnOpen)).toBeNull()
  })

  it('ignores archived ranges', () => {
    const archived = range('old', { position: 'btn', actionType: 'open' }, { archived: true })

    expect(scoreRangeForSpot(archived, btnOpen)).toBeNull()
  })
})

describe('matchRangeToSpot', () => {
  it('returns nothing when the library does not cover the spot', () => {
    expect(matchRangeToSpot([], btnOpen)).toBeNull()
    expect(matchRangeToSpot([range('utg', { position: 'utg', actionType: 'open' })], btnOpen)).toBeNull()
  })

  it('prefers the range that pins the spot most precisely', () => {
    const generic = range('generic', { position: 'btn', actionType: 'open' })
    const pinned = range('pinned', {
      position: 'btn',
      actionType: 'open',
      tableSize: 'sixMax',
      stackDepthBb: 100,
    })

    expect(matchRangeToSpot([generic, pinned], btnOpen)).toEqual({ range: pinned, confidence: 85 })
  })

  it('breaks a tie toward the more recently edited range', () => {
    const older = range('older', { position: 'btn', actionType: 'open' })
    const newer = range(
      'newer',
      { position: 'btn', actionType: 'open' },
      { updatedAt: '2026-07-20T00:00:00.000Z' },
    )

    expect(matchRangeToSpot([older, newer], btnOpen)?.range).toBe(newer)
    expect(matchRangeToSpot([newer, older], btnOpen)?.range).toBe(newer)
  })

  it('breaks a same-timestamp tie by name', () => {
    const a = range('a chart', { position: 'btn', actionType: 'open' })
    const b = range('b chart', { position: 'btn', actionType: 'open' })

    expect(matchRangeToSpot([b, a], btnOpen)?.range).toBe(a)
  })
})
