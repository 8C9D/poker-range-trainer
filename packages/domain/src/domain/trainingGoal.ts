import type { PracticeSessionRecord } from '../types/practice.js'
import { dailyHandCounts } from './weeklyStats.js'

/**
 * A daily training target and how today is going against it (v7.3).
 *
 * The streak already rewards showing up; a goal gives the session a size, so
 * "did I train today" has a concrete answer. Hands answered is the unit — it is
 * the one number every drill produces. Pure: history and `now` are passed in.
 */

/** Selectable daily targets, in hands answered. */
export const GOAL_OPTIONS = [10, 20, 40, 80] as const

/** The default target for a user who turns the goal on without choosing. */
export const DEFAULT_GOAL_HANDS = 20

export interface DailyGoalProgress {
  /** Target hands for the day; 0 when no goal is set. */
  target: number
  /** Hands answered today (the same local-day bucketing as the streak). */
  answered: number
  /** Hands still to go, never negative. */
  remaining: number
  /** Completion as 0–100, capped at 100 (0 when no goal is set). */
  percent: number
  met: boolean
}

/**
 * Evaluate today's progress toward `target` hands. A `target` of 0 (or less)
 * means "no goal": the count is still reported, but nothing is met and the
 * percentage stays 0 so the UI can hide the card.
 */
export function evaluateDailyGoal(
  history: Record<string, PracticeSessionRecord[]>,
  now: string,
  target: number,
): DailyGoalProgress {
  const days = dailyHandCounts(history, now, 1)
  const answered = days[0]?.handsAnswered ?? 0
  if (!Number.isFinite(target) || target <= 0) {
    return { target: 0, answered, remaining: 0, percent: 0, met: false }
  }
  return {
    target,
    answered,
    remaining: Math.max(0, target - answered),
    percent: Math.min(100, (answered / target) * 100),
    met: answered >= target,
  }
}

/** One-line status for the Today card, e.g. "12 of 20 hands — 8 to go." */
export function goalLine(progress: DailyGoalProgress): string {
  if (progress.target <= 0) return 'No daily goal set.'
  if (progress.met) return `Goal met — ${progress.answered} hands today.`
  return `${progress.answered} of ${progress.target} hands — ${progress.remaining} to go.`
}
