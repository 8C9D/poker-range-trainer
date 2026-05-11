import { useState } from 'react'
import {
  createPracticeAttempt,
  getRandomPracticeHand,
  summarizePracticeAttempts,
} from '../domain/practice'
import type { PokerHand } from '../domain/pokerHands'
import type { PracticeAttempt, PracticeSessionSummary } from '../types/practice'
import type { SavedRange } from '../types/range'
import './PracticeSession.css'

interface PracticeSessionProps {
  /** The saved range being practiced. */
  range: SavedRange
  /**
   * Leave practice and return to the editor/library view, reporting the final
   * session summary so the parent can persist it.
   */
  onExit: (summary: PracticeSessionSummary) => void
  /**
   * Source of randomness for drawing prompt hands. Defaults to `Math.random`;
   * injectable so tests can force a deterministic sequence of hands.
   */
  random?: () => number
}

/**
 * Interactive practice for a single saved range: prompts a random starting
 * hand, scores the user's "in range" / "out of range" answer with immediate
 * feedback, and tracks running session stats.
 *
 * All scoring goes through the practice domain module so correctness logic is
 * never duplicated in the UI. Attempts live only in component state; the final
 * session summary is reported to the parent on exit, which persists it.
 */
export function PracticeSession({ range, onExit, random = Math.random }: PracticeSessionProps) {
  const [currentHand, setCurrentHand] = useState<PokerHand>(() => getRandomPracticeHand(random))
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
    setCurrentHand(getRandomPracticeHand(random))
    setCurrentAttempt(null)
  }

  return (
    <section className="practice-session" aria-label="Practice session">
      <header className="practice-header">
        <h2>Practicing: {range.name}</h2>
        <button type="button" onClick={() => onExit(summary)}>
          End Practice
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
              currentAttempt.correct
                ? 'practice-result correct'
                : 'practice-result incorrect'
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
