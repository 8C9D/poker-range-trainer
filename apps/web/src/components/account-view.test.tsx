import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import {
  MAX_LEGACY_BACKUP_BYTES,
  legacyBackupCommitResponseSchema,
  legacyBackupExportResponseSchema,
  legacyBackupPreviewResponseSchema,
  legacyBackupV1Schema,
  type LegacyBackupV1,
} from '@poker-range-trainer/contracts'

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
import { renderAt } from '@/test/router'

import { AccountView } from './account-view'

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>()
  return {
    ...actual,
    getCurrentUser: vi.fn(),
    getTrainingGoal: vi.fn(),
    updateTrainingGoal: vi.fn(),
    exportBackup: vi.fn(),
    previewLegacyBackup: vi.fn(),
    commitLegacyBackup: vi.fn(),
    resetPracticeStats: vi.fn(),
  }
})

const currentUser = vi.mocked(getCurrentUser)
const trainingGoal = vi.mocked(getTrainingGoal)
const saveGoal = vi.mocked(updateTrainingGoal)
const downloadBackup = vi.mocked(exportBackup)
const previewBackup = vi.mocked(previewLegacyBackup)
const commitBackup = vi.mocked(commitLegacyBackup)
const resetStats = vi.mocked(resetPracticeStats)

const ownerId = '7a7e6f3e-17be-4b69-a31b-1f902417c560'
const digest = `sha256:${'a'.repeat(64)}`

