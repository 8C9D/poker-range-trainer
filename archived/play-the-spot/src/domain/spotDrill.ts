import { getRandomPracticeHand } from './practice'
import type { PokerHand } from './pokerHands'
import { followUpSpots, spotKey, type Spot } from './spot'
import { buildSpotCoverage } from './spotCoverage'
import type { PracticeAttempt, SpotAccuracyStat } from '../types/practice'
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
  const chosen = pick(covered, random)
  return chosen ? { ...chosen, hand: getRandomPracticeHand(random) } : null
}

/**
 * The second decision on the same hand (v8.3), or `null` when the hand ends here.
 *
 * A spot can continue — you open and get 3-bet — but only if the library holds a
 * range for what comes next. An uncovered continuation is not asked: the drill
 * never quizzes a chart the user has not written.
 */
export function nextChainedSpot(
  spot: Spot,
  covered: CoveredSpot[],
  random: () => number = Math.random,
): CoveredSpot | null {
  const wanted = new Set(followUpSpots(spot).map(spotKey))
  return pick(
    covered.filter((candidate) => wanted.has(spotKey(candidate.spot))),
    random,
  )
}

/** One entry drawn uniformly, or null when there is nothing to draw from. */
function pick<T>(items: T[], random: () => number): T | null {
  if (items.length === 0) return null
  // `random()` can return exactly 1 in theory; clamp so the index stays in range.
  return items[Math.min(Math.floor(random() * items.length), items.length - 1)]
}

/** One answered spot question, tagged with the range and the spot it came from. */
export interface AnsweredSpot {
  rangeId: string
  spotKey: string
  attempt: PracticeAttempt
}

/** What a finished spot session reports back. */
export interface SpotSessionResult {
  /** Attempts grouped by the range that graded them (one session each). */
  byRange: Record<string, PracticeAttempt[]>
  /** Per-spot tallies, for the weakest-spots record. */
  bySpot: SpotAccuracyStat[]
}

/**
 * Fold answered questions into the two cuts a spot session is recorded under.
 *
 * A spot session spans several ranges, so it cannot be recorded as one session:
 * each range gets its own, while the per-spot tally is what makes "which
 * situation do I play worst" answerable at all.
 */
export function summarizeSpotSession(answered: AnsweredSpot[]): SpotSessionResult {
  const byRange: Record<string, PracticeAttempt[]> = {}
  const bySpot = new Map<string, SpotAccuracyStat>()
  for (const { rangeId, spotKey, attempt } of answered) {
    ;(byRange[rangeId] ??= []).push(attempt)
    const stat = bySpot.get(spotKey) ?? { spotKey, attempts: 0, correct: 0 }
    stat.attempts += 1
    if (attempt.correct) stat.correct += 1
    bySpot.set(spotKey, stat)
  }
  return { byRange, bySpot: [...bySpot.values()] }
}
