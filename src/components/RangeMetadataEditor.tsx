import {
  ACTION_TYPES,
  ACTION_TYPE_LABELS,
  GAME_TYPES,
  GAME_TYPE_LABELS,
  POSITIONS,
  POSITION_LABELS,
  TABLE_SIZES,
  TABLE_SIZE_LABELS,
  type ActionType,
  type GameType,
  type Position,
  type TableSize,
} from '../types/range'
import './RangeMetadataEditor.css'

interface RangeMetadataEditorProps {
  /** Selected game type, or '' when unset. */
  gameType: GameType | ''
  /** Selected table size, or '' when unset. */
  tableSize: TableSize | ''
  /** Raw stack-depth input text; '' means "no stack depth". */
  stackDepth: string
  /** Validation message for an invalid stack depth, or '' when valid/blank. */
  stackDepthError?: string
  /** Selected hero position, or '' when unset. */
  position: Position | ''
  /** Selected opponent position, or '' when unset. */
  versusPosition: Position | ''
  /** Selected action type, or '' when unset. */
  actionType: ActionType | ''
  /** Free-form scenario notes. */
  notes: string
  onGameTypeChange: (gameType: GameType | '') => void
  onTableSizeChange: (tableSize: TableSize | '') => void
  onStackDepthChange: (stackDepth: string) => void
  onPositionChange: (position: Position | '') => void
  onVersusPositionChange: (versusPosition: Position | '') => void
  onActionTypeChange: (actionType: ActionType | '') => void
  onNotesChange: (notes: string) => void
}

/**
 * Compact, optional "Scenario details" editor for a range's metadata.
 *
 * Fully controlled: it owns no state and reads/writes only through props, so the
 * parent stays the single source of truth for the editor fields. It surfaces all
 * RangeMetadata fields — game type, table size, stack depth, hero/versus
 * position, action type, and notes. Editing these values is descriptive only —
 * it never touches the selected hands or the range notation.
 *
 * Every dropdown includes a blank option so metadata stays optional, and their
 * options are derived from the const tuples (rendered through the shared label
 * maps) so the UI can never drift from the allowed values. Stack-depth
 * validation is computed by the parent and surfaced here as a message.
 */
export function RangeMetadataEditor({
  gameType,
  tableSize,
  stackDepth,
  stackDepthError,
  position,
  versusPosition,
  actionType,
  notes,
  onGameTypeChange,
  onTableSizeChange,
  onStackDepthChange,
  onPositionChange,
  onVersusPositionChange,
  onActionTypeChange,
  onNotesChange,
}: RangeMetadataEditorProps) {
  return (
    <section className="range-metadata" aria-label="Scenario details">
      <h2>Scenario details</h2>

      <div className="range-metadata-fields">
        <div className="range-metadata-group">
          <label htmlFor="range-metadata-game-type">Game type</label>
          <select
            id="range-metadata-game-type"
            value={gameType}
            onChange={(event) => onGameTypeChange(event.target.value as GameType | '')}
          >
            <option value="">—</option>
            {GAME_TYPES.map((value) => (
              <option key={value} value={value}>
                {GAME_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="range-metadata-group">
          <label htmlFor="range-metadata-table-size">Table size</label>
          <select
            id="range-metadata-table-size"
            value={tableSize}
            onChange={(event) => onTableSizeChange(event.target.value as TableSize | '')}
          >
            <option value="">—</option>
            {TABLE_SIZES.map((value) => (
              <option key={value} value={value}>
                {TABLE_SIZE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="range-metadata-group">
          <label htmlFor="range-metadata-stack-depth">Stack depth</label>
          <input
            id="range-metadata-stack-depth"
            type="number"
            inputMode="numeric"
            min="1"
            step="any"
            value={stackDepth}
            onChange={(event) => onStackDepthChange(event.target.value)}
            placeholder="e.g. 100 (bb)"
            aria-invalid={stackDepthError ? true : undefined}
            aria-describedby={stackDepthError ? 'range-metadata-stack-depth-error' : undefined}
          />
          {stackDepthError && (
            <p
              id="range-metadata-stack-depth-error"
              className="range-metadata-error"
              role="alert"
            >
              {stackDepthError}
            </p>
          )}
        </div>

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
          <label htmlFor="range-metadata-versus-position">Versus position</label>
          <select
            id="range-metadata-versus-position"
            value={versusPosition}
            onChange={(event) => onVersusPositionChange(event.target.value as Position | '')}
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
