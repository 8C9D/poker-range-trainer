import { useState } from 'react'
import { ActionNotation } from './components/ActionNotation'
import { AuthPanel } from './components/AuthPanel'
import { ActionQuiz } from './components/ActionQuiz'
import { BuildFromMemoryPractice } from './components/BuildFromMemoryPractice'
import { DueToday } from './components/DueToday'
import { HandGrid } from './components/HandGrid'
import { MultiActionEditor } from './components/MultiActionEditor'
import { PracticeSession } from './components/PracticeSession'
import { TimedDrillSession } from './components/TimedDrillSession'
import { WeaknessFocusedDrill } from './components/WeaknessFocusedDrill'
import { RangeLibrary } from './components/RangeLibrary'
import { RangeMetadataEditor } from './components/RangeMetadataEditor'
import { RangeNotation } from './components/RangeNotation'
import { RangePerformance } from './components/RangePerformance'
import { RangeShortcuts } from './components/RangeShortcuts'
import { assignedHands, summarizeActionAccuracy } from './domain/actionRange'
import { setRangeArchived } from './domain/rangeArchive'
import { duplicateRange } from './domain/rangeDuplication'
import { setRangeFavorite } from './domain/rangeFavorite'
import { handsWithMistakes, summarizeHandAccuracy, summarizePracticeAttempts } from './domain/practice'
import {
  currentStreak,
  scheduleNextReview,
  seedReviewState,
  selectDueRanges,
} from './domain/spacedRepetition'
import { calculateRangePercentage, countSelectedCombos } from './domain/rangeMath'
import { mergeShortcutHands } from './domain/rangeShortcuts'
import type { PokerHand } from './domain/pokerHands'
import { loadActionAccuracy, recordActionAccuracy } from './storage/actionAccuracyStorage'
import { loadHandAccuracy, recordHandAccuracy } from './storage/handAccuracyStorage'
import { loadPracticeStats, recordPracticeSession } from './storage/practiceStatsStorage'
import { loadReviewStates, saveReviewState } from './storage/reviewStateStorage'
import { loadSessionHistory, recordPracticeSessionHistory } from './storage/sessionHistoryStorage'
import { deleteSavedRange, loadSavedRanges, saveSavedRange } from './storage/rangeStorage'
import { deleteBackup, pullBackup, pushBackup } from './cloud/backupRepo'
import { buildBackup, parseBackup, restoreBackup, serializeBackup } from './storage/backup'
import { useAuthSession } from './cloud/useAuthSession'
import { parseRangeExport, serializeRangeExport } from './domain/rangeTransfer'
import type { ActionAttempt, PracticeAttempt } from './types/practice'
import type {
  ActionType,
  GameType,
  Position,
  RangeAction,
  RangeMetadata,
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

function App() {
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
    'recognize' | 'build' | 'timed' | 'weakness' | 'action' | null
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

    // Updating an existing range keeps its id and createdAt; a new one gets both fresh.
    let range: SavedRange
    if (editingRange) {
      range = { ...editingRange, name: trimmedName, hands: selectedHands, updatedAt: now }
      // The spread is a fresh object, so attaching/removing metadata here never
      // mutates the stored range; clearing every field removes metadata entirely.
      if (hasMetadata) range.metadata = metadata
      else delete range.metadata
    } else {
      range = {
        id: createRangeId(),
        name: trimmedName,
        hands: selectedHands,
        createdAt: now,
        updatedAt: now,
      }
      if (hasMetadata) range.metadata = metadata
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
      const summary = summarizePracticeAttempts(attempts)
      recordPracticeSession(practicingRange.id, summary)
      recordHandAccuracy(practicingRange.id, summarizeHandAccuracy(attempts))
      recordPracticeSessionHistory(practicingRange.id, summary)
      // Advance the spaced-repetition schedule from this session's accuracy.
      const reviewedAt = new Date().toISOString()
      const prevReview =
        loadReviewStates()[practicingRange.id] ?? seedReviewState(practicingRange.id)
      saveReviewState(scheduleNextReview(prevReview, summary.accuracyPercentage, reviewedAt))
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

  function downloadTextFile(filename: string, text: string) {
    const blob = new Blob([text], { type: 'application/json' })
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

  function handleExportRange(range: SavedRange) {
    const safeName = range.name.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'range'
    downloadTextFile(`${safeName}.json`, serializeRangeExport(range))
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
    } else {
      headerSubtitle = 'Choose how you want to practice.'
    }
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
            </div>
            <div className="practice-review-actions">
              <button type="button" onClick={exitPractice}>
                Back to library
              </button>
            </div>
          </section>
        )
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
            onGameTypeChange={setGameType}
            onTableSizeChange={setTableSize}
            onStackDepthChange={setStackDepth}
            onPositionChange={setPosition}
            onVersusPositionChange={setVersusPosition}
            onActionTypeChange={setActionType}
            onNotesChange={setNotes}
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
          </div>

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
            onEditActions={handleEditActions}
            onExportRange={handleExportRange}
          />
        </>
      )}
    </main>
  )
}

export default App
