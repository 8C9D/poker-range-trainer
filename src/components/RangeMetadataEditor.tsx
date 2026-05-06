import {
  ACTION_TYPES,
  ACTION_TYPE_LABELS,
  POSITIONS,
  POSITION_LABELS,
  type ActionType,
  type Position,
} from '../types/range'
import './RangeMetadataEditor.css'

interface RangeMetadataEditorProps {
  /** Selected hero position, or '' when unset. */
  position: Position | ''
  /** Selected action type, or '' when unset. */
  actionType: ActionType | ''
  /** Free-form scenario notes. */
  notes: string
  onPositionChange: (position: Position | '') => void
  onActionTypeChange: (actionType: ActionType | '') => void
  onNotesChange: (notes: string) => void
}

/**
 * Compact, optional "Scenario details" editor for a range's metadata.
 *
 * Fully controlled: it owns no state and reads/writes only through props, so the
 * parent stays the single source of truth for the editor fields. This slice
 * surfaces position, action type, and notes; the other RangeMetadata fields are
 * intentionally not exposed yet. Editing these values is descriptive only — it
 * never touches the selected hands or the range notation.
 *
 * Both dropdowns include a blank option so metadata stays optional, and their
 * options are derived from the POSITIONS / ACTION_TYPES tuples (rendered through
 * the shared label maps) so the UI can never drift from the allowed values.
 */
export function RangeMetadataEditor({
  position,
  actionType,
  notes,
  onPositionChange,
  onActionTypeChange,
  onNotesChange,
}: RangeMetadataEditorProps) {
  return (
    <section className="range-metadata" aria-label="Scenario details">
      <h2>Scenario details</h2>

      <div className="range-metadata-fields">
        <div className="range-metadata-group">
          <label htmlFor="range-metadata-position">Position</label>
          <select
            id="range-metadata-position"
            value={position}
            onChange={(event) => onPositionChange(event.target.value as Position | '')}
          >
            <option value="">—</option>
            {POSITIONS.map((value) => (
              <option key={value} value={value}>
                {POSITION_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="range-metadata-group">
          <label htmlFor="range-metadata-action">Action type</label>
          <select
            id="range-metadata-action"
            value={actionType}
            onChange={(event) => onActionTypeChange(event.target.value as ActionType | '')}
          >
            <option value="">—</option>
            {ACTION_TYPES.map((value) => (
              <option key={value} value={value}>
                {ACTION_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="range-metadata-group">
        <label htmlFor="range-metadata-notes">Notes</label>
        <textarea
          id="range-metadata-notes"
          className="range-metadata-notes"
          rows={2}
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder="Optional notes about this scenario"
        />
      </div>
    </section>
  )
}
