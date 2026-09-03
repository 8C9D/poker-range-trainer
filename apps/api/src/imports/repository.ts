import { randomUUID } from 'node:crypto'

import { and, asc, eq, inArray, isNotNull, isNull, max, sql } from 'drizzle-orm'

import type { LegacyBackupCounts, LegacyBackupV1 } from '@poker-range-trainer/contracts'
import type { Database } from '@poker-range-trainer/database'
import {
  handClasses,
  legacyImports,
  practiceSessions,
  rangeHandAccuracy,
  rangeHands,
  rangePracticeStats,
  ranges,
  reviewStates,
  userTrainingGoals,
} from '@poker-range-trainer/database'
import {
  derivePreservationWarnings,
  LEGACY_BACKUP_VERSION,
  normalizeLegacyRange,
  normalizeReviewEase,
  normalizeTrainingGoal,
  sessionFingerprint,
  type ExportHandAccuracyRow,
  type ExportPracticeStatRow,
  type ExportRangeRow,
  type ExportReviewRow,
  type ExportSessionRow,
  type ExportSnapshot,
} from './backup.js'
import type { ImportPreviewContext, ImportsRepository, LegacyImportCommand } from './service.js'

export interface Clock {
  now(): Date
}

/** The committed file is already stored; a repeat upload must not duplicate it. */
export class LegacyImportAlreadyImportedError extends Error {
  readonly code = 'LEGACY_IMPORT_ALREADY_IMPORTED'
  constructor() {
    super('This backup was already imported.')
    this.name = 'LegacyImportAlreadyImportedError'
  }
}

/** Another import of the same file holds the owner-scoped checksum record. */
export class LegacyImportInProgressError extends Error {
  readonly code = 'LEGACY_IMPORT_IN_PROGRESS'
  constructor() {
    super('An import of this backup is already recorded.')
    this.name = 'LegacyImportInProgressError'
  }
}

/** The committed file is not the file the client previewed. */
export class LegacyImportDigestMismatchError extends Error {
  readonly code = 'LEGACY_IMPORT_DIGEST_MISMATCH'
  constructor() {
    super('The backup changed since it was previewed.')
    this.name = 'LegacyImportDigestMismatchError'
  }
}

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]
type Queryable = Database | Transaction

/** Keeps one statement's parameter list far below the PostgreSQL bind limit. */
const INSERT_CHUNK_SIZE = 500

const UNIQUE_VIOLATION = '23505'

/** Driver errors may arrive wrapped, so the SQLSTATE is looked for down the cause chain. */
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error
  for (let depth = 0; depth < 5 && typeof current === 'object' && current !== null; depth += 1) {
    if ((current as { code?: unknown }).code === UNIQUE_VIOLATION) return true
    current = (current as { cause?: unknown }).cause
  }
  return false
}

