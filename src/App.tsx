import { useState } from 'react'
import { HandGrid } from './components/HandGrid'
import { PracticeSession } from './components/PracticeSession'
import { RangeLibrary } from './components/RangeLibrary'
import { calculateRangePercentage, countSelectedCombos } from './domain/rangeMath'
import type { PokerHand } from './domain/pokerHands'
import { deleteSavedRange, loadSavedRanges, saveSavedRange } from './storage/rangeStorage'
import type { SavedRange } from './types/range'
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

  function toggleHand(hand: PokerHand) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(hand)) {
        next.delete(hand)
      } else {
        next.add(hand)
      }
      return next
    })
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

  function resetEditor() {
    setName('')
    setSelected(new Set())
    setEditingId(null)
  }

  function handleSave() {
    if (!canSave) return

    const now = new Date().toISOString()
    // Updating an existing range keeps its id and createdAt; a new one gets both fresh.
    const range: SavedRange = editingRange
      ? { ...editingRange, name: trimmedName, hands: selectedHands, updatedAt: now }
      : {
          id: createRangeId(),
          name: trimmedName,
          hands: selectedHands,
          createdAt: now,
          updatedAt: now,
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
            </div>
            {editingRange && (
              <p className="editing-indicator" role="status">
                Editing saved range: <strong>{editingRange.name}</strong>
              </p>
            )}
            {saveHint && <p className="editor-hint">{saveHint}</p>}
          </section>

          <HandGrid selected={selected} onToggle={toggleHand} />

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
