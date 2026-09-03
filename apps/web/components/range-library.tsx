'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import type { RangeListItem } from '@poker-range-trainer/contracts'
import {
  ACTION_TYPE_LABELS,
  GAME_TYPE_LABELS,
  POSITIONS,
  POSITION_LABELS,
  TABLE_SIZE_LABELS,
} from '@poker-range-trainer/domain/types/range'

import {
  ApiClientError,
  bulkMutateRanges,
  deleteRange,
  duplicateRange,
  listRanges,
  restoreRange,
  setRangeArchived,
  setRangeFavorite,
  type RangeListOptions,
} from '@/lib/api-client'

interface DeletedRange {
  id: string
  version: number
  name: string
}

const initialQuery: RangeListOptions = {
  page: 1,
  pageSize: 20,
  archived: 'exclude',
  sort: 'displayOrder',
  direction: 'asc',
}

const positionOptions = POSITIONS.map((value) => [value, POSITION_LABELS[value]] as const)

function metadataSummary(range: RangeListItem): string | undefined {
  if (!range.metadata) return undefined
  const { gameType, tableSize, stackDepthBb, position, versusPosition, actionType } = range.metadata
  const values = [
    gameType === undefined ? undefined : GAME_TYPE_LABELS[gameType],
    tableSize === undefined ? undefined : TABLE_SIZE_LABELS[tableSize],
    stackDepthBb === undefined ? undefined : `${stackDepthBb}bb`,
    position === undefined ? undefined : POSITION_LABELS[position],
    versusPosition === undefined ? undefined : `vs ${POSITION_LABELS[versusPosition]}`,
    actionType === undefined ? undefined : ACTION_TYPE_LABELS[actionType],
  ].filter((value): value is string => value !== undefined)
  return values.length > 0 ? values.join(' · ') : undefined
}

function messageFor(error: unknown): string {
  return error instanceof ApiClientError ? error.message : 'The range library could not be updated.'
}

function describeDeleted(deleted: DeletedRange[]): string {
  if (deleted.length === 1) return deleted[0]!.name
  return `${deleted.length} ranges`
}

