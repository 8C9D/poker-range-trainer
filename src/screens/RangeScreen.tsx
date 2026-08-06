import { useEffect, useRef, useState } from 'react'
import { createRangeId } from '../app/ids'
import { navigate, routeHash, RANGE_TABS, type RangeTab } from '../app/routes'
import { RangePerformance } from '../components/RangePerformance'
import type { PokerHand } from '../domain/pokerHands'
import { handsWithMistakes } from '../domain/practice'
import { setRangeArchived } from '../domain/rangeArchive'
import { duplicateRange } from '../domain/rangeDuplication'
import { setRangeFavorite } from '../domain/rangeFavorite'
import { calculateRangePercentage, countSelectedCombos } from '../domain/rangeMath'

import { accuracyPercentage } from '../domain/accuracy'
import { formatDayDistance } from '../app/format'
import { loadHandAccuracy } from '../storage/handAccuracyStorage'
import { loadReviewStates } from '../storage/reviewStateStorage'
import { loadSessionHistory } from '../storage/sessionHistoryStorage'
import { findSavedRangeById, saveSavedRange } from '../storage/rangeStorage'
import { deleteRangesWithRecords, rememberDeletedRanges } from '../storage/rangeRemoval'
import {
  ACTION_TYPE_LABELS,
  GAME_TYPE_LABELS,
  POSITION_LABELS,
  TABLE_SIZE_LABELS,
  type SavedRange,
} from '../types/range'
import { RangeEditTab } from './RangeEditTab'
import './RangeScreen.css'

const TAB_LABELS: Record<RangeTab, string> = {
  overview: 'Overview',
  edit: 'Edit',
  stats: 'Stats',
}

interface RangeScreenProps {
  /** The saved range id, or null when composing a new range. */
  id: string | null
  tab: RangeTab
  /** Launch practice for the range, optionally restricted to a hand pool. */
  onPractice: (range: SavedRange, handPool?: PokerHand[]) => void
}

/**
 * The per-range page: header (back, name, chips, Practice, overflow menu) and
 * the Overview / Edit / Stats tabs. All mutations persist immediately and
 * refresh the local copy from storage.
 */
