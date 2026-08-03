import { useEffect, useState } from 'react'
import { getSharedRange } from '../cloud/sharedRangesRepo'
import { countRangeCombos, rangeComboPercentage } from '../domain/comboSelection'
import { areValidHands, type PokerHand } from '../domain/pokerHands'
import { isCloudConfigured } from '../cloud/cloudConfig'
import type { SavedRange } from '../types/range'
import { ActionGrid } from './ActionGrid'
import { HandGrid } from './HandGrid'
import './SharedPage.css'

interface SharedRangePageProps {
  id: string
  token?: string
  /** Injectable fetch (defaults to the cloud repo) so tests run without network. */
  fetchSharedRange?: (id: string, token?: string) => Promise<SavedRange | null>
  /** Injectable cloud-config check (defaults to env-gated detection). */
  cloudConfigured?: () => boolean
  /**
   * Save this shared range into the viewer's own library ("fork"). When
   * provided, a "Save to my library" button appears on a loaded range. The
   * parent owns the actual storage write; the page only invokes the callback.
   */
  onForkRange?: (range: SavedRange) => void
}

type LoadState =
  | { status: 'loading' }
  | { status: 'unconfigured' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; range: SavedRange }

const noop = () => {}

/**
 * Read-only page for a shared range, reached via the `#/r/:id` route. Fetches
 * the range from the cloud and renders it without any editing controls, reusing
 * the existing grid (and action grid when the range carries `handActions`).
 */
export function SharedRangePage({
  id,
  token,
  fetchSharedRange = getSharedRange,
  cloudConfigured = isCloudConfigured,
  onForkRange,
}: SharedRangePageProps) {
  // Initialize lazily so the unconfigured case never needs a synchronous
  // setState inside the effect (which the lint config forbids).
  const [state, setState] = useState<LoadState>(() =>
    cloudConfigured() ? { status: 'loading' } : { status: 'unconfigured' },
  )
  // Whether the viewer has already forked this range into their library, and
  // why the save was refused when the store would not take it.
  const [forked, setForked] = useState(false)
  const [forkError, setForkError] = useState<string | null>(null)

  useEffect(() => {
    if (!cloudConfigured()) return
    let active = true
    fetchSharedRange(id, token)
      .then((range) => {
        if (!active) return
        // A shared range's data is publisher-controlled; reject a payload with
        // non-canonical hands so combo/percentage math can't throw during render.
        setState(
          range && areValidHands(range.hands)
            ? { status: 'ready', range }
            : { status: 'not-found' },
        )
      })
      .catch((error: unknown) => {
        if (!active) return
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Could not load shared range.',
        })
      })
    return () => {
      active = false
    }
  }, [id, token, fetchSharedRange, cloudConfigured])

  if (state.status === 'loading') {
    return (
      <main className="shared-range-page">
        <p>Loading shared range…</p>
      </main>
    )
  }

  if (state.status === 'unconfigured') {
    return (
      <main className="shared-range-page">
        <p>Shared ranges are unavailable in local-only mode.</p>
      </main>
    )
  }

  if (state.status === 'not-found') {
    return (
      <main className="shared-range-page">
        <p>This shared range was not found. The link may be wrong or no longer shared.</p>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="shared-range-page">
        <p role="alert">{state.message}</p>
      </main>
    )
  }

  const { range } = state
  const combos = countRangeCombos(range.hands, range.comboSelections)
  const percentage = rangeComboPercentage(range.hands, range.comboSelections)
  const handActions = range.handActions

  return (
    <main className="shared-range-page">
      <h1>{range.name}</h1>
      <p>
        {range.hands.length} hands · {combos} combos · {percentage.toFixed(1)}%
      </p>
      {handActions ? (
        <ActionGrid handActions={handActions} onAssign={noop} />
      ) : (
        <HandGrid selected={new Set<PokerHand>(range.hands)} onSetSelected={noop} />
      )}
      <p className="shared-range-note">Read-only shared range.</p>
      {onForkRange &&
        (forked ? (
          <p className="shared-range-forked" role="status">
            Saved to your library.
          </p>
        ) : (
          <>
            <button
              type="button"
              className="primary"
              onClick={() => {
                // The parent owns the write, so its failure surfaces here — the
                // page must not claim a save the viewer's store refused.
                try {
                  onForkRange(range)
                } catch (error) {
                  setForkError(
                    error instanceof Error ? error.message : 'Could not save to your library.',
                  )
                  return
                }
                setForkError(null)
                setForked(true)
              }}
            >
              Save to my library
            </button>
            {forkError && (
              <p className="shared-range-error" role="alert">
                {forkError}
              </p>
            )}
          </>
        ))}
    </main>
  )
}
