import { useState } from 'react'
import { resetPracticeRecords } from '../storage/statsReset'
import './AccountScreen.css'

/**
 * Account & data: the practice-record reset. Cloud sync was cut from v1
 * (archived/cloud-sync/); the app is local-only.
 */
export function AccountScreen() {
  const [dataStatus, setDataStatus] = useState('')

  /**
   * Run a write that the store may refuse, reporting the reason instead of
   * letting it escape. The write happens inside a click handler, where an
   * uncaught throw reaches no error boundary: the action simply did nothing
   * and said nothing. Returns whether the write landed, so the caller only
   * claims success when there was some.
   */
  function persist(write: () => void, fallback: string): boolean {
    try {
      write()
    } catch (error) {
      setDataStatus(error instanceof Error ? error.message : fallback)
      return false
    }
    return true
  }

  function handleResetStats() {
    if (
      !window.confirm(
        'Clear all practice stats, history, review schedules and spot accuracy? Your ranges and daily goal are kept. This cannot be undone.',
      )
    ) {
      return
    }
    if (!persist(() => resetPracticeRecords(), 'Could not reset your practice stats.')) return
    setDataStatus('Practice stats cleared — your ranges are untouched.')
  }

  return (
    <div className="account">
      <h1>Account</h1>

      <section className="coach-card account-section" aria-label="Data">
        <h2>Data</h2>
        <p className="account-note">
          Your ranges and stats live in this browser.
        </p>
        <div className="account-actions">
          {/* The only clean slate that keeps the charts: deleting ranges takes
              their records with them, and clearing site data takes everything. */}
          <button type="button" className="coach-btn" onClick={handleResetStats}>
            Reset practice stats
          </button>
        </div>
        {dataStatus && (
          <p className="account-status" role="status">
            {dataStatus}
          </p>
        )}
      </section>
    </div>
  )
}
