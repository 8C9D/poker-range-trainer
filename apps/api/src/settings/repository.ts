import { eq, sql } from 'drizzle-orm'

import type { TrainingGoalRead } from '@poker-range-trainer/contracts'
import type { Database } from '@poker-range-trainer/database'
import {
  practiceSessions,
  rangeHandAccuracy,
  rangePracticeStats,
  reviewStates,
  userTrainingGoals,
} from '@poker-range-trainer/database'

import type { PracticeStatsReset, SettingsRepository } from './service.js'

export interface Clock {
  now(): Date
}

/** An owner with no stored row has no goal; the contract pairs a null goal with a null timestamp. */
const NO_TRAINING_GOAL: TrainingGoalRead = { dailyHandsGoal: null, updatedAt: null }

/**
 * PostgreSQL user-settings persistence. A practice-stats reset is one transaction
 * so the reported range count and the deletions describe the same snapshot, and
 * ranges, hands, and the training goal are deliberately left untouched.
 */
export class PostgresSettingsRepository implements SettingsRepository {
  constructor(
    private readonly database: Database,
    private readonly clock: Clock = { now: () => new Date() },
  ) {}

  async readTrainingGoal(userId: string): Promise<TrainingGoalRead> {
    const [row] = await this.database
      .select({
        dailyHandGoal: userTrainingGoals.dailyHandGoal,
        updatedAt: userTrainingGoals.updatedAt,
      })
      .from(userTrainingGoals)
      .where(eq(userTrainingGoals.userId, userId))
      .limit(1)
    if (!row) return NO_TRAINING_GOAL
    return { dailyHandsGoal: row.dailyHandGoal, updatedAt: row.updatedAt.toISOString() }
  }

  async writeTrainingGoal(
    userId: string,
    dailyHandsGoal: number | null,
  ): Promise<TrainingGoalRead> {
    if (dailyHandsGoal === null) {
      await this.database.delete(userTrainingGoals).where(eq(userTrainingGoals.userId, userId))
      return NO_TRAINING_GOAL
    }
    const updatedAt = this.clock.now()
    const [row] = await this.database
      .insert(userTrainingGoals)
      .values({ userId, dailyHandGoal: dailyHandsGoal, updatedAt })
      .onConflictDoUpdate({
        target: userTrainingGoals.userId,
        set: { dailyHandGoal: dailyHandsGoal, updatedAt },
      })
      .returning({
        dailyHandGoal: userTrainingGoals.dailyHandGoal,
        updatedAt: userTrainingGoals.updatedAt,
      })
    if (!row) throw new Error('The training-goal upsert did not return a persisted row.')
    return { dailyHandsGoal: row.dailyHandGoal, updatedAt: row.updatedAt.toISOString() }
  }

  async resetPracticeStats(userId: string): Promise<PracticeStatsReset> {
    const resetAt = this.clock.now()
    return this.database.transaction(async (transaction) => {
      // Soft-deleted ranges still count: their practice records are being erased too.
      const counted = await transaction.execute(sql`
        select count(*)::int as "rangesReset" from (
          select ${practiceSessions.rangeId} as range_id from ${practiceSessions}
            where ${practiceSessions.userId} = ${userId}
          union
          select ${rangePracticeStats.rangeId} from ${rangePracticeStats}
            where ${rangePracticeStats.userId} = ${userId}
          union
          select ${rangeHandAccuracy.rangeId} from ${rangeHandAccuracy}
            where ${rangeHandAccuracy.userId} = ${userId}
          union
          select ${reviewStates.rangeId} from ${reviewStates}
            where ${reviewStates.userId} = ${userId}
        ) as practiced
      `)
      const countedRow = counted.rows[0] as { rangesReset: number | string } | undefined
      const rangesReset = Number(countedRow?.rangesReset ?? 0)

      // practice_attempts and practice_submission_replays cascade from the session rows.
      await transaction.delete(practiceSessions).where(eq(practiceSessions.userId, userId))
      await transaction.delete(rangePracticeStats).where(eq(rangePracticeStats.userId, userId))
      await transaction.delete(rangeHandAccuracy).where(eq(rangeHandAccuracy.userId, userId))
      await transaction.delete(reviewStates).where(eq(reviewStates.userId, userId))

      return { resetAt: resetAt.toISOString(), rangesReset }
    })
  }
}
