import {
  legacyBackupV1Schema,
  type LegacyBackupCommitRequest,
  type LegacyBackupCommitResponse,
  type LegacyBackupCounts,
  type LegacyBackupPreviewResponse,
  type LegacyBackupV1,
  type LegacyImportConflict,
} from '@poker-range-trainer/contracts'

import {
  buildLegacyBackupExport,
  countLegacyBackup,
  derivePreservationWarnings,
  digestHex,
  legacyBackupDigest,
  type ExportSnapshot,
} from './backup.js'
import { LegacyImportDigestMismatchError } from './repository.js'

export interface Clock {
  now(): Date
}

export type LegacyBackupPreview = LegacyBackupPreviewResponse['data']
export type LegacyBackupCommitOutcome = LegacyBackupCommitResponse['data']

/** What the owner's library already says about a backup, read without writing. */
export interface ImportPreviewContext {
  /** A completed import of this exact file already exists for the owner. */
  alreadyImported: boolean
  /** Legacy identifiers already used by the owner's live ranges. */
  collidingRangeIds: string[]
  /** The owner has at least one live range, so merge or replace must be chosen. */
  hasExistingRanges: boolean
}

export interface LegacyImportCommand {
  backup: LegacyBackupV1
  strategy: LegacyBackupCommitRequest['strategy']
  /** The 64-hex digest half stored in `legacy_imports.backup_sha256`. */
  backupSha256: string
}

export interface ImportsRepository {
  readPreviewContext(
    userId: string,
    backupSha256: string,
    legacyRangeIds: string[],
  ): Promise<ImportPreviewContext>
  /** Commits the whole backup in one transaction, or writes nothing at all. */
  commit(userId: string, command: LegacyImportCommand): Promise<LegacyBackupCounts>
  readExportSnapshot(userId: string): Promise<ExportSnapshot>
}

/**
 * Application boundary for legacy-backup import and export.
 *
 * Preview never writes, commit is one repository transaction, and the digest is
 * always recomputed here: a client's `expectedDigest` decides only whether the
 * file it previewed is the file it is now committing.
 */
export class ImportsService {
  constructor(
    private readonly repository: ImportsRepository,
    private readonly clock: Clock = { now: () => new Date() },
  ) {}

  async preview(userId: string, backup: LegacyBackupV1): Promise<LegacyBackupPreview> {
    const digest = legacyBackupDigest(backup)
    const context = await this.repository.readPreviewContext(
      userId,
      digestHex(digest),
      backup.ranges.map((range) => range.id),
    )
    const conflicts: LegacyImportConflict[] = []
    if (context.alreadyImported) {
      conflicts.push({
        kind: 'already_imported',
        rangeIds: [],
        message: 'This backup was already imported; importing it again would change nothing.',
      })
    }
    if (context.collidingRangeIds.length > 0) {
      conflicts.push({
        kind: 'range_id_collision',
        rangeIds: context.collidingRangeIds,
        message: 'These ranges already exist in the library; merging skips them.',
      })
    }
    if (context.hasExistingRanges) {
      conflicts.push({
        kind: 'merge_required',
        rangeIds: [],
        message: 'The library is not empty, so the import must merge into it or replace it.',
      })
    }
    return {
      digest,
      counts: countLegacyBackup(backup),
      preservationWarnings: derivePreservationWarnings(backup),
      conflicts,
      alreadyImported: context.alreadyImported,
    }
  }

  async commit(
    userId: string,
    request: LegacyBackupCommitRequest,
  ): Promise<LegacyBackupCommitOutcome> {
    const digest = legacyBackupDigest(request.backup)
    if (digest !== request.expectedDigest) throw new LegacyImportDigestMismatchError()
    const counts = await this.repository.commit(userId, {
      backup: request.backup,
      strategy: request.strategy,
      backupSha256: digestHex(digest),
    })
    return { result: 'committed', atomic: true, digest, strategy: request.strategy, counts }
  }

  /** The owner's live library as a v1 backup file, validated before it leaves the API. */
  async exportBackup(userId: string): Promise<LegacyBackupV1> {
    const snapshot = await this.repository.readExportSnapshot(userId)
    return legacyBackupV1Schema.parse(
      buildLegacyBackupExport(snapshot, this.clock.now().toISOString()),
    )
  }
}
