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

/**
 * Cumulative practice performance for one saved range, persisted across
 * sessions.
 *
 * `totalAttempts` and `correctAttempts` sum every answered question across all
 * practice sessions for `rangeId`; `lastPracticedAt` is the ISO-8601 timestamp
 * of the most recent session folded in. Accuracy is derived later as
 * `correctAttempts / totalAttempts` (guarding the zero-attempt case). This slice
 * only defines and persists the record — recording it at session end and
 * displaying/sorting by it come in later slices.
 */
export interface RangePracticeStats {
  /** Id of the saved range these stats belong to. */
  rangeId: string
  /** Total answered questions across all sessions for this range. */
  totalAttempts: number
  /** Of those, how many were answered correctly. */
  correctAttempts: number
  /** ISO-8601 timestamp of the most recent practice session. */
  lastPracticedAt: string
}

/**
 * Per-hand accuracy breakdown for a set of practice attempts, used by v2.1
 * mistake tracking (per-hand accuracy, heatmap overlay, performance page).
 *
 * Every incorrect attempt on a hand is exactly one of the two error kinds, so
 * `falsePositives + falseNegatives === attempts - correct`.
 */
export interface HandAccuracyStat {
  /** The canonical starting hand these counts are for (e.g. "AA", "AKs"). */
  hand: PokerHand
  /** Times this hand was answered. */
  attempts: number
  /** Of those, how many were answered correctly. */
  correct: number
  /** Incorrect answers where the hand was out of range but answered "in range". */
  falsePositives: number
  /** Incorrect answers where the hand was in range but answered "out of range". */
  falseNegatives: number
}

/** Cumulative per-hand accuracy for one range, keyed by hand. */
export type RangeHandAccuracy = Record<PokerHand, HandAccuracyStat>
