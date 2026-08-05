import {
  ACTION_TYPES,
  ACTION_TYPE_LABELS,
  GAME_TYPES,
  GAME_TYPE_LABELS,
  POSITIONS,
  POSITION_LABELS,
  RANGE_SOURCE_KINDS,
  RANGE_SOURCE_KIND_LABELS,
  TABLE_SIZES,
  TABLE_SIZE_LABELS,
  type ActionType,
  type GameType,
  type Position,
  type RangeSourceKind,
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
  /** Selected source/provenance kind, or '' when unset. */
  sourceKind: RangeSourceKind | ''
  /** Free-text source reference (citation or URL). */
  sourceReference: string
  onGameTypeChange: (gameType: GameType | '') => void
  onTableSizeChange: (tableSize: TableSize | '') => void
  onStackDepthChange: (stackDepth: string) => void
  onPositionChange: (position: Position | '') => void
  onVersusPositionChange: (versusPosition: Position | '') => void
  onActionTypeChange: (actionType: ActionType | '') => void
  onNotesChange: (notes: string) => void
  onSourceKindChange: (kind: RangeSourceKind | '') => void
  onSourceReferenceChange: (reference: string) => void
  /**
   * The scenario the range's NAME describes and these fields do not yet, read
   * back in plain words (e.g. `SB · 3-bet · vs BTN`). Null when the name adds
   * nothing, which hides the offer.
   */
  scenarioFromName?: string | null
  /** Fill the empty fields from the name. Required when `scenarioFromName` is set. */
  onUseScenarioFromName?: () => void
}

/**
 * Compact, optional "Scenario details" editor for a range's metadata.
 *
 * Fully controlled: it owns no state and reads/writes only through props, so the
 * parent stays the single source of truth for the editor fields. It surfaces all
 * RangeMetadata fields — game type, table size, stack depth, hero/versus
 * position, action type, and notes — plus the optional source/provenance (kind +
 * reference). NOTE: the source persists to the top-level `SavedRange.source`, not
 * inside `metadata`; it lives in this form only because both are descriptive.
 * Editing these values never touches the selected hands or the range notation.
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
  sourceKind,
  sourceReference,
  onGameTypeChange,
  onTableSizeChange,
  onStackDepthChange,
  onPositionChange,
  onVersusPositionChange,
  onActionTypeChange,
  onNotesChange,
  onSourceKindChange,
  onSourceReferenceChange,
  scenarioFromName = null,
  onUseScenarioFromName,
}: RangeMetadataEditorProps) {
  return (
    <section className="range-metadata" aria-label="Scenario details">
      <h2>Scenario details</h2>

      {/* These fields are what the spot drill, the coverage map and the leak
          reports read — a range that leaves them blank is invisible to all
          three. Most names already say the scenario, so offer it rather than
          make the user re-enter it. Offered, never applied: a name is free
          text, and a wrong guess written in silently would be worse than a
          blank field. */}
      {scenarioFromName && onUseScenarioFromName && (
        <div className="range-metadata-suggestion">
          <p>
            From the name: <strong>{scenarioFromName}</strong>
          </p>
          <button type="button" className="coach-btn" onClick={onUseScenarioFromName}>
            Use this
          </button>
        </div>
      )}

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

        <div className="range-metadata-group">
          <label htmlFor="range-metadata-source">Source</label>
          <select
            id="range-metadata-source"
            value={sourceKind}
            onChange={(event) => onSourceKindChange(event.target.value as RangeSourceKind | '')}
          >
            <option value="">—</option>
            {RANGE_SOURCE_KINDS.map((value) => (
              <option key={value} value={value}>
                {RANGE_SOURCE_KIND_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="range-metadata-group">
        <label htmlFor="range-metadata-reference">Reference</label>
        <input
          id="range-metadata-reference"
          type="text"
          value={sourceReference}
          onChange={(event) => onSourceReferenceChange(event.target.value)}
          placeholder="Optional citation or URL"
        />
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
