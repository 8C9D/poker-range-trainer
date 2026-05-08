import { useState } from 'react'
import { filterRangesByName, filterRangesByPosition } from '../domain/rangeLibrary'
import { calculateRangePercentage, countSelectedCombos } from '../domain/rangeMath'
import {
  ACTION_TYPE_LABELS,
  GAME_TYPE_LABELS,
  POSITION_LABELS,
  POSITIONS,
  TABLE_SIZE_LABELS,
  type Position,
  type SavedRange,
} from '../types/range'
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
 * A name search and a position filter narrow the list through the
 * {@link filterRangesByName} and {@link filterRangesByPosition} domain helpers,
 * so the component owns no matching logic of its own. The two compose: the
 * search narrows by name, then the select narrows by hero position. Combo counts
 * and percentages are likewise derived through the domain helpers, keeping the
 * library free of reimplemented poker math.
 */
export function RangeLibrary({
  ranges,
  activeId,
  onLoad,
  onDelete,
  onPractice,
}: RangeLibraryProps) {
  const [query, setQuery] = useState('')
  // Empty string is the "All positions" sentinel; typing it as Position | ''
  // keeps only valid positions selectable.
  const [position, setPosition] = useState<Position | ''>('')
  const visibleRanges = filterRangesByPosition(filterRangesByName(ranges, query), position)

  return (
    <section className="range-library" aria-label="Saved ranges">
      <h2>Saved Ranges</h2>
      {ranges.length === 0 ? (
        <p className="range-library-empty">No saved ranges yet.</p>
      ) : (
        <>
          <div className="range-library-filters">
            <input
              type="search"
              className="range-library-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search ranges by name"
              aria-label="Search ranges by name"
            />
            <select
              className="range-library-filter"
              value={position}
              onChange={(event) => setPosition(event.target.value as Position | '')}
              aria-label="Filter ranges by position"
            >
              <option value="">All positions</option>
              {POSITIONS.map((pos) => (
                <option key={pos} value={pos}>
                  {POSITION_LABELS[pos]}
                </option>
              ))}
            </select>
          </div>
          {visibleRanges.length === 0 ? (
            <p className="range-library-empty">
              {query.trim()
                ? `No ranges match “${query.trim()}”.`
                : 'No ranges match the selected position.'}
            </p>
          ) : (
            <ul className="range-library-list">
              {visibleRanges.map((range) => {
                const combos = countSelectedCombos(range.hands)
                const percentage = calculateRangePercentage(range.hands)
                const isActive = range.id === activeId

                // Only the metadata fields that are actually set are shown, so an
                // absent or empty metadata object renders no extra labels. The parts
                // form one compact scenario line, e.g. "Cash · 6-max · 100bb · BTN
                // vs CO · Open".
                const meta = range.metadata
                const scenarioParts: string[] = []
                if (meta?.gameType) scenarioParts.push(GAME_TYPE_LABELS[meta.gameType])
                if (meta?.tableSize) scenarioParts.push(TABLE_SIZE_LABELS[meta.tableSize])
                if (meta?.stackDepthBb !== undefined) scenarioParts.push(`${meta.stackDepthBb}bb`)

                // Combine hero and opponent seats so "vs" reads unambiguously.
                let seat = ''
                if (meta?.position && meta?.versusPosition) {
                  seat = `${POSITION_LABELS[meta.position]} vs ${POSITION_LABELS[meta.versusPosition]}`
                } else if (meta?.position) {
                  seat = POSITION_LABELS[meta.position]
                } else if (meta?.versusPosition) {
                  seat = `vs ${POSITION_LABELS[meta.versusPosition]}`
                }
                if (seat) scenarioParts.push(seat)

                if (meta?.actionType) scenarioParts.push(ACTION_TYPE_LABELS[meta.actionType])

                const notes = meta?.notes

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
        </>
      )}
    </section>
  )
}