export function RangeScreen({ id, tab, onPractice }: RangeScreenProps) {
  const [range, setRange] = useState<SavedRange | null>(() =>
    id ? (findSavedRangeById(id) ?? null) : null,
  )
  const [menuOpen, setMenuOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<HTMLElement>(null)

  // The tab strip scrolls sideways once the tabs stop fitting. Only a tap on a
  // visible tab scrolls it; arriving any other way (a deep link, back/forward,
  // a redirect after saving) leaves the strip at the start with the current tab
  // off its right edge — so the screen shows a row of tabs with none of them
  // marked, and no hint that it scrolls.
  useEffect(() => {
    const active = tabsRef.current?.querySelector('[aria-current="page"]')
    // `nearest` keeps a tab that is already visible exactly where it is, and
    // never scrolls the page vertically to reach it.
    active?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [tab])

  // While the overflow menu is open, let Escape close it (returning focus to the
  // trigger) and dismiss it on any click outside the menu or its button.
  useEffect(() => {
    if (!menuOpen) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        menuButtonRef.current?.focus()
      }
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (!menuRef.current?.contains(target) && !menuButtonRef.current?.contains(target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [menuOpen])

  function refresh() {
    if (id) setRange(findSavedRangeById(id) ?? null)
  }

  // --- New-range mode: just the editor, saving navigates to the new page. ---
  if (id === null) {
    return (
      <div className="range-screen">
        <header className="range-screen-header">
          <a className="range-screen-back" href={routeHash({ screen: 'library' })}>
            ← Library
          </a>
        </header>
        <h1 className="range-screen-title">New range</h1>
        <RangeEditTab
          range={null}
          onSaved={(saved) => navigate({ screen: 'range', id: saved.id, tab: 'overview' })}
        />
      </div>
    )
  }

  if (!range) {
    return (
      <div className="range-screen">
        <header className="range-screen-header">
          <a className="range-screen-back" href={routeHash({ screen: 'library' })}>
            ← Library
          </a>
        </header>
        <p>This range does not exist (it may have been deleted).</p>
      </div>
    )
  }

  const meta = range.metadata
  const chips: string[] = []
  if (meta?.gameType) chips.push(GAME_TYPE_LABELS[meta.gameType])
  if (meta?.tableSize) chips.push(TABLE_SIZE_LABELS[meta.tableSize])
  if (meta?.stackDepthBb !== undefined) chips.push(`${meta.stackDepthBb}bb`)
  if (meta?.position && meta?.versusPosition) {
    chips.push(`${POSITION_LABELS[meta.position]} vs ${POSITION_LABELS[meta.versusPosition]}`)
  } else if (meta?.position) {
    chips.push(POSITION_LABELS[meta.position])
  } else if (meta?.versusPosition) {
    chips.push(`vs ${POSITION_LABELS[meta.versusPosition]}`)
  }
  if (meta?.actionType) chips.push(ACTION_TYPE_LABELS[meta.actionType])
  if (range.favorite) chips.push('★ Favorite')
  if (range.archived) chips.push('Archived')

  function menuAction(action: () => void) {
    return () => {
      setMenuOpen(false)
      action()
    }
  }

  /**
   * Run a storage write, reporting a failure instead of losing it. The menu's
   * actions persist from a click handler, where a throw from a full or blocked
   * store escapes to nothing — the menu item just appears dead. Returns whether
   * the write landed, so callers only navigate or refresh when it did.
   */
  function persist(write: () => void): boolean {
    try {
      write()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not save that change.')
      return false
    }
    setActionError(null)
    return true
  }

  const visibleTabs = RANGE_TABS

  return (
    <div className="range-screen">
      <header className="range-screen-header">
        <a className="range-screen-back" href={routeHash({ screen: 'library' })}>
          ← Library
        </a>
        <div className="range-screen-header-actions">
          <button
            type="button"
            className="coach-btn primary"
            onClick={() => onPractice(range)}
          >
            Practice
          </button>
          <button
            ref={menuButtonRef}
            type="button"
            className="coach-btn range-screen-menu-button"
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            ⋯
          </button>
        </div>
      </header>

      {menuOpen && (
        <div ref={menuRef} className="coach-card range-screen-menu" role="menu" aria-label="Range actions">
          <button
            type="button"
            role="menuitem"
            onClick={menuAction(() => {
              const copy = duplicateRange(range, createRangeId(), new Date().toISOString())
              if (!persist(() => saveSavedRange(copy))) return
              navigate({ screen: 'range', id: copy.id, tab: 'overview' })
            })}
          >
            Duplicate
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={menuAction(() => {
              if (!persist(() => saveSavedRange(setRangeFavorite(range, !range.favorite)))) return
              refresh()
            })}
          >
            {range.favorite ? 'Unfavorite' : 'Favorite'}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={menuAction(() => {
              if (!persist(() => saveSavedRange(setRangeArchived(range, !range.archived)))) return
              refresh()
            })}
          >
            {range.archived ? 'Unarchive' : 'Archive'}
          </button>
          <button
            type="button"
            role="menuitem"
            className="range-screen-menu-danger"
            onClick={menuAction(() => {
              if (
                !window.confirm(
                  `Delete "${range.name}", and everything recorded about it?`,
                )
              ) {
                return
              }
              // The Library is where the undo is offered, so hand the delete
              // over before navigating there.
              if (!persist(() => rememberDeletedRanges(deleteRangesWithRecords([range.id])))) {
                return
              }
              navigate({ screen: 'library' })
            })}
          >
            Delete
          </button>
        </div>
      )}

      <h1 className="range-screen-title">{range.name}</h1>
      {chips.length > 0 && (
        <div className="range-screen-chips">
          {chips.map((chip) => (
            <span key={chip} className="coach-chip">
              {chip}
            </span>
          ))}
        </div>
      )}
      {actionError && (
        <p className="range-screen-error" role="alert">
          {actionError}
        </p>
      )}

      <nav className="coach-seg range-screen-tabs" aria-label="Range sections" ref={tabsRef}>
        {visibleTabs.map((tabKey) => (
          <a
            key={tabKey}
            href={routeHash({ screen: 'range', id: range.id, tab: tabKey })}
            aria-current={tab === tabKey ? 'page' : undefined}
          >
            {TAB_LABELS[tabKey]}
          </a>
        ))}
      </nav>

      {tab === 'overview' && <OverviewTab range={range} />}
      {tab === 'edit' && <RangeEditTab range={range} onSaved={refresh} />}
      {tab === 'stats' && (
        <StatsTab
          range={range}
          onPracticeMistakes={(pool) => onPractice(range, pool)}
          onClose={() => navigate({ screen: 'range', id: range.id, tab: 'overview' })}
        />
      )}
    </div>
  )
}

function OverviewTab({ range }: { range: SavedRange }) {
  const [history] = useState(() => loadSessionHistory()[range.id] ?? [])
  const [reviewState] = useState(() => loadReviewStates()[range.id])
  const [nowIso] = useState(() => new Date().toISOString())

  // Hand-class model only: saved per-combo selections are ignored here, so a
  // range whose AA is narrowed to one combo still counts all six.
  const combos = countSelectedCombos(range.hands)
  const percentage = calculateRangePercentage(range.hands)
  const lastSession = history.length > 0 ? history[history.length - 1] : null
  const recentSessions = history.slice(-5).reverse()

  return (
    <div className="range-overview">
      <section className="coach-card range-overview-grid" aria-label="Range facts">
        <div className="range-overview-facts coach-tabular">
          <p>
            {range.hands.length} hand{range.hands.length === 1 ? '' : 's'} · {combos} combos ·{' '}
            {percentage.toFixed(1)}% of all hands
          </p>
          <p>
            Next review:{' '}
            {reviewState && reviewState.dueAt
              ? new Date(reviewState.dueAt).toLocaleDateString()
              : 'not scheduled yet'}
          </p>
          <p>
            Last session:{' '}
            {lastSession
              ? `${accuracyPercentage(lastSession.correctAnswers, lastSession.totalQuestions).toFixed(0)}% · ${formatDayDistance(lastSession.playedAt, nowIso)}`
              : 'none yet'}
          </p>
          {range.metadata?.notes && <p className="range-overview-notes">{range.metadata.notes}</p>}
        </div>
      </section>

      {recentSessions.length > 0 && (
        <section className="coach-card" aria-label="Recent sessions">
          <h2>Recent sessions</h2>
          <ul className="range-overview-sessions coach-tabular">
            {recentSessions.map((session) => (
              <li key={session.playedAt}>
                <span>{new Date(session.playedAt).toLocaleDateString()}</span>
                <span>
                  {session.correctAnswers}/{session.totalQuestions} ·{' '}
                  {accuracyPercentage(session.correctAnswers, session.totalQuestions).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function StatsTab({
  range,
  onPracticeMistakes,
  onClose,
}: {
  range: SavedRange
  onPracticeMistakes: (pool: PokerHand[]) => void
  onClose: () => void
}) {
  const [handAccuracy] = useState(() => loadHandAccuracy()[range.id] ?? {})
  const [history] = useState(() => loadSessionHistory()[range.id] ?? [])

  return (
    <RangePerformance
      range={range}
      accuracy={handAccuracy}
      history={history}
      onClose={onClose}
      onPracticeMistakes={() => {
        const pool = handsWithMistakes(handAccuracy)
        if (pool.length === 0) return
        onPracticeMistakes(pool)
      }}
    />
  )
}
