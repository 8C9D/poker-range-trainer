import { describe, expect, it } from 'vitest'
import { evaluateDailyGoal, goalLine } from './trainingGoal'
import type { PracticeSessionRecord } from '../types/practice'

const NOW = '2026-07-11T12:00:00.000Z'

function session(playedAt: string, totalQuestions: number): PracticeSessionRecord {
  return { rangeId: 'r1', playedAt, totalQuestions, correctAnswers: totalQuestions }
}

describe('evaluateDailyGoal', () => {
  it('counts only hands answered today', () => {
    const history = {
      r1: [session('2026-07-10T23:00:00.000Z', 30), session('2026-07-11T09:00:00.000Z', 12)],
    }

    const progress = evaluateDailyGoal(history, NOW, 20)

    expect(progress.answered).toBe(12)
    expect(progress.remaining).toBe(8)
    expect(progress.percent).toBe(60)
    expect(progress.met).toBe(false)
  })

  it('caps a smashed goal at 100% with nothing remaining', () => {
    const progress = evaluateDailyGoal({ r1: [session(NOW, 50)] }, NOW, 20)

    expect(progress.met).toBe(true)
    expect(progress.percent).toBe(100)
    expect(progress.remaining).toBe(0)
  })

  it('reports an empty day against the target', () => {
    const progress = evaluateDailyGoal({}, NOW, 20)

    expect(progress).toEqual({ target: 20, answered: 0, remaining: 20, percent: 0, met: false })
  })

  it('treats a non-positive or non-finite target as no goal', () => {
    for (const target of [0, -5, Number.NaN]) {
      const progress = evaluateDailyGoal({ r1: [session(NOW, 12)] }, NOW, target)
      expect(progress.target).toBe(0)
      expect(progress.met).toBe(false)
      expect(progress.percent).toBe(0)
      // The count is still reported so a caller can show it without a goal.
      expect(progress.answered).toBe(12)
    }
  })
})

describe('goalLine', () => {
  it('describes progress, completion, and the no-goal case', () => {
    expect(goalLine(evaluateDailyGoal({ r1: [session(NOW, 12)] }, NOW, 20))).toBe(
      '12 of 20 hands — 8 to go.',
    )
    expect(goalLine(evaluateDailyGoal({ r1: [session(NOW, 20)] }, NOW, 20))).toBe(
      'Goal met — 20 hands today.',
    )
    expect(goalLine(evaluateDailyGoal({}, NOW, 0))).toBe('No daily goal set.')
  })
})
