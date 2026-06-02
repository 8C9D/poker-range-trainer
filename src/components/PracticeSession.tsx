import { useState } from 'react'
import {
  createPracticeAttempt,
  getRandomHandFrom,
  getRandomPracticeHand,
  reviewSessionMistakes,
  summarizePracticeAttempts,
} from '../domain/practice'
import type { PokerHand } from '../domain/pokerHands'
import type { PracticeAttempt } from '../types/practice'
import type { SavedRange } from '../types/range'
import { useSwipe } from './useSwipe'
import './PracticeSession.css'

interface PracticeSessionProps {
  /** The saved range being practiced. */
  range: SavedRange
  /**
   * Leave practice and return to the editor/library view, reporting the session's
   * scored attempts so the parent can derive and persist both the per-range
   * summary and per-hand accuracy.
   */
  onExit: (attempts: PracticeAttempt[]) => void
  /**
   * Source of randomness for drawing prompt hands. Defaults to `Math.random`;
   * injectable so tests can force a deterministic sequence of hands.
   */
  random?: () => number
  /**
   * When provided and non-empty, prompts are drawn only from these hands (e.g.
   * a "practice mistakes only" subset); otherwise all 169 starting hands are used.
   */
  handPool?: PokerHand[]
}

/**
 * Interactive practice for a single saved range: prompts a random starting
 * hand, scores the user's "in range" / "out of range" answer with immediate
 * feedback, and tracks running session stats.
 *
 * Ending the session opens a review step that recaps the stats and lists the
 * mistakes — hands missed (in range, answered out) and hands wrongly included
 * (out of range, answered in) — before the final summary is reported to the
 * parent. All scoring and the mistake split go through the practice domain
 * module so that logic is never duplicated in the UI. Attempts live only in
 * component state; the final session summary is reported to the parent when the
 * user dismisses the review, which persists it.
 */
export function PracticeSession({
  range,
  onExit,
  random = Math.random,
  handPool,
}: PracticeSessionProps) {
  // Draw from the restricted pool when one is given (and non-empty); otherwise
  // from all 169 hands. An empty pool falls back to the full set so draws never break.
  const drawHand = () =>
    handPool && handPool.length > 0 ? getRandomHandFrom(handPool, random) : getRandomPracticeHand(random)
  const [currentHand, setCurrentHand] = useState<PokerHand>(drawHand)
  // The scored attempt for the current hand once answered; null while unanswered.
  const [currentAttempt, setCurrentAttempt] = useState<PracticeAttempt | null>(null)
  const [attempts, setAttempts] = useState<PracticeAttempt[]>([])
  // True once the user ends the session and is viewing the mistake review.
  const [reviewing, setReviewing] = useState(false)

  const summary = summarizePracticeAttempts(attempts)
  const answered = currentAttempt !== null

  // Swipe right = in range, swipe left = out of range (mirrors the buttons).
  const swipe = useSwipe({
    onSwipeRight: () => answer(true),
    onSwipeLeft: () => answer(false),
  })

  function answer(userAnsweredInRange: boolean) {
    // Ignore extra clicks once the current hand has been answered.
    if (answered) return
    const attempt = createPracticeAttempt(currentHand, range.hands, userAnsweredInRange)
    setCurrentAttempt(attempt)
    setAttempts((prev) => [...prev, attempt])
  }

  function nextHand() {
    setCurrentHand(drawHand())
    setCurrentAttempt(null)
  }

  const sessionStats = (
    <div className="practice-stats" aria-label="Session stats">
      <span className="practice-stat">Total questions: {summary.totalQuestions}</span>
      <span className="practice-stat">Correct: {summary.correctAnswers}</span>
      <span className="practice-stat">Accuracy: {summary.accuracyPercentage.toFixed(0)}%</span>
    </div>
  )

  if (reviewing) {
    const { missed, wronglyIncluded } = reviewSessionMistakes(attempts)
    const hasMistakes = missed.length > 0 || wronglyIncluded.length > 0
    return (
      <section className="practice-session" aria-label="Practice review">
        <header className="practice-header">
          <h2>Session review: {range.name}</h2>
        </header>

        {sessionStats}

        {hasMistakes ? (
          <div className="practice-review">
            {missed.length > 0 && (
              <div className="practice-review-group">
                <h3 className="practice-review-heading">Missed hands (in range, answered out)</h3>
                <ul className="practice-review-hands" aria-label="Hands you missed">
                  {missed.map((hand) => (
                    <li key={hand}>{hand}</li>
                  ))}
                </ul>
              </div>
            )}
            {wronglyIncluded.length > 0 && (
              <div className="practice-review-group">
                <h3 className="practice-review-heading">
                  Wrongly included (out of range, answered in)
                </h3>
                <ul className="practice-review-hands" aria-label="Hands you wrongly included">
                  {wronglyIncluded.map((hand) => (
                    <li key={hand}>{hand}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="practice-review-clean">No mistakes — nice!</p>
        )}

        <div className="practice-review-actions">
          <button type="button" onClick={() => onExit(attempts)}>
            Back to library
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="practice-session" aria-label="Practice session">
      <header className="practice-header">
        <h2>Practicing: {range.name}</h2>
        <button type="button" onClick={() => setReviewing(true)}>
          End Practice
        </button>
      </header>

      {sessionStats}

      <div className="practice-prompt" {...swipe}>
        <p className="practice-prompt-label">Is this hand in range?</p>
        <p className="practice-prompt-hand">{currentHand}</p>
        {!answered && (
          <p className="practice-prompt-hint">Swipe right for in range, left for out</p>
        )}
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
