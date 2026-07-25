import { getRandomPracticeHand } from './practice'
import type { PokerHand } from './pokerHands'
import type { Spot } from './spot'
import { buildSpotCoverage } from './spotCoverage'
import type { SavedRange, TableSize } from '../types/range'

/**
 * Dealing preflop spots to drill (v8.2).
 *
 * The recognition drill starts from a range and asks about hands. This starts
 * from the table: a random spot the library actually covers, a random hand, and
 * the range that answers it — which the user has to recall rather than be told.
 * Pure; the caller supplies the library and the randomness.
 */

/** A spot the library covers, paired with the range that answers it. */
export interface CoveredSpot {
  spot: Spot
  range: SavedRange
}

/** One dealt question: the situation, the hand, and the range that grades it. */
export interface SpotPrompt extends CoveredSpot {
  hand: PokerHand
}

/**
 * Every standard spot at this format that some saved range answers.
 *
 * The drill can only ask what the library can grade, so an uncovered spot is
 * simply not dealt — the coverage map is where gaps get fixed.
 */
export function coveredSpots(
  ranges: SavedRange[],
  tableSize: TableSize,
  stackDepthBb: number,
): CoveredSpot[] {
  const covered: CoveredSpot[] = []
  for (const cell of buildSpotCoverage(ranges, tableSize, stackDepthBb).cells) {
    for (const entry of cell.entries) {
      if (entry.match) covered.push({ spot: entry.spot, range: entry.match.range })
    }
  }
  return covered
}

/**
 * Deal one question: a spot drawn uniformly from `covered`, then a hand drawn
 * the same way the recognition drill draws one. Returns `null` when the library
 * covers nothing, which is the caller's cue to send the user to the coverage map.
 */
export function drawSpotPrompt(
  covered: CoveredSpot[],
  random: () => number = Math.random,
): SpotPrompt | null {
  if (covered.length === 0) return null
  // `random()` can return exactly 1 in theory; clamp so the index stays in range.
  const index = Math.min(Math.floor(random() * covered.length), covered.length - 1)
  const chosen = covered[index]
  return { ...chosen, hand: getRandomPracticeHand(random) }
}
