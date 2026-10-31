import { useCallback, useEffect, useRef } from 'react'
import { useBlocker } from 'react-router'

export interface UnsavedGuard {
  /** Lets the next navigation through, for a screen that is leaving because it saved. */
  release: () => void
}

/**
 * Keeps unsaved work from vanishing: a page unload gets the browser's own prompt,
 * and any navigation inside the app (a link, the Back button, a redirect) asks
 * first. The ref, not `unsaved` itself, decides, so a save that navigates in the
 * same tick as it clears its state is not stopped by the render it has not had.
 */
export function useUnsavedGuard(unsaved: boolean, message: string): UnsavedGuard {
  const guarded = useRef(unsaved)
  useEffect(() => {
    guarded.current = unsaved
  }, [unsaved])

  const blocker = useBlocker(() => guarded.current)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm(message)) blocker.proceed()
    else blocker.reset()
  }, [blocker, message])

  useEffect(() => {
    if (!unsaved) return
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', preventUnload)
    return () => window.removeEventListener('beforeunload', preventUnload)
  }, [unsaved])

  const release = useCallback(() => {
    guarded.current = false
  }, [])
  return { release }
}
