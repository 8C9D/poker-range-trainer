import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import type { Pool } from 'pg'

const migrationsDirectory = fileURLToPath(new URL('./migrations/', import.meta.url))
const migrationAdvisoryLockKey = 710_217_129

/**
 * Apply each checked-in SQL migration exactly once, in lexical order.
 *
 * The session-scoped advisory lock covers the entire decision and application
 * window. This lets multiple application instances start concurrently without
 * racing on schema_migrations or attempting the same DDL twice.
 */
export async function runMigrations(pool: Pool): Promise<string[]> {
  const client = await pool.connect()
  try {
    await client.query('select pg_advisory_lock($1::bigint)', [migrationAdvisoryLockKey])
    await client.query(`
      create table if not exists schema_migrations (
        id text primary key,
        applied_at timestamptz not null default now()
      )
    `)

    const appliedResult = await client.query<{ id: string }>('select id from schema_migrations')
    const applied = new Set(appliedResult.rows.map((row) => row.id))
    const files = (await readdir(migrationsDirectory))
      .filter((file) => /^\d{4}_.+\.sql$/.test(file))
      .sort()
    const executed: string[] = []

    for (const file of files) {
      if (applied.has(file)) continue
      const migration = await readFile(new URL(`./migrations/${file}`, import.meta.url), 'utf8')
      let inTransaction = false
      await client.query('begin')
      inTransaction = true
      try {
        await client.query(migration)
        await client.query('insert into schema_migrations (id) values ($1)', [file])
        await client.query('commit')
        inTransaction = false
        executed.push(file)
      } catch (error) {
        if (inTransaction) await client.query('rollback')
        throw error
      }
    }

    return executed
  } finally {
    try {
      await client.query('select pg_advisory_unlock($1::bigint)', [migrationAdvisoryLockKey])
    } finally {
      client.release()
    }
  }
}
