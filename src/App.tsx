import { useState } from 'react'
import { HandGrid } from './components/HandGrid'
import { PracticeSession } from './components/PracticeSession'
import { RangeLibrary } from './components/RangeLibrary'
import { RangeMetadataEditor } from './components/RangeMetadataEditor'
import { RangeNotation } from './components/RangeNotation'
import { RangeShortcuts } from './components/RangeShortcuts'
import { calculateRangePercentage, countSelectedCombos } from './domain/rangeMath'
import { mergeShortcutHands } from './domain/rangeShortcuts'
import type { PokerHand } from './domain/pokerHands'
import { deleteSavedRange, loadSavedRanges, saveSavedRange } from './storage/rangeStorage'
import type { ActionType, Position, RangeMetadata, SavedRange } from './types/range'
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
  // null = editor/library view; otherwise the saved range being practiced.
  const [practicingRange, setPracticingRange] = useState<SavedRange | null>(null)
  // Optional scenario metadata. '' means "unset" for the two dropdowns. These
  // are descriptive only and never affect the selected hands or notation.
  const [position, setPosition] = useState<Position | ''>('')
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

  const trimmedName = name.trim()
  const canSave = trimmedName.length > 0 && selected.size > 0
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
    setPosition('')
    setActionType('')
    setNotes('')
  }

  function handleSave() {
    if (!canSave) return

    const now = new Date().toISOString()

    // Merge the edited fields onto any existing metadata so fields this slice
    // does not surface yet (game type, table size, …) survive an edit. Blank
    // fields are dropped, and an all-empty result collapses to no metadata.
    // Storage re-normalizes, so this only needs to be well-formed, not minimal.
    const metadata: RangeMetadata = { ...editingRange?.metadata }
    if (position) metadata.position = position
    else delete metadata.position
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
    setPosition(range.metadata?.position ?? '')
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

  function handlePractice(range: SavedRange) {
    setPracticingRange(range)
  }

  function handleEndPractice() {
    setPracticingRange(null)
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>Poker Range Trainer</h1>
        <p>
          {practicingRange
            ? 'Test your range recognition.'
            : "Click hands to build a Texas Hold'em preflop range."}
        </p>
      </header>

      {practicingRange ? (
        <PracticeSession range={practicingRange} onExit={handleEndPractice} />
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
            position={position}
            actionType={actionType}
            notes={notes}
            onPositionChange={setPosition}
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
            onLoad={handleLoad}
            onDelete={handleDelete}
            onPractice={handlePractice}
          />
        </>
      )}
    </main>
  )
}

export default App
