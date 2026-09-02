import { describe, it, expect } from 'vitest'
import {
  DRILL_DURATION_OPTIONS,
  DEFAULT_DRILL_SECONDS,
  getRemainingSeconds,
  isDrillOver,
} from './timedDrill'

describe('drill duration options', () => {
  it('offers the default duration as one of the choices', () => {
    expect(DRILL_DURATION_OPTIONS).toContain(DEFAULT_DRILL_SECONDS)
  })
})

describe('getRemainingSeconds', () => {
  it('returns the full duration at the instant the drill starts', () => {
    expect(getRemainingSeconds(1000, 60, 1000)).toBe(60)
  })

  it('returns the whole seconds left partway through', () => {
    // 60s drill, exactly 25s elapsed -> 35s remain.
    expect(getRemainingSeconds(0, 60, 25_000)).toBe(35)
  })

  it('rounds up a fractional remaining second', () => {
    // 24.5s elapsed -> 35.5s remain -> ceil to 36.
    expect(getRemainingSeconds(0, 60, 24_500)).toBe(36)
  })

  it('shows 1 throughout the final whole second', () => {
    expect(getRemainingSeconds(0, 60, 59_000)).toBe(1)
    expect(getRemainingSeconds(0, 60, 59_999)).toBe(1)
  })

  it('returns 0 at expiry and clamps to 0 past it', () => {
    expect(getRemainingSeconds(0, 60, 60_000)).toBe(0)
    expect(getRemainingSeconds(0, 60, 60_001)).toBe(0)
    expect(getRemainingSeconds(0, 60, 120_000)).toBe(0)
  })

  it('clamps a now before the start to the full duration (clock skew)', () => {
    expect(getRemainingSeconds(5_000, 60, 0)).toBe(60)
  })
})

describe('isDrillOver', () => {
  it('is false while time remains', () => {
    expect(isDrillOver(0, 60, 0)).toBe(false)
    expect(isDrillOver(0, 60, 59_999)).toBe(false)
  })

  it('flips to true exactly at expiry and stays true after', () => {
    expect(isDrillOver(0, 60, 60_000)).toBe(true)
    expect(isDrillOver(0, 60, 60_001)).toBe(true)
  })

  it('is false for a now before the start (clock skew)', () => {
    expect(isDrillOver(5_000, 60, 0)).toBe(false)
  })
})
