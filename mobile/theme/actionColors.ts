import type { RangeAction } from '@core/types/range';

import type { ThemeColors } from './colors';

/**
 * Per-action fill colors for the multi-action palette + grid, derived from the Coach
 * theme tokens so they track light/dark. The three primary actions map straight onto
 * the CVD-validated action tokens (`raise`, `call`, `bet3`); the rarer actions get
 * muted, palette-derived variants so they stay distinct without competing for
 * attention. Keeps the `Record<RangeAction, string>` shape the grid/palette expect.
 */
export function actionColors(theme: ThemeColors): Record<RangeAction, string> {
  return {
    fold: theme.ink3, // muted neutral — "out of range"
    call: theme.call,
    raise: theme.raise,
    threeBet: theme.bet3,
    fourBet: theme.diamond, // escalation past 3-bet, CVD-safe blue
    jam: theme.accentStrong, // deep gold — all-in
    mixed: theme.ink2, // meta action, quiet
  };
}
