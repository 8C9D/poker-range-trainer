import { lazy, Suspense, useState } from 'react'
import { SharedRangePage } from './components/SharedRangePage'
import { SharedPackPage } from './components/SharedPackPage'
import { parsePackShareRoute, parseShareRoute } from './domain/shareRoute'
import { decodeRangeFromHash } from './domain/rangeTransfer'
import { loadSavedRanges, saveSavedRange } from './storage/rangeStorage'
import { AppShell } from './app/AppShell'
import { createRangeId } from './app/ids'
import { routeHash, useHashRoute } from './app/routes'
import type { PracticeRequest } from './practice/PracticeHost'

// The practice/drill/postflop subtree is large and only rendered once a user
// starts a session, so load it lazily to keep it out of the initial bundle.
const PracticeHost = lazy(() =>
  import('./practice/PracticeHost').then((module) => ({ default: module.PracticeHost })),
)
import { AccountScreen } from './screens/AccountScreen'
import { LibraryScreen } from './screens/LibraryScreen'
import { ProgressScreen } from './screens/ProgressScreen'
import { RangeScreen } from './screens/RangeScreen'
import { TodayScreen } from './screens/TodayScreen'
import type { PokerHand } from './domain/pokerHands'
import type { SavedRange } from './types/range'

/**
 * Import a range shared via a `#range=<hash>` link into local storage once, at
 * module load, then clear the hash so a refresh won't re-import. Doing this
 * before React renders lets the normal `loadSavedRanges()` initializer pick it
 * up without a synchronous setState in an effect. No-op when there's no hash.
 */
function importSharedRangeFromHash() {
  if (typeof window === 'undefined') return
  const match = /^#range=(.+)$/.exec(window.location.hash)
  if (!match) return
  try {
    const shared = decodeRangeFromHash(match[1])
    const now = new Date().toISOString()
    saveSavedRange({ ...shared, id: createRangeId(), createdAt: now, updatedAt: now })
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Could not open shared range.')
  }
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
}

importSharedRangeFromHash()

function App() {
  // A `#/r/:id` share link shows the read-only shared page instead of the app.
  // Parsed once at render; visiting a share link is a fresh page load.
  const shareRoute = typeof window !== 'undefined' ? parseShareRoute(window.location.hash) : null
  if (shareRoute) {
    return (
      <SharedRangePage
        id={shareRoute.id}
        token={shareRoute.token}
        onForkRange={(range) => {
          // Fork: save the shared range into the local library as a new range.
          const now = new Date().toISOString()
          saveSavedRange({ ...range, id: createRangeId(), createdAt: now, updatedAt: now })
        }}
      />
    )
  }

  // A `#/p/:id` link shows the read-only shared PACK page (bundle of ranges).
  const packRoute =
    typeof window !== 'undefined' ? parsePackShareRoute(window.location.hash) : null
  if (packRoute) {
    return (
      <SharedPackPage
        id={packRoute.id}
        token={packRoute.token}
        onForkPack={(pack) => {
          // Fork: save every range in the pack locally as a NEW range, minting a
          // fresh id for each so a shared id never clobbers an existing range.
          const now = new Date().toISOString()
          for (const range of pack.ranges) {
            saveSavedRange({ ...range, id: createRangeId(), createdAt: now, updatedAt: now })
          }
        }}
      />
    )
  }

  return <CoachApp />
}

/**
 * The Coach shell: rail/tab navigation around the routed screens, plus the
 * full-screen practice overlay (mode picker, drills, review queue, summary).
 * Screens unmount while practice runs, so they reload fresh stats from
 * storage when the overlay closes.
 */
function CoachApp() {
  const route = useHashRoute()
  const [practice, setPractice] = useState<PracticeRequest | null>(null)

  function startReview(queue: SavedRange[]) {
    if (queue.length === 0) return
    // The review queue drills recognition straight through, no picker.
    setPractice({ ranges: queue, mode: 'recognize' })
  }

  function startPractice(range: SavedRange, handPool?: PokerHand[]) {
    // A restricted pool (weak hands) goes straight to recognition; otherwise
    // open the mode picker.
    setPractice({ ranges: [range], mode: handPool ? 'recognize' : null, handPool })
  }

  if (practice) {
    return (
      <Suspense
        fallback={<div style={{ position: 'fixed', inset: 0, background: 'var(--bg)' }} aria-busy="true" />}
      >
        <PracticeHost request={practice} onClose={() => setPractice(null)} />
      </Suspense>
    )
  }

  return (
    <AppShell route={route}>
      {route.screen === 'today' ? (
        <TodayScreen onStartReview={startReview} />
      ) : route.screen === 'library' ? (
        <LibraryScreen
          onPlaySpots={(spotFormat) =>
            setPractice({ ranges: loadSavedRanges(), mode: 'spots', spotFormat })
          }
        />
      ) : route.screen === 'range' ? (
        <RangeScreen key={route.id} id={route.id} tab={route.tab} onPractice={startPractice} />
      ) : route.screen === 'newRange' ? (
        <RangeScreen
          key={routeHash(route)}
          id={null}
          tab="edit"
          prefill={route.prefill}
          onPractice={startPractice}
        />
      ) : route.screen === 'progress' ? (
        <ProgressScreen
          onDrillWeakHands={(queue, pools) =>
            setPractice({ ranges: queue, mode: 'recognize', handPools: pools })
          }
        />
      ) : (
        <AccountScreen />
      )}
    </AppShell>
  )
}

export default App
