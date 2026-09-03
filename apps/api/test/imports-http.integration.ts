import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

import type { Pool } from 'pg'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  legacyBackupCommitResponseSchema,
  legacyBackupExportResponseSchema,
  legacyBackupPreviewResponseSchema,
  legacyBackupV1Schema,
  type LegacyBackupV1,
} from '@poker-range-trainer/contracts'
import {
  createDatabase,
  createPostgresPool,
  requireDatabaseUrl,
  runMigrations,
  seedCanonicalHands,
} from '@poker-range-trainer/database'

import { createApp } from '../src/app.js'
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from '../src/auth/cookies.js'
import { createAuthMiddleware } from '../src/auth/middleware.js'
import { PostgresAuthRepository } from '../src/auth/repository.js'
import { createAuthRouter } from '../src/auth/routes.js'
import { loadConfig } from '../src/config.js'
import { PostgresImportsRepository } from '../src/imports/repository.js'
import { createExportsRouter, createImportsRouter } from '../src/imports/routes.js'
import { ImportsService } from '../src/imports/service.js'
import { createLogger } from '../src/logger.js'
import { PostgresPracticeRepository } from '../src/practice/repository.js'
import { createPracticeRouter } from '../src/practice/routes.js'
import { PracticeService } from '../src/practice/service.js'
import { PostgresRangeRepository } from '../src/ranges/repository.js'
import { createRangeRouter } from '../src/ranges/routes.js'
import { RangeService } from '../src/ranges/service.js'

const testDatabaseName = `poker_range_trainer_api_imports_http_${randomUUID().replaceAll('-', '')}`
const quotedTestDatabaseName = `"${testDatabaseName}"`

const seedBackup: LegacyBackupV1 = legacyBackupV1Schema.parse(
  JSON.parse(
    readFileSync(new URL('../../../screenshots/seed-backup.json', import.meta.url), 'utf8'),
  ),
)
const seedRangeIds = seedBackup.ranges.map((range) => range.id)

function databaseUrlFor(connectionString: string, databaseName: string): string {
  const url = new URL(connectionString)
  url.pathname = `/${databaseName}`
  return url.toString()
}

function cookieValue(header: string[] | undefined, name: string): string {
  const cookie = header?.find((value) => value.startsWith(`${name}=`))
  if (!cookie) throw new Error(`missing ${name} cookie`)
  return cookie.split(';', 1)[0]?.slice(name.length + 1) ?? ''
}

interface SessionCookies {
  cookie: string
  csrfToken: string
  userId: string
}

/** A backup without one range, and without every record that referenced it. */
function withoutRange(backup: LegacyBackupV1, rangeId: string): LegacyBackupV1 {
  const dropKey = (map: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(map).filter(([key]) => key !== rangeId))
  return legacyBackupV1Schema.parse({
    ...backup,
    ranges: backup.ranges.filter((range) => range.id !== rangeId),
    practiceStats: dropKey(backup.practiceStats),
    handAccuracy: dropKey(backup.handAccuracy),
    actionAccuracy: dropKey(backup.actionAccuracy),
    sessionHistory: dropKey(backup.sessionHistory),
    reviewStates: dropKey(backup.reviewStates),
  })
}

/** One extra range, with a single practised session, appended to a backup. */
function withExtraRange(backup: LegacyBackupV1, id: string, name: string): LegacyBackupV1 {
  return legacyBackupV1Schema.parse({
    ...backup,
    ranges: [
      ...backup.ranges,
      {
        id,
        name,
        hands: ['AA', 'KK', 'AKs'],
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-02T00:00:00.000Z',
        metadata: { gameType: 'cash', tableSize: 'sixMax', position: 'hj', actionType: 'open' },
      },
    ],
    sessionHistory: {
      ...backup.sessionHistory,
      [id]: [
        {
          rangeId: id,
          playedAt: '2026-08-02T00:00:00.000Z',
          totalQuestions: 10,
          correctAnswers: 9,
        },
      ],
    },
  })
}

