import { useState } from 'react'
import {
  distinctStackDepths,
  filterRangesByActionType,
  filterRangesByGameType,
  filterRangesByName,
  filterRangesByPosition,
  filterRangesByStackDepth,
  sortRangesByName,
  sortRangesByUpdatedAt,
} from '../domain/rangeLibrary'
import { calculateRangePercentage, countSelectedCombos } from '../domain/rangeMath'
import {
  ACTION_TYPE_LABELS,
  ACTION_TYPES,
  GAME_TYPE_LABELS,
  GAME_TYPES,
  POSITION_LABELS,
  POSITIONS,
  TABLE_SIZE_LABELS,
  type ActionType,
  type GameType,
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
 * A name search, a position filter, an action-type filter, a stack-depth filter,
 * and a game-type filter narrow the list through the {@link filterRangesByName},
 * {@link filterRangesByPosition}, {@link filterRangesByActionType},
 * {@link filterRangesByStackDepth}, and {@link filterRangesByGameType} domain
 * helpers, so the component owns no matching logic of its own. The five compose:
 * the search narrows by name, then the selects narrow by hero position, action
 * type, effective stack depth, and game type. The stack-depth options are the
 * distinct depths actually present across the saved ranges (via
 * {@link distinctStackDepths}), since depth is a free-form number rather than a
 * fixed vocabulary; the other selects iterate fixed vocabularies. A final sort
 * select orders the filtered result through the {@link sortRangesByName} and
 * {@link sortRangesByUpdatedAt} domain helpers: "Default order" keeps the
 * filtered (storage) order, "Name (A–Z)" sorts alphabetically, and "Recently
 * edited" sorts by `updatedAt` descending (newest first); sorting always applies
 * to the result of filtering and is not persisted. Combo counts and percentages
 * are likewise derived through the domain helpers, keeping the library free of
 * reimplemented poker math.
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
  // Empty string is the "All actions" sentinel; typing it as ActionType | ''
  // keeps only valid actions selectable.
  const [actionType, setActionType] = useState<ActionType | ''>('')
  // Stack depth is a free-form number, so the empty-string sentinel for "All
  // stack depths" is mapped to null before it reaches the filter helper.
  const [stackDepth, setStackDepth] = useState<number | ''>('')
  // Empty string is the "All game types" sentinel; typing it as GameType | ''
  // keeps only valid game types selectable.
  const [gameType, setGameType] = useState<GameType | ''>('')
  // Empty string is the "Default order" sentinel; 'name' sorts the filtered list
  // alphabetically and 'recent' sorts by most recently edited. Sorting applies
  // after filtering and is not persisted.
  const [sort, setSort] = useState<'' | 'name' | 'recent'>('')
  // Options come from the depths actually saved, so the filter always reflects
  // the user's data rather than a hardcoded list.
  const stackDepths = distinctStackDepths(ranges)
  const filtered = filterRangesByGameType(
    filterRangesByStackDepth(
      filterRangesByActionType(
        filterRangesByPosition(filterRangesByName(ranges, query), position),
        actionType,
      ),
      stackDepth === '' ? null : stackDepth,
    ),
    gameType,
  )
  // Sorting operates on the filtered result; "Default order" leaves it untouched.
  const visibleRanges =
    sort === 'name'
      ? sortRangesByName(filtered)
      : sort === 'recent'
        ? sortRangesByUpdatedAt(filtered)
        : filtered

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
            <select
              className="range-library-filter"
              value={actionType}
              onChange={(event) => setActionType(event.target.value as ActionType | '')}
              aria-label="Filter ranges by action type"
            >
              <option value="">All actions</option>
              {ACTION_TYPES.map((action) => (
                <option key={action} value={action}>
                  {ACTION_TYPE_LABELS[action]}
                </option>
              ))}
            </select>
            <select
              className="range-library-filter"
              value={String(stackDepth)}
              onChange={(event) =>
                setStackDepth(event.target.value === '' ? '' : Number(event.target.value))
              }
              aria-label="Filter ranges by stack depth"
            >
              <option value="">All stack depths</option>
              {stackDepths.map((depth) => (
                <option key={depth} value={depth}>
                  {depth}bb
                </option>
              ))}
            </select>
            <select
              className="range-library-filter"
              value={gameType}
              onChange={(event) => setGameType(event.target.value as GameType | '')}
              aria-label="Filter ranges by game type"
            >
              <option value="">All game types</option>
              {GAME_TYPES.map((game) => (
                <option key={game} value={game}>
                  {GAME_TYPE_LABELS[game]}
                </option>
              ))}
            </select>
            <select
              className="range-library-filter"
              value={sort}
              onChange={(event) => setSort(event.target.value as '' | 'name' | 'recent')}
              aria-label="Sort ranges"
            >
              <option value="">Default order</option>
              <option value="name">Name (A–Z)</option>
              <option value="recent">Recently edited</option>
            </select>
          </div>
          {visibleRanges.length === 0 ? (
            <p className="range-library-empty">
              {query.trim()
                ? `No ranges match “${query.trim()}”.`
                : 'No ranges match the selected filters.'}
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
