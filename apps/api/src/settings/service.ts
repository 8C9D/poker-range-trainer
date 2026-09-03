import type { TrainingGoalRead } from '@poker-range-trainer/contracts'

/** Outcome of an explicit practice-stats reset; timestamps are already contract-shaped. */
export interface PracticeStatsReset {
  resetAt: string
  rangesReset: number
}

export interface SettingsRepository {
  readTrainingGoal(userId: string): Promise<TrainingGoalRead>
  /** `null` clears the goal; a number upserts it. Returns the resulting read. */
  writeTrainingGoal(userId: string, dailyHandsGoal: number | null): Promise<TrainingGoalRead>
  resetPracticeStats(userId: string): Promise<PracticeStatsReset>
}

/** Application boundary for authenticated user settings; the router owns no persistence. */
export class SettingsService {
  constructor(private readonly repository: SettingsRepository) {}

  readTrainingGoal(userId: string): Promise<TrainingGoalRead> {
    return this.repository.readTrainingGoal(userId)
  }
  writeTrainingGoal(userId: string, dailyHandsGoal: number | null): Promise<TrainingGoalRead> {
    return this.repository.writeTrainingGoal(userId, dailyHandsGoal)
  }
  resetPracticeStats(userId: string): Promise<PracticeStatsReset> {
    return this.repository.resetPracticeStats(userId)
  }
}
