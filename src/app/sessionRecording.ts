import {
  rangeHandConfidence,
  summarizeHandAccuracy,
  summarizePracticeAttempts,
} from '../domain/practice'
import { scheduleNextReview, seedReviewState } from '../domain/spacedRepetition'
import { loadHandAccuracy, recordHandAccuracy } from '../storage/handAccuracyStorage'
import { recordPracticeSession } from '../storage/practiceStatsStorage'
import { loadReviewStates, saveReviewState } from '../storage/reviewStateStorage'
import { recordPracticeSessionHistory } from '../storage/sessionHistoryStorage'
import type { PracticeAttempt, PracticeSessionSummary } from '../types/practice'

/**
 * Persist a finished recognition-style practice session: the per-range summary,
 * per-hand accuracy, session history, and the advanced spaced-repetition
 * schedule. The stat recorders no-op when nothing was answered; the review
 * schedule always advances (matching the pre-refactor behavior). The single
 * place session results are recorded so every practice surface persists
 * identically.
 */
/**
 * Run `record`, returning the message to show when the write failed and null
 * when it landed.
 *
 * Recording happens once, at the end of a session. Raw, a full or unavailable
 * store throws out of the finish handler, the summary never renders, and the
 * user is left on the last question with the whole session gone and nothing
 * explaining it. The numbers themselves come from the in-memory attempts, so the
 * summary can still be shown — it just has to say the run was not saved. A write
 * that fails part-way still leaves what it already wrote; the message reports a
 * failed save, not a clean rollback.
 */
export function captureRecordingFailure(record: () => void): string | null {
  try {
    record()
    return null
  } catch (error) {
    return error instanceof Error ? error.message : 'Could not save this session.'
  }
}

export function recordFinishedPracticeSession(rangeId: string, attempts: PracticeAttempt[]): void {
  const summary = summarizePracticeAttempts(attempts)
  recordPracticeSession(rangeId, summary)
  recordHandAccuracy(rangeId, summarizeHandAccuracy(attempts))
  recordPracticeSessionHistory(rangeId, summary)
  advanceReviewSchedule(rangeId, summary)
}

/**
 * Persist a finished quiz that asked which ACTION a hand wants, rather than
 * whether it is in the range: the action quiz and the frequency quiz.
 *
 * Their answers must never reach the per-hand store, whose falsePositive /
 * falseNegative split only means anything for an in-or-out answer — which is
 * why they cannot simply call {@link recordFinishedPracticeSession}. Everything
 * else about a run of theirs is an ordinary practice session on that chart,
 * though, and recording none of it meant a user could answer twenty hands and
 * be told, on the same screen, that they had answered none today and had never
 * practiced the chart. So the per-range stats, the session log, and the review
 * schedule all advance exactly as they do for recognition.
 */
export function recordFinishedActionSession(
  rangeId: string,
  summary: PracticeSessionSummary,
): void {
  recordPracticeSession(rangeId, summary)
  recordPracticeSessionHistory(rangeId, summary)
  advanceReviewSchedule(rangeId, summary)
}

/** Move `rangeId`'s spaced-repetition schedule on by how the session went. */
function advanceReviewSchedule(rangeId: string, summary: PracticeSessionSummary): void {
  const reviewedAt = new Date().toISOString()
  const prev = loadReviewStates()[rangeId] ?? seedReviewState(rangeId)
  // Read the per-hand record back AFTER this session's answers are folded in, so
  // hands that are still shaky pull the next review closer.
  const confidence = rangeHandConfidence(loadHandAccuracy()[rangeId] ?? {})
  saveReviewState(scheduleNextReview(prev, summary.accuracyPercentage, reviewedAt, confidence))
}
