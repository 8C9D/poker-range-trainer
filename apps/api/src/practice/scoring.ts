import type { PracticeSessionSubmission } from '@poker-range-trainer/contracts'
import {
  compareBuiltRange,
  createPracticeAttempt,
  summarizeBuiltRange,
  summarizeHandAccuracy,
  summarizePracticeAttempts,
} from '@poker-range-trainer/domain/domain/practice'
import type { PokerHand } from '@poker-range-trainer/domain/domain/pokerHands'

export interface ScoredBooleanAttempt {
  questionId: string
  hand: PokerHand
  expectedInRange: boolean
  userAnsweredInRange: boolean
  correct: boolean
  answeredAt: string
}

export interface ScoredPracticeSubmission {
  totalQuestions: number
  correctAnswers: number
  accuracyPercentage: number
  attempts: ScoredBooleanAttempt[]
  handAccuracy: ReturnType<typeof summarizeHandAccuracy>
}

/** Derive all answer truth from the locked, current range — never from the request. */
export function scorePracticeSubmission(
  submission: PracticeSessionSubmission,
  rangeHands: PokerHand[],
): ScoredPracticeSubmission {
  if (submission.mode === 'build') {
    const comparison = compareBuiltRange(rangeHands, submission.selectedHands)
    const summary = summarizeBuiltRange(comparison)
    return { ...summary, attempts: [], handAccuracy: [] }
  }

  const attempts = submission.answers.map((answer) => {
    const scored = createPracticeAttempt(answer.hand, rangeHands, answer.answer, answer.answeredAt)
    return { questionId: answer.questionId, answeredAt: answer.answeredAt, ...scored }
  })
  const summary = summarizePracticeAttempts(attempts)
  return { ...summary, attempts, handAccuracy: summarizeHandAccuracy(attempts) }
}
