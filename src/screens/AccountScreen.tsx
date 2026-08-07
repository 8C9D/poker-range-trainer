import { useState } from 'react'
import { buildBackup, parseBackup, restoreBackup, serializeBackup } from '../storage/backup'
import { resetPracticeRecords } from '../storage/statsReset'
import './AccountScreen.css'

/**
 * Trigger a browser download of `text` as `filename`. Inlined from the archived
 * `src/app/rangeFiles.ts` when the whole-library backup was restored without
 * the per-range file exports; restoring that feature supersedes this copy.
 */
function downloadTextFile(filename: string, text: string, mime = 'application/json'): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Account & data: the whole-library backup (export/import) and the
 * practice-record reset. Cloud sync was cut from v1 (archived/cloud-sync/);
 * the app is local-only and the backup file is how data moves between devices.
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

  function handleExportBackup() {
    downloadTextFile(
      `poker-range-trainer-backup-${new Date().toISOString().slice(0, 10)}.json`,
      serializeBackup(buildBackup()),
    )
    setDataStatus('Backup downloaded.')
  }

  async function handleImportBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (
      !window.confirm('Importing a backup REPLACES all your current local data. Continue?')
    ) {
      return
    }
    try {
      restoreBackup(parseBackup(await file.text()))
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not import backup file.')
      return
    }
    setDataStatus('Backup imported — your library was replaced.')
  }

  return (
    <div className="account">
      <h1>Account</h1>

      <section className="coach-card account-section" aria-label="Data">
        <h2>Data</h2>
        <p className="account-note">
          Your ranges and stats live in this browser. Backups include everything: ranges, stats,
          history, review schedules, and your daily goal.
        </p>
        <div className="account-actions">
          <button type="button" className="coach-btn" onClick={handleExportBackup}>
            Export backup
          </button>
          <label className="coach-btn account-file">
            Import backup
            <input type="file" accept="application/json,.json" onChange={handleImportBackup} />
          </label>
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
