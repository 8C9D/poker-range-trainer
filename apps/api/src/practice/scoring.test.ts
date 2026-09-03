import { randomUUID } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import type { PracticeSessionSubmission } from '@poker-range-trainer/contracts'

import { scorePracticeSubmission } from './scoring.js'

const rangeId = '7a7e6f3e-17be-4b69-a31b-1f902417c560'
const answeredAt = '2026-01-02T03:04:05.000Z'

function answered(
  mode: Exclude<PracticeSessionSubmission['mode'], 'build'>,
): PracticeSessionSubmission {
  return {
    mode,
    rangeId,
    idempotencyKey: randomUUID(),
    answers: [
      { questionId: randomUUID(), hand: 'AA', answer: false, answeredAt },
      { questionId: randomUUID(), hand: 'AKo', answer: false, answeredAt },
    ],
  }
}

describe('practice submission scoring', () => {
  it.each(['recognition', 'timed', 'weakness', 'edges', 'mistakes'] as const)(
    'derives %s membership and correctness from persisted range hands',
    (mode) => {
      const scored = scorePracticeSubmission(answered(mode), ['AA', 'AKs'])
      expect(scored).toMatchObject({ totalQuestions: 2, correctAnswers: 1, accuracyPercentage: 50 })
      expect(scored.attempts).toEqual([
        expect.objectContaining({ hand: 'AA', expectedInRange: true, correct: false }),
        expect.objectContaining({ hand: 'AKo', expectedInRange: false, correct: true }),
      ])
      expect(scored.handAccuracy).toHaveLength(2)
    },
  )

  it('scores build set comparison without manufacturing boolean hand attempts', () => {
    const scored = scorePracticeSubmission(
      { mode: 'build', rangeId, idempotencyKey: randomUUID(), selectedHands: ['AA'] },
      ['AA', 'AKs'],
    )
    expect(scored).toMatchObject({ totalQuestions: 2, correctAnswers: 1, accuracyPercentage: 50 })
    expect(scored.attempts).toEqual([])
    expect(scored.handAccuracy).toEqual([])
  })
})
