import { useEffect, useId, useMemo, useState } from 'react'
import { RangeThumbnail } from '../components/RangeThumbnail'
import { SpotCoverage } from '../components/SpotCoverage'
import { formatDayDistance } from '../app/format'
import { createRangeId } from '../app/ids'
import {
  readLibraryView,
  rememberLibraryView,
  type LibrarySortOrder,
} from '../app/libraryView'
import { routeHash } from '../app/routes'
import {
  collectRangeTags,
  distinctStackDepths,
  filterArchivedRanges,
  filterFavoriteRanges,
  filterRangesByActionType,
  filterRangesByGameType,
  filterRangesBySearch,
  filterRangesByPosition,
  filterRangesByStackDepth,
  filterRangesByTag,
  sortRangesByAccuracy,
  sortRangesByLastPracticed,
  sortRangesByName,
  sortRangesByUpdatedAt,
} from '../domain/rangeLibrary'
import { rangeComboPercentage } from '../domain/comboSelection'
import { practiceAccuracyPercentage } from '../domain/practiceStats'
import { setRangeArchived } from '../domain/rangeArchive'
import { setRangeFavorite } from '../domain/rangeFavorite'
import { selectDueRanges } from '../domain/spacedRepetition'
import { buildStarterRanges, STARTER_RANGE_TEMPLATES } from '../domain/starterRanges'
import { loadPracticeStats } from '../storage/practiceStatsStorage'
import { loadReviewStates } from '../storage/reviewStateStorage'
import { loadSavedRanges, saveSavedRanges } from '../storage/rangeStorage'
import {
  clearDeletedRanges,
  deleteRangesWithRecords,
  describeDeletedRanges,
  peekDeletedRanges,
  restoreDeletedRanges,
  type DeletedRanges,
} from '../storage/rangeRemoval'
import {
  ACTION_TYPE_LABELS,
  ACTION_TYPES,
  GAME_TYPE_LABELS,
  GAME_TYPES,
  POSITION_LABELS,
  POSITIONS,
  type ActionType,
  type GameType,
  type Position,
  type SavedRange,
  type TableSize,
} from '../types/range'
import './LibraryScreen.css'

// Declared with the remembered view so the two can never drift apart.
type SortOrder = LibrarySortOrder

interface LibraryScreenProps {
  /** Start the v8.2 spot drill over the whole library at the given format. */
  onPlaySpots: (format: { tableSize: TableSize; stackDepthBb: number }) => void
  /** Drill the selected ranges back to back, as one queued recognition run. */
  onPracticeSelected: (queue: SavedRange[]) => void
}

/**
 * The Library: search, filters, and sorted range rows. Rows navigate to the
 * per-range page. Data is loaded once on mount; every mutation lives on the
 * Range page, which navigating back from remounts this screen.
 */
