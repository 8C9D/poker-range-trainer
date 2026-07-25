import { describe, expect, it } from 'vitest'
import { rangeEdgeHands } from './edgeHands'
import { ALL_HANDS } from './pokerHands'

describe('rangeEdgeHands', () => {
  it('has no edge for an empty range or the full grid', () => {
    expect(rangeEdgeHands([])).toEqual([])
    expect(rangeEdgeHands(ALL_HANDS)).toEqual([])
  })

  it('returns both sides of the boundary for a single-hand range', () => {
    // AA sits in the corner; only AKs and AKo touch it.
    expect(rangeEdgeHands(['AA']).sort()).toEqual(['AA', 'AKs', 'AKo'].sort())
  })

  it('leaves out hands surrounded entirely by the same treatment', () => {
    // AA, AKs and AKo are all in, so AA has no differing neighbour left.
    const edge = rangeEdgeHands(['AA', 'AKs', 'AKo'])

    expect(edge).not.toContain('AA')
    expect(edge).toContain('AKs')
    expect(edge).toContain('AKo')
  })

  it('returns hands in canonical grid order', () => {
    const edge = rangeEdgeHands(['AA', 'KK'])
    const order = ALL_HANDS.filter((hand) => edge.includes(hand))

    expect(edge).toEqual(order)
  })
})
