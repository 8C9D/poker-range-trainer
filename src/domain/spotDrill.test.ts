import { describe, expect, it } from 'vitest'
import { coveredSpots, drawSpotPrompt, nextChainedSpot } from './spotDrill'
import { spotKey, type Spot } from './spot'
import { ALL_HANDS } from './pokerHands'
import type { RangeMetadata, SavedRange } from '../types/range'

function makeRange(name: string, metadata: RangeMetadata): SavedRange {
  return {
    id: name,
    name,
    hands: ['AA', 'KK'],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    metadata,
  }
}

const btnOpen = makeRange('BTN open', { position: 'btn', actionType: 'open' })
const bbVsCo = makeRange('BB defend vs CO', {
  position: 'bb',
  actionType: 'defend',
  versusPosition: 'co',
})

describe('coveredSpots', () => {
  it('is empty for a library that answers nothing', () => {
    expect(coveredSpots([], 'sixMax', 100)).toEqual([])
    expect(coveredSpots([makeRange('bare', {})], 'sixMax', 100)).toEqual([])
  })

  it('pairs each covered spot with the range that answers it', () => {
    const covered = coveredSpots([btnOpen, bbVsCo], 'sixMax', 100)

    expect(covered).toHaveLength(2)
    expect(covered.map((c) => spotKey(c.spot))).toEqual([
      'sixMax|btn|foldedToYou|-|100',
      'sixMax|bb|facingOpen|co|100',
    ])
    expect(covered.map((c) => c.range.name)).toEqual(['BTN open', 'BB defend vs CO'])
  })

  it('leaves out spots at a format the library does not cover', () => {
    const short = makeRange('20bb jam', { position: 'btn', actionType: 'jam', stackDepthBb: 20 })

    expect(coveredSpots([short], 'sixMax', 100)).toEqual([])
    // A jam chart answers every situation a jam can end: folded to you, facing a
    // 3-bet (sb/bb behind), and facing a 4-bet (utg/hj/co in front).
    expect(coveredSpots([short], 'sixMax', 20)).toHaveLength(6)
  })
})

describe('drawSpotPrompt', () => {
  it('returns nothing when the library covers no spot', () => {
    expect(drawSpotPrompt([], () => 0)).toBeNull()
  })

  it('deals a spot, its grading range, and a hand', () => {
    const covered = coveredSpots([btnOpen], 'sixMax', 100)
    const prompt = drawSpotPrompt(covered, () => 0)

    expect(prompt?.range.name).toBe('BTN open')
    expect(prompt?.spot.position).toBe('btn')
    expect(ALL_HANDS).toContain(prompt?.hand)
  })

  it('draws across the covered spots', () => {
    const covered = coveredSpots([btnOpen, bbVsCo], 'sixMax', 100)

    expect(drawSpotPrompt(covered, () => 0)?.range.name).toBe('BTN open')
    expect(drawSpotPrompt(covered, () => 0.99)?.range.name).toBe('BB defend vs CO')
  })

  it('stays in range when random() returns exactly 1', () => {
    const covered = coveredSpots([btnOpen, bbVsCo], 'sixMax', 100)

    expect(drawSpotPrompt(covered, () => 1)?.range.name).toBe('BB defend vs CO')
  })
})

describe('nextChainedSpot', () => {
  const btnOpenSpot: Spot = {
    tableSize: 'sixMax',
    position: 'btn',
    situation: 'foldedToYou',
    stackDepthBb: 100,
  }
  const vsBbThreeBet = makeRange('BTN vs BB 3-bet', {
    position: 'btn',
    actionType: 'fourBet',
    versusPosition: 'bb',
  })

  it('ends the hand when the library has no range for what comes next', () => {
    const covered = coveredSpots([btnOpen], 'sixMax', 100)

    expect(nextChainedSpot(btnOpenSpot, covered, () => 0)).toBeNull()
  })

  it('continues into a covered follow-up spot', () => {
    const covered = coveredSpots([btnOpen, vsBbThreeBet], 'sixMax', 100)
    const next = nextChainedSpot(btnOpenSpot, covered, () => 0)

    expect(next?.range.name).toBe('BTN vs BB 3-bet')
    expect(spotKey(next!.spot)).toBe('sixMax|btn|facingThreeBet|bb|100')
  })

  it('never offers a follow-up that is not a continuation of this spot', () => {
    // The BB defend range covers a spot, but not one that follows a BTN open.
    const covered = coveredSpots([btnOpen, bbVsCo], 'sixMax', 100)

    expect(nextChainedSpot(btnOpenSpot, covered, () => 0)).toBeNull()
  })

  it('ends the hand after a jam', () => {
    const covered = coveredSpots([btnOpen, vsBbThreeBet], 'sixMax', 100)
    const jam: Spot = { ...btnOpenSpot, situation: 'facingJam', versusPosition: 'bb' }

    expect(nextChainedSpot(jam, covered, () => 0)).toBeNull()
  })
})