const backup: LegacyBackupV1 = legacyBackupV1Schema.parse({
  version: 1,
  exportedAt: '2026-02-01T09:15:00.000Z',
  ranges: [
    {
      id: 'rng-1',
      name: 'BTN open',
      hands: ['AA', 'AKs'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      tags: ['6-max'],
    },
  ],
  practiceStats: {},
  handAccuracy: {},
  actionAccuracy: {},
  sessionHistory: {},
  reviewStates: {},
  trainingGoal: 50,
})

const counts = {
  ranges: 1,
  practiceStats: 0,
  handAccuracy: 0,
  actionAccuracy: 0,
  sessions: 0,
  reviewStates: 0,
  spotAccuracy: 0,
}

const previewData = legacyBackupPreviewResponseSchema.parse({
  data: {
    digest,
    counts,
    preservationWarnings: [
      {
        kind: 'dormant_range_fields',
        path: ['ranges', 0, 'tags'],
        message: 'Range "rng-1" carries the dormant field "tags".',
      },
    ],
    conflicts: [
      {
        kind: 'merge_required',
        rangeIds: [],
        message: 'The library is not empty, so the import must merge into it or replace it.',
      },
    ],
    alreadyImported: false,
  },
}).data

const alreadyImportedPreview = legacyBackupPreviewResponseSchema.parse({
  data: {
    digest,
    counts,
    preservationWarnings: [],
    conflicts: [
      {
        kind: 'already_imported',
        rangeIds: [],
        message: 'This backup was already imported; importing it again would change nothing.',
      },
    ],
    alreadyImported: true,
  },
}).data

function commitResponse(strategy: 'merge' | 'replace') {
  return legacyBackupCommitResponseSchema.parse({
    data: { result: 'committed', atomic: true, digest, strategy, counts },
  })
}

function backupFile(text = JSON.stringify(backup), name = 'backup.json') {
  return new File([text], name, { type: 'application/json' })
}

function readyAccount(): void {
  currentUser.mockResolvedValue({
    data: {
      authenticated: true,
      user: { id: ownerId, email: 'player@example.test', createdAt: '2026-01-02T03:04:05.000Z' },
    },
  })
  trainingGoal.mockResolvedValue({
    data: { dailyHandsGoal: 20, updatedAt: '2026-01-02T03:04:05.000Z' },
  })
}

/** Render and wait for the loaded page. */
async function renderAccount() {
  const user = userEvent.setup()
  renderAt(<AccountView />, '/app/account')
  await screen.findByRole('heading', { level: 1, name: 'Account' })
  return user
}

/** Choose `file` in the import picker and wait for the preview request. */
async function chooseBackup(user: ReturnType<typeof userEvent.setup>, file: File) {
  await user.upload(screen.getByLabelText('Backup file'), file)
}

describe('AccountView', () => {
  afterEach(cleanup)

  beforeEach(() => {
    readyAccount()
  })

  it('shows the signed-in email, points at the header sign-out, and saves the daily goal', async () => {
    saveGoal.mockResolvedValueOnce({
      data: { dailyHandsGoal: 40, updatedAt: '2026-01-02T03:04:06.000Z' },
    })
    const user = await renderAccount()

    expect(screen.getByText('player@example.test')).toBeInTheDocument()
    expect(screen.getByText(/button in the header/)).toBeInTheDocument()

    const picker = screen.getByRole('combobox', { name: 'Daily goal in hands' })
    expect(picker).toHaveValue('20')
    await user.selectOptions(picker, '40')
    expect(saveGoal).toHaveBeenCalledWith(40)
    await waitFor(() => expect(picker).toHaveValue('40'))
  })

  it('downloads the export as a dated JSON file and releases the object URL', async () => {
    downloadBackup.mockResolvedValueOnce(
      legacyBackupExportResponseSchema.parse({ data: { backup } }),
    )
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:backup')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    // Catch the throwaway anchor as it is clicked, and stop jsdom from trying
    // to follow the blob URL.
    let anchor: HTMLAnchorElement | undefined
    const captureDownload = (event: Event) => {
      if (event.target instanceof HTMLAnchorElement) {
        anchor = event.target
        event.preventDefault()
      }
    }
    document.addEventListener('click', captureDownload, true)
    onTestFinished(() => document.removeEventListener('click', captureDownload, true))

    const user = await renderAccount()
    await user.click(screen.getByRole('button', { name: 'Export backup' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'poker-range-trainer-backup-2026-02-01.json',
    )
    expect(anchor?.download).toBe('poker-range-trainer-backup-2026-02-01.json')
    expect(anchor?.getAttribute('href')).toBe('blob:backup')
    // The anchor is a throwaway: it must not be left in the document.
    expect(anchor?.isConnected).toBe(false)
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:backup')
  })

  it('reports an export failure and keeps the page usable', async () => {
    downloadBackup.mockRejectedValueOnce(
      new ApiClientError('network', 'We could not reach the server.'),
    )
    const user = await renderAccount()
    await user.click(screen.getByRole('button', { name: 'Export backup' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not reach the server.')
    expect(screen.getByRole('button', { name: 'Export backup' })).toBeEnabled()
  })

  it('previews a chosen backup, gates Replace behind the checkbox, and commits with the digest', async () => {
    previewBackup.mockResolvedValueOnce({ data: previewData })
    commitBackup.mockResolvedValueOnce(commitResponse('replace'))
    const user = await renderAccount()

    await chooseBackup(user, backupFile())

    const countsTable = await screen.findByRole('table', { name: 'What this file contains' })
    const rangesRow = within(countsTable).getByRole('row', { name: /Ranges/ })
    expect(within(rangesRow).getByRole('cell')).toHaveTextContent('1')
    expect(screen.getByText(/carries the dormant field "tags"/)).toBeInTheDocument()
    expect(screen.getByText('ranges.0.tags')).toBeInTheDocument()
    expect(
      screen.getByText(/has to either merge into it or replace it/, { selector: 'span' }),
    ).toBeInTheDocument()

    const replace = screen.getByRole('button', { name: 'Replace' })
    expect(replace).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Merge' })).toBeEnabled()

    await user.click(
      screen.getByRole('checkbox', { name: 'I understand this replaces my current library' }),
    )
    expect(replace).toBeEnabled()
    await user.click(replace)

    await waitFor(() =>
      expect(commitBackup).toHaveBeenCalledWith({
        backup,
        expectedDigest: digest,
        strategy: 'replace',
      }),
    )
    expect(await screen.findByRole('status')).toHaveTextContent('Imported 1 ranges by replacing')
    expect(screen.getByRole('table', { name: 'What was imported' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open library' })).toHaveAttribute(
      'href',
      '/app/library',
    )
    // A backup carries its own daily goal, so the page re-reads it after commit.
    await waitFor(() => expect(trainingGoal).toHaveBeenCalledTimes(2))
  })

  it('refuses an oversized file without reading it or uploading anything', async () => {
    const user = await renderAccount()
    const file = backupFile()
    Object.defineProperty(file, 'size', { value: MAX_LEGACY_BACKUP_BYTES + 1 })
    const read = vi.spyOn(file, 'text')

    await chooseBackup(user, file)

    expect(await screen.findByRole('alert')).toHaveTextContent('has to be smaller than 64 MB')
    expect(read).not.toHaveBeenCalled()
    expect(previewBackup).not.toHaveBeenCalled()
  })

  it('rejects invalid JSON and a file that is not a version 1 backup, before uploading', async () => {
    const user = await renderAccount()

    await chooseBackup(user, backupFile('{not json'))
    expect(await screen.findByRole('alert')).toHaveTextContent('not valid JSON')

    await chooseBackup(user, backupFile(JSON.stringify({ version: 1, ranges: [] })))
    const rejection = await screen.findByRole('alert')
    expect(rejection).toHaveTextContent('not a version 1 backup this app can read')
    expect(within(rejection).getByText(/^exportedAt:/)).toBeInTheDocument()
    expect(previewBackup).not.toHaveBeenCalled()
  })

  it('offers no import when the backup was already imported', async () => {
    previewBackup.mockResolvedValueOnce({ data: alreadyImportedPreview })
    const user = await renderAccount()

    await chooseBackup(user, backupFile())

    expect(
      await screen.findByText(
        'This backup is already in your library, so there is nothing to import.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Merge' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Replace' })).not.toBeInTheDocument()
  })

  it('surfaces a 409 from the commit and offers a fresh preview', async () => {
    previewBackup.mockResolvedValue({ data: previewData })
    commitBackup.mockRejectedValueOnce(
      new ApiClientError(
        'problem',
        'The backup changed since it was previewed. Preview it again before importing.',
        { status: 409 },
      ),
    )
    const user = await renderAccount()

    await chooseBackup(user, backupFile())
    await user.click(await screen.findByRole('button', { name: 'Merge' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The backup changed since it was previewed.',
    )
    await user.click(screen.getByRole('button', { name: 'Preview again' }))
    await waitFor(() => expect(previewBackup).toHaveBeenCalledTimes(2))
    expect(previewBackup).toHaveBeenLastCalledWith(backup)
    expect(await screen.findByRole('button', { name: 'Merge' })).toBeEnabled()
  })

  it('reports a preview the server refuses', async () => {
    previewBackup.mockRejectedValueOnce(
      new ApiClientError('problem', 'Request validation failed.', { status: 422 }),
    )
    const user = await renderAccount()

    await chooseBackup(user, backupFile())

    expect(await screen.findByRole('alert')).toHaveTextContent('Request validation failed.')
  })

  it('gates the practice reset behind the checkbox and reports the ranges it cleared', async () => {
    resetStats.mockResolvedValueOnce({
      data: { resetAt: '2026-02-01T09:15:00.000Z', rangesReset: 3 },
    })
    const user = await renderAccount()

    const button = screen.getByRole('button', { name: 'Reset practice stats' })
    expect(button).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: 'I understand' }))
    expect(button).toBeEnabled()
    await user.click(button)

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Practice stats cleared for 3 ranges.',
    )
    expect(resetStats).toHaveBeenCalledOnce()
    // The confirmation resets, so a second reset needs a second acknowledgement.
    expect(button).toBeDisabled()
  })

  it('reports a failed reset without claiming anything was cleared', async () => {
    resetStats.mockRejectedValueOnce(
      new ApiClientError('network', 'We could not reach the server.'),
    )
    const user = await renderAccount()

    await user.click(screen.getByRole('checkbox', { name: 'I understand' }))
    await user.click(screen.getByRole('button', { name: 'Reset practice stats' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not reach the server.')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('offers a retry after the account fails to load', async () => {
    trainingGoal.mockReset()
    trainingGoal
      .mockRejectedValueOnce(new ApiClientError('network', 'We could not reach the server.'))
      .mockResolvedValueOnce({ data: { dailyHandsGoal: null, updatedAt: null } })
    const user = userEvent.setup()
    renderAt(<AccountView />, '/app/account')

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not reach the server.')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('combobox', { name: 'Daily goal in hands' })).toHaveValue('')
  })

  it('reports a failed goal save without moving the picker', async () => {
    saveGoal.mockRejectedValueOnce(new ApiClientError('network', 'We could not reach the server.'))
    const user = await renderAccount()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Daily goal in hands' }), '80')

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not reach the server.')
    expect(screen.getByRole('combobox', { name: 'Daily goal in hands' })).toHaveValue('20')
  })
})
