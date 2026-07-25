import { useMemo, useState } from 'react'
import { createRangeId } from '../app/ids'
import { HandGrid } from '../components/HandGrid'
import { HandNotesEditor } from '../components/HandNotesEditor'
import { RangeMetadataEditor } from '../components/RangeMetadataEditor'
import { RangeNotation } from '../components/RangeNotation'
import { RangeShortcuts } from '../components/RangeShortcuts'
import { RangeTagEditor } from '../components/RangeTagEditor'
import type { HandMixedStrategy } from '../domain/mixedStrategy'
import type { PokerHand } from '../domain/pokerHands'
import { normalizeTags } from '../domain/rangeLibrary'
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
  RangeSource,
  RangeSourceKind,
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
 * The Edit tab: grid painting, shortcuts, notation, scenario metadata, source,
 * and per-hand notes for one range. Ports the legacy editor's save semantics -
 * blank metadata fields are dropped on save, unknown future fields survive via
 * the spread, and editing keeps the range's id and createdAt.
 */
export function RangeEditTab({ range, onSaved }: RangeEditTabProps) {
  const [name, setName] = useState(range?.name ?? '')
  const [selected, setSelected] = useState<Set<PokerHand>>(() => new Set(range?.hands ?? []))
  const [gameType, setGameType] = useState<GameType | ''>(range?.metadata?.gameType ?? '')
  const [tableSize, setTableSize] = useState<TableSize | ''>(range?.metadata?.tableSize ?? '')
  const [stackDepth, setStackDepth] = useState(
    range?.metadata?.stackDepthBb !== undefined ? String(range.metadata.stackDepthBb) : '',
  )
  const [position, setPosition] = useState<Position | ''>(range?.metadata?.position ?? '')
  const [versusPosition, setVersusPosition] = useState<Position | ''>(
    range?.metadata?.versusPosition ?? '',
  )
  const [actionType, setActionType] = useState<ActionType | ''>(
    range?.metadata?.actionType ?? '',
  )
  const [notes, setNotes] = useState(range?.metadata?.notes ?? '')
  const [sourceKind, setSourceKind] = useState<RangeSourceKind | ''>(range?.source?.kind ?? '')
  const [sourceReference, setSourceReference] = useState(range?.source?.reference ?? '')
  const [notesDraft, setNotesDraft] = useState<Record<PokerHand, string>>({
    ...(range?.handNotes ?? {}),
  })
  const [tagsDraft, setTagsDraft] = useState<string[]>(() => range?.tags ?? [])
  // Snapshots of the per-hand overlays taken when the tab mounts. Saving prunes
  // them to the selected hands (see `handleSave`), but they are read from here so
  // re-selecting a hand in the same editing session restores its data, exactly
  // like the per-hand notes draft.
  const [mixedSnapshot] = useState<Record<PokerHand, HandMixedStrategy>>(() => ({
    ...(range?.mixedStrategies ?? {}),
  }))
  const [combosSnapshot] = useState<Record<PokerHand, string[]>>(() => ({
    ...(range?.comboSelections ?? {}),
  }))
  // Status line confirming the last save, cleared on the next change.
  const [savedName, setSavedName] = useState<string | null>(null)

  // Derived from `selected` only, so memoize to skip the hand-set math on every
  // unrelated re-render (e.g. each keystroke in the name field).
  const selectedHands = useMemo(() => normalizeRangeHands(Array.from(selected)), [selected])
  const combos = useMemo(() => countSelectedCombos(selectedHands), [selectedHands])
  const percentage = useMemo(() => calculateRangePercentage(selectedHands), [selectedHands])

  function setHandSelected(hand: PokerHand, shouldSelect: boolean) {
    setSavedName(null)
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

    const trimmedReference = sourceReference.trim()
    const source: RangeSource | undefined = sourceKind
      ? { kind: sourceKind, ...(trimmedReference ? { reference: trimmedReference } : {}) }
      : undefined

    let saved: SavedRange
    if (range) {
      saved = { ...range, name: trimmedName, hands: selectedHands, updatedAt: now }
      if (hasMetadata) saved.metadata = metadata
      else delete saved.metadata
      if (source) saved.source = source
      else delete saved.source
    } else {
      saved = {
        id: createRangeId(),
        name: trimmedName,
        hands: selectedHands,
        createdAt: now,
        updatedAt: now,
      }
      if (hasMetadata) saved.metadata = metadata
      if (source) saved.source = source
    }
    // Keep only notes for hands still in the range so deselecting a hand does
    // not leave an orphaned, unreachable note behind. Storage then drops blank
    // per-hand notes and collapses an empty map.
    const prunedNotes: Record<PokerHand, string> = {}
    for (const hand of selectedHands) {
      const note = notesDraft[hand]
      if (note && note.trim().length > 0) prunedNotes[hand] = note
    }
    saved.handNotes = prunedNotes
    // Same for the other per-hand overlays: a mixed strategy or combo selection for
    // a hand that left the range is unreachable in its editor (both list only the
    // range's hands) yet would still drive the frequency quiz and the grids.
    const prunedMixed: Record<PokerHand, HandMixedStrategy> = {}
    const prunedCombos: Record<PokerHand, string[]> = {}
    for (const hand of selectedHands) {
      const strategy = mixedSnapshot[hand]
      if (strategy && strategy.length > 0) prunedMixed[hand] = strategy
      const combos = combosSnapshot[hand]
      if (combos && combos.length > 0) prunedCombos[hand] = combos
    }
    if (Object.keys(prunedMixed).length > 0) saved.mixedStrategies = prunedMixed
    else delete saved.mixedStrategies
    if (Object.keys(prunedCombos).length > 0) saved.comboSelections = prunedCombos
    else delete saved.comboSelections
    // Persist cleaned tags, or drop the field entirely when none remain.
    const savedTags = normalizeTags(tagsDraft)
    if (savedTags.length > 0) saved.tags = savedTags
    else delete saved.tags
    saveSavedRange(saved)
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
          onClick={() => {
            setSavedName(null)
            setSelected(new Set())
          }}
          disabled={selected.size === 0}
        >
          Clear Selection
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
      </section>

      <HandGrid selected={selected} onSetSelected={setHandSelected} />

      <section className="range-edit-summary coach-tabular" aria-label="Range summary">
        <span>{selectedHands.length} hands selected</span>
        <span>{combos} combos</span>
        <span>{percentage.toFixed(1)}% of all hands</span>
      </section>

      <RangeShortcuts
        onAddHands={(hands) => {
          setSavedName(null)
          setSelected((prev) => new Set(mergeShortcutHands(Array.from(prev), hands)))
        }}
      />

      <RangeNotation
        selectedHands={selectedHands}
        onReplaceHands={(hands) => {
          setSavedName(null)
          setSelected(new Set(hands))
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

      <RangeTagEditor
        tags={tagsDraft}
        onChange={(next) => {
          setSavedName(null)
          setTagsDraft(next)
        }}
      />

      {selectedHands.length > 0 && (
        <HandNotesEditor hands={selectedHands} notes={notesDraft} onChange={setNotesDraft} />
      )}
    </div>
  )
}