export function RangeLibrary() {
  const [query, setQuery] = useState<RangeListOptions>(initialQuery)
  const [searchDraft, setSearchDraft] = useState('')
  const [ranges, setRanges] = useState<RangeListItem[]>([])
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, totalItems: 0, totalPages: 0 })
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [pending, setPending] = useState<string>()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleted, setDeleted] = useState<DeletedRange[]>([])

  useEffect(() => {
    let active = true
    listRanges(query)
      .then((response) => {
        if (!active) return
        setRanges(response.data)
        setMeta(response.meta)
        setSelected(
          (current) =>
            new Set(
              response.data.filter((range) => current.has(range.id)).map((range) => range.id),
            ),
        )
        setStatus('ready')
      })
      .catch((caught: unknown) => {
        if (!active) return
        setError(messageFor(caught))
        setStatus('error')
      })
    return () => {
      active = false
    }
  }, [query, loadAttempt])

  function refresh(): void {
    setLoadAttempt((attempt) => attempt + 1)
  }

  function retry(): void {
    setStatus('loading')
    setError(undefined)
    refresh()
  }

  function replaceQuery(next: RangeListOptions): void {
    setStatus('loading')
    setQuery(next)
    setSelected(new Set())
    setDeleted([])
  }

  function updateQuery(next: Partial<RangeListOptions>): void {
    replaceQuery({ ...query, ...next, page: next.page ?? 1 })
  }

  /** A reset replaces the whole query: merging the defaults would keep filters they omit. */
  function clearFilters(): void {
    setSearchDraft('')
    replaceQuery(initialQuery)
  }

  async function mutate(
    key: string,
    operation: () => Promise<void>,
    success: string,
  ): Promise<void> {
    setPending(key)
    setError(undefined)
    try {
      await operation()
      setNotice(success)
      refresh()
    } catch (caught) {
      setError(messageFor(caught))
    } finally {
      setPending(undefined)
    }
  }

  function deleteOne(range: RangeListItem): Promise<void> {
    return mutate(
      `delete-${range.id}`,
      async () => {
        const response = await deleteRange(range.id, range.version)
        setDeleted([{ ...response.data, name: range.name }])
      },
      `${range.name} was deleted. You can undo this while this page stays open.`,
    )
  }

  function undoDelete(): Promise<void> {
    const restoring = deleted
    return mutate(
      'undo-delete',
      async () => {
        if (restoring.length === 1) {
          const [only] = restoring
          await restoreRange(only!.id, only!.version)
        } else if (restoring.length > 1) {
          await bulkMutateRanges({
            action: 'restore',
            items: restoring.map(({ id, version }) => ({ id, version })),
          })
        }
        setDeleted([])
      },
      `${describeDeleted(restoring)} restored.`,
    )
  }

  function bulk(
    action: 'archive' | 'unarchive' | 'favorite' | 'unfavorite' | 'delete',
  ): Promise<void> {
    const rows = ranges.filter((range) => selected.has(range.id))
    const items = rows.map(({ id, version }) => ({ id, version }))
    if (items.length === 0) return Promise.resolve()
    return mutate(
      `bulk-${action}`,
      async () => {
        const response = await bulkMutateRanges({ action, items })
        if (response.data.action === 'delete') {
          const names = new Map(rows.map((range) => [range.id, range.name]))
          setDeleted(
            response.data.items.map((item) => ({ ...item, name: names.get(item.id) ?? 'Range' })),
          )
        }
        setSelected(new Set())
      },
      action === 'delete'
        ? `${items.length} range${items.length === 1 ? '' : 's'} deleted. You can undo this while this page stays open.`
        : `${items.length} range${items.length === 1 ? '' : 's'} updated atomically.`,
    )
  }

  if (status === 'loading')
    return (
      <p className="library-state" aria-busy="true">
        Loading your range library…
      </p>
    )
  if (status === 'error') {
    return (
      <section className="library-state" role="alert">
        <h1>We could not load your library</h1>
        <p>{error}</p>
        <button className="button button-primary" type="button" onClick={retry}>
          Try again
        </button>
      </section>
    )
  }

  const filtered = Boolean(query.search || query.favorite || query.archived === 'only')
  const selectedCount = ranges.filter((range) => selected.has(range.id)).length
  const bulkDisabled = selectedCount === 0 || pending !== undefined
  return (
    <section className="library" aria-labelledby="library-title">
      <div className="library-heading">
        <div>
          <p className="eyebrow">Range library</p>
          <h1 id="library-title">Your preflop playbook</h1>
          <p className="app-lede">
            Build the spots you want to train, then return here to keep them organized.
          </p>
        </div>
        <Link className="button button-primary" href="/app/library/new">
          New range
        </Link>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="success-notice" role="status">
          {notice}
        </p>
      ) : null}
      {deleted.length > 0 ? (
        <button
          className="text-link undo-button"
          type="button"
          disabled={pending !== undefined}
          onClick={() => void undoDelete()}
        >
          Undo delete of {describeDeleted(deleted)}
        </button>
      ) : null}
      <form
        className="library-filters"
        onSubmit={(event) => {
          event.preventDefault()
          updateQuery({ search: searchDraft.trim() || undefined })
        }}
      >
        <label className="field search-field">
          <span>Search ranges</span>
          <input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Name, note, or hand such as a5s"
            maxLength={100}
          />
        </label>
        <FilterSelect
          label="Status"
          value={query.archived ?? 'exclude'}
          onChange={(archived) =>
            updateQuery({ archived: archived as 'exclude' | 'include' | 'only' })
          }
          options={[
            ['exclude', 'Active'],
            ['include', 'Active + archived'],
            ['only', 'Archived only'],
          ]}
        />
        <FilterSelect
          label="Favorite"
          value={query.favorite === undefined ? 'all' : String(query.favorite)}
          onChange={(value) =>
            updateQuery({ favorite: value === 'all' ? undefined : value === 'true' })
          }
          options={[
            ['all', 'All ranges'],
            ['true', 'Favorites only'],
          ]}
        />
        <FilterSelect
          label="Game"
          value={query.gameType ?? 'all'}
          onChange={(value) =>
            updateQuery({
              gameType: value === 'all' ? undefined : (value as 'cash' | 'tournament' | 'sitAndGo'),
            })
          }
          options={[
            ['all', 'All games'],
            ['cash', GAME_TYPE_LABELS.cash],
            ['tournament', GAME_TYPE_LABELS.tournament],
            ['sitAndGo', GAME_TYPE_LABELS.sitAndGo],
          ]}
        />
        <FilterSelect
          label="Position"
          value={query.position ?? 'all'}
          onChange={(value) =>
            updateQuery({
              position: value === 'all' ? undefined : (value as (typeof POSITIONS)[number]),
            })
          }
          options={[['all', 'All positions'], ...positionOptions]}
        />
        <FilterSelect
          label="Sort"
          value={`${query.sort ?? 'displayOrder'}:${query.direction ?? 'asc'}`}
          onChange={(value) => {
            const [sort, direction] = value.split(':')
            updateQuery({
              sort: sort as NonNullable<RangeListOptions['sort']>,
              direction: direction as NonNullable<RangeListOptions['direction']>,
            })
          }}
          options={[
            ['displayOrder:asc', 'Library order'],
            ['updatedAt:desc', 'Recently updated'],
            ['createdAt:desc', 'Recently created'],
            ['name:asc', 'Name A–Z'],
            ['accuracy:asc', 'Lowest accuracy'],
            ['lastPracticedAt:desc', 'Recently practiced'],
          ]}
        />
        <button className="button button-small" type="submit">
          Apply
        </button>
        <button className="text-button" type="button" onClick={clearFilters}>
          Clear filters
        </button>
      </form>
      {ranges.length === 0 ? (
        <section className="empty-library">
          <h2>{filtered ? 'No ranges match these filters' : 'Your library is empty'}</h2>
          <p>
            {filtered
              ? 'Clear a filter or try a different search.'
              : 'Create your first range from the hand grid. Nothing is pre-filled for you.'}
          </p>
          {filtered ? (
            <button className="text-link" type="button" onClick={clearFilters}>
              Clear filters
            </button>
          ) : (
            <Link className="button button-primary" href="/app/library/new">
              Create a range
            </Link>
          )}
        </section>
      ) : (
        <>
          <div className="bulk-bar" aria-label="Selected range actions">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={ranges.length > 0 && selectedCount === ranges.length}
                onChange={(event) =>
                  setSelected(
                    event.target.checked ? new Set(ranges.map((range) => range.id)) : new Set(),
                  )
                }
              />{' '}
              Select page
            </label>
            <span>{selectedCount} selected</span>
            <button
              className="text-button"
              type="button"
              disabled={bulkDisabled}
              onClick={() => void bulk('favorite')}
            >
              Favorite selected
            </button>
            <button
              className="text-button"
              type="button"
              disabled={bulkDisabled}
              onClick={() => void bulk('archive')}
            >
              Archive selected
            </button>
            <button
              className="text-button"
              type="button"
              disabled={bulkDisabled}
              onClick={() => void bulk('unarchive')}
            >
              Unarchive selected
            </button>
            <button
              className="text-button"
              type="button"
              disabled={bulkDisabled}
              onClick={() => void bulk('unfavorite')}
            >
              Unfavorite selected
            </button>
            <button
              className="text-button danger-button"
              type="button"
              disabled={bulkDisabled}
              onClick={() => void bulk('delete')}
            >
              Delete selected
            </button>
          </div>
          <ul className="range-list" aria-label="Saved ranges">
            {ranges.map((range) => (
              <RangeRow
                key={range.id}
                range={range}
                selected={selected.has(range.id)}
                pending={pending !== undefined}
                onSelect={(checked) =>
                  setSelected((current) => {
                    const next = new Set(current)
                    if (checked) next.add(range.id)
                    else next.delete(range.id)
                    return next
                  })
                }
                onFavorite={() =>
                  void mutate(
                    `favorite-${range.id}`,
                    async () => {
                      await setRangeFavorite(range.id, range.version, !range.favorite)
                    },
                    range.favorite ? 'Removed from favorites.' : 'Added to favorites.',
                  )
                }
                onArchive={() =>
                  void mutate(
                    `archive-${range.id}`,
                    async () => {
                      await setRangeArchived(range.id, range.version, !range.archived)
                    },
                    range.archived ? 'Range restored to active library.' : 'Range archived.',
                  )
                }
                onDuplicate={() =>
                  void mutate(
                    `duplicate-${range.id}`,
                    async () => {
                      await duplicateRange(range.id, { version: range.version })
                    },
                    'Range duplicated.',
                  )
                }
                onDelete={() => void deleteOne(range)}
              />
            ))}
          </ul>
          <nav className="pagination" aria-label="Library pages">
            <button
              className="text-button"
              type="button"
              disabled={meta.page <= 1 || pending !== undefined}
              onClick={() => updateQuery({ page: meta.page - 1 })}
            >
              Previous
            </button>
            <span>
              Page {meta.page} of {Math.max(1, meta.totalPages)} · {meta.totalItems} total
            </span>
            <button
              className="text-button"
              type="button"
              disabled={meta.page >= meta.totalPages || pending !== undefined}
              onClick={() => updateQuery({ page: meta.page + 1 })}
            >
              Next
            </button>
          </nav>
        </>
      )}
    </section>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly (readonly [string, string])[]
}) {
  return (
    <label className="field filter-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </select>
    </label>
  )
}