describe('HTTP legacy backup import and export against PostgreSQL', () => {
  const configuredUrl = requireDatabaseUrl()
  const adminPool = createPostgresPool(configuredUrl)
  const testUrl = databaseUrlFor(configuredUrl, testDatabaseName)
  const config = loadConfig({ DATABASE_URL: testUrl, NODE_ENV: 'test', RATE_LIMIT_MAX: '1000' })
  const logger = createLogger('silent')
  let testPool: Pool | undefined
  let app: ReturnType<typeof createApp>
  let databaseCreated = false

  beforeAll(async () => {
    await adminPool.query(`create database ${quotedTestDatabaseName}`)
    databaseCreated = true
    testPool = createPostgresPool(testUrl)
    await runMigrations(testPool)
    await seedCanonicalHands(testPool)
    const database = createDatabase(testPool)
    const authRepository = new PostgresAuthRepository(database, { now: () => new Date() })
    const middleware = createAuthMiddleware({ repository: authRepository, config, logger })
    const rangeService = new RangeService(new PostgresRangeRepository(database))
    const practiceService = new PracticeService(new PostgresPracticeRepository(database))
    const importsService = new ImportsService(new PostgresImportsRepository(database))
    app = createApp({
      config,
      logger,
      readiness: async () => {
        await testPool?.query('select 1')
      },
      registerRoutes(api) {
        api.use(
          '/api/v1/auth',
          createAuthRouter({ config, logger, repository: authRepository, middleware }),
        )
        api.use('/api/v1/ranges', createRangeRouter({ service: rangeService, middleware }))
        api.use('/api/v1/practice', createPracticeRouter({ service: practiceService, middleware }))
        api.use('/api/v1/imports', createImportsRouter({ service: importsService, middleware }))
        api.use('/api/v1/exports', createExportsRouter({ service: importsService, middleware }))
      },
    })
  })

  afterAll(async () => {
    await testPool?.end()
    if (databaseCreated) {
      await adminPool.query(
        'select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()',
        [testDatabaseName],
      )
      await adminPool.query(`drop database if exists ${quotedTestDatabaseName}`)
    }
    await adminPool.end()
  })

  async function register(label: string): Promise<SessionCookies> {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: `${label}-${randomUUID()}@example.test`, password: 'password12345' })
      .expect(201)
    const sessionToken = cookieValue(response.headers['set-cookie'], SESSION_COOKIE_NAME)
    const csrfToken = cookieValue(response.headers['set-cookie'], CSRF_COOKIE_NAME)
    return {
      cookie: `${SESSION_COOKIE_NAME}=${sessionToken}; ${CSRF_COOKIE_NAME}=${csrfToken}`,
      csrfToken,
      userId: response.body.data.user.id as string,
    }
  }

  function asUser(session: SessionCookies) {
    return { Cookie: session.cookie, 'x-csrf-token': session.csrfToken }
  }

  async function preview(session: SessionCookies, backup: LegacyBackupV1) {
    const response = await request(app)
      .post('/api/v1/imports/legacy-backup/preview')
      .set(asUser(session))
      .send({ backup })
      .expect(200)
    expect(legacyBackupPreviewResponseSchema.safeParse(response.body).success).toBe(true)
    expect(response.headers['cache-control']).toBe('no-store')
    return legacyBackupPreviewResponseSchema.parse(response.body).data
  }

  async function commit(
    session: SessionCookies,
    backup: LegacyBackupV1,
    strategy: 'merge' | 'replace',
    expectedDigest: string,
  ) {
    const response = await request(app)
      .post('/api/v1/imports/legacy-backup')
      .set(asUser(session))
      .send({ backup, expectedDigest, strategy })
      .expect(200)
    expect(legacyBackupCommitResponseSchema.safeParse(response.body).success).toBe(true)
    return legacyBackupCommitResponseSchema.parse(response.body).data
  }

  async function importSeed(session: SessionCookies) {
    const previewed = await preview(session, seedBackup)
    return commit(session, seedBackup, 'merge', previewed.digest)
  }

  async function listRanges(session: SessionCookies) {
    const response = await request(app)
      .get('/api/v1/ranges?pageSize=50')
      .set(asUser(session))
      .expect(200)
    return response.body.data as {
      id: string
      name: string
      handCount: number
      favorite: boolean
      metadata: Record<string, unknown> | null
    }[]
  }

  async function countRows(sql: string, parameters: unknown[]): Promise<number> {
    const result = await testPool?.query<{ count: string }>(sql, parameters)
    return Number(result?.rows[0]?.count ?? -1)
  }

  it('previews, commits, reads back, and re-exports the seed backup', async () => {
    const owner = await register('import-owner')
    await request(app).post('/api/v1/imports/legacy-backup/preview').send({}).expect(401)
    await request(app).get('/api/v1/exports/backup').expect(401)

    const previewed = await preview(owner, seedBackup)
    expect(previewed.counts).toEqual({
      ranges: 4,
      practiceStats: 4,
      handAccuracy: 65,
      actionAccuracy: 8,
      sessions: 16,
      reviewStates: 4,
      spotAccuracy: 4,
    })
    expect(previewed.alreadyImported).toBe(false)
    expect(previewed.conflicts).toEqual([])
    expect(previewed.preservationWarnings.length).toBeGreaterThan(0)
    expect(previewed.preservationWarnings.map((warning) => warning.kind)).toContain(
      'retired_accuracy_records',
    )
    // A preview writes nothing at all.
    expect(await countRows('select count(*) from ranges where user_id = $1', [owner.userId])).toBe(
      0,
    )
    expect(
      await countRows('select count(*) from legacy_imports where user_id = $1', [owner.userId]),
    ).toBe(0)

    const committed = await commit(owner, seedBackup, 'merge', previewed.digest)
    expect(committed).toMatchObject({
      result: 'committed',
      atomic: true,
      strategy: 'merge',
      digest: previewed.digest,
    })
    expect(committed.counts).toEqual(previewed.counts)

    const listed = await listRanges(owner)
    const byName = new Map(listed.map((item) => [item.name, item]))
    expect([...byName.keys()].sort()).toEqual([
      'BTN open 100bb',
      'CO open 100bb',
      'SB 3-bet vs BTN',
      'UTG open 100bb',
    ])
    expect(byName.get('BTN open 100bb')?.handCount).toBe(72)
    expect(byName.get('UTG open 100bb')?.handCount).toBe(24)
    expect(byName.get('CO open 100bb')?.handCount).toBe(52)
    expect(byName.get('SB 3-bet vs BTN')?.handCount).toBe(17)
    expect(byName.get('BTN open 100bb')?.favorite).toBe(true)
    expect(byName.get('BTN open 100bb')?.metadata).toEqual({
      gameType: 'cash',
      tableSize: 'sixMax',
      stackDepthBb: 100,
      position: 'btn',
      actionType: 'open',
      notes: 'Standard 6-max button opening range.',
    })

    const btnId = byName.get('BTN open 100bb')?.id ?? ''
    const practice = await request(app)
      .get(`/api/v1/practice/ranges/${btnId}`)
      .set(asUser(owner))
      .expect(200)
    expect(practice.body.data.stats).toMatchObject({
      totalAttempts: 145,
      correctAttempts: 121,
      lastPracticedAt: '2026-08-18T09:02:00.000Z',
    })
    expect(practice.body.data.review).toMatchObject({
      ease: 2.6,
      intervalDays: 5,
      dueAt: '2026-08-23T09:02:00.000Z',
      lastReviewedAt: '2026-08-18T09:02:00.000Z',
    })
    expect(practice.body.data.handAccuracy).toHaveLength(23)
    expect(practice.body.data.handAccuracy).toContainEqual({
      hand: '22',
      attempts: 6,
      correct: 5,
      falsePositives: 1,
      falseNegatives: 0,
    })
    expect(practice.body.data.recentSessions).toHaveLength(6)

    expect(
      await countRows('select count(*) from practice_sessions where user_id = $1', [owner.userId]),
    ).toBe(16)
    expect(
      await countRows('select count(*) from range_hand_accuracy where user_id = $1', [
        owner.userId,
      ]),
    ).toBe(65)
    expect(
      await countRows('select count(*) from range_practice_stats where user_id = $1', [
        owner.userId,
      ]),
    ).toBe(4)
    expect(
      await countRows('select count(*) from review_states where user_id = $1', [owner.userId]),
    ).toBe(4)
    const goal = await testPool?.query<{ daily_hand_goal: number }>(
      'select daily_hand_goal from user_training_goals where user_id = $1',
      [owner.userId],
    )
    expect(goal?.rows[0]?.daily_hand_goal).toBe(50)

    const record = await testPool?.query<{
      status: string
      backup_sha256: string
      outcome: { strategy: string } | null
      completed_at: Date | null
    }>(
      'select status, backup_sha256, outcome, completed_at from legacy_imports where user_id = $1',
      [owner.userId],
    )
    expect(record?.rows).toHaveLength(1)
    expect(record?.rows[0]?.status).toBe('completed')
    expect(record?.rows[0]?.backup_sha256).toBe(previewed.digest.slice('sha256:'.length))
    expect(record?.rows[0]?.outcome?.strategy).toBe('merge')
    expect(record?.rows[0]?.completed_at).not.toBeNull()

    const preserved = await testPool?.query<{ legacy_payload: Record<string, unknown> }>(
      'select legacy_payload from ranges where user_id = $1 and legacy_range_id = $2',
      [owner.userId, 'rng-btn-open'],
    )
    expect(preserved?.rows[0]?.legacy_payload).toEqual({
      tags: ['6-max', 'RFI'],
      source: { kind: 'coach', reference: 'Preflop lab, module 4' },
    })

    // A repeat upload of the same file can never duplicate anything.
    const repeated = await request(app)
      .post('/api/v1/imports/legacy-backup')
      .set(asUser(owner))
      .send({ backup: seedBackup, expectedDigest: previewed.digest, strategy: 'merge' })
      .expect(409)
    expect(repeated.body).toMatchObject({ code: 'CONFLICT' })
    expect(await countRows('select count(*) from ranges where user_id = $1', [owner.userId])).toBe(
      4,
    )

    const stale = await request(app)
      .post('/api/v1/imports/legacy-backup')
      .set(asUser(owner))
      .send({
        backup: withoutRange(seedBackup, 'rng-co-open'),
        expectedDigest: previewed.digest,
        strategy: 'merge',
      })
      .expect(409)
    expect(stale.body).toMatchObject({ code: 'CONFLICT' })

    const second = await preview(owner, seedBackup)
    expect(second.alreadyImported).toBe(true)
    expect(second.conflicts.map((conflict) => conflict.kind)).toEqual([
      'already_imported',
      'range_id_collision',
      'merge_required',
    ])
    expect([...(second.conflicts[1]?.rangeIds ?? [])].sort()).toEqual([...seedRangeIds].sort())

    const exported = await request(app).get('/api/v1/exports/backup').set(asUser(owner)).expect(200)
    expect(legacyBackupExportResponseSchema.safeParse(exported.body).success).toBe(true)
    expect(exported.headers['cache-control']).toBe('no-store')
    expect(exported.headers['content-disposition']).toMatch(
      /^attachment; filename="poker-range-trainer-backup-\d{4}-\d{2}-\d{2}\.json"$/,
    )
    const file = legacyBackupV1Schema.parse(exported.body.data.backup)
    expect(file.version).toBe(1)
    expect(file.trainingGoal).toBe(50)
    expect(file.actionAccuracy).toEqual({})
    expect(file.ranges.map((range) => range.id).sort()).toEqual([...seedRangeIds].sort())
    for (const original of seedBackup.ranges) {
      const roundTripped = file.ranges.find((range) => range.id === original.id)
      expect(roundTripped?.name).toBe(original.name)
      expect([...(roundTripped?.hands ?? [])].sort()).toEqual([...original.hands].sort())
      expect(roundTripped?.createdAt).toBe(original.createdAt)
      expect(roundTripped?.metadata).toEqual(original.metadata)
      expect(file.sessionHistory[original.id] ?? []).toEqual(
        seedBackup.sessionHistory[original.id] ?? [],
      )
      expect(file.practiceStats[original.id]).toEqual(seedBackup.practiceStats[original.id])
      expect(file.reviewStates[original.id]).toEqual(seedBackup.reviewStates[original.id])
      expect(file.handAccuracy[original.id]).toEqual(seedBackup.handAccuracy[original.id])
    }
    // Dormant fields survive the round trip even though nothing reads them.
    const exportedBtn = file.ranges.find((range) => range.id === 'rng-btn-open')
    expect(exportedBtn).toMatchObject({
      tags: ['6-max', 'RFI'],
      source: { kind: 'coach', reference: 'Preflop lab, module 4' },
      favorite: true,
    })
  })

  it('replaces the library with a modified backup', async () => {
    const owner = await register('import-replace')
    await importSeed(owner)
    const modified = withExtraRange(
      withoutRange(seedBackup, 'rng-co-open'),
      'rng-hj-open',
      'HJ open 100bb',
    )

    const previewed = await preview(owner, modified)
    expect(previewed.alreadyImported).toBe(false)
    expect(previewed.conflicts.map((conflict) => conflict.kind)).toEqual([
      'range_id_collision',
      'merge_required',
    ])
    const committed = await commit(owner, modified, 'replace', previewed.digest)
    expect(committed.counts.ranges).toBe(4)

    const listed = await listRanges(owner)
    expect(listed.map((item) => item.name).sort()).toEqual([
      'BTN open 100bb',
      'HJ open 100bb',
      'SB 3-bet vs BTN',
      'UTG open 100bb',
    ])
    expect(
      await countRows('select count(*) from ranges where user_id = $1 and deleted_at is not null', [
        owner.userId,
      ]),
    ).toBe(4)
    // The retired copies released their legacy identifiers to the incoming ones.
    expect(
      await countRows(
        'select count(*) from ranges where user_id = $1 and deleted_at is not null and legacy_range_id is not null',
        [owner.userId],
      ),
    ).toBe(0)
    // 16 imported before, 13 in the replacement; the retired drills are kept.
    expect(
      await countRows('select count(*) from practice_sessions where user_id = $1', [owner.userId]),
    ).toBe(29)
    expect(
      await countRows(
        `select count(*) from practice_sessions session
         join ranges range_row on range_row.id = session.range_id
         where session.user_id = $1 and range_row.deleted_at is null`,
        [owner.userId],
      ),
    ).toBe(13)

    const exported = await request(app).get('/api/v1/exports/backup').set(asUser(owner)).expect(200)
    const file = legacyBackupV1Schema.parse(exported.body.data.backup)
    expect(file.ranges.map((range) => range.id).sort()).toEqual([
      'rng-btn-open',
      'rng-hj-open',
      'rng-sb-3bet',
      'rng-utg-open',
    ])
  })

  it('merges only the ranges the library does not already have', async () => {
    const owner = await register('import-merge')
    await importSeed(owner)
    const partial = legacyBackupV1Schema.parse({
      version: 1,
      exportedAt: '2026-08-19T09:15:00.000Z',
      ranges: [
        {
          id: 'rng-btn-open',
          name: 'Renamed button range',
          hands: ['AA'],
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-02T00:00:00.000Z',
        },
        {
          id: 'rng-hj-open',
          name: 'HJ open 100bb',
          hands: ['AA', 'KK', 'AKs'],
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-02T00:00:00.000Z',
        },
      ],
      practiceStats: {},
      handAccuracy: {},
      actionAccuracy: {},
      sessionHistory: {},
      reviewStates: {},
      trainingGoal: 999,
    })

    const previewed = await preview(owner, partial)
    expect(previewed.conflicts).toContainEqual({
      kind: 'range_id_collision',
      rangeIds: ['rng-btn-open'],
      message: expect.any(String),
    })
    const committed = await commit(owner, partial, 'merge', previewed.digest)
    expect(committed.counts.ranges).toBe(1)

    const listed = await listRanges(owner)
    expect(listed.map((item) => item.name).sort()).toEqual([
      'BTN open 100bb',
      'CO open 100bb',
      'HJ open 100bb',
      'SB 3-bet vs BTN',
      'UTG open 100bb',
    ])
    // The existing range was skipped whole, not partially overwritten.
    expect(listed.find((item) => item.name === 'BTN open 100bb')?.handCount).toBe(72)
    const goal = await testPool?.query<{ daily_hand_goal: number }>(
      'select daily_hand_goal from user_training_goals where user_id = $1',
      [owner.userId],
    )
    // Merging never overwrites a goal the owner already has.
    expect(goal?.rows[0]?.daily_hand_goal).toBe(50)
  })

  it('re-imports its own export without duplicating a natively created range', async () => {
    const owner = await register('import-native')
    const created = await request(app)
      .post('/api/v1/ranges')
      .set(asUser(owner))
      .send({ name: 'Native BTN open', hands: ['AA', 'AKs'] })
      .expect(201)
    const rangeId = created.body.data.id as string
    await request(app)
      .post('/api/v1/practice/sessions')
      .set(asUser(owner))
      .send({
        mode: 'recognition',
        rangeId,
        idempotencyKey: randomUUID(),
        answers: [
          {
            questionId: randomUUID(),
            hand: 'AA',
            answer: true,
            answeredAt: '2026-08-18T09:00:00.000Z',
          },
        ],
      })
      .expect(200)

    const exported = await request(app).get('/api/v1/exports/backup').set(asUser(owner)).expect(200)
    const file = legacyBackupV1Schema.parse(exported.body.data.backup)
    // A range this app created is exported under its own identifier.
    expect(file.ranges.map((range) => range.id)).toEqual([rangeId])
    expect(Object.keys(file.sessionHistory)).toEqual([rangeId])

    const previewed = await preview(owner, file)
    expect(previewed.conflicts).toEqual([
      { kind: 'range_id_collision', rangeIds: [rangeId], message: expect.any(String) },
      { kind: 'merge_required', rangeIds: [], message: expect.any(String) },
    ])
    const committed = await commit(owner, file, 'merge', previewed.digest)
    expect(committed.counts.ranges).toBe(0)
    expect(committed.counts.sessions).toBe(0)

    const listed = await listRanges(owner)
    expect(listed).toHaveLength(1)
    expect(listed[0]?.id).toBe(rangeId)
    expect(
      await countRows('select count(*) from practice_sessions where user_id = $1', [owner.userId]),
    ).toBe(1)
  })

  it('writes nothing at all when any part of a commit fails', async () => {
    const owner = await register('import-atomic')
    await importSeed(owner)
    const modified = withoutRange(seedBackup, 'rng-co-open')
    const previewed = await preview(owner, modified)

    // Claim the owner-scoped checksum, so the commit's very first write fails.
    await testPool?.query(
      `insert into legacy_imports (user_id, backup_version, backup_sha256, status, snapshot)
       values ($1, 1, $2, 'pending', '{}'::jsonb)`,
      [owner.userId, previewed.digest.slice('sha256:'.length)],
    )

    const failed = await request(app)
      .post('/api/v1/imports/legacy-backup')
      .set(asUser(owner))
      .send({ backup: modified, expectedDigest: previewed.digest, strategy: 'replace' })
      .expect(409)
    expect(failed.body).toMatchObject({ code: 'CONFLICT' })

    // The library is exactly as the seed import left it.
    const listed = await listRanges(owner)
    expect(listed).toHaveLength(4)
    expect(
      await countRows('select count(*) from ranges where user_id = $1 and deleted_at is not null', [
        owner.userId,
      ]),
    ).toBe(0)
    expect(
      await countRows('select count(*) from practice_sessions where user_id = $1', [owner.userId]),
    ).toBe(16)
    expect(
      await countRows(
        "select count(*) from legacy_imports where user_id = $1 and status = 'completed'",
        [owner.userId],
      ),
    ).toBe(1)
    const goal = await testPool?.query<{ daily_hand_goal: number }>(
      'select daily_hand_goal from user_training_goals where user_id = $1',
      [owner.userId],
    )
    expect(goal?.rows[0]?.daily_hand_goal).toBe(50)
  })
})
