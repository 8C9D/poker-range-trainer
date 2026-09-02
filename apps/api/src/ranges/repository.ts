import { and, asc, count, desc, eq, isNull, max, sql, type SQL } from 'drizzle-orm'

import type {
  BulkRangeMutationRequest,
  RangeCreateRequest,
  RangeDuplicateRequest,
  RangeListItem,
  RangeListQuery,
  RangeRead,
  RangeUpdateRequest,
  ScenarioMetadata,
} from '@poker-range-trainer/contracts'
import type { Database } from '@poker-range-trainer/database'
import { handClasses, rangeHands, rangePracticeStats, ranges } from '@poker-range-trainer/database'
import { TOTAL_HOLDEM_COMBOS } from '@poker-range-trainer/domain/domain/rangeMath'
import { parseHandInput } from '@poker-range-trainer/domain/domain/pokerHands'

export interface Clock {
  now(): Date
}

export interface RangeRepository {
  create(userId: string, input: RangeCreateRequest): Promise<RangeRead>
  list(userId: string, query: RangeListQuery): Promise<RangeListResult>
  get(userId: string, rangeId: string): Promise<RangeRead>
  update(userId: string, rangeId: string, input: RangeUpdateRequest): Promise<RangeRead>
  setArchived(
    userId: string,
    rangeId: string,
    version: number,
    archived: boolean,
  ): Promise<RangeRead>
  setFavorite(
    userId: string,
    rangeId: string,
    version: number,
    favorite: boolean,
  ): Promise<RangeRead>
  delete(userId: string, rangeId: string, version: number): Promise<RangeDeletion>
  restore(userId: string, rangeId: string, version: number): Promise<RangeRead>
  duplicate(userId: string, rangeId: string, input: RangeDuplicateRequest): Promise<RangeRead>
  bulk(userId: string, input: BulkRangeMutationRequest): Promise<RangeBulkResult>
}

export interface RangeListResult {
  data: RangeListItem[]
  meta: { page: number; pageSize: number; totalItems: number; totalPages: number }
}

export interface RangeDeletion {
  id: string
  version: number
  /** API timestamp, rather than a driver Date, so all service output is contract-shaped. */
  deletedAt: string
}

export type RangeBulkResult =
  | { action: 'delete'; atomic: true; items: RangeDeletion[] }
  | {
      action: Exclude<BulkRangeMutationRequest['action'], 'delete'>
      atomic: true
      items: RangeListItem[]
    }

/** Safe for a future controller to map to a 404 without revealing another user's rows. */
export class RangeNotFoundError extends Error {
  readonly code = 'RANGE_NOT_FOUND'

  constructor() {
    super('Range not found.')
    this.name = 'RangeNotFoundError'
  }
}

/** The caller owns the range, but submitted an obsolete optimistic version. */
export class RangeVersionConflictError extends Error {
  readonly code = 'RANGE_VERSION_CONFLICT'

  constructor() {
    super('The range was modified by another request.')
    this.name = 'RangeVersionConflictError'
  }
}

/** Invalid direct service/repository use; HTTP schema validation remains the primary guard. */
export class RangeInputError extends Error {
  readonly code = 'RANGE_INPUT_INVALID'

  constructor(message: string) {
    super(message)
    this.name = 'RangeInputError'
  }
}

type RangeRow = typeof ranges.$inferSelect
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]
type Queryable = Database | Transaction

const rangeSelection = {
  id: ranges.id,
  userId: ranges.userId,
  name: ranges.name,
  version: ranges.version,
  displayOrder: ranges.displayOrder,
  gameType: ranges.gameType,
  tableSize: ranges.tableSize,
  stackDepthBb: ranges.stackDepthBb,
  position: ranges.position,
  actionType: ranges.actionType,
  versusPosition: ranges.versusPosition,
  notes: ranges.notes,
  archived: ranges.archived,
  favorite: ranges.favorite,
  deletedAt: ranges.deletedAt,
  legacyRangeId: ranges.legacyRangeId,
  legacyBackupVersion: ranges.legacyBackupVersion,
  legacyPayload: ranges.legacyPayload,
  legacyImportId: ranges.legacyImportId,
  createdAt: ranges.createdAt,
  updatedAt: ranges.updatedAt,
}

interface ListRow extends RangeRow {
  handCount: number | string
  comboCount: number | string
  totalAttempts: number | string | null
  correctAttempts: number | string | null
  lastPracticedAt: Date | null
}

