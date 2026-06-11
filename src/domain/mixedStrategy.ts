import { RANGE_ACTIONS, type RangeAction } from '../types/range'

/**
 * Mixed-frequency strategy model (v4.2 "mixed-frequency strategies").
 *
 * A hand can take several actions, each with a frequency (e.g. A5s → 50%
 * fourBet, 50% fold). Pure and serializable-friendly so later slices can
 * persist `Record<PokerHand, HandMixedStrategy>` on a range and build a
 * frequency editor / practice mode.
 */

/** One weighted action: `frequency` is a percentage in [0, 100]. */
export interface MixedAction {
  action: RangeAction
  frequency: number
}

/** A hand's full mixed strategy (zero or more weighted actions). */
export type HandMixedStrategy = MixedAction[]

/** Frequencies within this epsilon of 100 count as a complete strategy. */
const VALID_EPSILON = 0.01

/**
 * Normalize a mixed strategy: drop entries with a non-positive or non-finite
 * frequency, merge duplicate actions (summing their frequencies), and return
 * the survivors in canonical `RANGE_ACTIONS` order.
 */
export function normalizeMixedStrategy(actions: HandMixedStrategy): HandMixedStrategy {
  const sums = new Map<RangeAction, number>()
  for (const { action, frequency } of actions) {
    if (typeof frequency !== 'number' || !Number.isFinite(frequency) || frequency <= 0) continue
    if (!(RANGE_ACTIONS as readonly string[]).includes(action)) continue
    sums.set(action, (sums.get(action) ?? 0) + frequency)
  }
  return RANGE_ACTIONS.filter((action) => sums.has(action)).map((action) => ({
    action,
    frequency: sums.get(action) as number,
  }))
}

/** Total frequency across a (normalized) strategy. */
export function totalFrequency(actions: HandMixedStrategy): number {
  return normalizeMixedStrategy(actions).reduce((sum, { frequency }) => sum + frequency, 0)
}

/** Whether the strategy's frequencies sum to 100 (within a small epsilon). */
export function isValidMixedStrategy(actions: HandMixedStrategy): boolean {
  return Math.abs(totalFrequency(actions) - 100) <= VALID_EPSILON
}

/**
 * The highest-frequency action, ties broken by canonical `RANGE_ACTIONS` order.
 * Returns `null` for an empty (or all-invalid) strategy.
 */
export function primaryAction(actions: HandMixedStrategy): RangeAction | null {
  const normalized = normalizeMixedStrategy(actions)
  if (normalized.length === 0) return null
  // Already in canonical order, so the first max wins the tie-break.
  return normalized.reduce((best, current) =>
    current.frequency > best.frequency ? current : best,
  ).action
}
