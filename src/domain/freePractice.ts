import type { PokerHand } from './pokerHands'
import { rankWeakHands, weakHandPools } from './weakHands'
import type { RangeHandAccuracy, RangeReviewState } from '../types/practice'
import type { SavedRange } from '../types/range'

/**
 * What to practise when nothing is due (v9.3).
 *
 * Being caught up is where a diligent user spends most days, and Today answered
 * it with a link to the Library — handing back the whole "pick a range, pick a
 * mode" decision the rest of the screen exists to make for them. The app already
 * knows two better answers, and this picks between them: the hands it has
 * watched them get wrong, or the chart that goes stale next.
 *
 * Pure; the caller supplies the loaded library, records and clock.
 */

/** The most useful practice available with nothing due, or null when there is none. */
export type FreePractice =
  | {
      kind: 'weakHands'
      /** Per-range hand pools, the same shape the Progress screen's drill uses. */
      pools: Record<string, PokerHand[]>
      /** The ranges the pools cover, in library order. */
      ranges: SavedRange[]
      /** How many (range, hand) pairs the drill would cover. */
      handCount: number
    }
  | {
      kind: 'reviewEarly'
      /** The range whose review comes round soonest. */
      range: SavedRange
      dueAt: string
    }

export interface FreePracticeInput {
  ranges: SavedRange[]
  handAccuracy: Record<string, RangeHandAccuracy>
  reviewStates: Record<string, RangeReviewState>
  /** ISO-8601 "now", supplied so the pick is reproducible. */
  now: string
  /** How many weak hands one suggested drill covers. */
  limit?: number
}

export function suggestFreePractice(input: FreePracticeInput): FreePractice | null {
  const { ranges, handAccuracy, reviewStates, now, limit = 10 } = input
  const active = ranges.filter((range) => !range.archived)
  if (active.length === 0) return null

  // Scoped BEFORE ranking, like the Progress screen: a record whose range is
  // gone would otherwise spend one of the capped slots and push a real leak off
  // the end — and then name a drill that cannot be run.
  const liveIds = new Set(active.map((range) => range.id))
  const liveAccuracy = Object.fromEntries(
    Object.entries(handAccuracy).filter(([rangeId]) => liveIds.has(rangeId)),
  )
  const weakest = rankWeakHands(liveAccuracy, limit)
  if (weakest.length > 0) {
    const pools = weakHandPools(weakest)
    const covered = active.filter((range) => pools[range.id]?.length)
    if (covered.length > 0) {
      return { kind: 'weakHands', pools, ranges: covered, handCount: weakest.length }
    }
  }

  // Nothing recorded to work on, so get ahead instead: the range whose schedule
  // comes round soonest. Anything already due would have been offered as a
  // review, so every candidate here is genuinely early.
  const nowMs = new Date(now).getTime()
  if (!Number.isFinite(nowMs)) return null
  let soonest: { range: SavedRange; dueAt: string; at: number } | null = null
  for (const range of active) {
    const dueAt = reviewStates[range.id]?.dueAt
    if (typeof dueAt !== 'string') continue
    const at = new Date(dueAt).getTime()
    if (!Number.isFinite(at) || at <= nowMs) continue
    if (soonest === null || at < soonest.at) soonest = { range, dueAt, at }
  }
  return soonest ? { kind: 'reviewEarly', range: soonest.range, dueAt: soonest.dueAt } : null
}

/** One line describing the suggestion, for the "all caught up" card. */
export function describeFreePractice(suggestion: FreePractice): string {
  if (suggestion.kind === 'weakHands') {
    const { handCount, ranges } = suggestion
    return `Sharpen the ${handCount} hand${handCount === 1 ? '' : 's'} you play worst, across ${ranges.length} chart${ranges.length === 1 ? '' : 's'}.`
  }
  return `Get ahead: ${suggestion.range.name} comes round next.`
}

/** The button that runs the suggestion. */
export function freePracticeAction(suggestion: FreePractice): string {
  return suggestion.kind === 'weakHands' ? 'Drill weak hands' : 'Review early'
}
