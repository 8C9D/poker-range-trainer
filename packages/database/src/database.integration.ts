import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'

import { createPostgresPool, requireDatabaseUrl } from './connection.js'
import { runMigrations } from './migrator.js'
import { seedCanonicalHands } from './seed.js'

const testDatabaseName = `poker_range_trainer_test_${randomUUID().replaceAll('-', '')}`
const quotedTestDatabaseName = `"${testDatabaseName}"`

function databaseUrlFor(connectionString: string, databaseName: string): string {
  const url = new URL(connectionString)
  url.pathname = `/${databaseName}`
  return url.toString()
}

describe('PostgreSQL persistence foundation', () => {
  const configuredUrl = requireDatabaseUrl()
  const adminPool = createPostgresPool(configuredUrl)
  let testPool: Pool
  let databaseCreated = false

  beforeAll(async () => {
    await adminPool.query(`create database ${quotedTestDatabaseName}`)
    databaseCreated = true
    testPool = createPostgresPool(databaseUrlFor(configuredUrl, testDatabaseName))
    await runMigrations(testPool)
    await seedCanonicalHands(testPool)
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

  it('migrates and seeds exactly the canonical 169 hand classes', async () => {
    const result = await testPool.query<{ hand_count: string; combo_count: string }>(
      'select count(*) as hand_count, sum(combo_count) as combo_count from hand_classes',
    )

    expect(result.rows).toEqual([{ hand_count: '169', combo_count: '1326' }])
  })

  it('serializes concurrent migration runs on a fresh database', async () => {
    const databaseName = `poker_range_trainer_migration_test_${randomUUID().replaceAll('-', '')}`
    const quotedDatabaseName = `"${databaseName}"`
    let firstPool: Pool | undefined
    let secondPool: Pool | undefined
    let created = false

    try {
      await adminPool.query(`create database ${quotedDatabaseName}`)
      created = true
      const connectionString = databaseUrlFor(configuredUrl, databaseName)
      firstPool = createPostgresPool(connectionString)
      secondPool = createPostgresPool(connectionString)

      const results = await Promise.all([runMigrations(firstPool), runMigrations(secondPool)])
      expect(results.flat()).toEqual(['0001_persistence_foundation.sql'])
      const ledger = await firstPool.query<{ id: string; count: string }>(
        'select id, count(*) as count from schema_migrations group by id order by id',
      )
      const usersTable = await firstPool.query<{ users_table: string | null }>(
        "select to_regclass('public.users')::text as users_table",
      )

      expect(ledger.rows).toEqual([{ id: '0001_persistence_foundation.sql', count: '1' }])
      expect(usersTable.rows).toEqual([{ users_table: 'users' }])
    } finally {
      await firstPool?.end()
      await secondPool?.end()
      if (created) {
        await adminPool.query(
          'select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()',
          [databaseName],
        )
        await adminPool.query(`drop database if exists ${quotedDatabaseName}`)
      }
    }
  })

  it('enforces ownership, idempotency, hand vocabulary, and stored invariants', async () => {
    await expect(
      testPool.query(
        "insert into users (email, password_hash) values ('short-hash@example.test', 'too-short')",
      ),
    ).rejects.toMatchObject({ code: '23514' })
    const firstUser = await testPool.query<{ id: string }>(
      "insert into users (email, password_hash) values ('owner@example.test', 'fixture-password-hash-1') returning id",
    )
    const secondUser = await testPool.query<{ id: string }>(
      "insert into users (email, password_hash) values ('other@example.test', 'fixture-password-hash-2') returning id",
    )
    const ownerId = firstUser.rows[0]?.id
    const otherUserId = secondUser.rows[0]?.id
    expect(ownerId).toBeTruthy()
    expect(otherUserId).toBeTruthy()

    const range = await testPool.query<{ id: string }>(
      `insert into ranges (user_id, name, game_type, table_size, "position", action_type)
       values ($1, 'Button open', 'cash', 'sixMax', 'btn', 'open') returning id`,
      [ownerId],
    )
    const rangeId = range.rows[0]?.id
    expect(rangeId).toBeTruthy()

    await testPool.query(
      "insert into range_hands (range_id, user_id, hand_code) values ($1, $2, 'AKs')",
      [rangeId, ownerId],
    )
    await expect(
      testPool.query(
        "insert into range_hands (range_id, user_id, hand_code) values ($1, $2, 'AQs')",
        [rangeId, otherUserId],
      ),
    ).rejects.toMatchObject({ code: '23503' })
    await expect(
      testPool.query(
        "insert into range_hands (range_id, user_id, hand_code) values ($1, $2, 'ZZs')",
        [rangeId, ownerId],
      ),
    ).rejects.toMatchObject({ code: '23503' })
    await expect(
      testPool.query(
        'insert into range_practice_stats (range_id, user_id, total_attempts, correct_attempts) values ($1, $2, 3, 4)',
        [rangeId, ownerId],
      ),
    ).rejects.toMatchObject({ code: '23514' })
    await expect(
      testPool.query(
        `insert into range_hand_accuracy
          (range_id, user_id, hand_code, attempts, correct, false_positives, false_negatives)
         values ($1, $2, 'AKs', 4, 3, 1, 1)`,
        [rangeId, ownerId],
      ),
    ).rejects.toMatchObject({ code: '23514' })
    const idempotencyKey = randomUUID()
    const session = await testPool.query<{ id: string }>(
      `insert into practice_sessions
        (user_id, range_id, mode, idempotency_key, total_questions, correct_answers, completed_at)
       values ($1, $2, 'recognition', $3, 1, 1, now()) returning id`,
      [ownerId, rangeId, idempotencyKey],
    )
    const sessionId = session.rows[0]?.id
    expect(sessionId).toBeTruthy()
    await expect(
      testPool.query(
        `insert into practice_sessions
          (user_id, range_id, mode, idempotency_key, total_questions, correct_answers, completed_at)
         values ($1, $2, 'recognition', $3, 1, 1, now())`,
        [ownerId, rangeId, idempotencyKey],
      ),
    ).rejects.toMatchObject({ code: '23505' })
    await expect(
      testPool.query(
        `insert into practice_sessions
          (user_id, range_id, mode, idempotency_key, total_questions, correct_answers, completed_at)
         values ($1, $2, 'action', $3, 1, 1, now())`,
        [ownerId, rangeId, randomUUID()],
      ),
    ).rejects.toMatchObject({ code: '22P02' })
    const questionId = randomUUID()
    await testPool.query(
      `insert into practice_attempts
        (session_id, user_id, range_id, question_id, hand_code, expected_in_range, user_answered_in_range, correct, answered_at)
       values ($1, $2, $3, $4, 'AKs', true, true, true, now())`,
      [sessionId, ownerId, rangeId, questionId],
    )
    await expect(
      testPool.query(
        `insert into practice_attempts
          (session_id, user_id, range_id, question_id, hand_code, expected_in_range, user_answered_in_range, correct, answered_at)
         values ($1, $2, $3, $4, 'AQs', true, true, true, now())`,
        [sessionId, ownerId, rangeId, questionId],
      ),
    ).rejects.toMatchObject({ code: '23505' })
    await expect(
      testPool.query(
        `insert into practice_attempts
          (session_id, user_id, range_id, question_id, hand_code, expected_in_range, user_answered_in_range, correct, answered_at)
         values ($1, $2, $3, $4, 'AQs', true, true, false, now())`,
        [sessionId, ownerId, rangeId, randomUUID()],
      ),
    ).rejects.toMatchObject({ code: '23514' })
    await expect(
      testPool.query('insert into user_training_goals (user_id, daily_hand_goal) values ($1, 15)', [
        ownerId,
      ]),
    ).rejects.toMatchObject({ code: '23514' })
  })

  it('cascades range-owned practice, stats, accuracy, and review records', async () => {
    const user = await testPool.query<{ id: string }>(
      "insert into users (email, password_hash) values ('cascade@example.test', 'fixture-password-hash-3') returning id",
    )
    const userId = user.rows[0]?.id
    expect(userId).toBeTruthy()
    const range = await testPool.query<{ id: string }>(
      "insert into ranges (user_id, name) values ($1, 'Cascade range') returning id",
      [userId],
    )
    const rangeId = range.rows[0]?.id
    expect(rangeId).toBeTruthy()
    const session = await testPool.query<{ id: string }>(
      `insert into practice_sessions
        (user_id, range_id, idempotency_key, total_questions, correct_answers, completed_at)
       values ($1, $2, $3, 1, 1, now()) returning id`,
      [userId, rangeId, randomUUID()],
    )
    const sessionId = session.rows[0]?.id
    expect(sessionId).toBeTruthy()

    await testPool.query(
      `insert into practice_attempts
        (session_id, user_id, range_id, question_id, hand_code, expected_in_range, user_answered_in_range, correct, answered_at)
       values ($1, $2, $3, $4, 'AKs', true, true, true, now())`,
      [sessionId, userId, rangeId, randomUUID()],
    )
    await testPool.query(
      `insert into range_practice_stats
        (range_id, user_id, total_attempts, correct_attempts, last_practiced_at)
       values ($1, $2, 1, 1, now())`,
      [rangeId, userId],
    )
    await testPool.query(
      `insert into range_hand_accuracy
        (range_id, user_id, hand_code, attempts, correct, false_positives, false_negatives)
       values ($1, $2, 'AKs', 1, 1, 0, 0)`,
      [rangeId, userId],
    )
    await testPool.query(
      `insert into review_states (range_id, user_id, ease, interval_days, due_at, last_reviewed_at)
       values ($1, $2, 2.5, 1, now() + interval '1 day', now())`,
      [rangeId, userId],
    )

    await testPool.query('delete from ranges where id = $1 and user_id = $2', [rangeId, userId])
    const remaining = await testPool.query<{ count: string }>(
      `select count(*) as count from (
        select id::text from practice_sessions where range_id = $1
        union all select id::text from practice_attempts where range_id = $1
        union all select range_id::text from range_practice_stats where range_id = $1
        union all select range_id::text from range_hand_accuracy where range_id = $1
        union all select range_id::text from review_states where range_id = $1
      ) as range_children`,
      [rangeId],
    )

    expect(remaining.rows).toEqual([{ count: '0' }])
  })

  it('nulls deleted import links and cascades a deleted user through owned records', async () => {
    const user = await testPool.query<{ id: string }>(
      "insert into users (email, password_hash) values ('delete-user@example.test', 'fixture-password-hash-4') returning id",
    )
    const userId = user.rows[0]?.id
    expect(userId).toBeTruthy()
    const imported = await testPool.query<{ id: string }>(
      `insert into legacy_imports (user_id, backup_version, backup_sha256, snapshot)
       values ($1, 1, repeat('a', 64), '{}'::jsonb) returning id`,
      [userId],
    )
    const importId = imported.rows[0]?.id
    expect(importId).toBeTruthy()
    const range = await testPool.query<{ id: string }>(
      `insert into ranges (user_id, name, legacy_range_id, legacy_backup_version, legacy_import_id)
       values ($1, 'Imported range', 'legacy-1', 1, $2) returning id`,
      [userId, importId],
    )
    const rangeId = range.rows[0]?.id
    expect(rangeId).toBeTruthy()

    await testPool.query('delete from legacy_imports where id = $1', [importId])
    const importLink = await testPool.query<{ legacy_import_id: string | null }>(
      'select legacy_import_id from ranges where id = $1',
      [rangeId],
    )
    expect(importLink.rows).toEqual([{ legacy_import_id: null }])

    await testPool.query(
      `insert into auth_sessions (user_id, token_hash, csrf_token_hash, expires_at)
       values ($1, repeat('b', 64), repeat('c', 64), now() + interval '1 day')`,
      [userId],
    )
    await testPool.query(
      'insert into user_training_goals (user_id, daily_hand_goal) values ($1, 20)',
      [userId],
    )
    await testPool.query('delete from users where id = $1', [userId])
    const remaining = await testPool.query<{ count: string }>(
      `select count(*) as count from (
        select id::text from users where id = $1
        union all select id::text from auth_sessions where user_id = $1
        union all select id::text from ranges where user_id = $1
        union all select user_id::text from user_training_goals where user_id = $1
      ) as user_children`,
      [userId],
    )

    expect(remaining.rows).toEqual([{ count: '0' }])
  })
})
