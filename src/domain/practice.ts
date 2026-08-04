import { accuracyPercentage } from './accuracy'
import { ALL_HANDS, isValidHand, type PokerHand } from './pokerHands'
import { normalizeRangeHands } from './rangeMath'
import type {
  HandAccuracyStat,
  PracticeAttempt,
  PracticeSessionSummary,
  RangeHandAccuracy,
} from '../types/practice'

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
  return {
    totalQuestions,
    correctAnswers,
    accuracyPercentage: accuracyPercentage(correctAnswers, totalQuestions),
  }
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
 * A hand's accuracy as a percentage (0–100): `correct / attempts * 100`, or 0
 * when there are no attempts (never NaN). Matches the accuracy convention of
 * `summarizePracticeAttempts`.
 */
export function handAccuracyRate(stat: HandAccuracyStat): number {
  return accuracyPercentage(stat.correct, stat.attempts)
}

/**
 * Rank a range's cumulative per-hand stats weakest-first, so the hands most in
 * need of review surface at the top. Includes only hands with at least one
 * attempt and sorts by: ascending accuracy rate, then more attempts first (a
 * 0%-of-10 hand outranks a 0%-of-1 hand), then canonical 13×13 order for a
 * stable, deterministic result. Does not mutate the input.
 */
export function rankHandAccuracy(rangeStats: RangeHandAccuracy): HandAccuracyStat[] {
  const order = new Map(ALL_HANDS.map((hand, index) => [hand, index]))
  return Object.values(rangeStats)
    .filter((stat) => stat.attempts > 0)
    .sort((a, b) => {
      const rateDiff = handAccuracyRate(a) - handAccuracyRate(b)
      if (rateDiff !== 0) return rateDiff
      if (a.attempts !== b.attempts) return b.attempts - a.attempts
      return (order.get(a.hand) ?? 0) - (order.get(b.hand) ?? 0)
    })
}

/** Coarse accuracy band for a hand, for the range heatmap overlay. */
export type HeatLevel = 'untested' | 'low' | 'medium' | 'high'

/**
 * Bucket a hand's accuracy into a heat level for the range heatmap.
 *
 * `'untested'` when the hand has no attempts (or no stat at all); otherwise by
 * `handAccuracyRate`: below 50% is `'low'`, 50–79% is `'medium'`, and 80%+ is
 * `'high'`. Pure.
 */
export function accuracyHeatLevel(stat: HandAccuracyStat | undefined): HeatLevel {
  if (!stat || stat.attempts === 0) return 'untested'
  const rate = handAccuracyRate(stat)
  if (rate < 50) return 'low'
  if (rate < 80) return 'medium'
  return 'high'
}

/**
 * The hands the user has gotten wrong at least once for a range: those with any
 * recorded error (`falsePositives + falseNegatives > 0`), in canonical 13×13
 * order. Hands answered only correctly, and hands with no stats, are excluded.
 * This is the prompt pool for "practice mistakes only".
 */
export function handsWithMistakes(rangeStats: RangeHandAccuracy): PokerHand[] {
  return ALL_HANDS.filter((hand) => {
    const stat = rangeStats[hand]
    return stat !== undefined && stat.falsePositives + stat.falseNegatives > 0
  })
}

/**
 * How solid a range's cumulative per-hand record is, as a 0–1 factor for the
 * review schedule (v7.4).
 *
 * A weak hand is one the user gets right less than half the time. The factor is
 * `1 - weakShare` over the hands with any attempts, so a range where nothing is
 * weak scores 1 and one where every hand is weak scores 0. A range with no
 * recorded hands scores 1 — no evidence is not evidence of trouble, and the
 * caller's schedule then behaves exactly as it did before per-hand data existed.
 */
export function rangeHandConfidence(rangeStats: RangeHandAccuracy): number {
  const practiced = Object.values(rangeStats).filter((stat) => stat.attempts > 0)
  if (practiced.length === 0) return 1
  const weak = practiced.filter((stat) => handAccuracyRate(stat) < 50).length
  return 1 - weak / practiced.length
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
 * Score a checked build-from-memory attempt as an ordinary session summary, so
 * a run of it counts like every other practice mode.
 *
 * Each hand the build got right is one correct answer; each hand it forgot and
 * each hand it added by mistake is one wrong answer — so being one hand short
 * and one hand over scores the same as a recognition run that missed two.
 *
 * The 150-odd hands correctly left OUT of the range are deliberately not
 * counted: the user never decided anything about them, and crediting them would
 * score a blank grid at 90% while making a real attempt's mistakes vanish into
 * the rounding.
 */
export function summarizeBuiltRange(comparison: {
  correct: PokerHand[]
  missed: PokerHand[]
  extra: PokerHand[]
}): PracticeSessionSummary {
  const correctAnswers = comparison.correct.length
  const totalQuestions = correctAnswers + comparison.missed.length + comparison.extra.length
  return {
    totalQuestions,
    correctAnswers,
    accuracyPercentage: accuracyPercentage(correctAnswers, totalQuestions),
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

/**
 * Draw one hand at random from a restricted `pool` (e.g. the mistakes-only
 * prompt set). Uses the same clamp as `getRandomPracticeHand` so an input of
 * exactly 1 still yields a valid hand. `pool` must be non-empty — the caller
 * guarantees this (the mistakes-only entry is only offered when there are
 * mistakes to drill).
 */
export function getRandomHandFrom(
  pool: PokerHand[],
  random: () => number = Math.random,
): PokerHand {
  const index = Math.min(pool.length - 1, Math.floor(random() * pool.length))
  return pool[index]
}
