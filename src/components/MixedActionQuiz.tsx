import { useState } from 'react'
import { getRandomHandFrom } from '../domain/practice'
import { handsWithMixedStrategy, primaryAction } from '../domain/mixedStrategy'
import type { PokerHand } from '../domain/pokerHands'
import {
  RANGE_ACTIONS,
  RANGE_ACTION_LABELS,
  type RangeAction,
  type SavedRange,
} from '../types/range'
import './ActionPalette.css'
import './PracticeSession.css'

interface MixedActionQuizProps {
  /** The range being quizzed (its `mixedStrategies` define the primary answers). */
  range: SavedRange
  /** Leave the quiz. */
  onExit: () => void
  /** Source of randomness for drawing prompts; injectable for tests. */
  random?: () => number
}

interface AnsweredState {
  chosen: RangeAction
  expected: RangeAction
  correct: boolean
}

/**
 * Mixed-frequency practice: quizzes the PRIMARY action of each hand that carries
 * a mixed strategy. The correct answer is `primaryAction` of the hand's strategy.
 * Scoring + ordering live in the `mixedStrategy` domain; this component only
 * orchestrates state and rendering. No persistence in this slice.
 */
export function MixedActionQuiz({ range, onExit, random = Math.random }: MixedActionQuizProps) {
  const mixedStrategies = range.mixedStrategies ?? {}
  const pool = handsWithMixedStrategy(mixedStrategies)
  const [currentHand, setCurrentHand] = useState<PokerHand>(() =>
    pool.length > 0 ? getRandomHandFrom(pool, random) : '',
  )
  const [answered, setAnswered] = useState<AnsweredState | null>(null)
  const [total, setTotal] = useState(0)
  const [correct, setCorrect] = useState(0)

  if (pool.length === 0) {
    return (
      <section className="practice-session" aria-label="Mixed action quiz">
        <header className="practice-header">
          <h2>Frequency quiz: {range.name}</h2>
          <button type="button" onClick={onExit}>
            Back to library
          </button>
        </header>
        <p className="practice-expected">
          This range has no mixed frequencies yet — assign frequencies first.
        </p>
      </section>
    )
  }

  function answer(chosen: RangeAction) {
    if (answered) return
    const expected = primaryAction(mixedStrategies[currentHand] ?? []) ?? 'fold'
    const isCorrect = chosen === expected
    setAnswered({ chosen, expected, correct: isCorrect })
    setTotal((value) => value + 1)
    if (isCorrect) setCorrect((value) => value + 1)
  }

  function nextHand() {
    setCurrentHand(getRandomHandFrom(pool, random))
    setAnswered(null)
  }

  const accuracy = total === 0 ? 0 : Math.round((correct / total) * 100)

  return (
    <section className="practice-session" aria-label="Mixed action quiz">
      <header className="practice-header">
        <h2>Frequency quiz: {range.name}</h2>
        <button type="button" onClick={onExit}>
          End quiz
        </button>
      </header>

      <div className="practice-stats" aria-label="Quiz stats">
        <span className="practice-stat">Total questions: {total}</span>
        <span className="practice-stat">Correct: {correct}</span>
        <span className="practice-stat">Accuracy: {accuracy}%</span>
      </div>

      <div className="practice-prompt">
        <p className="practice-prompt-label">What is the primary action?</p>
        <p className="practice-prompt-hand">{currentHand}</p>
      </div>

      {answered ? (
        <div className="practice-feedback" role="status">
          <p
            className={
              answered.correct ? 'practice-result correct' : 'practice-result incorrect'
            }
          >
            {answered.correct ? 'Correct!' : 'Incorrect'}
          </p>
          <p className="practice-expected">
            Primary action: {RANGE_ACTION_LABELS[answered.expected]}
          </p>
          <button type="button" className="primary" onClick={nextHand}>
            Next hand
          </button>
        </div>
      ) : (
        <div className="action-palette" aria-label="Choose an action">
          {RANGE_ACTIONS.map((action) => (
            <button
              key={action}
              type="button"
              className={`action-swatch action-${action}`}
              onClick={() => answer(action)}
            >
              {RANGE_ACTION_LABELS[action]}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
