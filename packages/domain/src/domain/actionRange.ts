import { accuracyPercentage } from './accuracy.js'
import { ALL_HANDS, type PokerHand } from './pokerHands.js'
import { calculateRangePercentage } from './rangeMath.js'
import { formatRangeNotation, parseRangeNotation } from './rangeNotation.js'
import type { ActionAttempt } from '../types/practice.js'
import { RANGE_ACTIONS, RANGE_ACTION_LABELS, type RangeAction } from '../types/range.js'

/**
 * Pure helpers for v2.3 multi-action ranges, where each hand maps to a single
 * `RangeAction` (`Record<PokerHand, RangeAction>`). Selection and counts run over
 * `ALL_HANDS` so results are always in canonical 13×13 order. Pure — inputs are
 * never mutated.
 */

/** The hands assigned `action`, in canonical 13×13 order. */
export function handsForAction(
  handActions: Record<PokerHand, RangeAction>,
  action: RangeAction,
): PokerHand[] {
  return ALL_HANDS.filter((hand) => handActions[hand] === action)
}

/**
 * Percentage (0–100) of all 1326 Hold'em combos covered by the hands assigned
 * `action`. An action with no hands is 0.
 */
export function actionRangePercentage(
  handActions: Record<PokerHand, RangeAction>,
  action: RangeAction,
): number {
  return calculateRangePercentage(handsForAction(handActions, action))
}

/** A chart to read actions off: its membership list, plus the action overlay. */
export interface ActionChart {
  hands: readonly PokerHand[]
  handActions?: Record<PokerHand, RangeAction>
}

/**
 * The action overlay narrowed to the hands the range actually holds.
 *
 * `hands` is the membership list (see `SavedRange`), and the other three
 * per-hand overlays are already scoped to it in both the editor and storage;
 * only this one was not. A hand carrying an action but absent from `hands` was
 * therefore quizzed as, say, a 3-bet while the recognition drill graded the same
 * hand a fold — two drills on one chart with opposite right answers, and an
 * exported image colouring a cell the hand count leaves out.
 *
 * Doing the narrowing HERE, once, is the point: every reader that used the raw
 * map had to remember to scope it, and none of them did. The assignment itself
 * is deliberately left in storage — it costs nothing, and it comes back into
 * force the moment the hand is added to the range again.
 */
export function scopedHandActions(chart: ActionChart): Record<PokerHand, RangeAction> {
  const scoped: Record<PokerHand, RangeAction> = {}
  if (!chart.handActions) return scoped
  for (const hand of chart.hands) {
    const action = chart.handActions[hand]
    if (action !== undefined) scoped[hand] = action
  }
  return scoped
}

/**
 * The range's hands that have an assigned action, in canonical 13×13 order — the
 * prompt pool for mode-2 ("what is the correct action?") practice, so the quiz
 * only asks about hands the chart both holds and assigns.
 */
export function assignedHands(chart: ActionChart): PokerHand[] {
  const scoped = scopedHandActions(chart)
  return ALL_HANDS.filter((hand) => scoped[hand] !== undefined)
}

/**
 * The correct action for `hand` in a multi-action range: its assigned action, or
 * `'fold'` when the hand is unassigned (a hand outside every action group folds).
 */
export function correctActionFor(
  handActions: Record<PokerHand, RangeAction>,
  hand: PokerHand,
): RangeAction {
  return handActions[hand] ?? 'fold'
}

/**
 * Per-action accuracy for a mode-2 action-quiz session, measured against each
 * attempt's expected (correct) action.
 */
export interface ActionAccuracyStat {
  /** The expected (correct) action these counts are for. */
  action: RangeAction
  /** Times a hand whose correct action is `action` was quizzed. */
  attempts: number
  /** Of those, how many the user answered correctly. */
  correct: number
}

/**
 * Cumulative per-action accuracy for one range, keyed by action. `Partial`
 * because `RangeAction` is a closed union and only the actions actually quizzed
 * are present (unlike `RangeHandAccuracy`, where `PokerHand` is `string`).
 */