function numberValue(value: number | string | null | undefined): number {
  if (typeof value === 'number') return value
  return Number(value ?? 0)
}

function copyName(sourceName: string): string {
  const suffix = ' (copy)'
  return sourceName.length + suffix.length <= 120
    ? `${sourceName}${suffix}`
    : `${sourceName.slice(0, 120 - suffix.length)}${suffix}`
}

function metadataFrom(row: RangeRow): ScenarioMetadata | null {
  const metadata: ScenarioMetadata = {}
  if (row.gameType !== null) metadata.gameType = row.gameType
  if (row.tableSize !== null) metadata.tableSize = row.tableSize
  if (row.stackDepthBb !== null) metadata.stackDepthBb = numberValue(row.stackDepthBb)
  if (row.position !== null) metadata.position = row.position
  if (row.versusPosition !== null) metadata.versusPosition = row.versusPosition
  if (row.actionType !== null) metadata.actionType = row.actionType
  if (row.notes !== null) metadata.notes = row.notes
  return Object.keys(metadata).length === 0 ? null : metadata
}

function metadataValues(metadata: ScenarioMetadata | null | undefined) {
  return {
    gameType: metadata?.gameType ?? null,
    tableSize: metadata?.tableSize ?? null,
    stackDepthBb: metadata?.stackDepthBb === undefined ? null : String(metadata.stackDepthBb),
    position: metadata?.position ?? null,
    versusPosition: metadata?.versusPosition ?? null,
    actionType: metadata?.actionType ?? null,
    notes: metadata?.notes?.trim() ?? null,
  }
}

function readFrom(row: RangeRow, hands: string[]): RangeRead {
  return {
    id: row.id,
    version: row.version,
    name: row.name,
    hands,
    metadata: metadataFrom(row),
    displayOrder: row.displayOrder,
    archived: row.archived,
    favorite: row.favorite,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  }
}

function listFrom(row: ListRow): RangeListItem {
  const comboCount = numberValue(row.comboCount)
  return {
    id: row.id,
    version: row.version,
    name: row.name,
    metadata: metadataFrom(row),
    displayOrder: row.displayOrder,
    handCount: numberValue(row.handCount),
    comboCount,
    rangePercentage: (comboCount / TOTAL_HOLDEM_COMBOS) * 100,
    archived: row.archived,
    favorite: row.favorite,
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  }
}

function assertBulkInput(input: BulkRangeMutationRequest): void {
  if (input.items.length === 0 || input.items.length > 100) {
    throw new RangeInputError('Bulk mutations must contain from 1 through 100 ranges.')
  }
  if (new Set(input.items.map((item) => item.id)).size !== input.items.length) {
    throw new RangeInputError('A bulk mutation can include each range only once.')
  }
}

/**
 * PostgreSQL range persistence. Metadata is an all-or-nothing document here:
 * update `metadata: undefined` preserves it, `metadata: null` clears it, and
 * an object replaces every persisted metadata column (rather than merging).
 */
export class PostgresRangeRepository implements RangeRepository {
  constructor(
    private readonly database: Database,
    private readonly clock: Clock = { now: () => new Date() },
  ) {}

  async create(userId: string, input: RangeCreateRequest): Promise<RangeRead> {
    const now = this.clock.now()
    return this.database.transaction(async (transaction) => {
      const displayOrder = await this.nextDisplayOrder(transaction, userId)
      const [row] = await transaction
        .insert(ranges)
        .values({
          userId,
          name: input.name.trim(),
          displayOrder,
          ...metadataValues(input.metadata),
          createdAt: now,
          updatedAt: now,
        })
        .returning()
      if (!row) throw new Error('Range insert did not return a row.')
      await this.insertHands(transaction, row.id, userId, input.hands)
      return readFrom(row, await this.handsFor(transaction, row.id, userId))
    })
  }

