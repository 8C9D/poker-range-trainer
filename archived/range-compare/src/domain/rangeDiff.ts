import { generateHandMatrix, type PokerHand } from './pokerHands'
import { normalizeRangeHands } from './rangeMath'

/**
 * Range comparison / diff (v5 "compare two ranges" / "range diff view").
 *
 * Compares two hand lists by membership — a user range vs a target range, or two
 * versions of the same range — and splits the hands into common / only-A /
 * only-B, all in canonical matrix order. Pure and dependency-free.
 */

/** The 13x13 matrix order, built once for canonical ordering. */
const MATRIX_HANDS = generateHandMatrix().flat()

export interface RangeDiff {
  /** Hands present in both ranges. */
  common: PokerHand[]
  /** Hands only in the first range. */
  onlyA: PokerHand[]
  /** Hands only in the second range. */
  onlyB: PokerHand[]
}

/** Compare two hand lists by membership; inputs are de-duped and normalized. */
export function diffRanges(a: PokerHand[], b: PokerHand[]): RangeDiff {
  const setA = new Set(normalizeRangeHands(a))
  const setB = new Set(normalizeRangeHands(b))

  const common: PokerHand[] = []
  const onlyA: PokerHand[] = []
  const onlyB: PokerHand[] = []
  for (const hand of MATRIX_HANDS) {
    const inA = setA.has(hand)
    const inB = setB.has(hand)
    if (inA && inB) common.push(hand)
    else if (inA) onlyA.push(hand)
    else if (inB) onlyB.push(hand)
  }
  return { common, onlyA, onlyB }
}

/** The three diff bucket counts. */
export function diffSummary(diff: RangeDiff): { common: number; onlyA: number; onlyB: number } {
  return { common: diff.common.length, onlyA: diff.onlyA.length, onlyB: diff.onlyB.length }
}
