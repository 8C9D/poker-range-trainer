import { useEffect, useState } from 'react'
import {
  createPracticeAttempt,
  getRandomPracticeHand,
  summarizePracticeAttempts,
} from '../domain/practice'
import { DRILL_DURATION_OPTIONS, getRemainingSeconds } from '../domain/timedDrill'
import type { PokerHand } from '../domain/pokerHands'
import type { PracticeAttempt } from '../types/practice'
import type { SavedRange } from '../types/range'
import './PracticeSession.css'

interface TimedDrillSessionProps {
  /** The saved range being drilled. */
  range: SavedRange
  /**
   * Leave the drill and return to the editor/library, reporting the session's
   * scored attempts so the parent can derive and persist both the per-range
   * summary and per-hand accuracy (an empty array is a no-op for the recorder).
   */
  onExit: (attempts: PracticeAttempt[]) => void
  /**
   * Source of randomness for drawing prompt hands. Defaults to `Math.random`;
   * injectable so tests can force a deterministic sequence of hands.
   */
  random?: () => number
}

/**
 * Timed-drill practice (mode 5): the user answers "in range" / "out of range"
 * for as many random hands as possible before a countdown expires, with no
 * per-answer feedback pause — speed is the point. Reuses the recognition scoring
 * helpers (`createPracticeAttempt`, `summarizePracticeAttempts`) and the pure
 * `getRemainingSeconds` countdown helper; the component only orchestrates phase
 * state, the tick interval, and rendering.
 *
 * Phases: `config` (pick a duration) → `running` (countdown + prompts) → `done`
 * (summary). The countdown reads the clock only inside the interval (a
 * subscription to an external clock), keeping render pure; the interval is
 * cleared on expiry and on unmount.
 */
export function TimedDrillSession({ range, onExit, random = Math.random }: TimedDrillSessionProps) {
  const [phase, setPhase] = useState<'config' | 'running' | 'done'>('config')
  const [durationSeconds, setDurationSeconds] = useState(DRILL_DURATION_OPTIONS[0])
  const [remaining, setRemaining] = useState(DRILL_DURATION_OPTIONS[0])
  const [currentHand, setCurrentHand] = useState<PokerHand>('AA')
  const [attempts, setAttempts] = useState<PracticeAttempt[]>([])

  // A drill is a subscription to the wall clock: stamp the start when running
  // begins (an effect body runs after render, so reading the clock here is fine),
  // then tick every 250ms, recomputing the whole seconds left from the pure
  // helper and flipping to the summary at zero. The cleanup clears the interval
  // on expiry (phase change) and on unmount, so no timer leaks.
  useEffect(() => {
    if (phase !== 'running') return
    const startMs = Date.now()
    const id = setInterval(() => {
      const left = getRemainingSeconds(startMs, durationSeconds, Date.now())
      setRemaining(left)
      if (left === 0) setPhase('done')
    }, 250)
    return () => clearInterval(id)
  }, [phase, durationSeconds])

  const summary = summarizePracticeAttempts(attempts)

  function startDrill(seconds: number) {
    // Show the full duration immediately; the interval starts counting it down.
    setDurationSeconds(seconds)
    setRemaining(seconds)
    setAttempts([])
    setCurrentHand(getRandomPracticeHand(random))
    setPhase('running')
  }

  function answer(userAnsweredInRange: boolean) {
    // Ignore answers once the clock has run out (guards the gap between ticks).
    if (phase !== 'running' || remaining === 0) return
    const attempt = createPracticeAttempt(currentHand, range.hands, userAnsweredInRange)
    setAttempts((prev) => [...prev, attempt])
    setCurrentHand(getRandomPracticeHand(random))
  }

  function newDrill() {
    setAttempts([])
    setPhase('config')
  }

  if (phase === 'config') {
    return (
      <section className="practice-session" aria-label="Timed drill setup">
        <header className="practice-header">
          <h2>Timed drill: {range.name}</h2>
        </header>
        <p className="practice-expected">
          Answer as many hands as you can before time runs out. Choose a drill length:
        </p>
        <div className="practice-answers">
          {DRILL_DURATION_OPTIONS.map((seconds) => (
            <button
              key={seconds}
              type="button"
              className="primary"
              onClick={() => startDrill(seconds)}
            >
              {seconds}s
            </button>
          ))}
        </div>
        <div className="practice-review-actions">
          <button type="button" onClick={() => onExit(attempts)}>
            Back to library
          </button>
        </div>
      </section>
    )
  }

  if (phase === 'done') {
    return (
      <section className="practice-session" aria-label="Timed drill results">
        <header className="practice-header">
          <h2>Time! {range.name}</h2>
        </header>
        <div className="practice-stats" aria-label="Drill stats">
          <span className="practice-stat">Total questions: {summary.totalQuestions}</span>
          <span className="practice-stat">Correct: {summary.correctAnswers}</span>
          <span className="practice-stat">
            Accuracy: {summary.accuracyPercentage.toFixed(0)}%
          </span>
        </div>
        <div className="practice-answers">
          <button type="button" className="primary" onClick={newDrill}>
            New drill
          </button>
          <button type="button" onClick={() => onExit(attempts)}>
            Back to library
          </button>
        </div>
      </section>
    )
  }

  // phase === 'running'
  return (
    <section className="practice-session" aria-label="Timed drill">
      <header className="practice-header">
        <h2>Timed drill: {range.name}</h2>
      </header>
      <div className="practice-stats" aria-label="Drill progress">
        <span className="practice-stat">Time left: {remaining}s</span>
        <span className="practice-stat">Answered: {summary.totalQuestions}</span>
        <span className="practice-stat">Correct: {summary.correctAnswers}</span>
      </div>
      <div className="practice-prompt">
        <p className="practice-prompt-label">Is this hand in range?</p>
        <p className="practice-prompt-hand">{currentHand}</p>
      </div>
      <div className="practice-answers">
        <button type="button" className="primary" onClick={() => answer(true)}>
          In range
        </button>
        <button type="button" onClick={() => answer(false)}>
          Out of range
        </button>
      </div>
    </section>
  )
}
