import { useState } from 'react'
import { ActionNotation } from './components/ActionNotation'
import { AuthPanel } from './components/AuthPanel'
import { ActionQuiz } from './components/ActionQuiz'
import { MixedActionQuiz } from './components/MixedActionQuiz'
import { MixedNotation } from './components/MixedNotation'
import { RangeDiffView } from './components/RangeDiffView'
import { handsWithMixedStrategy } from './domain/mixedStrategy'
import { BuildFromMemoryPractice } from './components/BuildFromMemoryPractice'
import { DueToday } from './components/DueToday'
import { GettingStarted } from './components/GettingStarted'
import { LibraryAnalytics } from './components/LibraryAnalytics'
import { HandGrid } from './components/HandGrid'
import { HandNotesEditor } from './components/HandNotesEditor'
import { MultiActionEditor } from './components/MultiActionEditor'
import { PracticeSession } from './components/PracticeSession'
import { TimedDrillSession } from './components/TimedDrillSession'
import { WeaknessFocusedDrill } from './components/WeaknessFocusedDrill'
import { RangeLibrary } from './components/RangeLibrary'
import { RangeMetadataEditor } from './components/RangeMetadataEditor'
import { RangeNotation } from './components/RangeNotation'
import { RangePerformance } from './components/RangePerformance'
import { RangeVsBoard } from './components/RangeVsBoard'
import { ComboBlockerDrill } from './components/ComboBlockerDrill'
import { ComboSelector } from './components/ComboSelector'
import { MixedStrategyGrid } from './components/MixedStrategyGrid'
import { MixedStrategyEditor } from './components/MixedStrategyEditor'
import type { HandMixedStrategy } from './domain/mixedStrategy'
import {
  allCombosForHand,
  deserializeComboSelection,
  selectionForRange,
  serializeComboSelection,
  toggleCombo,
  type ComboSelection,
} from './domain/comboSelection'
import type { Card } from './domain/cards'
import { PostflopDrillSetup } from './components/PostflopDrillSetup'
import { PostflopPractice } from './components/PostflopPractice'
import type { PostflopScenario } from './domain/postflopScenario'
import { RangeShortcuts } from './components/RangeShortcuts'
import { SharedRangePage } from './components/SharedRangePage'
import { SharedPackPage } from './components/SharedPackPage'
import { parsePackShareRoute, parseShareRoute } from './domain/shareRoute'
import { summarizeLibraryAnalytics } from './domain/libraryAnalytics'
import { assignedHands, summarizeActionAccuracy } from './domain/actionRange'
import { setRangeArchived } from './domain/rangeArchive'
import { duplicateRange } from './domain/rangeDuplication'
import { setRangeFavorite } from './domain/rangeFavorite'
import { handsWithMistakes } from './domain/practice'
import { currentStreak, selectDueRanges } from './domain/spacedRepetition'
import { calculateRangePercentage, countSelectedCombos } from './domain/rangeMath'
import { mergeShortcutHands } from './domain/rangeShortcuts'
import type { PokerHand } from './domain/pokerHands'
import { loadActionAccuracy, recordActionAccuracy } from './storage/actionAccuracyStorage'
import { loadHandAccuracy } from './storage/handAccuracyStorage'
import { loadPracticeStats } from './storage/practiceStatsStorage'
import { loadReviewStates } from './storage/reviewStateStorage'
import { loadSessionHistory } from './storage/sessionHistoryStorage'
import { deleteSavedRange, loadSavedRanges, saveSavedRange } from './storage/rangeStorage'
import { deleteBackup, pullBackup, pushBackup } from './cloud/backupRepo'
import { publishSharedRange, unpublishSharedRange } from './cloud/sharedRangesRepo'
import { publishSharedPack, unpublishSharedPack } from './cloud/sharedPacksRepo'
import { buildBackup, parseBackup, restoreBackup, serializeBackup } from './storage/backup'
import { useAuthSession } from './cloud/useAuthSession'
import {
  buildRangePack,
  decodeRangeFromHash,
  encodeRangeToHash,
  formatRangeCsv,
  formatRangeSvg,
  parseRangeCsv,
  parseRangeExport,
  parseRangePack,
  serializeRangeExport,
  serializeRangePack,
} from './domain/rangeTransfer'
import { AppShell } from './app/AppShell'
import { useHashRoute } from './app/routes'
import { recordFinishedPracticeSession } from './app/sessionRecording'
import { TodayScreen } from './screens/TodayScreen'
import type { ActionAttempt, PracticeAttempt } from './types/practice'
import type {
  ActionType,
  GameType,
  Position,
  RangeAction,
  RangeMetadata,
  RangeSource,
  RangeSourceKind,
  SavedRange,
  TableSize,
} from './types/range'
import './App.css'

/** Best-effort unique id for a newly created range, with a fallback for older runtimes. */
function createRangeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `range-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Import a range shared via a `#range=<hash>` link into local storage once, at
 * module load, then clear the hash so a refresh won't re-import. Doing this
 * before React renders lets the normal `loadSavedRanges()` initializer pick it
 * up without a synchronous setState in an effect. No-op when there's no hash.
 */
function importSharedRangeFromHash() {
  if (typeof window === 'undefined') return
  const match = /^#range=(.+)$/.exec(window.location.hash)
  if (!match) return
  try {
    const shared = decodeRangeFromHash(match[1])
    const now = new Date().toISOString()
    saveSavedRange({ ...shared, id: createRangeId(), createdAt: now, updatedAt: now })
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Could not open shared range.')
  }
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
}

importSharedRangeFromHash()

function App() {
  // A `#/r/:id` share link shows the read-only shared page instead of the app.
  // Parsed once at render; visiting a share link is a fresh page load.
  const shareRoute = typeof window !== 'undefined' ? parseShareRoute(window.location.hash) : null
  if (shareRoute) {
    return (
      <SharedRangePage
        id={shareRoute.id}
        token={shareRoute.token}
        onForkRange={(range) => {
          // Fork: save the shared range into the local library as a new range.
          const now = new Date().toISOString()
          saveSavedRange({ ...range, id: createRangeId(), createdAt: now, updatedAt: now })
        }}
      />
    )
  }

  // A `#/p/:id` link shows the read-only shared PACK page (bundle of ranges).
  const packRoute =
    typeof window !== 'undefined' ? parsePackShareRoute(window.location.hash) : null
  if (packRoute) {
    return (
      <SharedPackPage
        id={packRoute.id}
        token={packRoute.token}
        onForkPack={(pack) => {
          // Fork: save every range in the pack locally as a NEW range, minting a
          // fresh id for each so a shared id never clobbers an existing range.
          const now = new Date().toISOString()
          for (const range of pack.ranges) {
            saveSavedRange({ ...range, id: createRangeId(), createdAt: now, updatedAt: now })
          }
        }}
      />
    )
  }

  return <CoachApp />
}

