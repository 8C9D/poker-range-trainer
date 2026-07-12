import type { ReactNode } from 'react'
import './practice.css'

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
  return (
    <div className="practice-overlay" role="dialog" aria-label={title}>
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
