import { useState } from 'react'
import { rangeEdgeHands } from '../domain/edgeHands'
import { DEFAULT_DRILL_SECONDS, DRILL_DURATION_OPTIONS } from '../domain/timedDrill'
import type { SavedRange } from '../types/range'
import { answerVerbs } from './scenario'

export type PracticeMode = 'recognize' | 'build' | 'timed' | 'weakness' | 'edges'

interface ModePickerProps {
  range: SavedRange
  onPick: (mode: PracticeMode, opts?: { durationSeconds?: number }) => void
}

/**
 * Lists only the practice modes valid for this range: the edge drill needs a
 * range boundary to exist; the rest always apply.
 */
export function ModePicker({ range, onPick }: ModePickerProps) {
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_DRILL_SECONDS)
  const verbs = answerVerbs(range)
  // An empty range (or one holding every hand) has no boundary to drill.
  const hasEdge = rangeEdgeHands(range.hands).length > 0

  return (
    <section className="mode-picker" aria-label="Choose practice mode">
      <h2>How do you want to train?</h2>
      <button type="button" className="mode-picker-option" onClick={() => onPick('recognize')}>
        <strong>Recognize hands</strong>
        <span>
          See a hand, decide {verbs.yes.toLowerCase()} or fold. The core drill.
        </span>
      </button>
      <button type="button" className="mode-picker-option" onClick={() => onPick('build')}>
        <strong>Build from memory</strong>
        <span>Rebuild the whole range on an empty grid, then check it.</span>
      </button>
      <button
        type="button"
        className="mode-picker-option"
        onClick={() => onPick('timed', { durationSeconds })}
      >
        <strong>Timed drill</strong>
        <span>Answer as many hands as you can before the clock runs out.</span>
      </button>
      <label className="mode-picker-duration">
        Timed drill duration{' '}
        <select
          className="coach-input"
          value={durationSeconds}
          onChange={(event) => setDurationSeconds(Number(event.target.value))}
        >
          {DRILL_DURATION_OPTIONS.map((seconds) => (
            <option key={seconds} value={seconds}>
              {seconds}s
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="mode-picker-option" onClick={() => onPick('weakness')}>
        <strong>Weakness drill</strong>
        <span>The hands you miss show up more often until they stick.</span>
      </button>
      {hasEdge && (
        <button type="button" className="mode-picker-option" onClick={() => onPick('edges')}>
          <strong>Edge drill</strong>
          <span>Only the hands on the range boundary — where the real decisions are.</span>
        </button>
      )}
    </section>
  )
}
