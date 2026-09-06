import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'

import type { RangeRead, ScenarioMetadata } from '@poker-range-trainer/contracts'
import {
  ACTION_TYPES,
  ACTION_TYPE_LABELS,
  GAME_TYPES,
  GAME_TYPE_LABELS,
  POSITIONS,
  POSITION_LABELS,
  TABLE_SIZES,
  TABLE_SIZE_LABELS,
} from '@poker-range-trainer/domain/types/range'

import { HandGrid } from '@/components/hand-grid'
import { ApiClientError, createRange, getRange, updateRange } from '@/lib/api-client'

const gameTypes = GAME_TYPES.map((value) => [value, GAME_TYPE_LABELS[value]] as const)
const tableSizes = TABLE_SIZES.map((value) => [value, TABLE_SIZE_LABELS[value]] as const)
const positions = POSITIONS.map((value) => [value, POSITION_LABELS[value]] as const)
const actions = ACTION_TYPES.map((value) => [value, ACTION_TYPE_LABELS[value]] as const)

type MetadataForm = Record<keyof ScenarioMetadata, string>

function emptyMetadata(): MetadataForm {
  return {
    gameType: '',
    tableSize: '',
    stackDepthBb: '',
    position: '',
    versusPosition: '',
    actionType: '',
    notes: '',
  }
}

function metadataToForm(metadata: ScenarioMetadata | null): MetadataForm {
  if (!metadata) return emptyMetadata()
  return {
    gameType: metadata.gameType ?? '',
    tableSize: metadata.tableSize ?? '',
    stackDepthBb: metadata.stackDepthBb === undefined ? '' : String(metadata.stackDepthBb),
    position: metadata.position ?? '',
    versusPosition: metadata.versusPosition ?? '',
    actionType: metadata.actionType ?? '',
    notes: metadata.notes ?? '',
  }
}

function formMetadata(form: MetadataForm): ScenarioMetadata | undefined {
  const stackDepthBb = form.stackDepthBb === '' ? undefined : Number(form.stackDepthBb)
  const metadata: ScenarioMetadata = {
    ...(form.gameType ? { gameType: form.gameType as ScenarioMetadata['gameType'] } : {}),
    ...(form.tableSize ? { tableSize: form.tableSize as ScenarioMetadata['tableSize'] } : {}),
    ...(stackDepthBb === undefined ? {} : { stackDepthBb }),
    ...(form.position ? { position: form.position as ScenarioMetadata['position'] } : {}),
    ...(form.versusPosition
      ? { versusPosition: form.versusPosition as ScenarioMetadata['versusPosition'] }
      : {}),
    ...(form.actionType ? { actionType: form.actionType as ScenarioMetadata['actionType'] } : {}),
    ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
  }
  return Object.keys(metadata).length === 0 ? undefined : metadata
}

function problemMessage(error: unknown): string {
  return error instanceof ApiClientError
    ? error.message
    : 'We could not save this range. Try again.'
}

interface RangeEditorProps {
  rangeId?: string
}

