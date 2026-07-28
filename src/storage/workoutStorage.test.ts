import { describe, it, expect, beforeEach } from 'vitest'
import {
  WORKOUT_STORAGE_KEY,
  loadWorkoutCompletion,
  recordWorkoutCompletion,
} from './workoutStorage'

beforeEach(() => {
  localStorage.clear()
})

describe('workout completion storage', () => {
  it('loads null when nothing is recorded', () => {
    expect(loadWorkoutCompletion()).toBeNull()
  })

  it('round-trips a completion timestamp', () => {
    recordWorkoutCompletion('2026-07-28T09:00:00.000Z')
    expect(loadWorkoutCompletion()).toBe('2026-07-28T09:00:00.000Z')
  })

  it('keeps only the latest completion', () => {
    recordWorkoutCompletion('2026-07-27T09:00:00.000Z')
    recordWorkoutCompletion('2026-07-28T09:00:00.000Z')
    expect(loadWorkoutCompletion()).toBe('2026-07-28T09:00:00.000Z')
  })

  it('degrades to null on corrupt or malformed data', () => {
    localStorage.setItem(WORKOUT_STORAGE_KEY, 'not json')
    expect(loadWorkoutCompletion()).toBeNull()

    localStorage.setItem(WORKOUT_STORAGE_KEY, JSON.stringify({ lastCompletedAt: 42 }))
    expect(loadWorkoutCompletion()).toBeNull()

    localStorage.setItem(WORKOUT_STORAGE_KEY, JSON.stringify({ lastCompletedAt: 'not a date' }))
    expect(loadWorkoutCompletion()).toBeNull()

    localStorage.setItem(WORKOUT_STORAGE_KEY, JSON.stringify('2026-07-28T09:00:00.000Z'))
    expect(loadWorkoutCompletion()).toBeNull()
  })
})
