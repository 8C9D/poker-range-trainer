import { useState } from 'react'
import { AuthPanel } from '../components/AuthPanel'
import { deleteBackup, pullBackup, pushBackup } from '../cloud/backupRepo'
import { useAuthSession } from '../cloud/useAuthSession'
import { buildBackup, restoreBackup } from '../storage/backup'
import { resetPracticeRecords } from '../storage/statsReset'
import './AccountScreen.css'

/**
 * Account & data: cloud auth and sync (gated exactly as before - configured
 * env + signed in), plus the practice-record reset.
 */
export function AccountScreen() {
  const auth = useAuthSession()
  const [syncStatus, setSyncStatus] = useState('')
  const [dataStatus, setDataStatus] = useState('')

  async function handlePushSync() {
    setSyncStatus('Pushing…')
    try {
      await pushBackup(buildBackup())
      setSyncStatus('Pushed your full library to the cloud.')
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'Push failed.')
    }
  }

  async function handlePullSync() {
    if (
      !window.confirm(
        'Pulling from the cloud REPLACES all your local data with the cloud copy. Continue?',
      )
    ) {
      return
    }
    setSyncStatus('Pulling…')
    try {
      const cloudBackup = await pullBackup()
      if (!cloudBackup) {
        setSyncStatus('No cloud backup found yet. Push first.')
        return
      }
      restoreBackup(cloudBackup)
      setSyncStatus('Pulled your full library from the cloud.')
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'Pull failed.')
    }
  }

  async function handleDeleteCloudData() {
    if (
      !window.confirm(
        'This permanently deletes your cloud backup. Your local data is kept. Continue?',
      )
    ) {
      return
    }
    setSyncStatus('Deleting cloud data…')
    try {
      await deleteBackup()
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'Delete failed.')
      return
    }
    setSyncStatus('Deleted your cloud backup.')
  }

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

      <section className="coach-card account-section" aria-label="Cloud">
        <h2>Cloud</h2>
        {!auth.isCloudConfigured && (
          <p className="account-note">
            Running local-only: your ranges and stats live in this browser.
          </p>
        )}
        <AuthPanel isCloudConfigured={auth.isCloudConfigured} session={auth.session} />
        {auth.session && (
          <div className="account-actions" aria-label="Cloud sync">
            <button type="button" className="coach-btn" onClick={() => void handlePushSync()}>
              Push to cloud
            </button>
            <button type="button" className="coach-btn" onClick={() => void handlePullSync()}>
              Pull from cloud
            </button>
            <button
              type="button"
              className="coach-btn"
              onClick={() => void handleDeleteCloudData()}
            >
              Delete cloud data
            </button>
          </div>
        )}
        {syncStatus && (
          <p className="account-status" role="status">
            {syncStatus}
          </p>
        )}
      </section>

      <section className="coach-card account-section" aria-label="Data">
        <h2>Data</h2>
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
