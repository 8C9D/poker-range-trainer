import { useEffect, useRef, useState } from 'react'
import {
  copyRangeShareLink,
  exportRangeCsvFile,
  exportRangeJsonFile,
  exportRangeSvgFile,
} from '../app/rangeFiles'
import { createRangeId } from '../app/ids'
import { navigate, routeHash, RANGE_TABS, type RangeTab } from '../app/routes'
import { ActionNotation } from '../components/ActionNotation'
import { ComboSelector } from '../components/ComboSelector'
import { MixedNotation } from '../components/MixedNotation'
import { MixedStrategyEditor } from '../components/MixedStrategyEditor'
import { MixedStrategyGrid } from '../components/MixedStrategyGrid'
import { MultiActionEditor } from '../components/MultiActionEditor'
import { RangeDiffView } from '../components/RangeDiffView'
import { RangePerformance } from '../components/RangePerformance'
import { RangeThumbnail } from '../components/RangeThumbnail'
import { useAuthSession } from '../cloud/useAuthSession'
import { publishSharedRange, unpublishSharedRange } from '../cloud/sharedRangesRepo'
import type { Card } from '../domain/cards'
import {
  allCombosForHand,
  deserializeComboSelection,
  serializeComboSelection,
  toggleCombo,
  type ComboSelection,
} from '../domain/comboSelection'
import type { HandMixedStrategy } from '../domain/mixedStrategy'
import type { PokerHand } from '../domain/pokerHands'
import { handsWithMistakes } from '../domain/practice'
import { setRangeArchived } from '../domain/rangeArchive'
import { duplicateRange } from '../domain/rangeDuplication'
import { setRangeFavorite } from '../domain/rangeFavorite'
import { calculateRangePercentage, countSelectedCombos } from '../domain/rangeMath'
import { accuracyPercentage } from '../domain/accuracy'
import { formatDayDistance } from '../app/format'
import { loadActionAccuracy } from '../storage/actionAccuracyStorage'
import { loadHandAccuracy } from '../storage/handAccuracyStorage'
import { loadReviewStates } from '../storage/reviewStateStorage'
import { loadSessionHistory } from '../storage/sessionHistoryStorage'
import { deleteSavedRange, findSavedRangeById, loadSavedRanges, saveSavedRange } from '../storage/rangeStorage'
import {
  ACTION_TYPE_LABELS,
  GAME_TYPE_LABELS,
  POSITION_LABELS,
  RANGE_SOURCE_KIND_LABELS,
  TABLE_SIZE_LABELS,
  type RangeAction,
  type RangeMetadata,
  type SavedRange,
} from '../types/range'
import { RangeEditTab } from './RangeEditTab'
import './RangeScreen.css'

const TAB_LABELS: Record<RangeTab, string> = {
  overview: 'Overview',
  edit: 'Edit',
  actions: 'Actions',
  combos: 'Combos',
  frequencies: 'Frequencies',
  stats: 'Stats',
}

interface RangeScreenProps {
  /** The saved range id, or null when composing a new range. */
  id: string | null
  tab: RangeTab
  /** Scenario metadata to start a new range from; only used when `id` is null. */
  prefill?: RangeMetadata
  /** Launch practice for the range, optionally restricted to a hand pool. */
  onPractice: (range: SavedRange, handPool?: PokerHand[]) => void
}

/**
 * The per-range page: header (back, name, chips, Practice, overflow menu) and
 * the Overview / Edit / Actions / Combos / Frequencies / Stats tabs. All
 * mutations persist immediately and refresh the local copy from storage.
 */
