import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountScreen } from './AccountScreen'
import { deleteBackup, pullBackup } from '../cloud/backupRepo'
import { unpublishAllSharedPacks } from '../cloud/sharedPacksRepo'
import { unpublishAllSharedRanges } from '../cloud/sharedRangesRepo'
import { buildBackup, type Backup } from '../storage/backup'
import { loadSavedRanges, saveSavedRange } from '../storage/rangeStorage'
import type { SavedRange } from '../types/range'

// Signed-in cloud state for the sync handlers; the sibling AccountScreen.test.tsx
// covers the real, unconfigured local-only state.
vi.mock('../cloud/useAuthSession', () => ({
  useAuthSession: () => ({
    session: { user: { id: 'u1', email: 'user@example.com' } },
    user: { id: 'u1', email: 'user@example.com' },
    loading: false,
    isCloudConfigured: true,
  }),
}))
vi.mock('../cloud/backupRepo', () => ({
  pushBackup: vi.fn(),
  pullBackup: vi.fn(),
  deleteBackup: vi.fn(),
}))
vi.mock('../cloud/sharedPacksRepo', () => ({
  publishSharedPack: vi.fn(),
  unpublishSharedPack: vi.fn(),
  unpublishAllSharedPacks: vi.fn(),
}))
vi.mock('../cloud/sharedRangesRepo', () => ({
  unpublishAllSharedRanges: vi.fn(),
}))

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function makeRange(id: string, name: string): SavedRange {
  return {
    id,
    name,
    hands: ['AA'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

/** A real backup snapshot containing exactly the given range. */
function backupOf(range: SavedRange): Backup {
  saveSavedRange(range)
  const backup = buildBackup()
  localStorage.clear()
  return backup
}

describe('AccountScreen cloud sync (signed in)', () => {
  it('pull replaces all local data with the cloud copy after confirmation', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const cloudBackup = backupOf(makeRange('c1', 'Cloud range'))
    vi.mocked(pullBackup).mockResolvedValue(cloudBackup)
    saveSavedRange(makeRange('l1', 'Local range'))

    render(<AccountScreen />)
    await user.click(screen.getByRole('button', { name: 'Pull from cloud' }))

    expect(await screen.findByText('Pulled your full library from the cloud.')).toBeInTheDocument()
    expect(loadSavedRanges().map((range) => range.name)).toEqual(['Cloud range'])
  })

  it('pull is a no-op when the confirmation is declined', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    saveSavedRange(makeRange('l1', 'Local range'))

    render(<AccountScreen />)
    await user.click(screen.getByRole('button', { name: 'Pull from cloud' }))

    expect(pullBackup).not.toHaveBeenCalled()
    expect(loadSavedRanges().map((range) => range.name)).toEqual(['Local range'])
  })

  it('pull keeps local data when no cloud backup exists yet', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(pullBackup).mockResolvedValue(null)
    saveSavedRange(makeRange('l1', 'Local range'))

    render(<AccountScreen />)
    await user.click(screen.getByRole('button', { name: 'Pull from cloud' }))

    expect(await screen.findByText('No cloud backup found yet. Push first.')).toBeInTheDocument()
    expect(loadSavedRanges().map((range) => range.name)).toEqual(['Local range'])
  })

  it('keeps the local library when the cloud row cannot be read', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    // What the repo now raises for a row a newer app version wrote. Restoring it
    // would have replaced a working library with something unreadable.
    vi.mocked(pullBackup).mockRejectedValue(new Error('Unsupported backup version: 2.'))
    saveSavedRange(makeRange('l1', 'Local range'))

    render(<AccountScreen />)
    await user.click(screen.getByRole('button', { name: 'Pull from cloud' }))

    expect(await screen.findByText('Unsupported backup version: 2.')).toBeInTheDocument()
    expect(loadSavedRanges().map((range) => range.name)).toEqual(['Local range'])
  })

  it('delete cloud data still attempts every revocation and surfaces the failure', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(deleteBackup).mockRejectedValue(new Error('Backup delete failed.'))
    vi.mocked(unpublishAllSharedPacks).mockResolvedValue(undefined)
    vi.mocked(unpublishAllSharedRanges).mockResolvedValue(undefined)

    render(<AccountScreen />)
    await user.click(screen.getByRole('button', { name: 'Delete cloud data' }))

    expect(await screen.findByText('Backup delete failed.')).toBeInTheDocument()
    // Best-effort semantics: the share revocations ran despite the backup failure.
    expect(unpublishAllSharedPacks).toHaveBeenCalledTimes(1)
    expect(unpublishAllSharedRanges).toHaveBeenCalledTimes(1)
  })
})
