import { useEffect, useState } from 'react'

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
}

interface SessionSummaryProps {
  data: SessionSummaryData
  /** Whether another range is waiting in the review queue. */
  hasNext: boolean
  onNext: () => void
  onDone: () => void
}

const RING_RADIUS = 66
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

/**
 * The peak-end session summary: an animated accuracy ring, the count line,
 * the growth-framed delta, and the streak confirmation.
 */
export function SessionSummary({ data, hasNext, onNext, onDone }: SessionSummaryProps) {
  // Animate the ring from 0 to the session accuracy on mount (CSS transition
  // does the easing; reduced-motion users see it instantly).
  const [shownAccuracy, setShownAccuracy] = useState(0)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShownAccuracy(data.accuracy))
    return () => cancelAnimationFrame(frame)
  }, [data.accuracy])

  return (
    <div className="session-summary" aria-label="Session summary">
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
      <div className="session-summary-actions">
        {hasNext ? (
          <>
            <button type="button" className="coach-btn primary" onClick={onNext}>
              Next range
            </button>
            <button type="button" className="coach-btn quiet" onClick={onDone}>
              Done
            </button>
          </>
        ) : (
          <button type="button" className="coach-btn primary" onClick={onDone}>
            Done
          </button>
        )}
      </div>
    </div>
  )
}
