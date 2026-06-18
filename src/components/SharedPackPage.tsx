import { useEffect, useState } from 'react'
import { getSharedPack } from '../cloud/sharedPacksRepo'
import { calculateRangePercentage, countSelectedCombos } from '../domain/rangeMath'
import type { PokerHand } from '../domain/pokerHands'
import type { RangePack } from '../domain/rangeTransfer'
import { isCloudConfigured } from '../cloud/cloudConfig'
import { ActionGrid } from './ActionGrid'
import { HandGrid } from './HandGrid'

interface SharedPackPageProps {
  id: string
  token?: string
  /** Injectable fetch (defaults to the cloud repo) so tests run without network. */
  fetchSharedPack?: (id: string, token?: string) => Promise<RangePack | null>
  /** Injectable cloud-config check (defaults to env-gated detection). */
  cloudConfigured?: () => boolean
  /**
   * Save every range in this pack into the viewer's own library ("fork"). When
   * provided, a "Save all to my library" button appears on a loaded pack. The
   * parent owns the actual storage writes; the page only invokes the callback.
   */
  onForkPack?: (pack: RangePack) => void
}

type LoadState =
  | { status: 'loading' }
  | { status: 'unconfigured' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; pack: RangePack }

const noop = () => {}

/**
 * Read-only page for a shared range PACK, reached via the `#/p/:id` route (the
 * bundle counterpart of {@link SharedRangePage}). Fetches the pack from the cloud
 * and renders each contained range read-only, reusing the existing grids.
 */
export function SharedPackPage({
  id,
  token,
  fetchSharedPack = getSharedPack,
  cloudConfigured = isCloudConfigured,
  onForkPack,
}: SharedPackPageProps) {
  // Initialize lazily so the unconfigured case never needs a synchronous
  // setState inside the effect (which the lint config forbids).
  const [state, setState] = useState<LoadState>(() =>
    cloudConfigured() ? { status: 'loading' } : { status: 'unconfigured' },
  )
  // Whether the viewer has already forked this pack into their library.
  const [forked, setForked] = useState(false)

  useEffect(() => {
    if (!cloudConfigured()) return
    let active = true
    fetchSharedPack(id, token)
      .then((pack) => {
        if (!active) return
        setState(pack ? { status: 'ready', pack } : { status: 'not-found' })
      })
      .catch((error: unknown) => {
        if (!active) return
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Could not load shared pack.',
        })
      })
    return () => {
      active = false
    }
  }, [id, token, fetchSharedPack, cloudConfigured])

  if (state.status === 'loading') {
    return (
      <main className="shared-range-page">
        <p>Loading shared pack…</p>
      </main>
    )
  }

  if (state.status === 'unconfigured') {
    return (
      <main className="shared-range-page">
        <p>Shared packs are unavailable in local-only mode.</p>
      </main>
    )
  }

  if (state.status === 'not-found') {
    return (
      <main className="shared-range-page">
        <p>This shared pack was not found. The link may be wrong or no longer shared.</p>
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

  const { pack } = state
  return (
    <main className="shared-range-page">
      <h1>{pack.name || 'Shared pack'}</h1>
      <p>
        {pack.ranges.length} range{pack.ranges.length === 1 ? '' : 's'}
      </p>
      {onForkPack &&
        (forked ? (
          <p className="shared-range-forked" role="status">
            Saved {pack.ranges.length} range{pack.ranges.length === 1 ? '' : 's'} to your library.
          </p>
        ) : (
          <button
            type="button"
            className="primary"
            onClick={() => {
              onForkPack(pack)
              setForked(true)
            }}
          >
            Save all to my library
          </button>
        ))}
      {pack.ranges.length === 0 ? (
        <p>This pack has no ranges.</p>
      ) : (
        pack.ranges.map((range) => {
          const combos = countSelectedCombos(range.hands)
          const percentage = calculateRangePercentage(range.hands)
          return (
            <section key={range.id} className="shared-pack-range">
              <h2>{range.name}</h2>
              <p>
                {range.hands.length} hands · {combos} combos · {percentage.toFixed(1)}%
              </p>
              {range.handActions ? (
                <ActionGrid handActions={range.handActions} onAssign={noop} />
              ) : (
                <HandGrid selected={new Set<PokerHand>(range.hands)} onSetSelected={noop} />
              )}
            </section>
          )
        })
      )}
      <p className="shared-range-note">Read-only shared pack.</p>
    </main>
  )
}
