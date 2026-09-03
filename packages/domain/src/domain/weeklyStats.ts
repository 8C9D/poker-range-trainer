import type { PracticeSessionRecord } from '../types/practice.js'
import type { SavedRange } from '../types/range.js'
import { accuracyPercentage } from './accuracy.js'
import { localCalendarDays, localDayStart, type CalendarDays } from './calendarDay.js'

/**
 * The recorded sessions belonging to ranges the library still holds.
 *
 * Deleting a range drops it from the library but not its sessions, and a cloud
 * pull that replaces the library orphans them the same way. Left in, those
 * orphans keep inflating every volume and accuracy figure while the per-range
 * cuts beside them — "hands answered all-time", the leak tables, the sharpest
 * range — are already scoped to the live library and report nothing. Progress
 * could then claim 40 hands this week at 38% and 0 hands all-time on the one
 * screen. Scoping the history where it is loaded keeps every figure derived
 * from it agreeing, whichever way the range went away.
 *
 * Archived ranges are still in the library, so their sessions still count.
 */
export function sessionsForLibrary(
  history: Record<string, PracticeSessionRecord[]>,
  ranges: SavedRange[],
): Record<string, PracticeSessionRecord[]> {
  const live = new Set(ranges.map((range) => range.id))
  return Object.fromEntries(
    Object.entries(history).filter(([rangeId]) => live.has(rangeId)),
  )
}

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
  calendar: CalendarDays = localCalendarDays,
): WeeklySummary {
  const nowTimestamp = new Date(now).getTime()
  const todayNum = calendar.dayNumber(now)
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
      const dayNum = calendar.dayNumber(session.playedAt)
      if (dayNum === null || dayNum < firstNum || dayNum > todayNum || at > nowTimestamp) continue
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

/** One day of the hands-per-day chart. */
export interface DailyHandCount {
  /**
   * Start of the PROCESS-LOCAL calendar day as an ISO timestamp, kept for the
   * on-device callers that have always labelled their columns with it. It is
   * derived from the machine's zone, NOT from the `calendar` that did the
   * bucketing, so a zone-aware caller must label from `dayNumber` instead.
   */
  dayStart: string
  /** The `calendar` day number this column counts (see `isoDateOfDayNumber`). */
  dayNumber: number
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
  calendar: CalendarDays = localCalendarDays,
): DailyHandCount[] {
  const todayNum = calendar.dayNumber(now)
  const todayStart = localDayStart(now)
  if (todayNum === null || todayStart === null) return []
  const firstNum = todayNum - (days - 1)
  const counts = new Array<number>(days).fill(0)
  for (const sessions of Object.values(history)) {
    for (const session of sessions) {
      const dayNum = calendar.dayNumber(session.playedAt)
      if (dayNum === null) continue
      if (dayNum < firstNum || dayNum > todayNum) continue
      counts[dayNum - firstNum] += session.totalQuestions
    }
  }
  return counts.map((handsAnswered, index) => {
    const dayStart = new Date(todayStart)
    dayStart.setDate(dayStart.getDate() - (days - 1 - index))
    return { dayStart: dayStart.toISOString(), dayNumber: firstNum + index, handsAnswered }
  })
}

/** One 7-day bucket of the accuracy trend. */
export interface WeeklyAccuracyPoint {
  /**
   * Start of the bucket's first PROCESS-LOCAL calendar day, as an ISO
   * timestamp. Like {@link DailyHandCount.dayStart} it comes from the machine's
   * zone rather than from the `calendar`, so zone-aware callers label from
   * `weekStartDayNumber`.
   */
  weekStart: string
  /** The `calendar` day number the bucket starts on (see `isoDateOfDayNumber`). */
  weekStartDayNumber: number
  handsAnswered: number
  correctAnswers: number
  /** 0 when nothing was answered in the bucket. */
  accuracy: number
}

/**
 * Accuracy per trailing 7-day bucket, oldest first, ending with the bucket that
 * contains `now`.
 *
 * "How much did I train" is already answered by {@link dailyHandCounts}; this
 * answers the other half — whether the answers are getting better. Bucketed by
 * week rather than by day because a day can hold five hands, and a 40% day off
 * five hands says nothing. Weeks with no practice are kept in the series (as
 * zero hands) so the gaps in a training habit stay visible.
 */
export function weeklyAccuracyTrend(
  history: Record<string, PracticeSessionRecord[]>,
  now: string,
  weeks = 8,
  calendar: CalendarDays = localCalendarDays,
): WeeklyAccuracyPoint[] {
  const todayNum = calendar.dayNumber(now)
  const todayStart = localDayStart(now)
  if (todayNum === null || todayStart === null || weeks <= 0) return []

  const totals = Array.from({ length: weeks }, () => ({ total: 0, correct: 0 }))
  const firstNum = todayNum - (weeks * 7 - 1)
  for (const sessions of Object.values(history)) {
    for (const session of sessions) {
      const dayNum = calendar.dayNumber(session.playedAt)
      if (dayNum === null || dayNum < firstNum || dayNum > todayNum) continue
      // Bucket 0 is the newest week, so read the series back to front below.
      const bucket = Math.floor((todayNum - dayNum) / 7)
      totals[bucket].total += session.totalQuestions
      totals[bucket].correct += session.correctAnswers
    }
  }

  return totals
    .map((bucket, index) => {
      const weekStart = new Date(todayStart)
      weekStart.setDate(weekStart.getDate() - (index * 7 + 6))
      return {
        weekStart: weekStart.toISOString(),
        weekStartDayNumber: todayNum - (index * 7 + 6),
        handsAnswered: bucket.total,
        correctAnswers: bucket.correct,
        accuracy: accuracyPercentage(bucket.correct, bucket.total),
      }
    })
    .reverse()
}
