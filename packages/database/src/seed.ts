import {
  classifyHand,
  comboCount,
  generateHandMatrix,
} from '@poker-range-trainer/domain/domain/pokerHands'
import { sql } from 'drizzle-orm'
import type { Pool } from 'pg'
import { fileURLToPath } from 'node:url'

import { createDatabase, createPostgresPool, requireDatabaseUrl } from './connection.js'
import { handClasses } from './schema.js'

/** Idempotently seed the canonical 169 preflop hand classes used by every FK. */
export async function seedCanonicalHands(pool: Pool): Promise<number> {
  const db = createDatabase(pool)
  const hands = generateHandMatrix()
    .flat()
    .map((code, matrixOrder) => ({
      code,
      category: classifyHand(code),
      comboCount: comboCount(code),
      matrixOrder,
    }))

  await db
    .insert(handClasses)
    .values(hands)
    .onConflictDoUpdate({
      target: handClasses.code,
      set: {
        category: sql`excluded.category`,
        comboCount: sql`excluded.combo_count`,
        matrixOrder: sql`excluded.matrix_order`,
      },
    })

  return hands.length
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = createPostgresPool(requireDatabaseUrl())

  try {
    const count = await seedCanonicalHands(pool)
    console.info(`Seeded ${count} canonical hand classes.`)
  } finally {
    await pool.end()
  }
}
