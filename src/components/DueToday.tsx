import type { SavedRange } from '../types/range'
import './PracticeSession.css'
import './DueToday.css'

interface DueTodayProps {
  /** Ranges due for review now (already selected by the caller). */
  dueRanges: SavedRange[]
  /** Start a practice session for the given range. */
  onPractice: (range: SavedRange) => void
  /** Return to the editor/library view. */
  onClose: () => void
}

/**
 * The spaced-repetition "due today" review queue (v2.2): a list of the ranges due
 * for review, each with a Practice action, plus an all-caught-up empty state.
 * Pure presentation — the caller supplies the already-selected `dueRanges`.
 */
export function DueToday({ dueRanges, onPractice, onClose }: DueTodayProps) {
  return (
    <section className="practice-session" aria-label="Due for review">
      <header className="practice-header">
        <h2>Due for review ({dueRanges.length})</h2>
        <button type="button" onClick={onClose}>
          Back to library
        </button>
      </header>

      {dueRanges.length === 0 ? (
        <p className="due-today-empty">Nothing due for review right now — great work!</p>
      ) : (
        <ul className="due-today-list">
          {dueRanges.map((range) => (
            <li key={range.id} className="due-today-item">
              <span className="due-today-name">{range.name}</span>
              <button
                type="button"
                aria-label={`Practice range ${range.name}`}
                onClick={() => onPractice(range)}
              >
                Practice
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
