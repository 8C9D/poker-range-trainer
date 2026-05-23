import { useState } from 'react'
import { assignedHands, correctActionFor } from '../domain/actionRange'
import { getRandomHandFrom } from '../domain/practice'
import type { PokerHand } from '../domain/pokerHands'
import {
  RANGE_ACTIONS,
  RANGE_ACTION_LABELS,
  type RangeAction,
  type SavedRange,
} from '../types/range'
import './ActionPalette.css'
import './PracticeSession.css'

interface ActionQuizProps {
  /** The range being quizzed (its `handActions` define the correct answers). */
  range: SavedRange
  /** Leave the quiz and return to the editor/library. */
  onExit: () => void
  /**
   * Source of randomness for drawing prompt hands. Defaults to `Math.random`;
   * injectable so tests can force a deterministic sequence of hands.
   */
  random?: () => number
}

interface AnsweredState {
  chosen: RangeAction
  expected: RangeAction
  correct: boolean
}

/**
 * Mode-2 practice ("what is the correct action for AJs?"): prompts a hand from
 * the range's assigned action chart and scores the user's chosen action against
 * `correctActionFor`. Only hands the chart assigns are quizzed. Scoring lives in
 * the `actionRange` domain helpers; this component only orchestrates state and
 * rendering. No persistence (action-specific accuracy tracking is a later slice).
 */
export function ActionQuiz({ range, onExit, random = Math.random }: ActionQuizProps) {
  const handActions = range.handActions ?? {}
  const pool = assignedHands(handActions)
  const [currentHand, setCurrentHand] = useState<PokerHand>(() =>
    pool.length > 0 ? getRandomHandFrom(pool, random) : '',
  )
  const [answered, setAnswered] = useState<AnsweredState | null>(null)
  const [total, setTotal] = useState(0)
  const [correct, setCorrect] = useState(0)

  if (pool.length === 0) {
    return (
      <section className="practice-session" aria-label="Action quiz">
        <header className="practice-header">
          <h2>Action quiz: {range.name}</h2>
          <button type="button" onClick={onExit}>
            Back to library
          </button>
        </header>
        <p className="practice-expected">
          This range has no actions assigned yet — assign actions first.
        </p>
      </section>
    )
  }

  function answer(chosen: RangeAction) {
    if (answered) return
    const expected = correctActionFor(handActions, currentHand)
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
    <section className="practice-session" aria-label="Action quiz">
      <header className="practice-header">
        <h2>Action quiz: {range.name}</h2>
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
        <p className="practice-prompt-label">What is the correct action?</p>
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
            Correct action: {RANGE_ACTION_LABELS[answered.expected]}
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
