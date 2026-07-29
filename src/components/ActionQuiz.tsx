import { useEffect, useRef, useState } from 'react'
import { accuracyPercentage } from '../domain/accuracy'
import { assignedHands, correctActionFor } from '../domain/actionRange'
import { getRandomHandFrom } from '../domain/practice'
import type { PokerHand } from '../domain/pokerHands'
import type { ActionAttempt } from '../types/practice'
import {
  RANGE_ACTIONS,
  RANGE_ACTION_LABELS,
  type RangeAction,
  type SavedRange,
} from '../types/range'
import { ACTION_BY_SHORTCUT, ACTION_SHORTCUTS } from './actionQuizShortcuts'
import './ActionPalette.css'
import './PracticeSession.css'

interface ActionQuizProps {
  /** The range being quizzed (its `handActions` define the correct answers). */
  range: SavedRange
  /**
   * Leave the quiz, handing back every answered attempt so the caller can record
   * per-action accuracy. Empty when nothing was answered.
   */
  onExit: (attempts: ActionAttempt[]) => void
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
  // Every answered question, handed back on exit so App can record per-action accuracy.
  const [attempts, setAttempts] = useState<ActionAttempt[]>([])
  const answeringRef = useRef(false)

  function answer(chosen: RangeAction) {
    if (answeringRef.current || answered) return
    answeringRef.current = true
    const expected = correctActionFor(handActions, currentHand)
    const isCorrect = chosen === expected
    setAnswered({ chosen, expected, correct: isCorrect })
    setAttempts((prev) => [...prev, { hand: currentHand, chosen, expected, correct: isCorrect }])
    setTotal((value) => value + 1)
    if (isCorrect) setCorrect((value) => value + 1)
  }

  function nextHand() {
    setCurrentHand(getRandomHandFrom(pool, random))
    answeringRef.current = false
    setAnswered(null)
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return
      }
      const action = ACTION_BY_SHORTCUT[event.key.toLowerCase()]
      if (!action) return
      event.preventDefault()
      answer(action)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  if (pool.length === 0) {
    return (
      <section className="practice-session" aria-label="Action quiz">
        <header className="practice-header">
          <h2>Action quiz: {range.name}</h2>
          <button type="button" onClick={() => onExit([])}>
            Back to library
          </button>
        </header>
        <p className="practice-expected">
          This range has no actions assigned yet — assign actions first.
        </p>
      </section>
    )
  }

  const accuracy = Math.round(accuracyPercentage(correct, total))

  return (
    <section className="practice-session" aria-label="Action quiz">
      <header className="practice-header">
        <h2>Action quiz: {range.name}</h2>
        <button type="button" onClick={() => onExit(attempts)}>
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
              aria-keyshortcuts={ACTION_SHORTCUTS[action]}
              onClick={() => answer(action)}
            >
              {RANGE_ACTION_LABELS[action]}
            </button>
          ))}
          <p className="practice-expected">Keyboard: F · C · R · 3 · 4 · J · M</p>
        </div>
      )}
    </section>
  )
}
