import { gridNeighbours } from './missExplanation.js'
import { ALL_HANDS, type PokerHand } from './pokerHands.js'

/**
 * The edge of a range (v7.2 "borderline-biased prompts").
 *
 * Ranges are drawn as blocks on the 13x13 grid, so the hands that are genuinely
 * hard to remember are the ones on the boundary: an in-range hand with an
 * out-of-range neighbour, or an out-of-range hand sitting right against the
 * range. The middle of a block (AA, or 72o) is never in doubt. Pure.
 */

/**
 * The hands on `rangeHands`'s boundary, in canonical 13x13 order: every hand
 * whose grid neighbours are not all treated the same way it is.
 *
 * Returns both sides of the boundary — the in-range hands you might wrongly fold
 * and the out-of-range hands you might wrongly play. An empty range (or one
 * holding all 169 hands) has no edge at all.
 */
export function rangeEdgeHands(rangeHands: PokerHand[]): PokerHand[] {
  const inRange = new Set(rangeHands)
  return ALL_HANDS.filter((hand) => {
    const isIn = inRange.has(hand)
    return gridNeighbours(hand).some((neighbour) => inRange.has(neighbour) !== isIn)
  })
}