export type RangeActionAccuracy = Partial<Record<RangeAction, ActionAccuracyStat>>

/**
 * Aggregate a mode-2 action-quiz session's attempts into per-action accuracy,
 * grouped by each attempt's `expected` (correct) action. Returns one stat per
 * expected action that appeared, in canonical `RANGE_ACTIONS` order; actions
 * never quizzed are omitted. Pure — the input is never mutated. Mirrors
 * `summarizeHandAccuracy` for the action quiz.
 */
export function summarizeActionAccuracy(attempts: ActionAttempt[]): ActionAccuracyStat[] {
  const byAction = new Map<RangeAction, ActionAccuracyStat>()
  for (const { expected, correct } of attempts) {
    let stat = byAction.get(expected)
    if (!stat) {
      stat = { action: expected, attempts: 0, correct: 0 }
      byAction.set(expected, stat)
    }
    stat.attempts += 1
    if (correct) stat.correct += 1
  }
  return RANGE_ACTIONS.filter((action) => byAction.has(action)).map(
    (action) => byAction.get(action)!,
  )
}

/**
 * An action's accuracy as a percentage (0–100): `correct / attempts * 100`, or 0
 * when there are no attempts (never NaN). Mirrors `handAccuracyRate`.
 */
export function actionAccuracyRate(stat: ActionAccuracyStat): number {
  return accuracyPercentage(stat.correct, stat.attempts)
}

/**
 * Format a multi-action chart as action-grouped notation: one line per action
 * that has hands, in canonical `RANGE_ACTIONS` order, as
 * `"{label}: {comma-separated hands}"` (hands via `formatRangeNotation`, so each
 * group is canonical and deduped). An empty or actionless map returns "". Pure —
 * the input is never mutated.
 */
export function formatActionNotation(handActions: Record<PokerHand, RangeAction>): string {
  return RANGE_ACTIONS.map((action) => {
    const hands = handsForAction(handActions, action)
    return hands.length > 0 ? `${RANGE_ACTION_LABELS[action]}: ${formatRangeNotation(hands)}` : ''
  })
    .filter((line) => line.length > 0)
    .join('\n')
}

/**
 * Parse action-grouped notation (the inverse of `formatActionNotation`) into a
 * `handActions` map. Each non-blank line is `"{label}: {notation}"`: the label
 * (trimmed, case-insensitive) names a `RangeAction`, and the right side is hand
 * notation parsed by `parseRangeNotation`. Empty/whitespace input yields `{}`.
 *
 * Throws on a line without a colon, an unknown action label, invalid hand
 * notation (via `parseRangeNotation`), or a hand assigned to two different
 * actions (repeating the same action for a hand is idempotent). Pure — the input
 * is never mutated.
 */
export function parseActionNotation(input: string): Record<PokerHand, RangeAction> {
  const actionByLabel = new Map<string, RangeAction>(
    RANGE_ACTIONS.map((action) => [RANGE_ACTION_LABELS[action].toLowerCase(), action]),
  )

  const result: Record<PokerHand, RangeAction> = {}
  for (const rawLine of input.split('\n')) {
    const line = rawLine.trim()
    if (line.length === 0) continue

    const colon = line.indexOf(':')
    if (colon === -1) {
      throw new Error(`Invalid action line (expected "Action: hands"): "${line}".`)
    }

    const label = line.slice(0, colon).trim()
    const action = actionByLabel.get(label.toLowerCase())
    if (action === undefined) {
      throw new Error(`Unknown action label: "${label}".`)
    }

    for (const hand of parseRangeNotation(line.slice(colon + 1))) {
      const prior = result[hand]
      if (prior !== undefined && prior !== action) {
        throw new Error(`Hand ${hand} is assigned to two actions (${prior} and ${action}).`)
      }
      result[hand] = action
    }
  }
  return result
}
