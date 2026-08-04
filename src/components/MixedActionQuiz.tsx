import { useEffect, useRef, useState } from 'react'
import { accuracyPercentage } from '../domain/accuracy'
import { getRandomHandFrom } from '../domain/practice'
import { handNoteFor } from '../domain/missExplanation'
import { handsWithMixedStrategy, primaryAction } from '../domain/mixedStrategy'
import type { PokerHand } from '../domain/pokerHands'
import type { ActionAttempt } from '../types/practice'
import {
  RANGE_ACTIONS,
  RANGE_ACTION_LABELS,
  type RangeAction,
  type SavedRange,
} from '../types/range'
import { DRILL_QUESTION_COUNT } from '../practice/drillPacing'
import { ACTION_BY_SHORTCUT, ACTION_SHORTCUTS } from './actionQuizShortcuts'
import './ActionPalette.css'
import './PracticeSession.css'

interface MixedActionQuizProps {
  /** The range being quizzed (its `mixedStrategies` define the primary answers). */
  range: SavedRange
  /**
   * Ask about only these hands instead of every mixed-strategy hand — set when
   * re-quizzing a run's misses. Grading is unchanged: the strategies still say
   * what the primary action is.
   */
  handPool?: PokerHand[]
  /**
   * Leave the quiz, handing back every answered attempt so the caller can build
   * the end-of-run summary. Empty when nothing was answered.
   */
  onExit: (attempts: ActionAttempt[]) => void
  /** Questions before the run ends itself; the shared drill length by default. */
  questionCount?: number
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
 * orchestrates state and rendering. Nothing is persisted — the strategies are the
 * source of truth, and the run is handed back to the host for its summary.
 */
export function MixedActionQuiz({
  range,
  handPool,
  onExit,
  questionCount = DRILL_QUESTION_COUNT,
  random = Math.random,
}: MixedActionQuizProps) {
  const mixedStrategies = range.mixedStrategies ?? {}
  const pool = handPool ?? handsWithMixedStrategy(mixedStrategies)
  const [currentHand, setCurrentHand] = useState<PokerHand>(() =>
    pool.length > 0 ? getRandomHandFrom(pool, random) : '',
  )
  const [answered, setAnswered] = useState<AnsweredState | null>(null)
  const [total, setTotal] = useState(0)
  const [correct, setCorrect] = useState(0)
  // Every answered question, handed back on exit so the host can recap the misses.
  const [attempts, setAttempts] = useState<ActionAttempt[]>([])
  const answeringRef = useRef(false)

  function answer(chosen: RangeAction) {
    if (answeringRef.current || answered) return
    answeringRef.current = true
    const expected = primaryAction(mixedStrategies[currentHand] ?? []) ?? 'fold'
    const isCorrect = chosen === expected
    setAnswered({ chosen, expected, correct: isCorrect })
    setAttempts((prev) => [...prev, { hand: currentHand, chosen, expected, correct: isCorrect }])
    setTotal((value) => value + 1)
    if (isCorrect) setCorrect((value) => value + 1)
  }

  const lastQuestion = total >= questionCount

  function nextHand() {
    // A quiz run counts toward the day and the review schedule like any other
    // drill, so it ends at the shared drill length instead of looping until the
    // user decides to stop. Ending early with "End quiz" still keeps the answers.
    if (attempts.length >= questionCount) {
      onExit(attempts)
      return
    }
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
      if (event.key === 'Enter' && answered) {
        event.preventDefault()
        nextHand()
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
      <section className="practice-session" aria-label="Mixed action quiz">
        <header className="practice-header">
          <h2>Frequency quiz: {range.name}</h2>
          <button type="button" onClick={() => onExit([])}>
            Back to library
          </button>
        </header>
        <p className="practice-expected">
          This range has no mixed frequencies yet — assign frequencies first.
        </p>
      </section>
    )
  }

  const accuracy = Math.round(accuracyPercentage(correct, total))
  // What the user wrote about the hand they just got wrong, if anything.
  const missNote = answered && !answered.correct ? handNoteFor(range, currentHand) : null

  return (
    <section className="practice-session" aria-label="Mixed action quiz">
      <header className="practice-header">
        <h2>Frequency quiz: {range.name}</h2>
        <button type="button" onClick={() => onExit(attempts)}>
          End quiz
        </button>
      </header>

      <div className="practice-stats" role="group" aria-label="Quiz stats">
        <span className="practice-stat">
          Answered: {total} of {questionCount}
        </span>
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
          {/* A miss hands back whatever the user wrote about this hand. */}
          {missNote && <p className="practice-note">Your note: {missNote}</p>}
          <button
            type="button"
            className="primary"
            aria-keyshortcuts="Enter"
            onClick={nextHand}
          >
            {lastQuestion ? 'See results' : 'Next hand'}
          </button>
        </div>
      ) : (
        <div className="action-palette" role="group" aria-label="Choose an action">
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
