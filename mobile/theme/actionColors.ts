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

// --- Legacy static palette (pre-Coach) ------------------------------------------
// Still consumed by the flat-route action editors/grids not yet ported to the Coach
// IA. Removed together with those screens at the end of the port.
export const ACTION_COLORS: Record<RangeAction, string> = {
  fold: '#6b7280', // gray
  call: '#22c55e', // green
  raise: '#f59e0b', // amber
  threeBet: '#ef4444', // red
  fourBet: '#a855f7', // purple
  jam: '#ec4899', // pink
  mixed: '#06b6d4', // cyan
};