function chunked<Item>(items: Item[], size = INSERT_CHUNK_SIZE): Item[][] {
  const chunks: Item[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

/**
 * How a live range is named in an exported file: the identifier it was imported
 * under, or its own for a range this app created. Re-importing an export must
 * recognise both, or every natively created range would come back duplicated.
 */
function liveRangeIdentifier(row: { id: string; legacyRangeId: string | null }): string {
  return row.legacyRangeId ?? row.id
}

/**
 * PostgreSQL legacy-import persistence.
 *
 * One commit is one transaction: the audit row, the ranges, their memberships,
 * every practice record, and the training goal either all land together or the
 * library is left exactly as it was. Preview reads the same tables and writes
 * nothing.
 */
export class PostgresImportsRepository implements ImportsRepository {
  constructor(
    private readonly database: Database,
    private readonly clock: Clock = { now: () => new Date() },
  ) {}

  async readPreviewContext(
    userId: string,
    backupSha256: string,
    legacyRangeIds: string[],
  ): Promise<ImportPreviewContext> {
    const [completed] = await this.database
      .select({ id: legacyImports.id })
      .from(legacyImports)
      .where(
        and(
          eq(legacyImports.userId, userId),
          eq(legacyImports.backupSha256, backupSha256),
          eq(legacyImports.status, 'completed'),
        ),
      )
      .limit(1)
    const liveRanges = await this.database
      .select({ id: ranges.id, legacyRangeId: ranges.legacyRangeId })
      .from(ranges)
      .where(and(eq(ranges.userId, userId), isNull(ranges.deletedAt)))
    const liveIdentifiers = new Set(liveRanges.map(liveRangeIdentifier))
    return {
      alreadyImported: completed !== undefined,
      collidingRangeIds: legacyRangeIds.filter((id) => liveIdentifiers.has(id)),
      hasExistingRanges: liveRanges.length > 0,
    }
  }

  async commit(userId: string, command: LegacyImportCommand): Promise<LegacyBackupCounts> {
    const { backup, strategy, backupSha256 } = command
    const now = this.clock.now()
    return this.database.transaction(async (transaction) => {
      // Same-owner imports queue here, so two uploads cannot interleave writes.
      await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`)

      const [recorded] = await transaction
        .select({ status: legacyImports.status })
        .from(legacyImports)
        .where(
          and(eq(legacyImports.userId, userId), eq(legacyImports.backupSha256, backupSha256)),
        )
        .limit(1)
      if (recorded?.status === 'completed') throw new LegacyImportAlreadyImportedError()

      const importId = await this.startImport(transaction, userId, backupSha256, backup, now)
      const importedRanges = await this.importRanges(
        transaction,
        userId,
        backup,
        strategy,
        importId,
        now,
      )
      const counts = await this.importPracticeRecords(transaction, userId, backup, importedRanges)
      await this.importTrainingGoal(transaction, userId, backup, now)

      await transaction
        .update(legacyImports)
        .set({
          status: 'completed',
          completedAt: now,
          outcome: {
            strategy,
            counts,
            preservationWarnings: derivePreservationWarnings(backup),
          },
        })
        .where(eq(legacyImports.id, importId))
      return counts
    })
  }

  async readExportSnapshot(userId: string): Promise<ExportSnapshot> {
    const [goal] = await this.database
      .select({ dailyHandGoal: userTrainingGoals.dailyHandGoal })
      .from(userTrainingGoals)
      .where(eq(userTrainingGoals.userId, userId))
      .limit(1)
    const trainingGoal = goal?.dailyHandGoal ?? null

    const rangeRows = await this.database
      .select({
        id: ranges.id,
        legacyRangeId: ranges.legacyRangeId,
        name: ranges.name,
        gameType: ranges.gameType,
        tableSize: ranges.tableSize,
        stackDepthBb: ranges.stackDepthBb,
        position: ranges.position,
        actionType: ranges.actionType,
        versusPosition: ranges.versusPosition,
        notes: ranges.notes,
        archived: ranges.archived,
        favorite: ranges.favorite,
        legacyPayload: ranges.legacyPayload,
        createdAt: ranges.createdAt,
        updatedAt: ranges.updatedAt,
      })
      .from(ranges)
      .where(and(eq(ranges.userId, userId), isNull(ranges.deletedAt)))
      .orderBy(asc(ranges.displayOrder), asc(ranges.id))
    if (rangeRows.length === 0) {
      return {
        ranges: [],
        practiceStats: {},
        handAccuracy: {},
        sessionHistory: {},
        reviewStates: {},
        trainingGoal,
      }
    }
    const liveIds = rangeRows.map((row) => row.id)

    // Canonical 13x13 order, so an exported file re-imports byte-comparably.
    const handRows = await this.database
      .select({ rangeId: rangeHands.rangeId, handCode: rangeHands.handCode })
      .from(rangeHands)
      .innerJoin(handClasses, eq(handClasses.code, rangeHands.handCode))
      .where(and(eq(rangeHands.userId, userId), inArray(rangeHands.rangeId, liveIds)))
      .orderBy(asc(handClasses.matrixOrder))
    const handsByRange = new Map<string, string[]>()
    for (const row of handRows) {
      const hands = handsByRange.get(row.rangeId) ?? []
      hands.push(row.handCode)
      handsByRange.set(row.rangeId, hands)
    }

    const statRows = await this.database
      .select()
      .from(rangePracticeStats)
      .where(
        and(
          eq(rangePracticeStats.userId, userId),
          inArray(rangePracticeStats.rangeId, liveIds),
          isNotNull(rangePracticeStats.lastPracticedAt),
        ),
      )
    const practiceStats: Record<string, ExportPracticeStatRow> = {}
    for (const row of statRows) {
      if (!row.lastPracticedAt) continue
      practiceStats[row.rangeId] = {
        totalAttempts: row.totalAttempts,
        correctAttempts: row.correctAttempts,
        lastPracticedAt: row.lastPracticedAt.toISOString(),
      }
    }

    const accuracyRows = await this.database
      .select({
        rangeId: rangeHandAccuracy.rangeId,
        handCode: rangeHandAccuracy.handCode,
        attempts: rangeHandAccuracy.attempts,
        correct: rangeHandAccuracy.correct,
        falsePositives: rangeHandAccuracy.falsePositives,
        falseNegatives: rangeHandAccuracy.falseNegatives,
      })
      .from(rangeHandAccuracy)
      .innerJoin(handClasses, eq(handClasses.code, rangeHandAccuracy.handCode))
      .where(and(eq(rangeHandAccuracy.userId, userId), inArray(rangeHandAccuracy.rangeId, liveIds)))
      .orderBy(asc(handClasses.matrixOrder))
    const handAccuracy: Record<string, ExportHandAccuracyRow[]> = {}
    for (const row of accuracyRows) {
      const entries = handAccuracy[row.rangeId] ?? []
      entries.push({
        hand: row.handCode,
        attempts: row.attempts,
        correct: row.correct,
        falsePositives: row.falsePositives,
        falseNegatives: row.falseNegatives,
      })
      handAccuracy[row.rangeId] = entries
    }

    const sessionRows = await this.database
      .select({
        rangeId: practiceSessions.rangeId,
        completedAt: practiceSessions.completedAt,
        totalQuestions: practiceSessions.totalQuestions,
        correctAnswers: practiceSessions.correctAnswers,
      })
      .from(practiceSessions)
      .where(and(eq(practiceSessions.userId, userId), inArray(practiceSessions.rangeId, liveIds)))
      .orderBy(asc(practiceSessions.completedAt), asc(practiceSessions.id))
    const sessionHistory: Record<string, ExportSessionRow[]> = {}
    for (const row of sessionRows) {
      const sessions = sessionHistory[row.rangeId] ?? []
      sessions.push({
        playedAt: row.completedAt.toISOString(),
        totalQuestions: row.totalQuestions,
        correctAnswers: row.correctAnswers,
      })
      sessionHistory[row.rangeId] = sessions
    }

    const reviewRows = await this.database
      .select()
      .from(reviewStates)
      .where(and(eq(reviewStates.userId, userId), inArray(reviewStates.rangeId, liveIds)))
    const reviews: Record<string, ExportReviewRow> = {}
    for (const row of reviewRows) {
      reviews[row.rangeId] = {
        ease: Number(row.ease),
        intervalDays: row.intervalDays,
        dueAt: row.dueAt?.toISOString() ?? null,
        lastReviewedAt: row.lastReviewedAt?.toISOString() ?? null,
      }
    }

    return {
      ranges: rangeRows.map(
        (row): ExportRangeRow => ({
          id: row.id,
          legacyRangeId: row.legacyRangeId,
          name: row.name,
          hands: handsByRange.get(row.id) ?? [],
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          archived: row.archived,
          favorite: row.favorite,
          gameType: row.gameType,
          tableSize: row.tableSize,
          stackDepthBb: row.stackDepthBb === null ? null : Number(row.stackDepthBb),
          position: row.position,
          actionType: row.actionType,
          versusPosition: row.versusPosition,
          notes: row.notes,
          legacyPayload: row.legacyPayload,
        }),
      ),
      practiceStats,
      handAccuracy,
      sessionHistory,
      reviewStates: reviews,
      trainingGoal,
    }
  }

  /** The audit row is written first, so nothing can be imported without a record of it. */
  private async startImport(
    transaction: Queryable,
    userId: string,
    backupSha256: string,
    backup: LegacyBackupV1,
    now: Date,
  ): Promise<string> {
    try {
      const [row] = await transaction
        .insert(legacyImports)
        .values({
          userId,
          backupVersion: LEGACY_BACKUP_VERSION,
          backupSha256,
          sourceName: null,
          status: 'pending',
          snapshot: backup as unknown as Record<string, unknown>,
          createdAt: now,
        })
        .returning({ id: legacyImports.id })
      if (!row) throw new Error('The legacy import insert did not return a row.')
      return row.id
    } catch (error: unknown) {
      if (isUniqueViolation(error)) throw new LegacyImportInProgressError()
      throw error
    }
  }

  /**
   * Imports the backup's ranges and their hand membership.
   *
   * `replace` retires the whole live library first, releasing each legacy
   * identifier so the owner-scoped partial unique index cannot collide with the
   * incoming copy; `merge` keeps the live ranges and skips the incoming ones
   * that share their legacy identifiers.
   */
  private async importRanges(
    transaction: Queryable,
    userId: string,
    backup: LegacyBackupV1,
    strategy: LegacyImportCommand['strategy'],
    importId: string,
    now: Date,
  ): Promise<ImportedRange[]> {
    const liveRanges = await transaction
      .select({ id: ranges.id, legacyRangeId: ranges.legacyRangeId })
      .from(ranges)
      .where(and(eq(ranges.userId, userId), isNull(ranges.deletedAt)))
    const liveIdentifiers = new Set(liveRanges.map(liveRangeIdentifier))

    if (strategy === 'replace') {
      await transaction
        .update(ranges)
        .set({
          deletedAt: now,
          updatedAt: now,
          legacyRangeId: null,
          version: sql`${ranges.version} + 1`,
        })
        .where(and(eq(ranges.userId, userId), isNull(ranges.deletedAt)))
      await transaction.delete(userTrainingGoals).where(eq(userTrainingGoals.userId, userId))
    }

    const importable = new Set(
      backup.ranges
        .filter((range) => strategy === 'replace' || !liveIdentifiers.has(range.id))
        .map((range) => range.id),
    )
    if (importable.size > 0) {
      // A retired range must not keep an identifier the live library is adopting.
      // Restricted to retired rows, so a live range can never lose its own
      // identifier here: `replace` has already retired the whole live library,
      // and `merge` skipped every incoming range a live one already answers to.
      await transaction
        .update(ranges)
        .set({ legacyRangeId: null })
        .where(
          and(
            eq(ranges.userId, userId),
            isNotNull(ranges.deletedAt),
            inArray(ranges.legacyRangeId, [...importable]),
          ),
        )
    }

    const [order] = await transaction
      .select({ displayOrder: max(ranges.displayOrder) })
      .from(ranges)
      // Retired ranges count, so restoring one can never duplicate an order.
      .where(eq(ranges.userId, userId))
    let displayOrder = (order?.displayOrder ?? -1) + 1

    const imported: ImportedRange[] = []
    const handValues: (typeof rangeHands.$inferInsert)[] = []
    for (const [index, source] of backup.ranges.entries()) {
      if (!importable.has(source.id)) continue
      const { range } = normalizeLegacyRange(source, index)
      if (!range) continue
      const [row] = await transaction
        .insert(ranges)
        .values({
          userId,
          name: range.name,
          displayOrder: displayOrder++,
          gameType: range.metadata.gameType,
          tableSize: range.metadata.tableSize,
          stackDepthBb: range.metadata.stackDepthBb,
          position: range.metadata.position,
          actionType: range.metadata.actionType,
          versusPosition: range.metadata.versusPosition,
          notes: range.metadata.notes,
          archived: range.archived,
          favorite: range.favorite,
          legacyRangeId: range.legacyRangeId,
          legacyBackupVersion: LEGACY_BACKUP_VERSION,
          legacyPayload: range.legacyPayload,
          legacyImportId: importId,
          createdAt: range.createdAt,
          updatedAt: range.updatedAt,
        })
        .returning({ id: ranges.id })
      if (!row) throw new Error('The legacy range insert did not return a row.')
      for (const handCode of range.hands) {
        handValues.push({ rangeId: row.id, userId, handCode })
      }
      imported.push({ rangeId: row.id, legacyRangeId: range.legacyRangeId })
    }

    for (const chunk of chunked(handValues)) {
      await transaction.insert(rangeHands).values(chunk)
    }
    return imported
  }

  /** Practice totals, hand accuracy, session history, and review schedules. */
  private async importPracticeRecords(
    transaction: Queryable,
    userId: string,
    backup: LegacyBackupV1,
    imported: ImportedRange[],
  ): Promise<LegacyBackupCounts> {
    const statValues: (typeof rangePracticeStats.$inferInsert)[] = []
    const accuracyValues: (typeof rangeHandAccuracy.$inferInsert)[] = []
    const reviewValues: (typeof reviewStates.$inferInsert)[] = []
    const sessionValues: (typeof practiceSessions.$inferInsert)[] = []
    const fingerprints = new Set<string>()
    let actionAccuracy = 0

    for (const { rangeId, legacyRangeId } of imported) {
      const stat = backup.practiceStats[legacyRangeId]
      // A zero-attempt row has no last-practiced timestamp, which the stored
      // check rejects, and it carries no history worth a row.
      if (stat && stat.totalAttempts > 0) {
        statValues.push({
          rangeId,
          userId,
          totalAttempts: stat.totalAttempts,
          correctAttempts: stat.correctAttempts,
          lastPracticedAt: new Date(stat.lastPracticedAt),
        })
      }

      for (const entry of Object.values(backup.handAccuracy[legacyRangeId] ?? {})) {
        accuracyValues.push({
          rangeId,
          userId,
          handCode: entry.hand,
          attempts: entry.attempts,
          correct: entry.correct,
          falsePositives: entry.falsePositives,
          falseNegatives: entry.falseNegatives,
        })
      }

      actionAccuracy += Object.keys(backup.actionAccuracy[legacyRangeId] ?? {}).length

      const review = backup.reviewStates[legacyRangeId]
      if (review) {
        const scheduled = review.intervalDays > 0
        reviewValues.push({
          rangeId,
          userId,
          ease: normalizeReviewEase(review.ease),
          intervalDays: review.intervalDays,
          dueAt: scheduled ? new Date(review.dueAt) : null,
          lastReviewedAt: scheduled ? new Date(review.lastReviewedAt) : null,
        })
      }

      for (const session of backup.sessionHistory[legacyRangeId] ?? []) {
        const fingerprint = sessionFingerprint(session)
        // The same drill listed twice in one file is one drill.
        if (fingerprints.has(fingerprint)) continue
        fingerprints.add(fingerprint)
        sessionValues.push({
          userId,
          rangeId,
          mode: 'recognition',
          idempotencyKey: randomUUID(),
          totalQuestions: session.totalQuestions,
          correctAnswers: session.correctAnswers,
          completedAt: new Date(session.playedAt),
          createdAt: new Date(session.playedAt),
          legacyFingerprint: fingerprint,
        })
      }
    }

    if (fingerprints.size > 0) {
      // A retired copy of a drill yields its fingerprint to the live copy.
      for (const chunk of chunked([...fingerprints])) {
        await transaction
          .update(practiceSessions)
          .set({ legacyFingerprint: null })
          .where(
            and(
              eq(practiceSessions.userId, userId),
              inArray(practiceSessions.legacyFingerprint, chunk),
            ),
          )
      }
    }

    for (const chunk of chunked(statValues)) {
      await transaction.insert(rangePracticeStats).values(chunk)
    }
    for (const chunk of chunked(accuracyValues)) {
      await transaction.insert(rangeHandAccuracy).values(chunk)
    }
    for (const chunk of chunked(reviewValues)) {
      await transaction.insert(reviewStates).values(chunk)
    }
    for (const chunk of chunked(sessionValues)) {
      await transaction.insert(practiceSessions).values(chunk)
    }

    return {
      ranges: imported.length,
      practiceStats: statValues.length,
      handAccuracy: accuracyValues.length,
      // Retired records live on in the import snapshot rather than in a table.
      actionAccuracy,
      sessions: sessionValues.length,
      reviewStates: reviewValues.length,
      spotAccuracy: Object.keys(backup.spotAccuracy ?? {}).length,
    }
  }

  /**
   * `replace` has already cleared the goal, so this restores the file's target;
   * `merge` leaves an existing goal alone rather than overwriting a live choice.
   */
  private async importTrainingGoal(
    transaction: Queryable,
    userId: string,
    backup: LegacyBackupV1,
    now: Date,
  ): Promise<void> {
    const goal = normalizeTrainingGoal(backup.trainingGoal ?? 0)
    if (goal === null) return
    await transaction
      .insert(userTrainingGoals)
      .values({ userId, dailyHandGoal: goal, updatedAt: now })
      .onConflictDoNothing({ target: userTrainingGoals.userId })
  }
}

interface ImportedRange {
  rangeId: string
  legacyRangeId: string
}
