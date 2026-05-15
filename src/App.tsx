import { useState } from 'react'
import { BuildFromMemoryPractice } from './components/BuildFromMemoryPractice'
import { HandGrid } from './components/HandGrid'
import { PracticeSession } from './components/PracticeSession'
import { TimedDrillSession } from './components/TimedDrillSession'
import { WeaknessFocusedDrill } from './components/WeaknessFocusedDrill'
import { RangeLibrary } from './components/RangeLibrary'
import { RangeMetadataEditor } from './components/RangeMetadataEditor'
import { RangeNotation } from './components/RangeNotation'
import { RangeShortcuts } from './components/RangeShortcuts'
import { setRangeArchived } from './domain/rangeArchive'
import { duplicateRange } from './domain/rangeDuplication'
import { setRangeFavorite } from './domain/rangeFavorite'
import { summarizeHandAccuracy, summarizePracticeAttempts } from './domain/practice'
import { calculateRangePercentage, countSelectedCombos } from './domain/rangeMath'
import { mergeShortcutHands } from './domain/rangeShortcuts'
import type { PokerHand } from './domain/pokerHands'
import { recordHandAccuracy } from './storage/handAccuracyStorage'
import { loadPracticeStats, recordPracticeSession } from './storage/practiceStatsStorage'
import { deleteSavedRange, loadSavedRanges, saveSavedRange } from './storage/rangeStorage'
import type { PracticeAttempt } from './types/practice'
import type {
  ActionType,
  GameType,
  Position,
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
  const [selected, setSelected] = useState<Set<PokerHand>>(new Set())
  const [name, setName] = useState('')
  // null = composing a new range; otherwise the id of the saved range being edited.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savedRanges, setSavedRanges] = useState<SavedRange[]>(() => loadSavedRanges())
  // Cumulative per-range practice stats, refreshed after each finished session
  // so the library cards reflect the latest accuracy/last-practiced numbers.
  const [practiceStats, setPracticeStats] = useState(() => loadPracticeStats())
  // null = editor/library view; otherwise the saved range being practiced.
  const [practicingRange, setPracticingRange] = useState<SavedRange | null>(null)
  // Which practice mode is active for `practicingRange`. null = the mode picker is
  // showing (no mode chosen yet); chosen modes route to their components.
  const [practiceMode, setPracticeMode] = useState<
    'recognize' | 'build' | 'timed' | 'weakness' | null
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
    // Start at the mode picker (no mode chosen yet) for the selected range.
    setPracticingRange(range)
    setPracticeMode(null)
  }

  // Leave practice entirely, returning to the editor/library and resetting the
  // mode so the next launch starts at the picker. Used by the picker's cancel,
  // build-from-memory's exit, and (via handleEndPractice) recognition's exit.
  function exitPractice() {
    setPracticingRange(null)
    setPracticeMode(null)
  }

  function handleEndPractice(attempts: PracticeAttempt[]) {
    // Persist the finished session into the range's cumulative stats before
    // leaving practice, while the practiced range is still known. App is the
    // single place that derives what it persists from the raw attempts: the
    // per-range summary and the per-hand accuracy. Both recorders are no-ops when
    // nothing was answered, so ending immediately records nothing.
    // Build-from-memory exits through exitPractice without recording stats.
    if (practicingRange) {
      recordPracticeSession(practicingRange.id, summarizePracticeAttempts(attempts))
      recordHandAccuracy(practicingRange.id, summarizeHandAccuracy(attempts))
      // Refresh from storage so the library card reflects this session, mirroring
      // the setSavedRanges(loadSavedRanges()) refresh-after-write pattern.
      setPracticeStats(loadPracticeStats())
    }
    exitPractice()
  }

  let headerSubtitle: string
  if (!practicingRange) {
    headerSubtitle = "Click hands to build a Texas Hold'em preflop range."
  } else if (practiceMode === 'recognize') {
    headerSubtitle = 'Test your range recognition.'
  } else if (practiceMode === 'build') {
    headerSubtitle = 'Rebuild the range from memory.'
  } else if (practiceMode === 'timed') {
    headerSubtitle = 'Race the clock.'
  } else if (practiceMode === 'weakness') {
    headerSubtitle = 'Drill your weak spots.'
  } else {
    headerSubtitle = 'Choose how you want to practice.'
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>Poker Range Trainer</h1>
        <p>{headerSubtitle}</p>
      </header>

      {practicingRange ? (
        practiceMode === 'recognize' ? (
          <PracticeSession range={practicingRange} onExit={handleEndPractice} />
        ) : practiceMode === 'build' ? (
          <BuildFromMemoryPractice range={practicingRange} onExit={exitPractice} />
        ) : practiceMode === 'timed' ? (
          <TimedDrillSession range={practicingRange} onExit={handleEndPractice} />
        ) : practiceMode === 'weakness' ? (
          <WeaknessFocusedDrill range={practicingRange} onExit={handleEndPractice} />
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
            </div>
            <div className="practice-review-actions">
              <button type="button" onClick={exitPractice}>
                Back to library
              </button>
            </div>
          </section>
        )
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
          />
        </>
      )}
    </main>
  )
}

export default App
