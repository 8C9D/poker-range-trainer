import { createPostgresPool, requireDatabaseUrl } from './connection.js'
import { runMigrations } from './migrator.js'
import { fileURLToPath } from 'node:url'

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = createPostgresPool(requireDatabaseUrl())

  try {
    const migrations = await runMigrations(pool)
    console.info(`Applied ${migrations.length} migration(s).`)
  } finally {
    await pool.end()
  }
}
