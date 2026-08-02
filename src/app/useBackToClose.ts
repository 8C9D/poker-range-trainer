import { useEffect, useRef } from 'react'

/**
 * Make the browser Back button close a full-screen session.
 *
 * The practice and workout hosts are React state, not routes: they cover the
 * whole shell while the URL still points at the screen underneath. Left alone,
 * Back walks the app's own history out from under an open drill (or leaves the
 * site entirely) while the drill stays on screen, and the only way out is the
 * small close button. Opening a session instead pushes a duplicate history entry
 * (same URL, so nothing re-routes and no `hashchange` fires); Back pops it, which
 * closes the session and leaves the user exactly where they started.
 */

/** Marker on the history entry a session pushes, so pops can be told apart. */
interface SessionHistoryState {
  practiceSession?: boolean
}

export function useBackToClose(open: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return

    window.history.pushState({ practiceSession: true } satisfies SessionHistoryState, '')
    let closedByPop = false

    function handlePopState(event: PopStateEvent) {
      // Landing back on one of our own entries is React re-running this effect
      // (StrictMode's double mount) unwinding itself, not the user pressing Back.
      if ((event.state as SessionHistoryState | null)?.practiceSession) return
      closedByPop = true
      onCloseRef.current()
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      // Closed some other way (the close button, or the session finishing): drop
      // the entry we pushed so the next Back is not a dead press.
      if (!closedByPop) window.history.back()
    }
  }, [open])
}
