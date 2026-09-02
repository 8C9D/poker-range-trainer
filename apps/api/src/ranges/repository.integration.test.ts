import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'

import { rangeListQuerySchema } from '@poker-range-trainer/contracts'
import {
  createDatabase,
  createPostgresPool,
  requireDatabaseUrl,
  runMigrations,
  seedCanonicalHands,
} from '@poker-range-trainer/database'

import {
  PostgresRangeRepository,
  RangeNotFoundError,
  RangeVersionConflictError,
} from './repository.js'

const testDatabaseName = `poker_range_trainer_api_ranges_${randomUUID().replaceAll('-', '')}`
const quotedTestDatabaseName = `"${testDatabaseName}"`

function databaseUrlFor(connectionString: string, databaseName: string): string {
  const url = new URL(connectionString)
  url.pathname = `/${databaseName}`
  return url.toString()
}

const listQuery = (query: Record<string, unknown> = {}) => rangeListQuerySchema.parse(query)

describe('PostgreSQL range repository', () => {
  const configuredUrl = requireDatabaseUrl()
  const adminPool = createPostgresPool(configuredUrl)
  let testPool: Pool
  let repository: PostgresRangeRepository
  let created = false

  beforeAll(async () => {
    await adminPool.query(`create database ${quotedTestDatabaseName}`)
    created = true
    testPool = createPostgresPool(databaseUrlFor(configuredUrl, testDatabaseName))
    await runMigrations(testPool)
    await seedCanonicalHands(testPool)
    repository = new PostgresRangeRepository(createDatabase(testPool))
  })

  afterAll(async () => {
    await testPool?.end()
    if (created) {
      await adminPool.query(
        'select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()',
        [testDatabaseName],
      )
      await adminPool.query(`drop database if exists ${quotedTestDatabaseName}`)
    }
    await adminPool.end()
  })

  async function user(label: string): Promise<string> {
    const result = await testPool.query<{ id: string }>(
      'insert into users (email, password_hash) values ($1, $2) returning id',
      [`${label}-${randomUUID()}@example.test`, 'fixture-password-hash-which-is-long-enough'],
    )
    const id = result.rows[0]?.id
    if (!id) throw new Error('Fixture user insert did not return an ID.')
    return id
  }

  it('creates, reads, and atomically version-updates hand membership and metadata', async () => {
    const owner = await user('crud')
    const createdRange = await repository.create(owner, {
      name: '  BTN open  ',
      hands: ['AKo', 'AA', 'AKs'],
      metadata: { gameType: 'cash', stackDepthBb: 12.5, notes: '  first raise  ' },
    })
    expect(createdRange).toMatchObject({
      version: 1,
      hands: ['AA', 'AKs', 'AKo'],
      metadata: { gameType: 'cash', stackDepthBb: 12.5, notes: 'first raise' },
      displayOrder: 0,
    })

    const updated = await repository.update(owner, createdRange.id, {
      version: createdRange.version,
      name: 'BTN opening range',
      hands: ['QQ', 'AKs'],
      metadata: null,
    })
    expect(updated).toMatchObject({ version: 2, hands: ['AKs', 'QQ'], metadata: null })
    await expect(repository.get(owner, createdRange.id)).resolves.toMatchObject({
      name: 'BTN opening range',
      hands: ['AKs', 'QQ'],
      metadata: null,
    })
  })

  it('never leaks another owner, and distinguishes only an owned stale version', async () => {
    const owner = await user('isolation-owner')
    const other = await user('isolation-other')
    const range = await repository.create(owner, { name: 'Owner chart', hands: ['AA'] })

    await expect(repository.get(other, range.id)).rejects.toBeInstanceOf(RangeNotFoundError)
    await expect(
      repository.update(other, range.id, { version: 1, name: 'Nope' }),
    ).rejects.toBeInstanceOf(RangeNotFoundError)
    await expect(
      repository.update(owner, range.id, { version: 99, name: 'Stale' }),
    ).rejects.toBeInstanceOf(RangeVersionConflictError)
  })

  it('filters legacy search semantics, paginates stably, and sorts practice nulls last', async () => {
    const owner = await user('library')
    const a = await repository.create(owner, {
      name: 'Alpha BTN',
      hands: ['AA'],
      metadata: { position: 'btn', notes: 'squeeze' },
    })
    const b = await repository.create(owner, { name: 'Bravo', hands: ['AKs'] })
    const c = await repository.create(owner, {
      name: 'Charlie',
      hands: ['AKo'],
      metadata: { gameType: 'cash', tableSize: 'sixMax' },
    })
    await repository.setArchived(owner, c.id, c.version, true)
    await testPool.query(
      `insert into range_practice_stats (range_id, user_id, total_attempts, correct_attempts, last_practiced_at)
       values ($1, $2, 10, 8, '2026-01-02T00:00:00Z'), ($3, $2, 4, 0, '2026-01-03T00:00:00Z')`,
      [a.id, owner, b.id],
    )

    await expect(repository.list(owner, listQuery({ search: 'btn a5s' }))).resolves.toMatchObject({
      data: [],
    })
    await expect(repository.list(owner, listQuery({ search: 'btn aa' }))).resolves.toMatchObject({
      data: [{ id: a.id }],
    })
    await expect(repository.list(owner, listQuery({ search: 'squeeze' }))).resolves.toMatchObject({
      data: [{ id: a.id }],
    })
    await expect(
      repository.list(owner, listQuery({ gameType: 'cash', archived: 'include' })),
    ).resolves.toMatchObject({ data: [{ id: c.id }] })

    const first = await repository.list(
      owner,
      listQuery({ archived: 'include', pageSize: 2, sort: 'displayOrder' }),
    )
    const second = await repository.list(
      owner,
      listQuery({ archived: 'include', page: 2, pageSize: 2, sort: 'displayOrder' }),
    )
    expect([...first.data, ...second.data].map((item) => item.id)).toEqual([a.id, b.id, c.id])
    expect(first.meta).toMatchObject({ totalItems: 3, totalPages: 2 })

    const accuracy = await repository.list(
      owner,
      listQuery({ archived: 'include', sort: 'accuracy', direction: 'desc' }),
    )
    expect(accuracy.data.map((item) => item.id)).toEqual([a.id, b.id, c.id])
    const lastPracticed = await repository.list(
      owner,
      listQuery({ archived: 'include', sort: 'lastPracticedAt', direction: 'desc' }),
    )
    expect(lastPracticed.data.map((item) => item.id)).toEqual([b.id, a.id, c.id])

    const literal = await repository.create(owner, { name: 'Literal 100%', hands: ['KK'] })
    await expect(repository.list(owner, listQuery({ search: '100%' }))).resolves.toMatchObject({
      data: [{ id: literal.id }],
    })
  })

  it('duplicates independently, computes canonical combos, and soft-deletes/restores', async () => {
    const owner = await user('duplicate')
    const source = await repository.create(owner, {
      name: 'Source',
      hands: ['AA', 'AKs', 'AKo'],
      metadata: { tableSize: 'sixMax' },
    })
    const archived = await repository.setArchived(owner, source.id, source.version, true)
    const favorited = await repository.setFavorite(owner, source.id, archived.version, true)
    const active = await repository.setArchived(owner, source.id, favorited.version, false)
    expect(active).toMatchObject({ archived: false, favorite: true, version: 4 })
    const summary = await repository.list(owner, listQuery())
    expect(summary.data[0]).toMatchObject({
      handCount: 3,
      comboCount: 22,
      rangePercentage: (22 / 1326) * 100,
    })
    const copy = await repository.duplicate(owner, source.id, { version: active.version })
    expect(copy).toMatchObject({
      name: 'Source (copy)',
      hands: source.hands,
      archived: false,
      favorite: false,
      displayOrder: 1,
    })
    await repository.update(owner, copy.id, { version: copy.version, hands: ['QQ'] })
    await expect(repository.get(owner, source.id)).resolves.toMatchObject({
      hands: ['AA', 'AKs', 'AKo'],
    })

    const maximumName = await repository.create(owner, { name: 'x'.repeat(120), hands: ['JJ'] })
    await expect(
      repository.duplicate(owner, maximumName.id, { version: maximumName.version }),
    ).resolves.toMatchObject({
      name: `${'x'.repeat(113)} (copy)`,
    })

    const deleted = await repository.delete(owner, source.id, active.version)
    expect(deleted.deletedAt).toMatch(/Z$/)
    await expect(repository.get(owner, source.id)).rejects.toBeInstanceOf(RangeNotFoundError)
    await expect(repository.restore(owner, source.id, deleted.version)).resolves.toMatchObject({
      deletedAt: null,
      version: deleted.version + 1,
    })
  })

  it('makes a bulk operation all-or-nothing for stale, missing, and foreign IDs', async () => {
    const owner = await user('bulk-owner')
    const other = await user('bulk-other')
    const first = await repository.create(owner, { name: 'First', hands: ['AA'] })
    const second = await repository.create(owner, { name: 'Second', hands: ['KK'] })
    const foreign = await repository.create(other, { name: 'Foreign', hands: ['QQ'] })

    await expect(
      repository.bulk(owner, {
        action: 'archive',
        items: [
          { id: first.id, version: first.version },
          { id: second.id, version: 999 },
        ],
      }),
    ).rejects.toBeInstanceOf(RangeVersionConflictError)
    await expect(repository.get(owner, first.id)).resolves.toMatchObject({ archived: false })
    await expect(
      repository.bulk(owner, {
        action: 'archive',
        items: [
          { id: first.id, version: first.version },
          { id: foreign.id, version: foreign.version },
        ],
      }),
    ).rejects.toBeInstanceOf(RangeNotFoundError)
    await expect(repository.get(owner, first.id)).resolves.toMatchObject({ archived: false })

    const favorite = await repository.bulk(owner, {
      action: 'favorite',
      items: [
        { id: second.id, version: second.version },
        { id: first.id, version: first.version },
      ],
    })
    if (favorite.action !== 'favorite') throw new Error('Expected favorite bulk result.')
    expect(favorite).toMatchObject({ atomic: true })
    expect(favorite.items.map((item) => [item.id, item.version, item.favorite])).toEqual([
      [second.id, 2, true],
      [first.id, 2, true],
    ])

    const deleted = await repository.bulk(owner, {
      action: 'delete',
      items: favorite.items.map((item) => ({ id: item.id, version: item.version })),
    })
    if (deleted.action !== 'delete') throw new Error('Expected delete bulk result.')
    expect(deleted).toMatchObject({ atomic: true })
    expect(deleted.items.map((item) => [item.id, item.version])).toEqual([
      [second.id, 3],
      [first.id, 3],
    ])
    expect(deleted.items.every((item) => item.deletedAt.endsWith('Z'))).toBe(true)

    const restored = await repository.bulk(owner, {
      action: 'restore',
      items: deleted.items.map((item) => ({ id: item.id, version: item.version })),
    })
    if (restored.action !== 'restore') throw new Error('Expected restore bulk result.')
    expect(restored.items.map((item) => [item.id, item.version, item.deletedAt])).toEqual([
      [second.id, 4, null],
      [first.id, 4, null],
    ])
  })
})
