/**
 * Pure domain logic for the timed-drill practice mode: how many whole seconds
 * remain on a fixed-length countdown, and whether it has expired.
 *
 * The current time is always passed in as `nowEpochMs` rather than read from a
 * clock, so the countdown is fully deterministic and unit-testable without fake
 * timers. Uses only arithmetic — no React, browser APIs, `Date`, or `Math.random`.
 */

/** Selectable drill lengths, in seconds. */
export const DRILL_DURATION_OPTIONS: readonly number[] = [30, 60, 120]

/** Default drill length, in seconds (one of `DRILL_DURATION_OPTIONS`). */
export const DEFAULT_DRILL_SECONDS = 60

/** Clamp `value` into the inclusive range [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Whole seconds left on a `durationSeconds` countdown that started at
 * `startEpochMs`, evaluated at `nowEpochMs`.
 *
 * Rounds up, so the display shows the full duration at the instant the drill
 * starts and only reaches 0 once the time is fully spent. Clamped to
 * [0, durationSeconds]: clock skew (a `now` before `start`) never reports more
 * than the full duration, and an expired drill never reports a negative.
 */
export function getRemainingSeconds(
  startEpochMs: number,
  durationSeconds: number,
  nowEpochMs: number,
): number {
  const elapsedMs = nowEpochMs - startEpochMs
  const remaining = Math.ceil((durationSeconds * 1000 - elapsedMs) / 1000)
  return clamp(remaining, 0, durationSeconds)
}

/** Whether the countdown that started at `startEpochMs` has fully elapsed. */
export function isDrillOver(
  startEpochMs: number,
  durationSeconds: number,
  nowEpochMs: number,
): boolean {
  return getRemainingSeconds(startEpochMs, durationSeconds, nowEpochMs) === 0
}
