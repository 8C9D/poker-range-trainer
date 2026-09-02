import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool, type PoolConfig } from 'pg'

import * as schema from './schema.js'

export type Database = NodePgDatabase<typeof schema>

/** Fail early instead of letting a driver error expose a partial connection string. */
export function requireDatabaseUrl(value: string | undefined = process.env.DATABASE_URL): string {
  if (!value) throw new Error('DATABASE_URL is required.')
  return value
}

/** Create a bounded node-postgres pool owned by the caller. */
export function createPostgresPool(connectionString: string, options: PoolConfig = {}): Pool {
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 10_000,
    ...options,
  })
}

/** Wrap a pool in Drizzle without taking ownership of its lifecycle. */
export function createDatabase(pool: Pool): Database {
  return drizzle({ client: pool, schema })
}

/** Explicit lifecycle helper for process entry points and tests. */
export async function closeDatabase(pool: Pool): Promise<void> {
  await pool.end()
}
