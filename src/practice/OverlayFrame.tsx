import { useEffect, useRef, type ReactNode } from 'react'
import './practice.css'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface OverlayFrameProps {
  /** The range (or drill) name shown in the top bar. */
  title: string
  /** Optional queue position, e.g. "2/5", shown next to the title. */
  position?: string | null
  /** Progress toward the session's end, 0..1; omit to hide the bar. */
  progress?: number | null
  onClose: () => void
  closeLabel?: string
  children: ReactNode
}

/**
 * The full-screen practice overlay chrome: close button, always-visible
 * progress bar, and the session title. Every practice mode renders inside
 * this frame so the drill language stays consistent.
 */
export function OverlayFrame({
  title,
  position = null,
  progress = null,
  onClose,
  closeLabel = 'Close practice',
  children,
}: OverlayFrameProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  // Latest onClose via a ref so the dialog effect can stay mount-only (it must
  // capture the pre-open focus once and restore it exactly once on close).
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const dialog = dialogRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null
    const focusables = () =>
      dialog ? Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) : []

    // Move focus into the dialog so keyboard/AT users start inside the modal.
    ;(focusables()[0] ?? dialog)?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const items = focusables()
      if (items.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      // Trap Tab so focus can't wander into the inert background behind the modal.
      if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      } else if (active && !dialog.contains(active)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      previouslyFocused?.focus?.()
    }
  }, [])

  return (
    <div
      ref={dialogRef}
      className="practice-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
    >
      <div className="practice-overlay-bar">
        <button type="button" className="practice-overlay-close" aria-label={closeLabel} onClick={onClose}>
          ×
        </button>
        {progress !== null && (
          <div
            className="practice-overlay-progress"
            role="progressbar"
            aria-label="Session progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(Math.min(1, Math.max(0, progress)) * 100)}
          >
            <div
              className="practice-overlay-progress-fill"
              style={{ width: `${Math.min(1, Math.max(0, progress)) * 100}%` }}
            />
          </div>
        )}
        <span className="practice-overlay-title coach-tabular">
          {title}
          {position ? ` · ${position}` : ''}
        </span>
      </div>
      <div className="practice-overlay-content">{children}</div>
    </div>
  )
}
