import { useEffect, useState } from 'react'
import { getSharedPack } from '../cloud/sharedPacksRepo'
import { countRangeCombos, rangeComboPercentage } from '../domain/comboSelection'
import type { PokerHand } from '../domain/pokerHands'
import { isValidRangePack, type RangePack } from '../domain/rangeTransfer'
import { isCloudConfigured } from '../cloud/cloudConfig'
import { ActionGrid } from './ActionGrid'
import { HandGrid } from './HandGrid'
import './SharedPage.css'

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
  // Whether the viewer has already forked this pack into their library, and why
  // the save was refused when the store would not take it.
  const [forked, setForked] = useState(false)
  const [forkError, setForkError] = useState<string | null>(null)

  useEffect(() => {
    if (!cloudConfigured()) return
    let active = true
    fetchSharedPack(id, token)
      .then((pack) => {
        if (!active) return
        // A shared pack's data is publisher-controlled, so the whole envelope —
        // its own name included, not just the ranges inside it — gets the same
        // structural check an imported file gets.
        setState(isValidRangePack(pack) ? { status: 'ready', pack } : { status: 'not-found' })
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
          <>
            <button
              type="button"
              className="primary"
              onClick={() => {
                // The parent owns the write, so its failure surfaces here — the
                // page must not claim a save the viewer's store refused.
                try {
                  onForkPack(pack)
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
              Save all to my library
            </button>
            {forkError && (
              <p className="shared-range-error" role="alert">
                {forkError}
              </p>
            )}
          </>
        ))}
      {pack.ranges.length === 0 ? (
        <p>This pack has no ranges.</p>
      ) : (
        pack.ranges.map((range) => {
          const combos = countRangeCombos(range.hands, range.comboSelections)
          const percentage = rangeComboPercentage(range.hands, range.comboSelections)
          return (
            <section key={range.id} className="shared-pack-range">
              <h2>{range.name}</h2>
              <p>
                {range.hands.length} hand{range.hands.length === 1 ? '' : 's'} · {combos} combos ·{' '}
                {percentage.toFixed(1)}%
              </p>
              {range.handActions ? (
                <ActionGrid
                  handActions={range.handActions}
                  rangeHands={range.hands}
                  onAssign={noop}
                />
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
