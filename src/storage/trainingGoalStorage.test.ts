import { describe, expect, it, beforeEach } from 'vitest'
import {
  TRAINING_GOAL_STORAGE_KEY,
  loadTrainingGoal,
  saveTrainingGoal,
} from './trainingGoalStorage'

beforeEach(() => {
  localStorage.clear()
})

describe('trainingGoalStorage', () => {
  it('starts with no goal', () => {
    expect(loadTrainingGoal()).toBe(0)
  })

  it('round-trips a target', () => {
    saveTrainingGoal(40)
    expect(loadTrainingGoal()).toBe(40)
  })

  it('clears the goal for a non-positive target', () => {
    saveTrainingGoal(40)
    saveTrainingGoal(0)
    expect(localStorage.getItem(TRAINING_GOAL_STORAGE_KEY)).toBeNull()
    expect(loadTrainingGoal()).toBe(0)
  })

  it('floors a fractional target', () => {
    saveTrainingGoal(20.7)
    expect(loadTrainingGoal()).toBe(20)
  })

  it('reads corrupt or nonsensical stored values as no goal', () => {
    for (const raw of ['not json', '"20"', 'null', '-3', 'Infinity']) {
      localStorage.setItem(TRAINING_GOAL_STORAGE_KEY, raw)
      expect(loadTrainingGoal()).toBe(0)
    }
  })

  it('reads a stored zero as no goal', () => {
    localStorage.setItem(TRAINING_GOAL_STORAGE_KEY, '0')
    expect(loadTrainingGoal()).toBe(0)
  })
})
