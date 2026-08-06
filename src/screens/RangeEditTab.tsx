import { useEffect, useMemo, useState } from 'react'
import { createRangeId } from '../app/ids'
import { HandGrid } from '../components/HandGrid'
import { RangeMetadataEditor } from '../components/RangeMetadataEditor'
import { RangeShortcuts } from '../components/RangeShortcuts'
import type { HandMixedStrategy } from '../domain/mixedStrategy'
import type { PokerHand } from '../domain/pokerHands'
import {
  createHandSelectionHistory,
  recordHandSelection,
  redoHandSelection,
  undoHandSelection,
} from '../domain/handSelectionHistory'
import { describeScenario, scenarioSuggestionFor } from '../domain/scenarioFromName'
import {
  calculateRangePercentage,
  countSelectedCombos,
  normalizeRangeHands,
} from '../domain/rangeMath'
import { mergeShortcutHands } from '../domain/rangeShortcuts'
import { saveSavedRange } from '../storage/rangeStorage'
import type {
  ActionType,
  GameType,
  Position,
  RangeMetadata,
  SavedRange,
  TableSize,
} from '../types/range'

interface RangeEditTabProps {
  /** The saved range being edited, or null when composing a new range. */
  range: SavedRange | null
  /** Called with the persisted range after every successful save. */
  onSaved: (range: SavedRange) => void
}

/**
 * The Edit tab: grid painting, shortcuts, and scenario metadata for one range.
 * Ports the legacy editor's save semantics - blank metadata fields are dropped
 * on save, unknown future fields survive via the spread, and editing keeps the
 * range's id and createdAt. Stored per-hand overlays (actions, frequencies,
 * combo selections, notes) and tags are carried through a save untouched: their
 * editors are out of v1, but the data must survive an edit.
 */
