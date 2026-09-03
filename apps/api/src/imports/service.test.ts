import { describe, expect, it, vi } from 'vitest'

import {
  legacyBackupCommitResponseSchema,
  legacyBackupPreviewResponseSchema,
  legacyBackupV1Schema,
  type LegacyBackupV1,
} from '@poker-range-trainer/contracts'

import { legacyBackupDigest, type ExportSnapshot } from './backup.js'
import { LegacyImportDigestMismatchError } from './repository.js'
import { ImportsService, type ImportPreviewContext, type ImportsRepository } from './service.js'

const ownerId = '7a7e6f3e-17be-4b69-a31b-1f902417c560'

const backup: LegacyBackupV1 = legacyBackupV1Schema.parse({
  version: 1,
  exportedAt: '2026-01-02T03:04:05.000Z',
  ranges: [
    {
      id: 'rng-1',
      name: 'BTN open',
      hands: ['AA'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
  ],
  practiceStats: {},
  handAccuracy: {},
  actionAccuracy: {},
  sessionHistory: {},
  reviewStates: {},
})

const emptySnapshot: ExportSnapshot = {
  ranges: [],
  practiceStats: {},
  handAccuracy: {},
  sessionHistory: {},
  reviewStates: {},
  trainingGoal: null,
}

function createService(context: Partial<ImportPreviewContext> = {}) {
  const repository = {
    readPreviewContext: vi.fn(
      async (): Promise<ImportPreviewContext> => ({
        alreadyImported: false,
        collidingRangeIds: [],
        hasExistingRanges: false,
        ...context,
      }),
    ),
    commit: vi.fn(async () => ({
      ranges: 1,
      practiceStats: 0,
      handAccuracy: 0,
      actionAccuracy: 0,
      sessions: 0,
      reviewStates: 0,
      spotAccuracy: 0,
    })),
    readExportSnapshot: vi.fn(async () => emptySnapshot),
  } satisfies ImportsRepository
  const service = new ImportsService(repository, { now: () => new Date('2026-02-01T00:00:00.000Z') })
  return { service, repository }
}

describe('legacy import preview', () => {
  it('reports counts, warnings, and no conflicts for an empty library', async () => {
    const { service, repository } = createService()
    const preview = await service.preview(ownerId, backup)
    expect(legacyBackupPreviewResponseSchema.safeParse({ data: preview }).success).toBe(true)
    expect(preview.digest).toBe(legacyBackupDigest(backup))
    expect(preview.alreadyImported).toBe(false)
    expect(preview.conflicts).toEqual([])
    expect(preview.counts.ranges).toBe(1)
    expect(repository.readPreviewContext).toHaveBeenCalledWith(
      ownerId,
      preview.digest.slice('sha256:'.length),
      ['rng-1'],
    )
  })

  it('turns library state into the three declared conflicts', async () => {
    const { service } = createService({
      alreadyImported: true,
      collidingRangeIds: ['rng-1'],
      hasExistingRanges: true,
    })
    const preview = await service.preview(ownerId, backup)
    expect(legacyBackupPreviewResponseSchema.safeParse({ data: preview }).success).toBe(true)
    expect(preview.alreadyImported).toBe(true)
    expect(preview.conflicts).toEqual([
      { kind: 'already_imported', rangeIds: [], message: expect.any(String) },
      { kind: 'range_id_collision', rangeIds: ['rng-1'], message: expect.any(String) },
      { kind: 'merge_required', rangeIds: [], message: expect.any(String) },
    ])
  })
})

describe('legacy import commit', () => {
  it('recomputes the digest and refuses a file that changed since the preview', async () => {
    const { service, repository } = createService()
    await expect(
      service.commit(ownerId, {
        backup,
        expectedDigest: `sha256:${'0'.repeat(64)}`,
        strategy: 'merge',
      }),
    ).rejects.toBeInstanceOf(LegacyImportDigestMismatchError)
    expect(repository.commit).not.toHaveBeenCalled()
  })

  it('commits atomically and answers with the committed counts', async () => {
    const { service, repository } = createService()
    const digest = legacyBackupDigest(backup)
    const outcome = await service.commit(ownerId, {
      backup,
      expectedDigest: digest,
      strategy: 'replace',
    })
    expect(legacyBackupCommitResponseSchema.safeParse({ data: outcome }).success).toBe(true)
    expect(outcome).toMatchObject({ result: 'committed', atomic: true, digest, strategy: 'replace' })
    expect(repository.commit).toHaveBeenCalledWith(ownerId, {
      backup,
      strategy: 'replace',
      backupSha256: digest.slice('sha256:'.length),
    })
  })
})

describe('backup export', () => {
  it('stamps the export with the injected clock and validates the file', async () => {
    const { service } = createService()
    const exported = await service.exportBackup(ownerId)
    expect(exported.exportedAt).toBe('2026-02-01T00:00:00.000Z')
    expect(legacyBackupV1Schema.safeParse(exported).success).toBe(true)
  })
})
