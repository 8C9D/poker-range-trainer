import { ALL_HANDS, isValidHand, type PokerHand } from './pokerHands'
import { normalizeRangeHands } from './rangeMath'
import type { HandAccuracyStat, PracticeAttempt, PracticeSessionSummary } from '../types/practice'

/**
 * Pure domain logic for practicing a saved preflop range: deciding whether a
 * prompted hand belongs to a range, scoring a user's answer, summarizing a
 * session, and drawing a random hand to prompt.
 *
 * Uses only ECMAScript built-ins (`Date`, `Math`) — no React or browser APIs —
 * so it stays UI-agnostic and unit-testable.
 */

/** Throw with a clear message if `hand` is not one of the 169 canonical starting hands. */
function assertValidPracticeHand(hand: PokerHand): void {
  if (!isValidHand(hand)) {
    throw new Error(`Invalid practice hand: ${hand}`)
  }
}

/**
 * Whether `hand` is a member of `rangeHands`.
 *
 * The range is normalized first (validated + de-duplicated), so duplicate
 * entries never change the answer and an invalid range hand is rejected the
 * same way an invalid prompt is. Throws if `hand` or any range hand is invalid.
 */
export function isHandInRange(hand: PokerHand, rangeHands: PokerHand[]): boolean {
  assertValidPracticeHand(hand)
  return normalizeRangeHands(rangeHands).includes(hand)
}

/**
 * Score a single practice answer against the range.
 *
 * `expectedInRange` is computed from the range and `correct` is whether the
 * user's answer matched it. `timestamp` defaults to now (ISO-8601). Throws if
 * `hand` or any range hand is invalid.
 */
export function createPracticeAttempt(
  hand: PokerHand,
  rangeHands: PokerHand[],
  userAnsweredInRange: boolean,
  timestamp: string = new Date().toISOString(),
): PracticeAttempt {
  const expectedInRange = isHandInRange(hand, rangeHands)
  return {
    hand,
    expectedInRange,
    userAnsweredInRange,
    correct: userAnsweredInRange === expectedInRange,
    timestamp,
  }
}

/**
 * Aggregate a session's attempts into totals and accuracy.
 *
 * An empty list summarizes as all zeros (accuracy 0 rather than NaN).
 */
export function summarizePracticeAttempts(
  attempts: PracticeAttempt[],
): PracticeSessionSummary {
  const totalQuestions = attempts.length
  const correctAnswers = attempts.filter((attempt) => attempt.correct).length
  const accuracyPercentage =
    totalQuestions === 0 ? 0 : (correctAnswers / totalQuestions) * 100
  return { totalQuestions, correctAnswers, accuracyPercentage }
}

/**
 * Split a session's mistakes into the two kinds, for an end-of-session review.
 *
 * `missed` lists hands that were in the range but answered "out of range"
 * (forgotten); `wronglyIncluded` lists hands that were out of the range but
 * answered "in range". Correct attempts satisfy neither condition and so
 * contribute to neither list. Each list is de-duplicated by hand while
 * preserving first-occurrence order, since a hand can be drawn and answered
 * more than once in a session but should appear at most once per list. An empty
 * input yields two empty lists.
 */
export function reviewSessionMistakes(attempts: PracticeAttempt[]): {
  missed: PokerHand[]
  wronglyIncluded: PokerHand[]
} {
  const missed: PokerHand[] = []
  const wronglyIncluded: PokerHand[] = []
  for (const { hand, expectedInRange, userAnsweredInRange } of attempts) {
    if (expectedInRange && !userAnsweredInRange) {
      if (!missed.includes(hand)) missed.push(hand)
    } else if (!expectedInRange && userAnsweredInRange) {
      if (!wronglyIncluded.includes(hand)) wronglyIncluded.push(hand)
    }
  }
  return { missed, wronglyIncluded }
}

/**
 * Aggregate a session's attempts into per-hand accuracy stats, for v2.1 mistake
 * tracking.
 *
 * For each hand answered at least once, tallies total `attempts`, `correct`
 * answers, `falsePositives` (out of range, answered "in range"), and
 * `falseNegatives` (in range, answered "out of range"). Hands never answered are
 * omitted. The result is in canonical 13×13 order. Pure — no Date, no random.
 */
export function summarizeHandAccuracy(attempts: PracticeAttempt[]): HandAccuracyStat[] {
  const byHand = new Map<PokerHand, HandAccuracyStat>()
  for (const { hand, expectedInRange, userAnsweredInRange, correct } of attempts) {
    let stat = byHand.get(hand)
    if (!stat) {
      stat = { hand, attempts: 0, correct: 0, falsePositives: 0, falseNegatives: 0 }
      byHand.set(hand, stat)
    }
    stat.attempts += 1
    if (correct) {
      stat.correct += 1
    } else if (!expectedInRange && userAnsweredInRange) {
      stat.falsePositives += 1
    } else if (expectedInRange && !userAnsweredInRange) {
      stat.falseNegatives += 1
    }
  }
  return ALL_HANDS.filter((hand) => byHand.has(hand)).map((hand) => byHand.get(hand)!)
}

/**
 * Compare a user-built set of hands against a target range, for "build from
 * memory" practice (mode 3).
 *
 * Both inputs are normalized first (validated + de-duplicated + ordered), so
 * duplicate entries and input ordering never change the result and an invalid
 * hand is rejected the same way the rest of the domain rejects it. The result
 * splits into three lists, each in canonical 13×13 order and free of
 * duplicates: `correct` (in both target and built), `missed` (in target but
 * not built — forgotten), and `extra` (in built but not target — added by
 * mistake). Two empty inputs yield three empty lists; an exact match yields
 * every target hand in `correct` with empty `missed` and `extra`. Throws if
 * `target` or `built` contains an invalid hand.
 */
export function compareBuiltRange(
  target: PokerHand[],
  built: PokerHand[],
): { correct: PokerHand[]; missed: PokerHand[]; extra: PokerHand[] } {
  const normalizedTarget = normalizeRangeHands(target)
  const normalizedBuilt = normalizeRangeHands(built)
  const targetSet = new Set(normalizedTarget)
  const builtSet = new Set(normalizedBuilt)
  return {
    correct: normalizedTarget.filter((hand) => builtSet.has(hand)),
    missed: normalizedTarget.filter((hand) => !builtSet.has(hand)),
    extra: normalizedBuilt.filter((hand) => !targetSet.has(hand)),
  }
}

/**
 * Draw one of the 169 canonical starting hands at random.
 *
 * `random` defaults to `Math.random` but can be injected for deterministic
 * tests; it is expected to return a value in [0, 1). The index is clamped to
 * the last hand so an input of exactly 1 still yields a valid hand.
 */
export function getRandomPracticeHand(random: () => number = Math.random): PokerHand {
  const index = Math.min(ALL_HANDS.length - 1, Math.floor(random() * ALL_HANDS.length))
  return ALL_HANDS[index]
}