  async list(userId: string, query: RangeListQuery): Promise<RangeListResult> {
    const predicates: SQL[] = [
      eq(ranges.userId, userId),
      isNull(ranges.deletedAt),
      // The contract never exposes a partially imported range without membership.
      sql`exists (select 1 from ${rangeHands} where ${rangeHands.rangeId} = ${ranges.id} and ${rangeHands.userId} = ${ranges.userId})`,
    ]
    if (query.archived === 'exclude') predicates.push(eq(ranges.archived, false))
    if (query.archived === 'only') predicates.push(eq(ranges.archived, true))
    if (query.favorite !== undefined) predicates.push(eq(ranges.favorite, query.favorite))
    if (query.gameType !== undefined) predicates.push(eq(ranges.gameType, query.gameType))
    if (query.tableSize !== undefined) predicates.push(eq(ranges.tableSize, query.tableSize))
    if (query.position !== undefined) predicates.push(eq(ranges.position, query.position))
    if (query.versusPosition !== undefined)
      predicates.push(eq(ranges.versusPosition, query.versusPosition))
    if (query.actionType !== undefined) predicates.push(eq(ranges.actionType, query.actionType))
    if (query.stackDepthBb !== undefined)
      predicates.push(eq(ranges.stackDepthBb, String(query.stackDepthBb)))

    for (const term of query.search?.toLowerCase().split(/\s+/) ?? []) {
      const hand = parseHandInput(term)
      // `strpos` deliberately treats `%` and `_` as ordinary search characters.
      const textMatch = sql`strpos(lower(concat_ws(' ', ${ranges.name}, coalesce(${ranges.notes}, ''))), ${term}) > 0`
      const handMatch = hand
        ? sql`exists (select 1 from ${rangeHands} as searched_hands where searched_hands.range_id = ${ranges.id} and searched_hands.hand_code = ${hand})`
        : sql`false`
      predicates.push(sql`(${textMatch} or ${handMatch})`)
    }

    const [total] = await this.database
      .select({ totalItems: count() })
      .from(ranges)
      .where(and(...predicates))
    const totalItems = numberValue(total?.totalItems)
    const rows = (await this.database
      .select({
        ...rangeSelection,
        handCount: sql<number>`count(${rangeHands.handCode})`,
        comboCount: sql<number>`coalesce(sum(${handClasses.comboCount}), 0)`,
        totalAttempts: rangePracticeStats.totalAttempts,
        correctAttempts: rangePracticeStats.correctAttempts,
        lastPracticedAt: rangePracticeStats.lastPracticedAt,
      })
      .from(ranges)
      .innerJoin(
        rangeHands,
        and(eq(rangeHands.rangeId, ranges.id), eq(rangeHands.userId, ranges.userId)),
      )
      .innerJoin(handClasses, eq(handClasses.code, rangeHands.handCode))
      .leftJoin(
        rangePracticeStats,
        and(
          eq(rangePracticeStats.rangeId, ranges.id),
          eq(rangePracticeStats.userId, ranges.userId),
        ),
      )
      .where(and(...predicates))
      .groupBy(ranges.id, rangePracticeStats.rangeId, rangePracticeStats.userId)
      .orderBy(...this.listOrder(query))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize)) as unknown as ListRow[]