export function RangeScreen({ id, tab, prefill, onPractice }: RangeScreenProps) {
  const auth = useAuthSession()
  const [range, setRange] = useState<SavedRange | null>(() =>
    id ? (findSavedRangeById(id) ?? null) : null,
  )
  const [menuOpen, setMenuOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareOtherId, setCompareOtherId] = useState('')
  // Cloud share status line + ids published this session (enables Unpublish).
  const [shareStatus, setShareStatus] = useState('')
  const [publishedShareId, setPublishedShareId] = useState<string | null>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

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
          prefill={prefill}
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

  async function handlePublish() {
    if (!range) return
    // OK = public (anyone with the link); Cancel = private (link carries a token).
    const isPublic = window.confirm(
      `Publish "${range.name}" as a shareable link?\n\nOK = public (anyone with the link can view)\nCancel = private (link includes a secret token)`,
    )
    setShareStatus('Publishing…')
    try {
      const { id: shareId, token } = await publishSharedRange(range, isPublic)
      setPublishedShareId(shareId)
      const base = `${window.location.origin}${window.location.pathname}#/r/${shareId}`
      const link = token ? `${base}?t=${token}` : base
      try {
        await navigator.clipboard.writeText(link)
        setShareStatus('Share link copied to clipboard.')
      } catch {
        window.prompt('Copy this share link:', link)
        setShareStatus('Share link ready.')
      }
    } catch (error) {
      setShareStatus(error instanceof Error ? error.message : 'Publish failed.')
    }
  }

  async function handleUnpublish() {
    if (!publishedShareId) return
    setShareStatus('Unpublishing…')
    try {
      await unpublishSharedRange(publishedShareId)
      setPublishedShareId(null)
      setShareStatus('Shared link unpublished.')
    } catch (error) {
      setShareStatus(error instanceof Error ? error.message : 'Unpublish failed.')
    }
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
              saveSavedRange(copy)
              navigate({ screen: 'range', id: copy.id, tab: 'overview' })
            })}
          >
            Duplicate
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={menuAction(() => {
              saveSavedRange(setRangeFavorite(range, !range.favorite))
              refresh()
            })}
          >
            {range.favorite ? 'Unfavorite' : 'Favorite'}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={menuAction(() => {
              saveSavedRange(setRangeArchived(range, !range.archived))
              refresh()
            })}
          >
            {range.archived ? 'Unarchive' : 'Archive'}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={menuAction(() => {
              setCompareOpen(true)
              setCompareOtherId('')
            })}
          >
            Compare…
          </button>
          <button type="button" role="menuitem" onClick={menuAction(() => exportRangeJsonFile(range))}>
            Export JSON
          </button>
          <button type="button" role="menuitem" onClick={menuAction(() => exportRangeCsvFile(range))}>
            Export CSV
          </button>
          <button type="button" role="menuitem" onClick={menuAction(() => exportRangeSvgFile(range))}>
            Export SVG
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={menuAction(() => void copyRangeShareLink(range))}
          >
            Copy share link
          </button>
          {auth.session && (
            <button type="button" role="menuitem" onClick={menuAction(() => void handlePublish())}>
              Publish link
            </button>
          )}
          {auth.session && publishedShareId && (
            <button
              type="button"
              role="menuitem"
              onClick={menuAction(() => void handleUnpublish())}
            >
              Unpublish link
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="range-screen-menu-danger"
            onClick={menuAction(() => {
              if (!window.confirm(`Delete "${range.name}"? This cannot be undone.`)) return
              deleteSavedRange(range.id)
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
      {shareStatus && (
        <p className="range-screen-status" role="status">
          {shareStatus}
        </p>
      )}

      {compareOpen ? (
        <ComparePanel
          range={range}
          otherId={compareOtherId}
          onPickOther={setCompareOtherId}
          onClose={() => setCompareOpen(false)}
        />
      ) : (
        <>
          <nav className="coach-seg range-screen-tabs" aria-label="Range sections">
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
          {tab === 'actions' && <ActionsTab range={range} onSaved={refresh} />}
          {tab === 'combos' && <CombosTab range={range} onSaved={refresh} />}
          {tab === 'frequencies' && <FrequenciesTab range={range} onSaved={refresh} />}
          {tab === 'stats' && (
            <StatsTab
              range={range}
              onPracticeMistakes={(pool) => onPractice(range, pool)}
              onClose={() => navigate({ screen: 'range', id: range.id, tab: 'overview' })}
            />
          )}
        </>
      )}
    </div>
  )
}

function OverviewTab({ range }: { range: SavedRange }) {
  const [history] = useState(() => loadSessionHistory()[range.id] ?? [])
  const [reviewState] = useState(() => loadReviewStates()[range.id])
  const [nowIso] = useState(() => new Date().toISOString())

  const combos = countSelectedCombos(range.hands)
  const percentage = calculateRangePercentage(range.hands)
  const lastSession = history.length > 0 ? history[history.length - 1] : null
  const recentSessions = history.slice(-5).reverse()
  const handNoteCount = Object.keys(range.handNotes ?? {}).length

  return (
    <div className="range-overview">
      <section className="coach-card range-overview-grid" aria-label="Range preview">
        <RangeThumbnail hands={range.hands} size={280} />
        <div className="range-overview-facts coach-tabular">
          <p>
            {range.hands.length} hands · {combos} combos · {percentage.toFixed(1)}% of all hands
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
          {range.source && (
            <p>
              Source: {RANGE_SOURCE_KIND_LABELS[range.source.kind]}
              {range.source.reference ? ` · ${range.source.reference}` : ''}
            </p>
          )}
          {handNoteCount > 0 && (
            <p>
              {handNoteCount} hand note{handNoteCount === 1 ? '' : 's'}
            </p>
          )}
        </div>
      </section>

      {recentSessions.length > 0 && (
        <section className="coach-card" aria-label="Recent sessions">
          <h3>Recent sessions</h3>
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

function ActionsTab({ range, onSaved }: { range: SavedRange; onSaved: () => void }) {
  const [draft, setDraft] = useState<Record<PokerHand, RangeAction>>({
    ...(range.handActions ?? {}),
  })
  const [saved, setSaved] = useState(false)
  return (
    <div className="range-tab-stack">
      <div className="range-tab-actions">
        <button
          type="button"
          className="coach-btn"
          onClick={() => {
            saveSavedRange({ ...range, handActions: draft, updatedAt: new Date().toISOString() })
            onSaved()
            setSaved(true)
          }}
        >
          Save actions
        </button>
        {saved && (
          <p className="range-screen-status" role="status">
            Actions saved.
          </p>
        )}
      </div>
      <MultiActionEditor
        handActions={draft}
        onSetHandAction={(hand, action) => {
          setSaved(false)
          setDraft((prev) => ({ ...prev, [hand]: action }))
        }}
      />
      <ActionNotation
        handActions={draft}
        onReplaceActions={(next) => {
          setSaved(false)
          setDraft(next)
        }}
      />
    </div>
  )
}

function CombosTab({ range, onSaved }: { range: SavedRange; onSaved: () => void }) {
  const [draft, setDraft] = useState<Record<PokerHand, ComboSelection>>(() => {
    const initial: Record<PokerHand, ComboSelection> = {}
    for (const hand of range.hands) {
      const saved = range.comboSelections?.[hand]
      initial[hand] = saved ? deserializeComboSelection(saved) : allCombosForHand(hand)
    }
    return initial
  })
  const [saved, setSaved] = useState(false)

  function setDraftCombo(hand: PokerHand, combo: Card[]) {
    setSaved(false)
    setDraft((prev) => ({
      ...prev,
      [hand]: toggleCombo(prev[hand] ?? allCombosForHand(hand), combo),
    }))
  }

  function handleSave() {
    // Persist only hand classes that are NOT fully selected, so an all-on range
    // stays without the field (absence = all combos selected, the default).
    const comboSelections: Record<PokerHand, string[]> = {}
    for (const hand of range.hands) {
      const selection = draft[hand] ?? allCombosForHand(hand)
      const full = allCombosForHand(hand).size
      if (selection.size < full) {
        comboSelections[hand] = serializeComboSelection(selection)
      }
    }
    saveSavedRange({
      ...range,
      comboSelections: Object.keys(comboSelections).length > 0 ? comboSelections : undefined,
      updatedAt: new Date().toISOString(),
    })
    onSaved()
    setSaved(true)
  }

  return (
    <div className="range-tab-stack">
      <div className="range-tab-actions">
        <button type="button" className="coach-btn" onClick={handleSave}>
          Save combos
        </button>
        {saved && (
          <p className="range-screen-status" role="status">
            Combos saved.
          </p>
        )}
      </div>
      {range.hands.map((hand) => (
        <div key={hand} className="coach-card range-combo-hand">
          <h3>{hand}</h3>
          <ComboSelector
            hand={hand}
            selection={draft[hand] ?? allCombosForHand(hand)}
            onToggle={(combo) => setDraftCombo(hand, combo)}
          />
        </div>
      ))}
    </div>
  )
}

function FrequenciesTab({ range, onSaved }: { range: SavedRange; onSaved: () => void }) {
  const [draft, setDraft] = useState<Record<PokerHand, HandMixedStrategy>>({
    ...(range.mixedStrategies ?? {}),
  })
  const [activeHand, setActiveHand] = useState<PokerHand | null>(range.hands[0] ?? null)
  const [saved, setSaved] = useState(false)

  return (
    <div className="range-tab-stack">
      <div className="range-tab-actions">
        <button
          type="button"
          className="coach-btn"
          onClick={() => {
            saveSavedRange({
              ...range,
              mixedStrategies: draft,
              updatedAt: new Date().toISOString(),
            })
            onSaved()
            setSaved(true)
          }}
        >
          Save frequencies
        </button>
        {saved && (
          <p className="range-screen-status" role="status">
            Frequencies saved.
          </p>
        )}
      </div>
      <MixedStrategyGrid mixedStrategies={draft} />
      <label className="range-freq-hand">
        Hand
        <select
          className="coach-input"
          value={activeHand ?? ''}
          onChange={(event) => setActiveHand(event.target.value as PokerHand)}
        >
          {range.hands.map((hand) => (
            <option key={hand} value={hand}>
              {hand}
            </option>
          ))}
        </select>
      </label>
      {activeHand && (
        <MixedStrategyEditor
          strategy={draft[activeHand] ?? []}
          onChange={(next) => {
            setSaved(false)
            setDraft((prev) => ({ ...prev, [activeHand]: next }))
          }}
        />
      )}
      <MixedNotation
        mixedStrategies={draft}
        onReplace={(next) => {
          setSaved(false)
          setDraft(next)
          setActiveHand(range.hands[0] ?? null)
        }}
      />
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
  const [actionAccuracy] = useState(() => loadActionAccuracy()[range.id] ?? {})

  return (
    <RangePerformance
      range={range}
      accuracy={handAccuracy}
      history={history}
      actionAccuracy={actionAccuracy}
      onClose={onClose}
      onPracticeMistakes={() => {
        const pool = handsWithMistakes(handAccuracy)
        if (pool.length === 0) return
        onPracticeMistakes(pool)
      }}
    />
  )
}

function ComparePanel({
  range,
  otherId,
  onPickOther,
  onClose,
}: {
  range: SavedRange
  otherId: string
  onPickOther: (id: string) => void
  onClose: () => void
}) {
  const [others] = useState(() => loadSavedRanges().filter((r) => r.id !== range.id))
  const other = others.find((r) => r.id === otherId) ?? null
  return (
    <section className="coach-card range-compare" aria-label="Range comparison">
      <div className="range-compare-bar">
        <label className="range-freq-hand">
          Compare with
          <select
            className="coach-input"
            value={otherId}
            onChange={(event) => onPickOther(event.target.value)}
          >
            <option value="">Select a range…</option>
            {others.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="coach-btn quiet" onClick={onClose}>
          Close comparison
        </button>
      </div>
      {other ? (
        <RangeDiffView
          handsA={range.hands}
          handsB={other.hands}
          labelA={range.name}
          labelB={other.name}
        />
      ) : (
        <p className="range-compare-hint">Pick a range to compare against.</p>
      )}
    </section>
  )
}
