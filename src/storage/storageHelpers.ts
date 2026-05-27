/**
 * Small validation primitives shared by the `localStorage`-backed storage
 * modules. Kept dependency-free and side-effect-free so every storage parser can
 * share one definition instead of copying it.
 */

/** True when `value` is a finite number that is zero or positive. */
export function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}
