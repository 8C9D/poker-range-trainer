import { isValidHand, type PokerHand } from '@poker-range-trainer/domain/domain/pokerHands'

/**
 * The `sessionStorage` handoff that lets one screen start a drill over a
 * specific set of hands.
 *
 * A hand list is too long for a query string (a leak report can name dozens of
 * hands across several ranges), and it is throwaway state: it belongs to the
 * click that started the drill, not to the URL. So the sender writes the pools
 * under a generated key and passes only that key as `?pools=`; the practice
 * screen reads the key once and removes the entry, so a refresh or a shared
 * link cannot silently re-apply a stale pool.
 *
 * Everything read back is re-validated: the value crossed a storage boundary
 * that any script on the origin can write, so an unknown hand is dropped rather
 * than trusted.
 */

/** Hands to draw from, per range id. */
export type DrillPools = Record<string, PokerHand[]>

const STORAGE_PREFIX = 'prt.drill-pools.'

/** A handoff is a one-screen affair; nobody queues a hundred charts by hand. */
const MAX_POOL_RANGES = 100

/**
 * Keys this page has already consumed, with what they held.
 *
 * The storage entry is removed on the first read, but React may render or mount
 * the reader more than once (StrictMode does exactly that in development), and
 * the second read must not come back empty and silently widen the drill to all
 * 169 hands. Module-scoped, so a real page load starts with nothing remembered.
 */
const consumed = new Map<string, DrillPools>()

function sessionStore(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.sessionStorage
  } catch {
    // Storage access throws outright when the browser blocks site data.
    return undefined
  }
}

/** Keep only the entries that name at least one canonical hand. */
export function sanitizeDrillPools(value: unknown): DrillPools {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const pools: DrillPools = {}
  for (const [rangeId, hands] of Object.entries(value).slice(0, MAX_POOL_RANGES)) {
    if (!Array.isArray(hands)) continue
    const valid = [
      ...new Set(
        hands.filter((hand): hand is PokerHand => typeof hand === 'string' && isValidHand(hand)),
      ),
    ]
    if (valid.length > 0) pools[rangeId] = valid
  }
  return pools
}

/**
 * Stash `pools` for a drill and return the key to pass as `?pools=`. The key is
 * returned even when storage is unavailable; the reader then simply finds
 * nothing and drills the mode's normal pool.
 */
export function storeDrillPools(pools: DrillPools): string {
  const key = crypto.randomUUID()
  const store = sessionStore()
  try {
    store?.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(pools))
  } catch {
    // A full or blocked quota is not worth failing the navigation over.
  }
  return key
}

function takeStoredPools(key: string): DrillPools {
  const store = sessionStore()
  if (!store) return {}
  const name = `${STORAGE_PREFIX}${key}`
  let raw: string | null
  try {
    raw = store.getItem(name)
    store.removeItem(name)
  } catch {
    return {}
  }
  if (raw === null) return {}
  try {
    return sanitizeDrillPools(JSON.parse(raw))
  } catch {
    return {}
  }
}

/**
 * The pools stored under `key`, removing them from storage on the first read.
 * An unknown or already-used key yields no pools at all rather than an error.
 */
export function readDrillPools(key: string): DrillPools {
  const cached = consumed.get(key)
  if (cached) return cached
  const pools = takeStoredPools(key)
  consumed.set(key, pools)
  return pools
}

/** Forget which keys this page has consumed. Exists so tests start clean. */
export function clearDrillPoolCache(): void {
  consumed.clear()
}