    return {
      data: rows.map(listFrom),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    }
  }

  async get(userId: string, rangeId: string): Promise<RangeRead> {
    const row = await this.findRange(this.database, userId, rangeId, false)
    if (!row) throw new RangeNotFoundError()
    return readFrom(row, await this.handsFor(this.database, rangeId, userId))
  }

  async update(userId: string, rangeId: string, input: RangeUpdateRequest): Promise<RangeRead> {
    const now = this.clock.now()
    return this.database.transaction(async (transaction) => {
      const current = await this.lockRange(transaction, userId, rangeId, false)
      this.assertVersion(current, input.version)
      const next = {
        name: input.name?.trim() ?? current.name,
        ...(input.metadata === undefined ? {} : metadataValues(input.metadata)),
        version: current.version + 1,
        updatedAt: now,
      }
      const [updated] = await transaction
        .update(ranges)
        .set(next)
        .where(and(eq(ranges.id, rangeId), eq(ranges.userId, userId)))
        .returning()
      if (!updated) throw new Error('Locked range update did not return a row.')
      if (input.hands !== undefined) {
        await transaction
          .delete(rangeHands)
          .where(and(eq(rangeHands.rangeId, rangeId), eq(rangeHands.userId, userId)))
        await this.insertHands(transaction, rangeId, userId, input.hands)
      }
      return readFrom(updated, await this.handsFor(transaction, rangeId, userId))
    })
  }

  async setArchived(
    userId: string,
    rangeId: string,
    version: number,
    archived: boolean,
  ): Promise<RangeRead> {
    return this.mutateFlag(userId, rangeId, version, 'archived', archived)
  }

  async setFavorite(
    userId: string,
    rangeId: string,
    version: number,
    favorite: boolean,
  ): Promise<RangeRead> {
    return this.mutateFlag(userId, rangeId, version, 'favorite', favorite)
  }

  async delete(userId: string, rangeId: string, version: number): Promise<RangeDeletion> {
    const now = this.clock.now()
    return this.database.transaction(async (transaction) => {
      const current = await this.lockRange(transaction, userId, rangeId, false)
      this.assertVersion(current, version)
      const [updated] = await transaction
        .update(ranges)
        .set({ deletedAt: now, version: current.version + 1, updatedAt: now })
        .where(and(eq(ranges.id, rangeId), eq(ranges.userId, userId)))
        .returning()
      if (!updated?.deletedAt) throw new Error('Range soft delete did not return a row.')
      return {
        id: updated.id,
        version: updated.version,
        deletedAt: updated.deletedAt.toISOString(),
      }
    })
  }

  async restore(userId: string, rangeId: string, version: number): Promise<RangeRead> {
    const now = this.clock.now()
    return this.database.transaction(async (transaction) => {
      const current = await this.lockRange(transaction, userId, rangeId, true)
      this.assertVersion(current, version)
      const [updated] = await transaction
        .update(ranges)
        .set({ deletedAt: null, version: current.version + 1, updatedAt: now })
        .where(and(eq(ranges.id, rangeId), eq(ranges.userId, userId)))
        .returning()
      if (!updated) throw new Error('Range restore did not return a row.')
      return readFrom(updated, await this.handsFor(transaction, rangeId, userId))
    })
  }

  async duplicate(
    userId: string,
    rangeId: string,
    input: RangeDuplicateRequest,
  ): Promise<RangeRead> {
    const now = this.clock.now()
    return this.database.transaction(async (transaction) => {
      const source = await this.lockRange(transaction, userId, rangeId, false)
      this.assertVersion(source, input.version)
      const [copy] = await transaction
        .insert(ranges)
        .values({
          userId,
          name: input.name?.trim() ?? copyName(source.name),
          displayOrder: await this.nextDisplayOrder(transaction, userId),
          ...metadataValues(metadataFrom(source)),
          createdAt: now,
          updatedAt: now,
        })
        .returning()
      if (!copy) throw new Error('Range duplicate insert did not return a row.')
      await this.insertHands(
        transaction,
        copy.id,
        userId,
        await this.handsFor(transaction, rangeId, userId),
      )
      return readFrom(copy, await this.handsFor(transaction, copy.id, userId))
    })
  }

  async bulk(userId: string, input: BulkRangeMutationRequest): Promise<RangeBulkResult> {
    assertBulkInput(input)
    const now = this.clock.now()
    return this.database.transaction(async (transaction) => {
      // Lock in ID order to avoid deadlocks when two clients overlap bulk requests.
      const requested = new Map(input.items.map((item) => [item.id, item]))
      const rows = await this.lockRanges(
        transaction,
        userId,
        [...requested.keys()],
        input.action === 'restore',
      )
      if (rows.length !== requested.size) throw new RangeNotFoundError()
      for (const row of rows) this.assertVersion(row, requested.get(row.id)!.version)

      if (input.action === 'delete') {
        const deletedById = new Map<string, RangeDeletion>()
        for (const row of rows) {
          const [updated] = await transaction
            .update(ranges)
            .set({ deletedAt: now, version: row.version + 1, updatedAt: now })
            .where(and(eq(ranges.id, row.id), eq(ranges.userId, userId)))
            .returning()
          if (!updated?.deletedAt) throw new Error('Locked bulk delete did not return a row.')
          deletedById.set(updated.id, {
            id: updated.id,
            version: updated.version,
            deletedAt: updated.deletedAt.toISOString(),
          })
        }
        return {
          action: 'delete',
          atomic: true,
          items: input.items.map((item) => deletedById.get(item.id)!),
        }
      }

      const field =
        input.action === 'archive' || input.action === 'unarchive' ? 'archived' : 'favorite'
      const value = input.action === 'archive' || input.action === 'favorite'
      const restored = input.action === 'restore'
      const itemsById = new Map<string, RangeListItem>()
      for (const row of rows) {
        const [updated] = await transaction
          .update(ranges)
          .set(
            restored
              ? { deletedAt: null, version: row.version + 1, updatedAt: now }
              : { [field]: value, version: row.version + 1, updatedAt: now },
          )
          .where(and(eq(ranges.id, row.id), eq(ranges.userId, userId)))
          .returning()
        if (!updated) throw new Error('Locked bulk mutation did not return a row.')
        itemsById.set(updated.id, await this.listItem(transaction, updated, userId))
      }
      return {
        action: input.action,
        atomic: true,
        items: input.items.map((item) => itemsById.get(item.id)!),
      }
    })
  }

  private listOrder(query: RangeListQuery) {
    const direction = query.direction === 'asc' ? asc : desc
    const nullLast = (value: SQL) =>
      sql`${value} ${sql.raw(query.direction === 'asc' ? 'asc' : 'desc')} nulls last`
    switch (query.sort) {
      case 'displayOrder':
        return [direction(ranges.displayOrder), asc(ranges.id)]
      case 'updatedAt':
        return [direction(ranges.updatedAt), asc(ranges.id)]
      case 'createdAt':
        return [direction(ranges.createdAt), asc(ranges.id)]
      case 'name':
        return [sql`lower(${ranges.name}) ${sql.raw(query.direction)} `, asc(ranges.id)]
      case 'accuracy':
        return [
          nullLast(
            sql`case when ${rangePracticeStats.totalAttempts} > 0 then ${rangePracticeStats.correctAttempts}::numeric / ${rangePracticeStats.totalAttempts} end`,
          ),
          asc(ranges.id),
        ]
      case 'lastPracticedAt':
        return [nullLast(sql`${rangePracticeStats.lastPracticedAt}`), asc(ranges.id)]
    }
  }

  private async mutateFlag(
    userId: string,
    rangeId: string,
    version: number,
    field: 'archived' | 'favorite',
    value: boolean,
  ): Promise<RangeRead> {
    const now = this.clock.now()
    return this.database.transaction(async (transaction) => {
      const current = await this.lockRange(transaction, userId, rangeId, false)
      this.assertVersion(current, version)
      const [updated] = await transaction
        .update(ranges)
        .set({ [field]: value, version: current.version + 1, updatedAt: now })
        .where(and(eq(ranges.id, rangeId), eq(ranges.userId, userId)))
        .returning()
      if (!updated) throw new Error('Range flag update did not return a row.')
      return readFrom(updated, await this.handsFor(transaction, rangeId, userId))
    })
  }

  private assertVersion(row: RangeRow, expected: number): void {
    if (row.version !== expected) throw new RangeVersionConflictError()
  }

  private async nextDisplayOrder(transaction: Queryable, userId: string): Promise<number> {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`)
    const [result] = await transaction
      .select({ displayOrder: max(ranges.displayOrder) })
      .from(ranges)
      // Include deleted rows so restoring an older range cannot create a duplicate order.
      .where(eq(ranges.userId, userId))
    const current = result?.displayOrder ?? -1
    if (current >= 1_000_000) throw new RangeInputError('The display order limit has been reached.')
    return current + 1
  }

  private async insertHands(
    transaction: Queryable,
    rangeId: string,
    userId: string,
    hands: string[],
  ): Promise<void> {
    if (hands.length === 0) throw new RangeInputError('A range must contain at least one hand.')
    await transaction
      .insert(rangeHands)
      .values(hands.map((handCode) => ({ rangeId, userId, handCode })))
  }

  private async handsFor(
    transaction: Queryable,
    rangeId: string,
    userId: string,
  ): Promise<string[]> {
    const rows = await transaction
      .select({ handCode: rangeHands.handCode })
      .from(rangeHands)
      .innerJoin(handClasses, eq(handClasses.code, rangeHands.handCode))
      .where(and(eq(rangeHands.rangeId, rangeId), eq(rangeHands.userId, userId)))
      .orderBy(asc(handClasses.matrixOrder))
    return rows.map((row) => row.handCode)
  }

  private async findRange(
    transaction: Queryable,
    userId: string,
    rangeId: string,
    deleted: boolean,
  ): Promise<RangeRow | undefined> {
    const [row] = await transaction
      .select()
      .from(ranges)
      .where(
        and(
          eq(ranges.id, rangeId),
          eq(ranges.userId, userId),
          deleted ? sql`${ranges.deletedAt} is not null` : isNull(ranges.deletedAt),
        ),
      )
      .limit(1)
    return row
  }

  private async lockRange(
    transaction: Queryable,
    userId: string,
    rangeId: string,
    deleted: boolean,
  ): Promise<RangeRow> {
    const result = await transaction.execute(sql`
      select
        ${ranges.id} as "id", ${ranges.userId} as "userId", ${ranges.name} as "name",
        ${ranges.version} as "version", ${ranges.displayOrder} as "displayOrder",
        ${ranges.gameType} as "gameType", ${ranges.tableSize} as "tableSize",
        ${ranges.stackDepthBb} as "stackDepthBb", ${ranges.position} as "position",
        ${ranges.actionType} as "actionType", ${ranges.versusPosition} as "versusPosition",
        ${ranges.notes} as "notes", ${ranges.archived} as "archived", ${ranges.favorite} as "favorite",
        ${ranges.deletedAt} as "deletedAt", ${ranges.legacyRangeId} as "legacyRangeId",
        ${ranges.legacyBackupVersion} as "legacyBackupVersion", ${ranges.legacyPayload} as "legacyPayload",
        ${ranges.legacyImportId} as "legacyImportId", ${ranges.createdAt} as "createdAt",
        ${ranges.updatedAt} as "updatedAt"
      from ${ranges}
      where ${ranges.id} = ${rangeId} and ${ranges.userId} = ${userId}
        and ${deleted ? sql`${ranges.deletedAt} is not null` : sql`${ranges.deletedAt} is null`}
      for update
    `)
    const row = result.rows[0] as unknown as RangeRow | undefined
    if (!row) throw new RangeNotFoundError()
    return this.normalizeRangeRow(row)
  }

  private async lockRanges(
    transaction: Queryable,
    userId: string,
    ids: string[],
    deleted: boolean,
  ): Promise<RangeRow[]> {
    const result = await transaction.execute(sql`
      select
        ${ranges.id} as "id", ${ranges.userId} as "userId", ${ranges.name} as "name",
        ${ranges.version} as "version", ${ranges.displayOrder} as "displayOrder",
        ${ranges.gameType} as "gameType", ${ranges.tableSize} as "tableSize",
        ${ranges.stackDepthBb} as "stackDepthBb", ${ranges.position} as "position",
        ${ranges.actionType} as "actionType", ${ranges.versusPosition} as "versusPosition",
        ${ranges.notes} as "notes", ${ranges.archived} as "archived", ${ranges.favorite} as "favorite",
        ${ranges.deletedAt} as "deletedAt", ${ranges.legacyRangeId} as "legacyRangeId",
        ${ranges.legacyBackupVersion} as "legacyBackupVersion", ${ranges.legacyPayload} as "legacyPayload",
        ${ranges.legacyImportId} as "legacyImportId", ${ranges.createdAt} as "createdAt",
        ${ranges.updatedAt} as "updatedAt"
      from ${ranges}
      where ${ranges.userId} = ${userId}
        and ${ranges.id} in ${sql`(${sql.join(
          ids.map((id) => sql`${id}`),
          sql`, `,
        )})`}
        and ${deleted ? sql`${ranges.deletedAt} is not null` : sql`${ranges.deletedAt} is null`}
      order by ${ranges.id} for update
    `)
    return result.rows.map((row) => this.normalizeRangeRow(row as unknown as RangeRow))
  }

  private normalizeRangeRow(row: RangeRow): RangeRow {
    return {
      ...row,
      version: numberValue(row.version),
      displayOrder: numberValue(row.displayOrder),
      stackDepthBb: row.stackDepthBb === null ? null : String(row.stackDepthBb),
      archived: Boolean(row.archived),
      favorite: Boolean(row.favorite),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      deletedAt: row.deletedAt === null ? null : new Date(row.deletedAt),
    }
  }

  private async listItem(
    transaction: Queryable,
    row: RangeRow,
    userId: string,
  ): Promise<RangeListItem> {
    const [summary] = await transaction
      .select({
        handCount: sql<number>`count(${rangeHands.handCode})`,
        comboCount: sql<number>`coalesce(sum(${handClasses.comboCount}), 0)`,
        totalAttempts: rangePracticeStats.totalAttempts,
        correctAttempts: rangePracticeStats.correctAttempts,
        lastPracticedAt: rangePracticeStats.lastPracticedAt,
      })
      .from(rangeHands)
      .innerJoin(handClasses, eq(handClasses.code, rangeHands.handCode))
      .leftJoin(
        rangePracticeStats,
        and(
          eq(rangePracticeStats.rangeId, rangeHands.rangeId),
          eq(rangePracticeStats.userId, rangeHands.userId),
        ),
      )
      .where(and(eq(rangeHands.rangeId, row.id), eq(rangeHands.userId, userId)))
      .groupBy(rangePracticeStats.rangeId, rangePracticeStats.userId)
    if (!summary) throw new Error('Range hand summary did not return a row.')
    return listFrom({ ...row, ...summary })
  }
}
