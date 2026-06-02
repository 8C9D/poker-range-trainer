import { useRef, type PointerEvent as ReactPointerEvent } from 'react'

interface SwipeHandlers {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
}

interface SwipeOptions {
  /** Minimum horizontal distance (px) to count as a swipe. */
  threshold?: number
  /** Maximum vertical drift (px) allowed for a horizontal swipe. */
  maxVerticalDrift?: number
}

/**
 * Minimal horizontal-swipe detection via pointer events, for touch answers.
 *
 * Returns props to spread onto an element. A `pointerdown`→`pointerup` whose
 * horizontal delta exceeds `threshold` (with limited vertical drift) fires
 * `onSwipeRight` (delta > 0) or `onSwipeLeft` (delta < 0). Buttons remain the
 * primary control; this is an additive convenience.
 */
export function useSwipe(
  { onSwipeLeft, onSwipeRight }: SwipeHandlers,
  { threshold = 50, maxVerticalDrift = 60 }: SwipeOptions = {},
) {
  const start = useRef<{ x: number; y: number } | null>(null)

  function onPointerDown(event: ReactPointerEvent) {
    start.current = { x: event.clientX, y: event.clientY }
  }

  function onPointerUp(event: ReactPointerEvent) {
    const origin = start.current
    start.current = null
    if (!origin) return
    const dx = event.clientX - origin.x
    const dy = event.clientY - origin.y
    if (Math.abs(dx) < threshold || Math.abs(dy) > maxVerticalDrift) return
    if (dx > 0) onSwipeRight?.()
    else onSwipeLeft?.()
  }

  return { onPointerDown, onPointerUp }
}
