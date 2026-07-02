import type { RangeAction } from '@core/types/range';

// Per-action colors for the multi-action palette + grid. UI only — the reused @core has no
// styling, so (like theme/colors.ts) these live in mobile/. One distinct hue per action.
export const ACTION_COLORS: Record<RangeAction, string> = {
  fold: '#6b7280', // gray
  call: '#22c55e', // green
  raise: '#f59e0b', // amber
  threeBet: '#ef4444', // red
  fourBet: '#a855f7', // purple
  jam: '#ec4899', // pink
  mixed: '#06b6d4', // cyan
};
