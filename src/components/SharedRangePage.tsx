import { useEffect, useState } from 'react'
import { getSharedRange } from '../cloud/sharedRangesRepo'
import { calculateRangePercentage, countSelectedCombos } from '../domain/rangeMath'
import type { PokerHand } from '../domain/pokerHands'
import { isCloudConfigured } from '../cloud/cloudConfig'
import type { SavedRange } from '../types/range'
import { ActionGrid } from './ActionGrid'
import { HandGrid } from './HandGrid'

interface SharedRangePageProps {
  id: string
  token?: string
  /** Injectable fetch (defaults to the cloud repo) so tests run without network. */
  fetchSharedRange?: (id: string, token?: string) => Promise<SavedRange | null>
  /** Injectable cloud-config check (defaults to env-gated detection). */
  cloudConfigured?: () => boolean
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
}: SharedRangePageProps) {
  // Initialize lazily so the unconfigured case never needs a synchronous
  // setState inside the effect (which the lint config forbids).
  const [state, setState] = useState<LoadState>(() =>
    cloudConfigured() ? { status: 'loading' } : { status: 'unconfigured' },
  )

  useEffect(() => {
    if (!cloudConfigured()) return
    let active = true
    fetchSharedRange(id, token)
      .then((range) => {
        if (!active) return
        setState(range ? { status: 'ready', range } : { status: 'not-found' })
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
  const combos = countSelectedCombos(range.hands)
  const percentage = calculateRangePercentage(range.hands)
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
    </main>
  )
}