export function RangeEditTab({ range, onSaved }: RangeEditTabProps) {
  const initial = range?.metadata
  const [name, setName] = useState(range?.name ?? '')
  const [selectionHistory, setSelectionHistory] = useState(() =>
    createHandSelectionHistory(range?.hands ?? []),
  )
  const selected = useMemo(() => new Set(selectionHistory.present), [selectionHistory.present])
  const [gameType, setGameType] = useState<GameType | ''>(initial?.gameType ?? '')
  const [tableSize, setTableSize] = useState<TableSize | ''>(initial?.tableSize ?? '')
  const [stackDepth, setStackDepth] = useState(
    initial?.stackDepthBb !== undefined ? String(initial.stackDepthBb) : '',
  )
  const [position, setPosition] = useState<Position | ''>(initial?.position ?? '')
  const [versusPosition, setVersusPosition] = useState<Position | ''>(initial?.versusPosition ?? '')
  const [actionType, setActionType] = useState<ActionType | ''>(initial?.actionType ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  // Mount-time snapshots of the per-hand overlay maps. Storage scopes them to the
  // range's hands on every save, so a transient deselect would silently destroy
  // data whose editors are out of v1; saving re-attaches a snapshot entry when
  // its hand is selected again in the same editing session.
  const [notesSnapshot] = useState<Record<PokerHand, string>>(() => ({
    ...(range?.handNotes ?? {}),
  }))
  const [mixedSnapshot] = useState<Record<PokerHand, HandMixedStrategy>>(() => ({
    ...(range?.mixedStrategies ?? {}),
  }))
  const [combosSnapshot] = useState<Record<PokerHand, string[]>>(() => ({
    ...(range?.comboSelections ?? {}),
  }))
  // Status line confirming the last save, cleared on the next change.
  const [savedName, setSavedName] = useState<string | null>(null)
  // Why the last save did not land (a full or unavailable browser store). Without
  // this the throw escapes the click handler, where no error boundary sees it, and
  // the button just appears to do nothing.
  const [saveError, setSaveError] = useState<string | null>(null)

  // Derived from `selected` only, so memoize to skip the hand-set math on every
  // unrelated re-render (e.g. each keystroke in the name field). Counts use the
  // hand-class model only: stored per-combo selections are ignored, so a range
  // whose AA is narrowed to one combo still counts all six.
  const selectedHands = useMemo(() => normalizeRangeHands(Array.from(selected)), [selected])
  const combos = useMemo(() => countSelectedCombos(selectedHands), [selectedHands])
  const percentage = useMemo(() => calculateRangePercentage(selectedHands), [selectedHands])

  function setHandSelected(hand: PokerHand, shouldSelect: boolean) {
    setSavedName(null)
    setSelectionHistory((history) => {
      const prev = new Set(history.present)
      if (prev.has(hand) === shouldSelect) return history
      const next = new Set(prev)
      if (shouldSelect) {
        next.add(hand)
      } else {
        next.delete(hand)
      }
      return recordHandSelection(history, next)
    })
  }

  function replaceSelection(hands: Iterable<PokerHand>) {
    setSavedName(null)
    setSelectionHistory((history) => recordHandSelection(history, hands))
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return
      }
      event.preventDefault()
      setSavedName(null)
      setSelectionHistory(event.shiftKey ? redoHandSelection : undoHandSelection)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Blank means "no stack depth"; a non-empty value must parse to a positive,
  // finite number (matching storage's rule). Invalid input blocks saving.
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

  // What the name says that the fields do not — recomputed as either changes, so
  // the offer narrows field by field as they are filled and disappears when the
  // name has nothing left to add.
  const scenarioSuggestion = useMemo(
    () =>
      scenarioSuggestionFor(trimmedName, {
        ...(tableSize ? { tableSize } : {}),
        ...(stackDepthValue !== undefined ? { stackDepthBb: stackDepthValue } : {}),
        ...(position ? { position } : {}),
        ...(versusPosition ? { versusPosition } : {}),
        ...(actionType ? { actionType } : {}),
      }),
    [trimmedName, tableSize, stackDepthValue, position, versusPosition, actionType],
  )

  function useScenarioSuggestion() {
    if (!scenarioSuggestion) return
    setSavedName(null)
    if (scenarioSuggestion.tableSize) setTableSize(scenarioSuggestion.tableSize)
    if (scenarioSuggestion.stackDepthBb !== undefined) {
      setStackDepth(String(scenarioSuggestion.stackDepthBb))
    }
    if (scenarioSuggestion.position) setPosition(scenarioSuggestion.position)
    if (scenarioSuggestion.versusPosition) setVersusPosition(scenarioSuggestion.versusPosition)
    if (scenarioSuggestion.actionType) setActionType(scenarioSuggestion.actionType)
  }
  let saveHint = ''
  if (trimmedName.length === 0 && selected.size === 0) {
    saveHint = 'Enter a range name and select at least one hand to save.'
  } else if (trimmedName.length === 0) {
    saveHint = 'Enter a range name to save.'
  } else if (selected.size === 0) {
    saveHint = 'Select at least one hand to save.'
  } else if (stackDepthError) {
    saveHint = 'Fix the stack depth to save.'
  }

  function handleSave() {
    if (!canSave) return
    const now = new Date().toISOString()

    // Merge the edited fields onto any existing metadata so unknown future
    // fields survive an edit; blank fields are dropped, and an all-empty
    // result collapses to no metadata.
    const metadata: RangeMetadata = { ...range?.metadata }
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

    // The spread keeps every stored field this editor no longer touches —
    // source, tags, per-hand notes, actions, frequencies, combo selections —
    // so archived-feature data survives an edit intact.
    let saved: SavedRange
    if (range) {
      saved = { ...range, name: trimmedName, hands: selectedHands, updatedAt: now }
      if (hasMetadata) saved.metadata = metadata
      else delete saved.metadata
    } else {
      saved = {
        id: createRangeId(),
        name: trimmedName,
        hands: selectedHands,
        createdAt: now,
        updatedAt: now,
      }
      if (hasMetadata) saved.metadata = metadata
    }
    // Re-attach snapshot overlay entries for the hands being saved, so a hand
    // deselected and re-selected in this session keeps its data (storage would
    // otherwise have scoped it out at the earlier save).
    function fromSnapshot<T>(snapshot: Record<PokerHand, T>): Record<PokerHand, T> | undefined {
      const kept: Record<PokerHand, T> = {}
      for (const hand of selectedHands) {
        const value = snapshot[hand]
        if (value !== undefined) kept[hand] = value
      }
      return Object.keys(kept).length > 0 ? kept : undefined
    }
    const keptNotes = fromSnapshot(notesSnapshot)
    if (keptNotes) saved.handNotes = keptNotes
    else delete saved.handNotes
    const keptMixed = fromSnapshot(mixedSnapshot)
    if (keptMixed) saved.mixedStrategies = keptMixed
    else delete saved.mixedStrategies
    const keptCombos = fromSnapshot(combosSnapshot)
    if (keptCombos) saved.comboSelections = keptCombos
    else delete saved.comboSelections
    try {
      saveSavedRange(saved)
    } catch (error) {
      setSavedName(null)
      setSaveError(error instanceof Error ? error.message : 'Could not save this range.')
      return
    }
    setSaveError(null)
    setSavedName(saved.name)
    onSaved(saved)
  }

  return (
    <div className="range-edit-tab">
      <section className="coach-card range-edit-controls" aria-label="Range editor">
        <input
          type="text"
          className="coach-input range-edit-name"
          placeholder="Range name"
          aria-label="Range name"
          value={name}
          onChange={(event) => {
            setSavedName(null)
            setName(event.target.value)
          }}
        />
        <button
          type="button"
          className="coach-btn"
          onClick={handleSave}
          disabled={!canSave}
          aria-describedby={saveHint ? 'range-edit-save-hint' : undefined}
        >
          {range ? 'Save Changes' : 'Save Range'}
        </button>
        <button
          type="button"
          className="coach-btn quiet"
          onClick={() => replaceSelection([])}
          disabled={selected.size === 0}
        >
          Clear Selection
        </button>
        <button
          type="button"
          className="coach-btn quiet"
          onClick={() => {
            setSavedName(null)
            setSelectionHistory(undoHandSelection)
          }}
          disabled={selectionHistory.past.length === 0}
        >
          Undo
        </button>
        <button
          type="button"
          className="coach-btn quiet"
          onClick={() => {
            setSavedName(null)
            setSelectionHistory(redoHandSelection)
          }}
          disabled={selectionHistory.future.length === 0}
        >
          Redo
        </button>
        {saveHint && (
          <p id="range-edit-save-hint" className="range-edit-hint">
            {saveHint}
          </p>
        )}
        {savedName && (
          <p className="range-edit-hint" role="status">
            Saved “{savedName}”.
          </p>
        )}
        {saveError && (
          <p className="range-edit-error" role="alert">
            {saveError}
          </p>
        )}
      </section>

      <HandGrid selected={selected} onSetSelected={setHandSelected} />

      <section className="range-edit-summary coach-tabular" aria-label="Range summary">
        <span>
          {selectedHands.length} hand{selectedHands.length === 1 ? '' : 's'} selected
        </span>
        <span>{combos} combos</span>
        <span>{percentage.toFixed(1)}% of all hands</span>
      </section>

      <RangeShortcuts
        onAddHands={(hands) => {
          replaceSelection(mergeShortcutHands(Array.from(selected), hands))
        }}
      />

      <RangeMetadataEditor
        gameType={gameType}
        tableSize={tableSize}
        stackDepth={stackDepth}
        stackDepthError={stackDepthError}
        position={position}
        versusPosition={versusPosition}
        actionType={actionType}
        notes={notes}
        scenarioFromName={scenarioSuggestion ? describeScenario(scenarioSuggestion) : null}
        onUseScenarioFromName={useScenarioSuggestion}
        onGameTypeChange={(value) => {
          setSavedName(null)
          setGameType(value)
        }}
        onTableSizeChange={(value) => {
          setSavedName(null)
          setTableSize(value)
        }}
        onStackDepthChange={(value) => {
          setSavedName(null)
          setStackDepth(value)
        }}
        onPositionChange={(value) => {
          setSavedName(null)
          setPosition(value)
        }}
        onVersusPositionChange={(value) => {
          setSavedName(null)
          setVersusPosition(value)
        }}
        onActionTypeChange={(value) => {
          setSavedName(null)
          setActionType(value)
        }}
        onNotesChange={(value) => {
          setSavedName(null)
          setNotes(value)
        }}
      />
    </div>
  )
}
