import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'

import type { PracticeSessionSubmission } from '@poker-range-trainer/contracts'
import {
  createDatabase,
  createPostgresPool,
  requireDatabaseUrl,
  runMigrations,
  seedCanonicalHands,
} from '@poker-range-trainer/database'

import {
  PostgresPracticeRepository,
  PracticeIdempotencyConflictError,
  PracticeRangeNotFoundError,
  PracticeReplayCorruptedError,
  PracticeUnscorableError,
} from './repository.js'

const testDatabaseName = `poker_range_trainer_api_practice_${randomUUID().replaceAll('-', '')}`
const quotedTestDatabaseName = `"${testDatabaseName}"`
const now = new Date('2026-01-02T03:04:05.000Z')

function databaseUrlFor(connectionString: string, databaseName: string): string {
  const url = new URL(connectionString)
  url.pathname = `/${databaseName}`
  return url.toString()
}

describe('PostgreSQL practice repository', () => {
  const configuredUrl = requireDatabaseUrl()
  const adminPool = createPostgresPool(configuredUrl)
  let testPool: Pool
  let repository: PostgresPracticeRepository
  let created = false

  beforeAll(async () => {
    await adminPool.query(`create database ${quotedTestDatabaseName}`)
    created = true
    testPool = createPostgresPool(databaseUrlFor(configuredUrl, testDatabaseName))
    await runMigrations(testPool)
    await seedCanonicalHands(testPool)
    repository = new PostgresPracticeRepository(createDatabase(testPool), {
      now: () => new Date(now),
    })
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

  async function fixtureRange(deleted = false): Promise<{ userId: string; rangeId: string }> {
    const user = await testPool.query<{ id: string }>(
      'insert into users (email, password_hash) values ($1, $2) returning id',
      [`practice-${randomUUID()}@example.test`, 'fixture-password-hash-that-is-long-enough'],
    )
    const userId = user.rows[0]?.id
    if (!userId) throw new Error('missing fixture user')
    const range = await testPool.query<{ id: string }>(
      'insert into ranges (user_id, name, deleted_at) values ($1, $2, $3) returning id',
      [userId, 'Practice range', deleted ? now : null],
    )
    const rangeId = range.rows[0]?.id
    if (!rangeId) throw new Error('missing fixture range')
    await testPool.query(
      "insert into range_hands (range_id, user_id, hand_code) values ($1, $2, 'AA'), ($1, $2, 'AKs')",
      [rangeId, userId],
    )
    return { userId, rangeId }
  }

  async function emptyRange(): Promise<{ userId: string; rangeId: string }> {
    const user = await testPool.query<{ id: string }>(
      'insert into users (email, password_hash) values ($1, $2) returning id',
      [`empty-practice-${randomUUID()}@example.test`, 'fixture-password-hash-that-is-long-enough'],
    )
    const userId = user.rows[0]?.id
    if (!userId) throw new Error('missing fixture user')
    const range = await testPool.query<{ id: string }>(
      'insert into ranges (user_id, name) values ($1, $2) returning id',
      [userId, 'Empty practice range'],
    )
    const rangeId = range.rows[0]?.id
    if (!rangeId) throw new Error('missing fixture range')
    return { userId, rangeId }
  }

  function recognition(rangeId: string, idempotencyKey = randomUUID()): PracticeSessionSubmission {
    return {
      mode: 'recognition',
      rangeId,
      idempotencyKey,
      answers: [
        {
          questionId: randomUUID(),
          hand: 'AA',
          answer: false,
          answeredAt: '2024-01-01T00:00:00.000Z',
        },
        {
          questionId: randomUUID(),
          hand: 'AKo',
          answer: false,
          answeredAt: '2024-01-01T00:00:01.000Z',
        },
      ],
    }
  }

  function weakButHigh(rangeId: string): PracticeSessionSubmission {
    return {
      mode: 'timed',
      rangeId,
      idempotencyKey: randomUUID(),
      answers: [
        { questionId: randomUUID(), hand: 'AA', answer: false, answeredAt: now.toISOString() },
        { questionId: randomUUID(), hand: 'AKo', answer: false, answeredAt: now.toISOString() },
        { questionId: randomUUID(), hand: 'AKo', answer: false, answeredAt: now.toISOString() },
        { questionId: randomUUID(), hand: 'AKo', answer: false, answeredAt: now.toISOString() },
        { questionId: randomUUID(), hand: 'AKo', answer: false, answeredAt: now.toISOString() },
      ],
    }
  }

  it('writes session, raw attempts, cumulative stats, hand counters, review, and an immutable replay atomically', async () => {
    const { userId, rangeId } = await fixtureRange()
    const submission = recognition(rangeId)
    const first = await repository.submit(userId, submission)
    expect(first).toMatchObject({
      data: {
        session: {
          mode: 'recognition',
          totalQuestions: 2,
          correctAnswers: 1,
          completedAt: now.toISOString(),
        },
        stats: { totalAttempts: 2, correctAttempts: 1, accuracyPercentage: 50 },
        review: { intervalDays: 1, dueAt: '2026-01-03T03:04:05.000Z' },
      },
    })
    const replay = await repository.submit(userId, {
      ...submission,
      answers: [...submission.answers].reverse(),
    })
    expect(replay).toEqual(first)
    const persisted = await testPool.query<{ sessions: string; attempts: string; replays: string }>(
      `select
        (select count(*) from practice_sessions where range_id = $1) as sessions,
        (select count(*) from practice_attempts where range_id = $1) as attempts,
        (select count(*) from practice_submission_replays where user_id = $2) as replays`,
      [rangeId, userId],
    )
    expect(persisted.rows).toEqual([{ sessions: '1', attempts: '2', replays: '1' }])
    const rawAttempt = await testPool.query<{ answered_at: Date }>(
      'select answered_at from practice_attempts where range_id = $1 order by answered_at limit 1',
      [rangeId],
    )
    expect(rawAttempt.rows[0]?.answered_at.toISOString()).toBe('2024-01-01T00:00:00.000Z')
    const hands = await testPool.query<{ hand_code: string; attempts: number; correct: number }>(
      'select hand_code, attempts, correct from range_hand_accuracy where range_id = $1 order by hand_code',
      [rangeId],
    )
    expect(hands.rows).toEqual([
      { hand_code: 'AA', attempts: 1, correct: 0 },
      { hand_code: 'AKo', attempts: 1, correct: 1 },
    ])
    const tenantForeignKey = await testPool.query<{ definition: string }>(
      `select pg_get_constraintdef(oid) as definition
       from pg_constraint
       where conname = 'practice_replays_session_owner_range_fk'`,
    )
    expect(tenantForeignKey.rows[0]?.definition).toContain(
      'FOREIGN KEY (session_id, user_id, range_id) REFERENCES practice_sessions(id, user_id, range_id)',
    )
    await expect(
      repository.submit(userId, {
        ...submission,
        answers: [{ ...submission.answers[0]!, answer: true }],
      }),
    ).rejects.toBeInstanceOf(PracticeIdempotencyConflictError)
    await testPool.query(
      'update practice_submission_replays set response_snapshot = $1::jsonb where user_id = $2 and idempotency_key = $3',
      ['{}', userId, submission.idempotencyKey],
    )
    await expect(repository.submit(userId, submission)).rejects.toBeInstanceOf(
      PracticeReplayCorruptedError,
    )
  })

  it('records build summaries without fabricated per-hand boolean attempts', async () => {
    const { userId, rangeId } = await fixtureRange()
    const result = await repository.submit(userId, {
      mode: 'build',
      rangeId,
      idempotencyKey: randomUUID(),
      selectedHands: ['AA'],
    })
    expect(result.data.session).toMatchObject({
      mode: 'build',
      totalQuestions: 2,
      correctAnswers: 1,
    })
    const counts = await testPool.query<{ attempts: string; hand_rows: string }>(
      `select (select count(*) from practice_attempts where range_id = $1) as attempts,
       (select count(*) from range_hand_accuracy where range_id = $1) as hand_rows`,
      [rangeId],
    )
    expect(counts.rows).toEqual([{ attempts: '0', hand_rows: '0' }])
  })

  it('does not reveal cross-owner or deleted ranges', async () => {
    const owner = await fixtureRange()
    const other = await fixtureRange()
    await expect(
      repository.submit(other.userId, recognition(owner.rangeId)),
    ).rejects.toBeInstanceOf(PracticeRangeNotFoundError)
    const deleted = await fixtureRange(true)
    await expect(
      repository.submit(deleted.userId, recognition(deleted.rangeId)),
    ).rejects.toBeInstanceOf(PracticeRangeNotFoundError)
  })

  it('rejects an impossible unscorable build rather than persisting a zero-question session', async () => {
    const { userId, rangeId } = await emptyRange()
    await expect(
      repository.submit(userId, {
        mode: 'build',
        rangeId,
        idempotencyKey: randomUUID(),
        selectedHands: [],
      } as PracticeSessionSubmission),
    ).rejects.toBeInstanceOf(PracticeUnscorableError)
  })

  it('serializes distinct concurrent submissions without losing cumulative counters', async () => {
    const { userId, rangeId } = await fixtureRange()
    await Promise.all([
      repository.submit(userId, recognition(rangeId)),
      repository.submit(userId, recognition(rangeId)),
    ])
    const stats = await testPool.query<{ total_attempts: number; correct_attempts: number }>(
      'select total_attempts, correct_attempts from range_practice_stats where range_id = $1',
      [rangeId],
    )
    expect(stats.rows).toEqual([{ total_attempts: 4, correct_attempts: 2 }])
  })

  it('replays simultaneous semantically identical same-key submissions exactly once', async () => {
    const { userId, rangeId } = await fixtureRange()
    const submission = recognition(rangeId)
    const [first, replay] = await Promise.all([
      repository.submit(userId, submission),
      repository.submit(userId, { ...submission, answers: [...submission.answers].reverse() }),
    ])
    expect(replay).toEqual(first)
    const persisted = await testPool.query<{
      sessions: string
      attempts: string
      replays: string
      total_attempts: number
      correct_attempts: number
    }>(
      `select
        (select count(*) from practice_sessions where range_id = $1) as sessions,
        (select count(*) from practice_attempts where range_id = $1) as attempts,
        (select count(*) from practice_submission_replays where user_id = $2) as replays,
        (select total_attempts from range_practice_stats where range_id = $1) as total_attempts,
        (select correct_attempts from range_practice_stats where range_id = $1) as correct_attempts`,
      [rangeId, userId],
    )
    expect(persisted.rows).toEqual([
      { sessions: '1', attempts: '2', replays: '1', total_attempts: 2, correct_attempts: 1 },
    ])
  })

  it('serializes same-key conflicting submissions into one effect and one idempotency conflict', async () => {
    const { userId, rangeId } = await fixtureRange()
    const submission = recognition(rangeId)
    const changed = {
      ...submission,
      answers: submission.answers.map((answer, index) =>
        index === 0 ? { ...answer, answer: true } : answer,
      ),
    } as PracticeSessionSubmission
    const results = await Promise.allSettled([
      repository.submit(userId, submission),
      repository.submit(userId, changed),
    ])
    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof repository.submit>>> =>
        result.status === 'fulfilled',
    )
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    )
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect(rejected[0]?.reason).toBeInstanceOf(PracticeIdempotencyConflictError)
    const persisted = await testPool.query<{
      sessions: string
      attempts: string
      replays: string
      total_attempts: number
      correct_attempts: number
    }>(
      `select
        (select count(*) from practice_sessions where range_id = $1) as sessions,
        (select count(*) from practice_attempts where range_id = $1) as attempts,
        (select count(*) from practice_submission_replays where user_id = $2) as replays,
        (select total_attempts from range_practice_stats where range_id = $1) as total_attempts,
        (select correct_attempts from range_practice_stats where range_id = $1) as correct_attempts`,
      [rangeId, userId],
    )
    expect(persisted.rows).toEqual([
      {
        sessions: '1',
        attempts: '2',
        replays: '1',
        total_attempts: fulfilled[0]!.value.data.session.totalQuestions,
        correct_attempts: fulfilled[0]!.value.data.session.correctAnswers,
      },
    ])
  })

  it('uses cumulative per-hand confidence when advancing high-accuracy review intervals', async () => {
    const { userId, rangeId } = await fixtureRange()
    const first = await repository.submit(userId, weakButHigh(rangeId))
    const second = await repository.submit(userId, weakButHigh(rangeId))
    expect(first.data).toMatchObject({
      session: { accuracyPercentage: 80 },
      review: { ease: 2.6, intervalDays: 1 },
    })
    // Prior 1-day interval × prior ease 2.6 rounds to 3, then 0.5 confidence rounds it to 2.
    expect(second.data.review).toMatchObject({ ease: 2.7, intervalDays: 2 })
  })

  it('rolls back all records when a late raw-attempt insert violates a constraint and migration checks reject invalid replays', async () => {
    const { userId, rangeId } = await fixtureRange()
    const duplicateQuestion = randomUUID()
    const invalid = {
      ...recognition(rangeId),
      answers: [
        { questionId: duplicateQuestion, hand: 'AA', answer: true, answeredAt: now.toISOString() },
        {
          questionId: duplicateQuestion,
          hand: 'AKo',
          answer: false,
          answeredAt: now.toISOString(),
        },
      ],
    } as PracticeSessionSubmission
    await expect(repository.submit(userId, invalid)).rejects.toBeDefined()
    const sessions = await testPool.query<{ count: string }>(
      'select count(*) from practice_sessions where range_id = $1',
      [rangeId],
    )
    expect(sessions.rows).toEqual([{ count: '0' }])
    await expect(
      testPool.query(
        `insert into practice_submission_replays
          (user_id, range_id, idempotency_key, request_fingerprint, session_id, response_snapshot)
         values ($1, $2, $3, 'bad', $4, '[]'::jsonb)`,
        [userId, rangeId, randomUUID(), randomUUID()],
      ),
    ).rejects.toMatchObject({ code: '23514' })
  })
})