/**
 * The Coach shell: rail/tab navigation around the routed screens, plus the
 * review-queue runner that drills through due ranges one session at a time.
 * The legacy single-page layout stays reachable at #/legacy until slice 8.
 */
function CoachApp() {
  const route = useHashRoute()
  // The queue of ranges being reviewed and the current position; null = not
  // reviewing. Screens unmount while a review runs, so they reload fresh
  // stats from storage when the queue finishes.
  const [reviewQueue, setReviewQueue] = useState<SavedRange[] | null>(null)
  const [reviewIndex, setReviewIndex] = useState(0)

  function startReview(queue: SavedRange[]) {
    if (queue.length === 0) return
    setReviewQueue(queue)
    setReviewIndex(0)
  }

  function endReviewSession(attempts: PracticeAttempt[]) {
    const range = reviewQueue?.[reviewIndex]
    if (range) {
      recordFinishedPracticeSession(range.id, attempts)
    }
    if (reviewQueue && reviewIndex + 1 < reviewQueue.length) {
      setReviewIndex(reviewIndex + 1)
    } else {
      setReviewQueue(null)
      setReviewIndex(0)
    }
  }

  const reviewRange = reviewQueue?.[reviewIndex]
  if (reviewQueue && reviewRange) {
    return (
      <AppShell route={route}>
        <section aria-label="Review queue">
          <div className="review-queue-bar">
            {reviewQueue.length > 1 && (
              <p className="coach-tabular review-queue-position">
                Range {reviewIndex + 1} of {reviewQueue.length}
              </p>
            )}
            <button
              type="button"
              className="coach-btn quiet"
              onClick={() => {
                // Abandon the queue without recording the in-progress session.
                setReviewQueue(null)
                setReviewIndex(0)
              }}
            >
              Exit review
            </button>
          </div>
          <PracticeSession
            key={`${reviewRange.id}-${reviewIndex}`}
            range={reviewRange}
            onExit={endReviewSession}
          />
        </section>
      </AppShell>
    )
  }

  return (
    <AppShell route={route}>
      {route.screen === 'today' ? (
        <TodayScreen onStartReview={startReview} />
      ) : route.screen === 'library' || route.screen === 'range' ? (
        <ScreenPlaceholder title="Library" />
      ) : route.screen === 'progress' ? (
        <ScreenPlaceholder title="Progress" />
      ) : route.screen === 'account' ? (
        <ScreenPlaceholder title="Account" />
      ) : (
        <LegacyPage />
      )}
    </AppShell>
  )
}

function ScreenPlaceholder({ title }: { title: string }) {
  return (
    <section className="coach-card" aria-label={title}>
      <h2>{title}</h2>
      <p>
        This screen is being rebuilt. Everything still works from the{' '}
        <a href="#/legacy">current page</a>.
      </p>
    </section>
  )
}

