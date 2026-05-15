import { useState } from 'react'
import { createPracticeAttempt, summarizePracticeAttempts } from '../domain/practice'
import { getWeaknessFocusedHand } from '../domain/weaknessDrill'
import type { PokerHand } from '../domain/pokerHands'
import type { PracticeAttempt } from '../types/practice'
import type { SavedRange } from '../types/range'
import './PracticeSession.css'

interface WeaknessFocusedDrillProps {
  /** The saved range being drilled. */
  range: SavedRange
  /**
   * Leave the drill, reporting the session's scored attempts so the parent can
   * derive and persist both the per-range summary and per-hand accuracy.
   */
  onExit: (attempts: PracticeAttempt[]) => void
  /**
   * Source of randomness for drawing prompt hands. Defaults to `Math.random`;
   * injectable so tests can force a deterministic sequence of hands.
   */
  random?: () => number
}

/**
 * Weakness-focused drill (mode 6): an in/out-of-range recognition loop whose
 * next prompt is drawn with `getWeaknessFocusedHand(attempts)`, so hands the
 * user has missed earlier this session resurface more often. Reuses the
 * recognition scoring helpers; the weighting lives entirely in the
 * `weaknessDrill` domain module. Pure UI beyond that — no timers, no
 * persistence. Ending reports the session summary via `onExit` (the full
 * mistake-review screen belongs to recognition mode, not here).
 */
export function WeaknessFocusedDrill({
  range,
  onExit,
  random = Math.random,
}: WeaknessFocusedDrillProps) {
  const [currentHand, setCurrentHand] = useState<PokerHand>(() =>
    getWeaknessFocusedHand([], random),
  )
  // The scored attempt for the current hand once answered; null while unanswered.
  const [currentAttempt, setCurrentAttempt] = useState<PracticeAttempt | null>(null)
  const [attempts, setAttempts] = useState<PracticeAttempt[]>([])

  const summary = summarizePracticeAttempts(attempts)
  const answered = currentAttempt !== null

  function answer(userAnsweredInRange: boolean) {
    // Ignore extra clicks once the current hand has been answered.
    if (answered) return
    const attempt = createPracticeAttempt(currentHand, range.hands, userAnsweredInRange)
    setCurrentAttempt(attempt)
    setAttempts((prev) => [...prev, attempt])
  }

  function nextHand() {
    // Draw weighted by the mistakes made so far this session — `attempts` already
    // includes the just-answered hand, so missed hands are more likely to recur.
    setCurrentHand(getWeaknessFocusedHand(attempts, random))
    setCurrentAttempt(null)
  }

  return (
    <section className="practice-session" aria-label="Weakness drill">
      <header className="practice-header">
        <h2>Weakness drill: {range.name}</h2>
        <button type="button" onClick={() => onExit(attempts)}>
          End practice
        </button>
      </header>

      <div className="practice-stats" aria-label="Session stats">
        <span className="practice-stat">Total questions: {summary.totalQuestions}</span>
        <span className="practice-stat">Correct: {summary.correctAnswers}</span>
        <span className="practice-stat">Accuracy: {summary.accuracyPercentage.toFixed(0)}%</span>
      </div>

      <div className="practice-prompt">
        <p className="practice-prompt-label">Is this hand in range?</p>
        <p className="practice-prompt-hand">{currentHand}</p>
      </div>

      {answered ? (
        <div className="practice-feedback" role="status">
          <p
            className={
              currentAttempt.correct ? 'practice-result correct' : 'practice-result incorrect'
            }
          >
            {currentAttempt.correct ? 'Correct!' : 'Incorrect'}
          </p>
          <p className="practice-expected">
            Expected answer: {currentAttempt.expectedInRange ? 'In range' : 'Out of range'}
          </p>
          <button type="button" className="primary" onClick={nextHand}>
            Next hand
          </button>
        </div>
      ) : (
        <div className="practice-answers">
          <button type="button" className="primary" onClick={() => answer(true)}>
            In range
          </button>
          <button type="button" onClick={() => answer(false)}>
            Out of range
          </button>
        </div>
      )}
    </section>
  )
}