export function LibraryScreen({ onPlaySpots, onPracticeSelected }: LibraryScreenProps) {
  // Prefix for the per-row ids the rows' descriptions are wired through; the
  // row index completes it, so it never depends on a range id being id-safe.
  const listId = useId()
  const [ranges, setRanges] = useState(() => loadSavedRanges())
  const [practiceStats, setPracticeStats] = useState(() => loadPracticeStats())
  const [reviewStates, setReviewStates] = useState(() => loadReviewStates())
  const [nowIso] = useState(() => new Date().toISOString())

  // Opening a range unmounts this screen, so the view it was left in is restored
  // rather than reset — otherwise working through a filtered group of charts
  // means re-typing the filter after every single one.
  const lastView = useState(readLibraryView)[0]
  const [query, setQuery] = useState(lastView.query)
  const [filtersOpen, setFiltersOpen] = useState(lastView.filtersOpen)
  const [position, setPosition] = useState<Position | ''>(lastView.position)
  const [actionType, setActionType] = useState<ActionType | ''>(lastView.actionType)
  const [stackDepth, setStackDepth] = useState<number | ''>(lastView.stackDepth)
  const [gameType, setGameType] = useState<GameType | ''>(lastView.gameType)
  const [tag, setTag] = useState(lastView.tag)
  const [sort, setSort] = useState<SortOrder>(lastView.sort)
  const [showArchived, setShowArchived] = useState(lastView.showArchived)
  const [favoritesOnly, setFavoritesOnly] = useState(lastView.favoritesOnly)
  const [managing, setManaging] = useState(false)
  // Why the last library write did not land, cleared by the next one that does.
  const [actionError, setActionError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  // A delete on the range page navigates here, so the offer to undo it arrives
  // with the mount; a delete made here sets this directly. Read while rendering
  // and cleared in an effect, rather than taken in one step: taking it is a side
  // effect, and StrictMode runs a state initializer twice, so a one-shot take
  // would hand the offer to a render that is then thrown away.
  const [undoable, setUndoable] = useState<DeletedRanges | null>(peekDeletedRanges)
  useEffect(clearDeletedRanges, [])

  useEffect(() => {
    rememberLibraryView({
      query,
      filtersOpen,
      position,
      actionType,
      stackDepth,
      gameType,
      tag,
      sort,
      showArchived,
      favoritesOnly,
    })
  }, [
    query,
    filtersOpen,
    position,
    actionType,
    stackDepth,
    gameType,
    tag,
    sort,
    showArchived,
    favoritesOnly,
  ])

  // Both depend only on the mount-once library data, so memoize them instead of
  // recomputing due dates across the whole library on every search keystroke.
  const stackDepths = useMemo(() => distinctStackDepths(ranges), [ranges])
  const tagOptions = useMemo(() => collectRangeTags(ranges), [ranges])
  const dueIds = useMemo(
    () =>
      new Set(
        selectDueRanges(
          ranges.filter((range) => !range.archived),
          reviewStates,
          nowIso,
        ).map((range) => range.id),
      ),
    [ranges, reviewStates, nowIso],
  )

  // Same pipeline as the pre-refactor library: archived drop out first (unless
  // revealed), then favorites-only, then the name/metadata filters narrow.
  const filtered = filterRangesByGameType(
    filterRangesByStackDepth(
      filterRangesByActionType(
        filterRangesByPosition(
          filterRangesBySearch(
            filterFavoriteRanges(filterArchivedRanges(ranges, showArchived), favoritesOnly),
            query,
          ),
          position,
        ),
        actionType,
      ),
      stackDepth === '' ? null : stackDepth,
    ),
    gameType,
  )
  const tagged = filterRangesByTag(filtered, tag === '' ? null : tag)
  const visibleRanges =
    sort === 'name'
      ? sortRangesByName(tagged)
      : sort === 'recent'
        ? sortRangesByUpdatedAt(tagged)
        : sort === 'practiced'
          ? sortRangesByLastPracticed(tagged, practiceStats)
          : sort === 'accuracy'
            ? sortRangesByAccuracy(tagged, practiceStats)
            : tagged
  const visibleIds = new Set(visibleRanges.map((range) => range.id))
  const visibleSelectedIds = new Set(Array.from(selectedIds).filter((id) => visibleIds.has(id)))
  const visibleSelectedRanges = visibleRanges.filter((range) => visibleSelectedIds.has(range.id))
  const allVisibleSelected =
    visibleRanges.length > 0 && visibleSelectedIds.size === visibleRanges.length
  const selectedAreArchived =
    visibleSelectedRanges.length > 0 && visibleSelectedRanges.every((range) => range.archived)
  const selectedAreFavorite =
    visibleSelectedRanges.length > 0 && visibleSelectedRanges.every((range) => range.favorite)

  const activeFilterCount =
    (position ? 1 : 0) +
    (actionType ? 1 : 0) +
    (stackDepth !== '' ? 1 : 0) +
    (gameType ? 1 : 0) +
    (tag ? 1 : 0) +
    (favoritesOnly ? 1 : 0) +
    (showArchived ? 1 : 0)
  const hasViewChanges = query.length > 0 || sort !== '' || activeFilterCount > 0

  /**
   * Run a storage write, reporting a failure instead of losing it. Every library
   * action persists from a click handler, where a throw from a full or
   * unavailable store escapes to nothing — the button just appears dead and the
   * list silently keeps its old state. Returns whether the write landed, so
   * callers only update the view when it did.
   */
  function persistResult<T>(write: () => T): { value: T } | null {
    let value: T
    try {
      value = write()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not save that change.')
      return null
    }
    setActionError(null)
    // Wrapped, so a write whose own result is falsy still reads as a success.
    return { value }
  }

  function persist(write: () => void): boolean {
    return persistResult(write) !== null
  }

  function addStarterRanges() {
    const starters = buildStarterRanges(new Date().toISOString(), createRangeId)
    if (!persist(() => saveSavedRanges(starters))) return
    setRanges(loadSavedRanges())
  }

  function undoDelete() {
    if (!undoable) return
    if (!persist(() => restoreDeletedRanges(undoable))) return
    setUndoable(null)
    // The practice record came back with the range, so the rows have to re-read
    // it — otherwise a restored range reads as never practiced until a reload.
    setRanges(loadSavedRanges())
    setPracticeStats(loadPracticeStats())
    setReviewStates(loadReviewStates())
  }

  function clearViewChanges() {
    setQuery('')
    setPosition('')
    setActionType('')
    setStackDepth('')
    setGameType('')
    setTag('')
    setSort('')
    setFavoritesOnly(false)
    setShowArchived(false)
  }

  return (
    <div className="library">
      <header className="library-header">
        <h1>Library</h1>
        <div className="library-header-actions">
          {ranges.length > 0 && (
            <button
              type="button"
              className="coach-btn"
              aria-pressed={managing}
              onClick={() => {
                setManaging((value) => !value)
                setSelectedIds(new Set())
              }}
            >
              {managing ? 'Done' : 'Manage'}
            </button>
          )}
          <a className="coach-btn primary" href={routeHash({ screen: 'newRange' })}>
            New range
          </a>
        </div>
      </header>

      {actionError && (
        <p className="library-error" role="alert">
          {actionError}
        </p>
      )}

      {undoable && (
        <div className="library-undo" role="status">
          <p>{describeDeletedRanges(undoable)} deleted, along with the practice record.</p>
          <div className="library-undo-actions">
            <button type="button" className="coach-btn" onClick={undoDelete}>
              Undo
            </button>
            <button
              type="button"
              className="coach-btn quiet"
              aria-label="Dismiss the undo offer"
              onClick={() => setUndoable(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {ranges.length === 0 ? (
        <section className="coach-card library-empty" aria-label="Empty library">
          <h2>No ranges yet</h2>
          <p>Create your first range and it will show up here, ready to train.</p>
          <p>
            In a hurry? Add {STARTER_RANGE_TEMPLATES.length} standard 6-max 100bb charts (opens
            for every seat, big-blind defences, and 3-bets) and start training now. They are
            ordinary ranges: edit or delete any of them.
          </p>
          <button type="button" className="coach-btn primary" onClick={addStarterRanges}>
            Add starter ranges
          </button>
        </section>
      ) : (
        <>
          <div className="library-toolbar">
            <input
              type="search"
              className="coach-input library-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search ranges or a hand (A5s)"
              aria-label="Search ranges by name, tag, notes or a hand"
            />
            <button
              type="button"
              className="coach-btn"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((open) => !open)}
            >
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </button>
            <select
              className="coach-input library-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortOrder)}
              aria-label="Sort ranges"
            >
              <option value="">Default order</option>
              <option value="name">Name (A–Z)</option>
              <option value="recent">Recently edited</option>
              <option value="practiced">Recently practiced</option>
              <option value="accuracy">Accuracy</option>
            </select>
            {hasViewChanges && (
              <button type="button" className="coach-btn quiet" onClick={clearViewChanges}>
                Clear filters
              </button>
            )}
          </div>

          {managing && (
            <div className="library-bulk-actions" role="group" aria-label="Bulk range actions">
              <button
                type="button"
                className="coach-btn"
                onClick={() =>
                  setSelectedIds((current) => {
                    const next = new Set(current)
                    for (const range of visibleRanges) {
                      if (allVisibleSelected) next.delete(range.id)
                      else next.add(range.id)
                    }
                    return next
                  })
                }
                disabled={visibleRanges.length === 0}
              >
                {allVisibleSelected ? 'Deselect visible' : 'Select visible'}
              </button>
              <span className="coach-tabular">{visibleSelectedIds.size} selected</span>
              {/* Filter to a group — every 3-bet chart, every BTN spot — and drill
                  exactly that, instead of opening each range in turn. Recognition
                  straight through, like the review queue a multi-range run is. */}
              <button
                type="button"
                className="coach-btn primary"
                disabled={visibleSelectedIds.size === 0}
                onClick={() => onPracticeSelected(visibleSelectedRanges)}
              >
                Practice selected
              </button>
              <button
                type="button"
                className="coach-btn"
                disabled={visibleSelectedIds.size === 0}
                onClick={() => {
                  const nextFavorite = !selectedAreFavorite
                  const nextRanges = ranges.map((range) => {
                    if (!visibleSelectedIds.has(range.id)) return range
                    return setRangeFavorite(range, nextFavorite)
                  })
                  const saved = persist(() =>
                    saveSavedRanges(
                      nextRanges.filter((range) => visibleSelectedIds.has(range.id)),
                    ),
                  )
                  if (!saved) return
                  setRanges(nextRanges)
                  setSelectedIds(new Set())
                }}
              >
                {selectedAreFavorite ? 'Unfavorite selected' : 'Favorite selected'}
              </button>
              <button
                type="button"
                className="coach-btn"
                disabled={visibleSelectedIds.size === 0}
                onClick={() => {
                  const nextArchived = !selectedAreArchived
                  const nextRanges = ranges.map((range) => {
                    if (!visibleSelectedIds.has(range.id)) return range
                    return setRangeArchived(range, nextArchived)
                  })
                  const saved = persist(() =>
                    saveSavedRanges(
                      nextRanges.filter((range) => visibleSelectedIds.has(range.id)),
                    ),
                  )
                  if (!saved) return
                  setRanges(nextRanges)
                  setSelectedIds(new Set())
                }}
              >
                {selectedAreArchived ? 'Unarchive selected' : 'Archive selected'}
              </button>
              <button
                type="button"
                className="coach-btn danger"
                disabled={visibleSelectedIds.size === 0}
                onClick={() => {
                  if (
                    !window.confirm(
                      `Delete ${visibleSelectedIds.size} selected range${visibleSelectedIds.size === 1 ? '' : 's'}, and everything recorded about ${visibleSelectedIds.size === 1 ? 'it' : 'them'}?`,
                    )
                  ) {
                    return
                  }
                  const deleted = persistResult(() =>
                    deleteRangesWithRecords(visibleSelectedIds),
                  )
                  if (!deleted) return
                  setUndoable(deleted.value)
                  setRanges((current) =>
                    current.filter((range) => !visibleSelectedIds.has(range.id)),
                  )
                  setSelectedIds(new Set())
                }}
              >
                Delete selected
              </button>
            </div>
          )}

          {filtersOpen && (
            <div className="library-filters" role="group" aria-label="Range filters">
              <select
                className="coach-input"
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
                className="coach-input"
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
                className="coach-input"
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
                className="coach-input"
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
              {tagOptions.length > 0 && (
                <select
                  className="coach-input"
                  value={tag}
                  onChange={(event) => setTag(event.target.value)}
                  aria-label="Filter ranges by tag"
                >
                  <option value="">All tags</option>
                  {tagOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                className="coach-btn"
                aria-pressed={favoritesOnly}
                onClick={() => setFavoritesOnly((on) => !on)}
              >
                Favorites only
              </button>
              <button
                type="button"
                className="coach-btn"
                aria-pressed={showArchived}
                onClick={() => setShowArchived((on) => !on)}
              >
                Show archived
              </button>
            </div>
          )}

          {visibleRanges.length === 0 ? (
            <p className="library-no-match">
              {query.trim()
                ? `No ranges match “${query.trim()}”.`
                : 'No ranges match the selected filters.'}
            </p>
          ) : (
            <ul className="library-list" aria-label="Saved ranges">
              {visibleRanges.map((range, index) => {
                const stats = practiceStats[range.id]
                const percentage = rangeComboPercentage(range.hands, range.comboSelections)
                const meta = range.metadata
                // The row's own label replaces everything inside it for a screen
                // reader, so without pointing back at them the chips and the
                // practice line — seat, action, size, due, tags, accuracy — are
                // announced to nobody. Ids rather than a hand-built sentence, so
                // the spoken row cannot drift from the drawn one.
                const rowId = `${listId}-${index}`
                const describedBy = [
                  range.favorite ? `${rowId}-favorite` : null,
                  `${rowId}-chips`,
                  `${rowId}-stats`,
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <li key={range.id} className="library-list-item">
                    {managing && (
                      <input
                        type="checkbox"
                        className="library-row-select"
                        aria-label={`Select ${range.name}`}
                        checked={selectedIds.has(range.id)}
                        onChange={(event) => {
                          setSelectedIds((current) => {
                            const next = new Set(current)
                            if (event.target.checked) next.add(range.id)
                            else next.delete(range.id)
                            return next
                          })
                        }}
                      />
                    )}
                    <a
                      className="coach-card library-row"
                      href={routeHash({ screen: 'range', id: range.id, tab: 'overview' })}
                      aria-label={`Open range ${range.name}`}
                      aria-describedby={describedBy}
                    >
                      <RangeThumbnail hands={range.hands} size={44} />
                      <div className="library-row-info">
                        <span className="library-row-name">
                          {range.favorite && (
                            <span
                              className="library-row-star"
                              id={`${rowId}-favorite`}
                              role="img"
                              aria-label="Favorite"
                              title="Favorite"
                            >
                              ★
                            </span>
                          )}
                          {range.name}
                        </span>
                        <span className="library-row-chips" id={`${rowId}-chips`}>
                          {meta?.position && (
                            <span className="coach-chip">
                              {POSITION_LABELS[meta.position]}
                              {meta.versusPosition
                                ? ` vs ${POSITION_LABELS[meta.versusPosition]}`
                                : ''}
                            </span>
                          )}
                          {meta?.actionType && (
                            <span className="coach-chip">
                              {ACTION_TYPE_LABELS[meta.actionType]}
                            </span>
                          )}
                          <span className="coach-chip coach-tabular">
                            {percentage.toFixed(1)}%
                          </span>
                          {dueIds.has(range.id) && (
                            <span className="coach-chip library-chip-due">Due</span>
                          )}
                          {range.archived && <span className="coach-chip">Archived</span>}
                          {range.tags?.map((rangeTag) => (
                            <span key={rangeTag} className="coach-chip library-chip-tag">
                              {rangeTag}
                            </span>
                          ))}
                        </span>
                      </div>
                      <div className="library-row-stats coach-tabular" id={`${rowId}-stats`}>
                        {stats && stats.totalAttempts > 0 ? (
                          <>
                            <span className="library-row-accuracy">
                              {practiceAccuracyPercentage(stats).toFixed(0)}%
                            </span>
                            <span className="library-row-practiced">
                              {formatDayDistance(stats.lastPracticedAt, nowIso)}
                            </span>
                          </>
                        ) : (
                          <span className="library-row-practiced">Not practiced</span>
                        )}
                      </div>
                    </a>
                  </li>
                )
              })}
            </ul>
          )}

          <SpotCoverage ranges={ranges} onPlaySpots={onPlaySpots} />
        </>
      )}
    </div>
  )
}