function LegacyPage() {
  const auth = useAuthSession()
  const [selected, setSelected] = useState<Set<PokerHand>>(new Set())
  const [name, setName] = useState('')
  // null = composing a new range; otherwise the id of the saved range being edited.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savedRanges, setSavedRanges] = useState<SavedRange[]>(() => loadSavedRanges())
  // Cumulative per-range practice stats, refreshed after each finished session
  // so the library cards reflect the latest accuracy/last-practiced numbers.
  const [practiceStats, setPracticeStats] = useState(() => loadPracticeStats())
  // Cumulative per-hand accuracy, refreshed after each session so the performance
  // view shows the latest numbers.
  const [handAccuracy, setHandAccuracy] = useState(() => loadHandAccuracy())
  // Cumulative per-action accuracy from action quizzes, refreshed after each quiz
  // so the performance view's per-action table shows the latest numbers.
  const [actionAccuracy, setActionAccuracy] = useState(() => loadActionAccuracy())
  // Per-range session history, refreshed after each session so the performance
  // view's timeline shows the latest sessions.
  const [sessionHistory, setSessionHistory] = useState(() => loadSessionHistory())
  // null = editor/library view; otherwise the saved range whose performance view
  // is open.
  const [performanceRange, setPerformanceRange] = useState<SavedRange | null>(null)
  const [boardRange, setBoardRange] = useState<SavedRange | null>(null)
  const [comboDrillRange, setComboDrillRange] = useState<SavedRange | null>(null)
  // The range whose per-combo selections are being edited, with `comboDraft`
  // holding the in-progress per-hand-class selections.
  const [comboEditRange, setComboEditRange] = useState<SavedRange | null>(null)
  const [comboDraft, setComboDraft] = useState<Record<PokerHand, ComboSelection>>({})
  // The range whose mixed-frequency strategies are being edited, with `freqDraft`
  // holding the in-progress per-hand mixes and `freqActiveHand` the selected hand.
  const [freqEditRange, setFreqEditRange] = useState<SavedRange | null>(null)
  const [freqDraft, setFreqDraft] = useState<Record<PokerHand, HandMixedStrategy>>({})
  const [freqActiveHand, setFreqActiveHand] = useState<PokerHand | null>(null)
  // The range whose per-hand notes are being edited, with `notesDraft` holding
  // the in-progress per-hand note map.
  const [notesEditRange, setNotesEditRange] = useState<SavedRange | null>(null)
  const [notesDraft, setNotesDraft] = useState<Record<PokerHand, string>>({})
  // The range being compared against another, and the chosen comparison target id.
  const [diffRange, setDiffRange] = useState<SavedRange | null>(null)
  const [diffOtherId, setDiffOtherId] = useState<string>('')
  // null = not in the postflop drill; 'setup' = building a scenario; otherwise the active scenario.
  const [postflop, setPostflop] = useState<'setup' | PostflopScenario | null>(null)
  // null = not viewing the review queue; otherwise the ranges due for review,
  // computed fresh when the queue is opened.
  const [dueToday, setDueToday] = useState<SavedRange[] | null>(null)
  // Consecutive-day review streak, computed when the review queue is opened.
  const [reviewStreak, setReviewStreak] = useState(0)
  // null = not editing actions; otherwise the range whose per-hand actions are
  // being edited, with `handActionsDraft` holding the in-progress assignments.
  const [actionEditRange, setActionEditRange] = useState<SavedRange | null>(null)
  const [handActionsDraft, setHandActionsDraft] = useState<Record<PokerHand, RangeAction>>({})
  // null = editor/library view; otherwise the saved range being practiced.
  const [practicingRange, setPracticingRange] = useState<SavedRange | null>(null)
  // When non-null, recognition practice is restricted to these hands (the
  // "practice mistakes only" pool); null means the full 169-hand set.
  const [practiceHandPool, setPracticeHandPool] = useState<PokerHand[] | null>(null)
  // Which practice mode is active for `practicingRange`. null = the mode picker is
  // showing (no mode chosen yet); chosen modes route to their components.
  const [practiceMode, setPracticeMode] = useState<
    'recognize' | 'build' | 'timed' | 'weakness' | 'action' | 'mixed' | null
  >(null)
  // Optional scenario metadata. '' means "unset" for the dropdowns; stackDepth
  // is raw input text ('' means no stack depth). These are descriptive only and
  // never affect the selected hands or notation.
  const [gameType, setGameType] = useState<GameType | ''>('')
  const [tableSize, setTableSize] = useState<TableSize | ''>('')
  const [stackDepth, setStackDepth] = useState('')
  const [position, setPosition] = useState<Position | ''>('')
  const [versusPosition, setVersusPosition] = useState<Position | ''>('')
  const [actionType, setActionType] = useState<ActionType | ''>('')
  const [notes, setNotes] = useState('')
  // Optional source/provenance for the range (persists to SavedRange.source, not
  // metadata). '' kind means "no source"; reference is raw input text.
  const [sourceKind, setSourceKind] = useState<RangeSourceKind | ''>('')
  const [sourceReference, setSourceReference] = useState('')

  // Idempotently set a hand's membership. Used for both click-toggle and
  // drag-paint; returning the previous set when nothing changes avoids a
  // needless re-render mid-drag.
  function setHandSelected(hand: PokerHand, shouldSelect: boolean) {
    setSelected((prev) => {
      if (prev.has(hand) === shouldSelect) return prev
      const next = new Set(prev)
      if (shouldSelect) {
        next.add(hand)
      } else {
        next.delete(hand)
      }
      return next
    })
  }

  // Clears the grid only. Name and the active editing id are intentionally
  // left intact so an in-progress edit stays in editing mode.
  function clearSelection() {
    setSelected(new Set())
  }

  // Adds a shortcut's hands on top of the current selection. mergeShortcutHands
  // dedupes and returns canonical order, so re-applying a shortcut is a no-op
  // and existing hands are preserved. Name and editing id are untouched, so an
  // in-progress edit stays in editing mode.
  function addShortcutHands(hands: PokerHand[]) {
    setSelected((prev) => new Set(mergeShortcutHands(Array.from(prev), hands)))
  }

  // Replaces the whole selection with a parsed notation result (an empty array
  // clears the grid). Name and editing id are left intact, so applying notation
  // while editing a saved range keeps that range in editing mode.
  function replaceHands(hands: PokerHand[]) {
    setSelected(new Set(hands))
  }

  const selectedHands = Array.from(selected)
  const combos = countSelectedCombos(selectedHands)
  const percentage = calculateRangePercentage(selectedHands)

  // Stack depth is optional free text. Blank means "no stack depth"; a non-empty
  // value must parse to a positive, finite number (matching storage's rule).
  // Invalid input blocks saving with an inline message rather than silently
  // dropping the value on save.
  const trimmedStackDepth = stackDepth.trim()
  let stackDepthValue: number | undefined
  let stackDepthError = ''
  if (trimmedStackDepth.length > 0) {
    const parsed = Number(trimmedStackDepth)
    if (Number.isFinite(parsed) && parsed > 0) {
      stackDepthValue = parsed
    } else {
      stackDepthError = 'Stack depth must be a positive number.'
    }
  }

  const trimmedName = name.trim()
  const canSave = trimmedName.length > 0 && selected.size > 0 && !stackDepthError
  const editingRange = editingId
    ? savedRanges.find((range) => range.id === editingId)
    : undefined

  let saveHint = ''
  if (trimmedName.length === 0 && selected.size === 0) {
    saveHint = 'Enter a range name and select at least one hand to save.'
  } else if (trimmedName.length === 0) {
    saveHint = 'Enter a range name to save.'
  } else if (selected.size === 0) {
    saveHint = 'Select at least one hand to save.'
  }

  // New Range resets every editor field, including the optional metadata.
  function resetEditor() {
    setName('')
    setSelected(new Set())
    setEditingId(null)
    setGameType('')
    setTableSize('')
    setStackDepth('')
    setPosition('')
    setVersusPosition('')
    setActionType('')
    setNotes('')
    setSourceKind('')
    setSourceReference('')
  }

  function handleSave() {
    if (!canSave) return

    const now = new Date().toISOString()

    // Merge the edited fields onto any existing metadata so unknown future
    // fields survive an edit. Each blank field is dropped, and an all-empty
    // result collapses to no metadata. Storage re-normalizes, so this only needs
    // to be well-formed, not minimal.
    const metadata: RangeMetadata = { ...editingRange?.metadata }
    if (gameType) metadata.gameType = gameType
    else delete metadata.gameType
    if (tableSize) metadata.tableSize = tableSize
    else delete metadata.tableSize
    if (stackDepthValue !== undefined) metadata.stackDepthBb = stackDepthValue
    else delete metadata.stackDepthBb
    if (position) metadata.position = position
    else delete metadata.position
    if (versusPosition) metadata.versusPosition = versusPosition
    else delete metadata.versusPosition
    if (actionType) metadata.actionType = actionType
    else delete metadata.actionType
    const trimmedNotes = notes.trim()
    if (trimmedNotes) metadata.notes = trimmedNotes
    else delete metadata.notes
    const hasMetadata = Object.keys(metadata).length > 0

    // Build the optional source/provenance from the draft: a chosen kind makes a
    // source (with a trimmed reference when present); a blank kind drops it.
    // Storage re-normalizes, so this only needs to be well-formed.
    const trimmedReference = sourceReference.trim()
    const source: RangeSource | undefined = sourceKind
      ? { kind: sourceKind, ...(trimmedReference ? { reference: trimmedReference } : {}) }
      : undefined

    // Updating an existing range keeps its id and createdAt; a new one gets both fresh.
    let range: SavedRange
    if (editingRange) {
      range = { ...editingRange, name: trimmedName, hands: selectedHands, updatedAt: now }
      // The spread is a fresh object, so attaching/removing metadata here never
      // mutates the stored range; clearing every field removes metadata entirely.
      if (hasMetadata) range.metadata = metadata
      else delete range.metadata
      if (source) range.source = source
      else delete range.source
    } else {
      range = {
        id: createRangeId(),
        name: trimmedName,
        hands: selectedHands,
        createdAt: now,
        updatedAt: now,
      }
      if (hasMetadata) range.metadata = metadata
      if (source) range.source = source
    }

    saveSavedRange(range)
    setSavedRanges(loadSavedRanges())
    // Stay attached to the saved range so the next save updates it instead of duplicating.
    setEditingId(range.id)
    setName(range.name)
  }

  function handleLoad(range: SavedRange) {
    setName(range.name)
    setSelected(new Set(range.hands))
    setEditingId(range.id)
    setGameType(range.metadata?.gameType ?? '')
    setTableSize(range.metadata?.tableSize ?? '')
    setStackDepth(
      range.metadata?.stackDepthBb !== undefined ? String(range.metadata.stackDepthBb) : '',
    )
    setPosition(range.metadata?.position ?? '')
    setVersusPosition(range.metadata?.versusPosition ?? '')
    setActionType(range.metadata?.actionType ?? '')
    setNotes(range.metadata?.notes ?? '')
    setSourceKind(range.source?.kind ?? '')
    setSourceReference(range.source?.reference ?? '')
  }

  function handleDelete(id: string) {
    deleteSavedRange(id)
    setSavedRanges(loadSavedRanges())
    if (editingId === id) {
      resetEditor()
    }
  }

  function handleDuplicate(range: SavedRange) {
    // Duplicating is a library action, not an edit: persist an independent copy
    // and refresh the list, leaving the editor selection and editingId untouched.
    saveSavedRange(duplicateRange(range, createRangeId(), new Date().toISOString()))
    setSavedRanges(loadSavedRanges())
  }

  function handleArchive(range: SavedRange) {
    // Archiving is a library action, not an edit: persist the toggled flag and
    // refresh the list, leaving the editor selection and editingId untouched.
    saveSavedRange(setRangeArchived(range, !range.archived))
    setSavedRanges(loadSavedRanges())
  }

  function handleFavorite(range: SavedRange) {
    // Favoriting is a library action, not an edit: persist the toggled flag and
    // refresh the list, leaving the editor selection and editingId untouched.
    saveSavedRange(setRangeFavorite(range, !range.favorite))
    setSavedRanges(loadSavedRanges())
  }

  function handlePractice(range: SavedRange) {
    // Start at the mode picker (no mode chosen yet) for the selected range, over
    // the full hand set.
    setPracticingRange(range)
    setPracticeMode(null)
    setPracticeHandPool(null)
  }

  // Leave practice entirely, returning to the editor/library and resetting the
  // mode and hand pool so the next launch starts clean. Used by the picker's
  // cancel, build-from-memory's exit, and (via handleEndPractice) recognition's exit.
  function exitPractice() {
    setPracticingRange(null)
    setPracticeMode(null)
    setPracticeHandPool(null)
  }

  function handlePracticeMistakes() {
    // Launch recognition restricted to the range's mistaken hands, straight past
    // the mode picker. Guarded so an empty pool never starts an unwinnable drill.
    if (!performanceRange) return
    const pool = handsWithMistakes(handAccuracy[performanceRange.id] ?? {})
    if (pool.length === 0) return
    setPracticingRange(performanceRange)
    setPracticeMode('recognize')
    setPracticeHandPool(pool)
    setPerformanceRange(null)
  }

  function handleEndPractice(attempts: PracticeAttempt[]) {
    // Persist the finished session into the range's cumulative stats before
    // leaving practice, while the practiced range is still known. App is the
    // single place that derives what it persists from the raw attempts: the
    // per-range summary and the per-hand accuracy. Both recorders are no-ops when
    // nothing was answered, so ending immediately records nothing.
    // Build-from-memory exits through exitPractice without recording stats.
    if (practicingRange) {
      recordFinishedPracticeSession(practicingRange.id, attempts)
      // Refresh from storage so the library card and performance view reflect this
      // session, mirroring the setSavedRanges(loadSavedRanges()) refresh-after-write
      // pattern.
      setPracticeStats(loadPracticeStats())
      setHandAccuracy(loadHandAccuracy())
      setSessionHistory(loadSessionHistory())
    }
    exitPractice()
  }

  function handleEndActionQuiz(attempts: ActionAttempt[]) {
    // Action-quiz attempts are a different shape from recognition attempts, so
    // they record into per-action accuracy rather than the recognition stats.
    // recordActionAccuracy no-ops on an empty summary, so ending without an
    // answer records nothing.
    if (practicingRange) {
      recordActionAccuracy(practicingRange.id, summarizeActionAccuracy(attempts))
      // Refresh from storage so the performance view's per-action table reflects
      // this quiz, mirroring the other refresh-after-write recorders.
      setActionAccuracy(loadActionAccuracy())
    }
    exitPractice()
  }

  function handleViewPerformance(range: SavedRange) {
    setPerformanceRange(range)
  }

  function handleViewBoard(range: SavedRange) {
    setBoardRange(range)
  }

  function handleComboDrill(range: SavedRange) {
    setComboDrillRange(range)
  }

  function handleCompareRange(range: SavedRange) {
    setDiffRange(range)
    setDiffOtherId('')
  }

  function handleEditCombos(range: SavedRange) {
    setComboEditRange(range)
    // Seed each hand class from its saved selection, or default to all-on.
    const draft: Record<PokerHand, ComboSelection> = {}
    for (const hand of range.hands) {
      const saved = range.comboSelections?.[hand]
      draft[hand] = saved ? deserializeComboSelection(saved) : allCombosForHand(hand)
    }
    setComboDraft(draft)
  }

  function setDraftCombo(hand: PokerHand, combo: Card[]) {
    setComboDraft((prev) => ({
      ...prev,
      [hand]: toggleCombo(prev[hand] ?? allCombosForHand(hand), combo),
    }))
  }

  function handleEditFrequencies(range: SavedRange) {
    setFreqEditRange(range)
    setFreqDraft({ ...(range.mixedStrategies ?? {}) })
    setFreqActiveHand(range.hands[0] ?? null)
  }

  function setFreqStrategy(hand: PokerHand, strategy: HandMixedStrategy) {
    setFreqDraft((prev) => ({ ...prev, [hand]: strategy }))
  }

  function handleSaveFrequencies() {
    if (!freqEditRange) return
    saveSavedRange({
      ...freqEditRange,
      mixedStrategies: freqDraft,
      updatedAt: new Date().toISOString(),
    })
    setSavedRanges(loadSavedRanges())
    setFreqEditRange(null)
  }

  function handleEditNotes(range: SavedRange) {
    setNotesEditRange(range)
    setNotesDraft({ ...(range.handNotes ?? {}) })
  }

  function handleSaveNotes() {
    if (!notesEditRange) return
    // Storage drops blank notes and collapses an empty map to undefined, so the
    // draft can be written as-is.
    saveSavedRange({
      ...notesEditRange,
      handNotes: notesDraft,
      updatedAt: new Date().toISOString(),
    })
    setSavedRanges(loadSavedRanges())
    setNotesEditRange(null)
  }

  function handleSaveCombos() {
    if (!comboEditRange) return
    // Persist only hand classes that are NOT fully selected, so an all-on range
    // stays without the field (absence = all combos selected, the default).
    const comboSelections: Record<PokerHand, string[]> = {}
    for (const hand of comboEditRange.hands) {
      const selection = comboDraft[hand] ?? allCombosForHand(hand)
      const full = allCombosForHand(hand).size
      if (selection.size < full) {
        comboSelections[hand] = serializeComboSelection(selection)
      }
    }
    saveSavedRange({
      ...comboEditRange,
      comboSelections: Object.keys(comboSelections).length > 0 ? comboSelections : undefined,
      updatedAt: new Date().toISOString(),
    })
    setSavedRanges(loadSavedRanges())
    setComboEditRange(null)
  }

  function handleOpenPostflop() {
    setPostflop('setup')
  }

  function handleViewDueToday() {
    // Compute the due list and streak in the handler (not during render) so no
    // impure Date/storage read happens while rendering. Archived ranges are excluded.
    const now = new Date().toISOString()
    const playedAt = Object.values(loadSessionHistory())
      .flat()
      .map((session) => session.playedAt)
    setReviewStreak(currentStreak(playedAt, now))
    setDueToday(
      selectDueRanges(
        savedRanges.filter((range) => !range.archived),
        loadReviewStates(),
        now,
      ),
    )
  }

  function handlePracticeDue(range: SavedRange) {
    // Leave the queue and start practice; exiting practice returns to the library.
    setDueToday(null)
    handlePractice(range)
  }

  function handleEditActions(range: SavedRange) {
    setActionEditRange(range)
    // Seed the draft from the range's saved actions (empty for a hands-only range).
    setHandActionsDraft({ ...(range.handActions ?? {}) })
  }

  function setDraftHandAction(hand: PokerHand, action: RangeAction) {
    setHandActionsDraft((prev) => ({ ...prev, [hand]: action }))
  }

  function handleSaveActions() {
    if (!actionEditRange) return
    saveSavedRange({
      ...actionEditRange,
      handActions: handActionsDraft,
      updatedAt: new Date().toISOString(),
    })
    setSavedRanges(loadSavedRanges())
    setActionEditRange(null)
  }

  function downloadTextFile(filename: string, text: string, mime = 'application/json') {
    const blob = new Blob([text], { type: mime })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function handleExportBackup() {
    downloadTextFile(
      `poker-range-trainer-backup-${new Date().toISOString().slice(0, 10)}.json`,
      serializeBackup(buildBackup()),
    )
  }

  function handleExportPack() {
    downloadTextFile(
      `poker-range-pack-${new Date().toISOString().slice(0, 10)}.json`,
      serializeRangePack('', savedRanges),
    )
  }

  async function handleImportPack(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Reset the input so re-selecting the same file fires change again.
    event.target.value = ''
    if (!file) return
    let pack: { name?: string; ranges: SavedRange[] }
    try {
      pack = parseRangePack(await file.text())
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not import pack file.')
      return
    }
    // Add every range as a new range so importing never clobbers existing ones.
    const now = new Date().toISOString()
    for (const range of pack.ranges) {
      saveSavedRange({ ...range, id: createRangeId(), createdAt: now, updatedAt: now })
    }
    setSavedRanges(loadSavedRanges())
  }

  function safeRangeFileName(range: SavedRange) {
    return range.name.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'range'
  }

  function handleExportRange(range: SavedRange) {
    downloadTextFile(`${safeRangeFileName(range)}.json`, serializeRangeExport(range))
  }

  function handleExportRangeCsv(range: SavedRange) {
    downloadTextFile(`${safeRangeFileName(range)}.csv`, formatRangeCsv(range), 'text/csv')
  }

  function handleExportRangeImage(range: SavedRange) {
    downloadTextFile(`${safeRangeFileName(range)}.svg`, formatRangeSvg(range), 'image/svg+xml')
  }

  async function handleShareRange(range: SavedRange) {
    const link = `${window.location.origin}${window.location.pathname}#range=${encodeRangeToHash(range)}`
    try {
      await navigator.clipboard.writeText(link)
      window.alert('Share link copied to clipboard.')
    } catch {
      // Clipboard may be unavailable (insecure context); show the link to copy manually.
      window.prompt('Copy this share link:', link)
    }
  }

  async function handleImportRange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Reset the input so re-selecting the same file fires change again.
    event.target.value = ''
    if (!file) return
    let imported: SavedRange
    try {
      imported = parseRangeExport(await file.text())
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not import range file.')
      return
    }
    // Add as a new range with a fresh id so importing never clobbers an existing one.
    const now = new Date().toISOString()
    saveSavedRange({ ...imported, id: createRangeId(), createdAt: now, updatedAt: now })
    setSavedRanges(loadSavedRanges())
  }

  async function handleImportRangeCsv(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Reset the input so re-selecting the same file fires change again.
    event.target.value = ''
    if (!file) return
    let parsed: { name?: string; hands: PokerHand[] }
    try {
      parsed = parseRangeCsv(await file.text())
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not import CSV file.')
      return
    }
    // The CSV may omit a name; fall back to the file name (sans extension).
    const fallbackName = file.name.replace(/\.csv$/i, '').trim() || 'Imported range'
    const now = new Date().toISOString()
    saveSavedRange({
      id: createRangeId(),
      name: parsed.name?.trim() || fallbackName,
      hands: parsed.hands,
      createdAt: now,
      updatedAt: now,
    })
    setSavedRanges(loadSavedRanges())
  }

  async function handleImportBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Reset the input so re-selecting the same file fires change again.
    event.target.value = ''
    if (!file) return
    if (
      !window.confirm(
        'Importing a backup REPLACES all your current local data. Continue?',
      )
    ) {
      return
    }
    try {
      restoreBackup(parseBackup(await file.text()))
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : 'Could not import backup file.',
      )
      return
    }
    // Refresh all in-memory state from the freshly restored storage.
    setSavedRanges(loadSavedRanges())
    setPracticeStats(loadPracticeStats())
    setHandAccuracy(loadHandAccuracy())
    setActionAccuracy(loadActionAccuracy())
    setSessionHistory(loadSessionHistory())
  }

  const [syncStatus, setSyncStatus] = useState('')
  // Share ids published this session, keyed by range id, so they can be unpublished.
  const [publishedShareIds, setPublishedShareIds] = useState<Record<string, string>>({})
  // The pack share id published this session (if any), so it can be unpublished.
  const [publishedPackId, setPublishedPackId] = useState<string | null>(null)

  async function handlePublishRange(range: SavedRange) {
    // OK = public (anyone with the link); Cancel = private (link carries a token).
    const isPublic = window.confirm(
      `Publish "${range.name}" as a shareable link?\n\nOK = public (anyone with the link can view)\nCancel = private (link includes a secret token)`,
    )
    setSyncStatus('Publishing…')
    try {
      const { id, token } = await publishSharedRange(range, isPublic)
      // Remember the share id so this session can unpublish it later.
      setPublishedShareIds((prev) => ({ ...prev, [range.id]: id }))
      const base = `${window.location.origin}${window.location.pathname}#/r/${id}`
      const link = token ? `${base}?t=${token}` : base
      try {
        await navigator.clipboard.writeText(link)
        setSyncStatus('Share link copied to clipboard.')
      } catch {
        window.prompt('Copy this share link:', link)
        setSyncStatus('Share link ready.')
      }
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'Publish failed.')
    }
  }

  async function handlePublishPack() {
    if (savedRanges.length === 0) {
      setSyncStatus('No ranges to publish.')
      return
    }
    // OK = public (anyone with the link); Cancel = private (link carries a token).
    const isPublic = window.confirm(
      `Publish all ${savedRanges.length} ranges as a shareable pack link?\n\nOK = public (anyone with the link can view)\nCancel = private (link includes a secret token)`,
    )
    setSyncStatus('Publishing pack…')
    try {
      const { id, token } = await publishSharedPack(buildRangePack('', savedRanges), isPublic)
      // Remember the pack share id so this session can unpublish it later.
      setPublishedPackId(id)
      const base = `${window.location.origin}${window.location.pathname}#/p/${id}`
      const link = token ? `${base}?t=${token}` : base
      try {
        await navigator.clipboard.writeText(link)
        setSyncStatus('Pack link copied to clipboard.')
      } catch {
        window.prompt('Copy this pack link:', link)
        setSyncStatus('Pack link ready.')
      }
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'Publish failed.')
    }
  }

  async function handleUnpublishPack() {
    if (!publishedPackId) return
    setSyncStatus('Unpublishing pack…')
    try {
      await unpublishSharedPack(publishedPackId)
      setPublishedPackId(null)
      setSyncStatus('Pack link unpublished.')
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'Unpublish failed.')
    }
  }

  async function handleUnpublishRange(range: SavedRange) {
    const shareId = publishedShareIds[range.id]
    if (!shareId) return
    setSyncStatus('Unpublishing…')
    try {
      await unpublishSharedRange(shareId)
      setPublishedShareIds((prev) => {
        const next = { ...prev }
        delete next[range.id]
        return next
      })
      setSyncStatus('Shared link unpublished.')
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'Unpublish failed.')
    }
  }

  async function handlePushSync() {
    setSyncStatus('Pushing…')
    try {
      await pushBackup(buildBackup())
      setSyncStatus('Pushed your full library to the cloud.')
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'Push failed.')
    }
  }

  async function handlePullSync() {
    if (
      !window.confirm(
        'Pulling from the cloud REPLACES all your local data with the cloud copy. Continue?',
      )
    ) {
      return
    }
    setSyncStatus('Pulling…')
    try {
      const cloudBackup = await pullBackup()
      if (!cloudBackup) {
        setSyncStatus('No cloud backup found yet. Push first.')
        return
      }
      restoreBackup(cloudBackup)
      // Refresh all in-memory state from the freshly restored storage.
      setSavedRanges(loadSavedRanges())
      setPracticeStats(loadPracticeStats())
      setHandAccuracy(loadHandAccuracy())
      setActionAccuracy(loadActionAccuracy())
      setSessionHistory(loadSessionHistory())
      setSyncStatus('Pulled your full library from the cloud.')
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'Pull failed.')
    }
  }

  async function handleDeleteCloudData() {
    if (
      !window.confirm(
        'This permanently deletes your cloud backup. Your local data is kept. Continue?',
      )
    ) {
      return
    }
    setSyncStatus('Deleting cloud data…')
    try {
      await deleteBackup()
      setSyncStatus('Deleted your cloud backup.')
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'Delete failed.')
    }
  }

  let headerSubtitle: string
  if (practicingRange) {
    if (practiceMode === 'recognize') {
      headerSubtitle = practiceHandPool
        ? 'Drill the hands you keep missing.'
        : 'Test your range recognition.'
    } else if (practiceMode === 'build') {
      headerSubtitle = 'Rebuild the range from memory.'
    } else if (practiceMode === 'timed') {
      headerSubtitle = 'Race the clock.'
    } else if (practiceMode === 'weakness') {
      headerSubtitle = 'Drill your weak spots.'
    } else if (practiceMode === 'action') {
      headerSubtitle = 'Pick the correct action for each hand.'
    } else if (practiceMode === 'mixed') {
      headerSubtitle = 'Pick the primary action for each mixed hand.'
    } else {
      headerSubtitle = 'Choose how you want to practice.'
    }
  } else if (postflop) {
    headerSubtitle = 'Practice a postflop decision.'
  } else if (boardRange) {
    headerSubtitle = 'See how this range hits a flop.'
  } else if (comboDrillRange) {
    headerSubtitle = 'Deal blocker-aware combos from this range.'
  } else if (diffRange) {
    headerSubtitle = 'Compare this range against another.'
  } else if (comboEditRange) {
    headerSubtitle = 'Select which exact combos are in this range.'
  } else if (freqEditRange) {
    headerSubtitle = 'Assign mixed action frequencies per hand.'
  } else if (notesEditRange) {
    headerSubtitle = 'Attach a note to individual hands.'
  } else if (performanceRange) {
    headerSubtitle = 'Review your per-hand accuracy.'
  } else if (dueToday !== null) {
    headerSubtitle = 'Review the ranges due for review.'
  } else if (actionEditRange) {
    headerSubtitle = 'Assign an action to each hand.'
  } else {
    headerSubtitle = "Click hands to build a Texas Hold'em preflop range."
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>Poker Range Trainer</h1>
        <p>{headerSubtitle}</p>
        <AuthPanel
          isCloudConfigured={auth.isCloudConfigured}
          session={auth.session}
        />
        {auth.session && (
          <div className="cloud-sync" aria-label="Cloud sync">
            <button type="button" onClick={() => void handlePushSync()}>
              Push to cloud
            </button>
            <button type="button" onClick={() => void handlePullSync()}>
              Pull from cloud
            </button>
            <button type="button" onClick={() => void handleDeleteCloudData()}>
              Delete cloud data
            </button>
            <button type="button" onClick={() => void handlePublishPack()}>
              Publish pack link
            </button>
            {publishedPackId && (
              <button type="button" onClick={() => void handleUnpublishPack()}>
                Unpublish pack
              </button>
            )}
            {syncStatus && <span className="cloud-sync-status">{syncStatus}</span>}
          </div>
        )}
      </header>

      {practicingRange ? (
        practiceMode === 'recognize' ? (
          <PracticeSession
            range={practicingRange}
            onExit={handleEndPractice}
            handPool={practiceHandPool ?? undefined}
          />
        ) : practiceMode === 'build' ? (
          <BuildFromMemoryPractice range={practicingRange} onExit={exitPractice} />
        ) : practiceMode === 'timed' ? (
          <TimedDrillSession range={practicingRange} onExit={handleEndPractice} />
        ) : practiceMode === 'weakness' ? (
          <WeaknessFocusedDrill range={practicingRange} onExit={handleEndPractice} />
        ) : practiceMode === 'action' ? (
          <ActionQuiz range={practicingRange} onExit={handleEndActionQuiz} />
        ) : practiceMode === 'mixed' ? (
          <MixedActionQuiz range={practicingRange} onExit={exitPractice} />
        ) : (
          <section className="practice-session" aria-label="Choose practice mode">
            <header className="practice-header">
              <h2>Practice: {practicingRange.name}</h2>
            </header>
            <p className="practice-expected">
              Recognize hands: say whether each random hand is in or out of the range.
              Build from memory: rebuild the whole range on the grid, then check it.
              Timed drill: answer as many hands as you can before the clock runs out.
              Weakness drill: practice with the hands you keep getting wrong showing up more.
              Pick the correct action: name the assigned action for each hand (action charts only).
              Frequency quiz: name the primary action for each hand (mixed-frequency charts only).
            </p>
            <div className="practice-answers">
              <button
                type="button"
                className="primary"
                onClick={() => setPracticeMode('recognize')}
              >
                Recognize hands (in/out)
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => setPracticeMode('build')}
              >
                Build from memory
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => setPracticeMode('timed')}
              >
                Timed drill
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => setPracticeMode('weakness')}
              >
                Weakness drill
              </button>
              {practicingRange.handActions &&
                assignedHands(practicingRange.handActions).length > 0 && (
                  <button
                    type="button"
                    className="primary"
                    onClick={() => setPracticeMode('action')}
                  >
                    Pick the correct action
                  </button>
                )}
              {practicingRange.mixedStrategies &&
                handsWithMixedStrategy(practicingRange.mixedStrategies).length > 0 && (
                  <button
                    type="button"
                    className="primary"
                    onClick={() => setPracticeMode('mixed')}
                  >
                    Frequency quiz
                  </button>
                )}
            </div>
            <div className="practice-review-actions">
              <button type="button" onClick={exitPractice}>
                Back to library
              </button>
            </div>
          </section>
        )
      ) : postflop ? (
        postflop === 'setup' ? (
          <PostflopDrillSetup
            onStart={(scenario) => setPostflop(scenario)}
            onExit={() => setPostflop(null)}
          />
        ) : (
          <PostflopPractice scenario={postflop} onExit={() => setPostflop(null)} />
        )
      ) : boardRange ? (
        <section className="practice-session" aria-label="Range vs board">
          <header className="practice-header">
            <h2>Board: {boardRange.name}</h2>
            <button type="button" onClick={() => setBoardRange(null)}>
              Back to library
            </button>
          </header>
          <RangeVsBoard hands={boardRange.hands} />
        </section>
      ) : comboDrillRange ? (
        <section className="practice-session" aria-label="Combo drill">
          <header className="practice-header">
            <h2>Combo drill: {comboDrillRange.name}</h2>
          </header>
          <ComboBlockerDrill
            hands={comboDrillRange.hands}
            selection={selectionForRange(comboDrillRange.hands, comboDrillRange.comboSelections)}
            onExit={() => setComboDrillRange(null)}
          />
        </section>
      ) : diffRange ? (
        (() => {
          const others = savedRanges.filter((r) => r.id !== diffRange.id)
          const other = others.find((r) => r.id === diffOtherId) ?? null
          return (
            <section className="practice-session" aria-label="Range comparison">
              <header className="practice-header">
                <h2>Compare: {diffRange.name}</h2>
                <button type="button" onClick={() => setDiffRange(null)}>
                  Back to library
                </button>
              </header>
              <label className="diff-range-select">
                Compare with
                <select
                  value={diffOtherId}
                  onChange={(event) => setDiffOtherId(event.target.value)}
                >
                  <option value="">Select a range…</option>
                  {others.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              {other ? (
                <RangeDiffView
                  handsA={diffRange.hands}
                  handsB={other.hands}
                  labelA={diffRange.name}
                  labelB={other.name}
                />
              ) : (
                <p className="practice-expected">Pick a range to compare against.</p>
              )}
            </section>
          )
        })()
      ) : comboEditRange ? (
        <section className="practice-session" aria-label="Combo selection editor">
          <header className="practice-header">
            <h2>Combos: {comboEditRange.name}</h2>
            <button type="button" className="primary" onClick={handleSaveCombos}>
              Save combos
            </button>
            <button type="button" onClick={() => setComboEditRange(null)}>
              Back to library
            </button>
          </header>
          {comboEditRange.hands.map((hand) => (
            <div key={hand} className="combo-edit-hand">
              <h3>{hand}</h3>
              <ComboSelector
                hand={hand}
                selection={comboDraft[hand] ?? allCombosForHand(hand)}
                onToggle={(combo) => setDraftCombo(hand, combo)}
              />
            </div>
          ))}
        </section>
      ) : freqEditRange ? (
        <section className="practice-session" aria-label="Mixed-frequency editor">
          <header className="practice-header">
            <h2>Frequencies: {freqEditRange.name}</h2>
            <button type="button" className="primary" onClick={handleSaveFrequencies}>
              Save frequencies
            </button>
            <button type="button" onClick={() => setFreqEditRange(null)}>
              Back to library
            </button>
          </header>
          <MixedStrategyGrid mixedStrategies={freqDraft} />
          <label className="freq-hand-select">
            Hand
            <select
              value={freqActiveHand ?? ''}
              onChange={(event) => setFreqActiveHand(event.target.value as PokerHand)}
            >
              {freqEditRange.hands.map((hand) => (
                <option key={hand} value={hand}>
                  {hand}
                </option>
              ))}
            </select>
          </label>
          {freqActiveHand && (
            <MixedStrategyEditor
              strategy={freqDraft[freqActiveHand] ?? []}
              onChange={(next) => setFreqStrategy(freqActiveHand, next)}
            />
          )}
          <MixedNotation
            mixedStrategies={freqDraft}
            onReplace={(next) => {
              setFreqDraft(next)
              setFreqActiveHand(freqEditRange.hands[0] ?? null)
            }}
          />
        </section>
      ) : notesEditRange ? (
        <section className="practice-session" aria-label="Hand notes editor">
          <header className="practice-header">
            <h2>Notes: {notesEditRange.name}</h2>
            <button type="button" className="primary" onClick={handleSaveNotes}>
              Save notes
            </button>
            <button type="button" onClick={() => setNotesEditRange(null)}>
              Back to library
            </button>
          </header>
          <HandNotesEditor
            hands={notesEditRange.hands}
            notes={notesDraft}
            onChange={setNotesDraft}
          />
        </section>
      ) : performanceRange ? (
        <RangePerformance
          range={performanceRange}
          accuracy={handAccuracy[performanceRange.id] ?? {}}
          history={sessionHistory[performanceRange.id] ?? []}
          actionAccuracy={actionAccuracy[performanceRange.id] ?? {}}
          onClose={() => setPerformanceRange(null)}
          onPracticeMistakes={handlePracticeMistakes}
        />
      ) : dueToday !== null ? (
        <DueToday
          dueRanges={dueToday}
          streak={reviewStreak}
          onPractice={handlePracticeDue}
          onClose={() => setDueToday(null)}
        />
      ) : actionEditRange ? (
        <section className="practice-session" aria-label="Action editor">
          <header className="practice-header">
            <h2>Actions: {actionEditRange.name}</h2>
            <button type="button" className="primary" onClick={handleSaveActions}>
              Save actions
            </button>
            <button type="button" onClick={() => setActionEditRange(null)}>
              Back to library
            </button>
          </header>
          <MultiActionEditor
            handActions={handActionsDraft}
            onSetHandAction={setDraftHandAction}
          />
          <ActionNotation
            handActions={handActionsDraft}
            onReplaceActions={setHandActionsDraft}
          />
        </section>
      ) : (
        <>
          <section className="range-editor" aria-label="Range editor">
            <div className="editor-controls">
              <input
                type="text"
                className="range-name-input"
                placeholder="Range name"
                aria-label="Range name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <button type="button" className="primary" onClick={handleSave} disabled={!canSave}>
                {editingRange ? 'Save Changes' : 'Save Range'}
              </button>
              <button type="button" onClick={resetEditor}>
                New Range
              </button>
              <button
                type="button"
                onClick={clearSelection}
                disabled={selected.size === 0}
              >
                Clear Selection
              </button>
            </div>
            {editingRange && (
              <p className="editing-indicator" role="status">
                Editing saved range: <strong>{editingRange.name}</strong>
              </p>
            )}
            {saveHint && <p className="editor-hint">{saveHint}</p>}
          </section>

          <RangeMetadataEditor
            gameType={gameType}
            tableSize={tableSize}
            stackDepth={stackDepth}
            stackDepthError={stackDepthError}
            position={position}
            versusPosition={versusPosition}
            actionType={actionType}
            notes={notes}
            sourceKind={sourceKind}
            sourceReference={sourceReference}
            onGameTypeChange={setGameType}
            onTableSizeChange={setTableSize}
            onStackDepthChange={setStackDepth}
            onPositionChange={setPosition}
            onVersusPositionChange={setVersusPosition}
            onActionTypeChange={setActionType}
            onNotesChange={setNotes}
            onSourceKindChange={setSourceKind}
            onSourceReferenceChange={setSourceReference}
          />

          <RangeShortcuts onAddHands={addShortcutHands} />

          <RangeNotation selectedHands={selectedHands} onReplaceHands={replaceHands} />

          <HandGrid selected={selected} onSetSelected={setHandSelected} />

          <section className="range-summary" aria-label="Range summary">
            <span>{selectedHands.length} hands selected</span>
            <span>{combos} combos</span>
            <span>{percentage.toFixed(1)}% of all hands</span>
          </section>

          <div className="editor-controls">
            <button type="button" onClick={handleViewDueToday}>
              Review due ranges
            </button>
            <button type="button" onClick={handleOpenPostflop}>
              Postflop drill
            </button>
            <button type="button" onClick={handleExportBackup}>
              Export backup
            </button>
            <label className="import-backup">
              Import backup
              <input
                type="file"
                accept="application/json,.json"
                onChange={handleImportBackup}
              />
            </label>
            <label className="import-backup">
              Import range
              <input
                type="file"
                accept="application/json,.json"
                onChange={handleImportRange}
              />
            </label>
            <label className="import-backup">
              Import CSV
              <input type="file" accept=".csv,text/csv" onChange={handleImportRangeCsv} />
            </label>
            <button type="button" onClick={handleExportPack}>
              Export pack
            </button>
            <label className="import-backup">
              Import pack
              <input
                type="file"
                accept="application/json,.json"
                onChange={handleImportPack}
              />
            </label>
          </div>

          {savedRanges.length === 0 && <GettingStarted />}

          <LibraryAnalytics analytics={summarizeLibraryAnalytics(Object.values(practiceStats))} />

          <RangeLibrary
            ranges={savedRanges}
            activeId={editingId}
            practiceStats={practiceStats}
            onLoad={handleLoad}
            onDelete={handleDelete}
            onPractice={handlePractice}
            onDuplicate={handleDuplicate}
            onFavorite={handleFavorite}
            onArchive={handleArchive}
            onViewPerformance={handleViewPerformance}
            onViewBoard={handleViewBoard}
            onComboDrill={handleComboDrill}
            onCompareRange={handleCompareRange}
            onEditCombos={handleEditCombos}
            onEditFrequencies={handleEditFrequencies}
            onEditNotes={handleEditNotes}
            onEditActions={handleEditActions}
            onExportRange={handleExportRange}
            onExportRangeCsv={handleExportRangeCsv}
            onExportRangeImage={handleExportRangeImage}
            onShareRange={handleShareRange}
            onPublishRange={handlePublishRange}
            onUnpublishRange={handleUnpublishRange}
            publishedRangeIds={publishedShareIds}
            canPublishToCloud={!!auth.session}
          />
        </>
      )}
    </main>
  )
}

export default App
