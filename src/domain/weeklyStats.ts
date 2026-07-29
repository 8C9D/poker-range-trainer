import type { PracticeSessionRecord } from '../types/practice'
import { accuracyPercentage } from './accuracy'
import { localCalendarDay, localDayStart } from './calendarDay'

/**
 * Aggregates of the practice sessions inside a trailing local-calendar window
 * (default 7 days, including today). `sharpestRangeId` is the practiced range with the
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
  sharpestRangeIds?: ReadonlySet<string>,
): WeeklySummary {
  const nowTimestamp = new Date(now).getTime()
  const todayNum = localCalendarDay(now)
  if (!Number.isFinite(nowTimestamp) || todayNum === null || windowDays <= 0) {
    return {
      handsAnswered: 0,
      correctAnswers: 0,
      accuracy: 0,
      sharpestRangeId: null,
      sharpestAccuracy: 0,
    }
  }
  const firstNum = todayNum - (windowDays - 1)
  let handsAnswered = 0
  let correctAnswers = 0
  const perRange = new Map<string, { total: number; correct: number }>()

  for (const sessions of Object.values(history)) {
    for (const session of sessions) {
      const at = new Date(session.playedAt).getTime()
      const dayNum = localCalendarDay(session.playedAt)
      if (dayNum === null || dayNum < firstNum || dayNum > todayNum || at > nowTimestamp) continue
      handsAnswered += session.totalQuestions
      correctAnswers += session.correctAnswers
      if (sharpestRangeIds === undefined || sharpestRangeIds.has(session.rangeId)) {
        const entry = perRange.get(session.rangeId) ?? { total: 0, correct: 0 }
        entry.total += session.totalQuestions
        entry.correct += session.correctAnswers
        perRange.set(session.rangeId, entry)
      }
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

/** One day of the hands-per-day chart. */
export interface DailyHandCount {
  /** Start of the local calendar day as an ISO timestamp. */
  dayStart: string
  handsAnswered: number
}

/**
 * Hands answered per local calendar day over the trailing `days` window, oldest
 * first and ending with the day containing `now` (same bucketing as the streak).
 */
export function dailyHandCounts(
  history: Record<string, PracticeSessionRecord[]>,
  now: string,
  days = 7,
): DailyHandCount[] {
  const todayNum = localCalendarDay(now)
  const todayStart = localDayStart(now)
  if (todayNum === null || todayStart === null) return []
  const firstNum = todayNum - (days - 1)
  const counts = new Array<number>(days).fill(0)
  for (const sessions of Object.values(history)) {
    for (const session of sessions) {
      const dayNum = localCalendarDay(session.playedAt)
      if (dayNum === null) continue
      if (dayNum < firstNum || dayNum > todayNum) continue
      counts[dayNum - firstNum] += session.totalQuestions
    }
  }
  return counts.map((handsAnswered, index) => {
    const dayStart = new Date(todayStart)
    dayStart.setDate(dayStart.getDate() - (days - 1 - index))
    return { dayStart: dayStart.toISOString(), handsAnswered }
  })
}
