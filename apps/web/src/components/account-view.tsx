import { useEffect, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router'

import {
  MAX_LEGACY_BACKUP_BYTES,
  assertLegacyBackupSize,
  legacyBackupV1Schema,
  resetPracticeStatsResponseSchema,
  type LegacyBackupCommitResponse,
  type LegacyBackupCounts,
  type LegacyBackupPreviewResponse,
  type LegacyBackupV1,
  type LegacyImportConflict,
  type LegacyPreservationWarning,
} from '@poker-range-trainer/contracts'
import type { z } from 'zod'

import { GoalSelect } from '@/components/goal-select'
import {
  ApiClientError,
  commitLegacyBackup,
  exportBackup,
  getCurrentUser,
  getTrainingGoal,
  previewLegacyBackup,
  resetPracticeStats,
  updateTrainingGoal,
} from '@/lib/api-client'

type BackupPreview = LegacyBackupPreviewResponse['data']
type CommitOutcome = LegacyBackupCommitResponse['data']
type ResetOutcome = z.infer<typeof resetPracticeStatsResponseSchema>['data']
type ImportStrategy = CommitOutcome['strategy']

/** How many validation issues and preservation warnings are worth reading. */
const MAX_LISTED_DETAILS = 8

const COUNT_LABELS: readonly (readonly [keyof LegacyBackupCounts, string])[] = [
  ['ranges', 'Ranges'],
  ['practiceStats', 'Range totals'],
  ['handAccuracy', 'Hand accuracy records'],
  ['actionAccuracy', 'Action accuracy records'],
  ['sessions', 'Practice sessions'],
  ['reviewStates', 'Review schedules'],
  ['spotAccuracy', 'Spot accuracy records'],
]

const WARNING_LABELS: Record<LegacyPreservationWarning['kind'], string> = {
  dormant_range_fields: 'Dormant range field',
  unknown_backup_fields: 'Unknown backup field',
  retired_accuracy_records: 'Retired accuracy records',
}

/** What each conflict kind means for the person choosing how to import. */
const CONFLICT_MEANINGS: Record<LegacyImportConflict['kind'], string> = {
  already_imported:
    'You have imported this exact file before. Importing it again would not add anything.',
  range_id_collision:
    'Some ranges in the file are already in your library. Merge leaves the copies you have alone and skips them; Replace archives your current library first.',
  merge_required:
    'Your library already has ranges, so this import has to either merge into it or replace it.',
}

type AccountState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; email: string | null; goal: number | null }

/**
 * The import runs one step at a time and never skips ahead: nothing is read
 * until a file is chosen, nothing is uploaded until it validates here, and
 * nothing is written until a strategy is picked from a preview.
 */
type ImportStage =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'rejected'; message: string; details: string[] }
  | { kind: 'previewed'; backup: LegacyBackupV1; preview: BackupPreview }
  | { kind: 'committed'; outcome: CommitOutcome }

function messageFor(error: unknown, fallback: string): string {
  return error instanceof ApiClientError ? error.message : fallback
}

function pathLabel(path: readonly (string | number)[]): string {
  return path.length === 0 ? 'backup' : path.map(String).join('.')
}

/** The first few schema complaints, as "where: what". */
function describeIssues(error: z.ZodError): string[] {
  return error.issues
    .slice(0, MAX_LISTED_DETAILS)
    .map((issue) => `${pathLabel(issue.path.map(String))}: ${issue.message}`)
}

async function loadAccount(): Promise<AccountState> {
  try {
    const [session, goal] = await Promise.all([getCurrentUser(), getTrainingGoal()])
    return {
      status: 'ready',
      email: session.data.authenticated ? session.data.user.email : null,
      goal: goal.data.dailyHandsGoal,
    }
  } catch (error) {
    return { status: 'error', message: messageFor(error, 'We could not load your account.') }
  }
}

/**
 * Hand `text` to the browser as a download named `filename`.
 *
 * The export arrives as JSON over the authenticated API rather than as a link,
 * so the file has to be built here: an object URL, one throwaway anchor, and
 * the URL released again as soon as the click has been dispatched.
 */
