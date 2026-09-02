import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { isValidHand } from '@poker-range-trainer/domain/domain/pokerHands'
import { idSchema } from '@poker-range-trainer/contracts'
import { runMigrations } from '@poker-range-trainer/database'
import { handClasses } from '@poker-range-trainer/database/schema'

const productionExports = [
  '@poker-range-trainer/domain/domain/pokerHands',
  '@poker-range-trainer/contracts',
  '@poker-range-trainer/database',
  '@poker-range-trainer/database/schema',
]

for (const specifier of productionExports) {
  const resolved = import.meta.resolve(specifier)
  if (!resolved.includes('/dist/') || !resolved.endsWith('.js')) {
    throw new Error(`${specifier} did not resolve to compiled production JavaScript: ${resolved}`)
  }
}

const compiledDatabaseEntrypoint = import.meta.resolve('@poker-range-trainer/database')
const compiledMigrator = new URL('./migrator.js', compiledDatabaseEntrypoint)
const compiledMigration = new URL('./migrations/0001_persistence_foundation.sql', compiledMigrator)

if (!existsSync(fileURLToPath(compiledMigration))) {
  throw new Error(`Compiled database migration is missing: ${compiledMigration}`)
}

if (!isValidHand('AKs')) {
  throw new Error('Domain production export did not validate a canonical hand.')
}

if (!idSchema.safeParse('00000000-0000-4000-8000-000000000000').success) {
  throw new Error('Contracts production export did not load a working schema.')
}

if (typeof runMigrations !== 'function' || handClasses === undefined) {
  throw new Error('Database production exports did not load.')
}

console.info('Shared-package production runtime smoke test passed.')
