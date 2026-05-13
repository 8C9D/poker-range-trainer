import { useState } from 'react'
import { compareBuiltRange } from '../domain/practice'
import type { PokerHand } from '../domain/pokerHands'
import type { SavedRange } from '../types/range'
import { HandGrid } from './HandGrid'
import './PracticeSession.css'

interface BuildFromMemoryPracticeProps {
  /** The saved range to rebuild from memory. */
  range: SavedRange
  /** Leave practice and return to the editor/library view. */
  onExit: () => void
}

/**
 * Practice mode 3 ("Build from memory"): the user sees only a saved range's
 * name and recreates its hands on a blank 13×13 grid from memory. Submitting
 * compares the built selection against the saved range with `compareBuiltRange`
 * and reports the hands they got right, the ones they missed, and the ones they
 * added by mistake.
 *
 * The component owns its build selection and the checked/result state; all
 * comparison logic stays in `compareBuiltRange` and is never re-derived here. It
 * is pure UI — no randomness, persistence, or timers. Wiring it into a
 * practice-mode picker is a later slice; here it stands alone.
 */
export function BuildFromMemoryPractice({ range, onExit }: BuildFromMemoryPracticeProps) {
  const [selected, setSelected] = useState<Set<PokerHand>>(new Set())
  // False while building; true once the user submits and views the comparison.
  const [checked, setChecked] = useState(false)

  // Idempotent membership update mirroring App's handler: returning the previous
  // set when nothing changes avoids a needless re-render mid-drag.
  function setHandSelected(hand: PokerHand, shouldSelect: boolean) {
    setSelected((prev) => {
      if (prev.has(hand) === shouldSelect) return prev
      const next = new Set(prev)
      if (shouldSelect) {
        next.add(hand)
      } else {
        next.delete(hand)
      }
      return next
    })
  }

  function tryAgain() {
    setSelected(new Set())
    setChecked(false)
  }

  if (checked) {
    const { correct, missed, extra } = compareBuiltRange(range.hands, Array.from(selected))
    // Derive the target size from the comparison so the score always agrees with
    // the (normalized, de-duplicated) lists rather than range.hands.length raw.
    const targetSize = correct.length + missed.length
    const perfect = missed.length === 0 && extra.length === 0
    return (
      <section className="practice-session" aria-label="Build from memory results">
        <header className="practice-header">
          <h2>Results: {range.name}</h2>
        </header>

        <div className="practice-stats" aria-label="Build from memory score">
          <span className="practice-stat">
            Correct: {correct.length} of {targetSize}
          </span>
          <span className="practice-stat">Missed: {missed.length}</span>
          <span className="practice-stat">Added by mistake: {extra.length}</span>
        </div>

        {perfect ? (
          <p className="practice-review-clean">Perfect — you rebuilt the range exactly!</p>
        ) : (
          <div className="practice-review">
            {correct.length > 0 && (
              <div className="practice-review-group">
                <h3 className="practice-review-heading">Correct</h3>
                <ul className="practice-review-hands" aria-label="Hands you got right">
                  {correct.map((hand) => (
                    <li key={hand}>{hand}</li>
                  ))}
                </ul>
              </div>
            )}
            {missed.length > 0 && (
              <div className="practice-review-group">
                <h3 className="practice-review-heading">Missed (in range, not built)</h3>
                <ul className="practice-review-hands" aria-label="Hands you missed">
                  {missed.map((hand) => (
                    <li key={hand}>{hand}</li>
                  ))}
                </ul>
              </div>
            )}
            {extra.length > 0 && (
              <div className="practice-review-group">
                <h3 className="practice-review-heading">Added by mistake (not in range)</h3>
                <ul className="practice-review-hands" aria-label="Hands you added by mistake">
                  {extra.map((hand) => (
                    <li key={hand}>{hand}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="practice-answers">
          <button type="button" className="primary" onClick={tryAgain}>
            Try again
          </button>
          <button type="button" onClick={onExit}>
            Back to library
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="practice-session" aria-label="Build from memory practice">
      <header className="practice-header">
        <h2>Build from memory: {range.name}</h2>
      </header>

      <p className="practice-expected">
        Recreate this range on the grid from memory, then check your answer.
      </p>

      <HandGrid selected={selected} onSetSelected={setHandSelected} />

      <div className="practice-stats" aria-label="Build progress">
        <span className="practice-stat">{selected.size} hands selected</span>
      </div>

      <div className="practice-answers">
        <button type="button" className="primary" onClick={() => setChecked(true)}>
          Check my range
        </button>
        <button type="button" onClick={onExit}>
          Back to library
        </button>
      </div>
    </section>
  )
}