function downloadJson(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/** Account and data: the daily goal, the backup file, and the practice reset. */
export function AccountView() {
  const [state, setState] = useState<AccountState>({ status: 'loading' })
  const [loadAttempt, setLoadAttempt] = useState(0)

  const [savingGoal, setSavingGoal] = useState(false)
  const [goalError, setGoalError] = useState<string>()

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string>()
  const [exportNotice, setExportNotice] = useState<string>()

  const [stage, setStage] = useState<ImportStage>({ kind: 'idle' })
  const [committing, setCommitting] = useState(false)
  const [commitError, setCommitError] = useState<string>()
  const [replaceAcknowledged, setReplaceAcknowledged] = useState(false)

  const [resetAcknowledged, setResetAcknowledged] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState<string>()
  const [resetOutcome, setResetOutcome] = useState<ResetOutcome>()

  useEffect(() => {
    let active = true
    void loadAccount().then((next) => {
      if (active) setState(next)
    })
    return () => {
      active = false
    }
  }, [loadAttempt])

  function retry(): void {
    setState({ status: 'loading' })
    setLoadAttempt((attempt) => attempt + 1)
  }

  async function saveGoal(nextTarget: number | null): Promise<void> {
    setSavingGoal(true)
    setGoalError(undefined)
    try {
      const response = await updateTrainingGoal(nextTarget)
      setState((current) =>
        current.status === 'ready' ? { ...current, goal: response.data.dailyHandsGoal } : current,
      )
    } catch (error) {
      setGoalError(messageFor(error, 'Could not save the daily goal.'))
    } finally {
      setSavingGoal(false)
    }
  }

  async function downloadBackup(): Promise<void> {
    setExporting(true)
    setExportError(undefined)
    setExportNotice(undefined)
    try {
      const { backup } = (await exportBackup()).data
      // The day the server took the snapshot, so the file name matches the
      // `exportedAt` inside it rather than the reader's clock.
      const day = backup.exportedAt.slice(0, 10)
      downloadJson(`poker-range-trainer-backup-${day}.json`, JSON.stringify(backup, null, 2))
      setExportNotice(`Backup downloaded as poker-range-trainer-backup-${day}.json.`)
    } catch (error) {
      setExportError(messageFor(error, 'Could not export your backup.'))
    } finally {
      setExporting(false)
    }
  }

  async function preview(backup: LegacyBackupV1): Promise<void> {
    setStage({ kind: 'checking' })
    setCommitError(undefined)
    try {
      const response = await previewLegacyBackup(backup)
      setStage({ kind: 'previewed', backup, preview: response.data })
    } catch (error) {
      setStage({
        kind: 'rejected',
        message: messageFor(error, 'We could not check that backup.'),
        details: [],
      })
    }
  }

  /**
   * Validate the chosen file here before it goes anywhere. Size is checked
   * against the file's metadata first, so an oversized backup is never read
   * into memory, and the schema runs locally so a malformed file is refused
   * without an upload.
   */
  async function chooseFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    // Clearing the input lets the same file be picked again after a rejection.
    event.target.value = ''
    if (!file) return
    setReplaceAcknowledged(false)
    setCommitError(undefined)

    try {
      assertLegacyBackupSize(file.size)
    } catch {
      const megabytes = Math.floor(MAX_LEGACY_BACKUP_BYTES / (1024 * 1024))
      setStage({
        kind: 'rejected',
        message: `That file is ${file.size} bytes. A backup has to be smaller than ${megabytes} MB, so it was not read.`,
        details: [],
      })
      return
    }

    setStage({ kind: 'checking' })
    let text: string
    try {
      text = await file.text()
    } catch {
      setStage({ kind: 'rejected', message: 'We could not read that file.', details: [] })
      return
    }

    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(text)
    } catch {
      setStage({
        kind: 'rejected',
        message: 'That file is not valid JSON, so there is nothing to import.',
        details: [],
      })
      return
    }

    const parsed = legacyBackupV1Schema.safeParse(parsedJson)
    if (!parsed.success) {
      setStage({
        kind: 'rejected',
        message: 'That file is not a version 1 backup this app can read.',
        details: describeIssues(parsed.error),
      })
      return
    }
    await preview(parsed.data)
  }

  async function commit(backup: LegacyBackupV1, digest: string, strategy: ImportStrategy) {
    setCommitting(true)
    setCommitError(undefined)
    try {
      const response = await commitLegacyBackup({ backup, expectedDigest: digest, strategy })
      setStage({ kind: 'committed', outcome: response.data })
      // An import can carry its own daily goal, so re-read rather than leaving
      // the picker showing the target this account had a moment ago.
      setLoadAttempt((attempt) => attempt + 1)
    } catch (error) {
      setCommitError(messageFor(error, 'Could not import that backup.'))
    } finally {
      setCommitting(false)
    }
  }

  async function runReset(): Promise<void> {
    setResetting(true)
    setResetError(undefined)
    try {
      setResetOutcome((await resetPracticeStats()).data)
      setResetAcknowledged(false)
    } catch (error) {
      setResetError(messageFor(error, 'Could not reset your practice stats.'))
    } finally {
      setResetting(false)
    }
  }

  if (state.status === 'loading') {
    return (
      <p className="library-state" aria-busy="true">
        Loading your account…
      </p>
    )
  }
  if (state.status === 'error') {
    return (
      <section className="library-state" role="alert">
        <h1>We could not load your account</h1>
        <p>{state.message}</p>
        <button className="button button-primary" type="button" onClick={retry}>
          Try again
        </button>
      </section>
    )
  }

  return (
    <section className="account-view" aria-labelledby="account-title">
      <h1 id="account-title">Account</h1>

      <section className="account-card" aria-labelledby="account-signed-in">
        <h2 id="account-signed-in">Signed in</h2>
        <p className="account-value">{state.email ?? 'Not signed in'}</p>
        <p className="account-note">
          Sign out from the <strong>Sign out</strong> button in the header.
        </p>
      </section>

      <section className="account-card" aria-labelledby="account-goal">
        <div className="account-card-head">
          <h2 id="account-goal">Daily goal</h2>
          <GoalSelect
            className="today-goal-picker"
            label="Daily goal in hands"
            target={state.goal}
            disabled={savingGoal}
            onChange={(nextTarget) => void saveGoal(nextTarget)}
          />
        </div>
        <p className="account-note">
          How many hands a day counts as training. Today shows the progress against it.
        </p>
        {goalError ? (
          <p className="form-error" role="alert">
            {goalError}
          </p>
        ) : null}
      </section>

      <section className="account-card" aria-labelledby="account-export">
        <h2 id="account-export">Export backup</h2>
        <p className="account-note">
          Downloads everything — ranges, stats, history, review schedules and your daily goal — as
          one JSON file. It is the same version 1 format the original on-device app reads and
          writes, so the file works in both.
        </p>
        <div className="account-buttons">
          <button
            className="button button-primary"
            type="button"
            onClick={() => void downloadBackup()}
            disabled={exporting}
          >
            {exporting ? 'Preparing…' : 'Export backup'}
          </button>
        </div>
        {exportError ? (
          <p className="form-error" role="alert">
            {exportError}
          </p>
        ) : null}
        {exportNotice ? (
          <p className="success-notice" role="status">
            {exportNotice}
          </p>
        ) : null}
      </section>

      <section className="account-card" aria-labelledby="account-import">
        <h2 id="account-import">Import legacy backup</h2>
        <p className="account-note">
          Choose a backup exported by the on-device app. Nothing is uploaded or changed until you
          have seen what the file contains and chosen how to import it; the file itself is never
          modified.
        </p>
        <div className="field account-file">
          <label htmlFor="account-import-file">Backup file</label>
          <input
            id="account-import-file"
            type="file"
            accept="application/json,.json"
            disabled={stage.kind === 'checking' || committing}
            onChange={(event) => void chooseFile(event)}
          />
        </div>

        {stage.kind === 'checking' ? (
          <p className="account-note" aria-busy="true">
            Checking that backup…
          </p>
        ) : null}

        {stage.kind === 'rejected' ? (
          <div className="account-rejected" role="alert">
            <p className="form-error">{stage.message}</p>
            {stage.details.length > 0 ? (
              <ul className="account-detail-list">
                {stage.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {stage.kind === 'previewed' ? (
          <ImportPreview
            preview={stage.preview}
            committing={committing}
            commitError={commitError}
            replaceAcknowledged={replaceAcknowledged}
            onAcknowledgeReplace={setReplaceAcknowledged}
            onCommit={(strategy) => void commit(stage.backup, stage.preview.digest, strategy)}
            onPreviewAgain={() => void preview(stage.backup)}
          />
        ) : null}

        {stage.kind === 'committed' ? (
          <div className="account-committed">
            <p className="success-notice" role="status">
              Imported {stage.outcome.counts.ranges} ranges by{' '}
              {stage.outcome.strategy === 'merge' ? 'merging' : 'replacing'}. Nothing was written
              until the whole file landed.
            </p>
            <CountsTable counts={stage.outcome.counts} caption="What was imported" />
            <div className="account-buttons">
              <Link className="button button-primary" to="/app/library">
                Open library
              </Link>
              <Link className="text-link" to="/app/today">
                Back to Today
              </Link>
            </div>
          </div>
        ) : null}
      </section>

      <section className="account-card" aria-labelledby="account-reset">
        <h2 id="account-reset">Reset practice stats</h2>
        <p className="account-note">
          Deletes your practice sessions, per-range totals, hand accuracy and review schedule. Your
          ranges and your daily goal are kept. This cannot be undone.
        </p>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={resetAcknowledged}
            disabled={resetting}
            onChange={(event) => setResetAcknowledged(event.target.checked)}
          />
          I understand
        </label>
        <div className="account-buttons">
          <button
            className="button danger-button"
            type="button"
            disabled={!resetAcknowledged || resetting}
            onClick={() => void runReset()}
          >
            {resetting ? 'Resetting…' : 'Reset practice stats'}
          </button>
        </div>
        {resetError ? (
          <p className="form-error" role="alert">
            {resetError}
          </p>
        ) : null}
        {resetOutcome ? (
          <p className="success-notice" role="status">
            Practice stats cleared for {resetOutcome.rangesReset}{' '}
            {resetOutcome.rangesReset === 1 ? 'range' : 'ranges'}. Your ranges are untouched.
          </p>
        ) : null}
      </section>
    </section>
  )
}

function CountsTable({ counts, caption }: { counts: LegacyBackupCounts; caption: string }) {
  return (
    <table className="account-counts">
      <caption>{caption}</caption>
      <tbody>
        {COUNT_LABELS.map(([key, label]) => (
          <tr key={key}>
            <th scope="row">{label}</th>
            <td>{counts[key]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

interface ImportPreviewProps {
  preview: BackupPreview
  committing: boolean
  commitError: string | undefined
  replaceAcknowledged: boolean
  onAcknowledgeReplace: (acknowledged: boolean) => void
  onCommit: (strategy: ImportStrategy) => void
  onPreviewAgain: () => void
}

/**
 * What the file holds, what would be preserved rather than shown, and what the
 * library already disagrees with — then the one decision left to make.
 */
function ImportPreview({
  preview,
  committing,
  commitError,
  replaceAcknowledged,
  onAcknowledgeReplace,
  onCommit,
  onPreviewAgain,
}: ImportPreviewProps) {
  const warnings = preview.preservationWarnings
  const listedWarnings = warnings.slice(0, MAX_LISTED_DETAILS)

  return (
    <div className="account-preview">
      <h3>Preview</h3>
      <CountsTable counts={preview.counts} caption="What this file contains" />

      {warnings.length > 0 ? (
        <div>
          <h3>Kept, but not shown in this app</h3>
          <ul className="account-detail-list">
            {listedWarnings.map((warning) => (
              <li key={`${warning.kind}:${pathLabel(warning.path)}`}>
                <span className="account-detail-kind">{WARNING_LABELS[warning.kind]}</span>{' '}
                <code>{pathLabel(warning.path)}</code> — {warning.message}
              </li>
            ))}
          </ul>
          {warnings.length > listedWarnings.length ? (
            <p className="account-note">
              …and {warnings.length - listedWarnings.length} more, all stored with the import
              record.
            </p>
          ) : null}
        </div>
      ) : null}

      {preview.conflicts.length > 0 ? (
        <div>
          <h3>Before you import</h3>
          <ul className="account-detail-list">
            {preview.conflicts.map((conflict) => (
              <li key={conflict.kind}>
                <span className="account-detail-kind">{CONFLICT_MEANINGS[conflict.kind]}</span>{' '}
                {conflict.message}
                {conflict.rangeIds.length > 0 ? (
                  <span className="account-note"> Ranges: {conflict.rangeIds.join(', ')}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {preview.alreadyImported ? (
        <p className="account-note">
          This backup is already in your library, so there is nothing to import.
        </p>
      ) : (
        <div className="account-choice">
          <div className="account-buttons">
            <button
              className="button button-primary"
              type="button"
              disabled={committing}
              onClick={() => onCommit('merge')}
            >
              {committing ? 'Importing…' : 'Merge'}
            </button>
            <span className="account-note">Adds the new ranges and skips the ones you have.</span>
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={replaceAcknowledged}
              disabled={committing}
              onChange={(event) => onAcknowledgeReplace(event.target.checked)}
            />
            I understand this replaces my current library
          </label>
          <div className="account-buttons">
            <button
              className="button danger-button"
              type="button"
              disabled={!replaceAcknowledged || committing}
              onClick={() => onCommit('replace')}
            >
              {committing ? 'Importing…' : 'Replace'}
            </button>
            <span className="account-note">
              Archives everything in the library first, then imports the file.
            </span>
          </div>
        </div>
      )}

      {commitError ? (
        <div className="account-rejected" role="alert">
          <p className="form-error">{commitError}</p>
          <button className="text-button" type="button" onClick={onPreviewAgain}>
            Preview again
          </button>
        </div>
      ) : null}
    </div>
  )
}
