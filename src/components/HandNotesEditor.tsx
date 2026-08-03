import { useState } from 'react'
import { ALL_HANDS, type PokerHand } from '../domain/pokerHands'
import './HandNotesEditor.css'

interface HandNotesEditorProps {
  /** The range's hands — the set that can carry notes. */
  hands: PokerHand[]
  /** Current per-hand notes map (controlled; parent owns it). */
  notes: Record<PokerHand, string>
  /** Fired with the next notes map whenever the active hand's note changes. */
  onChange: (next: Record<PokerHand, string>) => void
}

/**
 * Controlled, presentational editor for a range's per-hand notes, in a titled
 * section like the editor's other blocks.
 *
 * A `<select>` picks the active hand (from the range's hands, in canonical
 * matrix order) and a `<textarea>` edits that hand's note. Editing produces a
 * NEW notes map: a non-blank note sets the hand's entry; a blank note removes
 * it. The notes map is parent-owned (reported via `onChange`); only the
 * active-hand selection is internal state. An empty range shows a short message.
 */
export function HandNotesEditor({ hands, notes, onChange }: HandNotesEditorProps) {
  const handSet = new Set(hands)
  // Canonical matrix order regardless of the input order of `hands`.
  const orderedHands = ALL_HANDS.filter((hand) => handSet.has(hand))

  const [activeHand, setActiveHand] = useState<PokerHand | ''>(orderedHands[0] ?? '')

  if (orderedHands.length === 0) {
    return (
      <section className="hand-notes-editor" aria-label="Hand notes">
        <h2 className="hand-notes-title">Hand notes</h2>
        <p className="hand-notes-empty">Add hands to the range to attach notes.</p>
      </section>
    )
  }

  // Guard against an active hand that is no longer in the range (e.g. the hands
  // prop changed); fall back to the first hand.
  const selected: PokerHand = activeHand && handSet.has(activeHand) ? activeHand : orderedHands[0]
  const noteValue = notes[selected] ?? ''

  const setNote = (text: string) => {
    const next: Record<PokerHand, string> = { ...notes }
    // Store raw text while editing (storage trims on save); a blank note removes
    // the entry so an empty map never carries stray keys.
    if (text.trim().length > 0) next[selected] = text
    else delete next[selected]
    onChange(next)
  }

  return (
    <section className="hand-notes-editor" aria-label="Hand notes">
      <h2 className="hand-notes-title">Hand notes</h2>
      <div className="hand-notes-pick">
        <label htmlFor="hand-notes-active">Hand</label>
        <select
          id="hand-notes-active"
          value={selected}
          onChange={(event) => setActiveHand(event.target.value as PokerHand)}
        >
          {orderedHands.map((hand) => (
            <option key={hand} value={hand}>
              {hand}
            </option>
          ))}
        </select>
      </div>

      <div className="hand-notes-field">
        <label htmlFor="hand-notes-text">Note for {selected}</label>
        <textarea
          id="hand-notes-text"
          rows={3}
          value={noteValue}
          onChange={(event) => setNote(event.target.value)}
          placeholder={`Optional note for ${selected}`}
        />
      </div>
    </section>
  )
}
