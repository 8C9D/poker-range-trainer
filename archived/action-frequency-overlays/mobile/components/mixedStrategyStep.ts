/**
 * Pure stepping math for the mixed-strategy editor, kept out of the component so it unit-tests
 * without React (like `swipeAnswer.ts` / `postflopDrill.ts`). Mirrors the web editor's
 * `setFrequency`: set one action's frequency, rebuild in canonical `RANGE_ACTIONS` order
 * dropping zeros, and normalize via `@core` — the only difference is the mobile UI nudges by a
 * fixed step instead of dragging a slider.
 */
import { normalizeMixedStrategy, type HandMixedStrategy } from '@core/domain/mixedStrategy';
import { RANGE_ACTIONS, type RangeAction } from '@core/types/range';

/** Default nudge, in percentage points, for one +/- press. */
export const MIXED_STEP = 5;

/**
 * Nudge one action's frequency by `delta` steps of `step` percent (clamped to [0, 100]) and
 * return the next normalized strategy. `delta` is typically +1 (one "+" press) or -1 ("−").
 */
export function stepMixedFrequency(
  strategy: HandMixedStrategy,
  action: RangeAction,
  delta: number,
  step: number = MIXED_STEP,
): HandMixedStrategy {
  const byAction = new Map<RangeAction, number>();
  for (const entry of strategy) byAction.set(entry.action, entry.frequency);

  const current = byAction.get(action) ?? 0;
  const nextValue = Math.max(0, Math.min(100, current + delta * step));

  const next: HandMixedStrategy = [];
  for (const a of RANGE_ACTIONS) {
    const value = a === action ? nextValue : (byAction.get(a) ?? 0);
    if (value > 0) next.push({ action: a, frequency: value });
  }
  return normalizeMixedStrategy(next);
}