export function RangeEditor({ rangeId }: RangeEditorProps) {
  const navigate = useNavigate()
  const nameId = useId()
  const notesId = useId()
  const [loaded, setLoaded] = useState<RangeRead>()
  const [loading, setLoading] = useState(rangeId !== undefined)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [notFound, setNotFound] = useState(false)
  const [name, setName] = useState('')
  const [hands, setHands] = useState<Set<string>>(new Set())
  const [metadataEnabled, setMetadataEnabled] = useState(false)
  const [metadata, setMetadata] = useState<MetadataForm>(emptyMetadata)
  const [pending, setPending] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string>()
  const [conflict, setConflict] = useState(false)

  const applyRange = useCallback((range: RangeRead): void => {
    setLoaded(range)
    setName(range.name)
    setHands(new Set(range.hands))
    setMetadataEnabled(range.metadata !== null)
    setMetadata(metadataToForm(range.metadata))
    setDirty(false)
    setError(undefined)
    setConflict(false)
  }, [])

  useEffect(() => {
    if (!rangeId) return
    let active = true
    getRange(rangeId)
      .then((response) => {
        if (active) applyRange(response.data)
      })
      .catch((caught: unknown) => {
        if (!active) return
        if (caught instanceof ApiClientError && caught.status === 404) setNotFound(true)
        else setError(problemMessage(caught))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [rangeId, loadAttempt, applyRange])

  useEffect(() => {
    if (!dirty) return
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const protectInternalNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return
      const target =
        event.target instanceof Element ? event.target.closest('a[href^="/app"]') : null
      if (target && !window.confirm('Discard unsaved range changes?')) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', preventUnload)
    document.addEventListener('click', protectInternalNavigation, true)
    return () => {
      window.removeEventListener('beforeunload', preventUnload)
      document.removeEventListener('click', protectInternalNavigation, true)
    }
  }, [dirty])

  function reloadSaved(): void {
    setLoading(true)
    setNotFound(false)
    setLoadAttempt((attempt) => attempt + 1)
  }

  function updateMetadata(key: keyof MetadataForm, value: string): void {
    setMetadata((current) => ({ ...current, [key]: value }))
    setDirty(true)
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (hands.size === 0) {
      setError('Select at least one starting hand before saving.')
      return
    }
    const nextMetadata = formMetadata(metadata)
    if (metadataEnabled && !nextMetadata) {
      setError('Add at least one scenario detail, or turn scenario metadata off to clear it.')
      return
    }
    setPending(true)
    setError(undefined)
    setConflict(false)
    try {
      if (rangeId && loaded) {
        const response = await updateRange(rangeId, {
          version: loaded.version,
          name: name.trim(),
          hands: [...hands],
          metadata: metadataEnabled ? nextMetadata : null,
        })
        applyRange(response.data)
      } else {
        const response = await createRange({
          name: name.trim(),
          hands: [...hands],
          ...(metadataEnabled && nextMetadata ? { metadata: nextMetadata } : {}),
        })
        setDirty(false)
        navigate(`/app/library/${encodeURIComponent(response.data.id)}`)
      }
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.status === 409) {
        setConflict(true)
        setError('This range changed elsewhere. Your unsaved edits are still here.')
      } else if (caught instanceof ApiClientError && caught.status === 404) {
        setNotFound(true)
        setError('This range no longer exists.')
      } else {
        setError(problemMessage(caught))
      }
    } finally {
      setPending(false)
    }
  }

  if (loading)
    return (
      <p className="library-state" aria-busy="true">
        Loading range…
      </p>
    )
  if (notFound) {
    return (
      <section className="library-state" role="alert">
        <h1>Range not found</h1>
        <p>This range may have been deleted or you may no longer have access to it.</p>
        <Link className="button button-primary" to="/app/library">
          Back to library
        </Link>
      </section>
    )
  }

  const editing = rangeId !== undefined
  return (
    <section className="editor" aria-labelledby="editor-title">
      <div className="editor-heading">
        <div>
          <p className="eyebrow">Range library</p>
          <h1 id="editor-title">{editing ? 'Edit range' : 'Build a range'}</h1>
          <p className="app-lede">
            Select the hand classes that belong in this preflop spot, then add optional context.
          </p>
        </div>
        <div className="editor-heading-actions">
          {rangeId !== undefined ? (
            <Link className="text-link" to={`/app/practice?range=${encodeURIComponent(rangeId)}`}>
              Practice this range
            </Link>
          ) : null}
          <Link className="text-link" to="/app/library">
            Cancel
          </Link>
        </div>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {conflict ? (
        <button className="button button-small" type="button" onClick={reloadSaved}>
          Reload current saved range
        </button>
      ) : null}
      <form className="editor-form" onSubmit={(event) => void save(event)}>
        <div className="field">
          <label htmlFor={nameId}>Range name</label>
          <input
            id={nameId}
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setDirty(true)
            }}
            required
            minLength={1}
            maxLength={120}
            placeholder="e.g. BTN open, 100bb"
          />
        </div>
        <HandGrid
          selectedHands={hands}
          onChange={(nextHands) => {
            setHands(nextHands)
            setDirty(true)
          }}
        />
        <section className="metadata-panel" aria-labelledby="metadata-title">
          <div className="metadata-toggle">
            <div>
              <h2 id="metadata-title">Scenario metadata</h2>
              <p className="quiet">Optional context is replaced as a whole whenever you save.</p>
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={metadataEnabled}
                onChange={(event) => {
                  setMetadataEnabled(event.target.checked)
                  setDirty(true)
                }}
              />
              Include context
            </label>
          </div>
          {metadataEnabled ? (
            <div className="metadata-fields">
              <SelectField
                label="Game"
                options={gameTypes}
                value={metadata.gameType}
                onChange={(value) => updateMetadata('gameType', value)}
              />
              <SelectField
                label="Table"
                options={tableSizes}
                value={metadata.tableSize}
                onChange={(value) => updateMetadata('tableSize', value)}
              />
              <div className="field">
                <label htmlFor={`${nameId}-stack`}>Stack depth (bb)</label>
                <input
                  id={`${nameId}-stack`}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={metadata.stackDepthBb}
                  onChange={(event) => updateMetadata('stackDepthBb', event.target.value)}
                />
              </div>
              <SelectField
                label="Your position"
                options={positions}
                value={metadata.position}
                onChange={(value) => updateMetadata('position', value)}
              />
              <SelectField
                label="Versus position"
                options={positions}
                value={metadata.versusPosition}
                onChange={(value) => updateMetadata('versusPosition', value)}
              />
              <SelectField
                label="Action"
                options={actions}
                value={metadata.actionType}
                onChange={(value) => updateMetadata('actionType', value)}
              />
              <div className="field metadata-notes">
                <label htmlFor={notesId}>Notes</label>
                <textarea
                  id={notesId}
                  maxLength={2000}
                  value={metadata.notes}
                  onChange={(event) => updateMetadata('notes', event.target.value)}
                />
              </div>
            </div>
          ) : (
            <p className="quiet">
              {editing
                ? 'Saving with this off clears all saved scenario metadata.'
                : 'No scenario metadata will be saved.'}
            </p>
          )}
        </section>
        <div className="editor-actions">
          <button
            className="button button-primary"
            type="submit"
            disabled={pending || hands.size === 0}
          >
            {pending ? 'Saving…' : editing ? 'Save changes' : 'Create range'}
          </button>
          <Link className="text-link" to="/app/library">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  )
}

function SelectField({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly (readonly [string, string])[]
  value: string
  onChange: (value: string) => void
}) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Not specified</option>
        {options.map(([optionValue, text]) => (
          <option key={optionValue} value={optionValue}>
            {text}
          </option>
        ))}
      </select>
    </div>
  )
}
