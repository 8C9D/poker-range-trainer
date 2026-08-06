import type { RangeAction } from '@core/types/range';

import type { ThemeColors } from './colors';

/**
 * Per-action fill colors for the multi-action palette + grid, derived from the Coach
 * theme tokens so they track light/dark. The same seven the web app aliases as
 * `--act-*`; the primary actions map onto the CVD-validated action tokens (`raise`,
 * `bet3`), the rarer ones onto muted palette variants so they stay distinct without
 * competing for attention. Keeps the `Record<RangeAction, string>` shape the
 * grid/palette expect, and every fill carries `theme.onAction` as its ink.
 */
export function actionColors(theme: ThemeColors): Record<RangeAction, string> {
  return {
    fold: theme.ink3, // muted neutral — "out of range"
    // `good`, not `call`: the fill answers to the ink on top of it, and the
    // lighter `call` green left the hand label at 4.3:1 in light mode.
    call: theme.good,
    raise: theme.raise,
    threeBet: theme.bet3,
    fourBet: theme.diamond, // escalation past 3-bet, CVD-safe blue
    jam: theme.accentStrong, // deep gold — all-in
    mixed: theme.ink2, // meta action, quiet
  };
}
