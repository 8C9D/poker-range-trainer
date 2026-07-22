import { useState } from 'react'
import { createRangeId } from '../app/ids'
import { downloadTextFile } from '../app/rangeFiles'
import { AuthPanel } from '../components/AuthPanel'
import { deleteBackup, pullBackup, pushBackup } from '../cloud/backupRepo'
import {
  publishSharedPack,
  unpublishAllSharedPacks,
  unpublishSharedPack,
} from '../cloud/sharedPacksRepo'
import { unpublishAllSharedRanges } from '../cloud/sharedRangesRepo'
import { useAuthSession } from '../cloud/useAuthSession'
import {
  buildRangePack,
  parseRangeCsv,
  parseRangeExport,
  parseRangePack,
  serializeRangePack,
} from '../domain/rangeTransfer'
import { buildBackup, parseBackup, restoreBackup, serializeBackup } from '../storage/backup'
import { loadSavedRanges, saveSavedRange } from '../storage/rangeStorage'
import type { PokerHand } from '../domain/pokerHands'
import type { SavedRange } from '../types/range'
import './AccountScreen.css'

/**
 * Account & data: cloud auth and sync (gated exactly as before - configured
 * env + signed in), plus local backup/import/export. All handlers are ports
 * of the pre-refactor page's, unchanged in behavior.
 */
export function AccountScreen() {
  const auth = useAuthSession()
  const [syncStatus, setSyncStatus] = useState('')
  const [dataStatus, setDataStatus] = useState('')
  // The pack share id published this session (if any), so it can be unpublished.
  const [publishedPackId, setPublishedPackId] = useState<string | null>(null)

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
        'This permanently deletes your cloud backup AND revokes every share link you have published. Your local data is kept. Continue?',
      )
    ) {
      return
    }
    setSyncStatus('Deleting cloud data…')
    // Best-effort: attempt all three so a failure in one still clears the rest.
    const results = await Promise.allSettled([
      deleteBackup(),
      unpublishAllSharedPacks(),
      unpublishAllSharedRanges(),
    ])
    const failure = results.find((result) => result.status === 'rejected')
    if (failure?.status === 'rejected') {
      const { reason } = failure
      setSyncStatus(reason instanceof Error ? reason.message : 'Delete failed.')
      return
    }
    setPublishedPackId(null)
    setSyncStatus('Deleted your cloud backup and revoked your published share links.')
  }

  async function handlePublishPack() {
    const ranges = loadSavedRanges()
    if (ranges.length === 0) {
      setSyncStatus('No ranges to publish.')
      return
    }
    // OK = public (anyone with the link); Cancel = private (link carries a token).
    const isPublic = window.confirm(
      `Publish all ${ranges.length} ranges as a shareable pack link?\n\nOK = public (anyone with the link can view)\nCancel = private (link includes a secret token)`,
    )
    setSyncStatus('Publishing pack…')
    try {
      const { id, token } = await publishSharedPack(buildRangePack('', ranges), isPublic)
      setPublishedPackId(id)
      const base = `${window.location.origin}${window.location.pathname}#/p/${id}`
      const link = token ? `${base}?t=${token}` : base
      try {
        await navigator.clipboard.writeText(link)
        setSyncStatus('Pack link copied to clipboard.')
      } catch {
        window.prompt('Copy this pack link:', link)
        setSyncStatus('Pack link ready.')
      }
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'Publish failed.')
    }
  }

  async function handleUnpublishPack() {
    if (!publishedPackId) return
    setSyncStatus('Unpublishing pack…')
    try {
      await unpublishSharedPack(publishedPackId)
      setPublishedPackId(null)
      setSyncStatus('Pack link unpublished.')
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'Unpublish failed.')
    }
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

  async function handleImportRange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    let imported: SavedRange
    try {
      imported = parseRangeExport(await file.text())
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not import range file.')
      return
    }
    // Add as a new range with a fresh id so importing never clobbers an existing one.
    const now = new Date().toISOString()
    saveSavedRange({ ...imported, id: createRangeId(), createdAt: now, updatedAt: now })
    setDataStatus(`Imported range “${imported.name}”.`)
  }

  async function handleImportRangeCsv(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    let parsed: { name?: string; hands: PokerHand[] }
    try {
      parsed = parseRangeCsv(await file.text())
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not import CSV file.')
      return
    }
    // The CSV may omit a name; fall back to the file name (sans extension).
    const fallbackName = file.name.replace(/\.csv$/i, '').trim() || 'Imported range'
    const now = new Date().toISOString()
    const name = parsed.name?.trim() || fallbackName
    saveSavedRange({
      id: createRangeId(),
      name,
      hands: parsed.hands,
      createdAt: now,
      updatedAt: now,
    })
    setDataStatus(`Imported range “${name}” from CSV.`)
  }

  function handleExportPack() {
    downloadTextFile(
      `poker-range-pack-${new Date().toISOString().slice(0, 10)}.json`,
      serializeRangePack('', loadSavedRanges()),
    )
    setDataStatus('Pack downloaded.')
  }

  async function handleImportPack(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    let pack: { name?: string; ranges: SavedRange[] }
    try {
      pack = parseRangePack(await file.text())
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not import pack file.')
      return
    }
    // Add every range as a new range so importing never clobbers existing ones.
    const now = new Date().toISOString()
    for (const range of pack.ranges) {
      saveSavedRange({ ...range, id: createRangeId(), createdAt: now, updatedAt: now })
    }
    setDataStatus(
      `Imported ${pack.ranges.length} range${pack.ranges.length === 1 ? '' : 's'} from the pack.`,
    )
  }

  return (
    <div className="account">
      <h1>Account</h1>

      <section className="coach-card account-section" aria-label="Cloud">
        <h3>Cloud</h3>
        {!auth.isCloudConfigured && (
          <p className="account-note">
            Running local-only: your ranges and stats live in this browser. Use the backups below
            to move them between devices.
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
            <button type="button" className="coach-btn" onClick={() => void handlePublishPack()}>
              Publish pack link
            </button>
            {publishedPackId && (
              <button
                type="button"
                className="coach-btn"
                onClick={() => void handleUnpublishPack()}
              >
                Unpublish pack
              </button>
            )}
          </div>
        )}
        {syncStatus && (
          <p className="account-status" role="status">
            {syncStatus}
          </p>
        )}
      </section>

      <section className="coach-card account-section" aria-label="Data">
        <h3>Data</h3>
        <p className="account-note">
          Backups include everything: ranges, stats, history, and review schedules.
        </p>
        <div className="account-actions">
          <button type="button" className="coach-btn" onClick={handleExportBackup}>
            Export backup
          </button>
          <label className="coach-btn account-file">
            Import backup
            <input type="file" accept="application/json,.json" onChange={handleImportBackup} />
          </label>
          <label className="coach-btn account-file">
            Import range
            <input type="file" accept="application/json,.json" onChange={handleImportRange} />
          </label>
          <label className="coach-btn account-file">
            Import CSV
            <input type="file" accept=".csv,text/csv" onChange={handleImportRangeCsv} />
          </label>
          <button type="button" className="coach-btn" onClick={handleExportPack}>
            Export pack
          </button>
          <label className="coach-btn account-file">
            Import pack
            <input type="file" accept="application/json,.json" onChange={handleImportPack} />
          </label>
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
