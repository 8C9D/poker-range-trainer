/**
 * Small validation primitives shared by the `localStorage`-backed storage
 * modules. Kept dependency-free and side-effect-free so every storage parser can
 * share one definition instead of copying it.
 */

/** True when `value` is a finite number that is zero or positive. */
export function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/** Return `value` when it is one of `allowed`, else `undefined`. */
export function asMember<T extends string>(allowed: readonly T[], value: unknown): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined
}

/**
 * Read and JSON-parse the value stored at `key`.
 *
 * Returns `undefined` when the key is absent or the stored text is not valid
 * JSON, collapsing the "missing" and "corrupt" cases so callers only have to
 * validate the shape of the parsed value (not re-handle IO and parse errors).
 */
export function readJson(key: string): unknown {
  const raw = localStorage.getItem(key)
  if (raw === null) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

/**
 * JSON-serialize `value` and write it at `key`.
 *
 * `localStorage.setItem` throws when the origin's quota is exhausted, and in
 * browsers where storage is disabled outright. Raw, that throw escapes from a
 * click handler, where React error boundaries cannot see it, so a save just
 * appears to do nothing. Rethrowing something a person can read lets the caller
 * put the failure on screen; the original is kept as `cause`.
 *
 * The message avoids naming the browser: the iOS app runs this same module over
 * an MMKV-backed `localStorage` shim, where the failure is a full device instead.
 */
export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    throw new Error(
      'Could not save: storage is full or unavailable. Export a backup, then delete some ranges to free space.',
      { cause: error },
    )
  }
}
