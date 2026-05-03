import type { PokerHand } from '../domain/pokerHands'

/**
 * A single answered practice question: the prompted hand, whether it is
 * actually in the range being practiced, what the user answered, and whether
 * that answer was correct.
 */
export interface PracticeAttempt {
  /** The prompted starting hand in canonical notation (e.g. "AA", "AKs"). */
  hand: PokerHand
  /** Whether `hand` is actually a member of the practiced range. */
  expectedInRange: boolean
  /** Whether the user said the hand was in the range. */
  userAnsweredInRange: boolean
  /** True when the user's answer matched `expectedInRange`. */
  correct: boolean
  /** ISO-8601 timestamp of when the attempt was answered. */
  timestamp: string
}

/** Aggregate stats for the attempts in a practice session. */
export interface PracticeSessionSummary {
  /** Number of attempts answered. */
  totalQuestions: number
  /** Number of attempts answered correctly. */
  correctAnswers: number
  /** correctAnswers / totalQuestions * 100, or 0 when there are no attempts. */
  accuracyPercentage: number
}
