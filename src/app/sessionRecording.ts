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
import type { PracticeAttempt } from '../types/practice'

/**
 * Persist a finished recognition-style practice session: the per-range summary,
 * per-hand accuracy, session history, and the advanced spaced-repetition
 * schedule. The stat recorders no-op when nothing was answered; the review
 * schedule always advances (matching the pre-refactor behavior). The single
 * place session results are recorded so every practice surface persists
 * identically.
 */
export function recordFinishedPracticeSession(rangeId: string, attempts: PracticeAttempt[]): void {
  const summary = summarizePracticeAttempts(attempts)
  recordPracticeSession(rangeId, summary)
  recordHandAccuracy(rangeId, summarizeHandAccuracy(attempts))
  recordPracticeSessionHistory(rangeId, summary)
  const reviewedAt = new Date().toISOString()
  const prev = loadReviewStates()[rangeId] ?? seedReviewState(rangeId)
  // Read the per-hand record back AFTER this session's answers are folded in, so
  // hands that are still shaky pull the next review closer.
  const confidence = rangeHandConfidence(loadHandAccuracy()[rangeId] ?? {})
  saveReviewState(scheduleNextReview(prev, summary.accuracyPercentage, reviewedAt, confidence))
}
