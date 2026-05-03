import { ALL_HANDS, isValidHand, type PokerHand } from './pokerHands'
import { normalizeRangeHands } from './rangeMath'
import type { PracticeAttempt, PracticeSessionSummary } from '../types/practice'

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
