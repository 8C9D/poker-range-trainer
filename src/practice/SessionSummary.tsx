import { useEffect, useState } from 'react'
import type { MissRecap } from '../domain/missRecap'

export interface SessionSummaryData {
  totalQuestions: number
  correctAnswers: number
  /** Session accuracy 0-100. */
  accuracy: number
  /** Growth-framed comparison line, or null when there is nothing to compare. */
  deltaLine: string | null
  /** Daily-goal progress line (the workout reports it), or null to omit. */
  goalLine?: string | null
  /** Streak confirmation line, or null when no streak is active. */
  streakLine: string | null
  /** The session's missed hands, or null when nothing was missed. */
  misses?: MissRecap | null
  /** Why the run could not be persisted, or null when it saved. */
  saveError?: string | null
}

interface SessionSummaryProps {
  data: SessionSummaryData
  /** Whether another range is waiting in the review queue. */
  hasNext: boolean
  onNext: () => void
  onDone: () => void
  /**
   * Re-run this range over just the hands it missed. Omitted when the run has
   * no misses, or when its misses are not a pool one drill could deal from.
   */
  onDrillMisses?: () => void
}

const RING_RADIUS = 66
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

/**
 * The peak-end session summary: an animated accuracy ring, the count line,
 * the growth-framed delta, and the streak confirmation.
 */
export function SessionSummary({
  data,
  hasNext,
  onNext,
  onDone,
  onDrillMisses,
}: SessionSummaryProps) {
  // Animate the ring from 0 to the session accuracy on mount (CSS transition
  // does the easing; reduced-motion users see it instantly).
  const [shownAccuracy, setShownAccuracy] = useState(0)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShownAccuracy(data.accuracy))
    return () => cancelAnimationFrame(frame)
  }, [data.accuracy])

  // Enter takes the primary action so a keyboard-driven session never has to
  // reach for the mouse at the summary. A focused button keeps its native
  // Enter click (tabbing to "Done" must not fire "Next range" instead).
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
      if (event.key !== 'Enter') return
      const target = event.target
      if (
        target instanceof HTMLButtonElement ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return
      }
      event.preventDefault()
      if (hasNext) onNext()
      else onDone()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  return (
    <section className="session-summary" aria-label="Session summary">
      <div className="session-summary-ring">
        <svg width="160" height="160" viewBox="0 0 160 160" aria-hidden="true">
          <circle
            className="session-summary-ring-track"
            cx="80"
            cy="80"
            r={RING_RADIUS}
            fill="none"
            strokeWidth="12"
          />
          <circle
            className="session-summary-ring-value"
            cx="80"
            cy="80"
            r={RING_RADIUS}
            fill="none"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={RING_CIRCUMFERENCE * (1 - shownAccuracy / 100)}
          />
        </svg>
        <span className="session-summary-ring-label coach-tabular">
          {data.accuracy.toFixed(0)}%
        </span>
      </div>
      <p className="session-summary-count coach-tabular">
        {data.correctAnswers} of {data.totalQuestions} correct
      </p>
      {data.deltaLine && <p className="session-summary-delta">{data.deltaLine}</p>}
      {data.goalLine && <p className="session-summary-goal">{data.goalLine}</p>}
      {data.streakLine && <p className="session-summary-streak">{data.streakLine}</p>}
      {data.misses && <MissRecapList misses={data.misses} onDrill={onDrillMisses} />}
      {data.saveError && (
        <p className="session-summary-error" role="alert">
          {data.saveError}
        </p>
      )}
      <div className="session-summary-actions">
        {hasNext ? (
          <>
            <button
              type="button"
              className="coach-btn primary"
              aria-keyshortcuts="Enter"
              onClick={onNext}
            >
              Next range
            </button>
            <button type="button" className="coach-btn quiet" onClick={onDone}>
              Done
            </button>
          </>
        ) : (
          <button
            type="button"
            className="coach-btn primary"
            aria-keyshortcuts="Enter"
            onClick={onDone}
          >
            Done
          </button>
        )}
      </div>
    </section>
  )
}

/**
 * The hands the session got wrong, as the two lists that are actually
 * actionable. Directions the run never missed are omitted rather than shown
 * empty, so a one-sided session reads as one line.
 */
function MissRecapList({ misses, onDrill }: { misses: MissRecap; onDrill?: () => void }) {
  return (
    <section className="session-summary-misses" aria-label="What you missed">
      {/* h2, matching the workout hand-off: the overlay's own title is a span,
          so this is the first heading inside the dialog. */}
      <h2>What you missed</h2>
      {misses.shouldPlay.length > 0 && (
        <p>
          <span className="session-summary-miss-label">Play these:</span>{' '}
          <span className="coach-tabular">{misses.shouldPlay.join(', ')}</span>
        </p>
      )}
      {misses.shouldFold.length > 0 && (
        <p>
          <span className="session-summary-miss-label">Fold these:</span>{' '}
          <span className="coach-tabular">{misses.shouldFold.join(', ')}</span>
        </p>
      )}
      {misses.hiddenCount > 0 && (
        <p className="session-summary-miss-more">
          and {misses.hiddenCount} more — the drill will bring them back.
        </p>
      )}
      {/* Reading the list is the lesson; drilling it right away is the practice.
          Deals EVERY hand the run missed, not just the ones named above. */}
      {onDrill && (
        <button type="button" className="coach-btn session-summary-miss-drill" onClick={onDrill}>
          Drill these now
        </button>
      )}
    </section>
  )
}
