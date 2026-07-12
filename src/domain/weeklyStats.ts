import type { PracticeSessionRecord } from '../types/practice'
import { accuracyPercentage } from './accuracy'
import { DAY_MS } from './spacedRepetition'

/**
 * Aggregates of the practice sessions inside a trailing window (default 7
 * days ending at `now`). `sharpestRangeId` is the practiced range with the
 * highest accuracy over the window (ties break toward more hands answered),
 * or null when nothing was practiced. Pure — `now` is supplied, never read
 * from the clock.
 */
export interface WeeklySummary {
  handsAnswered: number
  correctAnswers: number
  accuracy: number
  sharpestRangeId: string | null
  sharpestAccuracy: number
}

export function summarizeWeek(
  history: Record<string, PracticeSessionRecord[]>,
  now: string,
  windowDays = 7,
): WeeklySummary {
  const cutoff = new Date(now).getTime() - windowDays * DAY_MS
  let handsAnswered = 0
  let correctAnswers = 0
  const perRange = new Map<string, { total: number; correct: number }>()

  for (const sessions of Object.values(history)) {
    for (const session of sessions) {
      const at = new Date(session.playedAt).getTime()
      if (Number.isNaN(at) || at < cutoff || at > new Date(now).getTime()) continue
      handsAnswered += session.totalQuestions
      correctAnswers += session.correctAnswers
      const entry = perRange.get(session.rangeId) ?? { total: 0, correct: 0 }
      entry.total += session.totalQuestions
      entry.correct += session.correctAnswers
      perRange.set(session.rangeId, entry)
    }
  }

  let sharpestRangeId: string | null = null
  let sharpestAccuracy = 0
  let sharpestTotal = 0
  for (const [rangeId, { total, correct }] of perRange) {
    if (total === 0) continue
    const acc = accuracyPercentage(correct, total)
    if (
      sharpestRangeId === null ||
      acc > sharpestAccuracy ||
      (acc === sharpestAccuracy && total > sharpestTotal)
    ) {
      sharpestRangeId = rangeId
      sharpestAccuracy = acc
      sharpestTotal = total
    }
  }

  return {
    handsAnswered,
    correctAnswers,
    accuracy: accuracyPercentage(correctAnswers, handsAnswered),
    sharpestRangeId,
    sharpestAccuracy,
  }
}
