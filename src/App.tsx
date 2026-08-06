import { lazy, Suspense, useCallback, useState, type ReactNode } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AppShell } from './app/AppShell'
import { routeHash, useHashRoute } from './app/routes'
import { useBackToClose } from './app/useBackToClose'
import type { PracticeRequest } from './practice/PracticeHost'

// The practice/drill subtree is large and only rendered once a user starts a
// session, so load it lazily to keep it out of the initial bundle.
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

function App() {
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

  const closePractice = useCallback(() => setPractice(null), [])
  useBackToClose(practice !== null, closePractice)

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
      <SessionChunk onGiveUp={closePractice}>
        <PracticeHost request={practice} onClose={closePractice} />
      </SessionChunk>
    )
  }

  return (
    <AppShell route={route}>
      {route.screen === 'today' ? (
        <TodayScreen
          onStartReview={startReview}
          onDrillWeakHands={(queue, pools) =>
            setPractice({ ranges: queue, mode: 'recognize', handPools: pools })
          }
        />
      ) : route.screen === 'library' ? (
        <LibraryScreen onPracticeSelected={startReview} />
      ) : route.screen === 'range' ? (
        <RangeScreen key={route.id} id={route.id} tab={route.tab} onPractice={startPractice} />
      ) : route.screen === 'newRange' ? (
        <RangeScreen key={routeHash(route)} id={null} tab="edit" onPractice={startPractice} />
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

/**
 * The wrapper the lazily-loaded practice subtree is mounted in: its Suspense
 * fallback, plus a boundary that keeps a failed chunk load inside the session.
 *
 * Without it the failure reaches the ROOT boundary, which replaces the entire
 * app — and its "Try again" cannot recover: React caches a rejected `lazy`
 * promise, so re-rendering the same subtree throws the same error forever.
 * Offline, before the practice chunk has ever been fetched, that is one tap on
 * "Start review" away. Here, giving up just closes the session and hands the
 * rest of the app back, which always works; a reload is offered because that is
 * what actually clears a chunk the app could not fetch.
 */
function SessionChunk({ children, onGiveUp }: { children: ReactNode; onGiveUp: () => void }) {
  return (
    <ErrorBoundary
      fallback={() => (
        <main className="error-boundary">
          <div className="coach-card error-boundary-card" role="alert">
            <h1>Could not load practice</h1>
            <p className="error-boundary-message">
              This part of the app has not been downloaded yet, and it could not be fetched just
              now. Reconnect and reload to finish the download — everything already saved is
              untouched.
            </p>
            <div className="error-boundary-actions">
              <button type="button" className="coach-btn primary" onClick={onGiveUp}>
                Back to the app
              </button>
              <button
                type="button"
                className="coach-btn"
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
            </div>
          </div>
        </main>
      )}
    >
      <Suspense
        fallback={
          <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)' }} aria-busy="true" />
        }
      >
        {children}
      </Suspense>
    </ErrorBoundary>
  )
}

export default App
