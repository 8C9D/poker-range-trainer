import { calculateRangePercentage, countSelectedCombos } from '../domain/rangeMath'
import { ACTION_TYPE_LABELS, POSITION_LABELS, type SavedRange } from '../types/range'
import './RangeLibrary.css'

interface RangeLibraryProps {
  ranges: SavedRange[]
  /** Id of the range currently open in the editor, highlighted as active. */
  activeId: string | null
  onLoad: (range: SavedRange) => void
  onDelete: (id: string) => void
  /** Start a practice session for the given saved range. */
  onPractice: (range: SavedRange) => void
}

/** Longest notes string shown in full on a card before it is truncated. */
const NOTES_PREVIEW_MAX = 80

/** Trim long notes to a compact, single-line-ish preview so cards stay tidy. */
function previewNotes(notes: string): string {
  if (notes.length <= NOTES_PREVIEW_MAX) return notes
  return `${notes.slice(0, NOTES_PREVIEW_MAX).trimEnd()}…`
}

/**
 * Lists the saved ranges with summary stats and load/delete controls.
 *
 * Combo counts and percentages are derived through the domain helpers so the
 * library never reimplements poker math.
 */
export function RangeLibrary({
  ranges,
  activeId,
  onLoad,
  onDelete,
  onPractice,
}: RangeLibraryProps) {
  return (
    <section className="range-library" aria-label="Saved ranges">
      <h2>Saved Ranges</h2>
      {ranges.length === 0 ? (
        <p className="range-library-empty">No saved ranges yet.</p>
      ) : (
        <ul className="range-library-list">
          {ranges.map((range) => {
            const combos = countSelectedCombos(range.hands)
            const percentage = calculateRangePercentage(range.hands)
            const isActive = range.id === activeId

            // Only the metadata fields that are actually set are shown, so an
            // absent or empty metadata object renders no extra labels.
            const scenarioParts: string[] = []
            if (range.metadata?.position) {
              scenarioParts.push(POSITION_LABELS[range.metadata.position])
            }
            if (range.metadata?.actionType) {
              scenarioParts.push(ACTION_TYPE_LABELS[range.metadata.actionType])
            }
            const notes = range.metadata?.notes

            return (
              <li
                key={range.id}
                className={isActive ? 'range-item active' : 'range-item'}
                aria-current={isActive ? 'true' : undefined}
              >
                <div className="range-item-info">
                  <span className="range-item-name">{range.name}</span>
                  <span className="range-item-stats">
                    {range.hands.length} hands · {combos} combos · {percentage.toFixed(1)}%
                  </span>
                  {scenarioParts.length > 0 && (
                    <span className="range-item-scenario">{scenarioParts.join(' · ')}</span>
                  )}
                  {notes && <span className="range-item-notes">{previewNotes(notes)}</span>}
                </div>
                <div className="range-item-actions">
                  <button
                    type="button"
                    className="practice-action"
                    aria-label={`Practice range ${range.name}`}
                    onClick={() => onPractice(range)}
                  >
                    Practice
                  </button>
                  <button
                    type="button"
                    aria-label={`Load range ${range.name}`}
                    onClick={() => onLoad(range)}
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete range ${range.name}`}
                    onClick={() => onDelete(range.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
