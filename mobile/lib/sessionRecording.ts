import { summarizeHandAccuracy, summarizePracticeAttempts } from '@core/domain/practice';
import { scheduleNextReview, seedReviewState } from '@core/domain/spacedRepetition';
import { recordHandAccuracy } from '@core/storage/handAccuracyStorage';
import { recordPracticeSession } from '@core/storage/practiceStatsStorage';
import { loadReviewStates, saveReviewState } from '@core/storage/reviewStateStorage';
import { recordPracticeSessionHistory } from '@core/storage/sessionHistoryStorage';
import type { PracticeAttempt } from '@core/types/practice';

/**
 * Persist a finished recognition-style practice session: the per-range summary, per-hand
 * accuracy, session history, and the advanced spaced-repetition schedule. The single
 * place session results are recorded so every practice surface persists identically.
 * The mobile port of the web app's src/app/sessionRecording.ts.
 */
export function recordFinishedPracticeSession(rangeId: string, attempts: PracticeAttempt[]): void {
  const summary = summarizePracticeAttempts(attempts);
  recordPracticeSession(rangeId, summary);
  recordHandAccuracy(rangeId, summarizeHandAccuracy(attempts));
  recordPracticeSessionHistory(rangeId, summary);
  const reviewedAt = new Date().toISOString();
  const prev = loadReviewStates()[rangeId] ?? seedReviewState(rangeId);
  saveReviewState(scheduleNextReview(prev, summary.accuracyPercentage, reviewedAt));
}