function RangeRow({
  range,
  selected,
  pending,
  onSelect,
  onFavorite,
  onArchive,
  onDuplicate,
  onDelete,
}: {
  range: RangeListItem
  selected: boolean
  pending: boolean
  onSelect: (selected: boolean) => void
  onFavorite: () => void
  onArchive: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const metadata = metadataSummary(range)
  return (
    <li className={`range-row${range.archived ? ' is-archived' : ''}`}>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onSelect(event.target.checked)}
          aria-label={`Select ${range.name}`}
        />{' '}
        Select
      </label>
      <div className="range-row-main">
        <div className="range-row-title">
          <Link href={`/app/library/${encodeURIComponent(range.id)}`}>{range.name}</Link>
          {range.favorite ? <span aria-label="Favorite">★</span> : null}
          {range.archived ? <span className="status-chip">Archived</span> : null}
        </div>
        {metadata ? <p className="range-meta">{metadata}</p> : null}
        <p className="range-stats">
          {range.handCount} hand classes · {range.comboCount} combos ·{' '}
          {range.rangePercentage.toFixed(1)}%
        </p>
      </div>
      <div className="range-actions" aria-label={`Manage ${range.name}`}>
        <button className="text-button" type="button" disabled={pending} onClick={onFavorite}>
          {range.favorite ? 'Unfavorite' : 'Favorite'}
        </button>
        <button className="text-button" type="button" disabled={pending} onClick={onArchive}>
          {range.archived ? 'Unarchive' : 'Archive'}
        </button>
        <button className="text-button" type="button" disabled={pending} onClick={onDuplicate}>
          Duplicate
        </button>
        <button
          className="text-button danger-button"
          type="button"
          disabled={pending}
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </li>
  )
}
